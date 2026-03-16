// Zoning Classification — zone code + jurisdiction + allowed uses
import type { TemplateContext } from '../context.js';
import { str } from './helpers.js';

export function render(ctx: TemplateContext): string {
	const city = str(ctx.city, 'the subject municipality');
	const propertyType = str(ctx.property_type, 'commercial');

	if (!ctx.zoning?.trim()) {
		return `<p><em>Zoning classification not available. Update property facts with the zoning designation
to populate this section.</em></p>`;
	}

	const zoning = ctx.zoning!.trim();

	let html = `<p>The subject property is zoned <strong>${zoning}</strong> under the ${city} zoning ordinance.</p>`;

	// Provide general guidance based on common Utah zoning patterns
	const zoneLower = zoning.toLowerCase();
	let useDescription = '';

	if (zoneLower.includes('c-') || zoneLower.includes('commercial') || zoneLower.includes('gc') || zoneLower.includes('cc')) {
		useDescription = `The ${zoning} zone is a commercial zone that generally permits a range of retail,
office, and service-oriented uses. Specific permitted uses, conditional uses, and development
standards are established by the ${city} zoning ordinance.`;
	} else if (zoneLower.includes('m-') || zoneLower.includes('industrial') || zoneLower.includes('i-') || zoneLower.includes('mi')) {
		useDescription = `The ${zoning} zone is an industrial/manufacturing zone that generally permits
warehouse, manufacturing, and distribution uses along with certain commercial uses.
Specific permitted and conditional uses are established by the ${city} zoning ordinance.`;
	} else if (zoneLower.includes('r-') || zoneLower.includes('residential') || zoneLower.includes('rm')) {
		useDescription = `The ${zoning} zone is a residential zone. The existing ${propertyType} use may be
a legal non-conforming use or permitted under specific conditions of the zoning ordinance.
Verification with the planning department is recommended.`;
	} else if (zoneLower.includes('a-') || zoneLower.includes('ag')) {
		useDescription = `The ${zoning} zone is an agricultural zone that may permit certain commercial
or industrial uses as conditional uses. The existing use should be verified with the local
planning department for conformity.`;
	} else {
		useDescription = `Specific permitted uses, conditional uses, and development standards
for the ${zoning} zone are established by the ${city} zoning ordinance. The reader is
referred to the applicable ordinance for detailed requirements.`;
	}

	html += `<p>${useDescription}</p>`;

	return html;
}
