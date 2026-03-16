import { describe, it, expect } from 'vitest';
import type { TemplateContext } from '../context.js';
import { SUBSECTION_TEMPLATES, renderSubsection, buildParentHtml } from './index.js';

// Mock TemplateContext with realistic data
function mockCtx(overrides: Partial<TemplateContext> = {}): TemplateContext {
	return {
		report_id: 1,
		report_number: '2025-001',
		approach: '["sales_comparison","income_cap"]',
		effective_date: '2025-01-15',
		client_name: 'Test Client',
		intended_use: 'estimate market value',
		property_rights: 'fee simple',
		report_date: '2025-02-01',
		report_status: 'draft',
		property_id: 1,
		address: '1602 W 800 S',
		city: 'Payson',
		state: 'UT',
		zip: '84651',
		apn: '31-045-0001',
		county: 'utah_county',
		property_type: 'Industrial',
		year_built: 1998,
		building_sf: 15000,
		land_sf: 43560,
		land_acres: 1.0,
		stories: 1,
		construction_class: 'S - Steel Frame',
		quality: 'Average',
		condition: 'Good',
		zoning: 'M-1',
		market_value: 950000,
		county_data_json: JSON.stringify({
			value_history: [{ year: 2024, land: 300000, improvement: 650000, total: 950000 }],
			tax_history: [{ year: 2024, general_tax: 5200, special_tax: 300, total_tax: 5500 }],
			flood_zone: 'X'
		}),
		owner_name: 'Jones Paint LLC',
		acquisition_date: '2015-06-01',
		occupancy: 'Owner Occupied',
		latitude: 40.0345,
		longitude: -111.7386,
		building_to_land_ratio: 0.3444,
		effective_age: 15,
		land_sf_from_acres: 43560,
		appraiser: {
			name: 'Brad Smith',
			company: 'Smith Appraisal',
			address: '123 Main St',
			phone: '801-555-0100',
			email: 'brad@smith.com',
			license_number: 'CG12345',
			license_state: 'UT',
			certification_type: 'Certified General Appraiser',
			cv_text: ''
		},
		approaches_list: ['sales_comparison', 'income_cap'],
		approach_labels: ['Sales Comparison Approach', 'Income Capitalization Approach'],
		full_address: '1602 W 800 S, Payson, UT 84651',
		county_display: 'Utah',
		report_date_formatted: 'February 1, 2025',
		effective_date_formatted: 'January 15, 2025',
		market_data: {},
		comp_count: 0,
		comp_counties: [],
		target_price_psf: null,
		...overrides
	};
}

describe('SUBSECTION_TEMPLATES registry', () => {
	it('has all expected template keys', () => {
		const expected = [
			'nbhd_intro', 'nbhd_geographic', 'nbhd_jurisdiction', 'nbhd_life_stage',
			'nbhd_community_facilities', 'nbhd_utilities', 'nbhd_conformity',
			'nbhd_population_table', 'nbhd_population_narrative',
			'nbhd_employment_table', 'nbhd_employment_narrative',
			'nbhd_access', 'nbhd_dev_sfr_table', 'nbhd_dev_sfr_narrative',
			'nbhd_dev_commercial_table', 'nbhd_vacancy_industrial', 'nbhd_vacancy_office_retail',
			'site_dimensions', 'site_topography', 'site_access',
			'site_soil', 'site_utilities', 'site_rail', 'site_easements',
			'zoning_classification', 'zoning_conforming',
			'improvement_general', 'improvement_quality', 'improvement_ada'
		];
		for (const key of expected) {
			expect(SUBSECTION_TEMPLATES[key], `Missing template: ${key}`).toBeDefined();
		}
	});

	it('all templates return non-empty HTML strings', () => {
		const ctx = mockCtx();
		for (const [key, renderFn] of Object.entries(SUBSECTION_TEMPLATES)) {
			const result = renderFn(ctx);
			expect(typeof result).toBe('string');
			expect(result.length, `Template ${key} returned empty string`).toBeGreaterThan(0);
			expect(result, `Template ${key} should contain HTML`).toContain('<');
		}
	});
});

