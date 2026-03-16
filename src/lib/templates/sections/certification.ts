import type { TemplateContext } from '../context.js';

export function render(ctx: TemplateContext): string {
	const name = ctx.appraiser.name || '[Appraiser Name]';
	const certType = ctx.appraiser.certification_type || 'Certified General Appraiser';
	const licNum = ctx.appraiser.license_number || '[License Number]';
	const licState = ctx.appraiser.license_state || 'UT';

	return `
<p>I certify that, to the best of my knowledge and belief:</p>

<ol>
	<li>The statements of fact contained in this report are true and correct.</li>

	<li>The reported analyses, opinions, and conclusions are limited only by the reported
	assumptions and limiting conditions, and are my personal, impartial, and unbiased
	professional analyses, opinions, and conclusions.</li>

	<li>I have no present or prospective interest in the property that is the subject of
	this report and no personal interest with respect to the parties involved.</li>

	<li>I have performed no services, as an appraiser or in any other capacity, regarding
	the property that is the subject of this report within the three-year period immediately
	preceding acceptance of this assignment.</li>

	<li>I have no bias with respect to the property that is the subject of this report or
	to the parties involved with this assignment.</li>

	<li>My engagement in this assignment was not contingent upon developing or reporting
	predetermined results.</li>

	<li>My compensation for completing this assignment is not contingent upon the development
	or reporting of a predetermined value or direction in value that favors the cause of
	the client, the amount of the value opinion, the attainment of a stipulated result,
	or the occurrence of a subsequent event directly related to the intended use of this
	appraisal.</li>

	<li>My analyses, opinions, and conclusions were developed, and this report has been
	prepared, in conformity with the Uniform Standards of Professional Appraisal Practice
	(USPAP).</li>

	<li>I have made a personal inspection of the property that is the subject of this report.</li>

	<li>No one provided significant real property appraisal assistance to the person signing
	this certification, unless otherwise indicated herein.</li>

	<li>The reported analyses, opinions, and conclusions were developed, and this report
	has been prepared, in conformity with the requirements of the Code of Professional
	Ethics and Standards of Professional Appraisal Practice of the Appraisal Institute.</li>

	<li>The use of this report is subject to the requirements of the Appraisal Institute
	relating to review by its duly authorized representatives.</li>

	<li>As of the date of this report, I have completed the continuing education program
	for licensed and certified appraisers in the state of ${licState}.</li>

	<li>The value opinion reported herein is stated in terms of United States dollars as
	of the effective date of this appraisal.</li>

	<li>I have the knowledge and experience to complete this assignment competently, and
	the appraisal assignment was not made in violation of any applicable laws or
	regulations.</li>
</ol>

<p style="margin-top: 2em;">
<strong>${name}</strong><br>
${certType}<br>
License No. ${licNum}, State of ${licState}
</p>
`;
}
