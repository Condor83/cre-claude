---
name: run-ingestion
description: Use when ingesting PDF documents into the CRE copilot, running the ingestion pipeline, debugging extraction or embedding failures, or re-ingesting existing documents
---

# Document Ingestion

## Prerequisites

**Env vars** in `.env` at project root:
```
ANTHROPIC_API_KEY=<key>
GEMINI_API_KEY=<key>
```

**Python 3** with PyMuPDF: `pip install PyMuPDF` (provides `fitz` module). Must have `python3` in PATH.

**Dev server** must be running: `npm run dev` (default http://localhost:5173)

## Ingest a New PDF

Upload via the web UI at `/ingest`, or POST directly:

```bash
curl -X POST http://localhost:5173/ingest \
  -F "file=@/path/to/appraisal.pdf"
```

Returns `{ id: <number>, status: "processing" }`. Processing runs async in the background.

**Poll status:**
```bash
curl http://localhost:5173/ingest
```

Document transitions: `processing` -> `ready` (success) or `error`.

## Pipeline Steps (what happens behind the scenes)

1. **PDF extraction** — `scripts/extract-pdf.py` via PyMuPDF, per-page text output
2. **Page classification** — Claude Sonnet classifies pages by type (clause/exemplar/evidence/table) and section label (22 CRE-specific labels), batches of 10
3. **Chunk storage** — Classified chunks inserted into `chunks` table
4. **Entity extraction** — Claude extracts sale comps, lease comps, report metadata from evidence+table chunks
5. **Entity persistence** — Properties, sales, leases written to DB with deduplication by APN/address
6. **Vector embedding** — Gemini `gemini-embedding-2-preview`, L2-normalized to 768 dims, stored in `vec_chunks` (sqlite-vec)

## Key Files

| File | Role |
|------|------|
| `src/routes/ingest/+server.ts` | POST/GET endpoints, orchestrates pipeline |
| `src/lib/ingest/chunker.ts` | PDF extraction + Claude classification |
| `src/lib/ingest/extractor.ts` | Entity extraction + persistence |
| `src/lib/embed/gemini.ts` | Embedding generation + storage |
| `src/lib/db/index.ts` | All DB helpers, schema init |
| `src/lib/db/schema.sql` | Table definitions |
| `scripts/extract-pdf.py` | PyMuPDF PDF-to-text |
| `src/routes/debug/+server.ts` | Debug/test endpoints |

## Debug Endpoints

All via `GET /debug?action=<action>`:

| Action | Purpose | Example |
|--------|---------|---------|
| `summary` | Pipeline stats (chunks, vecs, properties, sales, leases) | `/debug?action=summary` |
| `pages` | Test PDF page extraction | `/debug?action=pages&path=/abs/path/to.pdf` |
| `test-embed` | Embed sample text, test vec insert | `/debug?action=test-embed` |
| `embed-all` | Embed all chunks missing vectors | `/debug?action=embed-all` |
| `similarity` | Semantic search test | `/debug?action=similarity&q=retail+building&limit=5` |
| `reingest` | Delete + fully re-process a document | `/debug?action=reingest&doc=<id>` |

## Re-ingesting a Document

To re-run the full pipeline on an existing document (e.g., after changing classification prompts):

```bash
curl "http://localhost:5173/debug?action=reingest&doc=1"
```

This deletes all chunks/entities/embeddings for that document and re-processes from the PDF in `docs/appraisal-reports/<filename>`.

## Common Issues

| Symptom | Fix |
|---------|-----|
| `python3: command not found` | Install Python 3, ensure it's in PATH |
| `ModuleNotFoundError: fitz` | `pip install PyMuPDF` (not `pip install fitz`) |
| Document stuck in `processing` | Check server console for errors; likely API key issue |
| `status: error` | Query `SELECT error_message FROM documents WHERE id = ?` |
| No embeddings after ingest | Embedding failures are non-blocking; use `/debug?action=embed-all` to retry |
| sqlite-vec errors | Ensure `sqlite-vec` npm package installed; check `vec_chunks` table exists |

## Database

- **Location:** `data/cre-copilot.db` (or `$CRE_DATA_DIR/cre-copilot.db`)
- **Auto-initialized** on first access via `getDb()`
- **Tables:** documents, chunks, properties, document_properties, sales, leases, reports, report_sections, report_comps, vec_chunks (virtual)

## Constraints

- PDFs only (max 50MB)
- 2 Claude API calls per document (classification + extraction)
- 1 Gemini API call per chunk (embedding)
