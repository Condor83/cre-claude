import type { TemplateContext } from '../context.js';

export function render(ctx: TemplateContext): string {
	const compCount = ctx.comp_count;

	if (compCount === 0) {
		return `<p><em>Add comparable sales to generate the Sales Comparison Approach conclusion.</em></p>`;
	}

	return `
<p>Based on the analysis of the ${compCount} comparable sale${compCount === 1 ? '' : 's'} presented
above, with adjustments for differences in property rights, financing, conditions of sale,
market conditions, location, and physical characteristics, the Sales Comparison Approach
indicates a value for the subject property as follows:</p>

<p><strong>Sales Comparison Approach Value Indication: $___________</strong></p>

<p>The indicated value by the Sales Comparison Approach considers the adjusted sale prices
of the comparable properties and gives primary weight to those sales requiring the least
amount of adjustment.</p>
`;
}
