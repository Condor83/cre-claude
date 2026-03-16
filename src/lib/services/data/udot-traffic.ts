// UDOT Traffic Volume ArcGIS service — AADT counts and road info by lat/lng
// Returns null on failure — callers keep stale cache

import { fetchWithTimeout } from '../fetch-utils.js';

const TRAFFIC_VOLUME_URL =
	'https://services1.arcgis.com/taguadKoI1XFwivx/ArcGIS/rest/services/' +
	'Utah_Statewide_Traffic_Volume_Historic_and_Forecast/FeatureServer/0/query';

const UGRC_API_KEY = process.env.URGC_API_KEY ?? '';

// ── Types ──

export interface RoadSegment {
	name: string;
	routeId: string;
	aadt: number;
	forecastAadt: number | null;
	distanceMiles: number;
	classification: 'interstate' | 'us_highway' | 'state_route' | 'collector' | 'local';
}

export interface AccessData {
	subject_street: RoadSegment | null;
	nearby_roads: RoadSegment[];
	nearest_highway: { name: string; routeId: string; distanceMiles: number; aadt: number } | null;
	address_street: string | null; // from UGRC reverse geocode
	fetched_at: string;
	source: string;
}

// ── Helpers ──

function classifyRoute(routeId: string, fullname: string): RoadSegment['classification'] {
	if (fullname.includes('FWY') || fullname.startsWith('I-')) return 'interstate';
	const num = parseInt(routeId, 10);
	if (num > 0 && num < 100) return 'us_highway';
	if (num >= 100 && num < 1000) return 'state_route';
	if (num >= 1000 && num < 2000) return 'collector';
	return 'local';
}

function classificationLabel(c: RoadSegment['classification']): string {
	switch (c) {
		case 'interstate': return 'Interstate/Freeway';
		case 'us_highway': return 'US Highway';
		case 'state_route': return 'State Route';
		case 'collector': return 'Collector';
		case 'local': return 'Local Road';
	}
}

/** Extract a street name hint from a property address like "1602 W 800 S" → "800 S" */
function extractStreetFromAddress(address: string): string | null {
	// Match patterns like "800 S", "Main St", "State St"
	const match = address.match(/\d+\s+[NSEW]\s+(.+)/i) || address.match(/^\d+\s+(.+)/i);
	return match?.[1]?.trim() ?? null;
}

// ── Deduplication: keep highest-AADT segment per road name ──

function deduplicateRoads(segments: RoadSegment[]): RoadSegment[] {
	const byName = new Map<string, RoadSegment>();
	for (const seg of segments) {
		const existing = byName.get(seg.name);
		if (!existing || seg.aadt > existing.aadt) {
			byName.set(seg.name, seg);
		}
	}
	return [...byName.values()].sort((a, b) => b.aadt - a.aadt);
}

// ── UDOT Traffic Volume ArcGIS query ──

async function fetchTrafficSegments(lat: number, lng: number, radiusMiles: number): Promise<RoadSegment[]> {
	const params = new URLSearchParams({
		geometry: `${lng},${lat}`,
		geometryType: 'esriGeometryPoint',
		inSR: '4326',
		spatialRel: 'esriSpatialRelIntersects',
		distance: String(radiusMiles),
		units: 'esriSRUnit_StatuteMile',
		outFields: 'FULLNAME,ROUTE_ID,AADT2019,F2024,DISTANCE',
		returnGeometry: 'false',
		resultRecordCount: '50',
		orderByFields: 'DISTANCE',
		f: 'json',
	});

	try {
		const res = await fetchWithTimeout(`${TRAFFIC_VOLUME_URL}?${params}`, undefined, 15000);
		if (!res.ok) {
			console.log(`[udot-traffic] HTTP ${res.status}`);
			return [];
		}

		const json = await res.json() as {
			features?: Array<{
				attributes: {
					FULLNAME: string;
					ROUTE_ID: string;
					AADT2019: number | null;
					F2024: number | null;
					DISTANCE: number | null;
				};
			}>;
		};

		if (!json.features?.length) return [];

		return json.features
			.filter(f => f.attributes.FULLNAME && (f.attributes.AADT2019 || f.attributes.F2024))
			.map(f => {
				const a = f.attributes;
				const aadt = a.AADT2019 ?? a.F2024 ?? 0;
				return {
					name: a.FULLNAME,
					routeId: a.ROUTE_ID ?? '',
					aadt,
					forecastAadt: a.F2024 ?? null,
					distanceMiles: a.DISTANCE ?? 0,
					classification: classifyRoute(a.ROUTE_ID ?? '', a.FULLNAME),
				};
			});
	} catch (err) {
		console.log('[udot-traffic] Fetch failed:', err);
		return [];
	}
}

