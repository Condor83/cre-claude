<script lang="ts">
	import Editor from '$lib/components/Editor.svelte';
	import SectionNav from '$lib/components/SectionNav.svelte';
	import AutoSection from '$lib/components/AutoSection.svelte';
	import CompSearch from '$lib/components/CompSearch.svelte';
	import PropertyFacts from '$lib/components/PropertyFacts.svelte';
	import AdjustmentGrid from '$lib/components/AdjustmentGrid.svelte';
	import SalientFactsTable from '$lib/components/SalientFactsTable.svelte';
	import ImageUploader from '$lib/components/ImageUploader.svelte';
	import type { SectionImage } from '$lib/db/index.js';
	import {
		getSectionsForApproaches,
		getSectionsByGroup,
		SECTION_MAP,
		type SectionDef
	} from '$lib/config/sections.js';

	let { data } = $props();

	function parseApproaches(approach: string): string[] {
		try { return JSON.parse(approach); }
		catch { return ['sales_comparison', 'income_cap']; }
	}

	const approaches = $derived(parseApproaches(data.report.approach));
	const sectionGroups = $derived(getSectionsByGroup(approaches));
	const flatSections = $derived(
		sectionGroups.flatMap(g => g.sections.map(s => ({
			key: s.key,
			label: s.label,
			group: s.group,
			tier: s.tier
		})))
	);

	// Images for active section
	const activeSectionImages = $derived(
		(data.images as SectionImage[])?.filter((img: SectionImage) => img.section_key === activeSection) ?? []
	);

	let activeSection = $state('title_page');
	let showCompSearch = $state(false);
	let showPropertyFacts = $state(false);
	let generating = $state(false);

	const activeSectionDef = $derived(SECTION_MAP[activeSection]);
	const activeTier = $derived(activeSectionDef?.tier ?? 'prose');

	// Track section statuses locally (updated on save/override)
	let sectionStatuses = $state<Record<string, string>>({ ...data.sectionStatuses });

	// ── Assessment & Taxes year range ──
	// Parse available years from county_data_json
	const availableYears = $derived.by(() => {
		const cdj = data.propertyContext?.county_data_json;
		if (!cdj) return [] as number[];
		try {
			const cd = JSON.parse(cdj as string);
			const years = new Set<number>();
			for (const v of cd.value_history ?? []) years.add(v.year);
			for (const t of cd.tax_history ?? []) years.add(t.year);
			return [...years].sort((a, b) => b - a);
		} catch { return [] as number[]; }
	});

	// Load saved year range from form_data if it exists
	function getInitialYearRange(): { from: number; to: number } {
		const sec = data.sections.find((s: { section_key: string; form_data: string | null }) => s.section_key === 'assessment_taxes');
		if (sec?.form_data) {
			try {
				const fd = JSON.parse(sec.form_data);
				if (fd.yearFrom && fd.yearTo) return { from: fd.yearFrom, to: fd.yearTo };
			} catch { /* ignore */ }
		}
		// Default: latest 3 years, skipping any year that matches current year (often incomplete)
		if (availableYears.length > 0) {
			const currentYear = new Date().getFullYear();
			const filtered = availableYears.filter(y => y < currentYear);
			const to = filtered[0] ?? availableYears[0];
			const from = filtered[2] ?? filtered[filtered.length - 1] ?? to;
			return { from, to };
		}
		return { from: 2023, to: 2025 };
	}

	const initRange = getInitialYearRange();
	let assessmentYearFrom = $state(initRange.from);
	let assessmentYearTo = $state(initRange.to);

	async function applyYearRange() {
		const res = await fetch(`/reports/${data.report.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'regenerate_section',
				section_key: 'assessment_taxes',
				options: { yearFrom: assessmentYearFrom, yearTo: assessmentYearTo }
			})
		});
		if (res.ok) {
			const result = await res.json();
			contentCache['assessment_taxes'] = { json: '', html: result.html };
			sectionStatuses['assessment_taxes'] = 'auto_generated';
		}
	}

	// Local content cache — survives section switches without re-querying server
	function buildInitialCache() {
		return Object.fromEntries(data.sections.map((s: { section_key: string; content_json: string; content_html: string }) =>
			[s.section_key, { json: s.content_json, html: s.content_html }]
		));
	}
	let contentCache = $state<Record<string, { json: string; html: string }>>(buildInitialCache());

	function getInitialHtml(sectionKey: string): string {
		return contentCache[sectionKey]?.html ?? '';
	}

	async function saveSection(sectionKey: string, contentJson: string, contentHtml: string) {
		contentCache[sectionKey] = { json: contentJson, html: contentHtml };

		// Mark as in_progress when user edits
		if (sectionStatuses[sectionKey] !== 'reviewed') {
			sectionStatuses[sectionKey] = 'in_progress';
		}

		await fetch(`/reports/${data.report.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'save_section',
				section_key: sectionKey,
				content_json: contentJson,
				content_html: contentHtml,
				status: 'in_progress'
			})
		});
	}

	async function generateGhostText(sectionKey: string, currentText: string): Promise<string> {
		generating = true;
		try {
			const res = await fetch(`/reports/${data.report.id}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'generate',
					section_key: sectionKey,
					user_text: currentText
				})
			});
			if (res.ok) {
				const result = await res.json();
				return result.text;
			}
			return '';
		} finally {
			generating = false;
		}
	}

	async function handleOverride(sectionKey: string) {
		// Switch AUTO section to editable prose mode
		sectionStatuses[sectionKey] = 'in_progress';
		await fetch(`/reports/${data.report.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'update_section_status',
				section_key: sectionKey,
				status: 'in_progress'
			})
		});
	}

	async function handleRegenerate(sectionKey: string) {
		const res = await fetch(`/reports/${data.report.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'regenerate_section', section_key: sectionKey })
		});
		if (res.ok) {
			const result = await res.json();
			contentCache[sectionKey] = { json: '', html: result.html };
			sectionStatuses[sectionKey] = 'auto_generated';
		}
	}

	let regeneratingAll = $state(false);
	async function handleRegenerateAll() {
		regeneratingAll = true;
		try {
			const res = await fetch(`/reports/${data.report.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'regenerate_all_auto' })
			});
			if (res.ok) {
				const result = await res.json();
				// Update local cache + statuses for all regenerated sections
				for (const [key, html] of Object.entries(result.updated as Record<string, string>)) {
					contentCache[key] = { json: '', html };
					sectionStatuses[key] = 'auto_generated';
				}
			}
		} finally {
			regeneratingAll = false;
		}
	}

	let exporting = $state(false);
	async function exportDocx() {
		exporting = true;
		try {
			const res = await fetch(`/export?report_id=${data.report.id}`);
			if (res.ok) {
				const blob = await res.blob();
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `${data.report.report_number || 'report'}.docx`;
				a.click();
				URL.revokeObjectURL(url);
			}
		} finally {
			exporting = false;
		}
	}

	// Determine if a section should render as auto (read-only) or editable
	function isAutoReadOnly(sectionKey: string): boolean {
		const def = SECTION_MAP[sectionKey];
		if (!def || def.tier !== 'auto') return false;
		const status = sectionStatuses[sectionKey];
		return status === 'auto_generated' || status === 'reviewed' || status === 'empty' || !status;
	}

	// Is this an AUTO section that's been overridden to editable?
	function isAutoOverridden(sectionKey: string): boolean {
		const def = SECTION_MAP[sectionKey];
		if (!def || def.tier !== 'auto') return false;
		return sectionStatuses[sectionKey] === 'in_progress';
	}

	async function handleMarkReviewed(sectionKey: string) {
		sectionStatuses[sectionKey] = 'reviewed';
		await fetch(`/reports/${data.report.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'update_section_status', section_key: sectionKey, status: 'reviewed' })
		});
	}

	function handleImageChange(key: string, imageCount: number) {
		sectionStatuses[key] = imageCount > 0 ? 'reviewed' : 'empty';
	}

	async function handleRevertToAuto(sectionKey: string) {
		await handleRegenerate(sectionKey);
	}

	// ── Salient Facts table helpers ──
	interface FactRow { label: string; value: string; auto?: boolean }

	function parseSalientRows(html: string): FactRow[] {
		if (!html) return [];
		const rows: FactRow[] = [];
		// Parse <tr><td><strong>Label</strong></td><td>Value</td></tr>
		const trRegex = /<tr>\s*<td><strong>(.*?)<\/strong><\/td>\s*<td>(.*?)<\/td>\s*<\/tr>/gi;
		let match;
		while ((match = trRegex.exec(html)) !== null) {
			rows.push({ label: match[1], value: match[2].replace(/<\/?em>/g, '') });
		}
		return rows;
	}

	const salientRows = $derived(parseSalientRows(getInitialHtml('summary_conclusions')));

	async function handleSalientSave(rows: FactRow[], html: string) {
		contentCache['summary_conclusions'] = { json: JSON.stringify(rows), html };
		sectionStatuses['summary_conclusions'] = 'reviewed';
		await fetch(`/reports/${data.report.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'save_section',
				section_key: 'summary_conclusions',
				content_json: JSON.stringify(rows),
				content_html: html,
				status: 'reviewed'
			})
		});
	}
