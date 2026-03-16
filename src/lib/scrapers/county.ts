import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';

export interface PropertyFacts {
	apn: string;
	address: string;
	city: string;
	year_built: number;
	building_sf: number;    // above grade + mezzanine
	land_acres: number;
	land_sf: number;
	zoning: string;
	owner_name: string;
	construction_class: string;
	quality: string;
	property_type_raw: string;
	market_value: number;
	acquisition_year: number;
}

export interface CountyDataJson {
	appraisal_fields: Record<string, string>;
	value_history: Array<{ year: number; land: number; improvement: number; total: number }>;
	tax_history: Array<{ year: number; general_tax: number; special_tax: number; total_tax: number }>;
	deeds: Array<{ date: string; grantor: string; grantee: string; entry_number: string }>;
	owner_history: Array<{ years: string; name: string }>;
	fetched_at: string;
	source: 'utah_county' | 'salt_lake_county';
	partial_years?: boolean;
}

export interface CountyLookupResult {
	found: boolean;
	data: Partial<PropertyFacts> | null;
	county_data?: CountyDataJson;
	source: 'utah_county' | 'salt_lake_county';
	error?: string;
}

// Hardcoded base URLs — SSRF prevention (never construct URLs from user input)
const UTAH_COUNTY_SEARCH_URL = 'https://www.utahcounty.gov/LandRecords/AddressSearch.asp';
const UTAH_COUNTY_APPRAISAL_URL = 'https://www.utahcounty.gov/LandRecords/AppraisalInfo.asp';
const UTAH_COUNTY_VALNOTICE_URL = 'https://www.utahcounty.gov/LandRecords/ValNotice.asp';
const UTAH_COUNTY_PROPERTY_URL = 'https://www.utahcounty.gov/LandRecords/property.asp';
const SLC_ADDRESS_API = 'https://apps.saltlakecounty.gov/services/is/is-gis-service/api/AddressLookUp/GetParcelsByAddress';
const SLC_DETAIL_URL = 'https://apps.saltlakecounty.gov/assessor/new/resultsMain.cfm';

// Street type abbreviations used by Utah County's form
const STREET_TYPES: Record<string, string> = {
	'street': 'ST', 'st': 'ST',
	'road': 'RD', 'rd': 'RD',
	'drive': 'DR', 'dr': 'DR',
	'circle': 'CR', 'cr': 'CR', 'cir': 'CR',
	'way': 'WY', 'wy': 'WY',
	'lane': 'LN', 'ln': 'LN',
	'avenue': 'AV', 'ave': 'AV', 'av': 'AV',
	'boulevard': 'BL', 'blvd': 'BL', 'bl': 'BL',
	'court': 'CT', 'ct': 'CT',
	'parkway': 'PK', 'pkwy': 'PK', 'pk': 'PK',
	'place': 'PL', 'pl': 'PL',
	'terrace': 'TR', 'ter': 'TR', 'tr': 'TR'
};

/**
 * Parse a street address into Utah County form components.
 * e.g. "1602 W 800 South" -> { house: "1602", dir: "W", street: "800", type: "%" }
 * e.g. "123 N Main Street" -> { house: "123", dir: "N", street: "Main", type: "ST" }
 */
export function parseUtahCountyAddress(address: string): {
	house: string; dir: string; street: string; type: string;
} {
	const parts = address.trim().split(/\s+/);
	let house = '';
	let dir = '%';
	let street = '';
	let type = '%';

	if (parts.length === 0) return { house, dir, street, type };

	// First token is always house number
	house = parts[0];

	// Check if second token is a direction
	const dirMap: Record<string, string> = {
		'n': 'N', 'north': 'N', 's': 'S', 'south': 'S',
		'e': 'E', 'east': 'E', 'w': 'W', 'west': 'W'
	};

	let idx = 1;
	// Strip trailing period from direction (e.g. "W." -> "W")
	const dirToken = idx < parts.length ? parts[idx].replace(/\.$/, '').toLowerCase() : '';
	if (dirToken && dirMap[dirToken]) {
		dir = dirMap[dirToken];
		idx++;
	}

	// Remaining tokens: street name (possibly multi-word) and optional street type at end
	const remaining = parts.slice(idx);
	if (remaining.length === 0) return { house, dir, street, type };

	// Check if last token is a street type (e.g., "Main Street" or "Main St." -> type=ST)
	const lastToken = remaining[remaining.length - 1].replace(/\.$/, '').toLowerCase();
	if (STREET_TYPES[lastToken]) {
		type = STREET_TYPES[lastToken];
		street = remaining.slice(0, -1).join(' ');
	} else if (dirMap[lastToken] && remaining.length > 1) {
		// "800 South" — the direction word IS the street suffix in Utah addressing
		// Don't strip it, include as part of street name but leave type as wildcard
		street = remaining.join(' ');
	} else {
		street = remaining.join(' ');
	}

	// If street is empty (e.g., address was "1602 W 800 South" and we stripped "South" as type),
	// put remaining back
	if (!street && remaining.length > 0) {
		street = remaining.join(' ');
		type = '%';
	}

	return { house, dir, street, type };
}