describe('nbhd_intro', () => {
	it('renders USPAP definition boilerplate', () => {
		const html = renderSubsection('nbhd_intro', mockCtx())!;
		expect(html).toContain('neighborhood');
		expect(html).toContain('Appraisal Institute');
		expect(html).toContain('complementary land uses');
	});
});

describe('nbhd_geographic', () => {
	it('includes city and county', () => {
		const html = renderSubsection('nbhd_geographic', mockCtx())!;
		expect(html).toContain('Payson');
		expect(html).toContain('Utah County');
	});

	it('includes coordinates when available', () => {
		const html = renderSubsection('nbhd_geographic', mockCtx())!;
		expect(html).toContain('40.0345');
	});
});

describe('nbhd_jurisdiction', () => {
	it('renders Utah County specific content', () => {
		const html = renderSubsection('nbhd_jurisdiction', mockCtx())!;
		expect(html).toContain('Provo-Orem');
		expect(html).toContain('I-15');
		expect(html).toContain('Payson');
	});
});

describe('nbhd_life_stage', () => {
	it('renders stage definitions', () => {
		const html = renderSubsection('nbhd_life_stage', mockCtx())!;
		expect(html).toContain('Growth');
		expect(html).toContain('Stability');
		expect(html).toContain('Decline');
		expect(html).toContain('Revitalization');
	});

	it('renders selected stage when provided', () => {
		const html = renderSubsection('nbhd_life_stage', mockCtx(), { stage: 'growth' })!;
		expect(html).toContain('<strong>growth</strong>');
		expect(html).toContain('new construction');
	});

	it('shows placeholder when no stage selected', () => {
		const html = renderSubsection('nbhd_life_stage', mockCtx())!;
		expect(html).toContain('Select the neighborhood life stage');
	});
});

describe('site_dimensions', () => {
	it('renders site data table', () => {
		const html = renderSubsection('site_dimensions', mockCtx())!;
		expect(html).toContain('1.00 acres');
		expect(html).toContain('43,560 SF');
		expect(html).toContain('15,000 SF');
		expect(html).toContain('Building-to-Land Ratio');
	});

	it('handles missing data gracefully', () => {
		const html = renderSubsection('site_dimensions', mockCtx({
			land_acres: null, land_sf: null, building_sf: null,
			land_sf_from_acres: null, building_to_land_ratio: null
		}))!;
		expect(html).toContain('not available');
	});
});

describe('site_topography', () => {
	it('renders flood zone from county data', () => {
		const html = renderSubsection('site_topography', mockCtx())!;
		expect(html).toContain('Zone X');
		expect(html).toContain('minimal flood hazard');
	});

	it('handles SFHA flood zones', () => {
		const html = renderSubsection('site_topography', mockCtx({
			county_data_json: JSON.stringify({ flood_zone: 'AE' })
		}))!;
		expect(html).toContain('Zone AE');
		expect(html).toContain('Special Flood Hazard Area');
	});
});

describe('zoning_classification', () => {
	it('renders zoning info', () => {
		const html = renderSubsection('zoning_classification', mockCtx())!;
		expect(html).toContain('M-1');
		expect(html).toContain('Payson');
		expect(html).toContain('industrial');
	});

	it('handles missing zoning', () => {
		const html = renderSubsection('zoning_classification', mockCtx({ zoning: null }))!;
		// When zoning is null, str() returns 'N/A' and the template checks for it
		expect(html).toContain('not available');
	});
});

describe('improvement_general', () => {
	it('renders building characteristics', () => {
		const html = renderSubsection('improvement_general', mockCtx())!;
		expect(html).toContain('Industrial');
		expect(html).toContain('15,000');
		expect(html).toContain('1998');
		expect(html).toContain('S - Steel Frame');
	});
});

describe('improvement_quality', () => {
	it('renders quality, condition, and age analysis', () => {
		const html = renderSubsection('improvement_quality', mockCtx())!;
		expect(html).toContain('Average');
		expect(html).toContain('Good');
		expect(html).toContain('1998');
		expect(html).toContain('Effective Age');
	});
});

