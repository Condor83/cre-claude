import type { TemplateContext } from '../context.js';

export function render(ctx: TemplateContext): string {
	const rights = ctx.property_rights ?? 'fee simple';

	if (rights === 'leased fee') {
		return `
<p>The property rights appraised are the <strong>leased fee</strong> interest in the
subject property.</p>

<blockquote>
<p><em><strong>Leased Fee Interest:</strong> The ownership interest held by the landlord
(lessor), which includes the right to receive the contract rent specified in the lease
plus the reversionary right when the lease expires. The value of the leased fee interest
is determined by the present worth of the right to receive the contract rent over the
remaining lease term plus the present worth of the reversion at lease expiration.</em></p>
</blockquote>

<p>The leased fee interest is appraised subject to the existing lease or leases in place
as of the effective date of the appraisal. The existing lease terms, rental rates, and
provisions are considered in the valuation analysis.</p>
`;
	}

	return `
<p>The property rights appraised are the <strong>fee simple</strong> interest in the
subject property.</p>

<blockquote>
<p><em><strong>Fee Simple Interest:</strong> Absolute ownership unencumbered by any other
interest or estate, subject only to the limitations imposed by the governmental powers
of taxation, eminent domain, police power, and escheat. Fee simple title implies absolute
ownership, free and clear of all liens, encumbrances, easements, and encroachments, subject
only to the four powers of government.</em></p>
</blockquote>

<p>The fee simple estate is the most complete form of ownership. The subject property has
been appraised as if free and clear of all liens, encumbrances, and leases unless otherwise
stated in this report.</p>
`;
}