</script>

<svelte:head>
	<title>CRE Copilot — {data.report.subject_address}</title>
</svelte:head>

<div class="editor-layout">
	<div class="editor-sidebar">
		<div class="report-info">
			<h2>{data.report.subject_address}</h2>
			<p>{data.report.subject_city}, UT</p>
			{#if data.report.report_number}
				<p class="report-num">File #{data.report.report_number}</p>
			{/if}
		</div>
		<SectionNav
			sections={flatSections}
			{activeSection}
			{sectionStatuses}
			onselect={(key) => activeSection = key}
		/>
		<div class="sidebar-actions">
			<button class="btn btn-secondary" onclick={() => { showPropertyFacts = !showPropertyFacts; if (showPropertyFacts) showCompSearch = false; }}>
				{showPropertyFacts ? 'Hide Facts' : 'Property Facts'}
			</button>
			<button class="btn btn-secondary" onclick={() => { showCompSearch = !showCompSearch; if (showCompSearch) showPropertyFacts = false; }}>
				{showCompSearch ? 'Hide Comps' : 'Manage Comps'}
			</button>
			<button class="btn btn-secondary" onclick={handleRegenerateAll} disabled={regeneratingAll}>
				{regeneratingAll ? 'Regenerating...' : 'Regenerate Auto'}
			</button>
			<button class="btn" onclick={exportDocx} disabled={exporting}>
				{exporting ? 'Generating...' : 'Export DOCX'}
			</button>
		</div>
	</div>

	<div class="editor-main">
		<div class="section-header">
			<h1>{SECTION_MAP[activeSection]?.label ?? activeSection}</h1>
			{#if generating}
				<span class="generating-badge">AI generating...</span>
			{/if}
		</div>

		{#if activeSection === 'assessment_taxes' && availableYears.length > 0}
			<div class="year-range-picker">
				<span class="picker-label">Year range:</span>
				<select bind:value={assessmentYearFrom}>
					{#each availableYears as y}
						<option value={y}>{y}</option>
					{/each}
				</select>
				<span class="picker-dash">&ndash;</span>
				<select bind:value={assessmentYearTo}>
					{#each availableYears as y}
						<option value={y}>{y}</option>
					{/each}
				</select>
				<button class="picker-btn" onclick={applyYearRange}>Apply</button>
			</div>
		{/if}

		{#if activeSection === 'summary_conclusions'}
			<SalientFactsTable
				reportId={data.report.id}
				sectionKey="summary_conclusions"
				initialRows={salientRows}
				status={sectionStatuses['summary_conclusions'] ?? 'auto_generated'}
				onSave={handleSalientSave}
			/>
		{:else if isAutoReadOnly(activeSection)}
			<AutoSection
				html={getInitialHtml(activeSection)}
				sectionKey={activeSection}
				reportId={data.report.id}
				status={sectionStatuses[activeSection]}
				onOverride={() => handleOverride(activeSection)}
				onRegenerate={() => handleRegenerate(activeSection)}
			/>
		{:else if activeTier === 'images'}
			<ImageUploader
				reportId={data.report.id}
				sectionKey={activeSection}
				images={activeSectionImages}
				layout="grid"
				onchange={handleImageChange}
			/>
		{:else if activeTier === 'upload'}
			<ImageUploader
				reportId={data.report.id}
				sectionKey={activeSection}
				images={activeSectionImages}
				layout="single"
				onchange={handleImageChange}
			/>
		{:else}
			{#if isAutoOverridden(activeSection)}
				<div class="override-toolbar">
					<span class="override-label">Editing auto-generated section</span>
					<button class="toolbar-btn reviewed-btn" onclick={() => handleMarkReviewed(activeSection)}>
						Mark Reviewed
					</button>
					<button class="toolbar-btn revert-btn" onclick={() => handleRevertToAuto(activeSection)}>
						Revert to Auto
					</button>
				</div>
			{/if}
			<!-- PROSE, GUIDED (rendered as prose for now), or overridden AUTO -->
			<Editor
				sectionKey={activeSection}
				initialContent={getInitialHtml(activeSection)}
				onSave={(json, html) => saveSection(activeSection, json, html)}
				onRequestGhostText={(text) => generateGhostText(activeSection, text)}
				reportId={data.report.id}
			/>
		{/if}

		{#if activeSection === 'sales_comparison' || activeSection === 'income_approach'}
			<AdjustmentGrid
				comps={data.comps.filter((c: { comp_type: string }) =>
					activeSection === 'sales_comparison' ? c.comp_type === 'sale' : c.comp_type === 'lease'
				)}
				reportId={data.report.id}
			/>
		{/if}
	</div>

	{#if showCompSearch}
		<div class="comp-panel">
			<CompSearch
				reportId={data.report.id}
				existingComps={data.comps}
				onClose={() => showCompSearch = false}
			/>
		</div>
	{/if}

	{#if showPropertyFacts && data.propertyContext}
		<div class="comp-panel">
			<PropertyFacts
				reportId={data.report.id}
				propertyContext={data.propertyContext}
				onClose={() => showPropertyFacts = false}
				onSaved={() => { /* parent can invalidateAll() here if needed */ }}
			/>
		</div>
	{/if}
</div>

<style>
	.editor-layout {
		display: flex;
		gap: 0;
		margin: -2rem;
		min-height: calc(100vh);
	}

	.editor-sidebar {
		width: 260px;
		background: #fff;
		border-right: 1px solid #e8e8e8;
		padding: 1.25rem;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
	}

	.report-info {
		margin-bottom: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid #eee;
	}

	.report-info h2 {
		margin: 0;
		font-size: 1rem;
	}

	.report-info p {
		margin: 0.25rem 0 0;
		font-size: 0.85rem;
		color: #666;
	}

	.report-num {
		font-family: monospace;
		font-size: 0.8rem !important;
	}

	.sidebar-actions {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.editor-main {
		flex: 1;
		padding: 1.5rem 2rem;
		overflow-y: auto;
		max-height: 100vh;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.section-header h1 {
		margin: 0;
		font-size: 1.25rem;
	}

	.generating-badge {
		font-size: 0.75rem;
		padding: 0.2rem 0.6rem;
		background: #cce5ff;
		color: #004085;
		border-radius: 99px;
		animation: pulse 1.5s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.6; }
	}

	.comp-panel {
		width: 360px;
		background: #fff;
		border-left: 1px solid #e8e8e8;
		padding: 1.25rem;
		overflow-y: auto;
		max-height: 100vh;
	}

	.placeholder-section {
		padding: 1.5rem;
		background: #f9f9fc;
		border: 1px dashed #d0d0e0;
		border-radius: 8px;
		margin-bottom: 1rem;
		color: #666;
		font-size: 0.9rem;
	}

	.placeholder-section p {
		margin: 0 0 0.5rem;
	}

	.btn {
		padding: 0.5rem 1rem;
		background: #1a1a2e;
		color: #fff;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.85rem;
		text-align: center;
	}

	.btn-secondary {
		background: #e8e8e8;
		color: #333;
	}

	.override-toolbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: #fff8e1;
		border: 1px solid #ffe082;
		border-radius: 6px;
		margin-bottom: 0.75rem;
	}

	.override-label {
		font-size: 0.8rem;
		color: #8d6e00;
		flex: 1;
	}

	.toolbar-btn {
		padding: 0.3rem 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.8rem;
		cursor: pointer;
		background: #fff;
		color: #555;
	}

	.toolbar-btn:hover {
		background: #f5f5f5;
	}

	.reviewed-btn {
		background: #e8f5e9;
		color: #2e7d32;
		border-color: #a5d6a7;
	}

	.reviewed-btn:hover {
		background: #c8e6c9;
	}

	.revert-btn {
		color: #888;
	}

	.year-range-picker {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: #f8f9fa;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		margin-bottom: 0.75rem;
	}

	.picker-label {
		font-size: 0.8rem;
		color: #555;
		font-weight: 500;
	}

	.year-range-picker select {
		padding: 0.25rem 0.4rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 0.8rem;
		background: #fff;
	}

	.picker-dash {
		color: #999;
	}

	.picker-btn {
		padding: 0.25rem 0.6rem;
		background: #1a1a2e;
		color: #fff;
		border: none;
		border-radius: 4px;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.picker-btn:hover {
		background: #2a2a4e;
	}
</style>
