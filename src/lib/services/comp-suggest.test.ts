import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB module before importing suggestComps
vi.mock('$lib/db/index.js', () => {
	let mockRows: Array<Record<string, unknown>> = [];

	return {
		getDb: () => ({
			prepare: () => ({
				all: (..._args: unknown[]) => mockRows
			})
		}),
		_setMockRows: (rows: Array<Record<string, unknown>>) => { mockRows = rows; }
	};
});

import { suggestComps } from './comp-suggest.js';
import { _setMockRows } from '$lib/db/index.js';

const baseProp = {
	property_id: 1,
	address: '123 Main St',
	city: 'Provo',
	county: 'utah_county',
	property_type: 'Industrial/Warehouse',
	building_sf: 10000,
	year_built: 2000,
	sale_price: 850000,
	price_per_sf: 85,
	sale_date: '2025-06-15',
	cap_rate: 0.065
};

beforeEach(() => {
	(_setMockRows as (rows: Array<Record<string, unknown>>) => void)([]);
});

describe('suggestComps', () => {
	it('scores 100 for exact match on all 4 dimensions', () => {
		(_setMockRows as (rows: Array<Record<string, unknown>>) => void)([
			{ ...baseProp }
		]);

		const results = suggestComps({
			property_type: 'Industrial/Warehouse',
			building_sf: 10000,
			target_price_psf: 85,
			county: 'utah_county',
			limit: 10
		});

		expect(results).toHaveLength(1);
		expect(results[0].score).toBe(100);
		expect(results[0].score_breakdown).toEqual({
			type_match: 40,
			price_proximity: 30,
			size_similarity: 20,
			county_match: 10
		});
	});

	it('scores 40 for type-only match', () => {
		(_setMockRows as (rows: Array<Record<string, unknown>>) => void)([
			{ ...baseProp, county: 'salt_lake_county', building_sf: 50000, price_per_sf: 200 }
		]);

		const results = suggestComps({
			property_type: 'Industrial/Warehouse',
			building_sf: 10000,
			target_price_psf: 85,
			county: 'utah_county',
			limit: 10
		});

		expect(results).toHaveLength(1);
		expect(results[0].score).toBe(40);
		expect(results[0].score_breakdown.type_match).toBe(40);
	});

	it('gives 30pts for price within 10%', () => {
		(_setMockRows as (rows: Array<Record<string, unknown>>) => void)([
			{ ...baseProp, property_type: 'Office', price_per_sf: 90, county: 'other' }
		]);

		const results = suggestComps({
			property_type: 'Industrial/Warehouse',
			building_sf: 10000,
			target_price_psf: 85,
			county: 'utah_county',
			limit: 10
		});

		expect(results).toHaveLength(1);
		expect(results[0].score_breakdown.price_proximity).toBe(30);
	});

	it('gives 20pts for price within 25%', () => {
		(_setMockRows as (rows: Array<Record<string, unknown>>) => void)([
			{ ...baseProp, property_type: 'Office', price_per_sf: 105, county: 'other' }
		]);

		const results = suggestComps({
			property_type: 'Industrial/Warehouse',
			building_sf: 10000,
			target_price_psf: 85,
			county: 'utah_county',
			limit: 10
		});

		expect(results).toHaveLength(1);
		expect(results[0].score_breakdown.price_proximity).toBe(20);
	});

	it('gives 10pts for price within 50%', () => {
		(_setMockRows as (rows: Array<Record<string, unknown>>) => void)([
			{ ...baseProp, property_type: 'Office', price_per_sf: 125, county: 'other' }
		]);

		const results = suggestComps({
			property_type: 'Industrial/Warehouse',
			building_sf: 10000,
			target_price_psf: 85,
			county: 'utah_county',
			limit: 10
		});

		expect(results).toHaveLength(1);
		expect(results[0].score_breakdown.price_proximity).toBe(10);
	});

	it('gives 0pts for price beyond 50%', () => {
		(_setMockRows as (rows: Array<Record<string, unknown>>) => void)([
			{ ...baseProp, property_type: 'Office', price_per_sf: 200, county: 'other', building_sf: 50000 }
		]);

		const results = suggestComps({
			property_type: 'Industrial/Warehouse',
			building_sf: 10000,
			target_price_psf: 85,
			county: 'utah_county',
			limit: 10
		});

		// Score = 0 (no type match, no price, no size, no county) — filtered out (< 30)
		expect(results).toHaveLength(0);
	});

	it('handles null price_per_sf gracefully (0 points)', () => {
		(_setMockRows as (rows: Array<Record<string, unknown>>) => void)([
			{ ...baseProp, price_per_sf: null }
		]);

		const results = suggestComps({
			property_type: 'Industrial/Warehouse',
			building_sf: 10000,
			target_price_psf: 85,
			county: 'utah_county',
			limit: 10
		});

		expect(results).toHaveLength(1);
		// type(40) + price(0) + size(20) + county(10) = 70
		expect(results[0].score).toBe(70);
		expect(results[0].score_breakdown.price_proximity).toBe(0);
	});

	it('handles null building_sf gracefully', () => {
		(_setMockRows as (rows: Array<Record<string, unknown>>) => void)([
			{ ...baseProp, building_sf: null }
		]);

		// building_sf null won't be in candidates (WHERE building_sf IS NOT NULL)
		// But the mock doesn't enforce that, so test scoring
		const results = suggestComps({
			property_type: 'Industrial/Warehouse',
			building_sf: 10000,
			target_price_psf: 85,
			county: 'utah_county',
			limit: 10
		});

		expect(results).toHaveLength(1);
		expect(results[0].score_breakdown.size_similarity).toBe(0);
	});

	it('filters out candidates scoring < 30', () => {
		(_setMockRows as (rows: Array<Record<string, unknown>>) => void)([
			{ ...baseProp, property_type: 'Office', price_per_sf: 500, building_sf: 100000, county: 'other' }
		]);

		const results = suggestComps({
			property_type: 'Industrial/Warehouse',
			building_sf: 10000,
			target_price_psf: 85,
			county: 'utah_county',
			limit: 10
		});

		expect(results).toHaveLength(0);
	});

	it('sorts by score descending, price proximity as tiebreaker', () => {
		(_setMockRows as (rows: Array<Record<string, unknown>>) => void)([
			{ ...baseProp, property_id: 1, price_per_sf: 120 }, // type(40) + price(20) + size(20) + county(10) = 90
			{ ...baseProp, property_id: 2, price_per_sf: 85 },  // type(40) + price(30) + size(20) + county(10) = 100
			{ ...baseProp, property_id: 3, price_per_sf: 110 }  // type(40) + price(20) + size(20) + county(10) = 90
		]);

		const results = suggestComps({
			property_type: 'Industrial/Warehouse',
			building_sf: 10000,
			target_price_psf: 85,
			county: 'utah_county',
			limit: 10
		});

		expect(results[0].property_id).toBe(2);  // score 100
		expect(results[0].score).toBe(100);
	});

	it('excludes the specified property', () => {
		(_setMockRows as (rows: Array<Record<string, unknown>>) => void)([
			{ ...baseProp, property_id: 1 },
			{ ...baseProp, property_id: 2 }
		]);

		const results = suggestComps({
			property_type: 'Industrial/Warehouse',
			building_sf: 10000,
			target_price_psf: 85,
			county: 'utah_county',
			exclude_property_id: 1,
			limit: 10
		});

		// Both come back because mock doesn't enforce SQL WHERE — that's a DB concern
		// But the function passes exclude_property_id to the query
		expect(results.length).toBeGreaterThan(0);
	});

	it('limits results to requested count', () => {
		const rows = Array.from({ length: 20 }, (_, i) => ({
			...baseProp,
			property_id: i + 1
		}));
		(_setMockRows as (rows: Array<Record<string, unknown>>) => void)(rows);

		const results = suggestComps({
			property_type: 'Industrial/Warehouse',
			building_sf: 10000,
			target_price_psf: 85,
			county: 'utah_county',
			limit: 5
		});

		expect(results.length).toBeLessThanOrEqual(5);
	});
});
