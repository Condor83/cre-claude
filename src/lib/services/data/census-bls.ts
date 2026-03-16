// Census Bureau + BLS API fetcher for population and employment data
// Returns null on failure — callers keep stale cache

import { fetchWithTimeout } from '../fetch-utils.js';
import { COUNTY_CONFIGS, STATE_TOTALS, type CountyStaticConfig } from './utah-county-static.js';

// ── Types ──

export interface PopulationData {
	municipalities: Array<{
		name: string;
		fips: string;
		census_2000: number | null;
		census_2010: number | null;
		latest: number | null;
		latest_year: number;
		avg_annual_pct: number | null;
	}>;
	county_total: { census_2000: number; census_2010: number; latest: number; latest_year: number; avg_annual_pct: number };
	state_total: { census_2000: number; census_2010: number; latest: number; latest_year: number; avg_annual_pct: number };
	source: string;
	fetched_at: string;
}

export interface EmploymentData {
	industries: Array<{
		name: string;
		naics: string;
		jobs_early: number | null; early_year: number;
		jobs_mid: number | null; mid_year: number;
		jobs_latest: number | null; latest_year: number;
		pct_of_total: number | null;
	}>;
	total: { early: number; mid: number; latest: number };
	unemployment: { county_rate: number; state_rate: number; as_of: string };
	per_capita_income: { county: number; year: number };
	major_employers: string[];
	source: string;
	fetched_at: string;
}

// ── Computation helpers ──

/** Compound Annual Growth Rate: ((later/earlier)^(1/years) - 1) * 100 */
export function computeAvgAnnualPct(earlier: number, later: number, yearSpan: number): number | null {
	if (!earlier || !later || yearSpan <= 0 || earlier <= 0) return null;
	return (Math.pow(later / earlier, 1 / yearSpan) - 1) * 100;
}

// ── NAICS sector groupings (BLS super-sectors matching Brad's tables) ──

const SECTOR_GROUPS: Array<{ label: string; naics: string[] }> = [
	{ label: 'Agriculture, Forestry, Fishing', naics: ['11'] },
	{ label: 'Mining', naics: ['21'] },
	{ label: 'Construction', naics: ['23'] },
	{ label: 'Manufacturing', naics: ['31-33'] },
	{ label: 'Trans., Warehousing & Utilities', naics: ['22', '48-49'] },
	{ label: 'Wholesale Trade', naics: ['42'] },
	{ label: 'Retail Trade', naics: ['44-45'] },
	{ label: 'Information', naics: ['51'] },
	{ label: 'Finance, Insurance & Real Estate', naics: ['52', '53'] },
	{ label: 'Professional & Business Services', naics: ['54', '55', '56'] },
	{ label: 'Education & Health Services', naics: ['61', '62'] },
	{ label: 'Leisure & Hospitality', naics: ['71', '72'] },
	{ label: 'Other Services', naics: ['81'] },
	{ label: 'Government', naics: ['92'] },
];

// ── CSV parsing for QCEW ──

function parseCsvLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;
	for (const char of line) {
		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === ',' && !inQuotes) {
			result.push(current.trim());
			current = '';
		} else {
			current += char;
		}
	}
	result.push(current.trim());
	return result;
}

function parseCsv(text: string): Array<Record<string, string>> {
	const lines = text.split('\n').filter(l => l.trim());
	if (lines.length < 2) return [];
	const headers = parseCsvLine(lines[0]);
	return lines.slice(1).map(line => {
		const values = parseCsvLine(line);
		const row: Record<string, string> = {};
		headers.forEach((h, i) => { row[h.trim()] = values[i]?.trim() ?? ''; });
		return row;
	});
}

// ── Census ACS API: latest population by place ──

async function fetchAcsPopulation(
	config: CountyStaticConfig
): Promise<{ places: Map<string, number>; county: number; state: number; year: number } | null> {
	const currentYear = new Date().getFullYear();
	// ACS 5-year data lags ~1.5 years — try recent vintages
	for (let vintage = currentYear - 2; vintage >= currentYear - 4; vintage--) {
		try {
			const [placesRes, countyRes, stateRes] = await Promise.all([
				fetchWithTimeout(
					`https://api.census.gov/data/${vintage}/acs/acs5?get=NAME,B01003_001E&for=place:*&in=state:${config.stateFips}`,
					undefined, 15000
				),
				fetchWithTimeout(
					`https://api.census.gov/data/${vintage}/acs/acs5?get=NAME,B01003_001E&for=county:${config.fips.slice(2)}&in=state:${config.stateFips}`,
					undefined, 15000
				),
				fetchWithTimeout(
					`https://api.census.gov/data/${vintage}/acs/acs5?get=NAME,B01003_001E&for=state:${config.stateFips}`,
					undefined, 15000
				),
			]);

			if (!placesRes.ok || !countyRes.ok || !stateRes.ok) continue;

			const placesJson = await placesRes.json() as string[][];
			const countyJson = await countyRes.json() as string[][];
			const stateJson = await stateRes.json() as string[][];

			const places = new Map<string, number>();
			// Skip header row [0], data starts at [1]
			for (let i = 1; i < placesJson.length; i++) {
				const row = placesJson[i];
				const placeFips = row[row.length - 1]; // last column is place FIPS
				const pop = parseInt(row[1], 10);
				if (placeFips && !isNaN(pop)) {
					places.set(placeFips, pop);
				}
			}

			const countyPop = parseInt(countyJson[1]?.[1], 10);
			const statePop = parseInt(stateJson[1]?.[1], 10);

			if (isNaN(countyPop) || isNaN(statePop)) continue;

			console.log(`[census-bls] ACS ${vintage}: ${places.size} places, county=${countyPop}, state=${statePop}`);
			return { places, county: countyPop, state: statePop, year: vintage };
		} catch (err) {
			console.log(`[census-bls] ACS ${vintage} failed:`, err);
			continue;
		}
	}
	return null;
}

