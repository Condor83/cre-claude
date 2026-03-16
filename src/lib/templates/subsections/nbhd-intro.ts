// Neighborhood Intro/Definition — USPAP neighborhood definition boilerplate with footnotes
import type { TemplateContext } from '../context.js';

export function render(ctx: TemplateContext): string {
	return `<p>A neighborhood is defined as "a group of complementary land uses; a conterminous area
that is characterized by similar types of property use."<sup>1</sup> Analysis of neighborhood characteristics
is essential in the valuation process because real estate values are directly affected by the
influences of the surrounding environment.</p>

<p>The purpose of a neighborhood analysis is to identify the area that is subject to the same
influences as the property being appraised. The boundaries of a neighborhood identify the area
within which the forces of supply and demand are at work. A thorough understanding of these
forces is essential to developing a meaningful estimate of value.</p>

<p>The neighborhood analysis provides the context for the comparable data used in the
valuation analysis. The following sections detail the demographic, economic, and physical
characteristics of the subject neighborhood.</p>

<p class="footnote"><sup>1</sup> <em>The Appraisal of Real Estate</em>, 15th Edition, Appraisal Institute, 2020.</p>`;
}
