# CRE Copilot

AI-powered commercial real estate appraisal report authoring tool. Ingests legacy appraisal PDFs, extracts comparable properties and evidence, then provides intelligent writing assistance for new reports via semantic search and ghost text suggestions.

## Quick Start

```bash
# Install dependencies
npm install
pip install PyMuPDF   # Required for PDF extraction

# Configure API keys
cp .env.example .env  # Then add your keys
# ANTHROPIC_API_KEY — Claude API (classification, extraction, writing)
# GEMINI_API_KEY    — Gemini Embedding API (vector search)

# Start dev server
npm run dev           # http://localhost:5173
```

## Core Workflow

1. **Ingest** — Upload PDFs at `/ingest`. Each PDF is extracted (PyMuPDF), classified by section (Claude), entities extracted (Claude), and embedded (Gemini).
2. **Browse** — View extracted properties and comparables at `/properties`.
3. **Author** — Create a new report at `/reports/new`, select a subject property, then write sections with AI-assisted ghost text at `/reports/[id]`.
4. **Export** — Download the finished report as DOCX.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit 2 + Svelte 5 |
| Database | SQLite (better-sqlite3) + sqlite-vec |
| AI - Classification & Writing | Claude Sonnet 4 (Anthropic) |
| AI - Embeddings | Gemini Embedding 2 (Google) |
| PDF Extraction | PyMuPDF (Python) |
| Rich Text Editor | TipTap (ProseMirror) |
| Export | docx (OOXML generation) |
| Runtime | Node.js via @sveltejs/adapter-node |

## Project Structure

```
src/
├── lib/
│   ├── db/          # SQLite schema, helpers, vector search
│   ├── ingest/      # PDF extraction, classification, entity extraction
│   ├── embed/       # Gemini embedding generation & storage
│   ├── copilot/     # Context assembly & AI writing assistant
│   ├── export/      # DOCX report generation
│   └── components/  # Svelte UI components (Editor, SectionNav, etc.)
├── routes/
│   ├── ingest/      # PDF upload UI & API
│   ├── properties/  # Property browser
│   ├── reports/     # Report editor & API
│   ├── export/      # DOCX download endpoint
│   └── debug/       # Pipeline inspection endpoints
scripts/
└── extract-pdf.py   # PyMuPDF page extractor
data/
└── cre-copilot.db   # SQLite database (auto-created)
docs/
└── appraisal-reports/  # Source PDFs for ingestion
```

See [map.yaml](map.yaml) for the full file map and [docs/architecture.md](docs/architecture.md) for schema and data models.

## Prerequisites

- **Node.js** 20+
- **Python 3** with PyMuPDF (`pip install PyMuPDF`)
- **API Keys:** Anthropic (Claude) and Google (Gemini)

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Serve production build |
| `npm run check` | TypeScript type checking |

## Debug Endpoints

With the dev server running, `GET /debug?action=<action>`:

| Action | Purpose |
|--------|---------|
| `summary` | Pipeline stats |
| `pages&path=/abs/path.pdf` | Test PDF extraction |
| `test-embed` | Test embedding pipeline |
| `embed-all` | Backfill missing embeddings |
| `similarity&q=query` | Test semantic search |
| `reingest&doc=<id>` | Re-process a document |
