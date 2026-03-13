import { getDb, getSections, getReportComps, searchSimilarChunks } from '$lib/db/index.js';
import { embedForQuery } from '$lib/embed/gemini.js';

export interface CopilotContext {
	subject: Record<string, unknown>;
	comps: Record<string, unknown>[];
	exemplars: string[];
	clauses: string[];
	existingContent: Record<string, string>;
	sectionType: 'boilerplate' | 'comp' | 'narrative';
}

// Section types determine context shape
const SECTION_TYPES: Record<string, 'boilerplate' | 'comp' | 'narrative'> = {
	transmittal: 'boilerplate',
	certification: 'boilerplate',
	assumptions: 'boilerplate',
	scope_of_work: 'boilerplate',
	appraiser_qualifications: 'boilerplate',
	neighborhood: 'narrative',
	site_description: 'narrative',
	improvement_description: 'narrative',
	highest_best_use: 'narrative',
	sales_comparison: 'comp',
	income_approach: 'comp',
	reconciliation: 'narrative',
	comp_sale_data: 'comp',
	comp_lease_data: 'comp',
	adjustment_grid: 'comp',
	operating_statement: 'comp',
	subject_lease_table: 'comp'
};

export async function assembleContext(
	reportId: number,
	sectionKey: string
): Promise<CopilotContext> {
	const db = getDb();
	const sectionType = SECTION_TYPES[sectionKey] ?? 'narrative';

	// Get subject property
	const report = db
		.prepare(
			`
		SELECT r.*, p.*
		FROM reports r
		JOIN properties p ON p.id = r.subject_property_id
		WHERE r.id = ?
	`
		)
		.get(reportId) as Record<string, unknown>;

	// Get existing sections for context
	const sections = getSections(reportId) as Array<{
		section_key: string;
		content_html: string;
	}>;
	const existingContent: Record<string, string> = {};
	for (const s of sections) {
		if (s.content_html) {
			existingContent[s.section_key] = s.content_html;
		}
	}

	// Get comps if relevant
	let comps: Record<string, unknown>[] = [];
	if (sectionType === 'comp') {
		comps = getReportComps(reportId) as Record<string, unknown>[];
	}

	// Semantic search for relevant exemplars and clauses
	let exemplars: string[] = [];
	let clauses: string[] = [];

	try {
		const queryText = `${sectionKey} section commercial real estate appraisal`;
		const queryEmbedding = await embedForQuery(queryText);

		const similar = searchSimilarChunks(queryEmbedding, 10) as Array<{
			chunk_type: string;
			content: string;
			section_label: string;
		}>;

		exemplars = similar
			.filter((c) => c.chunk_type === 'exemplar' && c.section_label === sectionKey)
			.slice(0, 3)
			.map((c) => c.content);

		clauses = similar
			.filter((c) => c.chunk_type === 'clause')
			.slice(0, 5)
			.map((c) => c.content);
	} catch {
		// Vector search may not be available yet (no embeddings)
		// Fall back to direct SQL search
		const fallbackChunks = db
			.prepare(
				`
			SELECT content, chunk_type FROM chunks
			WHERE section_label = ? AND chunk_type IN ('exemplar', 'clause')
			ORDER BY confidence DESC
			LIMIT 8
		`
			)
			.all(sectionKey) as Array<{ content: string; chunk_type: string }>;

		exemplars = fallbackChunks.filter((c) => c.chunk_type === 'exemplar').map((c) => c.content);
		clauses = fallbackChunks.filter((c) => c.chunk_type === 'clause').map((c) => c.content);
	}

	return {
		subject: report,
		comps,
		exemplars,
		clauses,
		existingContent,
		sectionType
	};
}
