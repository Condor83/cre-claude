// Jurisdiction & Proximity — nearby cities, metro distance
import type { TemplateContext } from '../context.js';
import { str } from './helpers.js';

export function render(ctx: TemplateContext): string {
	const city = str(ctx.city, 'the subject city');
	const county = ctx.county_display !== 'N/A' ? ctx.county_display : str(ctx.county, 'the subject');

	// Utah County specific proximity data — expand for other counties as needed
	const isUtahCounty = county === 'Utah' || ctx.county === 'utah_county';

	let html = `<p>The subject property falls within the jurisdiction of ${city}, ${county} County, Utah.`;

	if (isUtahCounty) {
		html += ` ${county} County is Utah's second-most-populous county and is part of the
Provo-Orem Metropolitan Statistical Area (MSA). The county seat is Provo.</p>`;

		html += `<p>The subject neighborhood benefits from proximity to the following major population
and employment centers:</p>
<ul>
<li><strong>Provo</strong> — County seat, home to Brigham Young University</li>
<li><strong>Orem</strong> — Utah Valley University, major retail corridor</li>
<li><strong>Lehi / American Fork</strong> — Silicon Slopes technology corridor</li>
<li><strong>Spanish Fork / Springville</strong> — South county commercial centers</li>
<li><strong>Salt Lake City</strong> — State capital, approximately 45-60 miles north via I-15</li>
</ul>`;

		html += `<p>Interstate 15 is the primary north-south transportation corridor serving the county,
providing direct access to Salt Lake City to the north and St. George to the south.</p>`;
	} else {
		html += `</p>`;
		html += `<p>The area is served by regional transportation corridors and is within reasonable
proximity to major employment and population centers in the ${county} County market area.</p>`;
	}

	return html;
}
