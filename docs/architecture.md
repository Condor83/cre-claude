# Architecture

## System Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  SvelteKit   │────▶│   SQLite DB   │◀────│  sqlite-vec  │
│  Frontend    │     │  (WAL mode)   │     │  (vectors)   │
└──────┬───────┘     └──────┬────────┘     └──────────────┘
       │                    │
       ▼                    ▼
┌──────────────┐     ┌──────────────┐
│ Claude API   │     │  Gemini API   │
│ (Anthropic)  │     │  (Google)     │
│              │     │              │
│ • Classify   │     │ • Embed      │
│ • Extract    │     │   chunks     │
│ • Write      │     │ • Embed      │
│              │     │   queries    │
└──────────────┘     └──────────────┘
       ▲
       │
┌──────────────┐
│   PyMuPDF    │
│  (Python)    │
│              │
│ • PDF → text │
└──────────────┘
```

## Data Models

### Entity Relationship Diagram

```
documents 1──┬──N chunks ─── 1:1 ─── vec_chunks
             │
             N
             │
  document_properties (role: subject|comp_sale|comp_lease)
             │
             N
             │
properties 1──┬──N sales
              └──N leases

reports 1──┬──N report_sections
           └──N report_comps ──▶ properties + sales/leases
```

### documents
Source PDF files uploaded for ingestion.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| filename | TEXT | Original filename |
| upload_date | TEXT | ISO timestamp |
| page_count | INTEGER | Total pages in PDF |
| report_number | TEXT | Extracted report identifier |
| report_date | TEXT | Extracted effective date |
| status | TEXT | `pending` → `processing` → `ready` \| `error` |
| error_message | TEXT | Error details if status='error' |

### chunks
Classified sections extracted from document pages.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| document_id | INTEGER FK | → documents.id |
| chunk_type | TEXT | `clause` \| `exemplar` \| `evidence` \| `table` |
| section_label | TEXT | One of 22 CRE section labels |
| page_start | INTEGER | First page of chunk |
| page_end | INTEGER | Last page of chunk |
| content | TEXT | Full extracted text |
| confidence | REAL | Classification confidence 0.0–1.0 |

**Chunk types:**
- **clause** — Boilerplate/template language (assumptions, certifications)
- **exemplar** — Example section structures worth emulating
- **evidence** — Factual data (property details, market data, comparable info)
- **table** — Structured/tabular data (comp grids, rent rolls)

### vec_chunks
Virtual table (sqlite-vec) for semantic search.

| Column | Type | Description |
|--------|------|-------------|
| rowid | INTEGER | Maps to chunks.id |
| embedding | float[768] | L2-normalized Gemini embedding |

**Query pattern:** `SELECT ... FROM vec_chunks WHERE embedding MATCH ? AND k = ?`

### properties
Canonical property records, deduplicated by APN then normalized address.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| address | TEXT | Original address |
| address_normalized | TEXT | Lowercased, standardized |
| city | TEXT | City |
| state | TEXT | State abbreviation |
| zip | TEXT | ZIP code |
| apn | TEXT | Assessor's Parcel Number (unique where not null) |
| property_type | TEXT | Retail, Office, Industrial, etc. |
| year_built | INTEGER | Construction year |
| building_sf | REAL | Building square footage |
| land_sf | REAL | Land square footage |
| land_acres | REAL | Land acreage |
| stories | INTEGER | Number of stories |
| construction_class | TEXT | A, B, C, D |
| quality | TEXT | Quality rating |
| condition | TEXT | Condition rating |
| zoning | TEXT | Zoning designation |
| latitude | REAL | Geo coordinate |
| longitude | REAL | Geo coordinate |

### document_properties
Junction table — which documents reference which properties and in what role.

| Column | Type | Description |
|--------|------|-------------|
| document_id | INTEGER FK | → documents.id |
| property_id | INTEGER FK | → properties.id |
| role | TEXT | `subject` \| `comp_sale` \| `comp_lease` |
| source_page | INTEGER | Page where reference found |
| confidence | REAL | Extraction confidence |

**Unique constraint:** (document_id, property_id, role)

### sales
Sale comparable transactions.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| property_id | INTEGER FK | → properties.id |
| sale_date | TEXT | Date of sale |
| sale_price | REAL | Transaction price |
| price_per_sf | REAL | Price per square foot |
| cap_rate | REAL | Capitalization rate |
| grantor | TEXT | Seller |
| grantee | TEXT | Buyer |
| financing | TEXT | Financing terms |
| verification_source | TEXT | Data verification source |
| source_document_id | INTEGER FK | → documents.id |
| source_page | INTEGER | Page in source document |
| confidence | REAL | Extraction confidence |
| mls_sourced | INTEGER | Boolean — from MLS? |

### leases
Lease comparable transactions.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| property_id | INTEGER FK | → properties.id |
| tenant_name | TEXT | Tenant name |
| lease_sf | REAL | Leased square footage |
| rent_per_sf | REAL | Rent per SF |
| lease_type | TEXT | NNN, Modified Gross, Full Service, etc. |
| commencement_date | TEXT | Lease start |
| term_years | REAL | Lease duration |
| escalations | TEXT | Escalation terms |
| office_pct | REAL | Office percentage (industrial) |
| source_document_id | INTEGER FK | → documents.id |
| source_page | INTEGER | Page in source document |
| confidence | REAL | Extraction confidence |
| mls_sourced | INTEGER | Boolean — from MLS? |

### reports
Appraisal reports being authored.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| report_number | TEXT | Report file number |
| subject_property_id | INTEGER FK | → properties.id |
| approach | TEXT | `sales_comparison` \| `income_cap` \| `both` |
| effective_date | TEXT | Appraisal effective date |
| status | TEXT | `draft` \| `review` \| `final` |

### report_sections
Per-section editor state for TipTap.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| report_id | INTEGER FK | → reports.id |
| section_key | TEXT | Section identifier |
| content_json | TEXT | TipTap document state |
| content_html | TEXT | Rendered HTML |
| last_saved | TEXT | ISO timestamp |

**Unique constraint:** (report_id, section_key)

### report_comps
Selected comparables for a report with adjustment data.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| report_id | INTEGER FK | → reports.id |
| comp_type | TEXT | `sale` \| `lease` |
| property_id | INTEGER FK | → properties.id |
| sale_id | INTEGER FK | → sales.id |
| lease_id | INTEGER FK | → leases.id |
| rank | INTEGER | Display order |
| adjustment_json | TEXT | JSON adjustment data |
| analysis_text | TEXT | Comp analysis narrative |

## Data Flows

### Ingestion Pipeline

```
POST /ingest (PDF file, max 50MB)
       │
       ▼
  ┌─ insertDocument() ─── documents [status: processing]
  │
  ├─ extractPagesFromPdf() ─── python3 scripts/extract-pdf.py
  │       │
  │       ▼
  ├─ classifyChunks() ─── Claude Sonnet (batch 10 pages)
  │       │
  │       ▼
  ├─ insertChunk() ─── chunks table
  │       │
  │       ▼
  ├─ extractEntities() ─── Claude Sonnet (evidence + table chunks)
  │       │
  │       ▼
  ├─ persistExtractionResults()
  │       ├── findOrCreateProperty() ─── properties (APN dedup)
  │       ├── linkDocumentProperty() ─── document_properties
  │       ├── insertSale() ─── sales
  │       └── insertLease() ─── leases
  │
  ├─ embedAndStoreChunks() ─── Gemini → vec_chunks
  │
  └─ updateDocumentStatus('ready')