export async function lookupCountyAssessor(
	address: string,
	city: string,
	county: 'utah_county' | 'salt_lake_county'
): Promise<CountyLookupResult> {
	const start = Date.now();
	const source = county;

	try {
		if (county === 'utah_county') {
			return await lookupUtahCounty(address, city, start);
		} else {
			return await lookupSaltLakeCounty(address, city, start);
		}
	} catch (err) {
		const duration = Date.now() - start;
		console.log(`[county-scraper] ${source} failed in ${duration}ms:`, err);
		return { found: false, data: null, source, error: String(err) };
	}
}

/**
 * Normalize a parcel serial number for the target county format.
 * Utah County uses colons: "46:764:0002"
 * Salt Lake County uses dashes: "16-06-102-008-0000"
 */
export function normalizeParcel(serial: string, county: 'utah_county' | 'salt_lake_county'): string {
	const trimmed = serial.trim();
	if (county === 'utah_county') {
		// Replace dashes with colons for Utah County
		const normalized = trimmed.replace(/-/g, ':');
		if (normalized !== trimmed) {
			console.log(`[county-scraper] normalized parcel "${trimmed}" -> "${normalized}" for utah_county`);
		}
		return normalized;
	} else {
		// Replace colons with dashes for Salt Lake County
		const normalized = trimmed.replace(/:/g, '-');
		if (normalized !== trimmed) {
			console.log(`[county-scraper] normalized parcel "${trimmed}" -> "${normalized}" for salt_lake_county`);
		}
		return normalized;
	}
}

/**
 * Look up a single parcel by serial number and explicit county.
 */
export async function lookupByParcel(
	serial: string,
	county: 'utah_county' | 'salt_lake_county'
): Promise<CountyLookupResult> {
	const start = Date.now();
	const normalized = normalizeParcel(serial, county);

	try {
		if (county === 'utah_county') {
			return await scrapeUtahCountyPages(normalized, start);
		} else {
			return await scrapeSaltLakeCountyPages(normalized, start);
		}
	} catch (err) {
		const duration = Date.now() - start;
		console.log(`[county-scraper] ${county} parcel lookup failed in ${duration}ms:`, err);
		return { found: false, data: null, source: county, error: String(err) };
	}
}

/**
 * Look up multiple parcels and aggregate results.
 */
export async function lookupByParcels(
	serials: string[],
	county: 'utah_county' | 'salt_lake_county'
): Promise<CountyLookupResult> {
	// Normalize: trim + filter empties
	const cleaned = serials.map(s => s.trim()).filter(s => s.length > 0);
	if (cleaned.length === 0) {
		return { found: false, data: null, source: county, error: 'No parcel numbers provided' };
	}
	if (cleaned.length === 1) return lookupByParcel(cleaned[0], county);

	const results = await Promise.allSettled(cleaned.map(s => lookupByParcel(s, county)));

	const fulfilled: CountyLookupResult[] = [];
	let failed = 0;
	for (const r of results) {
		if (r.status === 'fulfilled' && r.value.found && r.value.data) {
			fulfilled.push(r.value);
		} else {
			failed++;
		}
	}

	console.log(`[county-scraper] multi-parcel: ${cleaned.length} parcels, ${fulfilled.length} succeeded, ${failed} failed`);

	if (fulfilled.length === 0) {
		return { found: false, data: null, source: county, error: 'All parcel lookups failed' };
	}

	// Primary parcel = first successful result
	const primary = fulfilled[0];
	const data: Partial<PropertyFacts> = { ...primary.data };

	// Aggregate numeric fields
	if (fulfilled.length > 1) {
		let totalBuildingSf = 0;
		let totalLandAcres = 0;
		let totalLandSf = 0;
		let totalMarketValue = 0;
		for (const r of fulfilled) {
			if (r.data?.building_sf) totalBuildingSf += r.data.building_sf;
			if (r.data?.land_acres) totalLandAcres += r.data.land_acres;
			if (r.data?.land_sf) totalLandSf += r.data.land_sf;
			if (r.data?.market_value) totalMarketValue += r.data.market_value;
		}
		if (totalBuildingSf > 0) data.building_sf = totalBuildingSf;
		if (totalLandAcres > 0) data.land_acres = totalLandAcres;
		if (totalLandSf > 0) data.land_sf = totalLandSf;
		if (totalMarketValue > 0) data.market_value = totalMarketValue;
	}

	// Aggregate county_data
	const countyData = aggregateCountyData(fulfilled);

	return {
		found: true,
		data,
		county_data: countyData,
		source: county
	};
}

