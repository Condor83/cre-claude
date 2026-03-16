// Task tracker: in-memory state, pub/sub, and orchestration for report creation tasks

import { geocodeAddress } from '$lib/services/geocode.js';
import { autoSourceSubjectImages, getAutoSourceStatus } from '$lib/services/auto-source-images.js';
import { refreshMarketData, refreshUdotData } from '$lib/services/market-data.js';
import { renderAllAutoSubsections } from '$lib/templates/subsections/render-all.js';
import {
	getSectionsForApproaches,
	GUIDED_SUBSECTIONS,
	type SectionDef
} from '$lib/config/sections.js';

// ── Types ──

export type TaskState = 'pending' | 'running' | 'done' | 'failed';

export interface Task {
	id: string;
	label: string;
	state: TaskState;
	detail: string;
	error?: string;
	startedAt?: number;
	completedAt?: number;
}

interface ReportTasks {
	reportId: number;
	tasks: Task[];
	approaches: string[];
	listeners: Set<(tasks: Task[]) => void>;
	createdAt: number;
}

// ── Registry ──

const registry = new Map<number, ReportTasks>();

// Auto-cleanup after 30 minutes
const CLEANUP_MS = 30 * 60 * 1000;
setInterval(() => {
	const now = Date.now();
	for (const [id, entry] of registry) {
		if (now - entry.createdAt > CLEANUP_MS) {
			entry.listeners.clear();
			registry.delete(id);
		}
	}
}, 60_000);

// ── Public API ──

export function createReportTasks(
	reportId: number,
	taskDefs: Array<{ id: string; label: string }>,
	approaches: string[]
): void {
	// Clean up any previous entry
	const prev = registry.get(reportId);
	if (prev) prev.listeners.clear();

	registry.set(reportId, {
		reportId,
		tasks: taskDefs.map(t => ({
			id: t.id,
			label: t.label,
			state: 'pending',
			detail: ''
		})),
		approaches,
		listeners: new Set(),
		createdAt: Date.now()
	});
}

export function updateTask(
	reportId: number,
	taskId: string,
	update: Partial<Pick<Task, 'state' | 'detail' | 'error'>>
): void {
	const entry = registry.get(reportId);
	if (!entry) return;

	const task = entry.tasks.find(t => t.id === taskId);
	if (!task) return;

	if (update.state !== undefined) {
		task.state = update.state;
		if (update.state === 'running') task.startedAt = Date.now();
		if (update.state === 'done' || update.state === 'failed') task.completedAt = Date.now();
	}
	if (update.detail !== undefined) task.detail = update.detail;
	if (update.error !== undefined) task.error = update.error;

	// Notify all listeners
	for (const listener of entry.listeners) {
		listener(entry.tasks);
	}
}

export function subscribe(
	reportId: number,
	listener: (tasks: Task[]) => void
): () => void {
	const entry = registry.get(reportId);
	if (!entry) return () => {};

	entry.listeners.add(listener);
	return () => { entry.listeners.delete(listener); };
}

export function getReportTasks(reportId: number): Task[] | null {
	return registry.get(reportId)?.tasks ?? null;
}

export function isAllSettled(reportId: number): boolean {
	const entry = registry.get(reportId);
	if (!entry) return true;
	return entry.tasks.every(t => t.state === 'done' || t.state === 'failed');
}

export function getSummary(reportId: number): {
	success: number;
	failed: number;
	failedTasks: Array<{ label: string; error: string }>;
	subsectionsRendered: number;
	needsInput: string[];
} {
	const entry = registry.get(reportId);
	if (!entry) return { success: 0, failed: 0, failedTasks: [], subsectionsRendered: 0, needsInput: [] };

	const success = entry.tasks.filter(t => t.state === 'done').length;
	const failed = entry.tasks.filter(t => t.state === 'failed').length;
	const failedTasks = entry.tasks
		.filter(t => t.state === 'failed')
		.map(t => ({ label: t.label, error: t.error ?? 'Unknown error' }));

	// Parse subsections count from render_subsections task detail
	const renderTask = entry.tasks.find(t => t.id === 'render_subsections');
	const subsMatch = renderTask?.detail?.match(/(\d+) subsections/);
	const subsectionsRendered = subsMatch ? parseInt(subsMatch[1]) : 0;

	// Compute "needs your input" from section config
	const needsInput: string[] = [];
	const active = getSectionsForApproaches(entry.approaches) as SectionDef[];
	for (const section of active) {
		const subs = GUIDED_SUBSECTIONS[section.key];
		if (subs?.length) {
			for (const sub of subs) {
				if (sub.requiresOnsite) {
					needsInput.push(sub.label);
				}
			}
		}
		if (section.tier === 'prose' && section.key === 'reconciliation') {
			needsInput.push(section.label);
		}
	}

	return { success, failed, failedTasks, subsectionsRendered, needsInput };
}

