# UI Components

Reusable Svelte 5 components for the report authoring interface.

## Components

### Editor.svelte
Rich text editor built on TipTap (ProseMirror). Features autosave (2s debounce), ghost text suggestions (3s idle trigger), Tab/Cmd+Right acceptance. Exports content as JSON (TipTap state) + HTML.

**Props:** `sectionKey`, `initialContent`, `reportId`, `onSave`, `onRequestGhostText`

### SectionNav.svelte
Sidebar navigation for the 12 report sections. Shows completion status (checkmark vs circle). Highlights active section.

**Props:** `sections[]`, `activeKey`, `onselect(sectionKey)`

### CompSearch.svelte
Panel for searching and adding comparable properties to a report. Supports sale vs lease toggle. Searches by address with semantic matching. Prevents duplicate additions.

**Props:** `reportId`, `existingCompIds[]`

### AdjustmentGrid.svelte
Editable grid for comparable adjustments (13 rows: property rights, market conditions, size, etc.). Calculates net/gross adjustment percentages and adjusted price/SF. Only visible for sales_comparison and income_approach sections.

**Props:** `comps[]`, `reportId`

### PropertyCard.svelte
Display card showing property details: address, city/state, type, SF, year built, APN, class, zoning.

**Props:** `property`
