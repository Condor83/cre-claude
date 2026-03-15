import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { createHash } from 'crypto';
import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Project root — works both in dev (process.cwd) and built mode
const PROJECT_ROOT = process.env.CRE_DATA_DIR || process.cwd();
const DATA_DIR = join(PROJECT_ROOT, 'data');
const SCHEMA_PATH = join(PROJECT_ROOT, 'src', 'lib', 'db', 'schema.sql');

let _db: Database.Database | null = null;

/** Allow tests to inject an in-memory database */
export function _setDbForTesting(db: Database.Database): void {
	_db = db;
}

// ── Content hashing for deduplication ──
// STABLE API: changing normalization invalidates all stored hashes.
// Do not modify without re-hashing all chunks.

function normalizeContent(content: string): string {
	if (!content) return '';
	return content
		.replace(/\r\n/g, '\n')
		.replace(/\t/g, ' ')
		.replace(/ {2,}/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

function contentHash(content: string): string {
	return createHash('sha256').update(normalizeContent(content)).digest('hex');
}

// ── Schema migration: old chunks (with document_id) → deduplicated chunks + document_chunks junction ──

function migrateChunksDedup(db: Database.Database): void {
	// Detect old schema: chunks table has document_id column
	const cols = db.prepare("PRAGMA table_info(chunks)").all() as Array<{ name: string }>;
	const hasDocumentId = cols.some(c => c.name === 'document_id');
	if (!hasDocumentId) return; // Already migrated or fresh DB

	console.log('[dedup-migration] Detected old chunks schema, migrating...');

	// Disable foreign keys during migration to prevent CASCADE on DROP TABLE
	db.pragma('foreign_keys = OFF');

	const migrate = db.transaction(() => {
		// 1. Create document_chunks junction table
		db.exec(`
			CREATE TABLE IF NOT EXISTS document_chunks (
				id INTEGER PRIMARY KEY,
				document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
				chunk_id INTEGER NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
				page_start INTEGER,
				page_end INTEGER,
				UNIQUE(document_id, chunk_id)
			);
			CREATE INDEX IF NOT EXISTS idx_dc_document ON document_chunks(document_id);
			CREATE INDEX IF NOT EXISTS idx_dc_chunk ON document_chunks(chunk_id);
		`);

		// 2. Populate junction from existing chunks
		db.exec(`
			INSERT OR IGNORE INTO document_chunks (document_id, chunk_id, page_start, page_end)
			SELECT document_id, id, page_start, page_end FROM chunks
		`);

		// 3. Create new chunks table with content_hash, without document_id
		db.exec(`
			CREATE TABLE chunks_new (
				id INTEGER PRIMARY KEY,
				content_hash TEXT NOT NULL,
				chunk_type TEXT NOT NULL CHECK(chunk_type IN ('clause', 'exemplar', 'evidence', 'table')),
				section_label TEXT,
				content TEXT NOT NULL,
				confidence REAL DEFAULT 1.0
			);
		`);

		// 4. Deduplicate: for each chunk, compute hash and handle duplicates
		const allChunks = db.prepare('SELECT id, chunk_type, section_label, content, confidence FROM chunks ORDER BY id').all() as Array<{
			id: number; chunk_type: string; section_label: string | null; content: string; confidence: number;
		}>;

		const hashToCanonicalId = new Map<string, number>();
		const oldToCanonicalId = new Map<number, number>(); // maps old duplicate IDs to canonical IDs
		const insertNew = db.prepare('INSERT INTO chunks_new (id, content_hash, chunk_type, section_label, content, confidence) VALUES (?, ?, ?, ?, ?, ?)');
		const updateConfidence = db.prepare('UPDATE chunks_new SET confidence = ? WHERE id = ?');

		for (const chunk of allChunks) {
			const hash = contentHash(chunk.content);
			const existing = hashToCanonicalId.get(hash);

			if (existing !== undefined) {
				// Duplicate — record mapping for repointing
				oldToCanonicalId.set(chunk.id, existing);
				// Keep highest confidence
				const currentConf = (db.prepare('SELECT confidence FROM chunks_new WHERE id = ?').get(existing) as { confidence: number })?.confidence ?? 0;
				if (chunk.confidence > currentConf) {
					updateConfidence.run(chunk.confidence, existing);
				}
			} else {
				// New canonical chunk
				insertNew.run(chunk.id, hash, chunk.chunk_type, chunk.section_label, chunk.content, chunk.confidence);
				hashToCanonicalId.set(hash, chunk.id);
			}
		}

		// 5. Repoint document_chunks links for duplicates
		const checkLink = db.prepare('SELECT 1 FROM document_chunks WHERE document_id = ? AND chunk_id = ?');
		const updateLink = db.prepare('UPDATE document_chunks SET chunk_id = ? WHERE document_id = ? AND chunk_id = ?');
		const deleteLink = db.prepare('DELETE FROM document_chunks WHERE document_id = ? AND chunk_id = ?');

		for (const [oldId, canonicalId] of oldToCanonicalId) {
			// Get all document_chunks rows pointing to the old duplicate chunk
			const links = db.prepare('SELECT document_id FROM document_chunks WHERE chunk_id = ?').all(oldId) as Array<{ document_id: number }>;
			for (const link of links) {
				// Check if this document already has a link to the canonical chunk
				const alreadyLinked = checkLink.get(link.document_id, canonicalId);
				if (alreadyLinked) {
					// Same-doc collision — content already represented, delete old link
					deleteLink.run(link.document_id, oldId);
				} else {
					// Repoint to canonical
					updateLink.run(canonicalId, link.document_id, oldId);
				}
			}
		}

		// 6. Clean up orphaned document_chunks (pointing to chunks not in chunks_new)
		db.exec(`
			DELETE FROM document_chunks
			WHERE chunk_id NOT IN (SELECT id FROM chunks_new)
		`);

		// 7. Delete vec_chunks entries for removed duplicate chunk IDs
		const duplicateIds = [...oldToCanonicalId.keys()];
		if (duplicateIds.length > 0) {
			const deleteVec = db.prepare('DELETE FROM vec_chunks WHERE rowid = ?');
			for (const id of duplicateIds) {
				deleteVec.run(id);
			}
		}

		// 8. Swap tables
		db.exec('DROP TABLE chunks');
		db.exec('ALTER TABLE chunks_new RENAME TO chunks');

		// 9. Recreate indexes
		db.exec(`
			CREATE UNIQUE INDEX IF NOT EXISTS idx_chunks_hash ON chunks(content_hash);
			CREATE INDEX IF NOT EXISTS idx_chunks_type ON chunks(chunk_type);
			CREATE INDEX IF NOT EXISTS idx_chunks_section ON chunks(section_label);
		`);

		const totalOld = allChunks.length;
		const totalNew = hashToCanonicalId.size;
		const dupes = totalOld - totalNew;
		const ratio = totalOld > 0 ? (dupes / totalOld * 100).toFixed(1) : '0.0';
		console.log(`[dedup-migration] Complete: ${totalOld} chunks → ${totalNew} canonical (${dupes} duplicates removed, ratio ${ratio}%)`);
	});

	try {
		migrate();
	} finally {
		db.pragma('foreign_keys = ON');
	}
}

// ── Schema migration: add wizard columns to properties + reports ──

function migrateWizardSchema(db: Database.Database): void {
	// Check if properties already has 'county' column
	const propCols = db.prepare("PRAGMA table_info(properties)").all() as Array<{ name: string }>;
	const hasCounty = propCols.some(c => c.name === 'county');

	// Check if reports has old CHECK constraint (approach column with CHECK)
	const reportCols = db.prepare("PRAGMA table_info(reports)").all() as Array<{ name: string }>;
	const hasClientName = reportCols.some(c => c.name === 'client_name');

	const hasMarketValue = propCols.some(c => c.name === 'market_value');
	const hasCountyDataJson = propCols.some(c => c.name === 'county_data_json');

	if (hasCounty && hasClientName && hasMarketValue && hasCountyDataJson) return; // Already migrated

	console.log('[wizard-migration] Adding wizard columns...');

	db.pragma('foreign_keys = OFF');

	const migrate = db.transaction(() => {
		// Add new columns to properties (if missing)
		if (!hasCounty) {
			db.exec(`ALTER TABLE properties ADD COLUMN county TEXT`);
			db.exec(`ALTER TABLE properties ADD COLUMN owner_name TEXT`);
			db.exec(`ALTER TABLE properties ADD COLUMN acquisition_date TEXT`);
			db.exec(`ALTER TABLE properties ADD COLUMN occupancy TEXT`);
		}
		if (!hasMarketValue) {
			db.exec(`ALTER TABLE properties ADD COLUMN market_value REAL`);
		}
		if (!hasCountyDataJson) {
			db.exec(`ALTER TABLE properties ADD COLUMN county_data_json TEXT`);
		}

		// Rebuild reports table to drop CHECK constraint and add new columns
		if (!hasClientName) {
			db.exec(`
				CREATE TABLE reports_new (
					id INTEGER PRIMARY KEY,
					report_number TEXT,
					subject_property_id INTEGER REFERENCES properties(id),
					approach TEXT,
					effective_date TEXT,
					client_name TEXT,
					intended_use TEXT DEFAULT 'estimate market value',
					property_rights TEXT DEFAULT 'fee simple',
					status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'review', 'final')),
					created_at TEXT DEFAULT CURRENT_TIMESTAMP,
					updated_at TEXT DEFAULT CURRENT_TIMESTAMP
				);

				INSERT INTO reports_new (id, report_number, subject_property_id, approach, effective_date, status, created_at, updated_at)
				SELECT id, report_number, subject_property_id, approach, effective_date, status, created_at, updated_at FROM reports;
			`);

			// Migrate approach values to JSON array format
			db.exec(`
				UPDATE reports_new SET approach = '["sales_comparison","income_cap"]' WHERE approach = 'both';
				UPDATE reports_new SET approach = '["sales_comparison"]' WHERE approach = 'sales_comparison';
				UPDATE reports_new SET approach = '["income_cap"]' WHERE approach = 'income_cap';
			`);

			db.exec(`DROP TABLE reports`);
			db.exec(`ALTER TABLE reports_new RENAME TO reports`);
		}
	});

	try {
		migrate();
	} finally {
		db.pragma('foreign_keys = ON');
	}

	console.log('[wizard-migration] Complete');
}

// ── Schema migration: add status + form_data to report_sections ──

function migrateReportSectionsColumns(db: Database.Database): void {
	const cols = db.prepare("PRAGMA table_info(report_sections)").all() as Array<{ name: string }>;
	const hasStatus = cols.some(c => c.name === 'status');
	if (hasStatus) return;

	console.log('[sections-migration] Adding status + form_data columns to report_sections...');
	db.exec(`ALTER TABLE report_sections ADD COLUMN status TEXT DEFAULT 'empty'`);
	db.exec(`ALTER TABLE report_sections ADD COLUMN form_data TEXT`);

	// Backfill: any section with content is 'in_progress'
	db.exec(`UPDATE report_sections SET status = 'in_progress' WHERE content_html IS NOT NULL AND content_html != ''`);
	console.log('[sections-migration] Complete');
}

// ── Schema migration: add source column to section_images ──

function migrateSectionImagesSource(db: Database.Database): void {
	const cols = db.prepare("PRAGMA table_info(section_images)").all() as Array<{ name: string }>;
	const hasSource = cols.some(c => c.name === 'source');
	if (hasSource) return;

	console.log('[images-migration] Adding source column to section_images...');
	db.exec(`ALTER TABLE section_images ADD COLUMN source TEXT DEFAULT 'manual'`);
	console.log('[images-migration] Complete');
}

export function getDb(): Database.Database {
	if (_db) return _db;

	mkdirSync(DATA_DIR, { recursive: true });
	const dbPath = join(DATA_DIR, 'cre-copilot.db');

	_db = new Database(dbPath);
	_db.pragma('journal_mode = WAL');
	_db.pragma('foreign_keys = ON');

	// Load sqlite-vec extension
	sqliteVec.load(_db);

	// Run schema — may partially fail on old DBs where chunks lacks content_hash
	const schema = readFileSync(SCHEMA_PATH, 'utf-8');
	try {
		_db.exec(schema);
	} catch {
		// Expected on old DBs before migration — will re-run after
	}

	// Create vec_chunks virtual table if not exists
	_db.exec(`
		CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
			embedding float[768]
		);
	`);

	// Migrate old chunks schema to deduplicated schema if needed
	migrateChunksDedup(_db);

	// Migrate to wizard schema (new columns on properties + reports)
	migrateWizardSchema(_db);

	// Migrate report_sections (status + form_data columns)
	migrateReportSectionsColumns(_db);

	// Migrate section_images (source column)
	migrateSectionImagesSource(_db);

	// Re-run schema to ensure all indexes exist (idempotent after migration)
	_db.exec(schema);

	return _db;
}

// ── Document helpers ──

export function insertDocument(filename: string, pageCount?: number) {
	const db = getDb();
	const stmt = db.prepare(`
		INSERT INTO documents (filename, page_count)
		VALUES (?, ?)
	`);
	return stmt.run(filename, pageCount ?? null);
}

export function updateDocumentStatus(id: number, status: string, errorMessage?: string) {
	const db = getDb();
	const stmt = db.prepare(`
		UPDATE documents SET status = ?, error_message = ?
		WHERE id = ?
	`);
	return stmt.run(status, errorMessage ?? null, id);
}

export function getDocument(id: number) {
	const db = getDb();
	return db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
}

export function listDocuments() {
	const db = getDb();
	return db.prepare('SELECT * FROM documents ORDER BY upload_date DESC').all();
}

// ── Chunk helpers ──

export function insertOrDeduplicateChunk(chunk: {
	document_id: number;
	chunk_type: string;
	section_label?: string;
	page_start?: number;
	page_end?: number;
	content: string;
	confidence?: number;
}): { chunkId: number; isDuplicate: boolean; needsEmbedding: boolean } {
	const db = getDb();
	const hash = contentHash(chunk.content);
	const conf = chunk.confidence ?? 1.0;

	const existing = db.prepare('SELECT id, confidence FROM chunks WHERE content_hash = ?').get(hash) as
		| { id: number; confidence: number }
		| undefined;

	if (existing) {
		// Duplicate — link document to existing canonical chunk
		db.prepare(
			'INSERT OR IGNORE INTO document_chunks (document_id, chunk_id, page_start, page_end) VALUES (?, ?, ?, ?)'
		).run(chunk.document_id, existing.id, chunk.page_start ?? null, chunk.page_end ?? null);

		// Keep highest confidence
		if (conf > existing.confidence) {
			db.prepare('UPDATE chunks SET confidence = ? WHERE id = ?').run(conf, existing.id);
		}

		return { chunkId: existing.id, isDuplicate: true, needsEmbedding: false };
	}

	// New canonical chunk
	const result = db.prepare(
		'INSERT INTO chunks (content_hash, chunk_type, section_label, content, confidence) VALUES (?, ?, ?, ?, ?)'
	).run(hash, chunk.chunk_type, chunk.section_label ?? null, chunk.content, conf);

	const chunkId = Number(result.lastInsertRowid);

	// Link document to chunk
	db.prepare(
		'INSERT INTO document_chunks (document_id, chunk_id, page_start, page_end) VALUES (?, ?, ?, ?)'
	).run(chunk.document_id, chunkId, chunk.page_start ?? null, chunk.page_end ?? null);

	return { chunkId, isDuplicate: false, needsEmbedding: true };
}

export function insertChunkEmbedding(chunkId: number | bigint, embedding: Float32Array) {
	const db = getDb();
	const stmt = db.prepare(`
		INSERT INTO vec_chunks (rowid, embedding)
		VALUES (?, ?)
	`);
	return stmt.run(BigInt(chunkId), Buffer.from(embedding.buffer));
}

export function searchSimilarChunks(embedding: Float32Array, limit = 10) {
	const db = getDb();
	const stmt = db.prepare(`
		SELECT c.*, vec_chunks.distance,
			(SELECT GROUP_CONCAT(dc.document_id) FROM document_chunks dc WHERE dc.chunk_id = c.id) as document_ids
		FROM vec_chunks
		JOIN chunks c ON c.id = vec_chunks.rowid
		WHERE embedding MATCH ? AND k = ?
		ORDER BY distance
	`);
	return stmt.all(Buffer.from(embedding.buffer), limit);
}

// ── Property helpers ──

export function normalizeAddress(address: string): string {
	if (!address) return '';
	return address
		.toLowerCase()
		.replace(/\bstreet\b/g, 'st')
		.replace(/\bavenue\b/g, 'ave')
		.replace(/\bdrive\b/g, 'dr')
		.replace(/\bboulevard\b/g, 'blvd')
		.replace(/\broad\b/g, 'rd')
		.replace(/\blane\b/g, 'ln')
		.replace(/\bcourt\b/g, 'ct')
		.replace(/\bnorth\b/g, 'n')
		.replace(/\bsouth\b/g, 's')
		.replace(/\beast\b/g, 'e')
		.replace(/\bwest\b/g, 'w')
		.replace(/[.,#]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export function findOrCreateProperty(property: {
	address: string;
	city?: string;
	state?: string;
	zip?: string;
	apn?: string;
	property_type?: string;
	year_built?: number;
	building_sf?: number;
	land_sf?: number;
	land_acres?: number;
	stories?: number;
	construction_class?: string;
	quality?: string;
	condition?: string;
	zoning?: string;
	latitude?: number;
	longitude?: number;
	county?: string;
	owner_name?: string;
	acquisition_date?: string;
	occupancy?: string;
	market_value?: number;
	county_data_json?: string;
}): number {
	const db = getDb();
	const normalized = normalizeAddress(property.address);

	// Try APN dedup first
	let existingId: number | undefined;
	if (property.apn) {
		const existing = db.prepare('SELECT id FROM properties WHERE apn = ?').get(property.apn) as
			| { id: number }
			| undefined;
		if (existing) existingId = existing.id;
	}

	// Try normalized address dedup
	if (!existingId) {
		const existingByAddr = db
			.prepare('SELECT id FROM properties WHERE address_normalized = ? AND city = ?')
			.get(normalized, property.city ?? null) as { id: number } | undefined;
		if (existingByAddr) existingId = existingByAddr.id;
	}

	// Upsert: update existing property with wizard-submitted values
	if (existingId) {
		db.prepare(`
			UPDATE properties SET
				address = @address, address_normalized = @address_normalized,
				city = @city, state = @state, zip = @zip, apn = @apn,
				property_type = @property_type, year_built = @year_built,
				building_sf = @building_sf, land_sf = @land_sf, land_acres = @land_acres,
				stories = @stories, construction_class = @construction_class,
				quality = @quality, condition = @condition, zoning = @zoning,
				market_value = @market_value, county_data_json = @county_data_json,
				county = @county, owner_name = @owner_name,
				acquisition_date = @acquisition_date, occupancy = @occupancy,
				updated_at = CURRENT_TIMESTAMP
			WHERE id = @id
		`).run({
			id: existingId,
			address: property.address,
			address_normalized: normalized,
			city: property.city ?? null,
			state: property.state ?? 'UT',
			zip: property.zip ?? null,
			apn: property.apn ?? null,
			property_type: property.property_type ?? null,
			year_built: property.year_built ?? null,
			building_sf: property.building_sf ?? null,
			land_sf: property.land_sf ?? null,
			land_acres: property.land_acres ?? null,
			stories: property.stories ?? null,
			construction_class: property.construction_class ?? null,
			quality: property.quality ?? null,
			condition: property.condition ?? null,
			zoning: property.zoning ?? null,
			market_value: property.market_value ?? null,
			county_data_json: property.county_data_json ?? null,
			county: property.county ?? null,
			owner_name: property.owner_name ?? null,
			acquisition_date: property.acquisition_date ?? null,
			occupancy: property.occupancy ?? null
		});
		return existingId;
	}

	// Insert new property
	const stmt = db.prepare(`
		INSERT INTO properties (
			address, address_normalized, city, state, zip, apn,
			property_type, year_built, building_sf, land_sf, land_acres,
			stories, construction_class, quality, condition, zoning,
			market_value, county_data_json, latitude, longitude, county, owner_name, acquisition_date, occupancy
		) VALUES (
			@address, @address_normalized, @city, @state, @zip, @apn,
			@property_type, @year_built, @building_sf, @land_sf, @land_acres,
			@stories, @construction_class, @quality, @condition, @zoning,
			@market_value, @county_data_json, @latitude, @longitude, @county, @owner_name, @acquisition_date, @occupancy
		)
	`);

	const result = stmt.run({
		address: property.address,
		address_normalized: normalized,
		city: property.city ?? null,
		state: property.state ?? 'UT',
		zip: property.zip ?? null,
		apn: property.apn ?? null,
		property_type: property.property_type ?? null,
		year_built: property.year_built ?? null,
		building_sf: property.building_sf ?? null,
		land_sf: property.land_sf ?? null,
		land_acres: property.land_acres ?? null,
		stories: property.stories ?? null,
		construction_class: property.construction_class ?? null,
		quality: property.quality ?? null,
		condition: property.condition ?? null,
		zoning: property.zoning ?? null,
		market_value: property.market_value ?? null,
		county_data_json: property.county_data_json ?? null,
		latitude: property.latitude ?? null,
		longitude: property.longitude ?? null,
		county: property.county ?? null,
		owner_name: property.owner_name ?? null,
		acquisition_date: property.acquisition_date ?? null,
		occupancy: property.occupancy ?? null
	});

	return Number(result.lastInsertRowid);
}

export function linkDocumentProperty(
	documentId: number,
	propertyId: number,
	role: string,
	sourcePage?: number,
	confidence?: number
) {
	const db = getDb();
	const stmt = db.prepare(`
		INSERT OR IGNORE INTO document_properties (document_id, property_id, role, source_page, confidence)
		VALUES (?, ?, ?, ?, ?)
	`);
	return stmt.run(documentId, propertyId, role, sourcePage ?? null, confidence ?? 1.0);
}

export function searchProperties(filters: {
	city?: string;
	property_type?: string;
	min_sf?: number;
	max_sf?: number;
	min_year?: number;
	max_year?: number;
	query?: string;
	exclude_subject_of_report_id?: number;
}) {
	const db = getDb();
	const conditions: string[] = [];
	const params: unknown[] = [];

	if (filters.city) {
		conditions.push('p.city = ?');
		params.push(filters.city);
	}
	if (filters.property_type) {
		conditions.push('p.property_type = ?');
		params.push(filters.property_type);
	}
	if (filters.min_sf) {
		conditions.push('p.building_sf >= ?');
		params.push(filters.min_sf);
	}
	if (filters.max_sf) {
		conditions.push('p.building_sf <= ?');
		params.push(filters.max_sf);
	}
	if (filters.min_year) {
		conditions.push('p.year_built >= ?');
		params.push(filters.min_year);
	}
	if (filters.max_year) {
		conditions.push('p.year_built <= ?');
		params.push(filters.max_year);
	}
	if (filters.query) {
		conditions.push('(p.address LIKE ? OR p.city LIKE ?)');
		params.push(`%${filters.query}%`, `%${filters.query}%`);
	}
	if (filters.exclude_subject_of_report_id) {
		conditions.push(`p.id NOT IN (
			SELECT subject_property_id FROM reports WHERE id = ?
		)`);
		params.push(filters.exclude_subject_of_report_id);
	}

	const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

	return db
		.prepare(
			`
		SELECT p.*,
			(SELECT json_group_array(json_object('id', s.id, 'sale_date', s.sale_date, 'sale_price', s.sale_price, 'price_per_sf', s.price_per_sf, 'cap_rate', s.cap_rate))
			 FROM sales s WHERE s.property_id = p.id) as sales_json,
			(SELECT json_group_array(json_object('id', l.id, 'tenant_name', l.tenant_name, 'rent_per_sf', l.rent_per_sf, 'lease_type', l.lease_type))
			 FROM leases l WHERE l.property_id = p.id) as leases_json
		FROM properties p
		${where}
		ORDER BY p.updated_at DESC
		LIMIT 100
	`
		)
		.all(...params);
}

// ── Sales helpers ──

export function insertSale(sale: {
	property_id: number;
	sale_date?: string;
	sale_price?: number;
	price_per_sf?: number;
	cap_rate?: number;
	grantor?: string;
	grantee?: string;
	financing?: string;
	verification_source?: string;
	source_document_id?: number;
	source_page?: number;
	confidence?: number;
	mls_sourced?: boolean;
}) {
	const db = getDb();
	const stmt = db.prepare(`
		INSERT INTO sales (
			property_id, sale_date, sale_price, price_per_sf, cap_rate,
			grantor, grantee, financing, verification_source,
			source_document_id, source_page, confidence, mls_sourced
		) VALUES (
			@property_id, @sale_date, @sale_price, @price_per_sf, @cap_rate,
			@grantor, @grantee, @financing, @verification_source,
			@source_document_id, @source_page, @confidence, @mls_sourced
		)
	`);
	return stmt.run({
		property_id: sale.property_id,
		sale_date: sale.sale_date ?? null,
		sale_price: sale.sale_price ?? null,
		price_per_sf: sale.price_per_sf ?? null,
		cap_rate: sale.cap_rate ?? null,
		grantor: sale.grantor ?? null,
		grantee: sale.grantee ?? null,
		financing: sale.financing ?? null,
		verification_source: sale.verification_source ?? null,
		source_document_id: sale.source_document_id ?? null,
		source_page: sale.source_page ?? null,
		confidence: sale.confidence ?? 1.0,
		mls_sourced: sale.mls_sourced ? 1 : 0
	});
}

// ── Lease helpers ──

export function insertLease(lease: {
	property_id: number;
	tenant_name?: string;
	lease_sf?: number;
	rent_per_sf?: number;
	lease_type?: string;
	commencement_date?: string;
	term_years?: number;
	escalations?: string;
	office_pct?: number;
	source_document_id?: number;
	source_page?: number;
	confidence?: number;
	mls_sourced?: boolean;
}) {
	const db = getDb();
	const stmt = db.prepare(`
		INSERT INTO leases (
			property_id, tenant_name, lease_sf, rent_per_sf, lease_type,
			commencement_date, term_years, escalations, office_pct,
			source_document_id, source_page, confidence, mls_sourced
		) VALUES (
			@property_id, @tenant_name, @lease_sf, @rent_per_sf, @lease_type,
			@commencement_date, @term_years, @escalations, @office_pct,
			@source_document_id, @source_page, @confidence, @mls_sourced
		)
	`);
	return stmt.run({
		property_id: lease.property_id,
		tenant_name: lease.tenant_name ?? null,
		lease_sf: lease.lease_sf ?? null,
		rent_per_sf: lease.rent_per_sf ?? null,
		lease_type: lease.lease_type ?? null,
		commencement_date: lease.commencement_date ?? null,
		term_years: lease.term_years ?? null,
		escalations: lease.escalations ?? null,
		office_pct: lease.office_pct ?? null,
		source_document_id: lease.source_document_id ?? null,
		source_page: lease.source_page ?? null,
		confidence: lease.confidence ?? 1.0,
		mls_sourced: lease.mls_sourced ? 1 : 0
	});
}

// ── Report helpers ──

export function createReport(report: {
	report_number?: string;
	subject_property_id: number;
	approach: string;
	effective_date?: string;
	client_name?: string;
	intended_use?: string;
	property_rights?: string;
}) {
	const db = getDb();
	const stmt = db.prepare(`
		INSERT INTO reports (report_number, subject_property_id, approach, effective_date, client_name, intended_use, property_rights)
		VALUES (@report_number, @subject_property_id, @approach, @effective_date, @client_name, @intended_use, @property_rights)
	`);
	return stmt.run({
		report_number: report.report_number ?? null,
		subject_property_id: report.subject_property_id,
		approach: report.approach,
		effective_date: report.effective_date ?? null,
		client_name: report.client_name ?? null,
		intended_use: report.intended_use ?? 'estimate market value',
		property_rights: report.property_rights ?? 'fee simple'
	});
}

export function getReport(id: number) {
	const db = getDb();
	return db
		.prepare(
			`
		SELECT r.*, p.address as subject_address, p.city as subject_city,
			p.property_type as subject_property_type, p.building_sf as subject_building_sf,
			p.year_built as subject_year_built
		FROM reports r
		JOIN properties p ON p.id = r.subject_property_id
		WHERE r.id = ?
	`
		)
		.get(id);
}

export function listReports() {
	const db = getDb();
	return db
		.prepare(
			`
		SELECT r.*, p.address as subject_address, p.city as subject_city
		FROM reports r
		JOIN properties p ON p.id = r.subject_property_id
		ORDER BY r.updated_at DESC
	`
		)
		.all();
}

export function saveSection(
	reportId: number,
	sectionKey: string,
	contentJson: string,
	contentHtml: string,
	status?: string,
	formData?: string
) {
	const db = getDb();
	const stmt = db.prepare(`
		INSERT INTO report_sections (report_id, section_key, content_json, content_html, status, form_data, last_saved)
		VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(report_id, section_key) DO UPDATE SET
			content_json = excluded.content_json,
			content_html = excluded.content_html,
			status = COALESCE(excluded.status, report_sections.status),
			form_data = COALESCE(excluded.form_data, report_sections.form_data),
			last_saved = CURRENT_TIMESTAMP
	`);
	return stmt.run(reportId, sectionKey, contentJson, contentHtml, status ?? null, formData ?? null);
}

export function saveSectionAutoContent(
	reportId: number,
	sectionKey: string,
	contentHtml: string
) {
	const db = getDb();
	// Guard: skip if section already has non-empty status (don't overwrite edits)
	const existing = db.prepare(
		`SELECT status FROM report_sections WHERE report_id = ? AND section_key = ?`
	).get(reportId, sectionKey) as { status: string } | undefined;

	if (existing && existing.status !== 'empty' && existing.status !== 'auto_generated') {
		return; // Don't overwrite user edits
	}

	const stmt = db.prepare(`
		INSERT INTO report_sections (report_id, section_key, content_json, content_html, status, last_saved)
		VALUES (?, ?, NULL, ?, 'auto_generated', CURRENT_TIMESTAMP)
		ON CONFLICT(report_id, section_key) DO UPDATE SET
			content_html = excluded.content_html,
			status = 'auto_generated',
			last_saved = CURRENT_TIMESTAMP
	`);
	return stmt.run(reportId, sectionKey, contentHtml);
}

export function updateSectionStatus(reportId: number, sectionKey: string, status: string) {
	const db = getDb();
	db.prepare(
		`UPDATE report_sections SET status = ?, last_saved = CURRENT_TIMESTAMP WHERE report_id = ? AND section_key = ?`
	).run(status, reportId, sectionKey);
}

export function getSections(reportId: number) {
	const db = getDb();
	return db.prepare('SELECT * FROM report_sections WHERE report_id = ? ORDER BY id').all(reportId);
}

export function getSection(reportId: number, sectionKey: string) {
	const db = getDb();
	return db
		.prepare('SELECT * FROM report_sections WHERE report_id = ? AND section_key = ?')
		.get(reportId, sectionKey);
}

// ── Report comp helpers ──

export function addReportComp(comp: {
	report_id: number;
	comp_type: string;
	property_id: number;
	sale_id?: number;
	lease_id?: number;
	rank?: number;
	adjustment_json?: string;
	analysis_text?: string;
}) {
	const db = getDb();
	const stmt = db.prepare(`
		INSERT INTO report_comps (report_id, comp_type, property_id, sale_id, lease_id, rank, adjustment_json, analysis_text)
		VALUES (@report_id, @comp_type, @property_id, @sale_id, @lease_id, @rank, @adjustment_json, @analysis_text)
	`);
	return stmt.run({
		report_id: comp.report_id,
		comp_type: comp.comp_type,
		property_id: comp.property_id,
		sale_id: comp.sale_id ?? null,
		lease_id: comp.lease_id ?? null,
		rank: comp.rank ?? null,
		adjustment_json: comp.adjustment_json ?? null,
		analysis_text: comp.analysis_text ?? null
	});
}

export function getReportComps(reportId: number) {
	const db = getDb();
	return db
		.prepare(
			`
		SELECT rc.*, p.address, p.city, p.building_sf, p.year_built, p.property_type,
			p.latitude, p.longitude, p.apn, p.county,
			s.sale_date, s.sale_price, s.price_per_sf, s.cap_rate as sale_cap_rate,
			l.tenant_name, l.rent_per_sf, l.lease_type, l.mls_sourced as lease_mls_sourced,
			s.mls_sourced as sale_mls_sourced
		FROM report_comps rc
		JOIN properties p ON p.id = rc.property_id
		LEFT JOIN sales s ON s.id = rc.sale_id
		LEFT JOIN leases l ON l.id = rc.lease_id
		WHERE rc.report_id = ?
		ORDER BY rc.rank
	`
		)
		.all(reportId);
}

// ── Shared property context (used by templates + copilot) ──

export interface PropertyContext {
	// Report fields
	report_id: number;
	report_number: string | null;
	approach: string;
	effective_date: string | null;
	client_name: string | null;
	intended_use: string | null;
	property_rights: string | null;
	report_date: string;
	report_status: string;
	// Property fields
	property_id: number;
	address: string;
	city: string | null;
	state: string;
	zip: string | null;
	apn: string | null;
	county: string | null;
	property_type: string | null;
	year_built: number | null;
	building_sf: number | null;
	land_sf: number | null;
	land_acres: number | null;
	stories: number | null;
	construction_class: string | null;
	quality: string | null;
	condition: string | null;
	zoning: string | null;
	market_value: number | null;
	county_data_json: string | null;
	owner_name: string | null;
	acquisition_date: string | null;
	occupancy: string | null;
	latitude: number | null;
	longitude: number | null;
	// Derived calcs
	building_to_land_ratio: number | null;
	effective_age: number | null;
	land_sf_from_acres: number | null;
}

export function getPropertyContext(reportId: number): PropertyContext | null {
	const db = getDb();
	const row = db.prepare(`
		SELECT
			r.id as report_id, r.report_number, r.approach, r.effective_date,
			r.client_name, r.intended_use, r.property_rights, r.status as report_status,
			r.created_at as report_date,
			p.id as property_id, p.address, p.city, p.state, p.zip, p.apn,
			p.county, p.property_type, p.year_built, p.building_sf, p.land_sf,
			p.land_acres, p.stories, p.construction_class, p.quality, p.condition,
			p.zoning, p.market_value, p.county_data_json, p.owner_name,
			p.acquisition_date, p.occupancy, p.latitude, p.longitude
		FROM reports r
		JOIN properties p ON p.id = r.subject_property_id
		WHERE r.id = ?
	`).get(reportId) as Record<string, unknown> | undefined;

	if (!row) return null;

	const buildingSf = row.building_sf as number | null;
	const landSf = row.land_sf as number | null;
	const landAcres = row.land_acres as number | null;
	const yearBuilt = row.year_built as number | null;
	const effectiveDate = row.effective_date as string | null;

	// Derived calculations
	const landSfFromAcres = landAcres && !landSf ? landAcres * 43560 : null;
	const effectiveLandSf = landSf ?? landSfFromAcres;
	const buildingToLandRatio = buildingSf && effectiveLandSf
		? Math.round((buildingSf / effectiveLandSf) * 100) / 100
		: null;
	const currentYear = effectiveDate ? new Date(effectiveDate).getFullYear() : new Date().getFullYear();
	const effectiveAge = yearBuilt ? currentYear - yearBuilt : null;

	return {
		...(row as unknown as PropertyContext),
		building_to_land_ratio: buildingToLandRatio,
		effective_age: effectiveAge,
		land_sf_from_acres: landSfFromAcres
	};
}

// ── Appraiser settings helpers ──

export function getAppraiserSetting(key: string): string | null {
	const db = getDb();
	const row = db.prepare('SELECT value FROM appraiser_settings WHERE key = ?').get(key) as { value: string } | undefined;
	return row?.value ?? null;
}

export function getAllAppraiserSettings(): Record<string, string> {
	const db = getDb();
	const rows = db.prepare('SELECT key, value FROM appraiser_settings').all() as Array<{ key: string; value: string }>;
	return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export function setAppraiserSetting(key: string, value: string): void {
	const db = getDb();
	db.prepare(
		`INSERT INTO appraiser_settings (key, value) VALUES (?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`
	).run(key, value);
}

export function setAppraiserSettings(settings: Record<string, string>): void {
	const db = getDb();
	const stmt = db.prepare(
		`INSERT INTO appraiser_settings (key, value) VALUES (?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`
	);
	const batch = db.transaction(() => {
		for (const [key, value] of Object.entries(settings)) {
			stmt.run(key, value);
		}
	});
	batch();
}

// ── Market data helpers ──

export function getMarketData(marketArea: string, dataType?: string) {
	const db = getDb();
	if (dataType) {
		return db.prepare(
			'SELECT * FROM market_data WHERE market_area = ? AND data_type = ? ORDER BY year DESC'
		).all(marketArea, dataType);
	}
	return db.prepare(
		'SELECT * FROM market_data WHERE market_area = ? ORDER BY data_type, year DESC'
	).all(marketArea);
}

export function upsertMarketData(data: {
	market_area: string;
	data_type: string;
	data_json: string;
	year?: number;
	source?: string;
}) {
	const db = getDb();
	return db.prepare(`
		INSERT INTO market_data (market_area, data_type, data_json, year, source, updated_at)
		VALUES (@market_area, @data_type, @data_json, @year, @source, CURRENT_TIMESTAMP)
	`).run({
		market_area: data.market_area,
		data_type: data.data_type,
		data_json: data.data_json,
		year: data.year ?? null,
		source: data.source ?? null
	});
}

// ── Section image helpers ──

export interface SectionImage {
	id: number;
	report_id: number;
	section_key: string;
	file_path: string;
	caption: string | null;
	sort_order: number;
	source: string;
	created_at: string;
}

export function getSectionImages(reportId: number, sectionKey: string): SectionImage[] {
	const db = getDb();
	return db.prepare(
		'SELECT * FROM section_images WHERE report_id = ? AND section_key = ? ORDER BY sort_order, id'
	).all(reportId, sectionKey) as SectionImage[];
}

export function getAllReportImages(reportId: number): SectionImage[] {
	const db = getDb();
	return db.prepare(
		'SELECT * FROM section_images WHERE report_id = ? ORDER BY section_key, sort_order, id'
	).all(reportId) as SectionImage[];
}

export function addSectionImage(
	reportId: number,
	sectionKey: string,
	filePath: string,
	caption: string | null,
	sortOrder: number,
	source: 'manual' | 'auto' = 'manual'
): number {
	const db = getDb();
	const result = db.prepare(
		`INSERT INTO section_images (report_id, section_key, file_path, caption, sort_order, source)
		 VALUES (?, ?, ?, ?, ?, ?)`
	).run(reportId, sectionKey, filePath, caption, sortOrder, source);
	return Number(result.lastInsertRowid);
}

export function updateImageCaption(imageId: number, caption: string): void {
	const db = getDb();
	db.prepare('UPDATE section_images SET caption = ? WHERE id = ?').run(caption, imageId);
}

export function updateImageOrder(imageId: number, sortOrder: number): void {
	const db = getDb();
	db.prepare('UPDATE section_images SET sort_order = ? WHERE id = ?').run(sortOrder, imageId);
}

export function deleteImage(imageId: number): string | null {
	const db = getDb();
	const row = db.prepare('SELECT file_path FROM section_images WHERE id = ?').get(imageId) as { file_path: string } | undefined;
	if (!row) return null;
	db.prepare('DELETE FROM section_images WHERE id = ?').run(imageId);
	return row.file_path;
}
