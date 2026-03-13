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

		const types = db.prepare('SELECT chunk_type, COUNT(*) as n FROM chunks GROUP BY chunk_type').all();

		const samples = db.prepare(`
			SELECT c.id, c.chunk_type, c.section_label, c.confidence,
				length(c.content) as content_len, c.page_start, c.page_end
			FROM chunks c
			ORDER BY c.id
			LIMIT 30
		`).all();

		return json({ chunkCount, vecCount, propCount, saleCount, leaseCount, types, samples });
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
					vec_chunks.distance
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

	return json({ error: 'Unknown action' }, { status: 400 });
};
