# TODOS — CRE Appraisal Copilot

## Phase 2

### Automated MLS/County Monitoring Pipeline
- **What:** Cron job that checks Utah/Salt Lake county recorder sites for new deed warranties and MLS for new CRE listings, creating property records automatically
- **Why:** Eliminates manual 2x/month check, catches comps the client might miss. Transforms comp sourcing from reactive to proactive.
- **Effort:** L
- **Priority:** P2
- **Depends on:** MVP complete + working property schema

### Evidence Ledger
- **What:** Sentence-level provenance tracking mapping every claim in a report to its source document, page, and span
- **Why:** The "moat" — transforms the tool from a writing accelerator into a compliance asset. When a reviewer questions a fact, the appraiser clicks it and sees exactly where it came from.
- **Effort:** L
- **Priority:** P2
- **Depends on:** MVP copilot working with source citations

### Validation Rules Engine
- **What:** Pre-export checks: narrative/table value mismatches, stale sources cited as current, subject/comp role confusion, confidential MLS field leaks
- **Why:** These are the exact errors that get appraisers in trouble with The Appraisal Foundation. As the appraiser speeds up, automated checks become critical safety net.
- **Effort:** M
- **Priority:** P2
- **Depends on:** MVP + stable section output format

### RESO Web API Integration
- **What:** Formal integration with client's MLS via RESO Web API for programmatic CRE listing access
- **Why:** Automates second biggest time bottleneck (comp sourcing). Replaces manual MLS search.
- **Blockers:** Need to verify UtahRealEstate.com/WFRMLS supports RESO Web API access for third-party apps. May require board approval + IDX licensing.
- **Effort:** L
- **Priority:** P2
- **Depends on:** MLS board API access confirmation + working property schema

## Skipped

### Browser Agents for Missing Info
- **Decision:** Skip — browser automation is brittle, high-maintenance, and low ROI. Appraiser can alt-tab to look up details in 30 seconds. Revisit only if client specifically requests after using MVP.