function aggregateCountyData(results: CountyLookupResult[]): CountyDataJson | undefined {
	const datas = results.map(r => r.county_data).filter((d): d is CountyDataJson => d !== undefined);
	if (datas.length === 0) return undefined;
	if (datas.length === 1) return datas[0];

	const primary = datas[0];

	// Sum value_history per year
	const valueByYear = new Map<number, { land: number; improvement: number; total: number }>();
	const yearsPerSource: number[][] = [];
	for (const d of datas) {
		const years: number[] = [];
		for (const v of d.value_history) {
			years.push(v.year);
			const existing = valueByYear.get(v.year) ?? { land: 0, improvement: 0, total: 0 };
			existing.land += v.land;
			existing.improvement += v.improvement;
			existing.total += v.total;
			valueByYear.set(v.year, existing);
		}
		yearsPerSource.push(years);
	}
	const valueHistory = Array.from(valueByYear.entries())
		.sort((a, b) => b[0] - a[0])
		.map(([year, vals]) => ({ year, ...vals }));

	// Sum tax_history per year
	const taxByYear = new Map<number, { general_tax: number; special_tax: number; total_tax: number }>();
	for (const d of datas) {
		for (const t of d.tax_history) {
			const existing = taxByYear.get(t.year) ?? { general_tax: 0, special_tax: 0, total_tax: 0 };
			existing.general_tax += t.general_tax;
			existing.special_tax += t.special_tax;
			existing.total_tax += t.total_tax;
			taxByYear.set(t.year, existing);
		}
	}
	const taxHistory = Array.from(taxByYear.entries())
		.sort((a, b) => b[0] - a[0])
		.map(([year, vals]) => ({ year, ...vals }));

	// Merge deeds, deduplicate by entry_number
	const seenEntries = new Set<string>();
	const deeds: CountyDataJson['deeds'] = [];
	for (const d of datas) {
		for (const deed of d.deeds) {
			if (!seenEntries.has(deed.entry_number)) {
				seenEntries.add(deed.entry_number);
				deeds.push(deed);
			}
		}
	}

	// Check if year coverage is uneven
	let partialYears = false;
	if (yearsPerSource.length > 1) {
		const allYears = new Set(yearsPerSource.flat());
		partialYears = yearsPerSource.some(ys => ys.length !== allYears.size);
	}

	return {
		appraisal_fields: primary.appraisal_fields,
		value_history: valueHistory,
		tax_history: taxHistory,
		deeds,
		owner_history: primary.owner_history,
		fetched_at: primary.fetched_at,
		source: primary.source,
		partial_years: partialYears || undefined
	};
}

function fetchWithTimeout(url: string, signal: AbortSignal): Promise<Response> {
	return fetch(url, { signal });
}

/**
 * Extract a text value from a Utah County page by finding a <td> containing the
 * label text and returning the next sibling <td>'s text. Uses cheerio so nested
 * tables (e.g. Owner field) are handled correctly via .text() flattening.
 */
export function extractFieldValue($: cheerio.CheerioAPI, label: string): string | null {
	let result: string | null = null;
	$('td').each(function () {
		// Strip nested tables from this td before comparing text
		const text = $(this).clone().children('table').remove().end().text().trim();
		if (text === label || text.startsWith(label)) {
			const next = $(this).next('td');
			if (next.length) {
				result = next.text().trim();
				return false; // break
			}
		}
	});
	return result;
}

/**
 * Extract all label/value pairs from AppraisalInfo page main content area.
 */
export function extractAppraisalFields($: cheerio.CheerioAPI): Record<string, string> {
	const fields: Record<string, string> = {};
	// Scope to table cells in the body content (skip nav/footer by targeting inner tables)
	$('td').each(function () {
		const text = $(this).clone().children('table').remove().end().text().trim();
		// Match pattern "Label:" followed by a sibling td with a value
		if (text.endsWith(':') && text.length > 1 && text.length < 60) {
			const next = $(this).next('td');
			if (next.length) {
				const value = next.text().trim();
				if (value && value.length < 200) {
					const key = text.replace(/:$/, '');
					fields[key] = value;
				}
			}
		}
	});
	return fields;
}

/**
 * Extract value history from ValNotice.asp page.
 *
 * The actual page layout has a row with "Property Types:" label followed by
 * year headers like "2025 Market Value" and "2026 Market Value" in later cells.
 * Then value rows, then a "Total Property Market Value" summary row with totals
 * per year. The years and values are in the same flat table (not a grid).
 *
 * We find the row containing "Property Types:" to extract years from the
 * "YYYY Market Value" headers, then find the "Total Property Market Value"
 * row to get the totals for each year.
 */
