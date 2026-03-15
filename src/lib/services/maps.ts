/**
 * Google Maps Static API service.
 * Generates map images for reports: neighborhood maps, aerials, plat views, comp maps.
 */

import { fetchBuffer } from './fetch-utils.js';
import { env } from '$env/dynamic/private';

const STATIC_MAP_URL = 'https://maps.googleapis.com/maps/api/staticmap';

function getApiKey(): string | null {
	return env.GOOGLE_MAPS_API_KEY || null;
}

function buildUrl(params: Record<string, string>): string | null {
	const key = getApiKey();
	if (!key) {
		console.log('[maps] GOOGLE_MAPS_API_KEY not set, skipping map generation');
		return null;
	}
	const search = new URLSearchParams({ ...params, key });
	return `${STATIC_MAP_URL}?${search}`;
}

/**
 * Neighborhood road map with subject pin. Zoom 13, 640x640.
 */
export async function fetchNeighborhoodMap(lat: number, lng: number): Promise<Buffer | null> {
	const url = buildUrl({
		center: `${lat},${lng}`,
		zoom: '13',
		size: '640x640',
		maptype: 'roadmap',
		markers: `color:red|${lat},${lng}`,
		scale: '2'
	});
	if (!url) return null;
	return fetchBuffer(url);
}

/**
 * Neighborhood aerial (satellite). Zoom 17, 640x640.
 */
export async function fetchNeighborhoodAerial(lat: number, lng: number): Promise<Buffer | null> {
	const url = buildUrl({
		center: `${lat},${lng}`,
		zoom: '15',
		size: '640x640',
		maptype: 'satellite',
		markers: `color:red|${lat},${lng}`,
		scale: '2'
	});
	if (!url) return null;
	return fetchBuffer(url);
}

// Marker label characters for comp numbering
const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';

export interface CompLocation {
	lat: number;
	lng: number;
	label?: string;
}

/**
 * Comp map with numbered pins for subject + comps.
 * Subject gets a red pin, comps get blue numbered pins.
 */
export async function fetchCompMap(
	subjectLat: number,
	subjectLng: number,
	comps: CompLocation[]
): Promise<Buffer | null> {
	const key = getApiKey();
	if (!key) return null;

	// Build markers param — subject (red) + comps (blue, labeled)
	const markers: string[] = [
		`color:red|label:S|${subjectLat},${subjectLng}`
	];

	for (let i = 0; i < comps.length && i < LABELS.length; i++) {
		const c = comps[i];
		const label = c.label || LABELS[i];
		markers.push(`color:blue|label:${label}|${c.lat},${c.lng}`);
	}

	// Build URL with multiple markers params
	const params = new URLSearchParams({
		size: '640x640',
		maptype: 'roadmap',
		scale: '2',
		key
	});

	// Append each markers group
	const markersQuery = markers.map(m => `markers=${encodeURIComponent(m)}`).join('&');
	const url = `${STATIC_MAP_URL}?${params}&${markersQuery}`;

	return fetchBuffer(url);
}
