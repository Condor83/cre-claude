// Shared formatting helpers for subsection templates
// All helpers are null-safe — they return "N/A" for null/undefined, never crash

export function fmt(val: number | undefined | null): string {
	if (val == null || isNaN(val)) return 'N/A';
	return val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function fmtCurrency(val: number | undefined | null): string {
	if (val == null || isNaN(val)) return 'N/A';
	return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function fmtPct(val: number | undefined | null, decimals = 1): string {
	if (val == null || isNaN(val)) return 'N/A';
	return val.toFixed(decimals) + '%';
}

export function fmtDecimal(val: number | undefined | null, decimals = 2): string {
	if (val == null || isNaN(val)) return 'N/A';
	return val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtAcres(val: number | undefined | null): string {
	if (val == null || isNaN(val)) return 'N/A';
	return val.toFixed(2) + ' acres';
}

export function fmtSF(val: number | undefined | null): string {
	if (val == null || isNaN(val)) return 'N/A';
	return fmt(val) + ' SF';
}

/** Safe division — returns null if denominator is 0 or null */
export function safeDivide(numerator: number | null, denominator: number | null): number | null {
	if (numerator == null || denominator == null || denominator === 0) return null;
	return numerator / denominator;
}

/** Wrap text in a paragraph tag */
export function p(text: string): string {
	return `<p>${text}</p>`;
}

/** Render an HTML table from headers and rows */
export function renderTable(headers: string[], rows: string[][]): string {
	const thead = headers.map(h => `\t\t<th>${h}</th>`).join('\n');
	const tbody = rows.map(row =>
		'\t<tr>\n' + row.map(cell => `\t\t<td>${cell}</td>`).join('\n') + '\n\t</tr>'
	).join('\n');

	return `
<table>
<thead>
	<tr>
${thead}
	</tr>
</thead>
<tbody>
${tbody}
</tbody>
</table>`;
}

/** Safely access a string value, returning fallback for null/undefined/empty */
export function str(val: string | null | undefined, fallback: string | null = 'N/A'): string {
	return val?.trim() || fallback || 'N/A';
}

/** Current year for template use */
export function currentYear(): number {
	return new Date().getFullYear();
}
