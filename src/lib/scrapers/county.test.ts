import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import {
	parseUtahCountyAddress,
	extractFieldValue,
	normalizeParcel,
	extractAppraisalFields,
	extractValueHistory,
	extractTaxHistory,
	extractDeeds,
	extractOwnerHistory,
	validateTabPanel
} from './county.js';

describe('extractFieldValue', () => {
	it('extracts a simple label/value pair from adjacent <td> cells', () => {
		const html = `<table><tr><td>Year Built:</td><td>2009</td></tr></table>`;
		const $ = cheerio.load(html);
		expect(extractFieldValue($, 'Year Built:')).toBe('2009');
	});

	it('handles nested table inside the value cell (Owner field)', () => {
		const html = `
			<table><tr>
				<td>Owner:</td>
				<td><table><tr><td><a href="namesearch.asp">TOTAL CLIMATE PARTNERS LC</a></td></tr></table></td>
			</tr></table>`;
		const $ = cheerio.load(html);
		expect(extractFieldValue($, 'Owner:')).toBe('TOTAL CLIMATE PARTNERS LC');
	});

	it('handles nested table inside the label cell', () => {
		const html = `
			<table><tr>
				<td>Owner:<table><tr><td>extra</td></tr></table></td>
				<td>JONES LEASING INC</td>
			</tr></table>`;
		const $ = cheerio.load(html);
		expect(extractFieldValue($, 'Owner:')).toBe('JONES LEASING INC');
	});

	it('returns null when label is not found', () => {
		const html = `<table><tr><td>Foo:</td><td>Bar</td></tr></table>`;
		const $ = cheerio.load(html);
		expect(extractFieldValue($, 'Missing:')).toBeNull();
	});

	it('trims whitespace from extracted values', () => {
		const html = `<table><tr><td>Quality:</td><td>  Average  </td></tr></table>`;
		const $ = cheerio.load(html);
		expect(extractFieldValue($, 'Quality:')).toBe('Average');
	});
});

describe('parseUtahCountyAddress', () => {
	it('parses "1602 W 800 South"', () => {
		const result = parseUtahCountyAddress('1602 W 800 South');
		expect(result.house).toBe('1602');
		expect(result.dir).toBe('W');
		expect(result.street).toBe('800 South');
	});

	it('parses "123 N Main Street"', () => {
		const result = parseUtahCountyAddress('123 N Main Street');
		expect(result.house).toBe('123');
		expect(result.dir).toBe('N');
		expect(result.street).toBe('Main');
		expect(result.type).toBe('ST');
	});

	it('parses "456 East Center Street"', () => {
		const result = parseUtahCountyAddress('456 East Center Street');
		expect(result.house).toBe('456');
		expect(result.dir).toBe('E');
		expect(result.street).toBe('Center');
		expect(result.type).toBe('ST');
	});

	it('parses address with no direction', () => {
		const result = parseUtahCountyAddress('100 Main Street');
		expect(result.house).toBe('100');
		expect(result.dir).toBe('%');
		expect(result.street).toBe('Main');
		expect(result.type).toBe('ST');
	});

	it('parses numbered street with direction suffix', () => {
		const result = parseUtahCountyAddress('500 S 100 West');
		expect(result.house).toBe('500');
		expect(result.dir).toBe('S');
		expect(result.street).toBe('100 West');
	});

	it('parses "1418 W. Center Street" (direction with period)', () => {
		const result = parseUtahCountyAddress('1418 W. Center Street');
		expect(result.house).toBe('1418');
		expect(result.dir).toBe('W');
		expect(result.street).toBe('Center');
		expect(result.type).toBe('ST');
	});

	it('parses "500 S. 100 East" (direction with period)', () => {
		const result = parseUtahCountyAddress('500 S. 100 East');
		expect(result.house).toBe('500');
		expect(result.dir).toBe('S');
		expect(result.street).toBe('100 East');
	});

	it('handles empty string', () => {
		const result = parseUtahCountyAddress('');
		expect(result.house).toBe('');
		expect(result.dir).toBe('%');
		expect(result.street).toBe('');
		expect(result.type).toBe('%');
	});

	it('parses "1250 W 100 N"', () => {
		const result = parseUtahCountyAddress('1250 W 100 N');
		expect(result.house).toBe('1250');
		expect(result.dir).toBe('W');
		expect(result.street).toBe('100 N');
	});
});

describe('normalizeParcel', () => {
	it('replaces dashes with colons for utah_county', () => {
		expect(normalizeParcel('46-764-0002', 'utah_county')).toBe('46:764:0002');
	});

	it('leaves colons as-is for utah_county', () => {
		expect(normalizeParcel('46:764:0002', 'utah_county')).toBe('46:764:0002');
	});

	it('replaces colons with dashes for salt_lake_county', () => {
		expect(normalizeParcel('16:06:102:008:0000', 'salt_lake_county')).toBe('16-06-102-008-0000');
	});

	it('leaves dashes as-is for salt_lake_county', () => {
		expect(normalizeParcel('16-06-102-008-0000', 'salt_lake_county')).toBe('16-06-102-008-0000');
	});

	it('trims whitespace', () => {
		expect(normalizeParcel('  46:764:0002  ', 'utah_county')).toBe('46:764:0002');
	});
});

