/**
 * Auto-source images orchestrator.
 * Coordinates fetching images from Google Maps, county assessor, and FEMA,
 * then saves them to the report's section_images.
 */

import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync, unlinkSync as unlinkSyncFs, existsSync as existsSyncFs } from 'fs';
import { join } from 'path';
import {
	getDb,
	getReport,
	getReportComps,
	addSectionImage
} from '$lib/db/index.js';
import { geocodeAddress, type GeoResult } from './geocode.js';
import {
	fetchNeighborhoodMap,
	fetchNeighborhoodAerial,
	fetchCompMap,
	type CompLocation
} from './maps.js';
import { fetchPropertyPhoto, fetchCompPhotos } from '$lib/scrapers/county-images.js';
import { fetchFloodMap } from './fema.js';
import { fetchParcelMapImages } from '$lib/scrapers/parcel-map.js';
import { fetchZoningMap } from '$lib/scrapers/zoning-map.js';

const PROJECT_ROOT = process.env.CRE_DATA_DIR || process.cwd();
const IMAGES_DIR = join(PROJECT_ROOT, 'data', 'images');

// ── In-memory status tracking for progress indicators ──

interface AutoSourceStatus {
	state: 'running' | 'done' | 'error';
	total: number;
	completed: number;
	errors: string[];
	startedAt: number;
}

const statusMap = new Map<string, AutoSourceStatus>();

export function getAutoSourceStatus(reportId: number, type: 'subject' | 'comps'): AutoSourceStatus | null {
	return statusMap.get(`${reportId}:${type}`) ?? null;
}

function setStatus(reportId: number, type: 'subject' | 'comps', status: AutoSourceStatus): void {
	statusMap.set(`${reportId}:${type}`, status);
	// Auto-cleanup after 5 minutes
	setTimeout(() => statusMap.delete(`${reportId}:${type}`), 5 * 60 * 1000);
}

// ── Helpers ──

function saveImageBuffer(reportId: number, buffer: Buffer, ext = '.png'): string {
	const reportDir = join(IMAGES_DIR, String(reportId));
	mkdirSync(reportDir, { recursive: true });
	const filename = `${randomUUID()}${ext}`;
	const filePath = join(reportDir, filename);
	writeFileSync(filePath, buffer);
	return filePath;
}

function clearAutoImages(reportId: number, sectionKey: string): void {
	const db = getDb();
	// Get file paths before deleting for disk cleanup
	const rows = db.prepare(
		`SELECT file_path FROM section_images WHERE report_id = ? AND section_key = ? AND source = 'auto'`
	).all(reportId, sectionKey) as Array<{ file_path: string }>;

	db.prepare(
		`DELETE FROM section_images WHERE report_id = ? AND section_key = ? AND source = 'auto'`
	).run(reportId, sectionKey);

	// Clean up files (best-effort)
	for (const row of rows) {
		try {
			if (existsSyncFs(row.file_path)) unlinkSyncFs(row.file_path);
		} catch { /* ignore */ }
	}
}

function cacheGeocode(propertyId: number, geo: GeoResult): void {
	const db = getDb();
	db.prepare('UPDATE properties SET latitude = ?, longitude = ? WHERE id = ?')
		.run(geo.lat, geo.lng, propertyId);
}

interface PropertyInfo {
	property_id: number;
	address: string;
	city: string | null;
	state: string;
	apn: string | null;
	county: string | null;
	zoning: string | null;
	latitude: number | null;
	longitude: number | null;
}

function getSubjectProperty(reportId: number): PropertyInfo | null {
	const db = getDb();
	const row = db.prepare(`
		SELECT p.id as property_id, p.address, p.city, p.state, p.apn,
			p.county, p.zoning, p.latitude, p.longitude
		FROM reports r
		JOIN properties p ON p.id = r.subject_property_id
		WHERE r.id = ?
	`).get(reportId) as PropertyInfo | undefined;
	return row ?? null;
}

// ── Subject Images ──

/**
 * Auto-source subject-level images for a report.
 * Called after report creation (fire-and-forget).
 *
 * Fetches: neighborhood map, neighborhood aerial, plat satellite,
 * property photo, flood map.
 */
