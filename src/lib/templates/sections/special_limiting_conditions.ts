import type { TemplateContext } from '../context.js';

export function render(_ctx: TemplateContext): string {
	return `
<ol>
	<li>The liability of ${_ctx.appraiser.company || 'the appraiser'} is limited to the client only and to the fee actually
	received by appraiser. Further, there is no accountability, obligation, or liability to any third
	party. If this report is placed in the hands of anyone other than client, the client shall make
	such party aware of all limiting conditions and assumptions of the assignment and related
	discussions. The appraiser is in no way to be responsible for any costs incurred to discover or
	correct any deficiencies of any type present in the property; physically, financially, and/or
	legally. In the case of limited partnerships or syndication offerings or stock offerings in real
	estate, client agrees that in case of lawsuit (brought by lender, partner or part owner in any
	form of ownership, tenant, or any other party), any and all awards, settlements of any type in
	such suit, regardless of outcome, client will hold appraiser completely harmless in any such
	action.</li>

	<li>The existence of potentially hazardous material on or near the subject site and/or used in
	the construction or maintenance of any of the buildings, such as the presence of
	urea-formaldehyde foam insulation, and/or the existence of toxic waste, which may or may not
	be present on the property, was not observed by myself, nor do I have any knowledge of the
	existence of such materials on or in the property. The appraiser, however, is not qualified to
	detect such substances. The existence of urea-formaldehyde foam insulation or other
	potentially hazardous waste material may have an effect on the value of the property. I urge
	the client to retain an expert in this field if desired.</li>

	<li>If there is proposed construction, the appraisal is made subject to satisfactory completion
	of construction according to architectural plans.</li>
</ol>
`;
}