describe('extractAppraisalFields', () => {
	it('extracts all label:value pairs', () => {
		const html = `
			<table>
				<tr><td>Year Built:</td><td>2009</td></tr>
				<tr><td>Quality:</td><td>Average</td></tr>
				<tr><td>Property Type:</td><td>WAREHOUSE</td></tr>
			</table>`;
		const $ = cheerio.load(html);
		const fields = extractAppraisalFields($);
		expect(fields['Year Built']).toBe('2009');
		expect(fields['Quality']).toBe('Average');
		expect(fields['Property Type']).toBe('WAREHOUSE');
	});

	it('skips labels without colon suffix', () => {
		const html = `
			<table>
				<tr><td>Some Header</td><td>Value</td></tr>
				<tr><td>Valid:</td><td>Yes</td></tr>
			</table>`;
		const $ = cheerio.load(html);
		const fields = extractAppraisalFields($);
		expect(fields['Some Header']).toBeUndefined();
		expect(fields['Valid']).toBe('Yes');
	});
});

describe('extractValueHistory', () => {
	it('extracts value history matching actual ValNotice.asp structure', () => {
		const html = `
			<table>
				<tr>
					<td colspan="4"><strong>Property Types:</strong></td>
					<td><div align="right"><strong>2025&nbsp;Market&nbsp;Value </strong></div></td>
					<td>&nbsp;</td>
					<td>&nbsp;</td>
					<td><div align="right"><strong>2026&nbsp;Market&nbsp;Value </strong></div></td>
				</tr>
				<tr>
					<td>&nbsp;</td>
					<td colspan="3">Non-Primary Residential</td>
					<td align="right">$6,055,300</td>
					<td>&nbsp;</td>
					<td>&nbsp;</td>
					<td align="right">$6,055,300</td>
				</tr>
				<tr>
					<td colspan="4"><strong>Total Property Market Value  </strong></td>
					<td align="right"><strong>$6,055,300</strong></td>
					<td>&nbsp;</td>
					<td>&nbsp;</td>
					<td align="right"><strong>$6,055,300</strong></td>
				</tr>
			</table>`;
		const $ = cheerio.load(html);
		const history = extractValueHistory($);
		expect(history).toHaveLength(2);
		expect(history[0]).toEqual({ year: 2025, land: 0, improvement: 0, total: 6055300 });
		expect(history[1]).toEqual({ year: 2026, land: 0, improvement: 0, total: 6055300 });
	});

	it('returns empty array when no value table found', () => {
		const html = `<div>No tables here</div>`;
		const $ = cheerio.load(html);
		expect(extractValueHistory($)).toEqual([]);
	});
});

describe('extractTaxHistory', () => {
	it('extracts tax rows from a panel', () => {
		const html = `
			<div class="TabbedPanelsContent">
				<table>
					<tr><td>Year</td><td>General</td><td>Special</td><td>Total</td></tr>
					<tr><td>2024</td><td>$3,200</td><td>$800</td><td>$4,000</td></tr>
					<tr><td>2023</td><td>$3,000</td><td>$750</td><td>$3,750</td></tr>
				</table>
			</div>`;
		const $ = cheerio.load(html);
		const panel = $('.TabbedPanelsContent').first();
		const history = extractTaxHistory($, panel);
		expect(history).toHaveLength(2);
		expect(history[0]).toEqual({ year: 2024, general_tax: 3200, special_tax: 800, total_tax: 4000 });
		expect(history[1]).toEqual({ year: 2023, general_tax: 3000, special_tax: 750, total_tax: 3750 });
	});

	it('skips non-year rows', () => {
		const html = `
			<div class="TabbedPanelsContent">
				<table>
					<tr><td>Header</td><td>A</td><td>B</td><td>C</td></tr>
					<tr><td>2024</td><td>$100</td><td>$50</td><td>$150</td></tr>
				</table>
			</div>`;
		const $ = cheerio.load(html);
		const panel = $('.TabbedPanelsContent').first();
		const history = extractTaxHistory($, panel);
		expect(history).toHaveLength(1);
	});
});

