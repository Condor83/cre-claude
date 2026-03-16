<script lang="ts">
	import Editor from '$lib/components/Editor.svelte';
	import SectionNav from '$lib/components/SectionNav.svelte';
	import AutoSection from '$lib/components/AutoSection.svelte';
	import GuidedSubsection from '$lib/components/GuidedSubsection.svelte';
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
		GUIDED_SUBSECTIONS,
		type SectionDef,
		type SubsectionDef
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

	// Images for active section (include subsection images)
	const activeSectionImages = $derived(
		(data.images as SectionImage[])?.filter((img: SectionImage) => {
			if (activeSubsection) {
				return img.section_key === `${activeSection}.${activeSubsection}`;
			}
			return img.section_key === activeSection;
		}) ?? []
	);

	let activeSection = $state('title_page');
	let activeSubsection = $state<string | null>(null);
	let showCompSearch = $state(false);
	let showPropertyFacts = $state(false);
	let generating = $state(false);
	let fetchingCompImages = $state(false);

	// ── Guided subsection state ──
	const isGuidedSection = $derived(!!GUIDED_SUBSECTIONS[activeSection]?.length);
	const activeSubsections = $derived(GUIDED_SUBSECTIONS[activeSection] ?? []);
	const activeSubsectionDef = $derived(
		activeSubsection ? activeSubsections.find(s => s.key === activeSubsection) ?? null : null
	);

	// Per-subsection HTML cache (stored as form_data JSON on parent section)
	function getSubsectionHtmls(sectionKey: string): Record<string, string> {
		const sec = data.sections.find((s: { section_key: string; form_data: string | null }) => s.section_key === sectionKey);
		if (sec?.form_data) {
			try {
				const fd = JSON.parse(sec.form_data);
				return fd._subsection_htmls ?? {};
			} catch { /* ignore */ }
		}
		return {};
	}

	function getSubsectionFormData(sectionKey: string, subsectionKey: string): Record<string, unknown> {
		const sec = data.sections.find((s: { section_key: string; form_data: string | null }) => s.section_key === sectionKey);
		if (sec?.form_data) {
			try {
				const fd = JSON.parse(sec.form_data);
				return fd._subsection_form_data?.[subsectionKey] ?? {};
			} catch { /* ignore */ }
		}
		return {};
	}

	// In-memory subsection state (survives subsection switches within a section)
	let subsectionHtmlCache = $state<Record<string, Record<string, string>>>({});
	let subsectionFormDataCache = $state<Record<string, Record<string, Record<string, unknown>>>>({});

	// Initialize cache from server data when switching sections
	$effect(() => {
		if (activeSection && isGuidedSection && !subsectionHtmlCache[activeSection]) {
			subsectionHtmlCache[activeSection] = getSubsectionHtmls(activeSection);
			// Load form data for each subsection
			const formDataMap: Record<string, Record<string, unknown>> = {};
			for (const sub of activeSubsections) {
				formDataMap[sub.key] = getSubsectionFormData(activeSection, sub.key);
			}
			subsectionFormDataCache[activeSection] = formDataMap;
		}
	});

	function getSubHtml(subsectionKey: string): string {
		return subsectionHtmlCache[activeSection]?.[subsectionKey] ?? '';
	}

	function getSubFormData(subsectionKey: string): Record<string, unknown> {
		return subsectionFormDataCache[activeSection]?.[subsectionKey] ?? {};
	}

	async function saveSubsection(subsectionKey: string, html: string, formData?: Record<string, unknown>) {
		// Update local cache
		if (!subsectionHtmlCache[activeSection]) subsectionHtmlCache[activeSection] = {};
		subsectionHtmlCache[activeSection][subsectionKey] = html;

		if (formData) {
			if (!subsectionFormDataCache[activeSection]) subsectionFormDataCache[activeSection] = {};
			subsectionFormDataCache[activeSection][subsectionKey] = formData;
		}

		// Rebuild parent content_html by concatenating all subsection HTMLs in order
		const subsections = GUIDED_SUBSECTIONS[activeSection] ?? [];
		const allHtmls = subsectionHtmlCache[activeSection] ?? {};
		const parentHtml = subsections
			.map(s => allHtmls[s.key] ?? '')
			.filter(h => h.trim().length > 0)
			.join('\n\n');

		// Build form_data to persist subsection state
		const persistedFormData = JSON.stringify({
			_subsection_htmls: subsectionHtmlCache[activeSection] ?? {},
			_subsection_form_data: subsectionFormDataCache[activeSection] ?? {}
		});

		// Update content cache for parent section
		contentCache[activeSection] = { json: '', html: parentHtml };
		if (sectionStatuses[activeSection] !== 'reviewed') {
			sectionStatuses[activeSection] = 'in_progress';
		}

		// Persist to server
		await fetch(`/reports/${data.report.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'save_section',
				section_key: activeSection,
				content_json: '',
				content_html: parentHtml,
				status: 'in_progress',
				form_data: persistedFormData
			})
		});
	}

	async function regenerateSubsection(subsectionKey: string) {
		const res = await fetch(`/reports/${data.report.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'regenerate_subsection',
				section_key: activeSection,
				subsection_key: subsectionKey
			})
		});
		if (res.ok) {
			const result = await res.json();
			// Update subsection html cache
			if (!subsectionHtmlCache[activeSection]) subsectionHtmlCache[activeSection] = {};
			subsectionHtmlCache[activeSection][subsectionKey] = result.html;

			// Rebuild parent content_html
			await saveSubsection(subsectionKey, result.html);
		}
	}

	function handleSelectSubsection(sectionKey: string, subsectionKey: string) {
		activeSection = sectionKey;
		activeSubsection = subsectionKey;
	}

	function handleSelectSection(key: string) {
		activeSection = key;
		// If it's a guided section, auto-select first subsection
		const subs = GUIDED_SUBSECTIONS[key];
		if (subs?.length) {
			activeSubsection = subs[0].key;
		} else {
			activeSubsection = null;
		}
	}

	// ── Comp image polling (subject images now handled via loading screen) ──
	interface AutoSourceStatus {
		state: 'idle' | 'running' | 'done' | 'error';
		total: number;
		completed: number;
		errors: string[];
	}
	let autoSourceStatus = $state<AutoSourceStatus | null>(null);
	let compPollTimer: ReturnType<typeof setInterval> | null = null;

	function startCompPolling() {
		stopCompPolling();
		compPollTimer = setInterval(async () => {
			const res = await fetch(`/api/auto-source?report_id=${data.report.id}&type=comps`);
			if (res.ok) {
				const status = await res.json();
				autoSourceStatus = status;
				if (status.state === 'done' || status.state === 'error' || status.state === 'idle') {
					stopCompPolling();
					if (status.state === 'done') {
						const imgRes = await fetch(`/api/images?report_id=${data.report.id}&section_key=_all`);
						if (imgRes.ok) window.location.reload();
					}
					fetchingCompImages = false;
				}
			}
		}, 3000);
	}

	function stopCompPolling() {
		if (compPollTimer) {
			clearInterval(compPollTimer);
			compPollTimer = null;
		}
	}

	// Loading guard: check if tasks are still running
	let tasksStillRunning = $state(false);
	$effect(() => {
		fetch(`/api/report-tasks/${data.report.id}`)
			.then(r => r.json())
			.then(result => {
				if (result.tasks && !result.settled) {
					tasksStillRunning = true;
				}
			})
			.catch(() => {});

		return () => stopCompPolling();
	});

	async function handleFetchCompImages() {
		fetchingCompImages = true;
		try {
			const res = await fetch('/api/auto-source', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ report_id: data.report.id })
			});
			if (res.ok) {
				startCompPolling();
			} else {
				const err = await res.json();
				alert(err.error || 'Failed to start comp image sourcing');
				fetchingCompImages = false;
			}
		} catch {
			fetchingCompImages = false;
		}
	}

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

	async function handleUnapprove(sectionKey: string) {
		sectionStatuses[sectionKey] = 'in_progress';
		await fetch(`/reports/${data.report.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'update_section_status', section_key: sectionKey, status: 'in_progress' })
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
			{activeSubsection}
			{sectionStatuses}
			onselect={handleSelectSection}
			onselectsubsection={handleSelectSubsection}
		/>
		{#if tasksStillRunning}
			<a href="/reports/{data.report.id}/loading" class="loading-banner">
				Report still loading — view progress
			</a>
		{/if}
		{#if autoSourceStatus?.state === 'running'}
			<div class="auto-source-indicator">
				<span class="auto-source-dot"></span>
				Fetching comp images... {autoSourceStatus.completed}/{autoSourceStatus.total}
			</div>
		{/if}
		<div class="sidebar-actions">
			<button class="btn btn-secondary" onclick={() => { showPropertyFacts = !showPropertyFacts; if (showPropertyFacts) showCompSearch = false; }}>
				{showPropertyFacts ? 'Hide Facts' : 'Property Facts'}
			</button>
			<button class="btn btn-secondary" onclick={() => { showCompSearch = !showCompSearch; if (showCompSearch) showPropertyFacts = false; }}>
				{showCompSearch ? 'Hide Comps' : 'Manage Comps'}
			</button>
			<button class="btn btn-secondary" onclick={handleFetchCompImages} disabled={fetchingCompImages}>
				{fetchingCompImages ? 'Fetching...' : 'Fetch Comp Images'}
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
			{#if activeSubsectionDef}
				<span class="subsection-breadcrumb">/ {activeSubsectionDef.label}</span>
			{/if}
			{#if generating}
				<span class="generating-badge">AI generating...</span>
			{/if}
			<div class="header-spacer"></div>
			{#if sectionStatuses[activeSection] === 'reviewed'}
				<button class="approved-badge" onclick={() => handleUnapprove(activeSection)}>
					Approved
				</button>
			{:else}
				<button class="approve-btn" onclick={() => handleMarkReviewed(activeSection)}>
					Approve
				</button>
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

		{#if isGuidedSection && activeSubsectionDef}
			<!-- ── Guided subsection mode ── -->
			{#key `${activeSection}.${activeSubsection}`}
				<GuidedSubsection
					subsection={activeSubsectionDef}
					parentSectionKey={activeSection}
					reportId={data.report.id}
					html={getSubHtml(activeSubsection!)}
					status={sectionStatuses[activeSection] ?? 'empty'}
					images={activeSectionImages}
					formData={getSubFormData(activeSubsection!)}
					marketArea={data.propertyContext?.county ?? 'utah_county'}
					onSave={(html, fd) => saveSubsection(activeSubsection!, html, fd)}
					onRegenerate={() => regenerateSubsection(activeSubsection!)}
					onRequestGhostText={(text) => generateGhostText(activeSection, text)}
				/>
			{/key}
		{:else if isGuidedSection && !activeSubsectionDef}
			<!-- Guided section with no subsection selected — show overview -->
			<div class="guided-overview">
				<p class="guided-overview-text">
					This section has {activeSubsections.length} subsections. Select one from the sidebar to begin editing.
				</p>
				<div class="guided-overview-grid">
					{#each activeSubsections as sub}
						<button class="overview-item" onclick={() => { activeSubsection = sub.key; }}>
							<span class="overview-label">{sub.label}</span>
							<span class="overview-tier" class:auto={sub.tier === 'auto'} class:freeform={sub.tier === 'freeform'} class:form={sub.tier === 'form'} class:image={sub.tier === 'image'}>
								{sub.tier === 'freeform' ? 'EDIT' : sub.tier === 'image' ? 'IMG' : sub.tier.toUpperCase()}
							</span>
						</button>
					{/each}
				</div>
			</div>
		{:else if activeSection === 'summary_conclusions'}
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
			<!-- PROSE or overridden AUTO -->
			<Editor
				sectionKey={activeSection}
				initialContent={getInitialHtml(activeSection)}
				onSave={(json, html) => saveSection(activeSection, json, html)}
				onRequestGhostText={(text) => generateGhostText(activeSection, text)}
				reportId={data.report.id}
			/>
		{/if}

		{#if !isGuidedSection && activeTier !== 'images' && activeTier !== 'upload' && activeSectionImages.length > 0}
			<div class="section-images-below">
				<ImageUploader
					reportId={data.report.id}
					sectionKey={activeSection}
					images={activeSectionImages}
					layout="grid"
					onchange={handleImageChange}
				/>
			</div>
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

	.header-spacer {
		flex: 1;
	}

	.approve-btn {
		padding: 0.3rem 0.8rem;
		background: #e8f5e9;
		color: #2e7d32;
		border: 1px solid #a5d6a7;
		border-radius: 4px;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		flex-shrink: 0;
	}

	.approve-btn:hover {
		background: #c8e6c9;
	}

	.approved-badge {
		padding: 0.3rem 0.8rem;
		background: #28a745;
		color: #fff;
		border: 1px solid #28a745;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
		flex-shrink: 0;
		cursor: pointer;
	}

	.approved-badge:hover {
		background: #dc3545;
		border-color: #dc3545;
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

	.section-images-below {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid #eee;
	}

	.loading-banner {
		display: block;
		padding: 0.5rem 0.75rem;
		background: #fff3cd;
		border: 1px solid #ffe082;
		border-radius: 6px;
		font-size: 0.8rem;
		color: #8d6e00;
		text-decoration: none;
		text-align: center;
		margin-bottom: 0.5rem;
	}

	.loading-banner:hover {
		background: #fff8e1;
	}

	.auto-source-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: #e3f2fd;
		border: 1px solid #90caf9;
		border-radius: 6px;
		font-size: 0.8rem;
		color: #1565c0;
		margin-bottom: 0.5rem;
	}

	.auto-source-dot {
		width: 8px;
		height: 8px;
		background: #1565c0;
		border-radius: 50%;
		animation: pulse 1.5s infinite;
	}

	/* ── Guided section styles ── */
	.subsection-breadcrumb {
		font-size: 1rem;
		color: #888;
		font-weight: 400;
	}

	.guided-overview {
		padding: 1rem 0;
	}

	.guided-overview-text {
		margin: 0 0 1rem;
		color: #666;
		font-size: 0.9rem;
	}

	.guided-overview-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.overview-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.6rem 0.8rem;
		background: #f8f9fa;
		border: 1px solid #e5e5e5;
		border-radius: 6px;
		cursor: pointer;
		text-align: left;
		font-size: 0.82rem;
		color: #333;
		transition: all 0.15s ease;
	}

	.overview-item:hover {
		background: #e8e8f0;
		border-color: #ccc;
	}

	.overview-label {
		flex: 1;
	}

	.overview-tier {
		font-size: 0.55rem;
		font-weight: 700;
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.overview-tier.auto { background: #d4edda; color: #155724; }
	.overview-tier.freeform { background: #cce5ff; color: #004085; }
	.overview-tier.form { background: #fff3cd; color: #856404; }
	.overview-tier.image { background: #e8d5f5; color: #6f42c1; }
</style>
