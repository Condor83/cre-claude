import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { saveSection, addReportComp, getDb, updateSectionStatus, saveSectionAutoContent, removeReportComp, reorderReportComps, saveCompSubsection, getReportComps, findOrCreateProperty } from '$lib/db/index.js';
import { assembleContext } from '$lib/copilot/context.js';
import { generateSectionText } from '$lib/copilot/writer.js';
import { buildTemplateContext } from '$lib/templates/context.js';
import { AUTO_TEMPLATES } from '$lib/templates/sections/index.js';
import { renderSubsection } from '$lib/templates/subsections/index.js';
import { getSectionsForApproaches, type SectionDef } from '$lib/config/sections.js';
import { renderAllAutoSubsections } from '$lib/templates/subsections/render-all.js';

// Rebuilds the parent section HTML from SCA intro + comp contents + conclusion
async function rebuildCompSectionHtml(reportId: number, sectionKey: string) {
	const ctx = buildTemplateContext(reportId);
	if (!ctx) return;

	const parts: string[] = [];

	// Intro
	const introFn = AUTO_TEMPLATES['sca_intro'];
	if (introFn) parts.push(introFn(ctx));

	// Comp content_htmls in rank order
	const comps = getReportComps(reportId) as Array<Record<string, unknown>>;
	const compType = sectionKey === 'sales_comparison' ? 'sale' : 'lease';
	const sectionComps = comps.filter(c => c.comp_type === compType);
	for (const comp of sectionComps) {
		if (comp.content_html) {
			parts.push(`<h3>Comparable ${comp.rank} \u2014 ${comp.address}</h3>`);
			parts.push(comp.content_html as string);
		}
	}

	// Conclusion
	const conclusionFn = AUTO_TEMPLATES['sca_conclusion'];
	if (conclusionFn) parts.push(conclusionFn(ctx));

	const fullHtml = parts.join('\n\n');
	saveSection(reportId, sectionKey, '', fullHtml, sectionComps.length > 0 ? 'auto_generated' : 'empty');
}

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
		let propertyId = body.property_id;

		// Fix 2: If county data provided (from parcel fetch), create property server-side
		if (body.county_data && !propertyId) {
			propertyId = findOrCreateProperty({
				address: body.county_data.address,
				city: body.county_data.city,
				state: 'UT',
				apn: body.county_data.apn,
				property_type: body.county_data.property_type,
				year_built: body.county_data.year_built ? Number(body.county_data.year_built) : undefined,
				building_sf: body.county_data.building_sf ? Number(body.county_data.building_sf) : undefined,
				land_sf: body.county_data.land_sf ? Number(body.county_data.land_sf) : undefined,
				land_acres: body.county_data.land_acres ? Number(body.county_data.land_acres) : undefined,
				construction_class: body.county_data.construction_class,
				quality: body.county_data.quality,
				zoning: body.county_data.zoning,
				market_value: body.county_data.market_value ? Number(body.county_data.market_value) : undefined,
				owner_name: body.county_data.owner_name,
				county: body.county_data.county,
				county_data_json: body.county_data_json
			});
		}

		// Render initial comp description from property data
		const db = getDb();
		const prop = db.prepare('SELECT * FROM properties WHERE id = ?').get(propertyId) as Record<string, unknown> | undefined;

		// Auto-find latest sale if not explicitly provided
		let saleId = body.sale_id;
		let saleRow: Record<string, unknown> | undefined;
		if (!saleId && propertyId) {
			saleRow = db.prepare('SELECT * FROM sales WHERE property_id = ? ORDER BY sale_date DESC LIMIT 1').get(propertyId) as Record<string, unknown> | undefined;
			if (saleRow) saleId = saleRow.id as number;
		} else if (saleId) {
			saleRow = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId) as Record<string, unknown> | undefined;
		}

		let contentHtml = '';
		let formData = '';
		if (prop) {
			const { renderCompDesc } = await import('$lib/templates/comp_desc.js');
			const descHtml = renderCompDesc({
				address: prop.address as string,
				city: prop.city as string | null,
				county: prop.county as string | null,
				property_type: prop.property_type as string | null,
				building_sf: prop.building_sf as number | null,
				land_sf: prop.land_sf as number | null,
				land_acres: prop.land_acres as number | null,
				year_built: prop.year_built as number | null,
				stories: prop.stories as number | null,
				construction_class: prop.construction_class as string | null,
				quality: prop.quality as string | null,
				condition: prop.condition as string | null,
				zoning: prop.zoning as string | null,
				owner_name: prop.owner_name as string | null,
				county_data_json: prop.county_data_json as string | null,
				sale_price: saleRow?.sale_price as number | null ?? null,
				sale_date: saleRow?.sale_date as string | null ?? null,
				grantor: saleRow?.grantor as string | null ?? null,
				grantee: saleRow?.grantee as string | null ?? null
			});
			const subsectionHtmls: Record<string, string> = { comp_desc: descHtml };
			formData = JSON.stringify({ _subsection_htmls: subsectionHtmls, _subsection_form_data: {} });
			contentHtml = descHtml;
		}

		const result = addReportComp({
			report_id: reportId,
			comp_type: body.comp_type,
			property_id: propertyId,
			sale_id: saleId,
			lease_id: body.lease_id,
			rank: body.rank,
			content_html: contentHtml,
			form_data: formData
		});

		// Rebuild parent section HTML
		await rebuildCompSectionHtml(reportId, body.comp_type === 'sale' ? 'sales_comparison' : 'income_approach');

		return json({ id: Number(result.lastInsertRowid), property_id: propertyId });
	}

	if (body.action === 'remove_comp') {
		removeReportComp(body.comp_id, reportId);
		const sectionKey = body.comp_type === 'sale' ? 'sales_comparison' : 'income_approach';
		await rebuildCompSectionHtml(reportId, sectionKey);
		return json({ ok: true });
	}

	if (body.action === 'reorder_comps') {
		reorderReportComps(reportId, body.comp_type, body.ordered_ids);
		const sectionKey = body.comp_type === 'sale' ? 'sales_comparison' : 'income_approach';
		await rebuildCompSectionHtml(reportId, sectionKey);
		return json({ ok: true });
	}

	if (body.action === 'save_comp_subsection') {
		const contentHtml = saveCompSubsection(body.comp_id, body.subsection_key, body.html, body.form_data);
		const sectionKey = body.comp_type === 'sale' ? 'sales_comparison' : 'income_approach';
		await rebuildCompSectionHtml(reportId, sectionKey);
		return json({ ok: true, content_html: contentHtml });
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
		}

		// Regenerate all guided section auto-subsections via shared renderer
		const guidedResult = renderAllAutoSubsections(reportId, approaches);
		Object.assign(updated, guidedResult.updated);

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