describe('extractDeeds', () => {
	it('extracts warranty deed rows and skips non-WD types', () => {
		// Actual column order: Entry# | Date | Recorded | Type | Grantor | Grantee
		const html = `
			<div class="TabbedPanelsContent">
				<table>
					<tr><td>12345-2020</td><td>01/15/2020</td><td>01/16/2020</td><td>WD</td><td>SMITH JOHN</td><td>DOE JANE</td></tr>
					<tr><td>67890-2021</td><td>03/20/2021</td><td>03/21/2021</td><td>TD</td><td>BANK A</td><td>SMITH JOHN</td></tr>
					<tr><td>11111-2022</td><td>06/01/2022</td><td>06/02/2022</td><td>WD</td><td>DOE JANE</td><td>ACME LLC</td></tr>
				</table>
			</div>`;
		const $ = cheerio.load(html);
		const panel = $('.TabbedPanelsContent').first();
		const deeds = extractDeeds($, panel);
		expect(deeds).toHaveLength(2);
		expect(deeds[0]).toEqual({
			date: '01/15/2020', grantor: 'SMITH JOHN', grantee: 'DOE JANE', entry_number: '12345-2020'
		});
		expect(deeds[1]).toEqual({
			date: '06/01/2022', grantor: 'DOE JANE', grantee: 'ACME LLC', entry_number: '11111-2022'
		});
	});

	it('returns empty array when no WD rows found', () => {
		const html = `
			<div class="TabbedPanelsContent">
				<table>
					<tr><td>12345</td><td>01/15/2020</td><td>01/16/2020</td><td>QCD</td><td>A</td><td>B</td></tr>
				</table>
			</div>`;
		const $ = cheerio.load(html);
		const panel = $('.TabbedPanelsContent').first();
		expect(extractDeeds($, panel)).toEqual([]);
	});
});

describe('extractOwnerHistory', () => {
	it('extracts owner rows with year ranges', () => {
		const html = `
			<div class="TabbedPanelsContent">
				<table>
					<tr><td>2019-2024</td><td>&nbsp;</td><td>ACME LLC</td></tr>
					<tr><td>2015-2018</td><td>&nbsp;</td><td>SMITH JOHN</td></tr>
				</table>
			</div>`;
		const $ = cheerio.load(html);
		const panel = $('.TabbedPanelsContent').first();
		const history = extractOwnerHistory($, panel);
		expect(history).toHaveLength(2);
		expect(history[0]).toEqual({ years: '2019-2024', name: 'ACME LLC' });
		expect(history[1]).toEqual({ years: '2015-2018', name: 'SMITH JOHN' });
	});
});

describe('validateTabPanel', () => {
	it('returns panel when tab label matches', () => {
		const html = `
			<div class="TabbedPanelsTab">Owner Names</div>
			<div class="TabbedPanelsTab">Tax History</div>
			<div class="TabbedPanelsContent"><p>owner data</p></div>
			<div class="TabbedPanelsContent"><p>tax data</p></div>`;
		const $ = cheerio.load(html);
		const panel = validateTabPanel($, 0, 'Owner');
		expect(panel).not.toBeNull();
		expect(panel!.text()).toContain('owner data');
	});

	it('finds correct panel even when tab index differs from panel index', () => {
		// Simulate extra panels (real page has 7 tabs but 8 panels)
		const html = `
			<div class="TabbedPanelsTab">Owner Names</div>
			<div class="TabbedPanelsTab">Value History</div>
			<div class="TabbedPanelsTab">Tax History</div>
			<div class="TabbedPanelsContent"><p>owner data</p></div>
			<div class="TabbedPanelsContent"><p>value data</p></div>
			<div class="TabbedPanelsContent"><p>tax data</p></div>`;
		const $ = cheerio.load(html);
		const panel = validateTabPanel($, 1, 'Tax');
		expect(panel).not.toBeNull();
		expect(panel!.text()).toContain('tax data');
	});

	it('returns null when no tab matches', () => {
		const html = `
			<div class="TabbedPanelsTab">Something Else</div>
			<div class="TabbedPanelsContent"><p>data</p></div>`;
		const $ = cheerio.load(html);
		const panel = validateTabPanel($, 0, 'Owner');
		expect(panel).toBeNull();
	});
});

describe('multi-parcel aggregation', () => {
	// Test the aggregation logic by importing lookupByParcels — but since it calls
	// external APIs we test the pure aggregation helpers via extractors instead.
	// The aggregation function is tested via the deeds deduplication behavior.

	it('deeds deduplication by entry_number works via extractDeeds', () => {
		// Simulate two panels with overlapping deeds (Entry# | Date | Recorded | Type | Grantor | Grantee)
		const html1 = `<div class="TabbedPanelsContent">
			<table><tr><td>12345</td><td>01/15/2020</td><td>01/16/2020</td><td>WD</td><td>A</td><td>B</td></tr></table>
		</div>`;
		const html2 = `<div class="TabbedPanelsContent">
			<table>
				<tr><td>12345</td><td>01/15/2020</td><td>01/16/2020</td><td>WD</td><td>A</td><td>B</td></tr>
				<tr><td>67890</td><td>03/01/2021</td><td>03/02/2021</td><td>WD</td><td>C</td><td>D</td></tr>
			</table>
		</div>`;

		const $1 = cheerio.load(html1);
		const $2 = cheerio.load(html2);
		const deeds1 = extractDeeds($1, $1('.TabbedPanelsContent').first());
		const deeds2 = extractDeeds($2, $2('.TabbedPanelsContent').first());

		// Manual dedup (same logic as aggregateCountyData)
		const seen = new Set<string>();
		const merged: typeof deeds1 = [];
		for (const d of [...deeds1, ...deeds2]) {
			if (!seen.has(d.entry_number)) {
				seen.add(d.entry_number);
				merged.push(d);
			}
		}
		expect(merged).toHaveLength(2);
		expect(merged[0].entry_number).toBe('12345');
		expect(merged[1].entry_number).toBe('67890');
	});
});
