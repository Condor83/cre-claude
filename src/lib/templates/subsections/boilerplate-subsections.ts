// Boilerplate subsection templates — simple text with variable insertion
// All templates follow: (ctx: SubsectionContext) => string
// Grouped here because each is 1-5 sentences of standardized language

import type { TemplateContext } from '../context.js';
import { str } from './helpers.js';

type SubsectionRenderer = (ctx: TemplateContext) => string;

export const BOILERPLATE_TEMPLATES: Record<string, SubsectionRenderer> = {

	// ── Neighborhood ──

	nbhd_community_facilities(ctx) {
		const city = str(ctx.city, 'the subject city');
		return `<p>${city} is served by a full range of community facilities including public schools,
parks and recreation areas, churches, shopping centers, medical facilities, and municipal services
including police and fire protection. The Utah County Library system provides branch libraries
throughout the county. Major medical services are available at Utah Valley Hospital and
Mountain View Hospital in Payson, Provo, and surrounding communities.</p>`;
	},

	nbhd_utilities(ctx) {
		const city = str(ctx.city, 'the subject city');
		return `<p>All public utilities are available to the subject neighborhood including electricity
(Rocky Mountain Power), natural gas (Dominion Energy), culinary water (${city} municipal),
sewer (${city} municipal), and telecommunications (multiple providers including fiber optic
service). Storm drainage is provided by the municipal storm water system.</p>`;
	},

	nbhd_conformity(ctx) {
		return `<p>The subject property is considered to be in general conformity with the surrounding
development in terms of size, age, quality, and use. The improvements are typical of the
neighborhood and contribute positively to the area. No significant over-improvements or
under-improvements were observed in the immediate vicinity.</p>`;
	},

	// ── Site Description ──

	site_soil(ctx) {
		return `<p>No soil analysis or geological survey was provided for this appraisal. Based on
visual observation during the site inspection, the soil and subsoil conditions appear adequate
to support the existing improvements. The appraiser is not qualified to detect the existence
of potentially hazardous material or underground storage tanks. Any comment by the appraiser
regarding these conditions is strictly informational. The value conclusion is predicated on the
assumption that no such conditions exist.</p>`;
	},

	site_utilities(ctx) {
		const city = str(ctx.city, 'the subject municipality');
		return `<p>The subject site is served by all necessary public utilities including:</p>
<ul>
<li><strong>Water:</strong> ${city} municipal culinary water system</li>
<li><strong>Sewer:</strong> ${city} municipal sanitary sewer system</li>
<li><strong>Electricity:</strong> Rocky Mountain Power</li>
<li><strong>Natural Gas:</strong> Dominion Energy</li>
<li><strong>Telephone/Internet:</strong> Multiple providers available</li>
<li><strong>Storm Drainage:</strong> Municipal storm water system</li>
</ul>
<p>All utilities are considered adequate for the current use and foreseeable future uses of the property.</p>`;
	},

	site_rail(ctx) {
		return `<p>Rail service is not available to the subject property. The nearest rail access is via
the Union Pacific Railroad mainline, which runs through the region. Rail service is not
considered necessary for the current or most probable use of the subject property.</p>`;
	},

	site_easements(ctx) {
		return `<p>A current title report was not provided for this appraisal. The appraiser assumes
there are no adverse easements, encroachments, or other title defects that would affect the
marketability or value of the subject property beyond those that are typical and customary
for properties of this type in the subject market area. Standard utility easements are assumed
to exist along property boundaries and public rights-of-way.</p>`;
	},

	// ── Zoning ──

	zoning_conforming(ctx) {
		const zoning = str(ctx.zoning, 'the applicable zone');
		return `<p>Based on our review of the applicable zoning ordinance, the subject property appears
to be a legal, conforming use within the ${zoning} zone. The existing improvements are
consistent with the permitted uses and development standards of the zone. No non-conforming
conditions were identified during the course of this appraisal. The appraiser makes no
guarantees regarding zoning compliance and recommends verification with the local
planning department.</p>`;
	},

	// ── Improvement Description ──

	improvement_ada(ctx) {
		return `<p>The Americans with Disabilities Act (ADA) became effective January 26, 1992. The
appraiser has not made a specific compliance survey or analysis of the property to determine
whether it is in conformity with the various detailed requirements of the ADA. It is possible
that a compliance survey of the property, together with a detailed analysis of the ADA
requirements, could reveal that the property is not in compliance with one or more requirements
of the Act. If so, this fact could have a negative effect on the value of the property.
Since the appraiser has no direct evidence relating to this issue, possible non-compliance
with the requirements of ADA was not considered in estimating the value of the property.</p>`;
	}
};
