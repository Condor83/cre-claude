import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { autoSourceCompImages, getAutoSourceStatus } from '$lib/services/auto-source-images.js';

/**
 * POST /api/auto-source — trigger comp image auto-sourcing
 * Body: { report_id: number }
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const reportId = Number(body.report_id);

	if (!reportId) {
		return json({ error: 'report_id is required' }, { status: 400 });
	}

	// Check if already running
	const existing = getAutoSourceStatus(reportId, 'comps');
	if (existing?.state === 'running') {
		return json({ error: 'Comp image sourcing already in progress' }, { status: 409 });
	}

	// Fire-and-forget
	autoSourceCompImages(reportId).catch(err =>
		console.error('[auto-source API] Comp images failed:', err)
	);

	return json({ ok: true, message: 'Comp image sourcing started' });
};

/**
 * GET /api/auto-source?report_id=X&type=subject|comps — poll for status
 */
export const GET: RequestHandler = async ({ url }) => {
	const reportId = Number(url.searchParams.get('report_id'));
	const type = (url.searchParams.get('type') || 'subject') as 'subject' | 'comps';

	if (!reportId) {
		return json({ error: 'report_id is required' }, { status: 400 });
	}

	const status = getAutoSourceStatus(reportId, type);
	if (!status) {
		return json({ state: 'idle' });
	}

	return json(status);
};
