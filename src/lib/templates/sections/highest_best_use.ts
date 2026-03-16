import type { TemplateContext } from '../context.js';

export function render(_ctx: TemplateContext): string {
	return `
<p>Real estate is typically valued in terms of its highest and best use. Highest and best use is
defined in <em>The Appraisal of Real Estate</em> as:</p>

<p><em>"The reasonably probable and legal use of vacant land or an improved property, which is
physically possible, appropriately supported, financially feasible, and that results in the
highest value."</em></p>

<p>In estimation of the highest and best use, the appraiser must consider these four basic stages
of analysis for proposed uses:</p>

<ol>
	<li><strong>Legally permissible uses.</strong> Are there zoning or deed restrictions that would prohibit
	proposed uses?</li>
	<li><strong>Physically possible uses.</strong> From the permissible uses, which are physically possible when
	considering all aspects of the site size, shape, and topography or any other physical
	aspects?</li>
	<li><strong>Financially feasible uses.</strong> Which of the above legally permissible and possible uses will
	produce a net return to the owner of the site?</li>
	<li><strong>Maximally productive or highest and best use.</strong> After analyzing the above considerations,
	which of the proposed uses will produce or generate the highest rate of net return over
	a projected period of time?</li>
</ol>

<p>In determining the highest and best use of the subject property, the land is considered under
two classifications. The first type is the highest and best use as though vacant; the second is the
highest and best use as improved. Each type requires a separate discussion and analysis.</p>
`;
}
