// SFR Development Narrative — prose summary of residential permit trends
import type { TemplateContext } from '../context.js';
import type { ConstructionData } from '$lib/services/data/census-permits.js';
import { fmt, str } from './helpers.js';

export function render(ctx: TemplateContext): string {
	const data = ctx.market_data.bebr_construction as ConstructionData | undefined;

	if (!data?.sfr_permits?.length) {
		return `<p class="data-placeholder"><em>[SFR Development Narrative — Data from Census Bureau / Gardner Policy Institute not yet loaded. Use "Refresh Data" to fetch permit data.]</em></p>`;
	}

	const county = data.county || ctx.county_display;
	const permits = data.sfr_permits;
	const latest = permits[permits.length - 1];
	const previous = permits.length >= 2 ? permits[permits.length - 2] : null;
	const earliest = permits[0];

	let html = `<p>${county} County issued ${fmt(latest.permits)} single-family residential building permits in ${latest.year}`;

	if (previous) {
		const change = latest.permits - previous.permits;
		const pctChange = previous.permits > 0
			? ((change / previous.permits) * 100).toFixed(1)
			: '0.0';
		const direction = change >= 0 ? 'up' : 'down';
		html += `, ${direction} from ${fmt(previous.permits)} in ${previous.year} (${change >= 0 ? '+' : ''}${pctChange}%)`;
	}
	html += '.</p>';

	// Trend analysis
	if (permits.length >= 3) {
		const peak = permits.reduce((a, b) => a.permits > b.permits ? a : b);
		const trough = permits.reduce((a, b) => a.permits < b.permits ? a : b);

		if (peak.year !== latest.year) {
			html += `<p>Permit activity peaked at ${fmt(peak.permits)} in ${peak.year}`;
			if (trough.year > peak.year) {
				html += ` and declined to ${fmt(trough.permits)} in ${trough.year}`;
			}
			html += '.</p>';
		}

		// Overall trend
		if (earliest && latest && permits.length >= 4) {
			const totalChange = latest.permits - earliest.permits;
			const trend = totalChange > 0 ? 'increased' : totalChange < 0 ? 'decreased' : 'remained stable';
			html += `<p>Over the ${latest.year - earliest.year}-year period from ${earliest.year} to ${latest.year}, `;
			html += `residential construction activity has ${trend} in ${county} County, `;
			html += `reflecting ${totalChange > 0 ? 'ongoing demand for new housing' : 'moderation in the housing market'}.</p>`;
		}
	}

	return html;
}
