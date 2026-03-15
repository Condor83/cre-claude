/**
 * Google Geocoding API service.
 * Geocodes an address to lat/lng coordinates.
 */

import { fetchWithTimeout } from './fetch-utils.js';
import { env } from '$env/dynamic/private';

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

export interface GeoResult {
	lat: number;
	lng: number;
}

/**
 * Geocode an address using Google Geocoding API.
 * Returns null on failure (never throws).
 */
export async function geocodeAddress(
	address: string,
	city: string,
	state = 'UT'
): Promise<GeoResult | null> {
	const apiKey = env.GOOGLE_MAPS_API_KEY;
	if (!apiKey) {
		console.log('[geocode] GOOGLE_MAPS_API_KEY not set, skipping geocode');
		return null;
	}

	const fullAddress = `${address}, ${city}, ${state}`;
	const params = new URLSearchParams({
		address: fullAddress,
		key: apiKey
	});

	try {
		const res = await fetchWithTimeout(`${GEOCODE_URL}?${params}`, undefined, 8000);
		if (!res.ok) {
			console.log(`[geocode] HTTP ${res.status} for "${fullAddress}"`);
			return null;
		}

		const data = await res.json() as {
			status: string;
			results: Array<{
				geometry: { location: { lat: number; lng: number } };
			}>;
		};

		if (data.status !== 'OK' || !data.results?.length) {
			console.log(`[geocode] ${data.status} for "${fullAddress}"`);
			return null;
		}

		const { lat, lng } = data.results[0].geometry.location;
		console.log(`[geocode] "${fullAddress}" -> ${lat}, ${lng}`);
		return { lat, lng };
	} catch (err) {
		console.log(`[geocode] Failed for "${fullAddress}":`, err);
		return null;
	}
}

