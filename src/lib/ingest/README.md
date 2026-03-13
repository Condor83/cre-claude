# Ingestion Pipeline

Two-module pipeline that converts PDF appraisal reports into structured data and searchable chunks.

## Files

- **chunker.ts** — PDF page extraction (PyMuPDF) + Claude page classification
- **extractor.ts** — Claude entity extraction (sales, leases, properties) + DB persistence

## Pipeline Flow

```
PDF Buffer
  → extractPagesFromPdf()     # PyMuPDF via scripts/extract-pdf.py
  → classifyChunks()           # Claude Sonnet, batches of 10 pages
  → insertChunk()              # Store in chunks table
  → extractEntities()          # Claude Sonnet, evidence+table chunks only
  → persistExtractionResults() # Write to properties/sales/leases tables
```

## chunker.ts

### extractPagesFromPdf(buffer)
Writes buffer to temp file, calls `python3 scripts/extract-pdf.py`, returns per-page text. Filters out pages with <20 chars.

### classifyChunks(pages)
Sends pages to Claude in batches of 10. Each page classified with:
- **chunk_type:** `clause` (boilerplate), `exemplar` (examples), `evidence` (facts), `table` (structured data)
- **section_label:** One of 22 CRE-specific labels (transmittal, sales_comparison, comp_sale_data, etc.)
- **confidence:** 0.0–1.0

Consecutive pages with same type + label are merged into single chunks.

## extractor.ts

### extractEntities(chunks)
Filters to evidence + table + cover_page chunks. Claude extracts:
- **report_number**, **report_date** — Document metadata
- **sale_comps** — Property details + sale price, cap rate, price/SF, financing
- **lease_comps** — Property details + tenant, rent/SF, lease type, term, escalations

Each field includes a confidence score.

### persistExtractionResults(documentId, result)
For each extracted comp:
1. `findOrCreateProperty()` — Dedup by APN, then normalized address
2. `linkDocumentProperty()` — Junction table with role (subject/comp_sale/comp_lease)
3. `insertSale()` or `insertLease()` — Transaction record with source document reference

## API Costs

2 Claude API calls per document:
1. Classification (scales with page count, batched at 10)
2. Entity extraction (single call on filtered chunks)