// ── BLS QCEW CSV API: employment by industry ──

async function fetchQcewYear(countyFips: string, year: number): Promise<Map<string, number> | null> {
	try {
		const url = `https://data.bls.gov/cew/data/api/${year}/a/area/${countyFips}.csv`;
		const res = await fetchWithTimeout(url, undefined, 20000);
		if (!res.ok) return null;

		const text = await res.text();
		const rows = parseCsv(text);

		// Build map of industry_code → annual_avg_emplvl
		// Use own_code=0 (all ownerships), agglvl_code=74 or 72 (NAICS sector)
		const employment = new Map<string, number>();

		for (const row of rows) {
			const ownCode = row['own_code'];
			const agglvl = row['agglvl_code'];
			const industryCode = row['industry_code'];
			const emplvl = parseInt(row['annual_avg_emplvl'], 10);

			if (isNaN(emplvl)) continue;

			// Total (all ownerships, county level)
			if (ownCode === '0' && agglvl === '70') {
				employment.set('total', emplvl);
			}

			// By NAICS super-sector (all ownerships)
			if (ownCode === '0' && (agglvl === '71' || agglvl === '72')) {
				employment.set(industryCode, emplvl);
			}

			// Private by sector (fallback)
			if (ownCode === '5' && agglvl === '74') {
				if (!employment.has(industryCode)) {
					employment.set(industryCode, emplvl);
				}
			}

			// Government (federal + state + local)
			if ((ownCode === '1' || ownCode === '2' || ownCode === '3') && agglvl === '70') {
				const prev = employment.get('gov_' + ownCode) ?? 0;
				employment.set('gov_' + ownCode, prev + emplvl);
			}
		}

		// Compute government total if not in sector data
		if (!employment.has('92')) {
			const govTotal = (employment.get('gov_1') ?? 0) +
				(employment.get('gov_2') ?? 0) +
				(employment.get('gov_3') ?? 0);
			if (govTotal > 0) employment.set('92', govTotal);
		}

		console.log(`[census-bls] QCEW ${year}: ${employment.size} entries, total=${employment.get('total')}`);
		return employment;
	} catch (err) {
		console.log(`[census-bls] QCEW ${year} failed:`, err);
		return null;
	}
}

async function findLatestQcewYear(countyFips: string): Promise<number | null> {
	const currentYear = new Date().getFullYear();
	// QCEW annual data lags ~9 months
	for (let year = currentYear - 1; year >= currentYear - 3; year--) {
		const data = await fetchQcewYear(countyFips, year);
		if (data && data.has('total')) return year;
	}
	return null;
}

// ── BLS LAUS API: unemployment rates ──

async function fetchUnemployment(countyFips: string): Promise<{
	county_rate: number; state_rate: number; as_of: string;
} | null> {
	const countySeriesId = `LAUCN${countyFips}0000000003`;
	const stateSeriesId = `LASST${countyFips.slice(0, 2)}0000000000003`;
	const currentYear = new Date().getFullYear();

	try {
		const res = await fetchWithTimeout(
			'https://api.bls.gov/publicAPI/v2/timeseries/data/',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					seriesid: [countySeriesId, stateSeriesId],
					startyear: String(currentYear - 1),
					endyear: String(currentYear),
				}),
			},
			15000
		);

		if (!res.ok) return null;
		const json = await res.json() as {
			status: string;
			Results?: {
				series: Array<{
					seriesID: string;
					data: Array<{ year: string; period: string; periodName: string; value: string }>;
				}>;
			};
		};

		if (json.status !== 'REQUEST_SUCCEEDED' || !json.Results?.series) return null;

		let countyRate: number | null = null;
		let stateRate: number | null = null;
		let asOf = '';

		for (const series of json.Results.series) {
			// Get most recent annual average (M13) or most recent month
			const annualAvg = series.data.find(d => d.period === 'M13');
			const latestMonth = series.data[0]; // data is sorted most recent first
			const best = annualAvg ?? latestMonth;
			if (!best) continue;

			const rate = parseFloat(best.value);
			if (isNaN(rate)) continue;

			if (series.seriesID === countySeriesId) {
				countyRate = rate;
				asOf = `${best.periodName} ${best.year}`;
			} else {
				stateRate = rate;
			}
		}

		if (countyRate == null || stateRate == null) return null;
		console.log(`[census-bls] LAUS: county=${countyRate}%, state=${stateRate}% as of ${asOf}`);
		return { county_rate: countyRate, state_rate: stateRate, as_of: asOf };
	} catch (err) {
		console.log('[census-bls] LAUS failed:', err);
		return null;
	}
}

