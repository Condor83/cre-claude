import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { saveSection, addReportComp, getDb } from '$lib/db/index.js';
import { assembleContext } from '$lib/copilot/context.js';
import { generateSectionText } from '$lib/copilot/writer.js';

// Save section content (autosave endpoint)
export const PUT: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const reportId = Number(params.id);

	if (body.action === 'save_section') {
		const { section_key, content_json, content_html } = body;
		saveSection(reportId, section_key, content_json, content_html);
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