export function extractValueHistory($: cheerio.CheerioAPI): CountyDataJson['value_history'] {
	const history: CountyDataJson['value_history'] = [];

	// Find the row containing "Property Types:" — its sibling cells have year headers
	let years: number[] = [];
	$('td').each(function () {
		const text = $(this).text().trim();
		if (text === 'Property Types:') {
			// Scan sibling cells in this row for "YYYY Market Value" headers
			$(this).parent().find('td').each(function () {
				const cellText = $(this).text().trim();
				const yearMatch = cellText.match(/^(\d{4})\s+Market\s+Value/i);
				if (yearMatch) {
					years.push(parseInt(yearMatch[1], 10));
				}
			});
			return false; // break
		}
	});

	if (years.length === 0) return history;

	// Find "Total Property Market Value" row — extract dollar values per year
	$('td').each(function () {
		const text = $(this).text().trim();
		if (text === 'Total Property Market Value') {
			const totals: number[] = [];
			$(this).parent().find('td').each(function () {
				const cellText = $(this).text().trim();
				if (cellText.startsWith('$')) {
					const val = parseFloat(cellText.replace(/[$,]/g, ''));
					if (!isNaN(val)) totals.push(val);
				}
			});

			for (let i = 0; i < years.length; i++) {
				history.push({
					year: years[i],
					land: 0,         // ValNotice doesn't break out land vs improvement
					improvement: 0,
					total: totals[i] ?? 0
				});
			}
			return false; // break
		}
	});

	return history;
}

/**
 * Find a TabbedPanelsContent panel by matching its corresponding tab label text.
 * The tab labels (.TabbedPanelsTab) and content panels (.TabbedPanelsContent)
 * may not be 1:1 indexed (extra panels can exist), so we find the tab label
 * first, get its index among siblings, then use that to find the right panel.
 */
export function validateTabPanel(
	$: cheerio.CheerioAPI,
	_panelIndex: number,
	expectedHeading: string
): cheerio.Cheerio<AnyNode> | null {
	const tabLabels = $('.TabbedPanelsTab');
	const panels = $('.TabbedPanelsContent');

	// Find which tab label matches
	let matchedTabIndex = -1;
	tabLabels.each(function (i) {
		const tabText = $(this).text().trim();
		if (tabText.toLowerCase().includes(expectedHeading.toLowerCase())) {
			matchedTabIndex = i;
			return false; // break
		}
	});

	if (matchedTabIndex === -1) {
		console.log(`[county-scraper] tab not found: expected "${expectedHeading}" among ${tabLabels.length} tabs`);
		return null;
	}

	if (matchedTabIndex >= panels.length) {
		console.log(`[county-scraper] tab "${expectedHeading}" at index ${matchedTabIndex} but only ${panels.length} panels`);
		return null;
	}

	return panels.eq(matchedTabIndex);
}

/**
 * Extract tax history from the Tax History tab in property.asp.
 *
 * Actual column layout:
 * Year | General Taxes | Adjustments | Net Taxes | Fees | Payments | Tax Balance | Balance Due | Tax Area
 *
 * We extract Year, General Taxes (col 1), Adjustments (col 2), and Net Taxes (col 3).
 */
export function extractTaxHistory($: cheerio.CheerioAPI, panel: cheerio.Cheerio<AnyNode>): CountyDataJson['tax_history'] {
	const history: CountyDataJson['tax_history'] = [];

	panel.find('tr').each(function () {
		const tds = $(this).children('td');
		if (tds.length < 4) return;

		const yearText = tds.eq(0).text().trim();
		const yearMatch = yearText.match(/^(\d{4})$/);
		if (!yearMatch) return;

		const year = parseInt(yearMatch[1], 10);
		const generalTax = parseFloat(tds.eq(1).text().replace(/[$,]/g, '')) || 0;
		const adjustments = parseFloat(tds.eq(2).text().replace(/[$,]/g, '')) || 0;
		const netTax = parseFloat(tds.eq(3).text().replace(/[$,]/g, '')) || 0;

		history.push({ year, general_tax: generalTax, special_tax: adjustments, total_tax: netTax });
	});

	return history;
}

/**
 * Extract value history from the Value History tab in property.asp.
 *
 * Actual column layout (13 columns):
 * Year(0) | RE Com(1) | RE Res(2) | RE Agr(3) | RE Tot(4) |
 * Imp Com(5) | Imp Res(6) | Imp Agr(7) | Imp Tot(8) |
 * GB Land(9) | GB Homesite(10) | GB Tot(11) | Market Value(12)
 *
 * We extract: land = RE Tot (col 4), improvement = Imp Tot (col 8), total = Market Value (col 12).
 */
