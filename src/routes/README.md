# Routes

SvelteKit file-based routing. Each directory maps to a URL path.

## Pages

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Dashboard | Stats, recent reports, recent documents |
| `/ingest` | Ingest | PDF upload with drag-drop, processing status table |
| `/properties` | Properties | Filterable property browser (city, type, SF, semantic search) |
| `/reports/new` | New Report | Wizard — select subject property, set approach/date |
| `/reports/[id]` | Report Editor | Section nav, TipTap editor, comp panel, adjustment grid |

## API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/ingest` | Upload PDF, returns `{id, status}`, triggers async processing |
| GET | `/ingest` | List all documents with status |
| GET | `/properties` | Search properties (query, city, type, SF range, semantic) |
| POST | `/reports` | Create report (subject_property_id, approach) |
| GET | `/reports` | List all reports |
| PUT | `/reports/[id]` | Save section, add/update comp, update status |
| POST | `/reports/[id]` | Generate ghost text for a section |
| GET | `/export` | Download report as DOCX |
| GET | `/debug` | Pipeline inspection (summary, pages, embed, similarity, reingest) |
