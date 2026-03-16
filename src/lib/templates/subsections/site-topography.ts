// Site Topography & Drainage — level/grade + FEMA flood zone reference
import type { TemplateContext } from '../context.js';
import { str } from './helpers.js';

export function render(ctx: TemplateContext): string {
	const city = str(ctx.city, 'the subject area');

	// Check county_data_json for FEMA flood data if available
	let floodZone = 'X';
	let floodPanel = '';
	if (ctx.county_data_json) {
		try {
			const cd = JSON.parse(ctx.county_data_json);
			if (cd.flood_zone) floodZone = cd.flood_zone;
			if (cd.flood_panel) floodPanel = cd.flood_panel;
		} catch { /* ignore */ }
	}

	let html = `<p>The subject site is generally level to gently sloping, which is typical
for the ${city} area. Drainage appears adequate based on visual inspection during the
site visit. No evidence of standing water, drainage problems, or erosion was observed.</p>`;

	html += `<p><strong>FEMA Flood Zone:</strong> The subject property is located in FEMA Flood Zone ${floodZone}`;

	if (floodZone === 'X' || floodZone === 'C') {
		html += `, which is classified as an area of minimal flood hazard. The property is
outside the 100-year and 500-year flood plains. Flood insurance is not required for this property.`;
	} else if (floodZone === 'AE' || floodZone === 'A') {
		html += `, which is classified as a Special Flood Hazard Area (SFHA) within the 100-year
flood plain. Flood insurance is required for this property if there is a federally-backed mortgage.`;
	} else {
		html += `. The reader is referred to the FEMA flood map for detailed flood zone information.`;
	}

	if (floodPanel) {
		html += ` (FIRM Panel: ${floodPanel})`;
	}

	html += `</p>`;

	return html;
}
