import type { TemplateContext } from '../context.js';

export function render(ctx: TemplateContext): string {
	const compCount = ctx.comp_count;
	const counties = ctx.comp_counties;

	const countiesText = counties.length === 0
		? 'the subject market area'
		: counties.length === 1
			? counties[0].replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
			: counties.slice(0, -1).map(c => c.replaceAll('_', ' ').replace(/\b\w/g, ch => ch.toUpperCase())).join(', ')
				+ ' and ' + counties[counties.length - 1].replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

	const compText = compCount === 0
		? 'Comparable sales have not yet been identified.'
		: compCount === 1
			? 'One comparable sale was identified'
			: `${compCount} comparable sales were identified`;

	return `
<p>The Sales Comparison Approach is based on the principle of substitution, which holds
that the value of a property tends to be set by the price of an equally desirable substitute
property. This approach involves comparing the subject property to similar properties that
have recently sold in the competitive market area, making adjustments for differences in
property characteristics.</p>

<p>The appraiser searched for comparable improved sales in ${countiesText}. Sales were
selected based on similarity to the subject in terms of property type, size, age, condition,
and location. ${compText}${compCount > 0 ? ' as being sufficiently comparable to the subject property for analysis.' : ''}</p>
`;
}
