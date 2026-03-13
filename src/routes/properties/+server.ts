import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchProperties, searchSimilarChunks } from '$lib/db/index.js';
import { embedForQuery } from '$lib/embed/gemini.js';

export const GET: RequestHandler = async ({ url }) => {
	const filters = {
		city: url.searchParams.get('city') ?? undefined,
		property_type: url.searchParams.get('type') ?? undefined,
		min_sf: url.searchParams.has('min_sf') ? Number(url.searchParams.get('min_sf')) : undefined,
		max_sf: url.searchParams.has('max_sf') ? Number(url.searchParams.get('max_sf')) : undefined,
		min_year: url.searchParams.has('min_year') ? Number(url.searchParams.get('min_year')) : undefined,
		max_year: url.searchParams.has('max_year') ? Number(url.searchParams.get('max_year')) : undefined,
		query: url.searchParams.get('q') ?? undefined,
		exclude_subject_of_report_id: url.searchParams.has('exclude_report')
			? Number(url.searchParams.get('exclude_report'))
			: undefined
	};

	const properties = searchProperties(filters);

	// If there's a semantic query, also do vector search and merge
	let vectorResults: number[] = [];
	const semanticQuery = url.searchParams.get('semantic');
	if (semanticQuery) {
		try {
			const embedding = await embedForQuery(semanticQuery);
			const similar = searchSimilarChunks(embedding, 20) as Array<{ document_id: number }>;
			vectorResults = [...new Set(similar.map((s) => s.document_id))];
		} catch {
			// Vector search not available, continue with structured only
		}
	}

	return json({ properties, vectorResults });
};
