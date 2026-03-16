import { describe, it, expect } from 'vitest';
import { fmt, fmtCurrency, fmtPct, fmtDecimal, fmtAcres, fmtSF, safeDivide, renderTable, str, p } from './helpers.js';

describe('fmt', () => {
	it('formats numbers with commas', () => {
		expect(fmt(1234567)).toBe('1,234,567');
	});
	it('returns N/A for null', () => {
		expect(fmt(null)).toBe('N/A');
	});
	it('returns N/A for undefined', () => {
		expect(fmt(undefined)).toBe('N/A');
	});
	it('returns N/A for NaN', () => {
		expect(fmt(NaN)).toBe('N/A');
	});
	it('formats zero', () => {
		expect(fmt(0)).toBe('0');
	});
});

describe('fmtCurrency', () => {
	it('formats as dollar amount', () => {
		expect(fmtCurrency(1500000)).toBe('$1,500,000');
	});
	it('returns N/A for null', () => {
		expect(fmtCurrency(null)).toBe('N/A');
	});
});

describe('fmtPct', () => {
	it('formats percentage with default 1 decimal', () => {
		expect(fmtPct(12.345)).toBe('12.3%');
	});
	it('formats percentage with custom decimals', () => {
		expect(fmtPct(12.345, 2)).toBe('12.35%');
	});
	it('returns N/A for null', () => {
		expect(fmtPct(null)).toBe('N/A');
	});
});

describe('fmtAcres', () => {
	it('formats acreage', () => {
		expect(fmtAcres(2.5)).toBe('2.50 acres');
	});
	it('returns N/A for null', () => {
		expect(fmtAcres(null)).toBe('N/A');
	});
});

describe('fmtSF', () => {
	it('formats square footage', () => {
		expect(fmtSF(15000)).toBe('15,000 SF');
	});
	it('returns N/A for null', () => {
		expect(fmtSF(null)).toBe('N/A');
	});
});

describe('safeDivide', () => {
	it('divides normally', () => {
		expect(safeDivide(10, 5)).toBe(2);
	});
	it('returns null for zero denominator', () => {
		expect(safeDivide(10, 0)).toBeNull();
	});
	it('returns null for null numerator', () => {
		expect(safeDivide(null, 5)).toBeNull();
	});
	it('returns null for null denominator', () => {
		expect(safeDivide(10, null)).toBeNull();
	});
});

describe('renderTable', () => {
	it('renders an HTML table', () => {
		const html = renderTable(['Name', 'Value'], [['Lot Size', '2.5 acres'], ['Zoning', 'C-2']]);
		expect(html).toContain('<table>');
		expect(html).toContain('<th>Name</th>');
		expect(html).toContain('<th>Value</th>');
		expect(html).toContain('<td>Lot Size</td>');
		expect(html).toContain('<td>2.5 acres</td>');
		expect(html).toContain('</table>');
	});

	it('renders empty table with no rows', () => {
		const html = renderTable(['A', 'B'], []);
		expect(html).toContain('<table>');
		expect(html).toContain('<th>A</th>');
		expect(html).not.toContain('<td>');
	});
});

describe('str', () => {
	it('returns value when present', () => {
		expect(str('hello')).toBe('hello');
	});
	it('trims whitespace', () => {
		expect(str('  hello  ')).toBe('hello');
	});
	it('returns N/A for null', () => {
		expect(str(null)).toBe('N/A');
	});
	it('returns N/A for empty string', () => {
		expect(str('')).toBe('N/A');
	});
	it('returns custom fallback', () => {
		expect(str(null, 'Unknown')).toBe('Unknown');
	});
	it('returns N/A when fallback is null', () => {
		expect(str(null, null)).toBe('N/A');
	});
});

describe('p', () => {
	it('wraps text in paragraph tags', () => {
		expect(p('Hello world')).toBe('<p>Hello world</p>');
	});
});