// ── Public API: fetch population data ──

export async function fetchLatestPopulation(countyKey: string): Promise<PopulationData | null> {
	const config = COUNTY_CONFIGS[countyKey];
	if (!config) {
		console.log(`[census-bls] No config for county: ${countyKey}`);
		return null;
	}

	const acs = await fetchAcsPopulation(config);
	if (!acs) return null;

	const latestYear = acs.year;
	const yearSpan = latestYear - 2010;

	const municipalities = config.municipalities.map(muni => {
		const latest = acs.places.get(muni.fips) ?? null;
		return {
			name: muni.name,
			fips: muni.fips,
			census_2000: muni.census_2000,
			census_2010: muni.census_2010,
			latest,
			latest_year: latestYear,
			avg_annual_pct: latest ? computeAvgAnnualPct(muni.census_2010, latest, yearSpan) : null,
		};
	});

	const countyLatest = acs.county;
	const stateLatest = acs.state;

	return {
		municipalities,
		county_total: {
			census_2000: config.county_total.census_2000,
			census_2010: config.county_total.census_2010,
			latest: countyLatest,
			latest_year: latestYear,
			avg_annual_pct: computeAvgAnnualPct(config.county_total.census_2010, countyLatest, yearSpan) ?? 0,
		},
		state_total: {
			census_2000: STATE_TOTALS.census_2000,
			census_2010: STATE_TOTALS.census_2010,
			latest: stateLatest,
			latest_year: latestYear,
			avg_annual_pct: computeAvgAnnualPct(STATE_TOTALS.census_2010, stateLatest, yearSpan) ?? 0,
		},
		source: 'Utah Department of Workforce Services, Labor Market Information',
		fetched_at: new Date().toISOString(),
	};
}

// ── Public API: fetch employment data ──

export async function fetchEmploymentData(countyKey: string): Promise<EmploymentData | null> {
	const config = COUNTY_CONFIGS[countyKey];
	if (!config) return null;

	// Find latest available QCEW year
	const latestYear = await findLatestQcewYear(config.fips);
	if (!latestYear) return null;

	const earlyYear = latestYear - 10;
	const midYear = latestYear - 5;

	// Fetch all 3 years + unemployment in parallel
	const [latestData, midData, earlyData, unemploymentData] = await Promise.all([
		fetchQcewYear(config.fips, latestYear),
		fetchQcewYear(config.fips, midYear),
		fetchQcewYear(config.fips, earlyYear),
		fetchUnemployment(config.fips),
	]);

	if (!latestData) return null;

	// Build industry rows from sector groups
	const latestTotal = latestData.get('total') ?? 0;
	const industries = SECTOR_GROUPS.map(group => {
		const sumForYear = (data: Map<string, number> | null) => {
			if (!data) return null;
			let sum = 0;
			let found = false;
			for (const code of group.naics) {
				const val = data.get(code);
				if (val != null) { sum += val; found = true; }
			}
			return found ? sum : null;
		};

		const jobsLatest = sumForYear(latestData);
		return {
			name: group.label,
			naics: group.naics.join(','),
			jobs_early: sumForYear(earlyData),
			early_year: earlyYear,
			jobs_mid: sumForYear(midData),
			mid_year: midYear,
			jobs_latest: jobsLatest,
			latest_year: latestYear,
			pct_of_total: jobsLatest != null && latestTotal > 0
				? Math.round((jobsLatest / latestTotal) * 1000) / 10
				: null,
		};
	}).filter(i => i.jobs_latest != null || i.jobs_mid != null || i.jobs_early != null);

	return {
		industries,
		total: {
			early: earlyData?.get('total') ?? 0,
			mid: midData?.get('total') ?? 0,
			latest: latestTotal,
		},
		unemployment: unemploymentData ?? { county_rate: 0, state_rate: 0, as_of: 'N/A' },
		per_capita_income: { county: config.per_capita_income.amount, year: config.per_capita_income.year },
		major_employers: config.major_employers,
		source: 'Utah Department of Workforce Services, Labor Market Information',
		fetched_at: new Date().toISOString(),
	};
}
