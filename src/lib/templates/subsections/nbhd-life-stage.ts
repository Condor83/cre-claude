// Neighborhood Life Stage — 4-stage definition boilerplate
// Selection value comes from form_data (growth/stability/decline/revitalization)
import type { TemplateContext } from '../context.js';

export interface LifeStageOptions {
	stage?: 'growth' | 'stability' | 'decline' | 'revitalization';
}

const STAGE_DESCRIPTIONS: Record<string, { label: string; description: string }> = {
	growth: {
		label: 'Growth',
		description: `The neighborhood is currently in the <strong>growth</strong> stage of its life cycle.
This stage is characterized by new construction, population increases, rising property values,
and an expanding economic base. Demand for real estate in the area generally exceeds supply,
and market participants perceive the area as desirable for investment and development.`
	},
	stability: {
		label: 'Stability',
		description: `The neighborhood is currently in the <strong>stability</strong> stage of its life cycle.
This stage is characterized by relatively stable property values, a balance between supply and
demand, and minimal new construction. The area is substantially built-up and the existing
improvements are being adequately maintained. Population and economic indicators are generally
stable with modest growth trends.`
	},
	decline: {
		label: 'Decline',
		description: `The neighborhood is currently in the <strong>decline</strong> stage of its life cycle.
This stage is characterized by decreasing demand, aging improvements, deferred maintenance,
and potentially decreasing property values. Some properties may experience functional or
external obsolescence. Market participants may perceive the area as less desirable for
new investment.`
	},
	revitalization: {
		label: 'Revitalization',
		description: `The neighborhood is currently in the <strong>revitalization</strong> stage of its life cycle.
This stage is characterized by renovation and rehabilitation of existing improvements,
new infill development, increasing demand, and rising property values. The area is
experiencing renewed interest from investors and owner-occupants, often supported by
public or private reinvestment initiatives.`
	}
};

export function render(ctx: TemplateContext, options?: LifeStageOptions): string {
	let html = `<p>The Appraisal Institute identifies four stages in the life cycle of a neighborhood:</p>
<ol>
<li><strong>Growth</strong> — Period of development and expansion</li>
<li><strong>Stability</strong> — Period of equilibrium without marked gains or losses</li>
<li><strong>Decline</strong> — Period of diminishing demand and property values</li>
<li><strong>Revitalization</strong> — Period of renewal, modernization, and increasing demand</li>
</ol>`;

	const stage = options?.stage;
	if (stage && STAGE_DESCRIPTIONS[stage]) {
		html += `<p>${STAGE_DESCRIPTIONS[stage].description}</p>`;
	} else {
		html += `<p><em>[Select the neighborhood life stage using the form controls above.]</em></p>`;
	}

	return html;
}
