import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { saveSection, addReportComp, getDb, updateSectionStatus, saveSectionAutoContent } from '$lib/db/index.js';
import { assembleContext } from '$lib/copilot/context.js';
import { generateSectionText } from '$lib/copilot/writer.js';
import { buildTemplateContext } from '$lib/templates/context.js';
import { AUTO_TEMPLATES } from '$lib/templates/sections/index.js';
import { renderSubsection } from '$lib/templates/subsections/index.js';
import { getSectionsForApproaches, GUIDED_SUBSECTIONS, type SectionDef } from '$lib/config/sections.js';

// Save section content (autosave endpoint)
export const PUT: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const reportId = Number(params.id);

	if (body.action === 'save_section') {
		const { section_key, content_json, content_html, status, form_data } = body;
		saveSection(reportId, section_key, content_json, content_html, status, form_data);
		return json({ ok: true });
	}

	if (body.action === 'update_section_status') {
		const { section_key, status } = body;
		updateSectionStatus(reportId, section_key, status);
		return json({ ok: true });
	}

	if (body.action === 'add_comp') {
		const result = addReportComp({
			report_id: reportId,
			comp_type: body.comp_type,
			property_id: body.property_id,
			sale_id: body.sale_id,
			lease_id: body.lease_id,
			rank: body.rank
		});
		return json({ id: Number(result.lastInsertRowid) });
	}

	if (body.action === 'update_comp') {
		const db = getDb();
		db.prepare('UPDATE report_comps SET adjustment_json = ?, analysis_text = ? WHERE id = ?').run(
			body.adjustment_json ?? null,
			body.analysis_text ?? null,
			body.comp_id
		);
		return json({ ok: true });
	}

	if (body.action === 'update_status') {
		const db = getDb();
		db.prepare('UPDATE reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
			body.status,
			reportId
		);
		return json({ ok: true });
	}

	if (body.action === 'regenerate_section') {
		const { section_key, options } = body;
		const ctx = buildTemplateContext(reportId);
		if (!ctx) return json({ error: 'Report context not found' }, { status: 404 });
		const renderFn = AUTO_TEMPLATES[section_key];
		if (!renderFn) return json({ error: `No AUTO template for ${section_key}` }, { status: 400 });
		const html = renderFn(ctx, options);
		// Force overwrite — uses saveSection directly to bypass the guard
		const formData = options ? JSON.stringify(options) : undefined;
		saveSection(reportId, section_key, '', html, 'auto_generated', formData);
		return json({ ok: true, html });
	}

	if (body.action === 'regenerate_subsection') {
		const { section_key, subsection_key } = body;
		const ctx = buildTemplateContext(reportId);
		if (!ctx) return json({ error: 'Report context not found' }, { status: 404 });

		// Get form_data options for this subsection
		const db = getDb();
		const existing = db.prepare('SELECT form_data FROM report_sections WHERE report_id = ? AND section_key = ?').get(reportId, section_key) as { form_data: string | null } | undefined;
		let subOptions: Record<string, unknown> | undefined;
		if (existing?.form_data) {
			try {
				const fd = JSON.parse(existing.form_data);
				subOptions = fd._subsection_form_data?.[subsection_key];
			} catch { /* ignore */ }
		}

		const html = renderSubsection(subsection_key, ctx, subOptions);
		if (html == null) {
			return json({ error: `No auto template for subsection ${subsection_key}` }, { status: 400 });
		}
		return json({ ok: true, html });
	}

	if (body.action === 'regenerate_all_auto') {
		const ctx = buildTemplateContext(reportId);
		if (!ctx) return json({ error: 'Report context not found' }, { status: 404 });
		const db = getDb();
		const approaches = (() => { try { return JSON.parse(ctx.approach); } catch { return ['sales_comparison', 'income_cap']; } })();
		const activeSections = getSectionsForApproaches(approaches) as SectionDef[];
		const updated: Record<string, string> = {};

		for (const section of activeSections) {
			if (section.tier === 'auto' && AUTO_TEMPLATES[section.key]) {
				// Preserve saved form_data options (e.g. year range on assessment_taxes)
				let options: Record<string, unknown> | undefined;
				const existing = db.prepare('SELECT form_data FROM report_sections WHERE report_id = ? AND section_key = ?').get(reportId, section.key) as { form_data: string | null } | undefined;
				if (existing?.form_data) {
					try { options = JSON.parse(existing.form_data); } catch { /* ignore */ }
				}
				const html = AUTO_TEMPLATES[section.key](ctx, options);
				saveSection(reportId, section.key, '', html, 'auto_generated');
				updated[section.key] = html;
			}

			// Also regenerate auto subsections for guided sections
			const subsections = GUIDED_SUBSECTIONS[section.key];
			if (section.tier === 'guided' && subsections?.length) {
				const existing = db.prepare('SELECT form_data FROM report_sections WHERE report_id = ? AND section_key = ?').get(reportId, section.key) as { form_data: string | null } | undefined;
				let existingFormData: Record<string, unknown> = {};
				if (existing?.form_data) {
					try { existingFormData = JSON.parse(existing.form_data); } catch { /* ignore */ }
				}

				const subHtmls: Record<string, string> = (existingFormData._subsection_htmls as Record<string, string>) ?? {};
				const subFormData: Record<string, Record<string, unknown>> = (existingFormData._subsection_form_data as Record<string, Record<string, unknown>>) ?? {};

				let changed = false;
				for (const sub of subsections) {
					if (sub.tier === 'auto') {
						const subOptions = subFormData[sub.key];
						const html = renderSubsection(sub.key, ctx, subOptions);
						if (html != null) {
							subHtmls[sub.key] = html;
							changed = true;
						} else {
							console.warn(`[regenerate] No template for subsection ${sub.key} in ${section.key}`);
						}
					}
				}

				if (changed) {
					// Rebuild parent content_html
					const parentHtml = subsections
						.map(s => subHtmls[s.key] ?? '')
						.filter(h => h.trim().length > 0)
						.join('\n\n');

					const formDataStr = JSON.stringify({
						_subsection_htmls: subHtmls,
						_subsection_form_data: subFormData
					});

					saveSection(reportId, section.key, '', parentHtml, 'auto_generated', formDataStr);
					updated[section.key] = parentHtml;
				}
			}
		}
		return json({ ok: true, count: Object.keys(updated).length, updated });
	}

	if (body.action === 'update_property') {
		const db = getDb();
		const report = db.prepare('SELECT subject_property_id FROM reports WHERE id = ?').get(reportId) as { subject_property_id: number } | undefined;
		if (!report) return json({ error: 'Report not found' }, { status: 404 });

		const p = body.property;
		db.prepare(`
			UPDATE properties SET
				address = ?, city = ?, state = ?, zip = ?, county = ?,
				apn = ?, property_type = ?, zoning = ?, owner_name = ?,
				building_sf = ?, year_built = ?, stories = ?,
				construction_class = ?, quality = ?, condition = ?,
				land_sf = ?, land_acres = ?,
				market_value = ?, occupancy = ?, acquisition_date = ?,
				updated_at = CURRENT_TIMESTAMP
			WHERE id = ?
		`).run(
			p.address ?? null, p.city ?? null, p.state ?? null, p.zip ?? null, p.county ?? null,
			p.apn ?? null, p.property_type ?? null, p.zoning ?? null, p.owner_name ?? null,
			p.building_sf ?? null, p.year_built ?? null, p.stories ?? null,
			p.construction_class ?? null, p.quality ?? null, p.condition ?? null,
			p.land_sf ?? null, p.land_acres ?? null,
			p.market_value ?? null, p.occupancy ?? null, p.acquisition_date ?? null,
			report.subject_property_id
		);
		return json({ ok: true });
	}

	return json({ error: 'Unknown action' }, { status: 400 });
};

// Copilot generation endpoint
export const POST: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const reportId = Number(params.id);

	if (body.action === 'generate') {
		const { section_key, user_text } = body;
		const context = await assembleContext(reportId, section_key);
		const result = await generateSectionText(section_key, context, user_text);
		return json(result);
	}

	return json({ error: 'Unknown action' }, { status: 400 });
};
