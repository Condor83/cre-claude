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

	// ── Neighborhood: UDOT — replaced by real templates in index.ts ──
	// (nbhd_access)

	// ── Neighborhood: BEBR — replaced by real templates in index.ts ──
	// (nbhd_dev_sfr_table, nbhd_dev_sfr_narrative, nbhd_dev_commercial_table)

	// ── All placeholders replaced by real templates in index.ts ──
};
