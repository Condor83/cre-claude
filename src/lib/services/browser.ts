/**
 * Singleton Playwright browser manager.
 * Launches Chromium with SwiftShader for WebGL rendering of Esri map widgets.
 * Reuses one browser instance across calls. Auto-closes after 5 min idle.
 */

import { chromium, type Browser } from 'playwright';

let _browser: Browser | null = null;
let _idleTimer: ReturnType<typeof setTimeout> | null = null;

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const LAUNCH_ARGS = [
	'--enable-webgl',
	'--use-gl=swiftshader',
	'--enable-unsafe-swiftshader',
	'--disable-dev-shm-usage'
];

/**
 * Get the shared browser instance. Lazy-initializes on first call.
 * Recovers from crashes by detecting disconnected browser and re-launching.
 */
export async function getBrowser(): Promise<Browser> {
	// Crash recovery: if browser exists but is disconnected, discard it
	if (_browser && !_browser.isConnected()) {
		console.log('[browser] Existing browser disconnected, re-launching');
		_browser = null;
	}

	if (!_browser) {
		console.log('[browser] Launching Chromium with SwiftShader');
		_browser = await chromium.launch({
			headless: true,
			args: LAUNCH_ARGS
		});

		// Auto-close if browser process dies unexpectedly
		_browser.on('disconnected', () => {
			console.log('[browser] Browser disconnected');
			_browser = null;
			if (_idleTimer) {
				clearTimeout(_idleTimer);
				_idleTimer = null;
			}
		});
	}

	// Reset idle timer on each access
	if (_idleTimer) clearTimeout(_idleTimer);
	_idleTimer = setTimeout(async () => {
		await closeBrowser();
	}, IDLE_TIMEOUT_MS);

	return _browser;
}

/**
 * Close the shared browser instance.
 */
export async function closeBrowser(): Promise<void> {
	if (_idleTimer) {
		clearTimeout(_idleTimer);
		_idleTimer = null;
	}

	if (_browser) {
		console.log('[browser] Closing browser');
		try {
			await _browser.close();
		} catch { /* already closed */ }
		_browser = null;
	}
}
