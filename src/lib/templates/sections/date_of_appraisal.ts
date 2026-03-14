import type { TemplateContext } from '../context.js';

export function render(ctx: TemplateContext): string {
	const effectiveDate = ctx.effective_date_formatted;
	const appraiserName = ctx.appraiser.name || 'the appraiser';

	return `
<p>The effective date of this appraisal is <strong>${effectiveDate}</strong>.
The property was inspected by <strong>${appraiserName}</strong> on
${effectiveDate}.</p>

<p>All analyses, opinions, and conclusions contained in this report are as of the
effective date unless otherwise stated. Market conditions, property characteristics,
and other factors may change subsequent to the effective date, and such changes may
affect the opinions and conclusions expressed herein.</p>
`;
}
