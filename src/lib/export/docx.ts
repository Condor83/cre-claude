import {
	Document,
	Packer,
	Paragraph,
	TextRun,
	HeadingLevel,
	AlignmentType,
	PageBreak,
	LevelFormat
} from 'docx';
import { getDb, getSections, getAllAppraiserSettings } from '$lib/db/index.js';
import {
	getSectionsForApproaches,
	SECTION_LABEL_MAP,
	type SectionGroup
} from '$lib/config/sections.js';
import { htmlToDocx } from './html-to-docx.js';

const FONT = 'Times New Roman';

// Sections that always start on a new page (major structural boundaries)
const PAGE_BREAK_BEFORE: Set<string> = new Set([
	'transmittal',
	'summary_conclusions',
	'neighborhood',
	'sales_comparison',
	'income_approach',
	'cost_approach',
	'reconciliation',
	'certification',
	'general_assumptions',
	'photographs',
	'appraiser_qualifications',
	'definitions_glossary'
]);

interface ReportData {
	id: number;
	report_number: string;
	subject_address: string;
	subject_city: string;
	subject_state: string;
	effective_date: string;
	report_date: string;
	approach: string;
}

interface SectionRow {
	section_key: string;
	content_html: string;
	status: string;
}

function parseApproaches(approach: string): string[] {
	try {
		return JSON.parse(approach);
	} catch {
		return ['sales_comparison', 'income_cap'];
	}
}

function formatDate(dateStr: string | null): string {
	if (!dateStr) return 'N/A';
	try {
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
	} catch {
		return dateStr;
	}
}

/**
 * Strip a leading heading from content_html since the DOCX generator adds its own section heading.
 * Detects: <p><strong>ALL CAPS TEXT</strong></p> or <h1-h3>...</h1-h3> at start of content.
 * Auto templates often embed their own title (e.g. "SUMMARY OF SALIENT FACTS AND CONCLUSIONS")
 * which would duplicate the section heading we already render.
 */
function stripLeadingHeading(html: string): string {
	// Pattern 1: <p><strong>ALL CAPS TEXT</strong></p>
	const boldPattern = /^\s*<p>\s*<strong>([^<]+)<\/strong>\s*<\/p>/i;
	const boldMatch = html.match(boldPattern);
	if (boldMatch) {
		const text = boldMatch[1].trim();
		// Only strip if it's all uppercase (a title, not body content)
		if (text === text.toUpperCase() && text.length > 3) {
			return html.slice(boldMatch[0].length);
		}
	}
	// Pattern 2: <h1-h3>...</h1-h3>
	const headingPattern = /^\s*<h[1-3][^>]*>.*?<\/h[1-3]>/is;
	const headingMatch = html.match(headingPattern);
	if (headingMatch) {
		return html.slice(headingMatch[0].length);
	}
	return html;
}

function buildTitlePage(report: ReportData, appraiser: Record<string, string>): Paragraph[] {
	const paragraphs: Paragraph[] = [];

	// Top spacer
	paragraphs.push(
		new Paragraph({
			children: [],
			spacing: { after: 3000 }
		})
	);

	// APPRAISAL REPORT
	paragraphs.push(
		new Paragraph({
			children: [
				new TextRun({
					text: 'APPRAISAL REPORT',
					bold: true,
					size: 48, // 24pt
					font: FONT
				})
			],
			alignment: AlignmentType.CENTER,
			spacing: { after: 600 }
		})
	);

	// Address
	paragraphs.push(
		new Paragraph({
			children: [
				new TextRun({
					text: report.subject_address,
					size: 36, // 18pt
					font: FONT
				})
			],
			alignment: AlignmentType.CENTER,
			spacing: { after: 200 }
		})
	);

	// City, State
	const cityState = [report.subject_city, report.subject_state || 'Utah']
		.filter(Boolean)
		.join(', ');
	paragraphs.push(
		new Paragraph({
			children: [
				new TextRun({
					text: cityState,
					size: 36,
					font: FONT
				})
			],
			alignment: AlignmentType.CENTER,
			spacing: { after: 800 }
		})
	);

	// File number
	paragraphs.push(
		new Paragraph({
			children: [
				new TextRun({
					text: `File No. ${report.report_number || 'N/A'}`,
					size: 28, // 14pt
					font: FONT
				})
			],
			alignment: AlignmentType.CENTER,
			spacing: { after: 200 }
		})
	);

	// Effective date
	paragraphs.push(
		new Paragraph({
			children: [
				new TextRun({
					text: `Effective Date of Value: ${formatDate(report.effective_date)}`,
					size: 28,
					font: FONT
				})
			],
			alignment: AlignmentType.CENTER,
			spacing: { after: 200 }
		})
	);

	// Report date
	paragraphs.push(
		new Paragraph({
			children: [
				new TextRun({
					text: `Date of Report: ${formatDate(report.report_date)}`,
					size: 28,
					font: FONT
				})
			],
			alignment: AlignmentType.CENTER,
			spacing: { after: 1200 }
		})
	);

	// Appraiser info block
	if (appraiser.name) {
		paragraphs.push(
			new Paragraph({
				children: [
					new TextRun({
						text: 'Prepared By:',
						size: 24, // 12pt
						font: FONT,
						italics: true
					})
				],
				alignment: AlignmentType.CENTER,
				spacing: { after: 200 }
			})
		);

		paragraphs.push(
			new Paragraph({
				children: [
					new TextRun({
						text: appraiser.name,
						bold: true,
						size: 28,
						font: FONT
					})
				],
				alignment: AlignmentType.CENTER,
				spacing: { after: 100 }
			})
		);

		if (appraiser.certification_type) {
			paragraphs.push(
				new Paragraph({
					children: [
						new TextRun({
							text: appraiser.certification_type,
							size: 24,
							font: FONT
						})
					],
					alignment: AlignmentType.CENTER,
					spacing: { after: 100 }
				})
			);
		}

		if (appraiser.license_number) {
			const licState = appraiser.license_state || 'UT';
			paragraphs.push(
				new Paragraph({
					children: [
						new TextRun({
							text: `License #${appraiser.license_number} (${licState})`,
							size: 24,
							font: FONT
						})
					],
					alignment: AlignmentType.CENTER,
					spacing: { after: 100 }
				})
			);
		}

		if (appraiser.company) {
			paragraphs.push(
				new Paragraph({
					children: [
						new TextRun({
							text: appraiser.company,
							size: 24,
							font: FONT
						})
					],
					alignment: AlignmentType.CENTER,
					spacing: { after: 100 }
				})
			);
		}

		if (appraiser.address) {
			paragraphs.push(
				new Paragraph({
					children: [
						new TextRun({
							text: appraiser.address,
							size: 24,
							font: FONT
						})
					],
					alignment: AlignmentType.CENTER,
					spacing: { after: 100 }
				})
			);
		}

		const contact = [appraiser.phone, appraiser.email].filter(Boolean).join(' | ');
		if (contact) {
			paragraphs.push(
				new Paragraph({
					children: [
						new TextRun({
							text: contact,
							size: 24,
							font: FONT
						})
					],
					alignment: AlignmentType.CENTER
				})
			);
		}
	}

	// Page break after title page
	paragraphs.push(new Paragraph({ children: [new PageBreak()] }));

	return paragraphs;
}

