<script lang="ts">
	import type { SubsectionDef } from '$lib/config/sections';
	import AutoSection from './AutoSection.svelte';
	import Editor from './Editor.svelte';
	import ImageUploader from './ImageUploader.svelte';
	import type { SectionImage } from '$lib/db/index.js';

	interface Props {
		subsection: SubsectionDef;
		parentSectionKey: string;
		reportId: number;
		html: string;
		status: string;
		images: SectionImage[];
		formData: Record<string, unknown>;
		onSave: (html: string, formData?: Record<string, unknown>) => void;
		onRegenerate: () => void;
		onRequestGhostText?: (text: string) => Promise<string>;
		marketArea?: string;
	}

	let {
		subsection,
		parentSectionKey,
		reportId,
		html,
		status = 'empty',
		images = [],
		formData = {},
		onSave,
		onRegenerate,
		onRequestGhostText,
		marketArea = 'utah_county'
	}: Props = $props();

	const isAuto = $derived(subsection.tier === 'auto');
	const isFreeform = $derived(subsection.tier === 'freeform');
	const isForm = $derived(subsection.tier === 'form');
	const isImage = $derived(subsection.tier === 'image');

	// Ensure ghost text handler always exists
	const ghostTextHandler = $derived(onRequestGhostText ?? (async () => ''));

	// Data source badge for auto subsections with external data
	const hasDataSource = $derived(isAuto && !!subsection.dataSource);

	// Onsite badge
	const needsOnsite = $derived(!!subsection.requiresOnsite);

	let overriding = $state(false);

	let dataAge = $state<number | null>(null);
	let dataFreshnessLoaded = $state(false);

	$effect(() => {
		if (subsection.dataSource && !dataFreshnessLoaded) {
			const dataType = subsection.dataSource === 'utah_dws'
				? (subsection.key.includes('population') ? 'dws_population' : 'dws_employment')
				: subsection.dataSource;
			fetch(`/api/market-data?market_area=${encodeURIComponent(marketArea)}&data_type=${encodeURIComponent(dataType)}`)
				.then(r => r.json())
				.then(result => {
					dataAge = result.ageInDays;
					dataFreshnessLoaded = true;
				})
				.catch(() => { dataFreshnessLoaded = true; });
		}
	});

	async function handleRefreshData() {
		const dataType = subsection.dataSource === 'utah_dws'
			? (subsection.key.includes('population') ? 'dws_population' : 'dws_employment')
			: subsection.dataSource;
		try {
			await fetch('/api/market-data', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ market_area: marketArea, data_type: dataType, force: true })
			});
			dataFreshnessLoaded = false;
			onRegenerate();
		} catch (err) {
			console.error('[GuidedSubsection] Refresh failed:', err);
		}
	}

	function handleOverride() {
		overriding = true;
	}

	function handleRevert() {
		overriding = false;
		onRegenerate();
	}

	function handleEditorSave(json: string, editorHtml: string) {
		onSave(editorHtml);
	}

	function handleImageChange(key: string, imageCount: number) {
		// Images are saved via ImageUploader directly
	}

	// ── Form tier: neighborhood life stage ──
	let lifeStageValue = $state((formData.stage as string) ?? '');

	function handleLifeStageChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		lifeStageValue = target.value;
		onSave('', { stage: target.value });
	}

	// ── Form tier: development standards ──
	let standardsFields = $state<Record<string, string>>({
		min_lot_size: (formData.min_lot_size as string) ?? '',
		max_height: (formData.max_height as string) ?? '',
		front_setback: (formData.front_setback as string) ?? '',
		side_setback: (formData.side_setback as string) ?? '',
		rear_setback: (formData.rear_setback as string) ?? '',
		max_coverage: (formData.max_coverage as string) ?? '',
		parking_ratio: (formData.parking_ratio as string) ?? ''
	});

	function handleStandardsSave() {
		// Build HTML table from form fields
		const rows = Object.entries(standardsFields)
			.filter(([, v]) => v.trim())
			.map(([k, v]) => {
				const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
				return `<tr><td><strong>${label}</strong></td><td>${v}</td></tr>`;
			});
		const tableHtml = rows.length > 0
			? `<table><thead><tr><th>Standard</th><th>Requirement</th></tr></thead><tbody>${rows.join('\n')}</tbody></table>`
			: '';
		onSave(tableHtml, standardsFields);
	}

	// ── Form tier: unit breakdown ──
	interface UnitRow { name: string; sf: string; use: string }
	let unitRows = $state<UnitRow[]>(
		(formData.units as UnitRow[]) ?? [{ name: '', sf: '', use: '' }]
	);

	function addUnitRow() {
		unitRows = [...unitRows, { name: '', sf: '', use: '' }];
	}

	function removeUnitRow(idx: number) {
		unitRows = unitRows.filter((_, i) => i !== idx);
	}

	function handleUnitsSave() {
		const validRows = unitRows.filter(r => r.name.trim() || r.sf.trim());
		if (validRows.length === 0) {
			onSave('', { units: unitRows });
			return;
		}
		const rows = validRows.map(r =>
			`<tr><td>${r.name}</td><td>${r.sf}</td><td>${r.use}</td></tr>`
		);
		const tableHtml = `<table>
<thead><tr><th>Unit / Suite</th><th>Size (SF)</th><th>Use</th></tr></thead>
<tbody>${rows.join('\n')}</tbody>
</table>`;
		onSave(tableHtml, { units: unitRows });
	}
