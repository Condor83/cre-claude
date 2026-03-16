// Improvement General Description — construction class, materials, SF from county data
import type { TemplateContext } from '../context.js';
import { str, fmt, fmtSF, renderTable } from './helpers.js';

export function render(ctx: TemplateContext): string {
	const buildingSf = ctx.building_sf;
	const yearBuilt = ctx.year_built;
	const stories = ctx.stories;
	const constructionClass = str(ctx.construction_class, null);
	const quality = str(ctx.quality, null);
	const condition = str(ctx.condition, null);
	const propertyType = str(ctx.property_type, 'commercial');

	// Build characteristics table
	const headers = ['Characteristic', 'Description'];
	const rows: string[][] = [];

	if (propertyType) rows.push(['Property Type', propertyType]);
	if (buildingSf != null) rows.push(['Gross Building Area', fmtSF(buildingSf)]);
	if (yearBuilt != null) rows.push(['Year Built', String(yearBuilt)]);
	if (stories != null) rows.push(['Number of Stories', String(stories)]);
	if (constructionClass) rows.push(['Construction Class', constructionClass]);
	if (quality) rows.push(['Quality Rating', quality]);
	if (condition) rows.push(['Overall Condition', condition]);

	let html = `<p>The subject property is improved with a ${propertyType} building`;

	const details: string[] = [];
	if (buildingSf != null) details.push(`containing approximately ${fmt(buildingSf)} square feet`);
	if (yearBuilt != null) details.push(`originally constructed in ${yearBuilt}`);
	if (stories != null) details.push(`${stories} ${stories === 1 ? 'story' : 'stories'} in height`);

	if (details.length > 0) {
		html += ' ' + details.join(', ');
	}
	html += `.</p>`;

	if (constructionClass) {
		html += `<p>The building is classified as ${constructionClass} construction`;
		if (constructionClass.toLowerCase().includes('s') || constructionClass.toLowerCase().includes('steel')) {
			html += `, featuring a structural steel frame with metal or masonry exterior walls`;
		} else if (constructionClass.toLowerCase().includes('c') || constructionClass.toLowerCase().includes('masonry')) {
			html += `, featuring masonry bearing walls with a flat or low-slope roof system`;
		}
		html += `.</p>`;
	}

	if (rows.length > 0) {
		html += renderTable(headers, rows);
	}

	return html;
}
