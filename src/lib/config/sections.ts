// Section configuration: ~35 sections across 5 groups with tier-based rendering

export type SectionTier = 'auto' | 'guided' | 'prose' | 'images' | 'upload' | 'comps';

export type SectionGroup =
	| 'front_matter'
	| 'identification_scope'
	| 'factual_descriptions'
	| 'valuation'
	| 'addendum';

export type SectionStatus = 'empty' | 'auto_generated' | 'in_progress' | 'reviewed';

export interface SectionDef {
	key: string;
	label: string;
	group: SectionGroup;
	tier: SectionTier;
	approaches: ('always' | 'sales_comparison' | 'income_cap' | 'cost')[];
	docxOnly?: boolean;
	comp_type?: 'sale' | 'lease';
}

export const GROUP_LABELS: Record<SectionGroup, string> = {
	front_matter: 'Front Matter',
	identification_scope: 'Identification & Scope',
	factual_descriptions: 'Factual Descriptions',
	valuation: 'Valuation',
	addendum: 'Addendum'
};

export const GROUP_ORDER: SectionGroup[] = [
	'front_matter',
	'identification_scope',
	'factual_descriptions',
	'valuation',
	'addendum'
];

export const ALL_SECTIONS: SectionDef[] = [
	// ── Group 1: Front Matter ──
	{ key: 'title_page', label: 'Title Page', group: 'front_matter', tier: 'auto', approaches: ['always'] },
	{ key: 'transmittal', label: 'Letter of Transmittal', group: 'front_matter', tier: 'guided', approaches: ['always'] },
	{ key: 'summary_conclusions', label: 'Summary of Important Conclusions', group: 'front_matter', tier: 'auto', approaches: ['always'] },
	{ key: 'table_of_contents', label: 'Table of Contents', group: 'front_matter', tier: 'auto', approaches: ['always'], docxOnly: true },

	// ── Group 2: Identification & Scope ──
	{ key: 'identification', label: 'Identification of the Property', group: 'identification_scope', tier: 'auto', approaches: ['always'] },
	{ key: 'purpose_use', label: 'Purpose & Intended Use', group: 'identification_scope', tier: 'auto', approaches: ['always'] },
	{ key: 'scope_of_work', label: 'Scope of Work', group: 'identification_scope', tier: 'auto', approaches: ['always'] },
	{ key: 'market_value_def', label: 'Definition of Market Value', group: 'identification_scope', tier: 'auto', approaches: ['always'] },
	{ key: 'as_is_def', label: '"As Is" Market Value Definition', group: 'identification_scope', tier: 'auto', approaches: ['always'] },
	{ key: 'property_rights', label: 'Property Rights Appraised', group: 'identification_scope', tier: 'auto', approaches: ['always'] },
	{ key: 'date_of_appraisal', label: 'Date of Appraisal', group: 'identification_scope', tier: 'auto', approaches: ['always'] },
	{ key: 'report_completion_date', label: 'Date of Report', group: 'identification_scope', tier: 'auto', approaches: ['always'] },
	{ key: 'statement_of_ownership', label: 'Statement of Ownership', group: 'identification_scope', tier: 'auto', approaches: ['always'] },
	{ key: 'history_of_property', label: 'History of the Property', group: 'identification_scope', tier: 'prose', approaches: ['always'] },

	// ── Group 3: Factual Descriptions ──
	{ key: 'neighborhood', label: 'Neighborhood Description', group: 'factual_descriptions', tier: 'guided', approaches: ['always'] },
	{ key: 'site_description', label: 'Site Description', group: 'factual_descriptions', tier: 'guided', approaches: ['always'] },
	{ key: 'zoning', label: 'Zoning', group: 'factual_descriptions', tier: 'guided', approaches: ['always'] },
	{ key: 'improvement_description', label: 'Improvement Description', group: 'factual_descriptions', tier: 'guided', approaches: ['always'] },
	{ key: 'assessment_taxes', label: 'Assessment & Taxes', group: 'factual_descriptions', tier: 'auto', approaches: ['always'] },

	// ── Group 4: Valuation ──
	{ key: 'highest_best_use', label: 'Highest & Best Use', group: 'valuation', tier: 'auto', approaches: ['always'] },
	{ key: 'highest_best_use_analysis', label: 'Highest & Best Use Analysis', group: 'valuation', tier: 'prose', approaches: ['always'] },
	{ key: 'valuation_process', label: 'Valuation Process', group: 'valuation', tier: 'auto', approaches: ['always'] },
	{ key: 'sales_comparison', label: 'Sales Comparison Approach', group: 'valuation', tier: 'comps', comp_type: 'sale', approaches: ['sales_comparison'] },
	{ key: 'income_approach', label: 'Income Capitalization Approach', group: 'valuation', tier: 'comps', comp_type: 'lease', approaches: ['income_cap'] },
	{ key: 'cost_approach', label: 'Cost Approach', group: 'valuation', tier: 'prose', approaches: ['cost'] },
	{ key: 'reconciliation', label: 'Reconciliation', group: 'valuation', tier: 'prose', approaches: ['always'] },
	{ key: 'certification', label: 'Certification', group: 'valuation', tier: 'auto', approaches: ['always'] },
	{ key: 'general_assumptions', label: 'General Assumptions', group: 'valuation', tier: 'auto', approaches: ['always'] },
	{ key: 'general_limiting_conditions', label: 'General Limiting Conditions', group: 'valuation', tier: 'auto', approaches: ['always'] },
	{ key: 'special_limiting_conditions', label: 'Special Limiting Conditions', group: 'valuation', tier: 'auto', approaches: ['always'] },
	{ key: 'photographs', label: 'Subject Photographs', group: 'valuation', tier: 'images', approaches: ['always'] },
	{ key: 'appraiser_qualifications', label: 'Appraiser Qualifications', group: 'valuation', tier: 'auto', approaches: ['always'] },

	// ── Group 5: Addendum ──
	{ key: 'definitions_glossary', label: 'Definitions & Glossary', group: 'addendum', tier: 'auto', approaches: ['always'] },
	{ key: 'economic_snapshot', label: 'Economic Snapshot', group: 'addendum', tier: 'upload', approaches: ['always'] },
	{ key: 'zoning_ordinance', label: 'Zoning Ordinance', group: 'addendum', tier: 'upload', approaches: ['always'] },
	{ key: 'lease_agreement', label: 'Lease Agreement(s)', group: 'addendum', tier: 'upload', approaches: ['income_cap'] },
	{ key: 'flood_map', label: 'Flood Map', group: 'addendum', tier: 'upload', approaches: ['always'] },
	{ key: 'legal_description', label: 'Legal Description', group: 'addendum', tier: 'upload', approaches: ['always'] }
];

