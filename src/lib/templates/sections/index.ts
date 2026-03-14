import type { TemplateContext } from '../context.js';

import { render as identification } from './identification.js';
import { render as purpose_use } from './purpose_use.js';
import { render as scope_of_work } from './scope_of_work.js';
import { render as market_value_def } from './market_value_def.js';
import { render as as_is_def } from './as_is_def.js';
import { render as property_rights } from './property_rights.js';
import { render as date_of_appraisal } from './date_of_appraisal.js';
import { render as report_completion_date } from './report_completion_date.js';
import { render as statement_of_ownership } from './statement_of_ownership.js';
import { render as assessment_taxes } from './assessment_taxes.js';
import { render as valuation_process } from './valuation_process.js';
import { render as certification } from './certification.js';
import { render as general_assumptions } from './general_assumptions.js';
import { render as general_limiting_conditions } from './general_limiting_conditions.js';
import { render as appraiser_qualifications } from './appraiser_qualifications.js';
import { render as definitions_glossary } from './definitions_glossary.js';
import { render as title_page } from './title_page.js';
import { render as summary_conclusions } from './summary_conclusions.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AUTO_TEMPLATES: Record<string, (ctx: TemplateContext, options?: any) => string> = {
	identification,
	purpose_use,
	scope_of_work,
	market_value_def,
	as_is_def,
	property_rights,
	date_of_appraisal,
	report_completion_date,
	statement_of_ownership,
	assessment_taxes,
	valuation_process,
	certification,
	general_assumptions,
	general_limiting_conditions,
	appraiser_qualifications,
	definitions_glossary,
	title_page,
	summary_conclusions
};
