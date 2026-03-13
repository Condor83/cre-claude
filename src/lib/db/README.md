# Database Layer

SQLite database with sqlite-vec extension for vector search. Auto-initializes on first access.

## Files

- **schema.sql** — Table definitions (9 tables + 1 virtual table)
- **index.ts** — Singleton connection, all query helpers

## Database Location

`data/cre-copilot.db` (or `$CRE_DATA_DIR/cre-copilot.db`). Created automatically with WAL journal mode and foreign keys enabled.

## Tables

### Ingestion Pipeline
- **documents** — Uploaded PDFs with processing status (`pending` → `processing` → `ready` | `error`)
- **chunks** — Classified page sections (type: clause/exemplar/evidence/table, 22 section labels)
- **vec_chunks** — sqlite-vec virtual table, 768-dim F32 embeddings keyed by chunk rowid

### Property Data
- **properties** — Canonical property records, deduplicated by APN then normalized address
- **document_properties** — Junction table linking documents to properties with role (subject/comp_sale/comp_lease)
- **sales** — Sale comparable transactions (price, cap rate, financing, confidence)
- **leases** — Lease comparable transactions (rent/SF, lease type, term, escalations)

### Report Authoring
- **reports** — Reports being authored (subject property, approach, status)
- **report_sections** — TipTap editor state per section (JSON + HTML)
- **report_comps** — Selected comparables with adjustment data

## Key Helpers

| Function | Purpose |
|----------|---------|
| `getDb()` | Singleton connection (creates DB if needed) |
| `insertDocument()` | Create document record |
| `insertChunk()` | Store classified chunk |
| `insertChunkEmbedding()` | Store vector in vec_chunks |
| `searchSimilarChunks()` | k-NN vector search |
| `findOrCreateProperty()` | APN-first dedup, fallback to normalized address |
| `linkDocumentProperty()` | Associate document → property with role |
| `searchProperties()` | Filter by city, type, SF, address |
| `insertSale()` / `insertLease()` | Persist comparable transactions |
| `createReport()` / `getReport()` | Report CRUD |
| `saveSection()` / `getSections()` | Autosave section editor state |
| `addReportComp()` / `getReportComps()` | Manage report comparables |
