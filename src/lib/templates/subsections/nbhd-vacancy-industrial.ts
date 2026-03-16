// Industrial Vacancy & Rental Rates — table from manually entered Commerce CRG data
import type { TemplateContext } from '../context.js';
import { fmtPct, fmt, fmtCurrency, renderTable } from './helpers.js';

interface VacancyEntry {
	quarter: string;
	year: number;
	vacancy_rate: number;
	absorption_sf: number | null;
	avg_asking_rent: number;
	rent_unit: string;
}

interface VacancyData {
	entries: VacancyEntry[];
	county: string;
	source: string;
	updated_at: string;
}

export function render(ctx: TemplateContext): string {
	const data = ctx.market_data.crg_vacancy_industrial as VacancyData | undefined;

	if (!data?.entries?.length) {
		return `<p class="data-placeholder"><em>[Industrial Vacancy & Rental Rates — No data entered yet. ` +
			`Update vacancy data from Commerce CRG quarterly market reports using the market data settings.]</em></p>`;
	}

	const county = data.county || ctx.county_display;
	const headers = ['Period', 'Vacancy Rate', 'Absorption (SF)', 'Avg. Asking Rent'];

	const rows = data.entries.map(e => [
		`${e.quarter} ${e.year}`,
		fmtPct(e.vacancy_rate),
		e.absorption_sf != null ? fmt(e.absorption_sf) : 'N/A',
		`${fmtCurrency(e.avg_asking_rent)}/${e.rent_unit}`,
	]);

	const latest = data.entries[data.entries.length - 1];
	let html = `<p>According to Commerce CRG, the industrial market in ${county} County `;
	html += `reported a vacancy rate of ${fmtPct(latest.vacancy_rate)} in ${latest.quarter} ${latest.year}, `;
	html += `with average asking rents of ${fmtCurrency(latest.avg_asking_rent)} per ${latest.rent_unit}.</p>`;

	html += renderTable(headers, rows);
	html += `\n<p class="source">Source: ${data.source || 'Commerce Real Estate Solutions (Commerce CRG)'}</p>`;

	return html;
}