// ── UGRC Reverse Geocode (street name at coords) ──

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
	if (!UGRC_API_KEY) return null;
	try {
		const url = `https://api.mapserv.utah.gov/api/v1/geocode/reverse/${lng}/${lat}?apikey=${UGRC_API_KEY}&spatialReference=4326`;
		const res = await fetchWithTimeout(url, undefined, 8000);
		if (!res.ok) return null;
		const json = await res.json() as { result?: { address?: { street?: string } } };
		return json.result?.address?.street ?? null;
	} catch {
		return null;
	}
}

// ── Public API ──

export { classificationLabel };

export async function fetchAccessData(lat: number, lng: number, address?: string): Promise<AccessData | null> {
	// Parallel: traffic segments (wide radius for highways) + reverse geocode
	const [segments, geocodedStreet] = await Promise.all([
		fetchTrafficSegments(lat, lng, 5),
		reverseGeocode(lat, lng),
	]);

	if (segments.length === 0) {
		console.log('[udot-traffic] No traffic segments found');
		return null;
	}

	// Deduplicate: keep highest-AADT segment per road name
	const deduped = deduplicateRoads(segments);

	// Find nearest interstate first, then fall back to US highway
	const interstates = segments.filter(s => s.classification === 'interstate');
	const usHighways = segments.filter(s => s.classification === 'us_highway');
	const hwCandidate = interstates[0] ?? usHighways[0] ?? null;
	const nearestHighway = hwCandidate
		? { name: hwCandidate.name, routeId: hwCandidate.routeId, distanceMiles: hwCandidate.distanceMiles, aadt: hwCandidate.aadt }
		: null;

	// Identify subject street: match address street name to nearest segment
	let subjectStreet: RoadSegment | null = null;
	const streetHint = address ? extractStreetFromAddress(address) : null;
	const streetName = streetHint?.toUpperCase();

	if (streetName) {
		// Find closest segment matching the street name
		const matches = segments.filter(s =>
			s.name.toUpperCase().includes(streetName) || streetName.includes(s.name.toUpperCase())
		);
		if (matches.length > 0) {
			// Prefer state route over local for AADT accuracy
			const stateRoute = matches.find(s => s.classification === 'state_route' || s.classification === 'us_highway');
			subjectStreet = stateRoute ?? matches.reduce((a, b) => a.aadt > b.aadt ? a : b);
		}
	}

	// Fallback: use closest non-highway segment
	if (!subjectStreet) {
		const local = segments.filter(s => s.classification !== 'interstate' && s.classification !== 'us_highway');
		if (local.length > 0) subjectStreet = local[0];
	}

	// Nearby roads: top roads excluding subject street, limit to 6
	const nearby = deduped
		.filter(r => r.name !== subjectStreet?.name)
		.slice(0, 6);

	console.log(`[udot-traffic] Found ${segments.length} segments, subject=${subjectStreet?.name} (AADT ${subjectStreet?.aadt}), highway=${nearestHighway?.name} (${nearestHighway?.distanceMiles.toFixed(1)} mi)`);

	return {
		subject_street: subjectStreet,
		nearby_roads: nearby,
		nearest_highway: nearestHighway,
		address_street: geocodedStreet,
		fetched_at: new Date().toISOString(),
		source: 'Utah Department of Transportation',
	};
}