describe('boilerplate templates', () => {
	const ctx = mockCtx();

	it('nbhd_community_facilities mentions city', () => {
		const html = renderSubsection('nbhd_community_facilities', ctx)!;
		expect(html).toContain('Payson');
	});

	it('nbhd_utilities mentions city', () => {
		const html = renderSubsection('nbhd_utilities', ctx)!;
		expect(html).toContain('Payson');
		expect(html).toContain('Rocky Mountain Power');
	});

	it('site_soil has disclaimer', () => {
		const html = renderSubsection('site_soil', ctx)!;
		expect(html).toContain('hazardous material');
	});

	it('improvement_ada has ADA disclaimer', () => {
		const html = renderSubsection('improvement_ada', ctx)!;
		expect(html).toContain('Americans with Disabilities Act');
	});

	it('zoning_conforming references zoning code', () => {
		const html = renderSubsection('zoning_conforming', ctx)!;
		expect(html).toContain('M-1');
	});
});

describe('DWS population templates (with data)', () => {
	const popData = {
		municipalities: [
			{ name: 'Payson', fips: '57450', census_2000: 12716, census_2010: 18294, latest: 21500, latest_year: 2022, avg_annual_pct: 1.34 },
			{ name: 'Spanish Fork', fips: '70440', census_2000: 20246, census_2010: 34691, latest: 44200, latest_year: 2022, avg_annual_pct: 2.04 },
		],
		county_total: { census_2000: 368536, census_2010: 516564, latest: 700000, latest_year: 2022, avg_annual_pct: 2.56 },
		state_total: { census_2000: 2233169, census_2010: 2763885, latest: 3400000, latest_year: 2022, avg_annual_pct: 1.74 },
		source: 'Utah Department of Workforce Services, Labor Market Information',
		fetched_at: '2025-01-01T00:00:00Z',
	};
	const ctx = mockCtx({ market_data: { dws_population: popData } });

	it('nbhd_population_table renders table with municipalities', () => {
		const html = renderSubsection('nbhd_population_table', ctx)!;
		expect(html).toContain('Payson');
		expect(html).toContain('12,716');
		expect(html).toContain('18,294');
		expect(html).toContain('21,500');
		expect(html).toContain('1.3%');
		expect(html).toContain('Utah County');
		expect(html).toContain('State of Utah');
		expect(html).toContain('Source:');
	});

	it('nbhd_population_narrative renders growth prose', () => {
		const html = renderSubsection('nbhd_population_narrative', ctx)!;
		expect(html).toContain('Utah County');
		expect(html).toContain('368,536');
		expect(html).toContain('700,000');
		expect(html).toContain('2.6%');
		expect(html).toContain('Payson');
	});
});

describe('DWS employment templates (with data)', () => {
	const empData = {
		industries: [
			{ name: 'Construction', naics: '23', jobs_early: 15000, early_year: 2013, jobs_mid: 18000, mid_year: 2018, jobs_latest: 22000, latest_year: 2023, pct_of_total: 11.9 },
			{ name: 'Manufacturing', naics: '31-33', jobs_early: 14000, early_year: 2013, jobs_mid: 16000, mid_year: 2018, jobs_latest: 18500, latest_year: 2023, pct_of_total: 10.0 },
			{ name: 'Retail Trade', naics: '44-45', jobs_early: 18000, early_year: 2013, jobs_mid: 21000, mid_year: 2018, jobs_latest: 24500, latest_year: 2023, pct_of_total: 13.2 },
		],
		total: { early: 140000, mid: 160000, latest: 185000 },
		unemployment: { county_rate: 2.1, state_rate: 2.5, as_of: 'December 2024' },
		per_capita_income: { county: 29886, year: 2022 },
		major_employers: ['Brigham Young University', 'Vivint', 'Adobe Systems'],
		source: 'Utah Department of Workforce Services, Labor Market Information',
		fetched_at: '2025-01-01T00:00:00Z',
	};
	const ctx = mockCtx({ market_data: { dws_employment: empData } });

	it('nbhd_employment_table renders industry rows', () => {
		const html = renderSubsection('nbhd_employment_table', ctx)!;
		expect(html).toContain('Construction');
		expect(html).toContain('Manufacturing');
		expect(html).toContain('22,000');
		expect(html).toContain('11.9%');
		expect(html).toContain('Total');
		expect(html).toContain('185,000');
		expect(html).toContain('Source:');
	});

	it('nbhd_employment_narrative mentions unemployment and employers', () => {
		const html = renderSubsection('nbhd_employment_narrative', ctx)!;
		expect(html).toContain('185,000');
		expect(html).toContain('2.1%');
		expect(html).toContain('2.5%');
		expect(html).toContain('$29,886');
		expect(html).toContain('Brigham Young University');
		expect(html).toContain('below-average');
	});
});

