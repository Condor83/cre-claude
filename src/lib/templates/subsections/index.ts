// Subsection template registry — maps subsection keys to render functions
// All auto-tier subsections must have an entry here

import type { TemplateContext } from '../context.js';
import { BOILERPLATE_TEMPLATES } from './boilerplate-subsections.js';
import { DATA_PLACEHOLDER_TEMPLATES } from './data-placeholders.js';
import { render as nbhd_intro } from './nbhd-intro.js';
import { render as nbhd_geographic } from './nbhd-geographic.js';
import { render as nbhd_jurisdiction } from './nbhd-jurisdiction.js';
import { render as nbhd_life_stage } from './nbhd-life-stage.js';
import { render as nbhd_population_table } from './nbhd-population-table.js';
import { render as nbhd_population_narrative } from './nbhd-population-narrative.js';
import { render as nbhd_employment_table } from './nbhd-employment-table.js';
import { render as nbhd_employment_narrative } from './nbhd-employment-narrative.js';
import { render as nbhd_access } from './nbhd-access.js';
import { render as nbhd_dev_sfr_table } from './nbhd-dev-sfr-table.js';
import { render as nbhd_dev_sfr_narrative } from './nbhd-dev-sfr-narrative.js';
import { render as nbhd_dev_commercial_table } from './nbhd-dev-commercial-table.js';
import { render as nbhd_vacancy_industrial } from './nbhd-vacancy-industrial.js';
import { render as nbhd_vacancy_office_retail } from './nbhd-vacancy-office-retail.js';
import { render as site_dimensions } from './site-dimensions.js';
import { render as site_access } from './site-access.js';
import { render as site_topography } from './site-topography.js';
import { render as zoning_classification } from './zoning-classification.js';
import { render as improvement_general } from './improvement-general.js';
import { render as improvement_quality } from './improvement-quality.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SUBSECTION_TEMPLATES: Record<string, (ctx: TemplateContext, options?: any) => string> = {
	// ── Neighborhood ──
	nbhd_intro,
	nbhd_geographic,
	nbhd_jurisdiction,
	nbhd_life_stage,
	// Population & Employment (real data from Census/BLS)
	nbhd_population_table,
	nbhd_population_narrative,
	nbhd_employment_table,
	nbhd_employment_narrative,
	// Access & Transportation (real data from UDOT)
	nbhd_access,
	// Development Trends (Census BPS + static commercial)
	nbhd_dev_sfr_table,
	nbhd_dev_sfr_narrative,
	nbhd_dev_commercial_table,
	// Vacancy (form-based from Commerce CRG reports)
	nbhd_vacancy_industrial,
	nbhd_vacancy_office_retail,
	// Boilerplate neighborhood
	nbhd_community_facilities: BOILERPLATE_TEMPLATES.nbhd_community_facilities,
	nbhd_utilities: BOILERPLATE_TEMPLATES.nbhd_utilities,
	nbhd_conformity: BOILERPLATE_TEMPLATES.nbhd_conformity,

	// ── Site Description ──
	site_dimensions,
	site_topography,
	// Access (real data from UDOT)
	site_access,
	// Boilerplate site
	site_soil: BOILERPLATE_TEMPLATES.site_soil,
	site_utilities: BOILERPLATE_TEMPLATES.site_utilities,
	site_rail: BOILERPLATE_TEMPLATES.site_rail,
	site_easements: BOILERPLATE_TEMPLATES.site_easements,

	// ── Zoning ──
	zoning_classification,
	zoning_conforming: BOILERPLATE_TEMPLATES.zoning_conforming,

	// ── Improvement Description ──
	improvement_general,
	improvement_quality,
	improvement_ada: BOILERPLATE_TEMPLATES.improvement_ada,

	// ── Data-source placeholders (replaced when scrapers are implemented) ──
	...DATA_PLACEHOLDER_TEMPLATES
};

/**
 * Render a subsection template by key.
 * Returns null if no template exists for the key (e.g. freeform/form/image subsections).
 */
export function renderSubsection(
	key: string,
	ctx: TemplateContext,
	options?: Record<string, unknown>
): string | null {
	const renderFn = SUBSECTION_TEMPLATES[key];
	if (!renderFn) return null;
	return renderFn(ctx, options);
}

/**
 * Rebuild parent section content_html from all subsection HTMLs.
 * Concatenates in the order defined by subsection keys array.
 */
export function buildParentHtml(
	subsectionKeys: string[],
	subsectionHtmls: Record<string, string>
): string {
	return subsectionKeys
		.map(key => subsectionHtmls[key] ?? '')
		.filter(html => html.trim().length > 0)
		.join('\n\n');
}
