// Employment Table — Industry × {Early, Mid, Latest, % of Total}
import type { TemplateContext } from '../context.js';
import type { EmploymentData } from '$lib/services/data/census-bls.js';
import { fmt, fmtPct, renderTable } from './helpers.js';

export function render(ctx: TemplateContext): string {
	const data = ctx.market_data.dws_employment as EmploymentData | undefined;

	if (!data?.industries?.length) {
		return `<p class="data-placeholder"><em>[Employment Table — Data from Utah Department of Workforce Services not yet loaded. Use "Refresh Data" to fetch BLS employment data.]</em></p>`;
	}

	const earlyLabel = String(data.industries[0]?.early_year ?? '');
	const midLabel = String(data.industries[0]?.mid_year ?? '');
	const latestLabel = String(data.industries[0]?.latest_year ?? '');
	const headers = ['Industry', earlyLabel, midLabel, latestLabel, '% Employed'];

	const rows: string[][] = [];

	for (const ind of data.industries) {
		rows.push([
			ind.name,
			ind.jobs_early != null ? fmt(ind.jobs_early) : 'N/A',
			ind.jobs_mid != null ? fmt(ind.jobs_mid) : 'N/A',
			ind.jobs_latest != null ? fmt(ind.jobs_latest) : 'N/A',
			ind.pct_of_total != null ? fmtPct(ind.pct_of_total) : 'N/A',
		]);
	}

	// Total row
	rows.push([
		`<strong>Total</strong>`,
		`<strong>${data.total.early ? fmt(data.total.early) : 'N/A'}</strong>`,
		`<strong>${data.total.mid ? fmt(data.total.mid) : 'N/A'}</strong>`,
		`<strong>${data.total.latest ? fmt(data.total.latest) : 'N/A'}</strong>`,
		`<strong>100.0%</strong>`,
	]);

	return renderTable(headers, rows) +
		`\n<p class="source">Source: Utah Department of Workforce Services, Labor Market Information; U.S. Bureau of Labor Statistics, QCEW</p>`;
}
