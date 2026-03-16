// Ranks existing DB properties by similarity to subject for comp auto-suggest.
// Scoring: property_type match (40pts), price_per_sf proximity to target (30pts),
// size similarity within 50% (20pts), same county (10pts).

import { getDb } from '$lib/db/index.js';

export interface CompSuggestion {
	property_id: number;
	address: string;
	city: string;
	county: string | null;
	property_type: string | null;
	building_sf: number | null;
	year_built: number | null;
	sale_price: number | null;
	price_per_sf: number | null;
	sale_date: string | null;
	cap_rate: number | null;
	score: number;
	score_breakdown: {
		type_match: number;
		price_proximity: number;
		size_similarity: number;
		county_match: number;
	};
}

interface SuggestParams {
	property_type: string;
	building_sf: number;
	target_price_psf: number;
	county: string;
	exclude_property_id?: number;
	exclude_apn?: string;
	limit?: number;
}

export function suggestComps(params: SuggestParams): CompSuggestion[] {
	const { property_type, building_sf, target_price_psf, county, exclude_property_id, exclude_apn, limit = 10 } = params;
	const db = getDb();

	// Build exclusion clauses
	const excludeClauses: string[] = [];
	const excludeParams: unknown[] = [];
	if (exclude_property_id) {
		excludeClauses.push('AND p.id != ?');
		excludeParams.push(exclude_property_id);
	}
	if (exclude_apn) {
		excludeClauses.push('AND (p.apn IS NULL OR p.apn != ?)');
		excludeParams.push(exclude_apn);
	}

	// Fetch candidate properties with their most recent sale
	const candidates = db.prepare(`
		SELECT p.id as property_id, p.address, p.city, p.county, p.property_type,
			p.building_sf, p.year_built,
			s.sale_price, s.price_per_sf, s.sale_date, s.cap_rate
		FROM properties p
		LEFT JOIN sales s ON s.property_id = p.id
			AND s.id = (SELECT id FROM sales WHERE property_id = p.id ORDER BY sale_date DESC LIMIT 1)
		WHERE p.building_sf IS NOT NULL
			AND p.building_sf > 0
			${excludeClauses.join(' ')}
		ORDER BY p.updated_at DESC
		LIMIT 200
	`).all(...excludeParams) as Array<Record<string, unknown>>;

	const scored: CompSuggestion[] = candidates.map(c => {
		const cType = c.property_type as string | null;
		const cSf = c.building_sf as number | null;
		const cPsf = c.price_per_sf as number | null;
		const cCounty = c.county as string | null;

		// Property type match: 40 points if exact match, 0 otherwise
		const type_match = (cType && cType.toLowerCase() === property_type.toLowerCase()) ? 40 : 0;

		// Price per SF proximity: 30 points max, scaled by distance from target
		let price_proximity = 0;
		if (cPsf && target_price_psf > 0) {
			const pctDiff = Math.abs(cPsf - target_price_psf) / target_price_psf;
			if (pctDiff <= 0.10) price_proximity = 30;
			else if (pctDiff <= 0.25) price_proximity = 20;
			else if (pctDiff <= 0.50) price_proximity = 10;
		}

		// Size similarity: 20 points max
		let size_similarity = 0;
		if (cSf && building_sf > 0) {
			const ratio = cSf / building_sf;
			if (ratio >= 0.5 && ratio <= 1.5) size_similarity = 20;
			else if (ratio >= 0.33 && ratio <= 2.0) size_similarity = 10;
		}

		// County match: 10 points
		const county_match = (cCounty && cCounty === county) ? 10 : 0;

		const score = type_match + price_proximity + size_similarity + county_match;

		return {
			property_id: c.property_id as number,
			address: c.address as string,
			city: c.city as string,
			county: cCounty,
			property_type: cType,
			building_sf: cSf,
			year_built: c.year_built as number | null,
			sale_price: c.sale_price as number | null,
			price_per_sf: cPsf,
			sale_date: c.sale_date as string | null,
			cap_rate: c.cap_rate as number | null,
			score,
			score_breakdown: { type_match, price_proximity, size_similarity, county_match }
		};
	});

	// Sort by score descending, then by price_proximity descending for tiebreakers
	scored.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		return (b.score_breakdown.price_proximity - a.score_breakdown.price_proximity);
	});

	// Filter: must have at least 30 points
	const filtered = scored.filter(s => s.score >= 30);

	return filtered.slice(0, limit);
}
