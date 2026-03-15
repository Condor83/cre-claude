import type { TemplateContext } from '../context.js';

export function render(ctx: TemplateContext): string {
	const a = ctx.appraiser;
	const name = a.name || 'Bradford Dyreng';
	const company = a.company || 'Dyreng Real Estate Services';
	const address = a.address || '1032 North Titan Drive, Lehi, UT 84043';

	return `
<p style="text-align:center"><strong><u>QUALIFICATIONS OF APPRAISER</u></strong></p>
<p style="text-align:center"><strong>${name}, MAI</strong></p>
<p style="text-align:center">${company}</p>
<p style="text-align:center">Real Estate Appraisers and Consultants</p>
<p style="text-align:center">${address}</p>

<p><strong><u>Education</u></strong></p>
<ul>
	<li>Utah State University, Master of Business Administration, December 2009</li>
</ul>

<p><strong><u>Real Estate and Appraisal Courses</u></strong></p>
<ul>
	<li>Basic Appraisal Principles, Appraisal Institute 02/10</li>
	<li>Basic Appraisal Procedures, Appraisal Institute 02/10</li>
	<li>15-Hour National USPAP Course 02/10</li>
	<li>Online Residential Sales Comparison and Income Approach, Appraisal Institute 03/11</li>
	<li>Residential Site Valuation and Cost Approach, Appraisal Institute 03/11</li>
	<li>Online Residential Market Analysis and Highest &amp; Best Use, Appraisal Institute 03/11</li>
	<li>Residential Report Writing and Case Studies, Appraisal Institute 05/11</li>
	<li>Business Practices and Ethics, Appraisal Institute 07/12</li>
	<li>General Appraiser Income Approach Part I, Appraisal Institute 03/14</li>
	<li>General Appraiser Income Approach Part II, Appraisal Institute 03/14</li>
	<li>General Appraiser Sales Comparison Approach, Appraisal Institute 06/14</li>
	<li>General Appraiser Site Valuation and Cost Approach, Appraisal Institute 07/14</li>
	<li>General Appraiser Market Analysis and Highest &amp; Best Use, Appraisal Institute 09/14</li>
	<li>Real Estate Finance Statistics and Valuation Modeling, Appraisal Institute 10/14</li>
	<li>General Appraisal Report Writing and Case Studies, Appraisal Institute 11/14</li>
	<li>Small Hotel/Motel Valuation, Appraisal Institute 03/15</li>
	<li>Subdivision Valuation, Appraisal Institute 03/15</li>
	<li>7-Hour Equivalent USPAP Update Course, Appraisal Institute, 05/17</li>
	<li>Analyzing Operating Expenses, Appraisal Institute 12/17</li>
	<li>Appraising Convenience Stores, Appraisal Institute 12/17</li>
	<li>Data Verification Methods, Appraisal Institute 12/17</li>
	<li>Advanced Income Capitalization, Appraisal Institute 02/18</li>
	<li>Advanced Market Analysis and Highest &amp; Best Use, Appraisal Institute 04/18</li>
	<li>Quantitative Analysis 10/2019</li>
	<li>Advanced Concepts and Case Studies 11/2019</li>
</ul>

<p><strong><u>Work History</u></strong></p>
<ul>
	<li>Real Estate Appraiser/Consultant, Nielsen and Company, Orem, Utah — March 2010 to February 2020</li>
	<li>Real Estate Appraiser/Consultant, Dyreng Real Estate Services, Draper, Utah — March 2020 to Present</li>
</ul>

<p><strong><u>Professional Accomplishments</u></strong></p>
<ul>
	<li>Certified General Appraiser - State of Utah - License # 6168334-CG - Expires 11/30/2027</li>
	<li>Member of the Appraisal Institute - Member ID #539222</li>
	<li>MAI Designation - Appraisal Institute - February 2024</li>
</ul>

<p><strong><u>Appraisal Experience</u></strong></p>
<ul>
	<li>Apartment Project: 12 to 120 unit projects.</li>
	<li>Eminent Domain: Road widening, wetlands mitigation, utility corridors, and airport expansion.</li>
	<li>Hotel/Motel: Hotels and motels ranging from 40 to 120 rooms with convention facilities.</li>
	<li>Industrial: Office/warehouse and manufacturing facilities up to 4,000,000 square feet.</li>
	<li>Office Building: Single and multi-tenant facilities ranging from 1,000 to 200,000 square feet.</li>
	<li>Assisted Living: Various care levels ranging from 8 to 85 wards.</li>
	<li>Townhome and Condo projects: Single and multi-phase projects ranging from 10 to 120 units.</li>
	<li>Retail: Neighborhood and community centers.</li>
	<li>Raw Land: Land ranging from 10 to 1,000 acres.</li>
	<li>Subdivisions: Single and multi-phase projects ranging from 4 to 200 lots.</li>
	<li>Recreational Properties.</li>
</ul>

<p><strong><u>Partial List of Clients Served</u></strong></p>
<table>
<tbody>
	<tr><td>Zions First National Bank</td><td>Utah Department of Transportation</td></tr>
	<tr><td>First Security Bank</td><td>Lehi City</td></tr>
	<tr><td>Western Bank</td><td>American Fork City</td></tr>
	<tr><td>Washington Mutual Bank</td><td>Provo City</td></tr>
	<tr><td>U.S. Bank</td><td>Orem City</td></tr>
	<tr><td>Bank of American Fork</td><td>Utah County</td></tr>
	<tr><td>Central Bank</td><td>Springville City</td></tr>
	<tr><td>Far West Bank</td><td>Various attorneys</td></tr>
	<tr><td>Brighton Bank</td><td>Alpine School District</td></tr>
	<tr><td>Holladay Bank and Trust</td><td>Credit Bureaus</td></tr>
	<tr><td>Orem Community Bank</td><td>Various developers and contractors</td></tr>
	<tr><td>Banc One</td><td>Grand County</td></tr>
	<tr><td>Capital Community Bank</td><td>LDS Church</td></tr>
	<tr><td>American Investment Financial</td><td>Versar Engineering</td></tr>
	<tr><td>First National Bank</td><td>Horricks Engineering</td></tr>
	<tr><td>National Bank of Arizona</td><td>RBG Engineering</td></tr>
	<tr><td>Frontier State Bank</td><td>Celtic Bank</td></tr>
	<tr><td>Wells Fargo Bank</td><td>Silver State Bank</td></tr>
	<tr><td>GE Capital Asset Funding</td><td>Prudential Mortgage Capital</td></tr>
	<tr><td>Merrill Lynch Mortgage Capital Inc.</td><td>GMAC Capital Funding</td></tr>
	<tr><td>National Mortgage Company</td><td>SkyMar Capital Funding</td></tr>
	<tr><td>California Bank and Trust</td><td>Mountain America Credit Union</td></tr>
	<tr><td>Bank of Utah</td><td>M &amp; T Mortgage</td></tr>
</tbody>
</table>
`;
}
