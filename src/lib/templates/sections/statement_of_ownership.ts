import type { TemplateContext } from '../context.js';

export function render(ctx: TemplateContext): string {
	const county = ctx.county_display !== 'N/A' ? ctx.county_display : 'the local';
	const owner = ctx.owner_name ?? 'the current owner of record';

	let html = `
<p>According to ${county} County records, the subject property is currently owned by
<strong>${owner}</strong>.</p>
`;

	if (ctx.acquisition_date) {
		const acqDate = new Date(ctx.acquisition_date).toLocaleDateString('en-US', {
			year: 'numeric', month: 'long', day: 'numeric'
		});
		html += `
<p>The subject property was acquired by the current owner on or about
<strong>${acqDate}</strong>, according to public records.</p>
`;
	}

	html += `
<p>To the best of our knowledge, the subject property has not transferred within the
three years prior to the effective date of this appraisal, unless otherwise noted herein.
No sales or transfers are currently pending or contemplated, to the best of our knowledge.</p>
`;

	return html;
}
