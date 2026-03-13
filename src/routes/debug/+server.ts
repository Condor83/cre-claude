import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/db/index.js';

export const GET: RequestHandler = async ({ url }) => {
	const db = getDb();
	const action = url.searchParams.get('action') ?? 'summary';

	if (action === 'summary') {
		const chunkCount = (db.prepare('SELECT COUNT(*) as n FROM chunks').get() as { n: number }).n;
		const vecCount = (db.prepare('SELECT COUNT(*) as n FROM vec_chunks').get() as { n: number }).n;
		const propCount = (db.prepare('SELECT COUNT(*) as n FROM properties').get() as { n: number }).n;
		const saleCount = (db.prepare('SELECT COUNT(*) as n FROM sales').get() as { n: number }).n;
		const leaseCount = (db.prepare('SELECT COUNT(*) as n FROM leases').get() as { n: number }).n;
		const linkCount = (db.prepare('SELECT COUNT(*) as n FROM document_chunks').get() as { n: number }).n;

		const dedupRatio = linkCount > 0 ? 1 - (chunkCount / linkCount) : 0;

		const types = db.prepare('SELECT chunk_type, COUNT(*) as n FROM chunks GROUP BY chunk_type').all();

		const sectionLabels = db.prepare(
			'SELECT section_label, chunk_type, COUNT(*) as n FROM chunks GROUP BY section_label, chunk_type ORDER BY n DESC'
		).all();

		const samples = db.prepare(`
			SELECT c.id, c.chunk_type, c.section_label, c.confidence,
				length(c.content) as content_len
			FROM chunks c
			ORDER BY c.id
			LIMIT 30
		`).all();

		return json({
			canonical_chunks: chunkCount,
			document_chunk_links: linkCount,
			dedup_ratio: Math.round(dedupRatio * 1000) / 1000,
			vecCount, propCount, saleCount, leaseCount,
			types, sectionLabels, samples
		});
	}

	if (action === 'pages') {
		// Test PDF page extraction
		const { readFileSync } = await import('fs');
		const { extractPagesFromPdf } = await import('$lib/ingest/chunker.js');
		const pdfPath = url.searchParams.get('path');
		if (!pdfPath) return json({ error: 'path required' }, { status: 400 });

		const buffer = readFileSync(pdfPath);
		const { pages, pageCount } = await extractPagesFromPdf(buffer);

		const pageSummary = pages.map(p => ({
			page: p.page,
			chars: p.text.length,
			preview: p.text.slice(0, 100)
		}));

		return json({
			pageCount,
			pagesExtracted: pages.length,
			nonEmptyPages: pages.filter(p => p.text.length > 0).length,
			pageSummary: pageSummary.slice(0, 30)
		});
	}

	if (action === 'test-embed') {
		// Test embedding a single chunk to see exact error
		const { embedForStorage } = await import('$lib/embed/gemini.js');
		const { insertChunkEmbedding } = await import('$lib/db/index.js');

		const testText = 'Commercial retail building located at 55 East 100 North, Payson, Utah';
		try {
			const embedding = await embedForStorage(testText);
			const dims = embedding.length;
			const isZero = embedding.every((v) => v === 0);
			const sample = Array.from(embedding.slice(0, 5));

			// Try inserting into vec_chunks with a fake rowid (999999) to test
			let insertOk = false;
			let insertError = '';
			try {
				// Use chunk id 1 if it exists, otherwise report
				const firstChunk = db.prepare('SELECT id FROM chunks LIMIT 1').get() as { id: number } | undefined;
				if (firstChunk) {
					// Check if already embedded
					const existing = db.prepare('SELECT rowid FROM vec_chunks WHERE rowid = ?').get(firstChunk.id);
					if (existing) {
						insertOk = true;
						insertError = `chunk ${firstChunk.id} already has embedding`;
					} else {
						insertChunkEmbedding(firstChunk.id, embedding);
						insertOk = true;
					}
				} else {
					insertError = 'no chunks in database';
				}
			} catch (err) {
				insertError = String(err);
			}

			const vecCount = (db.prepare('SELECT COUNT(*) as n FROM vec_chunks').get() as { n: number }).n;

			return json({ dims, isZero, sample, insertOk, insertError, vecCount });
		} catch (err) {
			return json({ error: String(err), stack: (err as Error).stack }, { status: 500 });
		}
	}

	if (action === 'embed-all') {
		// Embed all chunks that don't have embeddings yet
		const { embedAndStoreChunks } = await import('$lib/embed/gemini.js');

		const chunks = db.prepare(`
			SELECT c.id, c.content FROM chunks c
			WHERE c.id NOT IN (SELECT rowid FROM vec_chunks)
		`).all() as Array<{ id: number; content: string }>;

		if (chunks.length === 0) {
			const vecCount = (db.prepare('SELECT COUNT(*) as n FROM vec_chunks').get() as { n: number }).n;
			return json({ message: 'All chunks already embedded', vecCount });
		}

		try {
			const result = await embedAndStoreChunks(chunks);
			const vecCount = (db.prepare('SELECT COUNT(*) as n FROM vec_chunks').get() as { n: number }).n;
			return json({ ...result, vecCount, chunksToEmbed: chunks.length });
		} catch (err) {
			return json({ error: String(err), stack: (err as Error).stack }, { status: 500 });
		}
	}

	if (action === 'similarity') {
		const query = url.searchParams.get('q') ?? 'retail building Payson';
		const limit = Number(url.searchParams.get('limit') ?? 5);

		try {
			const { embedForQuery } = await import('$lib/embed/gemini.js');
			const queryEmb = await embedForQuery(query);

			const results = db.prepare(`
				SELECT c.id, c.chunk_type, c.section_label, c.confidence,
					substr(c.content, 1, 200) as content_preview,
					vec_chunks.distance,
					(SELECT GROUP_CONCAT(dc.document_id) FROM document_chunks dc WHERE dc.chunk_id = c.id) as document_ids
				FROM vec_chunks
				JOIN chunks c ON c.id = vec_chunks.rowid
				WHERE embedding MATCH ? AND k = ?
				ORDER BY distance
			`).all(Buffer.from(queryEmb.buffer), limit);

			return json({ query, results });
		} catch (err) {
			return json({ error: String(err), stack: (err as Error).stack, query }, { status: 500 });
		}
	}

	if (action === 'reingest') {
		const docId = Number(url.searchParams.get('doc'));
		if (!docId) return json({ error: 'doc param required (document id)' }, { status: 400 });

		const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId) as
			| { id: number; filename: string; page_count: number }
			| undefined;
		if (!doc) return json({ error: `Document ${docId} not found` }, { status: 404 });

		try {
			const { readFileSync } = await import('fs');
			const { join } = await import('path');
			const { extractPagesFromPdf, classifyChunks } = await import('$lib/ingest/chunker.js');
			const { extractEntities, persistExtractionResults } = await import('$lib/ingest/extractor.js');
			const { embedAndStoreChunks } = await import('$lib/embed/gemini.js');
			const { insertOrDeduplicateChunk, updateDocumentStatus } = await import('$lib/db/index.js');

			// Step 1: Unlink this document's chunks (shared-chunk safe, atomic)
			let orphansRemoved = 0;
			let unlinkedCount = 0;
			const cleanup = db.transaction(() => {
				const linkedChunkIds = db.prepare(
					'SELECT chunk_id FROM document_chunks WHERE document_id = ?'
				).all(docId) as Array<{ chunk_id: number }>;
				unlinkedCount = linkedChunkIds.length;

				db.prepare('DELETE FROM document_chunks WHERE document_id = ?').run(docId);

				// Orphan cleanup: delete chunks (and vec_chunks) with no remaining links
				for (const { chunk_id } of linkedChunkIds) {
					const stillLinked = db.prepare(
						'SELECT 1 FROM document_chunks WHERE chunk_id = ?'
					).get(chunk_id);
					if (!stillLinked) {
						db.prepare('DELETE FROM vec_chunks WHERE rowid = ?').run(chunk_id);
						db.prepare('DELETE FROM chunks WHERE id = ?').run(chunk_id);
						orphansRemoved++;
					}
				}

				db.prepare('DELETE FROM sales WHERE source_document_id = ?').run(docId);
				db.prepare('DELETE FROM leases WHERE source_document_id = ?').run(docId);
				db.prepare('DELETE FROM document_properties WHERE document_id = ?').run(docId);
				db.prepare('UPDATE documents SET status = ?, report_number = NULL, report_date = NULL WHERE id = ?').run('processing', docId);
			});
			cleanup();

			// Step 2: Find and read PDF
			const pdfDir = join(process.cwd(), 'docs', 'appraisal-reports');
			const pdfPath = join(pdfDir, doc.filename);
			const buffer = readFileSync(pdfPath);
			const { pages, pageCount } = await extractPagesFromPdf(buffer);
			db.prepare('UPDATE documents SET page_count = ? WHERE id = ?').run(pageCount, docId);

			// Step 3: Classify chunks with updated prompt
			const classifiedChunks = await classifyChunks(pages);

			// Step 4: Store chunks (with deduplication)
			const chunksToEmbed: Array<{ id: number; content: string }> = [];
			let dupCount = 0;
			for (const chunk of classifiedChunks) {
				const { chunkId, isDuplicate, needsEmbedding } = insertOrDeduplicateChunk({
					document_id: docId,
					chunk_type: chunk.chunk_type,
					section_label: chunk.section_label,
					page_start: chunk.page_start,
					page_end: chunk.page_end,
					content: chunk.content,
					confidence: chunk.confidence
				});
				if (needsEmbedding) {
					chunksToEmbed.push({ id: chunkId, content: chunk.content });
				}
				if (isDuplicate) dupCount++;
			}

			// Step 5: Extract entities (with cover_page/transmittal now included)
			const entities = await extractEntities(classifiedChunks);
			if (entities.report_number || entities.report_date) {
				db.prepare('UPDATE documents SET report_number = ?, report_date = ? WHERE id = ?').run(
					entities.report_number ?? null,
					entities.report_date ?? null,
					docId
				);
			}
			persistExtractionResults(docId, entities);

			// Step 6: Embed new canonical chunks
			let embedResult = null;
			if (chunksToEmbed.length > 0) {
				try {
					embedResult = await embedAndStoreChunks(chunksToEmbed);
				} catch (err) {
					console.warn(`Embedding failed for doc ${docId}:`, err);
					embedResult = { error: String(err) };
				}
			}

			updateDocumentStatus(docId, 'ready');

			// Gather section_label distribution for this doc via junction
			const newLabels = db.prepare(`
				SELECT c.section_label, c.chunk_type, COUNT(*) as n
				FROM document_chunks dc
				JOIN chunks c ON c.id = dc.chunk_id
				WHERE dc.document_id = ?
				GROUP BY c.section_label, c.chunk_type
				ORDER BY n DESC
			`).all(docId);

			return json({
				document: docId,
				filename: doc.filename,
				unlinkedChunks: unlinkedCount,
				orphansRemoved,
				newChunks: chunksToEmbed.length,
				duplicatesSkipped: dupCount,
				totalClassified: classifiedChunks.length,
				pageCount,
				report_number: entities.report_number,
				report_date: entities.report_date,
				sale_comps: entities.sale_comps.length,
				lease_comps: entities.lease_comps.length,
				embedResult,
				sectionLabels: newLabels
			});
		} catch (err) {
			db.prepare('UPDATE documents SET status = ?, error_message = ? WHERE id = ?').run('error', String(err), docId);
			return json({ error: String(err), stack: (err as Error).stack }, { status: 500 });
		}
	}

	if (action === 'dedup-near') {
		// Near-duplicate detection: find chunk pairs with similar embeddings
		const threshold = Number(url.searchParams.get('threshold') ?? 0.30);

		try {
			const chunks = db.prepare(`
				SELECT c.id, c.chunk_type, c.section_label, substr(c.content, 1, 200) as content_preview
				FROM chunks c
				WHERE c.id IN (SELECT rowid FROM vec_chunks)
			`).all() as Array<{ id: number; chunk_type: string; section_label: string; content_preview: string }>;

			const candidates: Array<{
				chunk_a: number;
				chunk_b: number;
				section_label: string;
				chunk_type: string;
				distance: number;
				preview_a: string;
				preview_b: string;
			}> = [];

			const seen = new Set<string>();

			for (const chunk of chunks) {
				// Get this chunk's embedding
				const vecRow = db.prepare('SELECT embedding FROM vec_chunks WHERE rowid = ?').get(chunk.id) as { embedding: Buffer } | undefined;
				if (!vecRow) continue;

				// Find nearest neighbors (k=3 to get non-self matches)
				const neighbors = db.prepare(`
					SELECT vec_chunks.rowid as id, vec_chunks.distance
					FROM vec_chunks
					WHERE embedding MATCH ? AND k = 3
					ORDER BY distance
				`).all(vecRow.embedding, 3) as Array<{ id: number; distance: number }>;

				for (const neighbor of neighbors) {
					if (neighbor.id === chunk.id) continue;
					if (neighbor.distance >= threshold) continue;

					// Deduplicate pairs
					const pairKey = [Math.min(chunk.id, neighbor.id), Math.max(chunk.id, neighbor.id)].join('-');
					if (seen.has(pairKey)) continue;
					seen.add(pairKey);

					// Get neighbor details
					const neighborChunk = db.prepare(
						'SELECT chunk_type, section_label, substr(content, 1, 200) as content_preview FROM chunks WHERE id = ?'
					).get(neighbor.id) as { chunk_type: string; section_label: string; content_preview: string } | undefined;
					if (!neighborChunk) continue;

					// Filter: same chunk_type AND same section_label
					if (neighborChunk.chunk_type !== chunk.chunk_type) continue;
					if (neighborChunk.section_label !== chunk.section_label) continue;

					candidates.push({
						chunk_a: chunk.id,
						chunk_b: neighbor.id,
						section_label: chunk.section_label,
						chunk_type: chunk.chunk_type,
						distance: Math.round(neighbor.distance * 10000) / 10000,
						preview_a: chunk.content_preview,
						preview_b: neighborChunk.content_preview
					});
				}
			}

			candidates.sort((a, b) => a.distance - b.distance);

			return json({
				threshold,
				candidates_found: candidates.length,
				candidates: candidates.slice(0, 50)
			});
		} catch (err) {
			return json({ error: String(err), stack: (err as Error).stack }, { status: 500 });
		}
	}

	return json({ error: 'Unknown action' }, { status: 400 });
};