// ── GUIDED section subsection configs ──
// Each GUIDED section has an ordered list of subsections that define its structure
// 4 tiers only: auto (template + variable insertion), freeform (Brad edits), form (structured fields), image

export type SubsectionTier = 'auto' | 'freeform' | 'form' | 'image';

export interface SubsectionDef {
	key: string;
	label: string;
	tier: SubsectionTier;
	placeholder?: string;
	dataSource?: string; // e.g. 'utah_dws', 'bebr', 'udot' — triggers refresh UI on auto subsections
	requiresOnsite?: boolean; // true if Brad must inspect in person
}

// Backward compat alias
export type SubsectionType = SubsectionTier;

export const GUIDED_SUBSECTIONS: Record<string, SubsectionDef[]> = {
	transmittal: [
		{ key: 'header', label: 'Letter Header', tier: 'auto' },
		{ key: 'property_summary', label: 'Property Summary', tier: 'freeform', placeholder: 'Describe the property and assignment...' },
		{ key: 'special_conditions', label: 'Special Conditions', tier: 'freeform', placeholder: 'Note any special conditions or assumptions...' },
		{ key: 'closing', label: 'Closing', tier: 'auto' }
	],
	neighborhood: [
		// Intro & Location (pp. 5-6)
		{ key: 'nbhd_intro', label: 'Intro / Definition', tier: 'auto' },
		{ key: 'nbhd_geographic', label: 'Geographic Location', tier: 'auto' },
		{ key: 'nbhd_map', label: 'Neighborhood Map', tier: 'image' },
		{ key: 'nbhd_aerial', label: 'Aerial View', tier: 'image' },
		// Population & Employment (pp. 7-9)
		{ key: 'nbhd_population_table', label: 'Population Table', tier: 'auto', dataSource: 'utah_dws' },
		{ key: 'nbhd_population_narrative', label: 'Population Narrative', tier: 'auto', dataSource: 'utah_dws' },
		{ key: 'nbhd_employment_table', label: 'Employment Table', tier: 'auto', dataSource: 'utah_dws' },
		{ key: 'nbhd_employment_narrative', label: 'Employment Narrative', tier: 'auto', dataSource: 'utah_dws' },
		// Jurisdiction & Land Use (pp. 9-10)
		{ key: 'nbhd_jurisdiction', label: 'Jurisdiction & Proximity', tier: 'auto' },
		{ key: 'nbhd_boundaries', label: 'Boundaries & Land Use', tier: 'freeform', requiresOnsite: true, placeholder: 'Describe neighborhood boundaries and predominant land uses...' },
		{ key: 'nbhd_built_up', label: 'Percent Built-Up', tier: 'freeform', requiresOnsite: true, placeholder: 'Estimated percent built-up and growth rate...' },
		{ key: 'nbhd_immediate', label: 'Immediate Neighborhood', tier: 'freeform', requiresOnsite: true, placeholder: 'Describe immediately surrounding properties and uses...' },
		// Access & Transportation (p. 11)
		{ key: 'nbhd_access', label: 'Access & Transportation', tier: 'auto', dataSource: 'udot' },
		// Development Trends (pp. 11-14)
		{ key: 'nbhd_dev_sfr_table', label: 'Dev Trends — SFR Table', tier: 'auto', dataSource: 'bebr' },
		{ key: 'nbhd_dev_sfr_narrative', label: 'Dev Trends — SFR Narrative', tier: 'auto', dataSource: 'bebr' },
		{ key: 'nbhd_dev_multifamily', label: 'Dev Trends — Multi-Family', tier: 'freeform', placeholder: 'Describe multi-family development activity...' },
		{ key: 'nbhd_dev_commercial_table', label: 'Dev Trends — Commercial Table', tier: 'auto', dataSource: 'bebr' },
		// Vacancy (pp. 14-15)
		{ key: 'nbhd_vacancy_industrial', label: 'Vacancy — Industrial', tier: 'auto', dataSource: 'commerce_crg' },
		{ key: 'nbhd_vacancy_office_retail', label: 'Vacancy — Office & Retail', tier: 'auto', dataSource: 'commerce_crg' },
		// Neighborhood Character (pp. 15-17)
		{ key: 'nbhd_influences', label: 'Positive / Negative Influences', tier: 'freeform', requiresOnsite: true, placeholder: 'List positive and negative influences on the neighborhood...' },
		{ key: 'nbhd_community_facilities', label: 'Community Facilities', tier: 'auto' },
		{ key: 'nbhd_utilities', label: 'Public Utilities', tier: 'auto' },
		{ key: 'nbhd_nuisances', label: 'Nuisances & Hazards', tier: 'freeform', requiresOnsite: true, placeholder: 'Describe any nuisances, hazards, or adverse conditions...' },
		{ key: 'nbhd_conformity', label: 'Conformity of Development', tier: 'auto' },
		{ key: 'nbhd_life_stage', label: 'Neighborhood Life Stage', tier: 'form' },
		{ key: 'nbhd_conclusion', label: 'Neighborhood Conclusion', tier: 'freeform', placeholder: 'Summarize neighborhood influences on value and marketability...' }
	],
	site_description: [
		// Physical (pp. 18-19)
		{ key: 'site_dimensions', label: 'Dimensions, Shape, Area', tier: 'auto' },
		{ key: 'site_topography', label: 'Topography & Drainage', tier: 'auto' },
		{ key: 'site_soil', label: 'Soil & Subsoil', tier: 'auto' },
		// Maps (p. 19)
		{ key: 'site_plat_map', label: 'Plat Map', tier: 'image' },
		{ key: 'site_plan', label: 'Site Plan', tier: 'image' },
		// Access & Infrastructure (pp. 19-20)
		{ key: 'site_access', label: 'Access & Street Improvements', tier: 'auto', dataSource: 'udot' },
		{ key: 'site_utilities', label: 'Utilities', tier: 'auto' },
		// Observations (p. 20)
		{ key: 'site_onsite', label: 'On-Site Improvements', tier: 'freeform', requiresOnsite: true, placeholder: 'Describe parking, landscaping, exterior improvements...' },
		{ key: 'site_influences', label: 'Positive / Negative Influences', tier: 'freeform', placeholder: 'Describe site-specific positive and negative influences...' },
		{ key: 'site_building_location', label: 'Building Improvement Location', tier: 'freeform', requiresOnsite: true, placeholder: 'Describe building placement and orientation on site...' },
		{ key: 'site_rail', label: 'Rail Service', tier: 'auto' },
		{ key: 'site_easements', label: 'Easements', tier: 'auto' }
	],
	zoning: [
		{ key: 'zoning_classification', label: 'Classification', tier: 'auto' },
		{ key: 'zoning_standards', label: 'Development Standards', tier: 'form' },
		{ key: 'zoning_conforming', label: 'Conforming Use', tier: 'auto' },
		{ key: 'zoning_map', label: 'Zoning Map', tier: 'image' }
	],
	improvement_description: [
		{ key: 'improvement_general', label: 'General Description', tier: 'auto' },
		{ key: 'improvement_units', label: 'Unit Breakdown Table', tier: 'form', requiresOnsite: true },
		{ key: 'improvement_retail_detail', label: 'Retail / Office Area Detail', tier: 'freeform', requiresOnsite: true, placeholder: 'Describe retail/office areas, finishes, and layout...' },
		{ key: 'improvement_warehouse_detail', label: 'Warehouse / Shop Area Detail', tier: 'freeform', requiresOnsite: true, placeholder: 'Describe warehouse/shop areas, clear heights, loading...' },
		{ key: 'improvement_quality', label: 'Quality / Condition / Effective Age', tier: 'auto' },
		{ key: 'improvement_ada', label: 'ADA Compliance', tier: 'auto' },
		{ key: 'improvement_floor_plans', label: 'Floor Plans / Elevations', tier: 'image' }
	]
};

