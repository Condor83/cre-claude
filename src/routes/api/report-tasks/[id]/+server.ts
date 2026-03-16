import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getReportTasks,
	isAllSettled,
	getSummary,
	subscribe,
	createReportTasks,
	orchestrateReportTasks
} from '$lib/services/task-tracker.js';
import { getReport } from '$lib/db/index.js';

// GET: SSE stream (Accept: text/event-stream) or JSON snapshot
export const GET: RequestHandler = ({ params, request }) => {
	const reportId = Number(params.id);

	// SSE stream
	if (request.headers.get('accept')?.includes('text/event-stream')) {
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			start(controller) {
				const send = (data: unknown) => {
					try {
						controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
					} catch {
						// Controller closed
					}
				};

				// Send current state immediately (handles reconnects)
				const current = getReportTasks(reportId);
				send({ type: 'snapshot', tasks: current ?? [], settled: isAllSettled(reportId) });

				// If tasks exist, subscribe to updates
				if (current) {
					const unsub = subscribe(reportId, (tasks) => {
						const settled = isAllSettled(reportId);
						send({ type: 'update', tasks, settled });
						if (settled) {
							send({ type: 'summary', ...getSummary(reportId) });
						}
					});

					request.signal.addEventListener('abort', () => {
						unsub();
						try { controller.close(); } catch { /* already closed */ }
					});
				} else {
					// No tasks found — send empty and close
					send({ type: 'no_tasks' });
					try { controller.close(); } catch { /* already closed */ }
				}
			}
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive'
			}
		});
	}

	// Regular JSON snapshot
	const tasks = getReportTasks(reportId);
	const settled = isAllSettled(reportId);
	const summary = settled ? getSummary(reportId) : null;
	return json({ tasks, settled, summary });
};

// POST: retry failed tasks or re-run from scratch
export const POST: RequestHandler = async ({ params, request }) => {
	const reportId = Number(params.id);
	const body = await request.json();

	if (body.action === 'retry' || body.action === 'rerun') {
		// Load report context from DB
		const report = getReport(reportId) as Record<string, unknown> | undefined;
		if (!report) return json({ error: 'Report not found' }, { status: 404 });

		let approaches: string[];
		try { approaches = JSON.parse(report.approach as string); }
		catch { approaches = ['sales_comparison', 'income_cap']; }

		const taskDefs = [
			{ id: 'geocode', label: 'Geocoding Address' },
			{ id: 'auto_images', label: 'Sourcing Images' },
			{ id: 'dws_population', label: 'Population Data' },
			{ id: 'dws_employment', label: 'Employment Data' },
			{ id: 'bebr_construction', label: 'Building Permits' },
			{ id: 'udot_access', label: 'Traffic & Access Data' },
			{ id: 'render_subsections', label: 'Rendering Sections' }
		];

		createReportTasks(reportId, taskDefs, approaches);

		// Fire orchestration (non-blocking)
		orchestrateReportTasks(reportId, {
			property: {
				address: report.subject_address as string,
				city: report.subject_city as string,
				state: 'UT',
				county: report.county as string | undefined
			},
			propertyId: report.subject_property_id as number,
			approaches
		});

		return json({ ok: true });
	}

	return json({ error: 'Unknown action' }, { status: 400 });
};