export async function generateDocx(reportId: number): Promise<Buffer> {
	const db = getDb();

	const report = db
		.prepare(
			`
		SELECT r.*, p.address as subject_address, p.city as subject_city, p.state as subject_state
		FROM reports r
		JOIN properties p ON p.id = r.subject_property_id
		WHERE r.id = ?
	`
		)
		.get(reportId) as ReportData | undefined;

	if (!report) throw new Error(`Report ${reportId} not found`);

	const sections = getSections(reportId) as SectionRow[];
	const sectionMap = new Map(sections.map((s) => [s.section_key, s]));

	const appraiser = getAllAppraiserSettings();

	// Build document children
	const children: (Paragraph | ReturnType<typeof htmlToDocx>[number])[] = [];

	// Title page
	children.push(...buildTitlePage(report, appraiser));

	// Report sections — filtered by approach, including docxOnly sections
	const approaches = parseApproaches(report.approach);
	const activeSections = getSectionsForApproaches(approaches, true);

	let lastGroup: SectionGroup | null = null;
	let sectionCount = 0;

	for (const sectionDef of activeSections) {
		const key = sectionDef.key;
		const section = sectionMap.get(key);
		const title = SECTION_LABEL_MAP[key] || key;

		// Skip title_page (already rendered above) and table_of_contents (needs Word field codes)
		if (key === 'title_page' || key === 'table_of_contents') continue;

		// Skip sections with no content — regardless of tier
		if (!section?.content_html?.trim()) continue;

		// Smart page breaks: before major sections or group transitions
		const groupChanged = lastGroup !== null && sectionDef.group !== lastGroup;
		if (sectionCount > 0 && (PAGE_BREAK_BEFORE.has(key) || groupChanged)) {
			children.push(new Paragraph({ children: [new PageBreak()] }));
		}

		lastGroup = sectionDef.group;
		sectionCount++;

		// Section heading: uppercase, bold, 14pt
		children.push(
			new Paragraph({
				children: [
					new TextRun({
						text: title.toUpperCase(),
						bold: true,
						size: 28, // 14pt
						font: FONT
					})
				],
				heading: HeadingLevel.HEADING_1,
				spacing: { before: 400, after: 200 }
			})
		);

		// Section content — strip leading duplicate heading from auto templates
		const cleanedHtml = stripLeadingHeading(section.content_html);
		const docxNodes = htmlToDocx(cleanedHtml);
		children.push(...docxNodes);
	}

	const doc = new Document({
		numbering: {
			config: [
				{
					reference: 'default-numbering',
					levels: [
						{
							level: 0,
							format: LevelFormat.DECIMAL,
							text: '%1.',
							alignment: AlignmentType.START,
							style: {
								paragraph: {
									indent: { left: 720, hanging: 360 }
								},
								run: { font: FONT, size: 24 }
							}
						},
						{
							level: 1,
							format: LevelFormat.LOWER_LETTER,
							text: '%2.',
							alignment: AlignmentType.START,
							style: {
								paragraph: {
									indent: { left: 1440, hanging: 360 }
								},
								run: { font: FONT, size: 24 }
							}
						}
					]
				}
			]
		},
		styles: {
			default: {
				document: {
					run: {
						font: FONT,
						size: 24 // 12pt
					}
				}
			}
		},
		sections: [
			{
				properties: {
					page: {
						margin: {
							top: 1440, // 1 inch
							right: 1440,
							bottom: 1440,
							left: 1440
						}
					}
				},
				children
			}
		]
	});

	const buffer = await Packer.toBuffer(doc);
	return Buffer.from(buffer);
}
