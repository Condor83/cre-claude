// Market data cache orchestrator
// Checks freshness → fetches if stale → validates → upserts to DB

import { getMarketDataFreshness, upsertMarketData } from '$lib/db/index.js';
import { fetchLatestPopulation, fetchEmploymentData } from './data/census-bls.js';
import type { PopulationData, EmploymentData } from './data/census-bls.js';

const FRESHNESS_DAYS = 30;

export async function refreshMarketData(
	marketArea: string,
	dataType: 'dws_population' | 'dws_employment',
	force?: boolean
): Promise<{ data: unknown; fresh: boolean }> {
	// Check existing freshness
	if (!force) {
		const existing = getMarketDataFreshness(marketArea, dataType);
		if (existing.fresh && existing.data) {
			return { data: existing.data, fresh: true };
		}
	}

	// Fetch fresh data
	let data: PopulationData | EmploymentData | null = null;

	if (dataType === 'dws_population') {
		data = await fetchLatestPopulation(marketArea);
	} else if (dataType === 'dws_employment') {
		data = await fetchEmploymentData(marketArea);
	}

	if (!data) {
		// Fetch failed — return stale data if available
		const stale = getMarketDataFreshness(marketArea, dataType);
		if (stale.data) {
			console.log(`[market-data] Fetch failed for ${dataType}, returning stale data (${Math.round(stale.ageInDays)}d old)`);
			return { data: stale.data, fresh: false };
		}
		console.log(`[market-data] Fetch failed for ${dataType} and no cached data`);
		return { data: null, fresh: false };
	}

	// Validate: population must have county totals, employment must have industries
	if (dataType === 'dws_population') {
		const pop = data as PopulationData;
		if (!pop.county_total?.latest) {
			console.log('[market-data] Population data missing county total — discarding');
			return { data: null, fresh: false };
		}
	} else {
		const emp = data as EmploymentData;
		if (!emp.industries?.length) {
			console.log('[market-data] Employment data has no industries — discarding');
			return { data: null, fresh: false };
		}
	}

	// Persist to DB
	upsertMarketData({
		market_area: marketArea,
		data_type: dataType,
		data_json: JSON.stringify(data),
		year: new Date().getFullYear(),
		source: 'census_bls',
	});

	console.log(`[market-data] Cached ${dataType} for ${marketArea}`);
	return { data, fresh: true };
}

export async function refreshAllDwsData(
	marketArea: string
): Promise<{ population: boolean; employment: boolean }> {
	const [popResult, empResult] = await Promise.all([
		refreshMarketData(marketArea, 'dws_population').catch(err => {
			console.error('[market-data] Population refresh failed:', err);
			return { data: null, fresh: false };
		}),
		refreshMarketData(marketArea, 'dws_employment').catch(err => {
			console.error('[market-data] Employment refresh failed:', err);
			return { data: null, fresh: false };
		}),
	]);

	return {
		population: popResult.data != null,
		employment: empResult.data != null,
	};
}
