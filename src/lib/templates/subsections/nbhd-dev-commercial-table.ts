// Commercial Construction Table — Year × {Permits, Value}
import type { TemplateContext } from '../context.js';
import type { ConstructionData } from '$lib/services/data/census-permits.js';
import { fmt, fmtCurrency, renderTable } from './helpers.js';

export function render(ctx: TemplateContext): string {
	const data = ctx.market_data.bebr_construction as ConstructionData | undefined;

	if (!data?.commercial?.length) {
		return `<p class="data-placeholder"><em>[Commercial Construction Table — Data from Gardner Policy Institute not yet loaded. Commercial construction data requires manual update or Gardner Policy Institute access.]</em></p>`;
	}

	const headers = ['Year', 'Type', 'Permits', 'Valuation'];
	const rows = data.commercial.map(p => [
		String(p.year),
		p.type,
		fmt(p.permits),
		p.value ? fmtCurrency(p.value) : 'N/A',
	]);

	return renderTable(headers, rows) +
		`\n<p class="source">Source: ${data.source}</p>`;
}
