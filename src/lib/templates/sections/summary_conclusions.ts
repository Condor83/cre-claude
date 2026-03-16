import type { TemplateContext } from '../context.js';

function fmt(val: number | null | undefined, suffix?: string): string {
	if (val == null) return 'N/A';
	const formatted = val.toLocaleString('en-US');
	return suffix ? `${formatted} ${suffix}` : formatted;
}

export function render(ctx: TemplateContext): string {
	const rights = ctx.property_rights === 'leased fee' ? 'Leased Fee' : 'Fee Simple';
	const cityState = [ctx.city, ctx.state].filter(Boolean).join(', ');
	const approaches = ctx.approach_labels.join(', ') || 'N/A';

	const landDisplay = ctx.land_acres
		? `${ctx.land_acres.toLocaleString('en-US')} acres (${fmt(ctx.land_sf_from_acres ?? ctx.land_sf, 'SF')})`
		: fmt(ctx.land_sf, 'SF');

	return `
<p><strong>SUMMARY OF SALIENT FACTS AND CONCLUSIONS</strong></p>

<table>
<tbody>
	<tr><td><strong>Property Type</strong></td><td>${ctx.property_type ?? 'N/A'}</td></tr>
	<tr><td><strong>Address</strong></td><td>${ctx.address}</td></tr>
	<tr><td><strong>City, State</strong></td><td>${cityState}</td></tr>
	<tr><td><strong>County</strong></td><td>${ctx.county_display}</td></tr>
	<tr><td><strong>Tax Parcel Number</strong></td><td>${ctx.apn ?? 'N/A'}</td></tr>
	<tr><td><strong>Owner of Record</strong></td><td>${ctx.owner_name ?? 'N/A'}</td></tr>
	<tr><td><strong>Land Area</strong></td><td>${landDisplay}</td></tr>
	<tr><td><strong>Gross Building Area</strong></td><td>${fmt(ctx.building_sf, 'SF')}</td></tr>
	<tr><td><strong>Year Built</strong></td><td>${ctx.year_built ?? 'N/A'}</td></tr>
	<tr><td><strong>Number of Stories</strong></td><td>${ctx.stories ?? 'N/A'}</td></tr>
	<tr><td><strong>Construction Class</strong></td><td>${ctx.construction_class ?? 'N/A'}</td></tr>
	<tr><td><strong>Condition</strong></td><td>${ctx.condition ?? 'N/A'}</td></tr>
	<tr><td><strong>Zoning</strong></td><td>${ctx.zoning ?? 'N/A'}</td></tr>
	<tr><td><strong>Property Rights Appraised</strong></td><td>${rights}</td></tr>
	<tr><td><strong>Effective Date of Appraisal</strong></td><td>${ctx.effective_date_formatted}</td></tr>
	<tr><td><strong>Approaches Developed</strong></td><td>${approaches}</td></tr>
	<tr><td><strong>Value Conclusion</strong></td><td><em>TBD &mdash; See Reconciliation</em></td></tr>
</tbody>
</table>
`;
}
