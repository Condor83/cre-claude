import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { lookupCountyAssessor, lookupByParcel, lookupByParcels } from '$lib/scrapers/county.js';

const VALID_COUNTIES = ['utah_county', 'salt_lake_county'] as const;

export const GET: RequestHandler = async ({ url }) => {
	const parcel = url.searchParams.get('parcel');
	const address = url.searchParams.get('address');
	const city = url.searchParams.get('city');
	const county = url.searchParams.get('county');

	// Parcel-first flow
	if (parcel && parcel.trim() !== '') {
		if (!county || !VALID_COUNTIES.includes(county as typeof VALID_COUNTIES[number])) {
			return json({ error: 'county must be utah_county or salt_lake_county' }, { status: 400 });
		}

		try {
			const serials = parcel.split(',').map(s => s.trim()).filter(s => s.length > 0);
			if (serials.length === 0) {
				return json({ error: 'parcel must be non-empty' }, { status: 400 });
			}

			const result = serials.length === 1
				? await lookupByParcel(serials[0], county as 'utah_county' | 'salt_lake_county')
				: await lookupByParcels(serials, county as 'utah_county' | 'salt_lake_county');
			return json(result);
		} catch {
			return json({ found: false, data: null, error: 'unavailable' });
		}
	}

	// Address flow (existing)
	if (!address || address.trim() === '') {
		return json({ error: 'address is required' }, { status: 400 });
	}
	if (!city || city.trim() === '') {
		return json({ error: 'city is required' }, { status: 400 });
	}
	if (!county || !VALID_COUNTIES.includes(county as typeof VALID_COUNTIES[number])) {
		return json({ error: 'county must be utah_county or salt_lake_county' }, { status: 400 });
	}

	try {
		const result = await lookupCountyAssessor(
			address.trim(),
			city.trim(),
			county as 'utah_county' | 'salt_lake_county'
		);
		return json(result);
	} catch {
		return json({ found: false, data: null, error: 'unavailable' });
	}
};
