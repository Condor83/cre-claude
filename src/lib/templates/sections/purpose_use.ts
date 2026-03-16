import type { TemplateContext } from '../context.js';

export function render(ctx: TemplateContext): string {
	const intendedUse = ctx.intended_use ?? 'estimate the market value';
	const rights = ctx.property_rights === 'leased fee' ? 'leased fee' : 'fee simple';
	const client = ctx.client_name ?? 'the client';

	return `
<p>The purpose of this appraisal is to <strong>${intendedUse}</strong> of the
<strong>${rights}</strong> interest in the subject property, as of the effective date
of the appraisal. The value opinion developed herein is market value as defined within
this report.</p>

<p>The intended use of this appraisal is for <strong>${client}</strong> in connection
with the evaluation of the subject property. This report is not intended for any other
use or by any other user. Use of this report by others is not intended by the appraiser.</p>

<p>The client and intended user of this appraisal is <strong>${client}</strong>.
No other intended users are identified. This appraisal is not intended for use by any
party other than the identified intended user.</p>
`;
}