describe('DWS templates (no data — fallback)', () => {
	const ctx = mockCtx({ market_data: {} });

	it('nbhd_population_table shows placeholder when no data', () => {
		const html = renderSubsection('nbhd_population_table', ctx)!;
		expect(html).toContain('not yet loaded');
		expect(html).toContain('data-placeholder');
	});

	it('nbhd_population_narrative shows placeholder when no data', () => {
		const html = renderSubsection('nbhd_population_narrative', ctx)!;
		expect(html).toContain('not yet loaded');
	});

	it('nbhd_employment_table shows placeholder when no data', () => {
		const html = renderSubsection('nbhd_employment_table', ctx)!;
		expect(html).toContain('not yet loaded');
	});

	it('nbhd_employment_narrative shows placeholder when no data', () => {
		const html = renderSubsection('nbhd_employment_narrative', ctx)!;
		expect(html).toContain('not yet loaded');
	});
});

describe('UDOT access templates (with data)', () => {
	const accessData = {
		subject_street: { name: '800 S', routeId: '0178', aadt: 13088, forecastAadt: null, distanceMiles: 0.2, classification: 'state_route' as const },
		nearby_roads: [
			{ name: 'MAIN ST', routeId: '0006', aadt: 18905, forecastAadt: null, distanceMiles: 0.25, classification: 'us_highway' as const },
			{ name: '100 W', routeId: '0198', aadt: 15642, forecastAadt: null, distanceMiles: 0.07, classification: 'state_route' as const },
		],
		nearest_highway: { name: 'I-15 NB FWY', routeId: '0015', distanceMiles: 1.9, aadt: 85000 },
		address_street: '1602 W 800 S',
		fetched_at: '2025-01-01T00:00:00Z',
		source: 'Utah Department of Transportation',
	};
	const ctx = mockCtx({ market_data: { udot_access: accessData } });

	it('nbhd_access renders highway and road info', () => {
		const html = renderSubsection('nbhd_access', ctx)!;
		expect(html).toContain('I-15');
		expect(html).toContain('1.9');
		expect(html).toContain('800 S');
		expect(html).toContain('13,088');
		expect(html).toContain('Source:');
	});

	it('site_access renders subject street details', () => {
		const html = renderSubsection('site_access', ctx)!;
		expect(html).toContain('800 S');
		expect(html).toContain('state route');
		expect(html).toContain('13,088');
		expect(html).toContain('onsite inspection');
	});
});

describe('UDOT templates (no data — fallback)', () => {
	const ctx = mockCtx({ market_data: {} });

	it('nbhd_access shows placeholder when no data', () => {
		const html = renderSubsection('nbhd_access', ctx)!;
		expect(html).toContain('not yet loaded');
	});

	it('site_access shows placeholder when no data', () => {
		const html = renderSubsection('site_access', ctx)!;
		expect(html).toContain('not yet loaded');
	});
});

