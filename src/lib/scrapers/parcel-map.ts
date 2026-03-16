/**
 * Utah County parcel map scraper.
 * Uses Playwright to screenshot the county's Esri-based parcel map,
 * returning two images: parcel boundary on default basemap + satellite aerial.
 * Both share the same zoom/extent for perfect alignment.
 */

import { getBrowser } from '$lib/services/browser.js';

const PARCEL_MAP_URL = 'https://maps.utahcounty.gov/ParcelMap/ParcelMap.html';
const MIN_IMAGE_SIZE = 20_000; // 20KB — below this, canvas likely didn't render

export interface ParcelMapResult {
	boundary: Buffer | null;
	aerial: Buffer | null;
}

// JS to hide Calcite/Esri UI chrome for clean screenshots
const HIDE_CHROME_JS = `
	document.querySelectorAll('calcite-action-bar, calcite-shell-panel, calcite-panel')
		.forEach(function(el) { el.style.display = 'none'; });
	document.querySelectorAll('.esri-ui-corner')
		.forEach(function(el) { el.style.display = 'none'; });
`;

/**
 * Fetch two screenshots from the Utah County ParcelMap:
 *   1. Parcel boundary on default basemap
 *   2. Parcel boundary on satellite/aerial imagery
 *
 * @param serial Parcel serial number (with or without colons)
 */
export async function fetchParcelMapImages(serial: string): Promise<ParcelMapResult> {
	const digits = serial.replace(/:/g, '');
	const result: ParcelMapResult = { boundary: null, aerial: null };

	let page = null;
	try {
		const browser = await getBrowser();
		page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
		page.setDefaultTimeout(45_000);

		console.log(`[parcel-map] Navigating for serial ${digits}`);
		await page.goto(`${PARCEL_MAP_URL}?serial=${digits}`, { waitUntil: 'domcontentloaded' });

		// Wait for the Esri map canvas to appear
		await page.waitForSelector('canvas', { timeout: 15_000 });
		await page.waitForTimeout(5000);

		// Ensure the search panel is open
		const serialInput = page.locator('input[placeholder="Enter Serial"]');
		const alreadyVisible = await serialInput.isVisible().catch(() => false);

		if (!alreadyVisible) {
			// Click the Search action in the calcite action bar to open the panel
			const searchAction = page.locator('calcite-action[text="Search"], calcite-action[icon="search"]').first();
			await searchAction.click({ timeout: 5000 }).catch(() => {
				console.log('[parcel-map] Search action click failed');
			});
			await page.waitForTimeout(2000);
		}

		await serialInput.waitFor({ state: 'visible', timeout: 10_000 });
		await serialInput.fill(digits);
		await page.waitForTimeout(500);
		await serialInput.press('Enter');

		// Wait for map to zoom to the parcel
		console.log('[parcel-map] Waiting for map to zoom to parcel...');
		await page.waitForTimeout(3000);
		await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {});
		await page.waitForTimeout(3000);

		// Hide sidebar and UI chrome
		await page.evaluate(HIDE_CHROME_JS);
		await page.waitForTimeout(300);

		// Screenshot #1: parcel boundary on default basemap
		const boundaryBuf = await page.screenshot({ type: 'png' });
		if (boundaryBuf.length >= MIN_IMAGE_SIZE) {
			result.boundary = Buffer.from(boundaryBuf);
			console.log(`[parcel-map] Boundary screenshot: ${(boundaryBuf.length / 1024).toFixed(0)}KB`);
		} else {
			console.log(`[parcel-map] Boundary screenshot too small (${boundaryBuf.length}B), likely blank`);
		}

		// Switch to satellite basemap
		try {
			// Re-show Esri UI so the toggle button is clickable
			await page.evaluate(`
				document.querySelectorAll('.esri-ui-corner')
					.forEach(function(el) { el.style.display = ''; });
			`);
			await page.waitForTimeout(300);

			const toggleBtn = page.locator('calcite-action[text="Toggle basemap"], [title="Toggle basemap"]').first();
			await toggleBtn.click({ timeout: 5000 });
			console.log('[parcel-map] Toggled to satellite basemap');

			// Wait for satellite tiles to load
			await page.waitForTimeout(3000);
			await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
			await page.waitForTimeout(2000);

			// Hide UI again
			await page.evaluate(HIDE_CHROME_JS);
			await page.waitForTimeout(300);

			// Screenshot #2: parcel boundary on aerial imagery
			const aerialBuf = await page.screenshot({ type: 'png' });
			if (aerialBuf.length >= MIN_IMAGE_SIZE) {
				result.aerial = Buffer.from(aerialBuf);
				console.log(`[parcel-map] Aerial screenshot: ${(aerialBuf.length / 1024).toFixed(0)}KB`);
			} else {
				console.log(`[parcel-map] Aerial screenshot too small (${aerialBuf.length}B), likely blank`);
			}
		} catch (err) {
			console.log('[parcel-map] Basemap toggle failed, skipping aerial:', err);
		}

		console.log(`[parcel-map] Done: boundary=${!!result.boundary}, aerial=${!!result.aerial}`);
	} catch (err) {
		console.log(`[parcel-map] Failed for serial ${digits}:`, err);
	} finally {
		if (page) {
			await page.close().catch(() => {});
		}
	}

	return result;
}
