import {
	Document,
	Packer,
	Paragraph,
	TextRun,
	HeadingLevel,
	AlignmentType,
	PageBreak,
	LevelFormat,
	ImageRun,
	Table,
	TableRow,
	TableCell,
	WidthType,
	BorderStyle
} from 'docx';
import { readFileSync, existsSync } from 'fs';
import { getDb, getSections, getAllAppraiserSettings, getSectionImages } from '$lib/db/index.js';
import type { SectionImage } from '$lib/db/index.js';
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

// ── Image dimensions ──

const FULL_WIDTH_EMU = 5_930_900; // ~6.5" in EMUs (914400 per inch)
const GRID_WIDTH_EMU = 2_830_000; // ~3.1" in EMUs
const MAX_HEIGHT_EMU = 4_572_000; // ~5" max height

function getImageDimensions(buffer: Buffer): { width: number; height: number } {
	// Read dimensions from image header (PNG or JPEG)
	if (buffer[0] === 0x89 && buffer[1] === 0x50) {
		// PNG: width at offset 16, height at offset 20 (big-endian 4 bytes)
		const width = buffer.readUInt32BE(16);
		const height = buffer.readUInt32BE(20);
		return { width, height };
	}
	if (buffer[0] === 0xff && buffer[1] === 0xd8) {
		// JPEG: scan for SOF0/SOF2 marker
		let offset = 2;
		while (offset < buffer.length - 8) {
			if (buffer[offset] === 0xff) {
				const marker = buffer[offset + 1];
				if (marker === 0xc0 || marker === 0xc2) {
					const height = buffer.readUInt16BE(offset + 5);
					const width = buffer.readUInt16BE(offset + 7);
					return { width, height };
				}
				const segLen = buffer.readUInt16BE(offset + 2);
				offset += 2 + segLen;
			} else {
				offset++;
			}
		}
	}
	// Fallback: assume 4:3 aspect ratio
	return { width: 1200, height: 900 };
}

function scaleToFit(
	imgWidth: number,
	imgHeight: number,
	maxWidth: number,
	maxHeight: number
): { width: number; height: number } {
	const wScale = maxWidth / imgWidth;
	const hScale = maxHeight / imgHeight;
	const scale = Math.min(wScale, hScale, 1);
	return {
		width: Math.round(imgWidth * scale),
		height: Math.round(imgHeight * scale)
	};
}

function createImageParagraph(
	buffer: Buffer,
	maxWidthEmu: number,
	caption?: string | null
): Paragraph[] {
	const { width, height } = getImageDimensions(buffer);
	const aspect = height / width;
	const fitWidth = maxWidthEmu;
	const fitHeight = Math.round(fitWidth * aspect);
	const finalHeight = Math.min(fitHeight, MAX_HEIGHT_EMU);
	const finalWidth = finalHeight < fitHeight
		? Math.round(finalHeight / aspect)
		: fitWidth;

	const paragraphs: Paragraph[] = [
		new Paragraph({
			children: [
				new ImageRun({
					data: buffer,
					transformation: { width: finalWidth, height: finalHeight },
					type: 'jpg'
				})
			],
			alignment: AlignmentType.CENTER,
			spacing: { before: 100, after: 100 }
		})
	];

	if (caption) {
		paragraphs.push(
			new Paragraph({
				children: [
					new TextRun({
						text: caption,
						size: 20, // 10pt
						font: FONT,
						bold: true
					})
				],
				alignment: AlignmentType.CENTER,
				spacing: { after: 200 }
			})
		);
	}

	return paragraphs;
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

function renderSectionImages(
	images: SectionImage[],
	gridLayout: boolean
): (Paragraph | Table)[] {
	const results: (Paragraph | Table)[] = [];

	if (!gridLayout) {
		// Full-width layout: one image per row
		for (const img of images) {
			if (!existsSync(img.file_path)) continue;
			const buffer = readFileSync(img.file_path);
			results.push(...createImageParagraph(buffer, FULL_WIDTH_EMU, img.caption));
		}
		return results;
	}

	// 2-per-row grid layout
	const validImages = images.filter((img) => existsSync(img.file_path));
	for (let i = 0; i < validImages.length; i += 2) {
		const img1 = validImages[i];
		const img2 = i + 1 < validImages.length ? validImages[i + 1] : null;

		const buf1 = readFileSync(img1.file_path);
		const cell1Content = createImageParagraph(buf1, GRID_WIDTH_EMU, img1.caption);

		const cell2Content = img2
			? createImageParagraph(readFileSync(img2.file_path), GRID_WIDTH_EMU, img2.caption)
			: [new Paragraph({ children: [] })];

		const row = new TableRow({
			children: [
				new TableCell({
					children: cell1Content,
					borders: NO_BORDERS,
					width: { size: 50, type: WidthType.PERCENTAGE }
				}),
				new TableCell({
					children: cell2Content,
					borders: NO_BORDERS,
					width: { size: 50, type: WidthType.PERCENTAGE }
				})
			]
		});

		results.push(
			new Table({
				rows: [row],
				width: { size: 100, type: WidthType.PERCENTAGE }
			})
		);
	}

	return results;
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

		// Check for section images
		const sectionImages = getSectionImages(reportId, key);
		const hasContent = section?.content_html?.trim();
		const hasImages = sectionImages.length > 0;

		// Skip sections with no content AND no images
		if (!hasContent && !hasImages) continue;

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
		if (hasContent) {
			const cleanedHtml = stripLeadingHeading(section!.content_html);
			const docxNodes = htmlToDocx(cleanedHtml);
			children.push(...docxNodes);
		}

		// Section images
		if (hasImages) {
			const isGrid = sectionDef.tier === 'images' || key === 'photographs';
			children.push(...renderSectionImages(sectionImages, isGrid));
		}
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