</script>

<div class="guided-subsection">
	<div class="subsection-header">
		<h3>{subsection.label}</h3>
		<div class="subsection-badges">
			{#if needsOnsite}
				<span class="badge badge-onsite">ONSITE</span>
			{/if}
			{#if hasDataSource}
				<span class="badge badge-data">DATA</span>
			{/if}
			{#if isAuto}
				<span class="badge badge-auto">AUTO</span>
			{:else if isFreeform}
				<span class="badge badge-freeform">EDIT</span>
			{:else if isForm}
				<span class="badge badge-form">FORM</span>
			{:else if isImage}
				<span class="badge badge-image">IMG</span>
			{/if}
		</div>
	</div>

	{#if isAuto && !overriding}
		<AutoSection
			{html}
			sectionKey="{parentSectionKey}.{subsection.key}"
			{reportId}
			{status}
			dataSource={subsection.dataSource}
			dataAge={dataFreshnessLoaded ? dataAge : undefined}
			onRefreshData={subsection.dataSource ? handleRefreshData : undefined}
			onOverride={handleOverride}
			onRegenerate={onRegenerate}
		/>
	{:else if isAuto && overriding}
		<div class="override-toolbar">
			<span class="override-label">Editing auto-generated subsection</span>
			<button class="toolbar-btn revert-btn" onclick={handleRevert}>Revert to Auto</button>
		</div>
		<Editor
			sectionKey="{parentSectionKey}.{subsection.key}"
			initialContent={html}
			onSave={handleEditorSave}
			onRequestGhostText={ghostTextHandler}
			{reportId}
		/>
	{:else if isFreeform}
		<Editor
			sectionKey="{parentSectionKey}.{subsection.key}"
			initialContent={html}
			onSave={handleEditorSave}
			onRequestGhostText={ghostTextHandler}
			{reportId}
		/>
	{:else if isForm && subsection.key === 'nbhd_life_stage'}
		<div class="form-section">
			<label class="form-label">
				Neighborhood Life Stage
				<select value={lifeStageValue} onchange={handleLifeStageChange}>
					<option value="">— Select —</option>
					<option value="growth">Growth</option>
					<option value="stability">Stability</option>
					<option value="decline">Decline</option>
					<option value="revitalization">Revitalization</option>
				</select>
			</label>
			{#if html}
				<div class="form-preview">
					{@html html}
				</div>
			{/if}
		</div>
	{:else if isForm && (subsection.key === 'zoning_standards')}
		<div class="form-section">
			<div class="form-grid">
				{#each Object.entries(standardsFields) as [fieldKey, fieldValue]}
					<label class="form-field">
						<span>{fieldKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
						<input
							type="text"
							value={fieldValue}
							oninput={(e) => { standardsFields[fieldKey] = (e.target as HTMLInputElement).value; }}
							placeholder="e.g., 35 feet"
						/>
					</label>
				{/each}
			</div>
			<button class="save-btn" onclick={handleStandardsSave}>Save Standards</button>
		</div>
	{:else if isForm && subsection.key === 'improvement_units'}
		<div class="form-section">
			<table class="units-table">
				<thead>
					<tr><th>Unit / Suite</th><th>Size (SF)</th><th>Use</th><th></th></tr>
				</thead>
				<tbody>
					{#each unitRows as row, idx}
						<tr>
							<td><input type="text" bind:value={row.name} placeholder="Suite 101" /></td>
							<td><input type="text" bind:value={row.sf} placeholder="1,200" /></td>
							<td><input type="text" bind:value={row.use} placeholder="Office" /></td>
							<td><button class="remove-btn" onclick={() => removeUnitRow(idx)}>×</button></td>
						</tr>
					{/each}
				</tbody>
			</table>
			<div class="unit-actions">
				<button class="add-btn" onclick={addUnitRow}>+ Add Row</button>
				<button class="save-btn" onclick={handleUnitsSave}>Save Units</button>
			</div>
		</div>
	{:else if isImage}
		<ImageUploader
			{reportId}
			sectionKey="{parentSectionKey}.{subsection.key}"
			{images}
			layout="single"
			onchange={handleImageChange}
		/>
	{:else}
		<!-- Generic form fallback -->
		<div class="form-section">
			{#if html}
				<div class="form-preview">
					{@html html}
				</div>
			{:else}
				<p class="placeholder-text">{subsection.placeholder ?? 'No content yet.'}</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.guided-subsection {
		margin-bottom: 1.5rem;
		border: 1px solid #e5e5e5;
		border-radius: 8px;
		overflow: hidden;
	}

	.subsection-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.6rem 1rem;
		background: #f8f9fa;
		border-bottom: 1px solid #e5e5e5;
	}

	.subsection-header h3 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: #1a1a2e;
	}

	.subsection-badges {
		display: flex;
		gap: 0.3rem;
	}

	.badge {
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		text-transform: uppercase;
	}

	.badge-auto { background: #d4edda; color: #155724; }
	.badge-freeform { background: #cce5ff; color: #004085; }
	.badge-form { background: #fff3cd; color: #856404; }
	.badge-image { background: #e8d5f5; color: #6f42c1; }
	.badge-onsite { background: #f8d7da; color: #721c24; }
	.badge-data { background: #d1ecf1; color: #0c5460; }

	.override-toolbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: #fff8e1;
		border-bottom: 1px solid #ffe082;
	}

	.override-label {
		font-size: 0.8rem;
		color: #8d6e00;
		flex: 1;
	}

	.toolbar-btn {
		padding: 0.25rem 0.6rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.78rem;
		cursor: pointer;
		background: #fff;
		color: #555;
	}

	.revert-btn:hover { background: #f5f5f5; }

	.form-section {
		padding: 1rem;
	}

	.form-label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.85rem;
		font-weight: 500;
		color: #333;
	}

	.form-label select {
		padding: 0.4rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 0.85rem;
		max-width: 300px;
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.8rem;
		color: #555;
	}

	.form-field span {
		font-weight: 500;
		text-transform: capitalize;
	}

	.form-field input {
		padding: 0.35rem 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 0.85rem;
	}

	.form-preview {
		margin-top: 0.75rem;
		padding: 1rem;
		background: #fafafa;
		border: 1px solid #eee;
		border-radius: 6px;
		font-family: 'Times New Roman', Georgia, serif;
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.units-table {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 0.75rem;
	}

	.units-table th,
	.units-table td {
		padding: 0.35rem 0.5rem;
		border: 1px solid #ddd;
		text-align: left;
	}

	.units-table th {
		background: #f5f5f5;
		font-size: 0.78rem;
		font-weight: 600;
	}

	.units-table input {
		width: 100%;
		padding: 0.25rem 0.4rem;
		border: 1px solid #ddd;
		border-radius: 3px;
		font-size: 0.85rem;
	}

	.remove-btn {
		background: none;
		border: none;
		color: #dc3545;
		font-size: 1.1rem;
		cursor: pointer;
		padding: 0 0.3rem;
	}

	.unit-actions {
		display: flex;
		gap: 0.5rem;
	}

	.add-btn {
		padding: 0.3rem 0.75rem;
		background: #f8f9fa;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.8rem;
		cursor: pointer;
		color: #555;
	}

	.add-btn:hover { background: #e9ecef; }

	.save-btn {
		padding: 0.3rem 0.75rem;
		background: #1a1a2e;
		color: #fff;
		border: none;
		border-radius: 4px;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.save-btn:hover { background: #2a2a4e; }

	.placeholder-text {
		color: #999;
		font-style: italic;
		font-size: 0.9rem;
	}

	:global(.guided-subsection .auto-section) {
		border: none;
		border-radius: 0;
	}
</style>
