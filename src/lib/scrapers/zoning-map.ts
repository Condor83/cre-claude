/**
 * City zoning map service.
 * Composites semi-transparent color-filled zoning overlays on satellite imagery
 * via ArcGIS REST exports + sharp image compositing.
 *
 * Two service patterns:
 * - City-hosted MapServer (Orem): dedicated export endpoint, LABEL field
 * - County MapServer (Utah County): shared server with per-city layers
 */

import sharp from 'sharp';
import { fetchBuffer } from '$lib/services/fetch-utils.js';

interface ZoningService {
	/** MapServer export URL */
	export: string;
	/** Layer number for zone code queries */
	queryLayer: number;
	/** Field name containing zone label (default: 'LABEL') */
	labelField?: string;
	/** For county server: layers param to isolate this city's zones */
	layers?: string;
}

const UTAH_COUNTY_SERVER = 'https://maps.utahcounty.gov/arcgis/rest/services/Assessor/CommercialAppraiser/MapServer';

const ZONING_SERVICES: Record<string, ZoningService> = {
	'Orem': {
		export: 'https://maps.orem.org/arcgis/rest/services/ZoningAndOverlays/MapServer/export',
		queryLayer: 1
	},
	'Payson': {
		export: `${UTAH_COUNTY_SERVER}/export`,
		queryLayer: 31,
		labelField: 'ZONE_PA_LABEL',
		layers: 'show:31'
	}
};

// ArcGIS World Imagery for satellite basemap
const SATELLITE_URL = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export';

// Wide city-level bbox offsets (~2 miles around property)
const LAT_OFFSET = 0.025;
const LNG_OFFSET = 0.030;

const IMAGE_SIZE = 1280;
const OVERLAY_OPACITY = 153; // 60% of 255

/**
 * Fetch a zoning map composited on satellite imagery.
 * Returns a PNG with semi-transparent zone colors over aerial view,
 * similar to Brad's golden sample zoning maps.
 *
 * @param lat Property latitude
 * @param lng Property longitude
 * @param city City name (e.g., "Orem")
 */
/**
 * Query the ArcGIS zoning service to find the zone code at a point.
 */
async function queryZoneCode(lat: number, lng: number, city: string): Promise<string | null> {
	const service = ZONING_SERVICES[city];
	if (!service) return null;

	try {
		// Build query URL: county server uses layer ID directly, city server derives from export URL
		const queryUrl = service.layers
			? `${service.export.replace('/export', `/${service.queryLayer}/query`)}`
			: `${service.export.replace('/export', `/${service.queryLayer}/query`)}`;
		const labelField = service.labelField || 'LABEL';

		const params = new URLSearchParams({
			geometry: `${lng},${lat}`,
			geometryType: 'esriGeometryPoint',
			inSR: '4326',
			spatialRel: 'esriSpatialRelIntersects',
			outFields: labelField,
			returnGeometry: 'false',
			f: 'json'
		});

		const res = await fetch(`${queryUrl}?${params}`);
		if (!res.ok) return null;

		const data = await res.json() as { features?: Array<{ attributes?: Record<string, string> }> };
		const label = data.features?.[0]?.attributes?.[labelField];
		if (label) {
			console.log(`[zoning-map] Zone query for ${city}: ${label}`);
			return label;
		}
	} catch (err) {
		console.log(`[zoning-map] Zone query failed:`, err);
	}
	return null;
}

export async function fetchZoningMap(
	lat: number,
	lng: number,
	city: string,
	zoning?: string | null
): Promise<Buffer | null> {
	const service = ZONING_SERVICES[city];
	if (!service) {
		console.log(`[zoning-map] No zoning service configured for "${city}", skipping`);
		return null;
	}

	try {
		// Query zone code if not provided
		if (!zoning) {
			zoning = await queryZoneCode(lat, lng, city);
		}
		const bbox = [
			lng - LNG_OFFSET,
			lat - LAT_OFFSET,
			lng + LNG_OFFSET,
			lat + LAT_OFFSET
		].join(',');

		const commonParams = {
			bbox,
			bboxSR: '4326',
			imageSR: '4326',
			size: `${IMAGE_SIZE},${IMAGE_SIZE}`,
			format: 'png',
			f: 'image'
		};

		console.log(`[zoning-map] Fetching satellite + zoning for ${city} at ${lat}, ${lng}`);

		// Fetch satellite basemap and transparent zoning overlay in parallel
		const zoningParams: Record<string, string> = { ...commonParams, transparent: 'true' };
		if (service.layers) zoningParams.layers = service.layers;

		const [satelliteBuf, zoningBuf] = await Promise.all([
			fetchBuffer(`${SATELLITE_URL}?${new URLSearchParams({ ...commonParams, transparent: 'false' })}`, 15000),
			fetchBuffer(`${service.export}?${new URLSearchParams(zoningParams)}`, 15000)
		]);

		if (!satelliteBuf) {
			console.log('[zoning-map] Satellite basemap fetch failed');
			// Fall back to zoning-only (no satellite)
			if (zoningBuf && zoningBuf.length > 5000) return zoningBuf;
			return null;
		}

		if (!zoningBuf || zoningBuf.length < 5000) {
			console.log('[zoning-map] Zoning overlay fetch failed or empty');
			return null;
		}

		// Make the zoning overlay semi-transparent
		const semiTransparentOverlay = await sharp(zoningBuf)
			.ensureAlpha()
			.composite([{
				input: Buffer.from([255, 255, 255, OVERLAY_OPACITY]),
				raw: { width: 1, height: 1, channels: 4 },
				tile: true,
				blend: 'dest-in'
			}])
			.png()
			.toBuffer();

		// SUBJECT marker callout with zone code
		const label = zoning ? `SUBJECT — ${zoning}` : 'SUBJECT';
		const labelWidth = Math.max(140, label.length * 12 + 20);
		const markerSvg = Buffer.from(
			`<svg width="${labelWidth}" height="50" xmlns="http://www.w3.org/2000/svg">` +
			`<rect x="0" y="0" width="${labelWidth}" height="36" rx="5" fill="#FFD700" stroke="black" stroke-width="2"/>` +
			`<text x="${labelWidth / 2}" y="25" font-family="Arial,sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="black">${label}</text>` +
			`<polygon points="${labelWidth / 2 - 10},36 ${labelWidth / 2},50 ${labelWidth / 2 + 10},36" fill="#FFD700" stroke="black" stroke-width="2" stroke-linejoin="round"/>` +
			'</svg>'
		);

		// Composite: satellite + zoning overlay + subject marker at center
		const half = Math.floor(IMAGE_SIZE / 2);
		const composite = await sharp(satelliteBuf)
			.composite([
				{ input: semiTransparentOverlay, blend: 'over' },
				{ input: markerSvg, top: half - 50, left: half - Math.floor(labelWidth / 2), blend: 'over' }
			])
			.png()
			.toBuffer();

		console.log(`[zoning-map] Composite zoning map: ${(composite.length / 1024).toFixed(0)}KB`);
		return composite;
	} catch (err) {
		console.log(`[zoning-map] Failed for ${city}:`, err);
		return null;
	}
}
