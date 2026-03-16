// Improvement Quality/Condition/Effective Age — Marshall Valuation classification, effective age
import type { TemplateContext } from '../context.js';
import { str, fmt } from './helpers.js';

export function render(ctx: TemplateContext): string {
	const quality = str(ctx.quality, null);
	const condition = str(ctx.condition, null);
	const yearBuilt = ctx.year_built;
	const effectiveAge = ctx.effective_age;
	const currentYear = new Date().getFullYear();
	const actualAge = yearBuilt ? currentYear - yearBuilt : null;

	let html = '';

	// Quality rating
	if (quality) {
		html += `<p><strong>Quality Rating:</strong> The improvements are rated as <strong>${quality}</strong> quality
per the Marshall Valuation Service classification system. `;

		const q = quality.toLowerCase();
		if (q.includes('average') || q === 'c' || q === 'c+') {
			html += `This rating reflects construction that meets standard building codes with
average-grade materials and workmanship typical of the market area.`;
		} else if (q.includes('good') || q === 'b' || q === 'b+') {
			html += `This rating reflects construction with above-average materials and workmanship,
exceeding minimum building code requirements.`;
		} else if (q.includes('fair') || q === 'd' || q === 'c-') {
			html += `This rating reflects construction with basic materials and workmanship meeting
minimum building code requirements.`;
		} else {
			html += `This rating is based on the quality of materials, workmanship, and overall design
observed during the site inspection.`;
		}
		html += `</p>`;
	}

	// Condition
	if (condition) {
		html += `<p><strong>Condition:</strong> The overall condition of the improvements is rated as
<strong>${condition}</strong>. `;

		const c = condition.toLowerCase();
		if (c.includes('good') || c.includes('well')) {
			html += `The building appears to be well-maintained with no significant deferred maintenance
observed during the inspection.`;
		} else if (c.includes('average') || c.includes('fair')) {
			html += `The building shows typical wear for its age with minor deferred maintenance items noted.`;
		} else if (c.includes('poor') || c.includes('below')) {
			html += `The building exhibits significant deferred maintenance and may require substantial
capital expenditures in the near term.`;
		}
		html += `</p>`;
	}

	// Age analysis
	if (yearBuilt) {
		html += `<p><strong>Age Analysis:</strong></p>
<ul>
<li><strong>Year Built:</strong> ${yearBuilt}</li>
<li><strong>Actual Age:</strong> ${actualAge != null ? `${actualAge} years` : 'N/A'}</li>
<li><strong>Effective Age:</strong> ${effectiveAge != null ? `${effectiveAge} years` : 'N/A'}</li>`;

		if (effectiveAge != null && actualAge != null) {
			const economicLife = effectiveAge < actualAge ? 45 : 40; // rough estimate
			const remainingLife = Math.max(0, economicLife - effectiveAge);
			html += `
<li><strong>Estimated Economic Life:</strong> ${economicLife} years</li>
<li><strong>Remaining Economic Life:</strong> ${remainingLife} years</li>`;
		}

		html += `\n</ul>`;

		if (effectiveAge != null && actualAge != null && effectiveAge < actualAge) {
			html += `<p>The effective age is less than the actual age, indicating that the improvements
have been well-maintained and/or renovated, resulting in a longer remaining economic life than
would be typical for a building of this chronological age.</p>`;
		} else if (effectiveAge != null && actualAge != null && effectiveAge > actualAge) {
			html += `<p>The effective age exceeds the actual age, suggesting deferred maintenance or
functional issues that have accelerated the aging of the improvements.</p>`;
		}
	}

	if (!quality && !condition && !yearBuilt) {
		html = `<p><em>Quality, condition, and age data not available. Update property facts to populate
this section.</em></p>`;
	}

	return html;
}
