// Access & Transportation — highway proximity, AADT on major roads, general access
import type { TemplateContext } from '../context.js';
import type { AccessData } from '$lib/services/data/udot-traffic.js';
import { fmt, str } from './helpers.js';

export function render(ctx: TemplateContext): string {
	const data = ctx.market_data.udot_access as AccessData | undefined;

	if (!data?.nearby_roads?.length && !data?.nearest_highway) {
		return `<p class="data-placeholder"><em>[Access & Transportation — Traffic data from Utah Department of Transportation not yet loaded. Use "Refresh Data" to fetch AADT counts.]</em></p>`;
	}

	const city = str(ctx.city, 'the subject city');
	let html = '';

	// Highway access
	if (data.nearest_highway) {
		const hw = data.nearest_highway;
		const hwLabel = hw.name.replace(/ (NB|SB|EB|WB) FWY$/i, '').replace(/^(I-\d+).*/, '$1');
		html += `<p>Primary regional access to the ${city} area is provided by ${hwLabel}, `;
		html += `located approximately ${hw.distanceMiles.toFixed(1)} miles from the subject property`;
		if (hw.aadt) html += ` (AADT: ${fmt(hw.aadt)})`;
		html += `. ${hwLabel} provides connectivity to the greater Provo-Orem metropolitan area `;
		html += `and the Wasatch Front via the Interstate highway system.</p>`;
	}

	// Major local roads
	const majorRoads = (data.nearby_roads ?? []).filter(r =>
		r.classification !== 'local' && r.aadt >= 3000
	).slice(0, 4);

	if (majorRoads.length > 0) {
		html += `<p>Major transportation routes serving the subject neighborhood include `;
		const parts = majorRoads.map(r => `${r.name} (AADT: ${fmt(r.aadt)})`);
		html += parts.join(', ') + '.</p>';
	}

	// Subject street mention
	if (data.subject_street) {
		const ss = data.subject_street;
		html += `<p>The subject property is located on ${ss.name}`;
		if (ss.aadt) html += ` with an Average Annual Daily Traffic (AADT) count of approximately ${fmt(ss.aadt)} vehicles per day`;
		html += `.</p>`;
	}

	html += `<p>Overall, the subject neighborhood benefits from adequate transportation infrastructure `;
	html += `with access to both local and regional road networks. Public transit service is available `;
	html += `through the Utah Transit Authority (UTA).</p>`;

	html += `<p class="source">Source: Utah Department of Transportation, Traffic & Safety Division</p>`;

	return html;
}
