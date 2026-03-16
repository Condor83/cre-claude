// Placeholder templates for data-source-dependent subsections
// These will be replaced by real templates when each data source scraper is implemented
// For now, they render a styled "awaiting data" message so the app doesn't crash

import type { TemplateContext } from '../context.js';

type SubsectionRenderer = (ctx: TemplateContext) => string;

const DATA_SOURCE_LABELS: Record<string, string> = {
	utah_dws: 'Utah Department of Workforce Services',
	bebr: 'U of U Gardner Policy Institute (BEBR)',
	udot: 'Utah Department of Transportation',
	commerce_crg: 'Commerce CRG'
};

function placeholder(label: string, dataSource: string): SubsectionRenderer {
	const sourceLabel = DATA_SOURCE_LABELS[dataSource] ?? dataSource;
	return () =>
		`<p class="data-placeholder"><em>[${label} — Data from ${sourceLabel} not yet loaded. ` +
		`Use "Refresh Data" when available, or this will be populated automatically in a future update.]</em></p>`;
}

export const DATA_PLACEHOLDER_TEMPLATES: Record<string, SubsectionRenderer> = {
	// ── Neighborhood: Utah DWS — replaced by real templates in index.ts ──
	// (nbhd_population_table, nbhd_population_narrative, nbhd_employment_table, nbhd_employment_narrative)

	// ── Neighborhood: UDOT ──
	nbhd_access: placeholder('Access & Transportation', 'udot'),

	// ── Neighborhood: BEBR ──
	nbhd_dev_sfr_table: placeholder('SFR Building Permits Table', 'bebr'),
	nbhd_dev_sfr_narrative: placeholder('SFR Development Narrative', 'bebr'),
	nbhd_dev_commercial_table: placeholder('Commercial Construction Table', 'bebr'),

	// ── Neighborhood: Commerce CRG ──
	nbhd_vacancy_industrial: placeholder('Industrial Vacancy & Rental Rates', 'commerce_crg'),
	nbhd_vacancy_office_retail: placeholder('Office & Retail Vacancy & Rental Rates', 'commerce_crg'),

	// ── Site Description: UDOT ──
	site_access: placeholder('Site Access & Street Improvements', 'udot')
};
