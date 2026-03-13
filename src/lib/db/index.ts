import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Project root — works both in dev (process.cwd) and built mode
const PROJECT_ROOT = process.env.CRE_DATA_DIR || process.cwd();
const DATA_DIR = join(PROJECT_ROOT, 'data');
const SCHEMA_PATH = join(PROJECT_ROOT, 'src', 'lib', 'db', 'schema.sql');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
	if (_db) return _db;

	mkdirSync(DATA_DIR, { recursive: true });
	const dbPath = join(DATA_DIR, 'cre-copilot.db');

	_db = new Database(dbPath);
	_db.pragma('journal_mode = WAL');
	_db.pragma('foreign_keys = ON');

	// Load sqlite-vec extension
	sqliteVec.load(_db);

	// Run schema migrations
	const schema = readFileSync(SCHEMA_PATH, 'utf-8');
	_db.exec(schema);

	// Create vec_chunks virtual table if not exists
	_db.exec(`
		CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
			embedding float[768]
		);
	`);

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

export function insertChunk(chunk: {
	document_id: number;
	chunk_type: string;
	section_label?: string;
	page_start?: number;
	page_end?: number;
	content: string;
	confidence?: number;
}) {
	const db = getDb();
	const stmt = db.prepare(`
		INSERT INTO chunks (document_id, chunk_type, section_label, page_start, page_end, content, confidence)
		VALUES (@document_id, @chunk_type, @section_label, @page_start, @page_end, @content, @confidence)
	`);
	return stmt.run({
		...chunk,
		section_label: chunk.section_label ?? null,
		page_start: chunk.page_start ?? null,
		page_end: chunk.page_end ?? null,
		confidence: chunk.confidence ?? 1.0
	});
}

export function insertChunkEmbedding(chunkId: number, embedding: Float32Array) {
	const db = getDb();
	const stmt = db.prepare(`
		INSERT INTO vec_chunks (rowid, embedding)
		VALUES (?, ?)
	`);
	return stmt.run(chunkId, embedding);
}

export function searchSimilarChunks(embedding: Float32Array, limit = 10) {
	const db = getDb();
	const stmt = db.prepare(`
		SELECT c.*, vec_chunks.distance
		FROM vec_chunks
		JOIN chunks c ON c.id = vec_chunks.rowid
		WHERE embedding MATCH ?
		ORDER BY distance
		LIMIT ?
	`);
	return stmt.all(embedding, limit);
}

// ── Property helpers ──

export function normalizeAddress(address: string): string {
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
}): number {
	const db = getDb();
	const normalized = normalizeAddress(property.address);

	// Try APN dedup first
	if (property.apn) {
		const existing = db.prepare('SELECT id FROM properties WHERE apn = ?').get(property.apn) as
			| { id: number }
			| undefined;
		if (existing) return existing.id;
	}

	// Try normalized address dedup
	const existingByAddr = db
		.prepare('SELECT id FROM properties WHERE address_normalized = ? AND city = ?')
		.get(normalized, property.city ?? null) as { id: number } | undefined;
	if (existingByAddr) return existingByAddr.id;

	// Insert new property
	const stmt = db.prepare(`
		INSERT INTO properties (
			address, address_normalized, city, state, zip, apn,
			property_type, year_built, building_sf, land_sf, land_acres,
			stories, construction_class, quality, condition, zoning,
			latitude, longitude
		) VALUES (
			@address, @address_normalized, @city, @state, @zip, @apn,
			@property_type, @year_built, @building_sf, @land_sf, @land_acres,
			@stories, @construction_class, @quality, @condition, @zoning,
			@latitude, @longitude
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
		latitude: property.latitude ?? null,
		longitude: property.longitude ?? null
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
		mls_sourced: sale.mls_sourced ?? false
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
		mls_sourced: lease.mls_sourced ?? false
	});
}

// ── Report helpers ──

export function createReport(report: {
	report_number?: string;
	subject_property_id: number;
	approach: string;
	effective_date?: string;
}) {
	const db = getDb();
	const stmt = db.prepare(`
		INSERT INTO reports (report_number, subject_property_id, approach, effective_date)
		VALUES (@report_number, @subject_property_id, @approach, @effective_date)
	`);
	return stmt.run({
		report_number: report.report_number ?? null,
		subject_property_id: report.subject_property_id,
		approach: report.approach,
		effective_date: report.effective_date ?? null
	});
}

export function getReport(id: number) {
	const db = getDb();
	return db
		.prepare(
			`
		SELECT r.*, p.address as subject_address, p.city as subject_city
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

export function saveSection(reportId: number, sectionKey: string, contentJson: string, contentHtml: string) {
	const db = getDb();
	const stmt = db.prepare(`
		INSERT INTO report_sections (report_id, section_key, content_json, content_html, last_saved)
		VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(report_id, section_key) DO UPDATE SET
			content_json = excluded.content_json,
			content_html = excluded.content_html,
			last_saved = CURRENT_TIMESTAMP
	`);
	return stmt.run(reportId, sectionKey, contentJson, contentHtml);
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
