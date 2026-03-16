// Employment Narrative — per capita income, unemployment, major employers
import type { TemplateContext } from '../context.js';
import type { EmploymentData } from '$lib/services/data/census-bls.js';
import { fmt, fmtPct, fmtCurrency, str } from './helpers.js';

export function render(ctx: TemplateContext): string {
	const data = ctx.market_data.dws_employment as EmploymentData | undefined;

	if (!data) {
		return `<p class="data-placeholder"><em>[Employment Narrative — Data from Utah Department of Workforce Services not yet loaded. Use "Refresh Data" to fetch BLS employment data.]</em></p>`;
	}

	const county = ctx.county_display !== 'N/A' ? ctx.county_display : str(ctx.county, 'the subject');

	// Find top 3 industries by employment
	const sorted = [...data.industries].sort((a, b) => (b.jobs_latest ?? 0) - (a.jobs_latest ?? 0));
	const top3 = sorted.slice(0, 3);

	let html = `<p>Total covered employment in ${county} County was ${fmt(data.total.latest)} `;
	html += `as of ${data.industries[0]?.latest_year ?? 'the latest reporting period'}`;

	if (data.total.mid > 0) {
		const change = data.total.latest - data.total.mid;
		const pctChange = ((change / data.total.mid) * 100).toFixed(1);
		html += `, an increase of ${fmt(Math.abs(change))} jobs (${change >= 0 ? '+' : ''}${pctChange}%) `;
		html += `from ${fmt(data.total.mid)} in ${data.industries[0]?.mid_year ?? ''}`;
	}
	html += `.</p>`;

	// Top industries
	if (top3.length > 0) {
		html += `<p>The largest employment sectors in ${county} County are `;
		const parts = top3.map(ind => {
			const pct = ind.pct_of_total != null ? ` (${fmtPct(ind.pct_of_total)})` : '';
			return `${ind.name}${pct}`;
		});
		html += parts.join(', ') + '.</p>';
	}

	// Per capita income
	if (data.per_capita_income?.county) {
		html += `<p>Per capita income in ${county} County was ${fmtCurrency(data.per_capita_income.county)} `;
		html += `as of ${data.per_capita_income.year}.</p>`;
	}

	// Unemployment
	const unemp = data.unemployment;
	if (unemp && unemp.as_of !== 'N/A') {
		html += `<p>The unemployment rate in ${county} County was ${fmtPct(unemp.county_rate)} as of `;
		html += `${unemp.as_of}, compared to ${fmtPct(unemp.state_rate)} for the State of Utah. `;
		if (unemp.county_rate < unemp.state_rate) {
			html += `The below-average unemployment rate indicates a relatively healthy local labor market.`;
		} else if (unemp.county_rate > unemp.state_rate + 1) {
			html += `The above-average unemployment rate may reflect challenges in the local economy.`;
		} else {
			html += `The unemployment rate is generally consistent with statewide conditions.`;
		}
		html += `</p>`;
	}

	// Major employers
	if (data.major_employers?.length > 0) {
		html += `<p>Major employers in ${county} County include `;
		html += data.major_employers.join(', ') + '.</p>';
	}

	return html;
}
