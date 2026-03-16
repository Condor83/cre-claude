import type { TemplateContext } from '../context.js';

export function render(ctx: TemplateContext): string {
	const propType = ctx.property_type ?? 'commercial property';
	const city = ctx.city ?? '';
	const state = ctx.state ?? '';
	const cityState = [city, state].filter(Boolean).join(', ');

	return `
<p>The subject property represents a <strong>${propType}</strong> located at
<strong>${ctx.address}</strong>, ${cityState}${ctx.zip ? ' ' + ctx.zip : ''}.
The subject is situated in ${ctx.county_display !== 'N/A' ? ctx.county_display + ' County' : 'the local jurisdiction'}
and is identified by the ${ctx.county_display !== 'N/A' ? ctx.county_display : ''} County Recorder with tax parcel number
<strong>${ctx.apn ?? 'N/A'}</strong>.</p>

<p>A complete legal description of the subject property is contained in the deed of record
and is assumed to be correct. The property was identified and inspected as part of this
appraisal assignment.</p>
`;
}
