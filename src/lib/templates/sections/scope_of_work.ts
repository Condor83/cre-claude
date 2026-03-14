import type { TemplateContext } from '../context.js';

export function render(ctx: TemplateContext): string {
	const approachList = ctx.approach_labels;
	const approachText = approachList.length > 0
		? approachList.join(', ')
		: 'Sales Comparison Approach, Income Capitalization Approach';

	const approachBullets = approachList.map(a => `<li>${a}</li>`).join('\n');

	return `
<p>In preparing this appraisal, the appraiser has conformed to the Uniform Standards of
Professional Appraisal Practice (USPAP) as promulgated by the Appraisal Standards Board
of The Appraisal Foundation. The scope of work for this appraisal assignment was determined
by the complexity of the appraisal problem to be solved and the expectations of the
intended users.</p>

<p>The scope of work included the following steps:</p>
<ul>
	<li>Identified the subject property through physical inspection and review of public records,
	including county assessor data, tax records, and recorded instruments.</li>
	<li>Inspected the subject property and its surrounding environs, noting the physical
	characteristics, condition, and any factors that may affect value.</li>
	<li>Analyzed relevant market data including comparable sales, rental data, and market
	conditions to develop an opinion of value.</li>
	<li>Reviewed applicable zoning regulations, land use restrictions, and other governmental
	regulations affecting the subject property.</li>
	<li>Analyzed the highest and best use of the subject property both as vacant and as improved.</li>
</ul>

<p>Based on the analysis of the appraisal problem, the following approaches to value have
been developed in this report:</p>
<ul>
${approachBullets}
</ul>

<p>The appraiser determined that the ${approachText}
${approachList.length === 1 ? 'is' : 'are'} applicable and necessary to produce a credible
value opinion for this assignment. Approaches not developed were considered but deemed
unnecessary or not applicable given the property type, available data, and scope of the
assignment.</p>

<p>The type and extent of research and analysis in this report are specific to the needs
of the intended user and intended use as identified herein. This report is an Appraisal
Report as defined by USPAP Standards Rule 2-2(a).</p>
`;
}
