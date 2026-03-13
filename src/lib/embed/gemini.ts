import { GoogleGenerativeAI } from '@google/generative-ai';
import { insertChunkEmbedding } from '$lib/db/index.js';

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
	if (!genAI) {
		const apiKey = process.env.GEMINI_API_KEY;
		if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is required');
		genAI = new GoogleGenerativeAI(apiKey);
	}
	return genAI;
}

export async function embedText(text: string): Promise<Float32Array> {
	const client = getClient();
	const model = client.getGenerativeModel({ model: 'text-embedding-004' });

	const result = await model.embedContent(text);
	const values = result.embedding.values;

	if (!values || values.length === 0) {
		throw new Error('Gemini returned empty embedding');
	}

	return new Float32Array(values);
}

export async function embedAndStoreChunks(
	chunks: Array<{ id: number; content: string }>
): Promise<{ embedded: number; skipped: number }> {
	let embedded = 0;
	let skipped = 0;

	for (const chunk of chunks) {
		try {
			const embedding = await embedText(chunk.content);

			// Check for zero vector
			const isZero = embedding.every((v) => v === 0);
			if (isZero) {
				console.warn(`Zero vector returned for chunk ${chunk.id}, skipping`);
				skipped++;
				continue;
			}

			insertChunkEmbedding(chunk.id, embedding);
			embedded++;
		} catch (error) {
			console.error(`Failed to embed chunk ${chunk.id}:`, error);
			skipped++;
		}
	}

	return { embedded, skipped };
}

export async function searchByText(
	queryText: string,
	limit = 10
): Promise<Float32Array> {
	return embedText(queryText);
}
