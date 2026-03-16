# TODOS — CRE Appraisal Copilot

## Phase 1 — MVP (Complete)

- [x] Project setup with sample appraisal reports
- [x] SQLite database schema (documents, chunks, properties, sales, leases, reports, sections, comps)
- [x] PDF ingestion — PyMuPDF per-page text extraction
- [x] Claude page classification (4 chunk types, 22 section labels, batched)
- [x] Claude entity extraction (sale comps, lease comps, report metadata)
- [x] Property deduplication (APN-first, normalized address fallback)
- [x] Gemini vector embeddings (768-dim MRL, sqlite-vec storage)
- [x] Semantic search (vector + SQL fallback)
- [x] Copilot context assembly (exemplars, clauses, comps, existing sections)
- [x] Ghost text writing assistant (Claude Sonnet, citations)
- [x] TipTap rich text editor with autosave + ghost text acceptance
- [x] Report authoring flow (new report → section editing → export)
- [x] DOCX export (title page, 12 sections, comp table)
- [x] Dashboard, property browser, ingest UI
- [x] Debug endpoints (summary, pages, test-embed, embed-all, similarity, reingest)
- [x] Embedding storage fixes (Buffer format, rowid coercion)
- [x] Project documentation (README, architecture, map.yaml, component READMEs)

## Phase 2

### Automated MLS/County Monitoring Pipeline
- **What:** Cron job that checks Utah/Salt Lake county recorder sites for new deed warranties and MLS for new CRE listings, creating property records automatically
- **Why:** Eliminates manual 2x/month check, catches comps the client might miss. Transforms comp sourcing from reactive to proactive.
- **Effort:** L
- **Priority:** P2
- **Depends on:** ~~MVP complete + working property schema~~ Ready to start

### Evidence Ledger
- **What:** Sentence-level provenance tracking mapping every claim in a report to its source document, page, and span
- **Why:** The "moat" — transforms the tool from a writing accelerator into a compliance asset. When a reviewer questions a fact, the appraiser clicks it and sees exactly where it came from.
- **Effort:** L
- **Priority:** P2
- **Depends on:** ~~MVP copilot working with source citations~~ Ready to start (citations implemented in writer.ts)

### Validation Rules Engine
- **What:** Pre-export checks: narrative/table value mismatches, stale sources cited as current, subject/comp role confusion, confidential MLS field leaks
- **Why:** These are the exact errors that get appraisers in trouble with The Appraisal Foundation. As the appraiser speeds up, automated checks become critical safety net.
- **Effort:** M
- **Priority:** P2
- **Depends on:** ~~MVP + stable section output format~~ Ready to start (sections export as JSON + HTML)

### RESO Web API Integration
- **What:** Formal integration with client's MLS via RESO Web API for programmatic CRE listing access
- **Why:** Automates second biggest time bottleneck (comp sourcing). Replaces manual MLS search.
- **Blockers:** Need to verify UtahRealEstate.com/WFRMLS supports RESO Web API access for third-party apps. May require board approval + IDX licensing.
- **Effort:** L
- **Priority:** P2
- **Depends on:** MLS board API access confirmation + ~~working property schema~~ property schema ready

### Cross-Report Addendum Deduplication
- **What:** Store definitions_glossary once (shared), zoning_code per city,
  economic_snapshot per county+quarter. Detect duplicates on ingest.
- **Why:** 9 reports × ~95 addendum pages = ~855 pages of duplicate vectors.
  Saves embedding cost and prevents identical chunks from diluting search.
- **Effort:** M
- **Priority:** P2
- **Depends on:** ~~Addendum section_label taxonomy~~ Ready to start (22 section labels implemented)

### Wire county_data_json into Copilot Context
- **What:** Add county_data_json to context sent to Claude when writing report sections (`src/lib/copilot/context.ts`)
- **Why:** Bradford's data needs to feed into AI-drafted sections — value history, tax trends, ownership chain, assessed values
- **Effort:** S
- **Priority:** P1
- **Depends on:** Parcel-first county scraper (county_data_json stored on property)

### Scraper Selector Maintenance
- **What:** Quarterly manual smoke test of county scraper selectors against live Utah County assessor site. Verify search flow and field extraction still work.
- **Why:** County websites update their HTML periodically. Selectors break silently.
- **Effort:** S
- **Priority:** P3
- **Depends on:** County scraper (implemented)

### Expand County Scraper
- **What:** Add support for additional Utah counties (Davis, Weber, Cache, etc.) and fill in Salt Lake County scraper as client takes engagements outside Utah County.
- **Effort:** M per county
- **Priority:** P3
- **Depends on:** County scraper framework (implemented)

### E2E Test Suite (Playwright)
- **What:** Full wizard flow: submission, back button state, scraper pre-fill, approach-filtered sections in editor. Plus report editing round-trip.
- **Effort:** M
- **Priority:** P2
- **Depends on:** Vitest setup (done), Playwright install

### Comp Distance Badge
- **What:** Show "X.X mi from subject" on comp nav items and comp page headers, auto-calculated from lat/lng.
- **Why:** Gives Brad at-a-glance geographic relevance context for each comparable.
- **Effort:** S
- **Priority:** P3
- **Depends on:** Sales Comparison Approach redesign + geocoding (both exist)

### Comp Summary Tooltip
- **What:** Hover a comp in SectionNav to see popup with photo, $/SF, cap rate, SF, year built, distance.
- **Why:** Context without clicking — Brad can scan comps quickly from the nav.
- **Effort:** S
- **Priority:** P3
- **Depends on:** Sales Comparison Approach redesign + comp photos

### Lien-Based Price Suggestion
- **What:** Scrape Utah County Recorder detail pages using deed entry_numbers to find trust deed amounts. Apply 30% down heuristic to suggest sale price range on the comp sale form.
- **Why:** Biggest manual research task for Brad. Even a rough estimate saves significant time.
- **Effort:** M
- **Priority:** P2
- **Depends on:** Sales Comparison Approach redesign. Risk: recorder data may not be accessible.
- **Spike needed:** Investigate Utah County Recorder page structure for trust deed amount extraction.

## Skipped

### Browser Agents for Missing Info
- **Decision:** Skip — browser automation is brittle, high-maintenance, and low ROI. Appraiser can alt-tab to look up details in 30 seconds. Revisit only if client specifically requests after using MVP.
