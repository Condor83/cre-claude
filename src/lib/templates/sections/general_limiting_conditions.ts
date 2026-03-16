import type { TemplateContext } from '../context.js';

export function render(_ctx: TemplateContext): string {
	return `
<p>This appraisal is made subject to the following general limiting conditions:</p>

<ol>
	<li>The appraiser will not be required to give testimony or appear in court because of
	having made this appraisal, with reference to the property in question, unless
	arrangements have been previously made.</li>

	<li>The distribution, if any, of the total valuation in this report between land and
	improvements applies only under the stated program of utilization. The separate
	valuations for land and buildings must not be used in conjunction with any other
	appraisal and are invalid if so used.</li>

	<li>The appraiser assumes no responsibility for matters legal in nature. No opinion is
	rendered as to title, which is assumed to be good. The property is appraised on the
	basis of it being under responsible ownership.</li>

	<li>The appraiser has not made any survey of the property and assumes no responsibility
	in connection with such matters. Any sketch or survey in this report is for illustrative
	purposes only and should not be considered as a survey or relied upon for any other
	purpose.</li>

	<li>Information, estimates, and opinions furnished to the appraiser and contained in
	this report were obtained from sources considered reliable and believed to be true and
	correct. However, no responsibility for accuracy of such items furnished the appraiser
	can be assumed by the appraiser.</li>

	<li>Disclosure of the contents of this appraisal report is governed by the Bylaws and
	Regulations of the Appraisal Institute. Neither all nor any part of the contents of
	this report shall be disseminated to the public through advertising media, public
	relations media, news media, or any other public means of communication without the
	prior written consent and approval of the appraiser.</li>

	<li>No responsibility is assumed for any changes in economic conditions and no obligation
	is assumed to revise this report to reflect events or conditions that occur subsequent
	to the date of the appraisal.</li>

	<li>Any value opinions provided in this report apply to the entire property, and any
	proration or division of the total into fractional interests will invalidate the value
	opinion, unless such proration or division of interests has been set forth in this
	report.</li>

	<li>The appraiser is not required to give further consultation, provide testimony, or
	attend court with reference to the property in question unless arrangements have been
	previously made.</li>

	<li>This appraisal has been made in conformance with and is subject to the requirements
	of the Code of Professional Ethics and Standards of Professional Appraisal Practice of
	the Appraisal Institute. The use of this report is subject to the requirements of the
	Appraisal Institute relating to review by its duly authorized representatives.</li>
</ol>
`;
}
