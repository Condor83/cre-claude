import { describe, it, expect } from 'vitest';
import { ALL_SECTIONS, getSectionsForApproaches, SECTION_TYPE_MAP, SECTION_LABEL_MAP, DEFAULT_APPROACHES } from './sections.js';

describe('ALL_SECTIONS', () => {
	it('has 38 sections', () => {
		expect(ALL_SECTIONS).toHaveLength(38);
	});

	it('has unique keys', () => {
		const keys = ALL_SECTIONS.map(s => s.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('every section has a non-empty label', () => {
		for (const s of ALL_SECTIONS) {
			expect(s.label.length).toBeGreaterThan(0);
		}
	});
});

describe('getSectionsForApproaches', () => {
	it('returns all "always" sections plus approach-specific ones', () => {
		const sections = getSectionsForApproaches(['sales_comparison']);
		const keys = sections.map(s => s.key);
		expect(keys).toContain('transmittal');
		expect(keys).toContain('sales_comparison');
		expect(keys).not.toContain('income_approach');
		expect(keys).not.toContain('cost_approach');
	});

	it('returns both approach sections for default approaches', () => {
		const sections = getSectionsForApproaches(DEFAULT_APPROACHES);
		const keys = sections.map(s => s.key);
		expect(keys).toContain('sales_comparison');
		expect(keys).toContain('income_approach');
		expect(keys).not.toContain('cost_approach');
	});

	it('returns cost_approach when cost is selected', () => {
		const sections = getSectionsForApproaches(['cost']);
		const keys = sections.map(s => s.key);
		expect(keys).toContain('cost_approach');
		expect(keys).not.toContain('sales_comparison');
	});

	it('returns only always sections for empty approaches', () => {
		const sections = getSectionsForApproaches([]);
		for (const s of sections) {
			expect(s.approaches).toContain('always');
		}
	});

	it('returns all sections for all three approaches', () => {
		const sections = getSectionsForApproaches(['sales_comparison', 'income_cap', 'cost']);
		// ALL_SECTIONS minus docxOnly sections (table_of_contents)
		const nonDocxOnly = ALL_SECTIONS.filter(s => !s.docxOnly);
		expect(sections).toHaveLength(nonDocxOnly.length);
	});
});

describe('SECTION_TYPE_MAP', () => {
	it('maps transmittal to guided', () => {
		expect(SECTION_TYPE_MAP['transmittal']).toBe('guided');
	});

	it('maps sales_comparison to prose', () => {
		expect(SECTION_TYPE_MAP['sales_comparison']).toBe('prose');
	});

	it('maps neighborhood to guided', () => {
		expect(SECTION_TYPE_MAP['neighborhood']).toBe('guided');
	});

	it('maps title_page to auto', () => {
		expect(SECTION_TYPE_MAP['title_page']).toBe('auto');
	});

	it('maps photographs to images', () => {
		expect(SECTION_TYPE_MAP['photographs']).toBe('images');
	});
});

describe('SECTION_LABEL_MAP', () => {
	it('maps all section keys to labels', () => {
		for (const s of ALL_SECTIONS) {
			expect(SECTION_LABEL_MAP[s.key]).toBe(s.label);
		}
	});
});
