import type { TemplateContext } from '../context.js';

export function render(_ctx: TemplateContext): string {
	return `
<p>This appraisal is made subject to the following general assumptions:</p>

<ol>
	<li>The title to the property is assumed to be marketable and free and clear of all
	liens and encumbrances, easements, and restrictions, except as specifically discussed
	in this report.</li>

	<li>The property is appraised as though under responsible ownership and competent
	management, neither combative nor combative, and available for its highest and best
	use.</li>

	<li>All engineering studies are assumed to be correct. The plot plans and illustrative
	material in this report are included only to assist the reader in visualizing the
	property.</li>

	<li>It is assumed that there are no hidden or unapparent conditions of the property,
	subsoil, or structures that render it more or less valuable. No responsibility is
	assumed for such conditions or for obtaining the engineering studies that may be
	required to discover them.</li>

	<li>It is assumed that the property is in full compliance with all applicable federal,
	state, and local environmental regulations and laws unless the lack of compliance is
	stated, described, and considered in this report.</li>

	<li>It is assumed that the property conforms to all applicable zoning and use regulations
	and restrictions unless a nonconformity has been identified, described, and considered
	in this report.</li>

	<li>It is assumed that all required licenses, certificates of occupancy, consents, and
	other legislative or administrative authority from any local, state, or national
	government or private entity or organization have been or can be obtained or renewed
	for any use on which the value opinion contained in this report is based.</li>

	<li>It is assumed that the utilization of the land and improvements is within the
	boundaries or property lines of the property described, and that there is no
	encroachment or trespass unless noted in this report.</li>

	<li>Unless otherwise stated in this report, the existence of hazardous materials, which
	may or may not be present on the property, was not observed by the appraiser. The
	appraiser has no knowledge of the existence of such materials on or in the property.
	The appraiser is not qualified to detect such substances. The value estimate is
	predicated on the assumption that there is no such material on or in the property
	that would cause a loss in value.</li>

	<li>Any allocation of the total value estimated in this report between the land and
	the improvements applies only under the stated program of utilization. The separate
	values allocated to the land and buildings must not be used in conjunction with any
	other appraisal and are invalid if so used.</li>

	<li>Possession of this report, or a copy thereof, does not carry with it the right of
	publication. It may not be used for any purpose by any person other than the party
	to whom it is addressed without the written consent of the appraiser, and in any
	event, only with proper written qualification and only in its entirety.</li>

	<li>The Americans with Disabilities Act (ADA) became effective January 26, 1992. The
	appraiser has not made a specific survey or analysis of the property to determine
	whether the physical aspects of the improvements meet the ADA accessibility guidelines.
	It is assumed that the property is in compliance with ADA requirements unless otherwise
	noted in this report.</li>
</ol>
`;
}
