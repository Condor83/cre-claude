import type { TemplateContext } from '../context.js';

interface ValueRecord {
	year: number;
	land: number;
	improvement: number;
	total: number;
}

interface TaxRecord {
	year: number;
	general_tax: number;
	special_tax: number;
	total_tax: number;
}

interface CountyData {
	value_history?: ValueRecord[];
	tax_history?: TaxRecord[];
	[key: string]: unknown;
}

function fmt(val: number | undefined | null): string {
	if (val == null || val === 0) return 'N/A';
	return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtTax(val: number | undefined | null): string {
	if (val == null || val === 0) return 'N/A';
	return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(val: number | null): string {
	if (val == null) return 'N/A';
	return val.toFixed(1) + '%';
}

export interface AssessmentOptions {
	yearFrom?: number;
	yearTo?: number;
}

export function render(ctx: TemplateContext, options?: AssessmentOptions): string {
	let countyData: CountyData | null = null;
	if (ctx.county_data_json) {
		try { countyData = JSON.parse(ctx.county_data_json); } catch { /* ignore */ }
	}

	const valueHistory = countyData?.value_history ?? [];
	const taxHistory = countyData?.tax_history ?? [];
	const county = ctx.county_display !== 'N/A' ? ctx.county_display : 'the local';

	let html = `
<p>The subject property is assessed and taxed by ${county} County. Real property in the
State of ${ctx.state ?? 'Utah'} is assessed at a percentage of fair market value as
determined by the county assessor. The following table summarizes the recent assessment
and tax history for the subject property:</p>
`;

	// Join value_history and tax_history by year
	if (valueHistory.length > 0 || taxHistory.length > 0) {
		const taxByYear = new Map(taxHistory.map(t => [t.year, t]));
		const valueByYear = new Map(valueHistory.map(v => [v.year, v]));

		// Collect all years, filter by range if provided, default to trailing 3
		let allYears = [...new Set([
			...valueHistory.map(v => v.year),
			...taxHistory.map(t => t.year)
		])].sort((a, b) => b - a);

		if (options?.yearFrom || options?.yearTo) {
			const from = options.yearFrom ?? 0;
			const to = options.yearTo ?? 9999;
			allYears = allYears.filter(y => y >= from && y <= to);
		} else {
			allYears = allYears.slice(0, 3);
		}

		// Build combined rows
		const rows: {
			year: number;
			land: number;
			improvement: number;
			total: number;
			taxes: number;
			pctIncrease: number | null;
		}[] = [];

		for (const year of allYears) {
			const val = valueByYear.get(year);
			const tax = taxByYear.get(year);
			rows.push({
				year,
				land: val?.land ?? 0,
				improvement: val?.improvement ?? 0,
				total: val?.total ?? 0,
				taxes: tax?.total_tax ?? 0,
				pctIncrease: null // calculated below
			});
		}

		// Calculate year-over-year percentage increase in total value
		for (let i = 0; i < rows.length - 1; i++) {
			const prev = rows[i + 1]; // older year
			if (prev.total > 0) {
				rows[i].pctIncrease = ((rows[i].total - prev.total) / prev.total) * 100;
			}
		}

		html += `
<table>
<thead>
	<tr>
		<th>Year</th>
		<th>Land Value</th>
		<th>Improvement Value</th>
		<th>Total Value</th>
		<th>Real Estate Taxes</th>
		<th>Percentage Increase</th>
	</tr>
</thead>
<tbody>
`;
		for (const row of rows) {
			html += `	<tr>
		<td>${row.year}</td>
		<td>${fmt(row.land)}</td>
		<td>${fmt(row.improvement)}</td>
		<td>${fmt(row.total)}</td>
		<td>${fmtTax(row.taxes)}</td>
		<td>${fmtPct(row.pctIncrease)}</td>
	</tr>\n`;
		}
		html += `</tbody>
</table>
`;
	} else if (ctx.market_value) {
		html += `
<table>
<thead>
	<tr>
		<th>Assessed / Market Value</th>
	</tr>
</thead>
<tbody>
	<tr>
		<td>${fmt(ctx.market_value)}</td>
	</tr>
</tbody>
</table>

<p>Detailed tax history was not available from county records at the time of this appraisal.
The market value shown above is based on the most recent county assessor data available.</p>
`;
	} else {
		html += `
<p>Detailed assessment and tax information was not available from county records at the
time of this appraisal. The reader is referred to the ${county} County Assessor's office
for current tax and assessment data.</p>
`;
	}

	html += `
<p>The appraiser has made no independent investigation of the tax burden and assumes the
information obtained from public records to be accurate. The appraisal assumes no
delinquent taxes or special assessments exist unless otherwise noted.</p>
`;

	return html;
}