export function extractValueHistoryFromProperty($: cheerio.CheerioAPI, panel: cheerio.Cheerio<AnyNode>): CountyDataJson['value_history'] {
	const history: CountyDataJson['value_history'] = [];

	panel.find('tr').each(function () {
		const tds = $(this).children('td');
		if (tds.length < 13) return;

		// Year is in column 0, may be a link like <a href="PropertyValues.asp?...">2025</a>
		const yearText = tds.eq(0).text().trim();
		const yearMatch = yearText.match(/^(\d{4})$/);
		if (!yearMatch) return;

		const year = parseInt(yearMatch[1], 10);
		const land = parseFloat(tds.eq(4).text().replace(/[$,\s]/g, '')) || 0;
		const improvement = parseFloat(tds.eq(8).text().replace(/[$,\s]/g, '')) || 0;
		const total = parseFloat(tds.eq(12).text().replace(/[$,\s]/g, '')) || 0;

		history.push({ year, land, improvement, total });
	});

	return history;
}

/**
 * Extract warranty deed transactions from the Documents tab in property.asp.
 *
 * Actual column layout:
 * Entry # (0) | Date (1) | Recorded (2) | Type (3) | Party1/Grantor (4) | Party2/Grantee (5)
 */
export function extractDeeds($: cheerio.CheerioAPI, panel: cheerio.Cheerio<AnyNode>): CountyDataJson['deeds'] {
	const deeds: CountyDataJson['deeds'] = [];

	panel.find('tr').each(function () {
		const tds = $(this).children('td');
		if (tds.length < 6) return;

		// Type is column 3 — check for "WD" (Warranty Deed) or "SP WD" (Special Warranty Deed)
		const typeText = tds.eq(3).text().trim().toUpperCase();
		if (typeText !== 'WD' && typeText !== 'SP WD') return;

		const entryNumber = tds.eq(0).text().trim();
		const date = tds.eq(1).text().trim();
		const grantor = tds.eq(4).text().trim();
		const grantee = tds.eq(5).text().trim();

		if (date && entryNumber) {
			deeds.push({ date, grantor, grantee, entry_number: entryNumber });
		}
	});

	return deeds;
}

/**
 * Extract owner history from the Owner Names tab in property.asp.
 */
export function extractOwnerHistory($: cheerio.CheerioAPI, panel: cheerio.Cheerio<AnyNode>): CountyDataJson['owner_history'] {
	const ownerRows: CountyDataJson['owner_history'] = [];

	panel.find('tr').each(function () {
		const tds = $(this).children('td');
		if (tds.length >= 3) {
			const years = tds.eq(0).text().trim();
			const name = tds.eq(2).text().trim();
			if (/^\d{4}/.test(years) && name) {
				ownerRows.push({ years, name });
			}
		}
	});

	return ownerRows;
}

/**
 * Shared Utah County page-scraping logic used by both address and parcel flows.
 * Takes a serial number (colon format, e.g. "46:764:0002") and fetches all 3 pages.
 */
