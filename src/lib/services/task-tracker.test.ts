import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies before importing task-tracker
vi.mock('$lib/services/geocode.js', () => ({
	geocodeAddress: vi.fn().mockResolvedValue({ lat: 40.0, lng: -111.7 })
}));
vi.mock('$lib/services/auto-source-images.js', () => ({
	autoSourceSubjectImages: vi.fn().mockResolvedValue(undefined),
	getAutoSourceStatus: vi.fn().mockReturnValue({ state: 'done', completed: 5, total: 7, errors: [] })
}));
vi.mock('$lib/services/market-data.js', () => ({
	refreshMarketData: vi.fn().mockResolvedValue({ data: {}, fresh: true }),
	refreshUdotData: vi.fn().mockResolvedValue(true)
}));
vi.mock('$lib/templates/subsections/render-all.js', () => ({
	renderAllAutoSubsections: vi.fn().mockReturnValue({
		sectionsUpdated: 3,
		subsectionsRendered: 12,
		updated: {}
	})
}));
vi.mock('$lib/config/sections.js', () => ({
	getSectionsForApproaches: vi.fn().mockReturnValue([
		{ key: 'neighborhood', tier: 'guided', label: 'Neighborhood' },
		{ key: 'reconciliation', tier: 'prose', label: 'Reconciliation' }
	]),
	GUIDED_SUBSECTIONS: {
		neighborhood: [
			{ key: 'nbhd_boundaries', label: 'Boundaries', tier: 'freeform', requiresOnsite: true },
			{ key: 'nbhd_population_table', label: 'Population Table', tier: 'auto' }
		]
	}
}));

import {
	createReportTasks,
	updateTask,
	subscribe,
	getReportTasks,
	isAllSettled,
	getSummary,
	orchestrateReportTasks
} from './task-tracker.js';

const TASK_DEFS = [
	{ id: 'geocode', label: 'Geocoding' },
	{ id: 'auto_images', label: 'Images' },
	{ id: 'dws_population', label: 'Population' }
];

