import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createReport, findOrCreateProperty, listReports, saveSectionAutoContent, saveSection } from '$lib/db/index.js';
import { buildTemplateContext } from '$lib/templates/context.js';
import { AUTO_TEMPLATES } from '$lib/templates/sections/index.js';
import { getSectionsForApproaches, GUIDED_SUBSECTIONS, type SectionDef } from '$lib/config/sections.js';
import { renderSubsection } from '$lib/templates/subsections/index.js';
import { autoSourceSubjectImages } from '$lib/services/auto-source-images.js';
import { refreshAllDwsData, refreshUdotData, refreshMarketData } from '$lib/services/market-data.js';
import { geocodeAddress } from '$lib/services/geocode.js';

const VALID_APPROACHES = ['sales_comparison', 'income_cap', 'cost'];

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();

	// Support both old shape (subject_property_id) and new wizard shape (property object)
	if (body.subject_property_id && !body.property) {
		// Legacy path: direct property ID
		const { subject_property_id, report_number, approach, effective_date } = body;
		if (!subject_property_id || !approach) {
			return json({ error: 'subject_property_id and approach are required' }, { status: 400 });
		}
		const result = createReport({ subject_property_id, report_number, approach, effective_date });
		return json({ id: Number(result.lastInsertRowid) });
	}

	// Wizard path: property object + report config
	const { property, report_number, effective_date, client_name, intended_use, property_rights, approaches } = body;

	// Validate property fields — require either (address + city) or apn
	const hasAddress = property?.address && typeof property.address === 'string' && property.address.trim() !== '';
	const hasCity = property?.city && typeof property.city === 'string' && property.city.trim() !== '';
	const hasApn = property?.apn && typeof property.apn === 'string' && property.apn.trim() !== '';

	if (!hasAddress && !hasApn) {
		return json({ error: 'Either property address or parcel number (APN) is required' }, { status: 400 });
	}
	if (hasAddress && property.address.length > 200) {
		return json({ error: 'property.address must be 200 characters or less' }, { status: 400 });
	}
	if (hasAddress && !hasCity) {
		return json({ error: 'property.city is required when address is provided' }, { status: 400 });
	}
	if (hasCity && property.city.length > 100) {
		return json({ error: 'property.city must be 100 characters or less' }, { status: 400 });
	}
	if (property.zip && !/^\d{5}$/.test(property.zip)) {
		return json({ error: 'property.zip must be a 5-digit number' }, { status: 400 });
	}

	// Validate approaches
	if (!approaches || !Array.isArray(approaches) || approaches.length === 0) {
		return json({ error: 'approaches must be a non-empty array' }, { status: 400 });
	}
	for (const a of approaches) {
		if (!VALID_APPROACHES.includes(a)) {
			return json({ error: `Invalid approach: ${a}` }, { status: 400 });
		}
	}

	// Validate optional numeric fields
	if (property.year_built !== undefined && property.year_built !== null) {
		const yb = Number(property.year_built);
		if (isNaN(yb) || yb < 1800 || yb > 2030) {
			return json({ error: 'year_built must be between 1800 and 2030' }, { status: 400 });
		}
	}
	if (property.building_sf !== undefined && property.building_sf !== null) {
		const sf = Number(property.building_sf);
		if (isNaN(sf) || sf <= 0) {
			return json({ error: 'building_sf must be a positive number' }, { status: 400 });
		}
	}
	if (effective_date && isNaN(Date.parse(effective_date))) {
		return json({ error: 'effective_date must be a valid date' }, { status: 400 });
	}

	try {
		const propertyId = findOrCreateProperty({
			address: property.address?.trim() || '',
			city: property.city?.trim() || '',
			state: property.state || 'UT',
			zip: property.zip || undefined,
			apn: property.apn || undefined,
			property_type: property.property_type || undefined,
			year_built: property.year_built ? Number(property.year_built) : undefined,
			building_sf: property.building_sf ? Number(property.building_sf) : undefined,
			land_sf: property.land_sf ? Number(property.land_sf) : undefined,
			land_acres: property.land_acres ? Number(property.land_acres) : undefined,
			stories: property.stories ? Number(property.stories) : undefined,
			construction_class: property.construction_class || undefined,
			quality: property.quality || undefined,
			condition: property.condition || undefined,
			zoning: property.zoning || undefined,
			market_value: property.market_value ? Number(property.market_value) : undefined,
			county_data_json: property.county_data_json || undefined,
			county: property.county || undefined,
			owner_name: property.owner_name || undefined,
			acquisition_date: property.acquisition_date || undefined,
			occupancy: property.occupancy || undefined
		});

		const result = createReport({
			subject_property_id: propertyId,
			report_number: report_number || undefined,
			approach: JSON.stringify(approaches),
			effective_date: effective_date || undefined,
			client_name: client_name || undefined,
			intended_use: intended_use || undefined,
			property_rights: property_rights || undefined
		});

		const reportId = Number(result.lastInsertRowid);

		// Pre-populate AUTO sections
		try {
			const ctx = buildTemplateContext(reportId);
			if (ctx) {
				const activeSections = getSectionsForApproaches(approaches) as SectionDef[];
				for (const section of activeSections) {
					if (section.tier === 'auto' && AUTO_TEMPLATES[section.key]) {
						const html = AUTO_TEMPLATES[section.key](ctx);
						saveSectionAutoContent(reportId, section.key, html);
					}
				}
			}
		} catch (err) {
			console.error('[reports POST] AUTO pre-population failed (non-fatal):', err);
		}

		// Fire-and-forget: auto-source subject images
		autoSourceSubjectImages(reportId).catch(err =>
			console.error('[auto-source] Subject images failed (non-fatal):', err)
		);

		// Fire-and-forget: refresh all market data (DWS + UDOT) → render subsection tables
		(async () => {
			try {
				// Geocode for UDOT (reuse cached coords if available)
				let lat: number | undefined;
				let lng: number | undefined;
				if (property.address && property.city) {
					const geo = await geocodeAddress(property.address, property.city, property.state || 'UT');
					if (geo) { lat = geo.lat; lng = geo.lng; }
				}

				// Parallel: DWS (county-level) + BEBR (county-level) + UDOT (property-level)
				const countyKey = property.county || 'utah_county';
				await Promise.all([
					refreshAllDwsData(countyKey),
					refreshMarketData(countyKey, 'bebr_construction'),
					lat && lng
						? refreshUdotData(propertyId, lat, lng, property.address)
						: Promise.resolve(false),
				]);

				// Re-render all auto subsections with fresh data
				const freshCtx = buildTemplateContext(reportId);
				if (!freshCtx) return;
				const active = getSectionsForApproaches(approaches) as SectionDef[];
				for (const section of active) {
					const subs = GUIDED_SUBSECTIONS[section.key];
					if (section.tier !== 'guided' || !subs?.length) continue;
					const subHtmls: Record<string, string> = {};
					for (const sub of subs) {
						if (sub.tier === 'auto') {
							const html = renderSubsection(sub.key, freshCtx);
							if (html) subHtmls[sub.key] = html;
						}
					}
					if (Object.keys(subHtmls).length > 0) {
						const parentHtml = subs
							.map(s => subHtmls[s.key] ?? '')
							.filter(h => h.trim().length > 0)
							.join('\n\n');
						const formData = JSON.stringify({ _subsection_htmls: subHtmls, _subsection_form_data: {} });
						saveSectionAutoContent(reportId, section.key, parentHtml);
						saveSection(reportId, section.key, '', parentHtml, 'auto_generated', formData);
					}
				}
				console.log('[market-data] Auto subsections rendered after data refresh');
			} catch (err) {
				console.error('[market-data] Data refresh failed (non-fatal):', err);
			}
		})();

		return json({ id: reportId });
	} catch (err) {
		console.error('[reports POST]', err);
		return json({ error: 'Failed to create report' }, { status: 500 });
	}
};

export const GET: RequestHandler = async () => {
	const reports = listReports();
	return json(reports);
};