export async function scrapeUtahCountyPages(
	serialNumber: string,
	start: number
): Promise<CountyLookupResult> {
	const source = 'utah_county' as const;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 15000);

	try {
		// Convert serial to parcel ID for appraisal page (digits only, no colons)
		const parcelId = serialNumber.replace(/:/g, '');
		const currentYear = new Date().getFullYear();

		// Fire all 3 detail page requests in parallel
		const [appraisalRes, valNoticeRes, propRes] = await Promise.allSettled([
			fetchWithTimeout(`${UTAH_COUNTY_APPRAISAL_URL}?avParcelId=${parcelId}`, controller.signal),
			fetchWithTimeout(`${UTAH_COUNTY_VALNOTICE_URL}?av_serial=${serialNumber}&av_tax_year=${currentYear}`, controller.signal),
			fetchWithTimeout(`${UTAH_COUNTY_PROPERTY_URL}?av_serial=${parcelId}`, controller.signal)
		]);

		const data: Partial<PropertyFacts> = { apn: serialNumber };
		let fieldsFound = 1; // APN is already found
		let fieldsFailed = 0;

		// Build county_data_json
		const countyData: CountyDataJson = {
			appraisal_fields: {},
			value_history: [],
			tax_history: [],
			deeds: [],
			owner_history: [],
			fetched_at: new Date().toISOString(),
			source
		};

		// ── AppraisalInfo page ──
		if (appraisalRes.status === 'fulfilled' && appraisalRes.value.ok) {
			const appraisalHtml = await appraisalRes.value.text();
			const $ = cheerio.load(appraisalHtml);

			// Extract ALL label/value pairs for county_data_json
			countyData.appraisal_fields = extractAppraisalFields($);

			// Address — format is "1433 W 130 SOUTH - OREM" (street - city)
			try {
				const addrVal = extractFieldValue($, 'Address:');
				if (addrVal) {
					const dashIdx = addrVal.lastIndexOf(' - ');
					if (dashIdx > 0) {
						data.address = addrVal.substring(0, dashIdx).trim();
						data.city = addrVal.substring(dashIdx + 3).trim();
						// Title-case the city (OREM → Orem)
						data.city = data.city.charAt(0).toUpperCase() + data.city.slice(1).toLowerCase();
					} else {
						data.address = addrVal;
					}
					fieldsFound++;
				}
			} catch { /* optional */ }

			// Year Built
			try {
				const val = extractFieldValue($, 'Year Built:');
				if (val && /^\d{4}$/.test(val)) {
					data.year_built = parseInt(val, 10);
					fieldsFound++;
				} else { fieldsFailed++; }
			} catch { fieldsFailed++; }

			// Above Grade Sq Ft + Mezzanine = total building SF
			try {
				let totalSf = 0;
				const aboveGrade = extractFieldValue($, 'Above Grade Sq Ft:');
				if (aboveGrade) {
					const sf = parseFloat(aboveGrade.replace(/,/g, ''));
					if (!isNaN(sf) && sf > 0) totalSf += sf;
				}
				const mezzanine = extractFieldValue($, 'Mezzanine:');
				if (mezzanine) {
					const mf = parseFloat(mezzanine.replace(/,/g, ''));
					if (!isNaN(mf) && mf > 0) totalSf += mf;
				}
				if (totalSf > 0) {
					data.building_sf = totalSf;
					fieldsFound++;
				} else { fieldsFailed++; }
			} catch { fieldsFailed++; }

			// Land Size Acres
			try {
				const val = extractFieldValue($, 'Land Size Acres:');
				if (val) {
					const acres = parseFloat(val);
					if (!isNaN(acres)) {
						data.land_acres = acres;
						fieldsFound++;
					} else { fieldsFailed++; }
				} else { fieldsFailed++; }
			} catch { fieldsFailed++; }

			// Land Size Sq Ft
			try {
				const val = extractFieldValue($, 'Land Size Sq Ft.:');
				if (val) {
					const sf = parseFloat(val.replace(/,/g, ''));
					if (!isNaN(sf) && sf > 0) {
						data.land_sf = sf;
						fieldsFound++;
					}
				}
			} catch { /* optional field */ }

			// Owner (cheerio handles nested tables)
			try {
				const val = extractFieldValue($, 'Owner:');
				if (val) {
					data.owner_name = val;
					fieldsFound++;
				} else { fieldsFailed++; }
			} catch { fieldsFailed++; }

			// Quality
			try {
				const val = extractFieldValue($, 'Quality:');
				if (val) {
					data.quality = val;
					fieldsFound++;
				}
			} catch { /* optional field */ }

			// Construction Class — parse letter code from "S - Metal"
			try {
				const val = extractFieldValue($, 'Cost Class Description:');
				if (val) {
					const letterMatch = val.match(/^([A-Z])\s*-/);
					data.construction_class = letterMatch ? letterMatch[1] : val;
					fieldsFound++;
				}
			} catch { /* optional field */ }

			// Property Type (raw county string)
			try {
				const val = extractFieldValue($, 'Property Type:');
				if (val) {
					data.property_type_raw = val;
					fieldsFound++;
				}
			} catch { /* optional field */ }
		} else if (appraisalRes.status === 'fulfilled') {
			fieldsFailed++;
		}

		// ── ValNotice page — source of truth for value data ──
		try {
			if (valNoticeRes.status === 'fulfilled' && valNoticeRes.value.ok) {
				const valHtml = await valNoticeRes.value.text();
				const $val = cheerio.load(valHtml);

				// Extract 3-year value history
				countyData.value_history = extractValueHistory($val);

				// Current year market value (from value history or direct extraction)
				if (countyData.value_history.length > 0) {
					// Use the most recent year's total
					const sorted = [...countyData.value_history].sort((a, b) => b.year - a.year);
					if (sorted[0].total > 0) {
						data.market_value = sorted[0].total;
						fieldsFound++;
					}
				}

				// Fallback: direct extraction if value history didn't get it
				if (!data.market_value) {
					const marketVal = extractFieldValue($val, 'Total Property Market Value');
					if (marketVal) {
						const mv = parseFloat(marketVal.replace(/[$,]/g, ''));
						if (!isNaN(mv) && mv > 0) {
							data.market_value = mv;
							fieldsFound++;
						}
					}
				}
			}
		} catch { /* optional */ }

		// ── Property page — tabbed content (owner, tax, deeds) ──
		try {
			if (propRes.status === 'fulfilled' && propRes.value.ok) {
				const propHtml = await propRes.value.text();
				const $prop = cheerio.load(propHtml);

				// Owner Names tab (index 0)
				const ownerPanel = validateTabPanel($prop, 0, 'Owner');
				if (ownerPanel) {
					countyData.owner_history = extractOwnerHistory($prop, ownerPanel);

					// Derive acquisition_year from earliest year of current owner
					if (countyData.owner_history.length > 0) {
						const currentOwner = countyData.owner_history[0].name;
						let earliestYears = countyData.owner_history[0].years;
						for (let i = 1; i < countyData.owner_history.length; i++) {
							if (countyData.owner_history[i].name === currentOwner) {
								earliestYears = countyData.owner_history[i].years;
							} else {
								break;
							}
						}
						const yearMatch = earliestYears.match(/^(\d{4})/);
						if (yearMatch) {
							data.acquisition_year = parseInt(yearMatch[1], 10);
							fieldsFound++;
						}
					}

					// Fallback: if appraisal page failed, get owner from property page
					if (!data.owner_name) {
						const ownerLink = $prop('a[href*="namesearch.asp"]').first().text().trim();
						if (ownerLink) {
							data.owner_name = ownerLink;
							fieldsFound++;
						}
					}
				}

				// Fallback for land_acres from property page
				if (!data.land_acres) {
					const acreageMatch = propHtml.match(/<strong>Acreage:<\/strong>\s*&nbsp;([\d.]+)/);
					if (acreageMatch) {
						data.land_acres = parseFloat(acreageMatch[1]);
						fieldsFound++;
					}
				}

				// Value History tab (index 1) — land/improvement/total breakdown
				const valuePanel = validateTabPanel($prop, 1, 'Value');
				if (valuePanel) {
					const propValueHistory = extractValueHistoryFromProperty($prop, valuePanel);
					if (propValueHistory.length > 0) {
						// Property page has the full breakdown; prefer over ValNotice
						countyData.value_history = propValueHistory;
					}
				}

				// Tax History tab (index 2)
				const taxPanel = validateTabPanel($prop, 2, 'Tax');
				if (taxPanel) {
					countyData.tax_history = extractTaxHistory($prop, taxPanel);
				}

				// Documents tab (index 5)
				const docsPanel = validateTabPanel($prop, 5, 'Document');
				if (docsPanel) {
					countyData.deeds = extractDeeds($prop, docsPanel);
				}
			}
		} catch { /* optional */ }

		const duration = Date.now() - start;
		console.log(`[county-scraper] utah_county: ${duration}ms, found=${fieldsFound}, failed=${fieldsFailed}`);

		return {
			found: fieldsFound > 0,
			data: fieldsFound > 0 ? data : null,
			county_data: countyData,
			source
		};
	} finally {
		clearTimeout(timeout);
	}
}

