import type { RequestHandler } from './$types';
import { generateDocx } from '$lib/export/docx.js';

export const GET: RequestHandler = async ({ url }) => {
	const reportId = Number(url.searchParams.get('report_id'));

	if (!reportId) {
		return new Response('report_id is required', { status: 400 });
	}

	try {
		const buffer = await generateDocx(reportId);

		return new Response(new Uint8Array(buffer), {
			headers: {
				'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				'Content-Disposition': `attachment; filename="report-${reportId}.docx"`
			}
		});
	} catch (err) {
		console.error('DOCX export failed:', err);
		return new Response(`Export failed: ${err}`, { status: 500 });
	}
};
