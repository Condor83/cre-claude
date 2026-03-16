import { error } from '@sveltejs/kit';
import { getReport } from '$lib/db/index.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const reportId = Number(params.id);
	const report = getReport(reportId) as Record<string, unknown> | undefined;
	if (!report) throw error(404, 'Report not found');

	return { report };
};
