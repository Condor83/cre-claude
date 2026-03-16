import { describe, it, expect } from 'vitest';
import { render } from './sca_intro.js';
import type { TemplateContext } from '../context.js';

function makeCtx(overrides: Partial<TemplateContext> = {}): TemplateContext {
	return {
		report_id: 1,
		report_number: '26.001',
		approach: '["sales_comparison"]',
		effective_date: '2025-01-15',
		client_name: 'Test Client',
		intended_use: 'estimate market value',
		property_rights: 'fee simple',
		report_date: '2025-01-15',
		report_status: 'draft',
		property_id: 1,
		address: '100 Main St',
		city: 'Provo',
		state: 'UT',
		zip: '84601',
		apn: '12:345:0001',
		county: 'utah_county',
		property_type: 'Industrial/Warehouse',
		year_built: 2000,
		building_sf: 10000,
		land_sf: 20000,
		land_acres: 0.46,
		stories: 1,
		construction_class: 'C',
		quality: 'Average',
		condition: 'Good',
		zoning: 'M-1',
		market_value: 800000,
		county_data_json: null,
		owner_name: 'Test Owner',
		acquisition_date: '2020-01-01',
		occupancy: 'owner',
		latitude: 40.23,
		longitude: -111.66,
		building_to_land_ratio: 0.5,
		effective_age: 25,
		land_sf_from_acres: null,
		appraiser: { name: 'Test', company: '', address: '', phone: '', email: '', license_number: '', license_state: 'UT', certification_type: '', cv_text: '' },
		approaches_list: ['sales_comparison'],
		approach_labels: ['Sales Comparison Approach'],
		full_address: '100 Main St Provo, UT 84601',
		county_display: 'Utah',
		report_date_formatted: 'January 15, 2025',
		effective_date_formatted: 'January 15, 2025',
		market_data: {},
		comp_count: 0,
		comp_counties: [],
		target_price_psf: null,
		...overrides
	};
}

describe('sca_intro template', () => {
	it('renders "not yet been identified" with 0 comps', () => {
		const html = render(makeCtx({ comp_count: 0 }));
		expect(html).toContain('not yet been identified');
	});

	it('uses singular "One comparable sale was identified" for 1 comp', () => {
		const html = render(makeCtx({ comp_count: 1, comp_counties: ['utah_county'] }));
		expect(html).toContain('One comparable sale was identified');
	});

	it('uses plural "3 comparable sales were identified" for N comps', () => {
		const html = render(makeCtx({ comp_count: 3, comp_counties: ['utah_county'] }));
		expect(html).toContain('3 comparable sales were identified');
	});

	it('formats single county: "Utah County"', () => {
		const html = render(makeCtx({ comp_count: 1, comp_counties: ['utah_county'] }));
		expect(html).toContain('Utah County');
	});

	it('formats two counties with "and"', () => {
		const html = render(makeCtx({ comp_count: 2, comp_counties: ['utah_county', 'salt_lake_county'] }));
		expect(html).toContain('Utah County');
		expect(html).toContain('and');
		expect(html).toContain('Salt Lake County');
	});

	it('falls back to "the subject market area" with 0 counties', () => {
		const html = render(makeCtx({ comp_count: 0, comp_counties: [] }));
		expect(html).toContain('the subject market area');
	});
});
