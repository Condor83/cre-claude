/**
 * County property photo scraper.
 * Fetches property photos from county assessor websites.
 * Currently supports Utah County; Salt Lake County deferred.
 */

import * as cheerio from 'cheerio';
import { fetchWithTimeout, fetchBuffer } from '$lib/services/fetch-utils.js';

// Utah County photo URL pattern — photos are linked from the appraisal page
const UTAH_COUNTY_APPRAISAL_URL = 'https://www.utahcounty.gov/LandRecords/AppraisalInfo.asp';
const UTAH_COUNTY_BASE = 'https://www.utahcounty.gov';

/**
 * Fetch property photo for a single parcel from the county assessor.
 * Returns photo as Buffer, or null if unavailable.
 */
export async function fetchPropertyPhoto(
	serial: string,
	county: 'utah_county' | 'salt_lake_county'
): Promise<Buffer | null> {
	if (county === 'salt_lake_county') {
		console.log('[county-images] Salt Lake County photos not yet supported');
		return null;
	}

	return fetchUtahCountyPhoto(serial);
}

/**
 * Fetch photos for multiple comp parcels.
 * Returns a map of serial -> Buffer for successful fetches.
 */
export async function fetchCompPhotos(
	compParcels: Array<{ serial: string; county: 'utah_county' | 'salt_lake_county' }>
): Promise<Map<string, Buffer>> {
	const results = new Map<string, Buffer>();

	const fetches = compParcels.map(async ({ serial, county }) => {
		const photo = await fetchPropertyPhoto(serial, county);
		if (photo) {
			results.set(serial, photo);
		}
	});

	await Promise.allSettled(fetches);

	console.log(`[county-images] Fetched ${results.size}/${compParcels.length} comp photos`);
	return results;
}

/**
 * Utah County: scrape the appraisal page for a property photo URL,
 * then fetch the image.
 */
async function fetchUtahCountyPhoto(serial: string): Promise<Buffer | null> {
	const parcelId = serial.replace(/:/g, '');

	try {
		// Fetch the appraisal page
		const res = await fetchWithTimeout(
			`${UTAH_COUNTY_APPRAISAL_URL}?avParcelId=${parcelId}`,
			undefined,
			10000
		);
		if (!res.ok) {
			console.log(`[county-images] Appraisal page HTTP ${res.status} for ${serial}`);
			return null;
		}

		const html = await res.text();
		const $ = cheerio.load(html);

		// Look for property photo — typically an <img> tag with src containing 'photo' or 'image'
		// Utah County uses <img> tags within the page, often with src like "/LandRecords/photos/..."
		let photoUrl: string | null = null;

		$('img').each(function () {
			const src = $(this).attr('src');
			if (!src) return;

			// Match photo URLs — look for patterns indicating property photos
			const srcLower = src.toLowerCase();
			if (
				srcLower.includes('photo') ||
				srcLower.includes('parcelphoto') ||
				srcLower.includes('propertyimage') ||
				srcLower.includes('/photos/') ||
				srcLower.includes('image.asp')
			) {
				photoUrl = src;
				return false; // break
			}
		});

		// Also check for links to photo pages
		if (!photoUrl) {
			$('a').each(function () {
				const href = $(this).attr('href');
				if (!href) return;
				const hrefLower = href.toLowerCase();
				if (hrefLower.includes('photo') || hrefLower.includes('image')) {
					const img = $(this).find('img');
					if (img.length) {
						photoUrl = img.attr('src') || null;
						return false;
					}
				}
			});
		}

		if (!photoUrl) {
			console.log(`[county-images] No photo found on appraisal page for ${serial}`);
			return null;
		}

		// Resolve relative URL and enforce origin allowlist (SSRF prevention)
		let resolvedUrl: string = photoUrl;
		if (resolvedUrl.startsWith('/')) {
			resolvedUrl = `${UTAH_COUNTY_BASE}${resolvedUrl}`;
		} else if (!resolvedUrl.startsWith('http')) {
			resolvedUrl = `${UTAH_COUNTY_BASE}/LandRecords/${resolvedUrl}`;
		}

		if (!resolvedUrl.startsWith(UTAH_COUNTY_BASE)) {
			console.log(`[county-images] Rejecting off-origin photo URL: ${resolvedUrl}`);
			return null;
		}

		console.log(`[county-images] Found photo URL for ${serial}: ${resolvedUrl}`);
		return fetchBuffer(resolvedUrl, 10000);
	} catch (err) {
		console.log(`[county-images] Failed to fetch photo for ${serial}:`, err);
		return null;
	}
}
