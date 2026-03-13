<script lang="ts">
	import Editor from '$lib/components/Editor.svelte';
	import SectionNav from '$lib/components/SectionNav.svelte';
	import CompSearch from '$lib/components/CompSearch.svelte';
	import AdjustmentGrid from '$lib/components/AdjustmentGrid.svelte';

	let { data } = $props();

	const SECTIONS = [
		{ key: 'transmittal', label: 'Letter of Transmittal' },
		{ key: 'certification', label: 'Certification' },
		{ key: 'assumptions', label: 'Assumptions & Limiting Conditions' },
		{ key: 'scope_of_work', label: 'Scope of Work' },
		{ key: 'neighborhood', label: 'Neighborhood Description' },
		{ key: 'site_description', label: 'Site Description' },
		{ key: 'improvement_description', label: 'Improvement Description' },
		{ key: 'highest_best_use', label: 'Highest & Best Use' },
		{ key: 'sales_comparison', label: 'Sales Comparison Approach' },
		{ key: 'income_approach', label: 'Income Capitalization Approach' },
		{ key: 'reconciliation', label: 'Reconciliation' },
		{ key: 'appraiser_qualifications', label: 'Appraiser Qualifications' }
	];

	let activeSection = $state('transmittal');
	let showCompSearch = $state(false);
	let generating = $state(false);
	let autosaveTimer = $state<ReturnType<typeof setInterval> | null>(null);

	// Get initial content for active section
	function getInitialContent(sectionKey: string): string {
		const section = data.sections.find((s: { section_key: string }) => s.section_key === sectionKey);
		return section?.content_json ?? '';
	}

	function getInitialHtml(sectionKey: string): string {
		const section = data.sections.find((s: { section_key: string }) => s.section_key === sectionKey);
		return section?.content_html ?? '';
	}

	async function saveSection(sectionKey: string, contentJson: string, contentHtml: string) {
		await fetch(`/reports/${data.report.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'save_section',
				section_key: sectionKey,
				content_json: contentJson,
				content_html: contentHtml
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

	async function exportDocx() {
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
			sections={SECTIONS}
			{activeSection}
			completedSections={data.sections.map((s: { section_key: string }) => s.section_key)}
			onselect={(key) => activeSection = key}
		/>
		<div class="sidebar-actions">
			<button class="btn btn-secondary" onclick={() => showCompSearch = !showCompSearch}>
				{showCompSearch ? 'Hide Comps' : 'Manage Comps'}
			</button>
			<button class="btn" onclick={exportDocx}>
				Export DOCX
			</button>
		</div>
	</div>

	<div class="editor-main">
		<div class="section-header">
			<h1>{SECTIONS.find(s => s.key === activeSection)?.label}</h1>
			{#if generating}
				<span class="generating-badge">AI generating...</span>
			{/if}
		</div>

		<Editor
			sectionKey={activeSection}
			initialContent={getInitialHtml(activeSection)}
			onSave={(json, html) => saveSection(activeSection, json, html)}
			onRequestGhostText={(text) => generateGhostText(activeSection, text)}
			reportId={data.report.id}
		/>

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
</div>

<style>
	.editor-layout {
		display: flex;
		gap: 0;
		margin: -2rem;
		min-height: calc(100vh);
	}

	.editor-sidebar {
		width: 240px;
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
</style>
