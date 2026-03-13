import Anthropic from '@anthropic-ai/sdk';
import { execFileSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
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

interface PageClassification {
	page: number;
	chunk_type: 'clause' | 'exemplar' | 'evidence' | 'table';
	section_label: string;
	confidence: number;
}

export async function extractPagesFromPdf(buffer: Buffer): Promise<{ pages: PageText[]; pageCount: number }> {
	// Write buffer to temp file for PyMuPDF
	const tmpPath = join(tmpdir(), `cre-pdf-${Date.now()}.pdf`);
	const scriptPath = join(process.cwd(), 'scripts', 'extract-pdf.py');

	try {
		writeFileSync(tmpPath, buffer);
		const output = execFileSync('python3', [scriptPath, tmpPath], {
			encoding: 'utf-8',
			maxBuffer: 50 * 1024 * 1024
		});
		const data = JSON.parse(output) as { pageCount: number; pages: Array<{ page: number; text: string }> };

		const pages: PageText[] = data.pages.filter((p) => p.text.trim().length > 20);
		return { pages, pageCount: data.pageCount };
	} finally {
		try { unlinkSync(tmpPath); } catch { /* ignore */ }
	}
}

export async function classifyChunks(pages: PageText[]): Promise<ClassifiedChunk[]> {
	const allClassifications: PageClassification[] = [];
	const batchSize = 10;

	for (let i = 0; i < pages.length; i += batchSize) {
		const batch = pages.slice(i, i + batchSize);
		// Send only first ~500 chars per page to keep token count low
		const batchSummary = batch
			.map((p) => `--- PAGE ${p.page} (${p.text.length} chars) ---\n${p.text.slice(0, 500)}${p.text.length > 500 ? '\n[... truncated]' : ''}`)
			.join('\n\n');

		try {
			const response = await anthropic.messages.create({
				model: 'claude-sonnet-4-20250514',
				max_tokens: 2048,
				messages: [
					{
						role: 'user',
						content: `Classify each page of this commercial real estate appraisal report.

For each page, return:
- page: the page number
- chunk_type: "clause" (boilerplate, definitions, reusable language), "exemplar" (section structure examples, narrative samples), "evidence" (facts: property details, sale prices, lease terms), or "table" (structured data: grids, summaries, rent rolls)
- section_label: one of: transmittal, certification, assumptions, scope_of_work, neighborhood, site_description, improvement_description, highest_best_use, sales_comparison, income_approach, reconciliation, comp_sale_data, comp_lease_data, adjustment_grid, operating_statement, subject_lease_table, appraiser_qualifications, photos, maps, cover_page, table_of_contents
- confidence: 0.0-1.0

Do NOT return the page content — only the classification.
Do NOT wrap in markdown. Return a raw JSON array.

Example response:
[{"page":1,"chunk_type":"clause","section_label":"cover_page","confidence":0.95},{"page":2,"chunk_type":"clause","section_label":"transmittal","confidence":0.9}]

${batchSummary}`
					}
				]
			});

			const text = response.content[0].type === 'text' ? response.content[0].text : '';
			const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
			const parsed = JSON.parse(cleaned);

			if (Array.isArray(parsed)) {
				for (const item of parsed) {
					if (item.page && item.chunk_type && item.section_label) {
						allClassifications.push({
							page: Number(item.page),
							chunk_type: item.chunk_type,
							section_label: item.section_label,
							confidence: Number(item.confidence) || 0.8
						});
					}
				}
			}
		} catch (err) {
			console.error(`Failed to classify pages ${batch[0].page}-${batch[batch.length - 1].page}:`, err instanceof Error ? err.message : err);
			// Fallback: classify each page individually as evidence
			for (const p of batch) {
				allClassifications.push({
					page: p.page,
					chunk_type: 'evidence',
					section_label: 'unknown',
					confidence: 0.3
				});
			}
		}
	}

	// Merge consecutive pages with the same section_label + chunk_type into chunks
	return mergeIntoChunks(allClassifications, pages);
}

function mergeIntoChunks(classifications: PageClassification[], pages: PageText[]): ClassifiedChunk[] {
	if (classifications.length === 0) return [];

	const pageMap = new Map(pages.map((p) => [p.page, p.text]));

	// Sort by page number
	classifications.sort((a, b) => a.page - b.page);

	const chunks: ClassifiedChunk[] = [];
	let current = classifications[0];
	let startPage = current.page;
	let contentParts: string[] = [pageMap.get(current.page) ?? ''];
	let minConfidence = current.confidence;

	for (let i = 1; i < classifications.length; i++) {
		const next = classifications[i];

		// Merge if same type+section and consecutive pages
		if (
			next.chunk_type === current.chunk_type &&
			next.section_label === current.section_label &&
			next.page === classifications[i - 1].page + 1
		) {
			contentParts.push(pageMap.get(next.page) ?? '');
			minConfidence = Math.min(minConfidence, next.confidence);
		} else {
			// Emit chunk
			chunks.push({
				chunk_type: current.chunk_type,
				section_label: current.section_label,
				page_start: startPage,
				page_end: classifications[i - 1].page,
				content: contentParts.join('\n\n'),
				confidence: minConfidence
			});

			// Start new chunk
			current = next;
			startPage = next.page;
			contentParts = [pageMap.get(next.page) ?? ''];
			minConfidence = next.confidence;
		}
	}

	// Emit final chunk
	chunks.push({
		chunk_type: current.chunk_type,
		section_label: current.section_label,
		page_start: startPage,
		page_end: classifications[classifications.length - 1].page,
		content: contentParts.join('\n\n'),
		confidence: minConfidence
	});

	return chunks;
}
