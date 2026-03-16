import type { TemplateContext } from '../context.js';

export function render(ctx: TemplateContext): string {
	return `
<p>The date of this report is <strong>${ctx.report_date_formatted}</strong>.</p>

<p>The date of this report represents the date the appraiser concluded the analysis
and prepared this appraisal report. Market conditions and data available as of this date
were considered in the development of this appraisal.</p>
`;
}
