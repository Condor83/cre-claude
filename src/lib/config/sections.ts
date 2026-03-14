export interface SectionDef {
	key: string;
	label: string;
	approaches: ('always' | 'sales_comparison' | 'income_cap' | 'cost')[];
	sectionType: 'boilerplate' | 'comp' | 'narrative';
}

export const ALL_SECTIONS: SectionDef[] = [
	{ key: 'transmittal', label: 'Letter of Transmittal', approaches: ['always'], sectionType: 'boilerplate' },
	{ key: 'certification', label: 'Certification', approaches: ['always'], sectionType: 'boilerplate' },
	{ key: 'assumptions', label: 'Assumptions & Limiting Conditions', approaches: ['always'], sectionType: 'boilerplate' },
	{ key: 'scope_of_work', label: 'Scope of Work', approaches: ['always'], sectionType: 'boilerplate' },
	{ key: 'neighborhood', label: 'Neighborhood Description', approaches: ['always'], sectionType: 'narrative' },
	{ key: 'site_description', label: 'Site Description', approaches: ['always'], sectionType: 'narrative' },
	{ key: 'improvement_description', label: 'Improvement Description', approaches: ['always'], sectionType: 'narrative' },
	{ key: 'highest_best_use', label: 'Highest & Best Use', approaches: ['always'], sectionType: 'narrative' },
	{ key: 'sales_comparison', label: 'Sales Comparison Approach', approaches: ['sales_comparison'], sectionType: 'comp' },
	{ key: 'income_approach', label: 'Income Capitalization Approach', approaches: ['income_cap'], sectionType: 'comp' },
	{ key: 'cost_approach', label: 'Cost Approach', approaches: ['cost'], sectionType: 'narrative' },
	{ key: 'reconciliation', label: 'Reconciliation', approaches: ['always'], sectionType: 'narrative' },
	{ key: 'appraiser_qualifications', label: 'Appraiser Qualifications', approaches: ['always'], sectionType: 'boilerplate' }
];

export function getSectionsForApproaches(approaches: string[]): SectionDef[] {
	return ALL_SECTIONS.filter(s =>
		s.approaches.includes('always') || s.approaches.some(a => approaches.includes(a))
	);
}

// Derived O(1) lookup maps (computed once at import time)
export const SECTION_TYPE_MAP: Record<string, string> =
	Object.fromEntries(ALL_SECTIONS.map(s => [s.key, s.sectionType]));

export const SECTION_LABEL_MAP: Record<string, string> =
	Object.fromEntries(ALL_SECTIONS.map(s => [s.key, s.label]));

export const DEFAULT_APPROACHES = ['sales_comparison', 'income_cap'];