export async function autoSourceSubjectImages(reportId: number): Promise<void> {
	// Concurrency guard — skip if already running for this report
	const existing = getAutoSourceStatus(reportId, 'subject');
	if (existing?.state === 'running') {
		console.log(`[auto-source] Subject images already running for report ${reportId}, skipping`);
		return;
	}

	const status: AutoSourceStatus = {
		state: 'running',
		total: 7, // neighborhood map, aerial, parcel boundary, parcel aerial, property photo, flood map, zoning map
		completed: 0,
		errors: [],
		startedAt: Date.now()
	};
	setStatus(reportId, 'subject', status);

	try {
		// Verify report still exists
		const report = getReport(reportId);
		if (!report) {
			status.state = 'error';
			status.errors.push('Report not found');
			return;
		}

		const prop = getSubjectProperty(reportId);
		if (!prop) {
			status.state = 'error';
			status.errors.push('Subject property not found');
			return;
		}

		// Geocode if needed
		let lat = prop.latitude;
		let lng = prop.longitude;
		if (lat == null || lng == null) {
			if (prop.address && prop.city) {
				const geo = await geocodeAddress(prop.address, prop.city, prop.state || 'UT');
				if (geo) {
					lat = geo.lat;
					lng = geo.lng;
					cacheGeocode(prop.property_id, geo);
				}
			}
		}

		const hasCoords = lat != null && lng != null;
		const isUtahCounty = prop.county === 'Utah' || prop.county === 'utah_county';
		const countyType = isUtahCounty ? 'utah_county' as const : 'salt_lake_county' as const;

		// Parallel fetch all images (REST calls + Playwright screenshots run concurrently)
		const results = await Promise.allSettled([
			// 0. Neighborhood map (road with pin)
			hasCoords ? fetchNeighborhoodMap(lat!, lng!) : Promise.resolve(null),
			// 1. Neighborhood aerial (satellite)
			hasCoords ? fetchNeighborhoodAerial(lat!, lng!) : Promise.resolve(null),
			// 2. Parcel map (Playwright — returns {boundary, aerial})
			prop.apn && isUtahCounty
				? fetchParcelMapImages(prop.apn)
				: Promise.resolve({ boundary: null, aerial: null }),
			// 3. Property photo from county
			prop.apn && prop.county
				? fetchPropertyPhoto(prop.apn, countyType)
				: Promise.resolve(null),
			// 4. FEMA flood map
			hasCoords ? fetchFloodMap(lat!, lng!) : Promise.resolve(null),
			// 5. Zoning map (REST — city-specific ArcGIS service)
			hasCoords && prop.city
				? fetchZoningMap(lat!, lng!, prop.city, prop.zoning)
				: Promise.resolve(null)
		]);

		// Extract parcel map results (index 2 returns an object, not a Buffer)
		const parcelResult = results[2];
		const parcelImages = parcelResult.status === 'fulfilled' && parcelResult.value
			? parcelResult.value as { boundary: Buffer | null; aerial: Buffer | null }
			: { boundary: null, aerial: null };

		// Simple image configs for single-buffer results
		const simpleConfigs = [
			{ index: 0, section: 'neighborhood', caption: 'Neighborhood Map', sort: 0 },
			{ index: 1, section: 'neighborhood', caption: 'Neighborhood Aerial', sort: 1 },
			{ index: 3, section: 'photographs', caption: 'Subject Property Photo', sort: 0 },
			{ index: 4, section: 'flood_map', caption: 'FEMA Flood Map', sort: 0 },
			{ index: 5, section: 'zoning', caption: 'Zoning Map', sort: 0 }
		];

		// Collect all sections that have at least one image to save
		const sectionsToSave = new Set<string>();
		for (const c of simpleConfigs) {
			const r = results[c.index];
			if (r.status === 'fulfilled' && r.value) sectionsToSave.add(c.section);
		}
		if (parcelImages.boundary || parcelImages.aerial) sectionsToSave.add('plat_map');

		// Clear auto images once per section
		for (const section of sectionsToSave) {
			clearAutoImages(reportId, section);
		}

		// Save simple images
		for (const config of simpleConfigs) {
			const result = results[config.index];
			if (result.status === 'fulfilled' && result.value) {
				const filePath = saveImageBuffer(reportId, result.value as Buffer);
				addSectionImage(reportId, config.section, filePath, config.caption, config.sort, 'auto');
				status.completed++;
			} else {
				const errMsg = result.status === 'rejected'
					? `${config.caption}: ${result.reason}`
					: `${config.caption}: not available`;
				status.errors.push(errMsg);
			}
		}

		// Save parcel map images (boundary + aerial)
		if (parcelImages.boundary) {
			const filePath = saveImageBuffer(reportId, parcelImages.boundary);
			addSectionImage(reportId, 'plat_map', filePath, 'Parcel Map', 0, 'auto');
			status.completed++;
		} else {
			status.errors.push('Parcel Map: not available');
		}
		if (parcelImages.aerial) {
			const filePath = saveImageBuffer(reportId, parcelImages.aerial);
			addSectionImage(reportId, 'plat_map', filePath, 'Plat Map (Aerial)', 1, 'auto');
			status.completed++;
		} else {
			status.errors.push('Plat Map (Aerial): not available');
		}

		status.state = 'done';
		const elapsed = ((Date.now() - status.startedAt) / 1000).toFixed(1);
		console.log(`[auto-source] Subject images for report ${reportId}: ${status.completed}/${status.total} sourced in ${elapsed}s`);
	} catch (err) {
		status.state = 'error';
		status.errors.push(String(err));
		console.error('[auto-source] Subject images failed:', err);
	}
}

