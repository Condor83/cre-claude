import { error } from '@sveltejs/kit';
import { getReport, getSections, getReportComps, getPropertyContext, getAllReportImages } from '$lib/db/index.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const reportId = Number(params.id);
	const report = getReport(reportId) as Record<string, unknown> | undefined;
	if (!report) throw error(404, 'Report not found');

	const sections = getSections(reportId) as Array<{
		id: number;
		report_id: number;
		section_key: string;
		content_json: string;
		content_html: string;
		status: string;
		form_data: string;
		last_saved: string;
	}>;
	const comps = getReportComps(reportId) as Array<Record<string, unknown>>;
	const propertyContext = getPropertyContext(reportId);
	const images = getAllReportImages(reportId);

	// Build section status map
	const sectionStatuses: Record<string, string> = {};
	for (const s of sections) {
		sectionStatuses[s.section_key] = s.status || 'empty';
	}

	return {
		report,
		sections,
		comps,
		propertyContext,
		sectionStatuses,
		images
	};
};
