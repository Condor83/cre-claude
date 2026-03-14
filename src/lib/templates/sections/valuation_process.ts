import type { TemplateContext } from '../context.js';

export function render(ctx: TemplateContext): string {
	const developed = ctx.approach_labels;
	const developedText = developed.length > 0
		? developed.join(', ')
		: 'Sales Comparison Approach, Income Capitalization Approach';

	const hasSales = ctx.approaches_list.includes('sales_comparison');
	const hasIncome = ctx.approaches_list.includes('income_cap');
	const hasCost = ctx.approaches_list.includes('cost');

	let html = `
<p>There are three generally accepted approaches to estimating the market value of
real property: the Cost Approach, the Sales Comparison Approach, and the Income
Capitalization Approach. The applicability of each approach depends on the type of
property being appraised, the quality and quantity of data available, and the nature
of the appraisal assignment.</p>

<p><strong>Cost Approach:</strong> The Cost Approach is based on the principle of substitution,
which holds that a prudent buyer will pay no more for a property than the cost to acquire
a similar site and construct improvements of equal utility. This approach estimates value
by adding the estimated land value to the depreciated cost of the improvements.</p>

<p><strong>Sales Comparison Approach:</strong> The Sales Comparison Approach is based on
the principle that an informed buyer will pay no more for a property than the cost of
acquiring an existing property with the same utility. This approach compares the subject
property to similar properties that have recently sold, making adjustments for differences
in characteristics.</p>

<p><strong>Income Capitalization Approach:</strong> The Income Capitalization Approach is
based on the principle of anticipation, which holds that value is created by the expectation
of future benefits. This approach converts anticipated income from a property into a value
estimate through capitalization or discounted cash flow analysis.</p>

<p>Based on the analysis of the subject property, the following approaches to value have
been developed in this appraisal:</p>
<ul>
`;

	if (hasSales) {
		html += `	<li><strong>Sales Comparison Approach</strong> &mdash; Developed. Sufficient comparable
	sales data is available to provide a reliable indication of value.</li>\n`;
	}
	if (hasIncome) {
		html += `	<li><strong>Income Capitalization Approach</strong> &mdash; Developed. The subject property
	is an income-producing property type, and adequate market rental and capitalization
	rate data is available.</li>\n`;
	}
	if (hasCost) {
		html += `	<li><strong>Cost Approach</strong> &mdash; Developed. The cost approach provides an
	additional indication of value for this property.</li>\n`;
	}

	html += `</ul>

<p>The ${developedText} ${developed.length === 1 ? 'has' : 'have'} been developed and
reconciled to arrive at a final opinion of market value.</p>
`;

	return html;
}
