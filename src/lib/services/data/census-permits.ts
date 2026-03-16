// Census Building Permits Survey (BPS) — annual SFR permit data by county
// Downloads annual CSV from Census Bureau, parses Utah County rows
// Returns null on failure — callers keep stale cache

import { fetchWithTimeout } from '../fetch-utils.js';
import { COUNTY_CONFIGS, type CountyStaticConfig } from './utah-county-static.js';

// ── Types ──

export interface ConstructionData {
	sfr_permits: Array<{ year: number; permits: number; value: number | null }>;
	multifamily_permits: Array<{ year: number; units: number; value: number | null }>;
	commercial: Array<{ year: number; permits: number; value: number | null; type: string }>;
	county: string;
	source: string;
	fetched_at: string;
}

// ── Census BPS CSV parsing ──
// Format: Year,StateFIPS,CountyFIPS,Region,Division,CountyName,...
// Columns 7-9: 1-unit (buildings, units, value)
// Columns 10-12: 2-unit (buildings, units, value)
// Columns 13-15: 3-4 unit (buildings, units, value)
// Columns 16-18: 5+ unit (buildings, units, value)

function parseBpsCsvRow(line: string): {
	year: number; countyFips: string; stateFips: string;
	sfr_permits: number; sfr_value: number;
	mf_units: number; mf_value: number;
} | null {
	const cols = line.split(',').map(c => c.trim());
	if (cols.length < 18) return null;

	const year = parseInt(cols[0], 10);
	const stateFips = cols[1];
	const countyFips = cols[2];
	if (isNaN(year) || !stateFips || !countyFips) return null;

	const sfr_permits = parseInt(cols[7], 10) || 0;
	const sfr_value = parseInt(cols[8], 10) || 0;

	// Multi-family = 2-unit + 3-4 unit + 5+ unit
	const mf2_units = parseInt(cols[10], 10) || 0;
	const mf34_units = parseInt(cols[13], 10) || 0;
	const mf5_units = parseInt(cols[16], 10) || 0;
	const mf2_val = parseInt(cols[11], 10) || 0;
	const mf34_val = parseInt(cols[14], 10) || 0;
	const mf5_val = parseInt(cols[17], 10) || 0;

	return {
		year, countyFips, stateFips,
		sfr_permits, sfr_value,
		mf_units: mf2_units + mf34_units + mf5_units,
		mf_value: mf2_val + mf34_val + mf5_val,
	};
}

// ── Fetcher ──

async function fetchBpsYear(year: number, countyFips: string, stateFips: string): Promise<{
	sfr_permits: number; sfr_value: number; mf_units: number; mf_value: number;
} | null> {
	const url = `https://www2.census.gov/econ/bps/County/co${year}a.txt`;
	try {
		const res = await fetchWithTimeout(url, undefined, 15000);
		if (!res.ok) {
			console.log(`[census-permits] HTTP ${res.status} for ${year}`);
			return null;
		}
		const text = await res.text();
		const lines = text.split('\n');

		// Find row matching our county
		const shortCounty = countyFips.slice(2); // '49049' → '049'
		const shortState = countyFips.slice(0, 2); // '49049' → '49'

		for (const line of lines) {
			const parsed = parseBpsCsvRow(line);
			if (parsed && parsed.stateFips === shortState && parsed.countyFips === shortCounty) {
				return {
					sfr_permits: parsed.sfr_permits,
					sfr_value: parsed.sfr_value,
					mf_units: parsed.mf_units,
					mf_value: parsed.mf_value,
				};
			}
		}
		return null;
	} catch (err) {
		console.log(`[census-permits] Failed for ${year}:`, err);
		return null;
	}
}

// ── Public API ──

export async function fetchConstructionData(countyKey: string): Promise<ConstructionData | null> {
	const config = COUNTY_CONFIGS[countyKey];
	if (!config) return null;

	const currentYear = new Date().getFullYear();
	// BPS data lags ~5 months — latest available is usually currentYear - 1
	const years: number[] = [];
	for (let y = currentYear - 1; y >= currentYear - 8; y--) years.push(y);

	// Fetch all years in parallel
	const results = await Promise.all(
		years.map(y => fetchBpsYear(y, config.fips, config.stateFips).then(r => ({ year: y, data: r })))
	);

	const sfr_permits: ConstructionData['sfr_permits'] = [];
	const multifamily_permits: ConstructionData['multifamily_permits'] = [];

	for (const { year, data } of results) {
		if (data) {
			sfr_permits.push({ year, permits: data.sfr_permits, value: data.sfr_value || null });
			multifamily_permits.push({ year, units: data.mf_units, value: data.mf_value || null });
		}
	}

	// Sort by year ascending
	sfr_permits.sort((a, b) => a.year - b.year);
	multifamily_permits.sort((a, b) => a.year - b.year);

	if (sfr_permits.length === 0) {
		console.log('[census-permits] No BPS data found');
		return null;
	}

	// Commercial data from static config (no federal API)
	const commercial = config.commercial_permits ?? [];

	console.log(`[census-permits] ${sfr_permits.length} years of SFR data for ${config.name} County`);

	return {
		sfr_permits,
		multifamily_permits,
		commercial,
		county: config.name,
		source: 'U.S. Census Bureau, Building Permits Survey; Kem C. Gardner Policy Institute',
		fetched_at: new Date().toISOString(),
	};
}