// ── Orchestration ──

export interface OrchestrationContext {
	property: { address: string; city: string; state?: string; county?: string };
	propertyId: number;
	approaches: string[];
}

export async function orchestrateReportTasks(
	reportId: number,
	context: OrchestrationContext
): Promise<void> {
	const { property, propertyId, approaches } = context;

	try {
		// Phase 1: Geocode
		updateTask(reportId, 'geocode', { state: 'running', detail: 'Looking up coordinates...' });
		let lat: number | undefined;
		let lng: number | undefined;
		try {
			if (property.address && property.city) {
				const geo = await geocodeAddress(property.address, property.city, property.state || 'UT');
				if (geo) { lat = geo.lat; lng = geo.lng; }
			}
			updateTask(reportId, 'geocode', { state: 'done', detail: lat ? `${lat.toFixed(4)}, ${lng!.toFixed(4)}` : 'Coordinates cached' });
		} catch (err) {
			updateTask(reportId, 'geocode', { state: 'failed', error: String(err), detail: 'Geocoding failed' });
		}

		// Phase 2: Parallel data fetches
		const countyKey = property.county || 'utah_county';
		await Promise.allSettled([
			// Images: function swallows errors internally, so check its status after
			(async () => {
				updateTask(reportId, 'auto_images', { state: 'running' });
				await autoSourceSubjectImages(reportId);
				const imgStatus = getAutoSourceStatus(reportId, 'subject');
				if (imgStatus?.state === 'error') {
					updateTask(reportId, 'auto_images', {
						state: 'failed',
						error: imgStatus.errors.join('; '),
						detail: `${imgStatus.completed}/${imgStatus.total} images`
					});
				} else {
					updateTask(reportId, 'auto_images', {
						state: 'done',
						detail: `${imgStatus?.completed ?? 0}/${imgStatus?.total ?? 7} images sourced`
					});
				}
			})(),
			wrapTask(reportId, 'dws_population', () =>
				refreshMarketData(countyKey, 'dws_population').then(() => undefined)
			),
			wrapTask(reportId, 'dws_employment', () =>
				refreshMarketData(countyKey, 'dws_employment').then(() => undefined)
			),
			wrapTask(reportId, 'bebr_construction', () =>
				refreshMarketData(countyKey, 'bebr_construction').then(() => undefined)
			),
			wrapTask(reportId, 'udot_access', async () => {
				if (lat && lng) {
					await refreshUdotData(propertyId, lat, lng, property.address);
				} else {
					throw new Error('No coordinates available — geocoding may have failed');
				}
			})
		]);

		// Phase 3: Render subsections with fresh data
		updateTask(reportId, 'render_subsections', { state: 'running', detail: 'Building section content...' });
		try {
			const result = renderAllAutoSubsections(reportId, approaches);
			updateTask(reportId, 'render_subsections', {
				state: 'done',
				detail: `${result.subsectionsRendered} subsections across ${result.sectionsUpdated} sections`
			});
		} catch (err) {
			updateTask(reportId, 'render_subsections', {
				state: 'failed',
				error: String(err),
				detail: 'Failed to render sections'
			});
		}
	} catch (err) {
		console.error('[task-tracker] Orchestration error:', err);
	}
}

async function wrapTask(
	reportId: number,
	taskId: string,
	fn: () => Promise<unknown>
): Promise<void> {
	updateTask(reportId, taskId, { state: 'running' });
	try {
		await fn();
		updateTask(reportId, taskId, { state: 'done' });
	} catch (err) {
		updateTask(reportId, taskId, { state: 'failed', error: String(err) });
	}
}
