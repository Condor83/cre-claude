import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { GEMINI_API_KEY } from '$env/static/private';
import { insertChunkEmbedding } from '$lib/db/index.js';

const MODEL = 'gemini-embedding-2-preview';
const OUTPUT_DIMS = 768; // MRL truncation: 67.99 MTEB vs 68.16 at 3072, saves 4x storage

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
	if (!genAI) {
		genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
	}
	return genAI;
}

function normalize(values: number[]): Float32Array {
	// Sub-3072 dims from MRL need L2 normalization for accurate cosine similarity
	let norm = 0;
	for (const v of values) norm += v * v;
	norm = Math.sqrt(norm);
	const out = new Float32Array(values.length);
	if (norm > 0) {
		for (let i = 0; i < values.length; i++) out[i] = values[i] / norm;
	}
	return out;
}

export async function embedText(text: string, taskType: TaskType = TaskType.RETRIEVAL_QUERY): Promise<Float32Array> {
	const client = getClient();
	const model = client.getGenerativeModel({ model: MODEL });

	// outputDimensionality is supported by the API but not yet in the SDK types
	const result = await model.embedContent({
		content: { parts: [{ text }], role: 'user' },
		taskType,
		outputDimensionality: OUTPUT_DIMS
	} as Parameters<typeof model.embedContent>[0]);
	const values = result.embedding.values;

	if (!values || values.length === 0) {
		throw new Error('Gemini returned empty embedding');
	}

	return normalize(values);
}

export async function embedForStorage(text: string): Promise<Float32Array> {
	return embedText(text, TaskType.RETRIEVAL_DOCUMENT);
}

export async function embedForQuery(text: string): Promise<Float32Array> {
	return embedText(text, TaskType.RETRIEVAL_QUERY);
}

export async function embedAndStoreChunks(
	chunks: Array<{ id: number; content: string }>
): Promise<{ embedded: number; skipped: number }> {
	let embedded = 0;
	let skipped = 0;

	for (const chunk of chunks) {
		try {
			// Truncate to ~6000 chars (~2000 tokens) to stay well within 8192 token limit
			const text = chunk.content.length > 6000 ? chunk.content.slice(0, 6000) : chunk.content;
			const embedding = await embedForStorage(text);

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