/**
 * Utah County scraper — address flow:
 * 1. GET AddressSearch.asp with parsed address components -> results list
 * 2. Extract first serial number from results
 * 3. Delegate to scrapeUtahCountyPages() for all page fetching
 */
async function lookupUtahCounty(
	address: string,
	city: string,
	start: number
): Promise<CountyLookupResult> {
	const source = 'utah_county' as const;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 15000);

	try {
		// Step 1: Parse address into form components
		const parsed = parseUtahCountyAddress(address);
		const params = new URLSearchParams({
			av_house: parsed.house,
			av_dir: parsed.dir,
			av_street: parsed.street,
			street_type: parsed.type,
			av_location: city.toUpperCase(),
			av_valid: '...'  // Current records only
		});

		// Step 2: Search
		const searchRes = await fetchWithTimeout(
			`${UTAH_COUNTY_SEARCH_URL}?${params.toString()}`,
			controller.signal
		);
		if (!searchRes.ok) {
			return { found: false, data: null, source, error: `Search HTTP ${searchRes.status}` };
		}

		const searchHtml = await searchRes.text();
		const $search = cheerio.load(searchHtml);

		// Step 3: Find first serial number link
		const serialLink = $search('a[href*="SerialVersions.asp"]').first();
		if (!serialLink.length) {
			const duration = Date.now() - start;
			console.log(`[county-scraper] utah_county: no results found (${duration}ms)`);
			return { found: false, data: null, source };
		}

		const serialNumber = serialLink.text().trim(); // e.g. "66:959:0001"

		// Delegate to shared page-scraping logic
		return await scrapeUtahCountyPages(serialNumber, start);
	} finally {
		clearTimeout(timeout);
	}
}

/**
 * Salt Lake County scraper — parcel-direct flow.
 */
