import {
	Paragraph,
	TextRun,
	Table,
	TableRow,
	TableCell,
	WidthType,
	AlignmentType,
	HeadingLevel,
	ShadingType,
	BorderStyle
} from 'docx';
import { load, type CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

const FONT = 'Times New Roman';
const FONT_SIZE = 24; // 12pt in half-points
const HEADING_SIZES: Record<string, number> = {
	h1: 32, // 16pt
	h2: 28, // 14pt
	h3: 26 // 13pt
};
const HEADING_LEVELS: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
	h1: HeadingLevel.HEADING_1,
	h2: HeadingLevel.HEADING_2,
	h3: HeadingLevel.HEADING_3
};

interface InlineStyle {
	bold?: boolean;
	italics?: boolean;
	underline?: Record<string, never>;
	strike?: boolean;
}

/**
 * Convert an HTML string to an array of docx Paragraph and Table objects.
 * Handles: p, h1-h3, ul/ol/li, table, strong/b, em/i, u, br, blockquote.
 */
export function htmlToDocx(html: string): (Paragraph | Table)[] {
	if (!html || !html.trim()) return [];

	const $ = load(html, { xmlMode: false });
	const results: (Paragraph | Table)[] = [];
	const body = $('body');

	body.contents().each((_, el) => {
		results.push(...processNode($, el, {}));
	});

	return results;
}

function processNode(
	$: CheerioAPI,
	node: AnyNode,
	inheritedStyle: InlineStyle
): (Paragraph | Table)[] {
	if (node.type === 'text') {
		const text = decodeEntities($(node).text());
		if (!text.trim()) return [];
		return [
			new Paragraph({
				children: [
					new TextRun({
						text,
						size: FONT_SIZE,
						font: FONT,
						...inheritedStyle
					})
				],
				spacing: { after: 200 }
			})
		];
	}

	if (node.type !== 'tag') return [];

	const el = node as Element;
	const tag = el.tagName.toLowerCase();

	switch (tag) {
		case 'p':
			return [parseParagraph($, el, inheritedStyle)];

		case 'h1':
		case 'h2':
		case 'h3':
			return [parseHeading($, el, tag)];

		case 'ul':
			return parseList($, el, 'bullet', 0);

		case 'ol':
			return parseList($, el, 'numbered', 0);

		case 'table':
			return [parseTable($, el)];

		case 'blockquote':
			return parseBlockquote($, el);

		case 'hr':
			return [
				new Paragraph({
					children: [],
					border: {
						bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 }
					},
					spacing: { before: 200, after: 200 }
				})
			];

		case 'br':
			return [];

		case 'div':
		case 'section':
		case 'article': {
			const results: (Paragraph | Table)[] = [];
			$(el)
				.contents()
				.each((_, child) => {
					results.push(...processNode($, child, inheritedStyle));
				});
			return results;
		}

		default: {
			const runs = parseInlineContent($, el, inheritedStyle);
			if (runs.length === 0) return [];
			return [
				new Paragraph({
					children: runs,
					spacing: { after: 200 }
				})
			];
		}
	}
}

function parseParagraph(
	$: CheerioAPI,
	el: Element,
	inheritedStyle: InlineStyle
): Paragraph {
	const runs = parseInlineContent($, el, inheritedStyle);
	if (runs.length === 0) {
		runs.push(new TextRun({ text: '', size: FONT_SIZE, font: FONT }));
	}
	return new Paragraph({
		children: runs,
		spacing: { after: 200 }
	});
}

function parseHeading($: CheerioAPI, el: Element, tag: string): Paragraph {
	const size = HEADING_SIZES[tag] || 28;
	const runs = parseInlineContentWithSize($, el, { bold: true }, size);
	return new Paragraph({
		children: runs,
		heading: HEADING_LEVELS[tag],
		spacing: { before: 300, after: 200 }
	});
}

function parseInlineContentWithSize(
	$: CheerioAPI,
	el: Element,
	inheritedStyle: InlineStyle,
	size: number
): TextRun[] {
	const runs: TextRun[] = [];
	$(el)
		.contents()
		.each((_, child) => {
			runs.push(...parseInlineNodeWithSize($, child as AnyNode, inheritedStyle, size));
		});
	return runs;
}

function parseInlineNodeWithSize(
	$: CheerioAPI,
	node: AnyNode,
	inheritedStyle: InlineStyle,
	size: number
): TextRun[] {
	if (node.type === 'text') {
		const text = decodeEntities($(node).text());
		if (!text) return [];
		return [new TextRun({ text, size, font: FONT, ...inheritedStyle })];
	}
	if (node.type !== 'tag') return [];
	const el = node as Element;
	const tag = el.tagName.toLowerCase();
	switch (tag) {
		case 'strong':
		case 'b':
			return parseInlineContentWithSize($, el, { ...inheritedStyle, bold: true }, size);
		case 'em':
		case 'i':
			return parseInlineContentWithSize($, el, { ...inheritedStyle, italics: true }, size);
		default:
			return parseInlineContentWithSize($, el, inheritedStyle, size);
	}
}