```

### Report Writing

```
User types in Editor
       │
       ▼ (3s idle)
  assembleContext(reportId, sectionKey)
       │
       ├── getReport() → subject property
       ├── getSections() → existing content
       ├── getReportComps() → selected comparables
       └── semantic search → exemplars + clauses
              │
              ▼
  generateSectionText(sectionKey, context, userText)
       │
       ▼
  Claude Sonnet → { text, citations[] }
       │
       ▼
  Ghost text displayed in editor
       │
       ▼ (Tab to accept)
  saveSection() → report_sections (JSON + HTML)
```

### Export

```
GET /export?report_id=N
       │
       ▼
  generateDocx(reportId)
       │
       ├── Fetch report + property + sections + comps
       ├── Build title page
       ├── Render 12 sections (HTML → paragraphs)
       ├── Insert comp table after sales_comparison
       └── Return DOCX buffer
```

## Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| SQLite + sqlite-vec | Co-located data, no external DB, simple ops |
| PyMuPDF over pdf-parse | Reliable per-page extraction, handles scanned PDFs better |
| Two-pass Claude (classify → extract) | Controls token usage, better accuracy than single pass |
| Gemini 768-dim (MRL from 3072) | 4x storage savings, minimal quality loss |
| Async ingestion with polling | Avoids HTTP timeouts on large PDFs |
| APN-first property dedup | Assessor's Parcel Number is authoritative when available |
| TipTap for editor | Native JSON+HTML serialization, extensible, ProseMirror foundation |
| Semantic search with SQL fallback | Graceful degradation when embeddings unavailable |
| Non-blocking embedding failures | Documents usable without vectors, backfill later |

## Section Taxonomy

12 core report sections in standard order:

1. transmittal
2. certification
3. scope_of_work
4. assumptions
5. neighborhood
6. site_description
7. improvement_description
8. highest_best_use
9. sales_comparison
10. income_approach
11. reconciliation
12. appraiser_qualifications

6 addendum/reference sections (excluded from exemplar search):
- definitions_glossary, zoning_code, economic_snapshot, legal_description, engagement_letter, addendum_other
