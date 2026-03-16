import type { TemplateContext } from '../context.js';

export function render(ctx: TemplateContext): string {
	const propType = ctx.property_type ?? 'Commercial Property';
	const cityState = [ctx.city, ctx.state].filter(Boolean).join(', ');
	const reportNumber = ctx.report_number ?? '';
	const client = ctx.client_name ?? '';
	const appraiserName = ctx.appraiser.name || '[Appraiser Name]';
	const company = ctx.appraiser.company || '';

	return `
<div style="text-align: center; padding: 4em 2em;">

<p style="font-size: 1.6em; font-weight: bold; margin-bottom: 0.5em;">APPRAISAL REPORT</p>

<p style="font-size: 1.2em; font-weight: bold; margin-bottom: 0.2em;">${propType}</p>

<p style="font-size: 1.1em; margin-bottom: 0.2em;">${ctx.address}</p>
<p style="font-size: 1.1em; margin-bottom: 2em;">${cityState}${ctx.zip ? ' ' + ctx.zip : ''}</p>

${reportNumber ? `<p>Report No. <strong>${reportNumber}</strong></p>` : ''}

<p>Effective Date of Appraisal: <strong>${ctx.effective_date_formatted}</strong></p>

<p style="margin-top: 2em;">Prepared For:</p>
<p><strong>${client}</strong></p>

<p style="margin-top: 2em;">Prepared By:</p>
<p><strong>${appraiserName}</strong></p>
${company ? `<p>${company}</p>` : ''}
${ctx.appraiser.address ? `<p>${ctx.appraiser.address}</p>` : ''}
${ctx.appraiser.phone ? `<p>${ctx.appraiser.phone}</p>` : ''}

</div>
`;
}
