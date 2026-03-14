import type { TemplateContext } from '../context.js';

export function render(ctx: TemplateContext): string {
	const a = ctx.appraiser;
	const name = a.name || '[Appraiser Name]';
	const certType = a.certification_type || 'Certified General Appraiser';
	const licNum = a.license_number || '[License Number]';
	const licState = a.license_state || 'UT';

	let html = `
<p><strong>QUALIFICATIONS OF THE APPRAISER</strong></p>

<p><strong>${name}</strong></p>
<ul>
`;

	if (a.company) html += `	<li>${a.company}</li>\n`;
	if (a.address) html += `	<li>${a.address}</li>\n`;
	if (a.phone) html += `	<li>Phone: ${a.phone}</li>\n`;
	if (a.email) html += `	<li>Email: ${a.email}</li>\n`;

	html += `</ul>

<p><strong>Certification / Licensing</strong></p>
<ul>
	<li>${certType}</li>
	<li>License No. ${licNum}, State of ${licState}</li>
</ul>
`;

	if (a.cv_text) {
		html += `
<p><strong>Professional Background</strong></p>
<div>${a.cv_text}</div>
`;
	}

	return html;
}
