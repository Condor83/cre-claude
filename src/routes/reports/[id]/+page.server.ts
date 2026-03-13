import { error } from '@sveltejs/kit';
import { getReport, getSections, getReportComps } from '$lib/db/index.js';
import type { PageServerLoad } from './$types';

interface ReportRow {
	id: number;
	report_number: string;
	subject_property_id: number;
	approach: string;
	effective_date: string;
	status: string;
	subject_address: string;
	subject_city: string;
}

interface SectionRow {
	id: number;
	report_id: number;
	section_key: string;
	content_json: string;
	content_html: string;
	last_saved: string;
}

interface CompRow {
	id: number;
	report_id: number;
	comp_type: string;
	property_id: number;
	sale_id: number | null;
	lease_id: number | null;
	rank: number;
	adjustment_json: string;
	analysis_text: string;
	address: string;
	city: string;
	building_sf: number;
	year_built: number;
	property_type: string;
	sale_date: string;
	sale_price: number;
	price_per_sf: number;
	sale_cap_rate: number;
	tenant_name: string;
	rent_per_sf: number;
	lease_type: string;
	sale_mls_sourced: boolean;
	lease_mls_sourced: boolean;
}

export const load: PageServerLoad = async ({ params }) => {
	const report = getReport(Number(params.id)) as ReportRow | undefined;
	if (!report) throw error(404, 'Report not found');

	const sections = getSections(Number(params.id)) as SectionRow[];
	const comps = getReportComps(Number(params.id)) as CompRow[];

	return {
		report,
		sections,
		comps
	};
};
