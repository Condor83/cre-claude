// Site Access & Street Improvements — subject street specifics, classification, AADT
import type { TemplateContext } from '../context.js';
import type { AccessData } from '$lib/services/data/udot-traffic.js';
import { classificationLabel } from '$lib/services/data/udot-traffic.js';
import { fmt, str } from './helpers.js';

export function render(ctx: TemplateContext): string {
	const data = ctx.market_data.udot_access as AccessData | undefined;

	if (!data) {
		return `<p class="data-placeholder"><em>[Site Access & Street Improvements — Traffic data from Utah Department of Transportation not yet loaded. Use "Refresh Data" to fetch AADT counts.]</em></p>`;
	}

	const address = str(ctx.address, 'the subject property');
	let html = '';

	if (data.subject_street) {
		const ss = data.subject_street;
		const classLabel = classificationLabel(ss.classification);

		html += `<p>The subject property at ${address} fronts ${ss.name}, `;
		html += `classified as a ${classLabel.toLowerCase()}`;
		if (ss.aadt) {
			html += ` with an AADT count of approximately ${fmt(ss.aadt)} vehicles per day`;
		}
		html += `.</p>`;
	} else if (data.address_street) {
		html += `<p>The subject property at ${address} is accessed from ${data.address_street}.</p>`;
	} else {
		html += `<p>The subject property is located at ${address}.</p>`;
	}

	// Street improvements note (requires onsite — template provides standard language)
	html += `<p>Street improvements along the subject frontage include paved road surfaces. `;
	html += `The presence and condition of curb, gutter, and sidewalk improvements should be `;
	html += `confirmed during the onsite inspection.</p>`;

	// Nearby road access
	const nearbyNonLocal = (data.nearby_roads ?? [])
		.filter(r => r.classification !== 'local' && r.distanceMiles <= 1)
		.slice(0, 3);

	if (nearbyNonLocal.length > 0) {
		html += `<p>Nearby access routes include `;
		const parts = nearbyNonLocal.map(r =>
			`${r.name} (${fmt(r.aadt)} AADT, ${r.distanceMiles.toFixed(2)} miles)`
		);
		html += parts.join('; ') + '.</p>';
	}

	html += `<p class="source">Source: Utah Department of Transportation, Traffic & Safety Division</p>`;

	return html;
}