// ── Comp Images ──

/**
 * Auto-source comp-level images for a report.
 * Called from comp panel "Fetch Comp Images" button.
 *
 * Fetches: comp sale map, comp lease map, individual comp photos.
 */
export async function autoSourceCompImages(reportId: number): Promise<void> {
	const status: AutoSourceStatus = {
		state: 'running',
		total: 0,
		completed: 0,
		errors: [],
		startedAt: Date.now()
	};
	setStatus(reportId, 'comps', status);

	try {
		const report = getReport(reportId);
		if (!report) {
			status.state = 'error';
			status.errors.push('Report not found');
			return;
		}

		const prop = getSubjectProperty(reportId);
		if (!prop) {
			status.state = 'error';
			status.errors.push('Subject property not found');
			return;
		}

		// Geocode subject if needed
		let subjectLat = prop.latitude;
		let subjectLng = prop.longitude;
		if (subjectLat == null || subjectLng == null) {
			if (prop.address && prop.city) {
				const geo = await geocodeAddress(prop.address, prop.city, prop.state || 'UT');
				if (geo) {
					subjectLat = geo.lat;
					subjectLng = geo.lng;
					cacheGeocode(prop.property_id, geo);
				}
			}
		}

		const comps = getReportComps(reportId) as Array<{
			comp_type: string;
			property_id: number;
			address: string;
			city: string;
			apn?: string;
			latitude?: number;
			longitude?: number;
			rank?: number;
		}>;

		if (comps.length === 0) {
			status.state = 'done';
			console.log('[auto-source] No comps found for report', reportId);
			return;
		}

		const saleComps = comps.filter(c => c.comp_type === 'sale');
		const leaseComps = comps.filter(c => c.comp_type === 'lease');

		// Geocode any comps missing coordinates
		const db = getDb();
		for (const comp of comps) {
			if (comp.latitude == null || comp.longitude == null) {
				if (comp.address && comp.city) {
					const geo = await geocodeAddress(comp.address, comp.city, 'UT');
					if (geo) {
						comp.latitude = geo.lat;
						comp.longitude = geo.lng;
						db.prepare('UPDATE properties SET latitude = ?, longitude = ? WHERE id = ?')
							.run(geo.lat, geo.lng, comp.property_id);
					}
				}
			}
		}

		// Count expected images after geocoding (now we know which have coords/APNs)
		const compsWithCoords = comps.filter(c => c.latitude != null && c.longitude != null);
		const compsWithApn = comps.filter(c => c.apn);
		const saleCompsWithCoords = saleComps.filter(c => c.latitude != null && c.longitude != null);
		const leaseCompsWithCoords = leaseComps.filter(c => c.latitude != null && c.longitude != null);
		status.total =
			(saleCompsWithCoords.length > 0 && subjectLat != null ? 1 : 0) +
			(leaseCompsWithCoords.length > 0 && subjectLat != null ? 1 : 0) +
			compsWithApn.length;

		const fetchTasks: Promise<void>[] = [];

		// Comp sale map
		if (saleComps.length > 0 && subjectLat != null && subjectLng != null) {
			fetchTasks.push((async () => {
				const compLocs: CompLocation[] = saleComps
					.filter(c => c.latitude && c.longitude)
					.map((c, i) => ({
						lat: c.latitude!,
						lng: c.longitude!,
						label: String(i + 1)
					}));

				if (compLocs.length > 0) {
					const buffer = await fetchCompMap(subjectLat!, subjectLng!, compLocs);
					if (buffer) {
						clearAutoImages(reportId, 'sales_comparison');
						const filePath = saveImageBuffer(reportId, buffer);
						addSectionImage(reportId, 'sales_comparison', filePath, 'Comparable Sales Location Map', 0, 'auto');
						status.completed++;
					} else {
						status.errors.push('Sale comp map: fetch failed');
					}
				}
			})());
		}

		// Comp lease map
		if (leaseComps.length > 0 && subjectLat != null && subjectLng != null) {
			fetchTasks.push((async () => {
				const compLocs: CompLocation[] = leaseComps
					.filter(c => c.latitude && c.longitude)
					.map((c, i) => ({
						lat: c.latitude!,
						lng: c.longitude!,
						label: String(i + 1)
					}));

				if (compLocs.length > 0) {
					const buffer = await fetchCompMap(subjectLat!, subjectLng!, compLocs);
					if (buffer) {
						clearAutoImages(reportId, 'income_approach');
						const filePath = saveImageBuffer(reportId, buffer);
						addSectionImage(reportId, 'income_approach', filePath, 'Comparable Leases Location Map', 0, 'auto');
						status.completed++;
					} else {
						status.errors.push('Lease comp map: fetch failed');
					}
				}
			})());
		}

		// Comp photos
		const compParcels = comps
			.filter(c => c.apn)
			.map(c => ({
				serial: c.apn!,
				county: 'utah_county' as const, // TODO: detect county from comp
				propertyId: c.property_id,
				rank: c.rank ?? 0,
				compType: c.comp_type
			}));

		if (compParcels.length > 0) {
			fetchTasks.push((async () => {
				const photos = await fetchCompPhotos(
					compParcels.map(c => ({ serial: c.serial, county: c.county }))
				);

				// Clear existing auto-sourced comp photos before inserting (idempotency)
				clearAutoImages(reportId, 'photographs');

				// Save comp photos to photographs section with appropriate captions
				for (const cp of compParcels) {
					const photo = photos.get(cp.serial);
					if (photo) {
						const filePath = saveImageBuffer(reportId, photo, '.jpg');
						const caption = `Comparable ${cp.compType === 'sale' ? 'Sale' : 'Lease'} ${cp.rank} — ${cp.serial}`;
						addSectionImage(reportId, 'photographs', filePath, caption, 10 + cp.rank, 'auto');
						status.completed++;
					} else {
						status.errors.push(`Comp photo ${cp.serial}: not available`);
					}
				}
			})());
		}

		await Promise.allSettled(fetchTasks);

		status.state = 'done';
		const elapsed = ((Date.now() - status.startedAt) / 1000).toFixed(1);
		console.log(`[auto-source] Comp images for report ${reportId}: ${status.completed}/${status.total} sourced in ${elapsed}s`);
	} catch (err) {
		status.state = 'error';
		status.errors.push(String(err));
		console.error('[auto-source] Comp images failed:', err);
	}
}
