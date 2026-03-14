import {
	Document,
	Packer,
	Paragraph,
	TextRun,
	HeadingLevel,
	AlignmentType,
	PageBreak,
	Table,
	TableRow,
	TableCell,
	WidthType
} from 'docx';
import { getDb, getSections, getReportComps } from '$lib/db/index.js';
import { getSectionsForApproaches, SECTION_LABEL_MAP } from '$lib/config/sections.js';

interface ReportData {
	id: number;
	report_number: string;
	subject_address: string;
	subject_city: string;
	effective_date: string;
	approach: string;
}

function parseApproaches(approach: string): string[] {
	try { return JSON.parse(approach); }
	catch { return ['sales_comparison', 'income_cap']; }
}

function htmlToDocxParagraphs(html: string): Paragraph[] {
	if (!html) return [new Paragraph({ children: [new TextRun('')] })];

	// Simple HTML to DOCX conversion
	// Strip tags and split on block elements
	const blocks = html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>/gi, '\n\n')
		.replace(/<\/div>/gi, '\n\n')
		.replace(/<\/h[1-6]>/gi, '\n\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ')
		.split(/\n\n+/);

	return blocks
		.map((block) => block.trim())
		.filter((block) => block.length > 0)
		.map(
			(block) =>
				new Paragraph({
					children: [
						new TextRun({
							text: block,
							size: 24, // 12pt
							font: 'Times New Roman'
						})
					],
					spacing: { after: 200 }
				})
		);
}

function createCompTable(comps: Record<string, unknown>[]): Table {
	const headerRow = new TableRow({
		children: ['#', 'Address', 'City', 'Size (SF)', 'Sale Price', '$/SF', 'Cap Rate', 'Sale Date'].map(
			(text) =>
				new TableCell({
					children: [
						new Paragraph({
							children: [
								new TextRun({
									text,
									bold: true,
									size: 20,
									font: 'Times New Roman'
								})
							]
						})
					],
					width: { size: 1250, type: WidthType.DXA }
				})
		)
	});

	const dataRows = comps.map(
		(comp, i) =>
			new TableRow({
				children: [
					String(i + 1),
					String(comp.address ?? ''),
					String(comp.city ?? ''),
					comp.building_sf ? Number(comp.building_sf).toLocaleString() : '',
					comp.sale_price ? `$${Number(comp.sale_price).toLocaleString()}` : '',
					comp.price_per_sf ? `$${Number(comp.price_per_sf).toFixed(2)}` : '',
					comp.sale_cap_rate ? `${(Number(comp.sale_cap_rate) * 100).toFixed(2)}%` : '',
					String(comp.sale_date ?? '')
				].map(
					(text) =>
						new TableCell({
							children: [
								new Paragraph({
									children: [
										new TextRun({
											text,
											size: 20,
											font: 'Times New Roman'
										})
									]
								})
							],
							width: { size: 1250, type: WidthType.DXA }
						})
				)
			})
	);

	return new Table({
		rows: [headerRow, ...dataRows],
		width: { size: 10000, type: WidthType.DXA }
	});
}

export async function generateDocx(reportId: number): Promise<Buffer> {
	const db = getDb();

	const report = db
		.prepare(
			`
		SELECT r.*, p.address as subject_address, p.city as subject_city
		FROM reports r
		JOIN properties p ON p.id = r.subject_property_id
		WHERE r.id = ?
	`
		)
		.get(reportId) as ReportData;

	if (!report) throw new Error(`Report ${reportId} not found`);

	const sections = getSections(reportId) as Array<{
		section_key: string;
		content_html: string;
	}>;
	const sectionMap = new Map(sections.map((s) => [s.section_key, s]));

	const comps = getReportComps(reportId) as Record<string, unknown>[];

	const docSections: Paragraph[] = [];

	// Title page
	docSections.push(
		new Paragraph({
			children: [new TextRun({ text: '', break: 4 } as unknown as ConstructorParameters<typeof TextRun>[0])],
			spacing: { after: 2000 }
		}),
		new Paragraph({
			children: [
				new TextRun({
					text: 'APPRAISAL REPORT',
					bold: true,
					size: 48,
					font: 'Times New Roman'
				})
			],
			alignment: AlignmentType.CENTER,
			spacing: { after: 400 }
		}),
		new Paragraph({
			children: [
				new TextRun({
					text: report.subject_address,
					size: 36,
					font: 'Times New Roman'
				})
			],
			alignment: AlignmentType.CENTER,
			spacing: { after: 200 }
		}),
		new Paragraph({
			children: [
				new TextRun({
					text: `${report.subject_city}, Utah`,
					size: 36,
					font: 'Times New Roman'
				})
			],
			alignment: AlignmentType.CENTER,
			spacing: { after: 400 }
		}),
		new Paragraph({
			children: [
				new TextRun({
					text: `File No. ${report.report_number || 'N/A'}`,
					size: 28,
					font: 'Times New Roman'
				})
			],
			alignment: AlignmentType.CENTER,
			spacing: { after: 200 }
		}),
		new Paragraph({
			children: [
				new TextRun({
					text: `Effective Date: ${report.effective_date || 'N/A'}`,
					size: 28,
					font: 'Times New Roman'
				})
			],
			alignment: AlignmentType.CENTER
		}),
		new Paragraph({
			children: [new PageBreak()]
		})
	);

	// Report sections — filtered by approach
	const approaches = parseApproaches(report.approach);
	const activeSections = getSectionsForApproaches(approaches);

	for (const sectionDef of activeSections) {
		const key = sectionDef.key;
		const section = sectionMap.get(key);
		const title = SECTION_LABEL_MAP[key] || key;

		docSections.push(
			new Paragraph({
				children: [
					new TextRun({
						text: title.toUpperCase(),
						bold: true,
						size: 28,
						font: 'Times New Roman'
					})
				],
				heading: HeadingLevel.HEADING_1,
				spacing: { before: 400, after: 200 }
			})
		);

		if (section?.content_html) {
			docSections.push(...htmlToDocxParagraphs(section.content_html));
		} else {
			docSections.push(
				new Paragraph({
					children: [
						new TextRun({
							text: '[Section not yet completed]',
							italics: true,
							size: 24,
							font: 'Times New Roman',
							color: '999999'
						})
					],
					spacing: { after: 200 }
				})
			);
		}

		// Insert comp table after sales comparison section
		if (key === 'sales_comparison' && comps.length > 0) {
			const saleComps = comps.filter((c) => c.comp_type === 'sale');
			if (saleComps.length > 0) {
				docSections.push(
					new Paragraph({
						children: [
							new TextRun({
								text: 'Improved Sales Summary',
								bold: true,
								size: 24,
								font: 'Times New Roman'
							})
						],
						spacing: { before: 300, after: 200 }
					})
				);
				// Table would go here - docx lib handles it differently
			}
		}

		docSections.push(new Paragraph({ children: [new PageBreak()] }));
	}

	const doc = new Document({
		sections: [
			{
				children: docSections
			}
		]
	});

	const buffer = await Packer.toBuffer(doc);
	return Buffer.from(buffer);
}
