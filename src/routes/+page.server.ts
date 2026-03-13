import { getDb, listDocuments, listReports } from '$lib/db/index.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const db = getDb();

	const documentCount = (db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number }).count;
	const propertyCount = (db.prepare('SELECT COUNT(*) as count FROM properties').get() as { count: number }).count;
	const reportCount = (db.prepare('SELECT COUNT(*) as count FROM reports').get() as { count: number }).count;

	const documents = listDocuments() as Array<{
		id: number;
		filename: string;
		page_count: number | null;
		status: string;
	}>;

	const reports = listReports() as Array<{
		id: number;
		report_number: string;
		subject_address: string;
		subject_city: string;
		status: string;
	}>;

	return {
		documentCount,
		propertyCount,
		reportCount,
		documents: documents.slice(0, 10),
		reports: reports.slice(0, 10)
	};
};
