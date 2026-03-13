import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createReport, listReports } from '$lib/db/index.js';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();

	const { subject_property_id, report_number, approach, effective_date } = body;

	if (!subject_property_id || !approach) {
		return json({ error: 'subject_property_id and approach are required' }, { status: 400 });
	}

	const result = createReport({
		subject_property_id,
		report_number,
		approach,
		effective_date
	});

	return json({ id: Number(result.lastInsertRowid) });
};

export const GET: RequestHandler = async () => {
	const reports = listReports();
	return json(reports);
};
