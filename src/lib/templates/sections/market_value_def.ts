import type { TemplateContext } from '../context.js';

export function render(_ctx: TemplateContext): string {
	return `
<p>The following definition of market value is used in this report, as set forth in the
Federal Register by the regulatory agencies of financial institutions
(OCC, OTS, FDIC, and NCUA) under 12 CFR Part 34.42(g); 12 CFR Part 564.2(g);
12 CFR Part 323.2(g); and 12 CFR Part 722.2(f):</p>

<blockquote>
<p><em>The most probable price which a property should bring in a competitive and open market
under all conditions requisite to a fair sale, the buyer and seller each acting prudently
and knowledgeably, and assuming the price is not affected by undue stimulus. Implicit in
this definition are the consummation of a sale as of a specified date and the passing of
title from seller to buyer under conditions whereby:</em></p>
<ol>
	<li><em>Buyer and seller are typically motivated;</em></li>
	<li><em>Both parties are well informed or well advised, and acting in what they consider
	their own best interests;</em></li>
	<li><em>A reasonable time is allowed for exposure in the open market;</em></li>
	<li><em>Payment is made in terms of cash in U.S. dollars or in terms of financial arrangements
	comparable thereto; and</em></li>
	<li><em>The price represents the normal consideration for the property sold unaffected by
	special or creative financing or sales concessions granted by anyone associated with
	the sale.</em></li>
</ol>
</blockquote>
`;
}
