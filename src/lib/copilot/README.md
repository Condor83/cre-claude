# Copilot System

AI writing assistant that assembles context from ingested reports and generates ghost text suggestions for report sections.

## Files

- **context.ts** — Context assembly (semantic search + structured queries)
- **writer.ts** — Claude-powered section text generation

## Context Assembly

`assembleContext(reportId, sectionKey)` builds a `CopilotContext`:

| Field | Source |
|-------|--------|
| `subject` | Report + subject property from DB |
| `comps` | Selected comparables (for comp-type sections) |
| `exemplars` | Top 3 matching example sections via vector search |
| `clauses` | Top 5 matching boilerplate paragraphs via vector search |
| `existingContent` | Other sections already written (for consistency) |
| `sectionType` | `boilerplate`, `comp`, or `narrative` |

### Section Types

- **Boilerplate:** transmittal, certification, assumptions, scope_of_work, appraiser_qualifications
- **Comp:** sales_comparison, income_approach, comp_sale_data, comp_lease_data, adjustment_grid, operating_statement, subject_lease_table
- **Narrative:** neighborhood, site_description, improvement_description, highest_best_use, reconciliation

### Search Strategy
1. Embed query `"{sectionKey} section commercial real estate appraisal"` via Gemini
2. Vector search for 10 similar chunks across all documents
3. Filter by chunk_type + section_label relevance
4. Fallback to SQL full-text query if vectors unavailable

## Writing

`generateSectionText(sectionKey, context, userText)` sends assembled context + user's current text to Claude Sonnet 4, which returns:
- **text** — Continuation suggestion (2048 token limit)
- **citations** — Array of {claim, source, verified} for provenance

## Ghost Text UX Flow

1. User types in TipTap editor
2. 3-second idle → request ghost text
3. Claude returns suggestion
4. Tab to accept full suggestion, Cmd+Right for word-by-word
5. Cleared on any edit
