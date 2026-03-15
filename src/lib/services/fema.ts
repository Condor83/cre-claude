/**
 * FEMA FIRMette service.
 * Generates official FEMA FIRMette flood maps via the NFHL Print GP service.
 *
 * Flow:
 *   1. POST submitJob with lat/lng → get jobId
 *   2. Poll jobs/{jobId} until esriJobSucceeded
 *   3. GET jobs/{jobId}/results/OutputFile → PNG URL
 *   4. Download the PNG
 */

import { fetchWithTimeout, fetchBuffer } from './fetch-utils.js';

const GP_SERVICE_URL =
	'https://msc.fema.gov/arcgis/rest/services/NFHL_Print/MSCPrintB/GPServer/PrintFIRMette';

const MAX_POLL_ATTEMPTS = 12;
const POLL_INTERVAL_MS = 3000;

/**
 * Fetch an official FEMA FIRMette PNG centered on the given coordinates.
 * Returns a PNG buffer (~1MB) or null on failure.
 */
export async function fetchFloodMap(lat: number, lng: number): Promise<Buffer | null> {
	try {
		console.log(`[fema] Submitting FIRMette job for ${lat}, ${lng}`);

		// Step 1: Submit the print job
		const submitParams = new URLSearchParams({
			input_lat: String(lat),
			input_lon: String(lng),
			Print_Type: 'FIRMETTE',
			graphic: 'PNG',
			f: 'json'
		});

		const submitRes = await fetchWithTimeout(
			`${GP_SERVICE_URL}/submitJob`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: submitParams.toString()
			},
			15000
		);

		if (!submitRes.ok) {
			console.log(`[fema] Submit job HTTP ${submitRes.status}`);
			return null;
		}

		const submitData = await submitRes.json() as { jobId?: string; jobStatus?: string };
		if (!submitData.jobId) {
			console.log('[fema] No jobId in submit response');
			return null;
		}

		const jobId = submitData.jobId;
		console.log(`[fema] Job submitted: ${jobId}`);

		// Step 2: Poll until complete
		for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
			await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

			const statusRes = await fetchWithTimeout(
				`${GP_SERVICE_URL}/jobs/${jobId}?f=json`,
				undefined,
				10000
			);

			if (!statusRes.ok) continue;

			const statusData = await statusRes.json() as { jobStatus: string };

			if (statusData.jobStatus === 'esriJobSucceeded') {
				console.log(`[fema] Job succeeded after ${(attempt + 1) * POLL_INTERVAL_MS / 1000}s`);
				break;
			}

			if (statusData.jobStatus === 'esriJobFailed') {
				console.log('[fema] Job failed');
				return null;
			}

			// Still processing — continue polling
		}

		// Step 3: Get the output file URL
		const outputRes = await fetchWithTimeout(
			`${GP_SERVICE_URL}/jobs/${jobId}/results/OutputFile?f=json`,
			undefined,
			10000
		);

		if (!outputRes.ok) {
			console.log(`[fema] Output file HTTP ${outputRes.status}`);
			return null;
		}

		const outputData = await outputRes.json() as {
			value?: { url?: string };
		};

		const fileUrl = outputData.value?.url;
		if (!fileUrl) {
			console.log('[fema] No output file URL in response');
			return null;
		}

		// Step 4: Download the PNG
		console.log(`[fema] Downloading FIRMette from ${fileUrl.substring(0, 80)}...`);
		const buffer = await fetchBuffer(fileUrl, 20000);

		if (buffer && buffer.length > 10000) {
			console.log(`[fema] FIRMette downloaded: ${(buffer.length / 1024).toFixed(0)}KB`);
			return buffer;
		}

		console.log('[fema] FIRMette download too small or failed');
		return null;
	} catch (err) {
		console.log('[fema] Failed to fetch FIRMette:', err);
		return null;
	}
}
