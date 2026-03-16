import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { suggestComps } from '$lib/services/comp-suggest.js';

export const GET: RequestHandler = async ({ url }) => {
	const property_type = url.searchParams.get('property_type');
	const building_sf = Number(url.searchParams.get('building_sf')) || 0;
	const target_price_psf = Number(url.searchParams.get('target_price_psf')) || 0;
	const county = url.searchParams.get('county') || 'utah_county';
	const exclude_property_id = url.searchParams.get('exclude_property_id')
		? Number(url.searchParams.get('exclude_property_id'))
		: undefined;
	const exclude_apn = url.searchParams.get('exclude_apn') || undefined;

	if (!property_type || building_sf <= 0) {
		return json({ suggestions: [] });
	}

	const suggestions = suggestComps({
		property_type,
		building_sf,
		target_price_psf,
		county,
		exclude_property_id,
		exclude_apn,
		limit: 10
	});

	return json({ suggestions });
};
