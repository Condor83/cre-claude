import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import {
	findOrCreateProperty,
	insertSale,
	insertLease,
	linkDocumentProperty,
	createReport,
	addReportComp,
	getDb
} from '$lib/db/index.js';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

export interface SaleCompExtraction {
	property: {
		address: string;
		city?: string;
		state?: string;
		zip?: string;
		apn?: string;
		property_type?: string;
		year_built?: number;
		building_sf?: number;
		land_sf?: number;
		land_acres?: number;
		stories?: number;
		construction_class?: string;
		quality?: string;
		condition?: string;
		zoning?: string;
	};
	sale: {
		sale_date?: string;
		sale_price?: number;
		price_per_sf?: number;
		cap_rate?: number;
		grantor?: string;
		grantee?: string;
		financing?: string;
		verification_source?: string;
	};
	role: 'subject' | 'comp_sale';
	confidence: number;
}

export interface LeaseCompExtraction {
	property: {
		address: string;
		city?: string;
		state?: string;
		zip?: string;
		apn?: string;
		property_type?: string;
		year_built?: number;
		building_sf?: number;
		stories?: number;
		construction_class?: string;
	};
	lease: {
		tenant_name?: string;
		lease_sf?: number;
		rent_per_sf?: number;
		lease_type?: string;
		commencement_date?: string;
		term_years?: number;
		escalations?: string;
		office_pct?: number;
	};
	role: 'subject' | 'comp_lease';
	confidence: number;
}

export interface ExtractionResult {
	sale_comps: SaleCompExtraction[];
	lease_comps: LeaseCompExtraction[];
	report_number?: string;
	report_date?: string;
}

export async function extractEntities(
	chunks: Array<{ content: string; chunk_type: string; section_label: string }>
): Promise<ExtractionResult> {
	// Filter to evidence and table chunks for entity extraction
	const relevantChunks = chunks.filter(
		(c) => c.chunk_type === 'evidence' || c.chunk_type === 'table' ||
			(c.chunk_type === 'clause' && (c.section_label === 'cover_page' || c.section_label === 'transmittal'))
	);

	if (relevantChunks.length === 0) {
		return { sale_comps: [], lease_comps: [] };
	}

	const chunksText = relevantChunks
		.map((c) => `[${c.section_label}] (${c.chunk_type})\n${c.content}`)
		.join('\n\n---\n\n');

	const response = await anthropic.messages.create({
		model: 'claude-sonnet-4-20250514',
		max_tokens: 8192,
		messages: [
			{
				role: 'user',
				content: `Extract structured entities from this commercial real estate appraisal report content.

Return a JSON object with:
- report_number: the report file number (e.g., "26.004.C")
- report_date: the effective date of the appraisal
- sale_comps: array of sale comparable extractions. Each has:
  - property: { address, city, state, zip, apn, property_type, year_built, building_sf, land_sf, land_acres, stories, construction_class, quality, condition, zoning }
  - sale: { sale_date, sale_price, price_per_sf, cap_rate, grantor, grantee, financing, verification_source }
  - role: "subject" for the subject property, "comp_sale" for sale comparables
  - confidence: 0.0-1.0
- lease_comps: array of lease comparable extractions. Each has:
  - property: { address, city, state, zip, apn, property_type, year_built, building_sf, stories, construction_class }
  - lease: { tenant_name, lease_sf, rent_per_sf, lease_type, commencement_date, term_years, escalations, office_pct }
  - role: "subject" for subject property leases, "comp_lease" for lease comparables
  - confidence: 0.0-1.0

Rules:
- Numeric fields (sf, price, etc.) should be numbers, not strings
- Dates should be ISO format (YYYY-MM-DD) when possible
- State defaults to "UT" if not specified
- Mark confidence < 0.8 for any field you're uncertain about
- The SUBJECT property typically appears first with full details
- Comp properties appear in "Comparable Sale" or "Comparable Lease" sections
- Do NOT invent data — only extract what's explicitly stated

No markdown wrapping. Return raw JSON.

${chunksText}`
			}
		]
	});

	const text = response.content[0].type === 'text' ? response.content[0].text : '';
	try {
		const result = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
		return {
			sale_comps: result.sale_comps ?? [],
			lease_comps: result.lease_comps ?? [],
			report_number: result.report_number,
			report_date: result.report_date
		};
	} catch {
		console.error('Failed to parse entity extraction response');
		return { sale_comps: [], lease_comps: [] };
	}
}

// Coerce a value to a SQLite-safe type (string, number, or null)
function toStr(v: unknown): string | null {
	if (v == null) return null;
	if (typeof v === 'string') return v;
	return String(v);
}

