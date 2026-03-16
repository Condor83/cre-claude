import { describe, it, expect } from 'vitest';
import { computeAvgAnnualPct } from './census-bls.js';

describe('computeAvgAnnualPct', () => {
	it('computes CAGR correctly for normal growth', () => {
		// 100 → 200 over 10 years = ~7.18% per year
		const result = computeAvgAnnualPct(100, 200, 10);
		expect(result).toBeCloseTo(7.177, 1);
	});

	it('computes CAGR for population-scale numbers', () => {
		// Utah County: 516,564 (2010) → ~700,000 (2023, 13 years)
		const result = computeAvgAnnualPct(516564, 700000, 13);
		expect(result).not.toBeNull();
		expect(result!).toBeGreaterThan(2);
		expect(result!).toBeLessThan(3);
	});

	it('computes CAGR for zero growth', () => {
		const result = computeAvgAnnualPct(100, 100, 10);
		expect(result).toBeCloseTo(0, 5);
	});

	it('computes negative CAGR for decline', () => {
		const result = computeAvgAnnualPct(200, 100, 10);
		expect(result).not.toBeNull();
		expect(result!).toBeLessThan(0);
	});

	it('returns null for zero earlier value', () => {
		expect(computeAvgAnnualPct(0, 100, 10)).toBeNull();
	});

	it('returns null for zero year span', () => {
		expect(computeAvgAnnualPct(100, 200, 0)).toBeNull();
	});

	it('returns null for negative year span', () => {
		expect(computeAvgAnnualPct(100, 200, -5)).toBeNull();
	});

	it('returns null for null-ish inputs', () => {
		expect(computeAvgAnnualPct(0, 0, 10)).toBeNull();
	});
});
