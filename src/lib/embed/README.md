# Embedding System

Vector embeddings via Google Gemini for semantic search across ingested document chunks.

## Files

- **gemini.ts** — Embedding generation, normalization, batch storage

## Model

**Gemini Embedding 2 Preview** — 768 dimensions (MRL reduction from 3072, 4x storage savings).

## Key Functions

| Function | Purpose |
|----------|---------|
| `embedText(text, taskType)` | Core embedding call, truncates to ~6000 chars |
| `embedForStorage(text)` | Document embedding (RETRIEVAL_DOCUMENT task type) |
| `embedForQuery(text)` | Query embedding (RETRIEVAL_QUERY task type) |
| `embedAndStoreChunks(chunks)` | Batch embed + insert into vec_chunks |

## Storage

- **Table:** `vec_chunks` (sqlite-vec virtual table)
- **Column:** `embedding float[768]`
- **Rowid:** Maps to `chunks.id` for joins
- **Query:** `SELECT ... FROM vec_chunks WHERE embedding MATCH ? AND k = ?`

## Details

- Text truncated to ~6000 chars (~2000 tokens) before embedding
- Output L2-normalized (required for sub-3072-dim MRL truncation)
- Zero vectors detected and skipped
- Embedding failures during ingestion are non-blocking (document still marked 'ready')
- Missing embeddings can be backfilled via `/debug?action=embed-all`
