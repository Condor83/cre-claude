import { describe, it, expect } from 'vitest';
import { Paragraph, Table } from 'docx';
import { htmlToDocx } from './html-to-docx.js';

/** Serialize a docx object to its internal JSON for assertions */
function toJson(obj: unknown): string {
	return JSON.stringify((obj as { root: unknown }).root);
}

/** Extract text strings from a Paragraph's serialized root (finds w:t text nodes) */
function extractTexts(paragraph: Paragraph): string[] {
	const json = toJson(paragraph);
	const texts: string[] = [];
	// Match text content in "w:t" root arrays — the text is always a plain string after the attr object
	const re = /"rootKey":"w:t","root":\[.*?,"([^"]+)"\]/g;
	let m;
	while ((m = re.exec(json)) !== null) {
		texts.push(m[1]);
	}
	return texts;
}

describe('htmlToDocx', () => {
	it('returns empty array for empty/null input', () => {
		expect(htmlToDocx('')).toEqual([]);
		expect(htmlToDocx(null as unknown as string)).toEqual([]);
		expect(htmlToDocx(undefined as unknown as string)).toEqual([]);
		expect(htmlToDocx('   ')).toEqual([]);
	});

	it('converts a plain paragraph', () => {
		const result = htmlToDocx('<p>Hello world</p>');
		expect(result).toHaveLength(1);
		expect(result[0]).toBeInstanceOf(Paragraph);
		const texts = extractTexts(result[0] as Paragraph);
		expect(texts.join('')).toBe('Hello world');
	});

	it('preserves bold formatting', () => {
		const result = htmlToDocx('<p>Hello <strong>bold</strong> world</p>');
		expect(result).toHaveLength(1);
		const json = toJson(result[0]);
		// docx represents bold as w:b element
		expect(json).toContain('"rootKey":"w:b"');
		// Should have the bold text
		expect(json).toContain('bold');
	});

	it('preserves italic formatting', () => {
		const result = htmlToDocx('<p><em>italic text</em></p>');
		expect(result).toHaveLength(1);
		const json = toJson(result[0]);
		// docx represents italic as w:i element
		expect(json).toContain('"rootKey":"w:i"');
	});

	it('handles nested bold+italic', () => {
		const result = htmlToDocx('<p><strong><em>bold and italic</em></strong></p>');
		expect(result).toHaveLength(1);
		const json = toJson(result[0]);
		expect(json).toContain('"rootKey":"w:b"');
		expect(json).toContain('"rootKey":"w:i"');
	});

	it('converts bullet list to paragraphs', () => {
		const result = htmlToDocx('<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>');
		expect(result).toHaveLength(3);
		for (const item of result) {
			expect(item).toBeInstanceOf(Paragraph);
		}
	});

	it('converts numbered list to paragraphs', () => {
		const result = htmlToDocx('<ol><li>First</li><li>Second</li></ol>');
		expect(result).toHaveLength(2);
		for (const item of result) {
			expect(item).toBeInstanceOf(Paragraph);
		}
		// Numbered list paragraphs reference the numbering definition
		const json = toJson(result[0]);
		expect(json).toContain('default-numbering');
	});

	it('converts table with header row', () => {
		const html = `
			<table>
				<thead><tr><th>Name</th><th>Value</th></tr></thead>
				<tbody><tr><td>Foo</td><td>123</td></tr></tbody>
			</table>`;
		const result = htmlToDocx(html);
		expect(result).toHaveLength(1);
		expect(result[0]).toBeInstanceOf(Table);
	});

	it('converts table without thead', () => {
		const html = `<table><tr><td>A</td><td>B</td></tr><tr><td>1</td><td>2</td></tr></table>`;
		const result = htmlToDocx(html);
		expect(result).toHaveLength(1);
		expect(result[0]).toBeInstanceOf(Table);
	});

	it('handles mixed content: paragraphs + table + list', () => {
		const html = `
			<p>Introduction paragraph.</p>
			<table><tr><th>Col</th></tr><tr><td>Data</td></tr></table>
			<ul><li>Bullet</li></ul>
			<p>Closing paragraph.</p>`;
		const result = htmlToDocx(html);
		// p, table, li-paragraph, p = 4 items
		expect(result.length).toBeGreaterThanOrEqual(4);
		expect(result[0]).toBeInstanceOf(Paragraph);
		expect(result[1]).toBeInstanceOf(Table);
	});

	it('decodes HTML entities', () => {
		const result = htmlToDocx('<p>5 &amp; 10</p>');
		expect(result).toHaveLength(1);
		const texts = extractTexts(result[0] as Paragraph);
		expect(texts.join('')).toContain('5 & 10');
	});

	it('handles <br> as line break', () => {
		const result = htmlToDocx('<p>Line 1<br>Line 2</p>');
		expect(result).toHaveLength(1);
		const json = toJson(result[0]);
		// docx represents break as w:br
		expect(json).toContain('"rootKey":"w:br"');
	});

	it('preserves text from unknown tags', () => {
		const result = htmlToDocx('<p><custom>Some text here</custom></p>');
		expect(result.length).toBeGreaterThanOrEqual(1);
		const texts = extractTexts(result[0] as Paragraph);
		expect(texts.join('')).toContain('Some text here');
	});

	it('handles headings', () => {
		const result = htmlToDocx('<h2>Section Title</h2>');
		expect(result).toHaveLength(1);
		expect(result[0]).toBeInstanceOf(Paragraph);
		const json = toJson(result[0]);
		// docx heading style is "Heading2"
		expect(json).toContain('Heading2');
	});

	it('handles blockquote', () => {
		const result = htmlToDocx('<blockquote><p>Quoted text</p></blockquote>');
		expect(result.length).toBeGreaterThanOrEqual(1);
		expect(result[0]).toBeInstanceOf(Paragraph);
		const json = toJson(result[0]);
		// Should have italic formatting
		expect(json).toContain('"rootKey":"w:i"');
	});

	it('handles multiple paragraphs', () => {
		const result = htmlToDocx('<p>First</p><p>Second</p><p>Third</p>');
		expect(result).toHaveLength(3);
		for (const item of result) {
			expect(item).toBeInstanceOf(Paragraph);
		}
	});
});