// ── COMP section subsection templates ──
// Each comp rendered under a tier='comps' section gets these subsections
export const COMP_SUBSECTIONS: SubsectionDef[] = [
	{ key: 'comp_desc', label: 'Property Description', tier: 'auto' },
	{ key: 'comp_photo', label: 'Photo', tier: 'image' },
	{ key: 'comp_sale', label: 'Sale Summary', tier: 'form' },
	{ key: 'comp_rationale', label: 'Adjustment Rationale', tier: 'freeform', placeholder: 'Describe adjustments applied to this comparable...' },
	{ key: 'comp_map', label: 'Location Map', tier: 'image' }
];

// ── Derived lookups (computed once at import time) ──

export function getSectionsForApproaches(approaches: string[], includeDocxOnly = false): SectionDef[] {
	return ALL_SECTIONS.filter(s =>
		(includeDocxOnly || !s.docxOnly) &&
		(s.approaches.includes('always') || s.approaches.some(a => approaches.includes(a)))
	);
}

export function getSectionsByGroup(approaches: string[]): { group: SectionGroup; label: string; sections: SectionDef[] }[] {
	const active = getSectionsForApproaches(approaches);
	return GROUP_ORDER
		.map(group => ({
			group,
			label: GROUP_LABELS[group],
			sections: active.filter(s => s.group === group)
		}))
		.filter(g => g.sections.length > 0);
}

export const SECTION_MAP: Record<string, SectionDef> =
	Object.fromEntries(ALL_SECTIONS.map(s => [s.key, s]));

export const SECTION_TYPE_MAP: Record<string, string> =
	Object.fromEntries(ALL_SECTIONS.map(s => [s.key, s.tier]));

export const SECTION_LABEL_MAP: Record<string, string> =
	Object.fromEntries(ALL_SECTIONS.map(s => [s.key, s.label]));

export const DEFAULT_APPROACHES = ['sales_comparison', 'income_cap'];

export const AUTO_SECTIONS = ALL_SECTIONS.filter(s => s.tier === 'auto');
