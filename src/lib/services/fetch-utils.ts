/**
 * Shared fetch utility with timeout support.
 * Used by all auto-source services to avoid repeating timeout/error patterns.
 */

export async function fetchWithTimeout(
	url: string,
	options?: RequestInit,
	timeoutMs = 10000
): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		return await fetch(url, {
			...options,
			signal: controller.signal
		});
	} finally {
		clearTimeout(timeout);
	}
}

/**
 * Fetch a URL and return the response body as a Buffer, or null on failure.
 */
export async function fetchBuffer(
	url: string,
	timeoutMs = 10000
): Promise<Buffer | null> {
	try {
		const res = await fetchWithTimeout(url, undefined, timeoutMs);
		if (!res.ok) {
			// Strip API keys from logged URLs
			const safeUrl = url.replace(/key=[^&]+/, 'key=***');
			console.log(`[fetch-utils] HTTP ${res.status} for ${safeUrl}`);
			return null;
		}
		return Buffer.from(await res.arrayBuffer());
	} catch (err) {
		if ((err as Error).name === 'AbortError') {
			console.log(`[fetch-utils] Timeout (${timeoutMs}ms) for ${url}`);
		} else {
			console.log(`[fetch-utils] Fetch failed for ${url}:`, err);
		}
		return null;
	}
}