function parseList(
	$: CheerioAPI,
	el: Element,
	listType: 'bullet' | 'numbered',
	level: number
): Paragraph[] {
	const paragraphs: Paragraph[] = [];

	$(el)
		.children('li')
		.each((_, li) => {
			const liEl = li as unknown as Element;
			const runs: TextRun[] = [];
			$(liEl)
				.contents()
				.each((_, child) => {
					const childNode = child as AnyNode;
					if (childNode.type === 'tag') {
						const childTag = (childNode as Element).tagName.toLowerCase();
						if (childTag === 'ul') {
							paragraphs.push(
								...createListParagraph(runs, listType, level),
								...parseList($, childNode as Element, 'bullet', level + 1)
							);
							runs.length = 0;
							return;
						}
						if (childTag === 'ol') {
							paragraphs.push(
								...createListParagraph(runs, listType, level),
								...parseList($, childNode as Element, 'numbered', level + 1)
							);
							runs.length = 0;
							return;
						}
					}
					runs.push(...parseInlineNode($, childNode, {}));
				});

			if (runs.length > 0) {
				paragraphs.push(...createListParagraph(runs, listType, level));
			}
		});

	return paragraphs;
}

function createListParagraph(
	runs: TextRun[],
	listType: 'bullet' | 'numbered',
	level: number
): Paragraph[] {
	if (runs.length === 0) return [];

	if (listType === 'bullet') {
		return [
			new Paragraph({
				children: [...runs],
				spacing: { after: 100 },
				indent: { left: 720 * (level + 1), hanging: 360 },
				bullet: { level }
			})
		];
	}

	return [
		new Paragraph({
			children: [...runs],
			spacing: { after: 100 },
			indent: { left: 720 * (level + 1), hanging: 360 },
			numbering: { reference: 'default-numbering', level }
		})
	];
}

function parseTable($: CheerioAPI, el: Element): Table {
	const rows: TableRow[] = [];

	const trElements: Element[] = [];
	$(el)
		.find('tr')
		.each((_, tr) => {
			trElements.push(tr as unknown as Element);
		});

	const tableBorders = {
		top: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
		bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
		left: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
		right: { style: BorderStyle.SINGLE, size: 1, color: '999999' }
	};

	trElements.forEach((tr, rowIdx) => {
		const cells: TableCell[] = [];
		const isHeaderRow =
			rowIdx === 0 &&
			($(tr).parent().is('thead') || $(tr).children('th').length > 0);

		$(tr)
			.children('td, th')
			.each((_, cell) => {
				const cellEl = cell as unknown as Element;
				const isHeader = isHeaderRow || cellEl.tagName.toLowerCase() === 'th';
				const runs = parseInlineContent($, cellEl, isHeader ? { bold: true } : {});

				if (runs.length === 0) {
					runs.push(new TextRun({ text: '', size: 20, font: FONT }));
				}

				// Center-align cells with numeric/currency content
				const cellText = $(cellEl).text().trim();
				const isNumeric = /^[\$\d,.\-%]+$/.test(cellText) && /\d/.test(cellText);
				const alignment = isHeader
					? AlignmentType.CENTER
					: isNumeric
						? AlignmentType.CENTER
						: undefined;

				const shading = isHeader
					? { type: ShadingType.SOLID, color: 'E8E8E8', fill: 'E8E8E8' }
					: undefined;

				cells.push(
					new TableCell({
						children: [
							new Paragraph({
								children: runs,
								spacing: { before: 60, after: 60 },
								...(alignment ? { alignment } : {})
							})
						],
						borders: tableBorders,
						margins: { top: 40, bottom: 40, left: 80, right: 80 },
						...(shading ? { shading } : {})
					})
				);
			});

		if (cells.length > 0) {
			rows.push(new TableRow({ children: cells }));
		}
	});

	if (rows.length === 0) {
		return new Table({
			rows: [
				new TableRow({
					children: [
						new TableCell({
							children: [new Paragraph({ children: [] })]
						})
					]
				})
			]
		});
	}

	return new Table({
		rows,
		width: { size: 9500, type: WidthType.DXA }
	});
}

function parseBlockquote($: CheerioAPI, el: Element): Paragraph[] {
	const runs = parseInlineContent($, el, { italics: true });
	if (runs.length === 0) return [];
	return [
		new Paragraph({
			children: runs,
			indent: { left: 720 },
			spacing: { after: 200 }
		})
	];
}

function parseInlineContent(
	$: CheerioAPI,
	el: Element,
	inheritedStyle: InlineStyle
): TextRun[] {
	const runs: TextRun[] = [];
	$(el)
		.contents()
		.each((_, child) => {
			runs.push(...parseInlineNode($, child as AnyNode, inheritedStyle));
		});
	return runs;
}

function parseInlineNode(
	$: CheerioAPI,
	node: AnyNode,
	inheritedStyle: InlineStyle
): TextRun[] {
	if (node.type === 'text') {
		const text = decodeEntities($(node).text());
		if (!text) return [];
		return [
			new TextRun({
				text,
				size: FONT_SIZE,
				font: FONT,
				...inheritedStyle
			})
		];
	}

	if (node.type !== 'tag') return [];

	const el = node as Element;
	const tag = el.tagName.toLowerCase();

	switch (tag) {
		case 'strong':
		case 'b':
			return parseInlineContent($, el, { ...inheritedStyle, bold: true });

		case 'em':
		case 'i':
			return parseInlineContent($, el, { ...inheritedStyle, italics: true });

		case 'u':
			return parseInlineContent($, el, { ...inheritedStyle, underline: {} });

		case 's':
		case 'strike':
		case 'del':
			return parseInlineContent($, el, { ...inheritedStyle, strike: true });

		case 'br':
			return [new TextRun({ break: 1, size: FONT_SIZE, font: FONT })];

		case 'span':
		case 'a':
		case 'code':
			return parseInlineContent($, el, inheritedStyle);

		default:
			return parseInlineContent($, el, inheritedStyle);
	}
}

function decodeEntities(text: string): string {
	return text
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ');
}
