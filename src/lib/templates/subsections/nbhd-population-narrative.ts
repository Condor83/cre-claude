// Population Narrative — prose summary of growth rates from population data
import type { TemplateContext } from '../context.js';
import type { PopulationData } from '$lib/services/data/census-bls.js';
import { fmt, fmtPct, str } from './helpers.js';

export function render(ctx: TemplateContext): string {
	const data = ctx.market_data.dws_population as PopulationData | undefined;

	if (!data?.county_total) {
		return `<p class="data-placeholder"><em>[Population Narrative — Data from Utah Department of Workforce Services not yet loaded. Use "Refresh Data" to fetch Census population estimates.]</em></p>`;
	}

	const city = str(ctx.city, 'the subject city');
	const county = ctx.county_display !== 'N/A' ? ctx.county_display : str(ctx.county, 'the subject');
	const ct = data.county_total;
	const st = data.state_total;

	// Find subject city in municipality data
	const subjectMuni = data.municipalities.find(
		m => m.name.toLowerCase() === city.toLowerCase()
	);

	let html = `<p>${county} County has experienced significant population growth over the past two decades. `;
	html += `The county's population grew from ${fmt(ct.census_2000)} in 2000 to ${fmt(ct.census_2010)} in 2010, `;
	html += `and is estimated at ${fmt(ct.latest)} as of ${ct.latest_year}. `;
	html += `This represents an average annual growth rate of approximately ${fmtPct(ct.avg_annual_pct)} `;
	html += `since the 2010 Census, compared to ${fmtPct(st.avg_annual_pct)} for the State of Utah overall.</p>`;

	if (subjectMuni?.latest != null) {
		html += `<p>${city} has grown from ${fmt(subjectMuni.census_2010)} in 2010 to an estimated `;
		html += `${fmt(subjectMuni.latest)} in ${subjectMuni.latest_year}`;
		if (subjectMuni.avg_annual_pct != null) {
			html += `, an average annual growth rate of ${fmtPct(subjectMuni.avg_annual_pct)}`;
		}
		html += `. `;

		// Compare to county rate
		if (subjectMuni.avg_annual_pct != null && ct.avg_annual_pct != null) {
			if (subjectMuni.avg_annual_pct > ct.avg_annual_pct + 0.5) {
				html += `This rate exceeds the county average, reflecting strong demand for residential and commercial development in the area.`;
			} else if (subjectMuni.avg_annual_pct < ct.avg_annual_pct - 0.5) {
				html += `This rate is below the county average, suggesting a more mature, established community.`;
			} else {
				html += `This rate is consistent with the overall county growth trend.`;
			}
		}
		html += `</p>`;
	}

	html += `<p>Continued population growth in ${county} County is supported by the region's diversified `;
	html += `economic base, quality educational institutions, and desirable quality of life. This growth `;
	html += `positively influences demand for commercial and industrial real estate in the subject market area.</p>`;

	return html;
}
