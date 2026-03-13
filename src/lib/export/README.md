# Export System

DOCX report generation from completed report sections.

## Files

- **docx.ts** — Builds Word document from report data

## Usage

`GET /export?report_id=<id>` triggers `generateDocx(reportId)` which returns a DOCX buffer.

## Document Structure

1. **Title page** — "APPRAISAL REPORT", subject address, file number, effective date
2. **12 sections** in standard order (transmittal → appraiser_qualifications)
3. **Comp table** inserted after sales_comparison section (header + data rows)
4. **Page breaks** between sections

## Styling

- Times New Roman throughout
- 24pt headings, 12pt body
- HTML content stripped to plain text paragraphs (block element splitting)

## Dependencies

Uses the `docx` npm package (v9.2.0) for OOXML generation.
