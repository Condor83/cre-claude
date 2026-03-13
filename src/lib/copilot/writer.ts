import Anthropic from '@anthropic-ai/sdk';
import type { CopilotContext } from './context.js';

const anthropic = new Anthropic();

export interface WriterResult {
	text: string;
	citations: Array<{
		claim: string;
		source: string;
		verified: boolean;
	}>;
}

function buildPrompt(sectionKey: string, context: CopilotContext, userText: string): string {
	const subjectInfo = formatSubject(context.subject);

	let prompt = `You are a commercial real estate appraisal report writer assisting a MAI-designated appraiser. Write content for the "${sectionKey}" section of an appraisal report.

SUBJECT PROPERTY:
${subjectInfo}
`;

	if (context.sectionType === 'boilerplate') {
		prompt += `
This is a boilerplate section. Use professional appraisal language. Keep the structure consistent with standard USPAP-compliant reports.

${context.clauses.length > 0 ? `REFERENCE LANGUAGE (adapt, don't copy verbatim):\n${context.clauses.slice(0, 3).join('\n---\n')}\n` : ''}`;
	} else if (context.sectionType === 'comp') {
		const compsInfo = context.comps.map(formatComp).join('\n\n');
		prompt += `
COMPARABLE DATA:
${compsInfo}

${context.exemplars.length > 0 ? `EXAMPLE SECTION STRUCTURE:\n${context.exemplars[0]}\n` : ''}

Write analysis that compares each comparable to the subject property. Reference specific data points (price/SF, cap rate, adjustments). Be factual and precise.`;
	} else {
		// narrative
		prompt += `
${context.exemplars.length > 0 ? `EXAMPLE SECTION STRUCTURE:\n${context.exemplars[0]}\n` : ''}
${context.clauses.length > 0 ? `REFERENCE LANGUAGE:\n${context.clauses.slice(0, 3).join('\n---\n')}\n` : ''}

${Object.keys(context.existingContent).length > 0 ? `ALREADY WRITTEN SECTIONS:\n${Object.entries(context.existingContent).map(([k, v]) => `[${k}]: ${v.slice(0, 500)}`).join('\n')}\n` : ''}

Write a professional narrative section. Use third-person, present tense. Reference specific facts about the subject property. Maintain consistency with already-written sections.`;
	}

	prompt += `

USER'S CURRENT TEXT (continue from here):
${userText || '(empty - write the opening paragraph)'}

RULES:
- Write in professional appraisal report style
- Be factual — only reference data provided above
- Mark any claim you cannot verify with [VERIFY]
- Do not include value conclusions unless this is the reconciliation section
- Return ONLY the continuation text, no meta-commentary

Return a JSON object:
{
  "text": "the continuation text",
  "citations": [{"claim": "...", "source": "...", "verified": true/false}]
}`;

	return prompt;
}

function formatSubject(subject: Record<string, unknown>): string {
	const fields = [
		['Address', subject.address],
		['City/State', `${subject.city || ''}, ${subject.state || 'UT'}`],
		['APN', subject.apn],
		['Property Type', subject.property_type],
		['Building SF', subject.building_sf],
		['Land SF', subject.land_sf],
		['Year Built', subject.year_built],
		['Stories', subject.stories],
		['Construction', subject.construction_class],
		['Quality', subject.quality],
		['Condition', subject.condition],
		['Zoning', subject.zoning]
	];
	return fields
		.filter(([, v]) => v != null && v !== '')
		.map(([k, v]) => `${k}: ${v}`)
		.join('\n');
}

function formatComp(comp: Record<string, unknown>): string {
	const fields = [
		['Address', comp.address],
		['City', comp.city],
		['Type', comp.property_type],
		['Building SF', comp.building_sf],
		['Year Built', comp.year_built],
		['Sale Date', comp.sale_date],
		['Sale Price', comp.sale_price],
		['Price/SF', comp.price_per_sf],
		['Cap Rate', comp.sale_cap_rate],
		['Tenant', comp.tenant_name],
		['Rent/SF', comp.rent_per_sf],
		['Lease Type', comp.lease_type]
	];
	return fields
		.filter(([, v]) => v != null && v !== '')
		.map(([k, v]) => `${k}: ${v}`)
		.join('\n');
}

export async function generateSectionText(
	sectionKey: string,
	context: CopilotContext,
	userText: string
): Promise<WriterResult> {
	const prompt = buildPrompt(sectionKey, context, userText);

	const response = await anthropic.messages.create({
		model: 'claude-sonnet-4-20250514',
		max_tokens: 2048,
		messages: [
			{
				role: 'user',
				content: prompt
			}
		]
	});

	const text = response.content[0].type === 'text' ? response.content[0].text : '';
	try {
		const result = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
		return {
			text: result.text ?? text,
			citations: result.citations ?? []
		};
	} catch {
		// If not valid JSON, use raw text
		return { text, citations: [] };
	}
}
