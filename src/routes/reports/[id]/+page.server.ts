import { error } from '@sveltejs/kit';
import { getReport, getSections, getReportComps, getPropertyContext, getAllReportImages, getDb } from '$lib/db/index.js';
import { GUIDED_SUBSECTIONS } from '$lib/config/sections.js';
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

	// Build section status map (includes parent sections + subsections)
	const sectionStatuses: Record<string, string> = {};
	const db = getDb();

	for (const s of sections) {
		sectionStatuses[s.section_key] = s.status || 'empty';

		// For guided sections, derive subsection statuses from form_data + saved dotted keys
		const subs = GUIDED_SUBSECTIONS[s.section_key];
		if (subs?.length && s.form_data) {
			try {
				const fd = JSON.parse(s.form_data);
				const subHtmls = fd._subsection_htmls as Record<string, string> | undefined;
				if (subHtmls) {
					for (const sub of subs) {
						const dottedKey = `${s.section_key}.${sub.key}`;
						// Check if an explicit status was saved for this subsection
						const saved = db.prepare(
							'SELECT status FROM report_sections WHERE report_id = ? AND section_key = ?'
						).get(reportId, dottedKey) as { status: string } | undefined;
						if (saved) {
							sectionStatuses[dottedKey] = saved.status;
						} else if (subHtmls[sub.key]?.trim()) {
							// Has content but no explicit status — mark as auto_generated
							sectionStatuses[dottedKey] = 'auto_generated';
						}
					}
				}
			} catch { /* ignore parse errors */ }
		}
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
