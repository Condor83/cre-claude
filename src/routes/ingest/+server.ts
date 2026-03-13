import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { insertDocument, updateDocumentStatus, insertOrDeduplicateChunk, getDb } from '$lib/db/index.js';
import { extractPagesFromPdf, classifyChunks } from '$lib/ingest/chunker.js';
import { extractEntities, persistExtractionResults } from '$lib/ingest/extractor.js';
import { embedAndStoreChunks } from '$lib/embed/gemini.js';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const file = formData.get('file') as File | null;

	if (!file) {
		return json({ error: 'No file provided' }, { status: 400 });
	}

	if (file.size > MAX_FILE_SIZE) {
		return json({ error: 'File exceeds 50MB limit' }, { status: 400 });
	}

	if (!file.name.toLowerCase().endsWith('.pdf')) {
		return json({ error: 'Only PDF files are accepted' }, { status: 400 });
	}

	// Insert document record
	const docResult = insertDocument(file.name);
	const documentId = Number(docResult.lastInsertRowid);

	// Start async processing
	processDocument(documentId, file).catch((err) => {
		console.error(`Document ${documentId} processing failed:`, err);
		updateDocumentStatus(documentId, 'error', String(err));
	});

	return json({ id: documentId, status: 'processing' });
};

export const GET: RequestHandler = async () => {
	const db = getDb();
	const documents = db.prepare('SELECT * FROM documents ORDER BY upload_date DESC').all();
	return json(documents);
};

async function processDocument(documentId: number, file: File) {
	updateDocumentStatus(documentId, 'processing');

	try {
		// Step 1: Extract pages from PDF
		const buffer = Buffer.from(await file.arrayBuffer());
		const { pages, pageCount } = await extractPagesFromPdf(buffer);

		const db = getDb();
		db.prepare('UPDATE documents SET page_count = ? WHERE id = ?').run(pageCount, documentId);

		// Step 2: Classify chunks (Claude Pass 1)
		const classifiedChunks = await classifyChunks(pages);

		// Step 3: Store chunks in DB (with deduplication)
		const chunksToEmbed: Array<{ id: number; content: string }> = [];
		let dupCount = 0;
		for (const chunk of classifiedChunks) {
			const { chunkId, isDuplicate, needsEmbedding } = insertOrDeduplicateChunk({
				document_id: documentId,
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
		console.log(`Document ${documentId}: ${classifiedChunks.length} chunks classified, ${dupCount} exact duplicates skipped, ${chunksToEmbed.length} new canonical chunks`);

		// Step 4: Extract entities (Claude Pass 2)
		const entities = await extractEntities(classifiedChunks);

		// Update document with report metadata
		if (entities.report_number || entities.report_date) {
			db.prepare('UPDATE documents SET report_number = ?, report_date = ? WHERE id = ?').run(
				entities.report_number ?? null,
				entities.report_date ?? null,
				documentId
			);
		}

		// Step 5: Persist extracted entities
		persistExtractionResults(documentId, entities);

		// Step 6: Embed new canonical chunks (duplicates already have embeddings)
		if (chunksToEmbed.length > 0) {
			try {
				await embedAndStoreChunks(chunksToEmbed);
			} catch (err) {
				console.warn(`Embedding failed for document ${documentId}, continuing without vectors:`, err);
			}
		}

		updateDocumentStatus(documentId, 'ready');
	} catch (err) {
		updateDocumentStatus(documentId, 'error', String(err));
		throw err;
	}
}