describe('BEBR construction templates (with data)', () => {
	const constData = {
		sfr_permits: [
			{ year: 2021, permits: 7450, value: 2229000000 },
			{ year: 2022, permits: 5080, value: 1694000000 },
			{ year: 2023, permits: 4575, value: 1466000000 },
		],
		multifamily_permits: [
			{ year: 2021, units: 3590, value: null },
			{ year: 2022, units: 3085, value: null },
			{ year: 2023, units: 1461, value: null },
		],
		commercial: [
			{ year: 2022, permits: 95, value: 275000000, type: 'Commercial/Industrial' },
			{ year: 2023, permits: 82, value: 230000000, type: 'Commercial/Industrial' },
		],
		county: 'Utah',
		source: 'U.S. Census Bureau, Building Permits Survey; Kem C. Gardner Policy Institute',
		fetched_at: '2025-01-01T00:00:00Z',
	};
	const ctx = mockCtx({ market_data: { bebr_construction: constData } });

	it('nbhd_dev_sfr_table renders permit rows', () => {
		const html = renderSubsection('nbhd_dev_sfr_table', ctx)!;
		expect(html).toContain('7,450');
		expect(html).toContain('4,575');
		expect(html).toContain('2023');
		expect(html).toContain('Source:');
	});

	it('nbhd_dev_sfr_narrative describes trends', () => {
		const html = renderSubsection('nbhd_dev_sfr_narrative', ctx)!;
		expect(html).toContain('Utah County');
		expect(html).toContain('4,575');
		expect(html).toContain('2023');
		expect(html).toContain('down');
	});

	it('nbhd_dev_commercial_table renders commercial rows', () => {
		const html = renderSubsection('nbhd_dev_commercial_table', ctx)!;
		expect(html).toContain('95');
		expect(html).toContain('$275,000,000');
		expect(html).toContain('Commercial/Industrial');
	});
});

describe('BEBR templates (no data — fallback)', () => {
	const ctx = mockCtx({ market_data: {} });

	it('nbhd_dev_sfr_table shows placeholder', () => {
		const html = renderSubsection('nbhd_dev_sfr_table', ctx)!;
		expect(html).toContain('not yet loaded');
	});

	it('nbhd_dev_commercial_table shows placeholder', () => {
		const html = renderSubsection('nbhd_dev_commercial_table', ctx)!;
		expect(html).toContain('not yet loaded');
	});
});

describe('Commerce CRG vacancy templates (with data)', () => {
	const indData = {
		entries: [{ quarter: 'Q4', year: 2024, vacancy_rate: 3.2, absorption_sf: 50000, avg_asking_rent: 0.65, rent_unit: 'SF NNN' }],
		county: 'Utah', source: 'Commerce CRG', updated_at: '2025-01-01',
	};
	const ctx = mockCtx({ market_data: { crg_vacancy_industrial: indData } });

	it('nbhd_vacancy_industrial renders table', () => {
		const html = renderSubsection('nbhd_vacancy_industrial', ctx)!;
		expect(html).toContain('3.2%');
		expect(html).toContain('50,000');
		expect(html).toContain('$1');
		expect(html).toContain('Q4 2024');
	});
});

describe('Commerce CRG vacancy templates (no data — prompts entry)', () => {
	const ctx = mockCtx({ market_data: {} });

	it('nbhd_vacancy_industrial shows entry prompt', () => {
		const html = renderSubsection('nbhd_vacancy_industrial', ctx)!;
		expect(html).toContain('No data entered');
	});

	it('nbhd_vacancy_office_retail shows entry prompt', () => {
		const html = renderSubsection('nbhd_vacancy_office_retail', ctx)!;
		expect(html).toContain('No data entered');
	});
});

describe('renderSubsection', () => {
	it('returns null for unknown keys', () => {
		expect(renderSubsection('nonexistent_key', mockCtx())).toBeNull();
	});
});

describe('buildParentHtml', () => {
	it('concatenates subsection HTMLs in order', () => {
		const html = buildParentHtml(
			['a', 'b', 'c'],
			{ a: '<p>First</p>', b: '<p>Second</p>', c: '<p>Third</p>' }
		);
		expect(html).toBe('<p>First</p>\n\n<p>Second</p>\n\n<p>Third</p>');
	});

	it('skips empty subsections', () => {
		const html = buildParentHtml(
			['a', 'b', 'c'],
			{ a: '<p>First</p>', b: '', c: '<p>Third</p>' }
		);
		expect(html).toBe('<p>First</p>\n\n<p>Third</p>');
	});

	it('returns empty string when all empty', () => {
		expect(buildParentHtml(['a', 'b'], {})).toBe('');
	});
});
