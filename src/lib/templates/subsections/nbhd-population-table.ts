// Population Table — Municipality × {Census 2000, Census 2010, Latest, Avg Annual Change}
import type { TemplateContext } from '../context.js';
import type { PopulationData } from '$lib/services/data/census-bls.js';
import { fmt, fmtPct, renderTable } from './helpers.js';

export function render(ctx: TemplateContext): string {
	const data = ctx.market_data.dws_population as PopulationData | undefined;

	if (!data?.municipalities?.length) {
		return `<p class="data-placeholder"><em>[Population Table — Data from Utah Department of Workforce Services not yet loaded. Use "Refresh Data" to fetch Census population estimates.]</em></p>`;
	}

	const latestLabel = `${data.county_total.latest_year} Est.`;
	const headers = ['Municipality', 'Census 2000', 'Census 2010', latestLabel, 'Avg. Annual Change'];

	const rows: string[][] = [];

	for (const muni of data.municipalities) {
		rows.push([
			muni.name,
			muni.census_2000 != null ? fmt(muni.census_2000) : 'N/A',
			muni.census_2010 != null ? fmt(muni.census_2010) : 'N/A',
			muni.latest != null ? fmt(muni.latest) : 'N/A',
			muni.avg_annual_pct != null ? fmtPct(muni.avg_annual_pct) : 'N/A',
		]);
	}

	// County total row
	const ct = data.county_total;
	rows.push([
		`<strong>${ctx.county_display} County</strong>`,
		`<strong>${fmt(ct.census_2000)}</strong>`,
		`<strong>${fmt(ct.census_2010)}</strong>`,
		`<strong>${fmt(ct.latest)}</strong>`,
		`<strong>${fmtPct(ct.avg_annual_pct)}</strong>`,
	]);

	// State total row
	const st = data.state_total;
	rows.push([
		`<strong>State of Utah</strong>`,
		`<strong>${fmt(st.census_2000)}</strong>`,
		`<strong>${fmt(st.census_2010)}</strong>`,
		`<strong>${fmt(st.latest)}</strong>`,
		`<strong>${fmtPct(st.avg_annual_pct)}</strong>`,
	]);

	return renderTable(headers, rows) +
		`\n<p class="source">Source: Utah Department of Workforce Services, Labor Market Information; U.S. Census Bureau</p>`;
}
