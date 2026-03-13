import Anthropic from '@anthropic-ai/sdk';
import pdf from 'pdf-parse';
import { ANTHROPIC_API_KEY } from '$env/static/private';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

export interface ClassifiedChunk {
	chunk_type: 'clause' | 'exemplar' | 'evidence' | 'table';
	section_label: string;
	page_start: number;
	page_end: number;
	content: string;
	confidence: number;
}

interface PageText {
	page: number;
	text: string;
}

export async function extractPagesFromPdf(buffer: Buffer): Promise<{ pages: PageText[]; pageCount: number }> {
	const data = await pdf(buffer);
	// pdf-parse gives us full text; we split by form feeds or estimate pages
	// For a better implementation, use pdf.js with per-page rendering
	const fullText = data.text;
	const pageTexts = fullText.split(/\f/); // Form feed is common page separator

	const pages: PageText[] = pageTexts.map((text, i) => ({
		page: i + 1,
		text: text.trim()
	}));

	return { pages, pageCount: data.numpages };
}

export async function classifyChunks(pages: PageText[]): Promise<ClassifiedChunk[]> {
	const allChunks: ClassifiedChunk[] = [];
	const batchSize = 10;

	for (let i = 0; i < pages.length; i += batchSize) {
		const batch = pages.slice(i, i + batchSize);
		const batchText = batch
			.map((p) => `--- PAGE ${p.page} ---\n${p.text}`)
			.join('\n\n');

		const response = await anthropic.messages.create({
			model: 'claude-sonnet-4-20250514',
			max_tokens: 4096,
			messages: [
				{
					role: 'user',
					content: `You are analyzing a commercial real estate appraisal report. Classify the content on these pages into chunks.

Each chunk must have:
- chunk_type: one of "clause" (reusable narrative patterns, definitions, boilerplate language), "exemplar" (examples of how sections are structured, full section samples), "evidence" (facts: property details, sale prices, lease terms, market data), or "table" (structured data: adjustment grids, rent rolls, sales summaries)
- section_label: the report section this belongs to (e.g., "transmittal", "certification", "assumptions", "scope_of_work", "neighborhood", "site_description", "improvement_description", "highest_best_use", "sales_comparison", "income_approach", "reconciliation", "comp_sale_data", "comp_lease_data", "adjustment_grid", "operating_statement", "subject_lease_table", "appraiser_qualifications")
- page_start: first page number
- page_end: last page number
- content: the text content of this chunk
- confidence: 0.0-1.0 how confident you are in the classification

IMPORTANT: Do NOT classify old value conclusions or judgments as "evidence". Those are "exemplar" or "clause" type.

Return JSON array of chunks. No markdown wrapping.

${batchText}`
				}
			]
		});

		const text = response.content[0].type === 'text' ? response.content[0].text : '';
		try {
			const parsed = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
			const chunks: ClassifiedChunk[] = Array.isArray(parsed) ? parsed : [];
			allChunks.push(...chunks);
		} catch {
			console.error(`Failed to parse chunk classification for pages ${batch[0].page}-${batch[batch.length - 1].page}`);
			// Fall back: treat entire batch as a single evidence chunk with low confidence
			allChunks.push({
				chunk_type: 'evidence',
				section_label: 'unknown',
				page_start: batch[0].page,
				page_end: batch[batch.length - 1].page,
				content: batch.map((p) => p.text).join('\n'),
				confidence: 0.3
			});
		}
	}

	return allChunks;
}
