// Shared auto-subsection renderer — used by both POST /reports (creation)
// and PUT /reports/[id] (regenerate_all_auto)

import { buildTemplateContext } from '../context.js';
import { getSectionsForApproaches, GUIDED_SUBSECTIONS, type SectionDef } from '$lib/config/sections.js';
import { renderSubsection, buildParentHtml } from './index.js';
import { saveSectionAutoContent, saveSection, getDb } from '$lib/db/index.js';

export function renderAllAutoSubsections(
	reportId: number,
	approaches: string[]
): { sectionsUpdated: number; subsectionsRendered: number; updated: Record<string, string> } {
	const ctx = buildTemplateContext(reportId);
	if (!ctx) return { sectionsUpdated: 0, subsectionsRendered: 0, updated: {} };

	const db = getDb();
	const active = getSectionsForApproaches(approaches) as SectionDef[];
	let sectionsUpdated = 0;
	let subsectionsRendered = 0;
	const updated: Record<string, string> = {};

	for (const section of active) {
		const subsections = GUIDED_SUBSECTIONS[section.key];
		if (section.tier !== 'guided' || !subsections?.length) continue;

		// Load existing form_data (preserves freeform content + per-subsection options)
		const existing = db.prepare(
			'SELECT form_data FROM report_sections WHERE report_id = ? AND section_key = ?'
		).get(reportId, section.key) as { form_data: string | null } | undefined;

		let existingFormData: Record<string, unknown> = {};
		if (existing?.form_data) {
			try { existingFormData = JSON.parse(existing.form_data); } catch { /* ignore */ }
		}

		const subHtmls: Record<string, string> =
			(existingFormData._subsection_htmls as Record<string, string>) ?? {};
		const subFormData: Record<string, Record<string, unknown>> =
			(existingFormData._subsection_form_data as Record<string, Record<string, unknown>>) ?? {};

		let changed = false;
		for (const sub of subsections) {
			if (sub.tier === 'auto') {
				const subOptions = subFormData[sub.key];
				const html = renderSubsection(sub.key, ctx, subOptions);
				if (html != null) {
					subHtmls[sub.key] = html;
					subsectionsRendered++;
					changed = true;
				}
			}
		}

		if (changed) {
			const parentHtml = buildParentHtml(
				subsections.map(s => s.key),
				subHtmls
			);
			const formDataStr = JSON.stringify({
				_subsection_htmls: subHtmls,
				_subsection_form_data: subFormData
			});
			saveSectionAutoContent(reportId, section.key, parentHtml);
			saveSection(reportId, section.key, '', parentHtml, 'auto_generated', formDataStr);
			updated[section.key] = parentHtml;
			sectionsUpdated++;
		}
	}

	return { sectionsUpdated, subsectionsRendered, updated };
}
