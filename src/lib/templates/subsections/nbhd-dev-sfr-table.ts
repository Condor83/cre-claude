// SFR Building Permits Table — Year × {Permits, Value}
import type { TemplateContext } from '../context.js';
import type { ConstructionData } from '$lib/services/data/census-permits.js';
import { fmt, fmtCurrency, renderTable } from './helpers.js';

export function render(ctx: TemplateContext): string {
	const data = ctx.market_data.bebr_construction as ConstructionData | undefined;

	if (!data?.sfr_permits?.length) {
		return `<p class="data-placeholder"><em>[SFR Building Permits Table — Data from Census Bureau / Gardner Policy Institute not yet loaded. Use "Refresh Data" to fetch permit data.]</em></p>`;
	}

	const headers = ['Year', 'SFR Permits', 'Valuation'];
	const rows = data.sfr_permits.map(p => [
		String(p.year),
		fmt(p.permits),
		p.value ? fmtCurrency(p.value) : 'N/A',
	]);

	return renderTable(headers, rows) +
		`\n<p class="source">Source: ${data.source}</p>`;
}
