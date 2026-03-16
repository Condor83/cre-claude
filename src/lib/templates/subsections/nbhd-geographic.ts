// Geographic Location — city/county/distance from property context
import type { TemplateContext } from '../context.js';
import { str } from './helpers.js';

export function render(ctx: TemplateContext): string {
	const city = str(ctx.city, 'the subject city');
	const county = ctx.county_display !== 'N/A' ? ctx.county_display : str(ctx.county, 'the subject');
	const state = str(ctx.state, 'Utah');
	const address = str(ctx.address, 'the subject property');

	let html = `<p>The subject property is located at ${address} in ${city}, ${county} County, ${state}.`;

	// Add coordinate info if available
	if (ctx.latitude && ctx.longitude) {
		html += ` The property coordinates are approximately ${ctx.latitude.toFixed(4)}° N, ${Math.abs(ctx.longitude).toFixed(4)}° W.`;
	}

	html += `</p>`;

	html += `<p>${city} is located in ${county} County in the ${state === 'Utah' ? 'central' : 'western'} portion
of the state. ${county} County is one of the fastest-growing counties in ${state}, with a
diverse economic base anchored by education, technology, healthcare, and manufacturing sectors.</p>`;

	return html;
}
