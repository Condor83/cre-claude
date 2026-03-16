import type { TemplateContext } from '../context.js';

export function render(_ctx: TemplateContext): string {
	return `
<p>The value opinion reported herein is the <strong>"As Is" Market Value</strong> of the
subject property. The following definition is used in this report:</p>

<blockquote>
<p><em>The estimate of the market value of real property in its current physical condition,
use, and zoning as of the appraisal date. An "As Is" value opinion may reflect a
property that is vacant or improved, reflects all physical, legal, and economic
conditions of the property, including environmental contamination and conditions of
title, and is based on what a buyer and seller would agree upon in an arm's length
transaction as of the effective date of the appraisal, given all conditions that exist
as of that date.</em></p>
</blockquote>

<p>The "As Is" value takes into account the actual physical condition and use of the
property as of the effective date of the appraisal, including all benefits and detriments
of the property characteristics as they exist on that date.</p>
`;
}