async function scrapeSaltLakeCountyPages(
	parcelId: string,
	start: number
): Promise<CountyLookupResult> {
	const source = 'salt_lake_county' as const;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 5000);

	try {
		const detailRes = await fetchWithTimeout(
			`${SLC_DETAIL_URL}?parcelid=${parcelId}`,
			controller.signal
		);

		const data: Partial<PropertyFacts> = { apn: parcelId };
		let fieldsFound = 1;
		let fieldsFailed = 0;

		if (!detailRes.ok) {
			const duration = Date.now() - start;
			console.log(`[county-scraper] salt_lake_county: detail page HTTP ${detailRes.status} (${duration}ms)`);
			return { found: true, data, source };
		}

		const detailHtml = await detailRes.text();
		const $ = cheerio.load(detailHtml);

		function getRowValue(label: string): string | null {
			let result: string | null = null;
			$('td').each(function () {
				if ($(this).text().trim() === label) {
					const next = $(this).next('td');
					if (next.length) {
						result = next.text().trim();
						return false;
					}
				}
			});
			return result;
		}

		// Owner
		try {
			const val = getRowValue('Owner');
			if (val) { data.owner_name = val; fieldsFound++; }
			else { fieldsFailed++; }
		} catch { fieldsFailed++; }

		// Total Acreage
		try {
			const val = getRowValue('Total Acreage');
			if (val) {
				const acres = parseFloat(val);
				if (!isNaN(acres)) { data.land_acres = acres; fieldsFound++; }
				else { fieldsFailed++; }
			} else { fieldsFailed++; }
		} catch { fieldsFailed++; }

		// Above Grade sqft
		try {
			const val = getRowValue('Above Grade sqft.');
			if (val) {
				const sf = parseFloat(val.replace(/,/g, ''));
				if (!isNaN(sf) && sf > 0) { data.building_sf = sf; fieldsFound++; }
				else { fieldsFailed++; }
			} else { fieldsFailed++; }
		} catch { fieldsFailed++; }

		// Year Built
		try {
			const val = getRowValue('Year Built');
			if (val && /^\d{4}$/.test(val)) {
				data.year_built = parseInt(val, 10);
				fieldsFound++;
			} else { fieldsFailed++; }
		} catch { fieldsFailed++; }

		// Zone
		try {
			const val = getRowValue('Zone');
			if (val) { data.zoning = val; fieldsFound++; }
			else { fieldsFailed++; }
		} catch { fieldsFailed++; }

		// Construction Class
		try {
			const val = getRowValue('Class');
			if (val) {
				const letterMatch = val.match(/^([A-Z])\s*-/);
				data.construction_class = letterMatch ? letterMatch[1] : val;
				fieldsFound++;
			}
		} catch { /* optional */ }

		// Land SF from acreage
		if (data.land_acres && !data.land_sf) {
			data.land_sf = Math.round(data.land_acres * 43560);
		}

		// Market Value
		try {
			const currentYear = new Date().getFullYear();
			const val = getRowValue(`${currentYear} Market Value`);
			if (val) {
				const mv = parseFloat(val.replace(/[$,]/g, ''));
				if (!isNaN(mv) && mv > 0) {
					data.market_value = mv;
					fieldsFound++;
				}
			}
		} catch { /* optional */ }

		const duration = Date.now() - start;
		console.log(`[county-scraper] salt_lake_county: ${duration}ms, found=${fieldsFound}, failed=${fieldsFailed}`);

		return {
			found: fieldsFound > 0,
			data: fieldsFound > 0 ? data : null,
			source
		};
	} finally {
		clearTimeout(timeout);
	}
}

/**
 * Format a raw parcel number into the dashed format SLC expects.
 * "16061020080000" -> "16-06-102-008-0000"
 */
function formatSlcParcelId(raw: string): string {
	if (raw.length !== 14) return raw;
	return `${raw.slice(0, 2)}-${raw.slice(2, 4)}-${raw.slice(4, 7)}-${raw.slice(7, 10)}-${raw.slice(10)}`;
}

/**
 * Salt Lake County scraper — address flow:
 * 1. JSON API: GetParcelsByAddress -> get parcel number
 * 2. Delegate to scrapeSaltLakeCountyPages()
 */
async function lookupSaltLakeCounty(
	address: string,
	city: string,
	start: number
): Promise<CountyLookupResult> {
	const source = 'salt_lake_county' as const;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 5000);

	try {
		const fullAddr = `${address}, ${city.toUpperCase()}`;
		const apiRes = await fetchWithTimeout(
			`${SLC_ADDRESS_API}?address=${encodeURIComponent(fullAddr)}`,
			controller.signal
		);

		if (!apiRes.ok) {
			return { found: false, data: null, source, error: `API HTTP ${apiRes.status}` };
		}

		const apiData = await apiRes.json() as {
			matchedAddreses?: Array<{ parcelNo?: string }>;
		};

		const parcels = apiData.matchedAddreses;
		if (!parcels || parcels.length === 0 || !parcels[0].parcelNo) {
			const duration = Date.now() - start;
			console.log(`[county-scraper] salt_lake_county: no results found (${duration}ms)`);
			return { found: false, data: null, source };
		}

		const rawParcel = parcels[0].parcelNo;
		const formattedParcel = formatSlcParcelId(rawParcel);

		return await scrapeSaltLakeCountyPages(formattedParcel, start);
	} finally {
		clearTimeout(timeout);
	}
}
