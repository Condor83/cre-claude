// Section configuration: ~35 sections across 5 groups with tier-based rendering

export type SectionTier = 'auto' | 'guided' | 'prose' | 'images' | 'upload';

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
	{ key: 'plat_map', label: 'Plat Map', group: 'factual_descriptions', tier: 'upload', approaches: ['always'] },
	{ key: 'zoning', label: 'Zoning', group: 'factual_descriptions', tier: 'guided', approaches: ['always'] },
	{ key: 'improvement_description', label: 'Improvement Description', group: 'factual_descriptions', tier: 'guided', approaches: ['always'] },
	{ key: 'assessment_taxes', label: 'Assessment & Taxes', group: 'factual_descriptions', tier: 'auto', approaches: ['always'] },

	// ── Group 4: Valuation ──
	{ key: 'highest_best_use', label: 'Highest & Best Use', group: 'valuation', tier: 'auto', approaches: ['always'] },
	{ key: 'highest_best_use_analysis', label: 'Highest & Best Use Analysis', group: 'valuation', tier: 'prose', approaches: ['always'] },
	{ key: 'valuation_process', label: 'Valuation Process', group: 'valuation', tier: 'auto', approaches: ['always'] },
	{ key: 'sales_comparison', label: 'Sales Comparison Approach', group: 'valuation', tier: 'prose', approaches: ['sales_comparison'] },
	{ key: 'income_approach', label: 'Income Capitalization Approach', group: 'valuation', tier: 'prose', approaches: ['income_cap'] },
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

export type SubsectionType = 'auto' | 'freeform' | 'market_table' | 'image' | 'form';

export interface SubsectionDef {
	key: string;
	label: string;
	type: SubsectionType;
	placeholder?: string;
}

export const GUIDED_SUBSECTIONS: Record<string, SubsectionDef[]> = {
	transmittal: [
		{ key: 'header', label: 'Letter Header', type: 'auto' },
		{ key: 'property_summary', label: 'Property Summary', type: 'freeform', placeholder: 'Describe the property and assignment...' },
		{ key: 'special_conditions', label: 'Special Conditions', type: 'freeform', placeholder: 'Note any special conditions or assumptions...' },
		{ key: 'closing', label: 'Closing', type: 'auto' }
	],
	neighborhood: [
		{ key: 'intro', label: 'Neighborhood Overview', type: 'auto' },
		{ key: 'population_table', label: 'Population Data', type: 'market_table' },
		{ key: 'employment_table', label: 'Employment Data', type: 'market_table' },
		{ key: 'market_narrative', label: 'Market Conditions', type: 'freeform', placeholder: 'Describe current market conditions and trends...' },
		{ key: 'location_narrative', label: 'Location Description', type: 'freeform', placeholder: 'Describe the immediate neighborhood...' }
	],
	site_description: [
		{ key: 'dimensions', label: 'Site Dimensions', type: 'auto' },
		{ key: 'topography', label: 'Topography & Access', type: 'freeform', placeholder: 'Describe topography, access, and utilities...' },
		{ key: 'plat_map', label: 'Plat Map', type: 'image' }
	],
	zoning: [
		{ key: 'classification', label: 'Zoning Classification', type: 'auto' },
		{ key: 'development_standards', label: 'Development Standards', type: 'form' },
		{ key: 'zoning_map', label: 'Zoning Map', type: 'image' }
	],
	improvement_description: [
		{ key: 'summary', label: 'Building Summary', type: 'auto' },
		{ key: 'unit_breakdown', label: 'Unit/Suite Breakdown', type: 'form' },
		{ key: 'detail', label: 'Detailed Description', type: 'freeform', placeholder: 'Describe construction details, finishes, mechanicals...' },
		{ key: 'floor_plan', label: 'Floor Plans', type: 'image' }
	],
};

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