function toNum(v: unknown): number | null {
	if (v == null) return null;
	const n = Number(v);
	return isFinite(n) ? n : null;
}

export function persistExtractionResults(
	documentId: number,
	result: ExtractionResult
) {
	let subjectPropertyId: number | null = null;
	const saleComps: Array<{ propertyId: number; saleId: number | null; rank: number }> = [];
	const leaseComps: Array<{ propertyId: number; leaseId: number | null; rank: number }> = [];
	let saleRank = 0;
	let leaseRank = 0;

	// Persist sale comps
	for (const comp of result.sale_comps) {
		if (!comp.property?.address) {
			console.warn('Skipping sale comp with no address');
			continue;
		}
		const propertyId = findOrCreateProperty(comp.property);
		linkDocumentProperty(documentId, propertyId, comp.role, undefined, comp.confidence);

		if (comp.role === 'subject') {
			subjectPropertyId = propertyId;
		}

		let saleId: number | null = null;
		const s = comp.sale;
		if (s && (s.sale_price || s.sale_date)) {
			const saleResult = insertSale({
				property_id: propertyId,
				sale_date: toStr(s.sale_date) ?? undefined,
				sale_price: toNum(s.sale_price) ?? undefined,
				price_per_sf: toNum(s.price_per_sf) ?? undefined,
				cap_rate: toNum(s.cap_rate) ?? undefined,
				grantor: toStr(s.grantor) ?? undefined,
				grantee: toStr(s.grantee) ?? undefined,
				financing: toStr(s.financing) ?? undefined,
				verification_source: toStr(s.verification_source) ?? undefined,
				source_document_id: documentId,
				confidence: comp.confidence
			});
			saleId = Number(saleResult.lastInsertRowid);
		}

		if (comp.role === 'comp_sale') {
			saleRank++;
			saleComps.push({ propertyId, saleId, rank: saleRank });
		}
	}

	// Persist lease comps
	for (const comp of result.lease_comps) {
		if (!comp.property?.address) {
			console.warn('Skipping lease comp with no address');
			continue;
		}
		const propertyId = findOrCreateProperty(comp.property);
		linkDocumentProperty(documentId, propertyId, comp.role, undefined, comp.confidence);

		if (comp.role === 'subject' && !subjectPropertyId) {
			subjectPropertyId = propertyId;
		}

		let leaseId: number | null = null;
		const l = comp.lease;
		if (l && (l.rent_per_sf || l.tenant_name)) {
			const leaseResult = insertLease({
				property_id: propertyId,
				tenant_name: toStr(l.tenant_name) ?? undefined,
				lease_sf: toNum(l.lease_sf) ?? undefined,
				rent_per_sf: toNum(l.rent_per_sf) ?? undefined,
				lease_type: toStr(l.lease_type) ?? undefined,
				commencement_date: toStr(l.commencement_date) ?? undefined,
				term_years: toNum(l.term_years) ?? undefined,
				escalations: toStr(l.escalations) ?? undefined,
				office_pct: toNum(l.office_pct) ?? undefined,
				source_document_id: documentId,
				confidence: comp.confidence
			});
			leaseId = Number(leaseResult.lastInsertRowid);
		}

		if (comp.role === 'comp_lease') {
			leaseRank++;
			leaseComps.push({ propertyId, leaseId, rank: leaseRank });
		}
	}

	// Create report record and link comps
	if (subjectPropertyId) {
		const approaches: string[] = [];
		if (saleComps.length > 0) approaches.push('sales_comparison');
		if (leaseComps.length > 0) approaches.push('income_cap');

		const reportResult = createReport({
			report_number: result.report_number,
			subject_property_id: subjectPropertyId,
			approach: JSON.stringify(approaches),
			effective_date: result.report_date
		});
		const reportId = Number(reportResult.lastInsertRowid);

		for (const sc of saleComps) {
			addReportComp({
				report_id: reportId,
				comp_type: 'sale',
				property_id: sc.propertyId,
				sale_id: sc.saleId ?? undefined,
				rank: sc.rank
			});
		}
		for (const lc of leaseComps) {
			addReportComp({
				report_id: reportId,
				comp_type: 'lease',
				property_id: lc.propertyId,
				lease_id: lc.leaseId ?? undefined,
				rank: lc.rank
			});
		}

		console.log(`Document ${documentId}: created report ${reportId} (${result.report_number}) with ${saleComps.length} sale comps, ${leaseComps.length} lease comps`);
	} else {
		console.warn(`Document ${documentId}: no subject property found, skipping report creation`);
	}
}
