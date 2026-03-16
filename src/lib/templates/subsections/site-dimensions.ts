// Site Dimensions — acres, SF, building-to-land ratio (computed from PropertyContext)
import type { TemplateContext } from '../context.js';
import { fmt, fmtAcres, fmtSF, fmtPct, fmtDecimal, safeDivide, renderTable } from './helpers.js';

export function render(ctx: TemplateContext): string {
	const landAcres = ctx.land_acres;
	const landSf = ctx.land_sf ?? ctx.land_sf_from_acres;
	const buildingSf = ctx.building_sf;
	const blr = ctx.building_to_land_ratio;

	// Build summary table
	const headers = ['Characteristic', 'Value'];
	const rows: string[][] = [];

	if (landAcres != null) rows.push(['Land Area (Acres)', fmtAcres(landAcres)]);
	if (landSf != null) rows.push(['Land Area (SF)', fmtSF(landSf)]);
	if (buildingSf != null) rows.push(['Building Area (SF)', fmtSF(buildingSf)]);
	if (blr != null) rows.push(['Building-to-Land Ratio', fmtPct(blr * 100, 1)]);

	// Floor area ratio (FAR) if we can compute it
	const far = safeDivide(buildingSf, landSf);
	if (far != null) rows.push(['Floor Area Ratio (FAR)', fmtDecimal(far)]);

	let html = `<p>The subject site is described as follows:</p>`;

	if (rows.length > 0) {
		html += renderTable(headers, rows);
	} else {
		html += `<p><em>Site dimension data not available. Update property facts to populate this section.</em></p>`;
		return html;
	}

	// Narrative
	html += `\n<p>The subject site contains approximately `;
	if (landAcres != null && landSf != null) {
		html += `${fmtDecimal(landAcres)} acres (${fmt(landSf)} square feet)`;
	} else if (landAcres != null) {
		html += `${fmtDecimal(landAcres)} acres`;
	} else if (landSf != null) {
		html += `${fmt(landSf)} square feet`;
	}

	html += `. The site is assumed to be of a regular shape suitable for the existing improvements.`;

	if (buildingSf != null && blr != null) {
		html += ` The building-to-land ratio of ${fmtPct(blr * 100, 1)} is considered
typical for properties of this type in the subject market area.`;
	}

	html += `</p>`;

	return html;
}