describe('task-tracker', () => {
	beforeEach(() => {
		// Create fresh tasks for each test
		createReportTasks(999, TASK_DEFS, ['sales_comparison']);
	});

	it('createReportTasks: registers tasks with correct initial state', () => {
		const tasks = getReportTasks(999);
		expect(tasks).toHaveLength(3);
		expect(tasks![0]).toMatchObject({ id: 'geocode', label: 'Geocoding', state: 'pending', detail: '' });
		expect(tasks![1]).toMatchObject({ id: 'auto_images', state: 'pending' });
		expect(tasks![2]).toMatchObject({ id: 'dws_population', state: 'pending' });
	});

	it('updateTask: transitions state correctly', () => {
		updateTask(999, 'geocode', { state: 'running' });
		expect(getReportTasks(999)![0].state).toBe('running');
		expect(getReportTasks(999)![0].startedAt).toBeGreaterThan(0);

		updateTask(999, 'geocode', { state: 'done', detail: '40.0, -111.7' });
		expect(getReportTasks(999)![0].state).toBe('done');
		expect(getReportTasks(999)![0].completedAt).toBeGreaterThan(0);
		expect(getReportTasks(999)![0].detail).toBe('40.0, -111.7');
	});

	it('updateTask: notifies subscribers on every update', () => {
		const listener = vi.fn();
		subscribe(999, listener);

		updateTask(999, 'geocode', { state: 'running' });
		expect(listener).toHaveBeenCalledTimes(1);

		updateTask(999, 'geocode', { state: 'done' });
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it('isAllSettled: false when any task pending/running', () => {
		expect(isAllSettled(999)).toBe(false);

		updateTask(999, 'geocode', { state: 'done' });
		updateTask(999, 'auto_images', { state: 'done' });
		expect(isAllSettled(999)).toBe(false); // dws_population still pending

		updateTask(999, 'dws_population', { state: 'running' });
		expect(isAllSettled(999)).toBe(false);
	});

	it('isAllSettled: true when all done/failed', () => {
		updateTask(999, 'geocode', { state: 'done' });
		updateTask(999, 'auto_images', { state: 'failed', error: 'timeout' });
		updateTask(999, 'dws_population', { state: 'done' });
		expect(isAllSettled(999)).toBe(true);
	});

	it('getSummary: counts success/failed correctly', () => {
		updateTask(999, 'geocode', { state: 'done' });
		updateTask(999, 'auto_images', { state: 'failed', error: 'HTTP 500' });
		updateTask(999, 'dws_population', { state: 'done' });

		const summary = getSummary(999);
		expect(summary.success).toBe(2);
		expect(summary.failed).toBe(1);
		expect(summary.failedTasks).toEqual([{ label: 'Images', error: 'HTTP 500' }]);
	});

	it('getSummary: includes needsInput list from config', () => {
		const summary = getSummary(999);
		expect(summary.needsInput).toContain('Boundaries');
		expect(summary.needsInput).toContain('Reconciliation');
		expect(summary.needsInput).not.toContain('Population Table');
	});

	it('subscribe/unsubscribe: listener stops receiving updates', () => {
		const listener = vi.fn();
		const unsub = subscribe(999, listener);

		updateTask(999, 'geocode', { state: 'running' });
		expect(listener).toHaveBeenCalledTimes(1);

		unsub();
		updateTask(999, 'geocode', { state: 'done' });
		expect(listener).toHaveBeenCalledTimes(1); // no more calls
	});

	it('no-op: updateTask on nonexistent registry does not throw', () => {
		expect(() => updateTask(8888, 'geocode', { state: 'running' })).not.toThrow();
	});

	it('getReportTasks: returns null for unknown reportId', () => {
		expect(getReportTasks(7777)).toBeNull();
	});

	it('isAllSettled: true for unknown reportId', () => {
		expect(isAllSettled(7777)).toBe(true);
	});

	it('orchestrateReportTasks: runs all phases', async () => {
		const { geocodeAddress } = await import('$lib/services/geocode.js');
		const { autoSourceSubjectImages } = await import('$lib/services/auto-source-images.js');
		const { renderAllAutoSubsections } = await import('$lib/templates/subsections/render-all.js');

		const fullDefs = [
			{ id: 'geocode', label: 'Geocoding' },
			{ id: 'auto_images', label: 'Images' },
			{ id: 'dws_population', label: 'Population' },
			{ id: 'dws_employment', label: 'Employment' },
			{ id: 'bebr_construction', label: 'Permits' },
			{ id: 'udot_access', label: 'UDOT' },
			{ id: 'render_subsections', label: 'Render' }
		];
		createReportTasks(100, fullDefs, ['sales_comparison']);

		await orchestrateReportTasks(100, {
			property: { address: '123 Main St', city: 'Provo', state: 'UT', county: 'utah_county' },
			propertyId: 1,
			approaches: ['sales_comparison']
		});

		expect(geocodeAddress).toHaveBeenCalled();
		expect(autoSourceSubjectImages).toHaveBeenCalledWith(100);
		expect(renderAllAutoSubsections).toHaveBeenCalledWith(100, ['sales_comparison']);
		expect(isAllSettled(100)).toBe(true);

		const tasks = getReportTasks(100)!;
		expect(tasks.find(t => t.id === 'geocode')!.state).toBe('done');
		expect(tasks.find(t => t.id === 'render_subsections')!.state).toBe('done');
	});

	it('orchestrateReportTasks: failed geocode still completes other tasks', async () => {
		const { geocodeAddress } = await import('$lib/services/geocode.js');
		vi.mocked(geocodeAddress).mockRejectedValueOnce(new Error('API timeout'));

		const fullDefs = [
			{ id: 'geocode', label: 'Geocoding' },
			{ id: 'auto_images', label: 'Images' },
			{ id: 'dws_population', label: 'Population' },
			{ id: 'dws_employment', label: 'Employment' },
			{ id: 'bebr_construction', label: 'Permits' },
			{ id: 'udot_access', label: 'UDOT' },
			{ id: 'render_subsections', label: 'Render' }
		];
		createReportTasks(101, fullDefs, ['sales_comparison']);

		await orchestrateReportTasks(101, {
			property: { address: '123 Main St', city: 'Provo', state: 'UT', county: 'utah_county' },
			propertyId: 1,
			approaches: ['sales_comparison']
		});

		expect(isAllSettled(101)).toBe(true);
		const tasks = getReportTasks(101)!;
		expect(tasks.find(t => t.id === 'geocode')!.state).toBe('failed');
		// UDOT should fail too (no coords)
		expect(tasks.find(t => t.id === 'udot_access')!.state).toBe('failed');
		// DWS tasks should still succeed
		expect(tasks.find(t => t.id === 'dws_population')!.state).toBe('done');
		// Render should still succeed
		expect(tasks.find(t => t.id === 'render_subsections')!.state).toBe('done');
	});

	it('orchestrateReportTasks: images task uses internal status for done detail', async () => {
		const { getAutoSourceStatus } = await import('$lib/services/auto-source-images.js');
		vi.mocked(getAutoSourceStatus).mockReturnValueOnce({
			state: 'done', completed: 5, total: 7, errors: [], startedAt: Date.now()
		});

		const fullDefs = [
			{ id: 'geocode', label: 'Geocoding' },
			{ id: 'auto_images', label: 'Images' },
			{ id: 'dws_population', label: 'Population' },
			{ id: 'dws_employment', label: 'Employment' },
			{ id: 'bebr_construction', label: 'Permits' },
			{ id: 'udot_access', label: 'UDOT' },
			{ id: 'render_subsections', label: 'Render' }
		];
		createReportTasks(102, fullDefs, ['sales_comparison']);

		await orchestrateReportTasks(102, {
			property: { address: '123 Main St', city: 'Provo', state: 'UT', county: 'utah_county' },
			propertyId: 1,
			approaches: ['sales_comparison']
		});

		const imgTask = getReportTasks(102)!.find(t => t.id === 'auto_images')!;
		expect(imgTask.state).toBe('done');
		expect(imgTask.detail).toContain('5/7');
	});

	it('orchestrateReportTasks: images task reports failed when internal status is error', async () => {
		const { getAutoSourceStatus } = await import('$lib/services/auto-source-images.js');
		vi.mocked(getAutoSourceStatus).mockReturnValueOnce({
			state: 'error', completed: 2, total: 7, errors: ['Flood map: timeout', 'Parcel: not available'], startedAt: Date.now()
		});

		const fullDefs = [
			{ id: 'geocode', label: 'Geocoding' },
			{ id: 'auto_images', label: 'Images' },
			{ id: 'dws_population', label: 'Population' },
			{ id: 'dws_employment', label: 'Employment' },
			{ id: 'bebr_construction', label: 'Permits' },
			{ id: 'udot_access', label: 'UDOT' },
			{ id: 'render_subsections', label: 'Render' }
		];
		createReportTasks(103, fullDefs, ['sales_comparison']);

		await orchestrateReportTasks(103, {
			property: { address: '123 Main St', city: 'Provo', state: 'UT', county: 'utah_county' },
			propertyId: 1,
			approaches: ['sales_comparison']
		});

		const imgTask = getReportTasks(103)!.find(t => t.id === 'auto_images')!;
		expect(imgTask.state).toBe('failed');
		expect(imgTask.error).toContain('Flood map: timeout');
		expect(imgTask.detail).toContain('2/7');
	});
});
