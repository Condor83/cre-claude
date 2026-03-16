import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createReport, findOrCreateProperty, listReports, deleteReport, saveSectionAutoContent, addReportComp, getDb } from '$lib/db/index.js';
import { renderCompDesc } from '$lib/templates/comp_desc.js';
import { buildTemplateContext } from '$lib/templates/context.js';
import { AUTO_TEMPLATES } from '$lib/templates/sections/index.js';
import { getSectionsForApproaches, type SectionDef } from '$lib/config/sections.js';
import { createReportTasks, orchestrateReportTasks } from '$lib/services/task-tracker.js';

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
	const { property, report_number, effective_date, client_name, intended_use, property_rights, approaches, target_price_psf, selected_comp_ids } = body;

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
			property_rights: property_rights || undefined,
			target_price_psf: target_price_psf ? Number(target_price_psf) : undefined
		});

		const reportId = Number(result.lastInsertRowid);

		// Pre-add selected comps from wizard suggestions (with auto-rendered templates)
		if (selected_comp_ids?.length > 0) {
			const db = getDb();
			for (let i = 0; i < selected_comp_ids.length; i++) {
				const propId = Number(selected_comp_ids[i]);
				if (propId <= 0) continue;

				const prop = db.prepare('SELECT * FROM properties WHERE id = ?').get(propId) as Record<string, unknown> | undefined;

				// Auto-find latest sale for this property
				const latestSale = db.prepare('SELECT * FROM sales WHERE property_id = ? ORDER BY sale_date DESC LIMIT 1').get(propId) as Record<string, unknown> | undefined;

				let contentHtml = '';
				let formData = '';
				if (prop) {
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
						sale_price: latestSale?.sale_price as number | null ?? null,
						sale_date: latestSale?.sale_date as string | null ?? null,
						grantor: latestSale?.grantor as string | null ?? null,
						grantee: latestSale?.grantee as string | null ?? null
					});
					formData = JSON.stringify({ _subsection_htmls: { comp_desc: descHtml }, _subsection_form_data: {} });
					contentHtml = descHtml;
				}

				addReportComp({
					report_id: reportId,
					comp_type: 'sale',
					property_id: propId,
					sale_id: latestSale?.id as number | undefined,
					rank: i + 1,
					content_html: contentHtml,
					form_data: formData
				});
			}
		}

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

		// Register tasks BEFORE returning response (prevents race with SSE)
		createReportTasks(reportId, [
			{ id: 'geocode', label: 'Geocoding Address' },
			{ id: 'auto_images', label: 'Sourcing Images' },
			{ id: 'dws_population', label: 'Population Data' },
			{ id: 'dws_employment', label: 'Employment Data' },
			{ id: 'bebr_construction', label: 'Building Permits' },
			{ id: 'udot_access', label: 'Traffic & Access Data' },
			{ id: 'render_subsections', label: 'Rendering Sections' }
		], approaches);

		// Fire async orchestration (non-blocking)
		orchestrateReportTasks(reportId, {
			property: {
				address: property.address?.trim() || '',
				city: property.city?.trim() || '',
				state: property.state || 'UT',
				county: property.county || undefined
			},
			propertyId,
			approaches
		});

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

export const DELETE: RequestHandler = async ({ request }) => {
	const { id } = await request.json();
	if (!id || typeof id !== 'number') {
		return json({ error: 'id is required' }, { status: 400 });
	}

	try {
		const { imagePaths } = deleteReport(id);

		// Clean up image files from disk
		const { unlinkSync } = await import('fs');
		for (const p of imagePaths) {
			try { unlinkSync(p); } catch { /* already gone */ }
		}

		return json({ ok: true });
	} catch (err) {
		console.error('[reports DELETE]', err);
		return json({ error: 'Failed to delete report' }, { status: 500 });
	}
};
