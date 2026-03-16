import { getPropertyContext, getAllAppraiserSettings, getMarketData, getReportComps, getDb, type PropertyContext } from '$lib/db/index.js';

export interface AppraiserInfo {
	name: string;
	company: string;
	address: string;
	phone: string;
	email: string;
	license_number: string;
	license_state: string;
	certification_type: string;
	cv_text: string;
}

export interface MarketDataEntry {
	data_type: string;
	data_json: string;
	year: number | null;
	source: string | null;
	updated_at: string;
}

export interface TemplateContext extends PropertyContext {
	appraiser: AppraiserInfo;
	approaches_list: string[];
	approach_labels: string[];
	full_address: string;
	county_display: string;
	report_date_formatted: string;
	effective_date_formatted: string;
	market_data: Record<string, unknown>;
	// Comp metadata for SCA intro/conclusion
	comp_count: number;
	comp_counties: string[];
	target_price_psf: number | null;
}

const COUNTY_DISPLAY: Record<string, string> = {
	utah_county: 'Utah',
	salt_lake_county: 'Salt Lake'
};

const DEFAULT_APPRAISER: AppraiserInfo = {
	name: '',
	company: '',
	address: '',
	phone: '',
	email: '',
	license_number: '',
	license_state: 'UT',
	certification_type: 'Certified General Appraiser',
	cv_text: ''
};

const APPROACH_LABELS: Record<string, string> = {
	sales_comparison: 'Sales Comparison Approach',
	income_cap: 'Income Capitalization Approach',
	cost: 'Cost Approach'
};

function formatDate(dateStr: string | null): string {
	if (!dateStr) return 'N/A';
	try {
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
	} catch {
		return dateStr;
	}
}

function parseApproaches(approach: string): string[] {
	try { return JSON.parse(approach); }
	catch { return ['sales_comparison', 'income_cap']; }
}

export function buildTemplateContext(reportId: number): TemplateContext | null {
	const propCtx = getPropertyContext(reportId);
	if (!propCtx) return null;

	const settings = getAllAppraiserSettings();
	const appraiser: AppraiserInfo = {
		name: settings.name ?? DEFAULT_APPRAISER.name,
		company: settings.company ?? DEFAULT_APPRAISER.company,
		address: settings.address ?? DEFAULT_APPRAISER.address,
		phone: settings.phone ?? DEFAULT_APPRAISER.phone,
		email: settings.email ?? DEFAULT_APPRAISER.email,
		license_number: settings.license_number ?? DEFAULT_APPRAISER.license_number,
		license_state: settings.license_state ?? DEFAULT_APPRAISER.license_state,
		certification_type: settings.certification_type ?? DEFAULT_APPRAISER.certification_type,
		cv_text: settings.cv_text ?? DEFAULT_APPRAISER.cv_text
	};

	const approaches = parseApproaches(propCtx.approach);
	const cityState = [propCtx.city, propCtx.state].filter(Boolean).join(', ');
	const fullAddress = [propCtx.address, cityState, propCtx.zip].filter(Boolean).join(' ');

	const countyDisplay = propCtx.county
		? (COUNTY_DISPLAY[propCtx.county] ?? propCtx.county)
		: 'N/A';

	// Load cached market data: county-level (DWS, BEBR) + property-level (UDOT)
	const marketArea = propCtx.county ?? 'utah_county';
	const market_data: Record<string, unknown> = {};

	for (const area of [marketArea, `prop_${propCtx.property_id}`]) {
		const rawMarketData = getMarketData(area) as MarketDataEntry[];
		for (const row of rawMarketData) {
			try {
				market_data[row.data_type] = JSON.parse(row.data_json);
			} catch {
				market_data[row.data_type] = null;
			}
		}
	}

	// Comp metadata
	const comps = getReportComps(reportId) as Array<Record<string, unknown>>;
	const saleComps = comps.filter(c => c.comp_type === 'sale');
	const compCounties = [...new Set(saleComps.map(c => c.county as string).filter(Boolean))];

	// Get target_price_psf from report
	const db = getDb();
	const reportRow = db.prepare('SELECT target_price_psf FROM reports WHERE id = ?').get(reportId) as { target_price_psf: number | null } | undefined;

	return {
		...propCtx,
		appraiser,
		approaches_list: approaches,
		approach_labels: approaches.map(a => APPROACH_LABELS[a] ?? a),
		full_address: fullAddress,
		county_display: countyDisplay,
		report_date_formatted: formatDate(propCtx.report_date),
		effective_date_formatted: formatDate(propCtx.effective_date),
		market_data,
		comp_count: saleComps.length,
		comp_counties: compCounties,
		target_price_psf: reportRow?.target_price_psf ?? null
	};
}
