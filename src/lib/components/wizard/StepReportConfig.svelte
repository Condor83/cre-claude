<script lang="ts">
	import { getSectionsForApproaches } from '$lib/config/sections.js';

	interface Props {
		report_number: string;
		effective_date: string;
		client_name: string;
		intended_use: string;
		property_rights: string;
		approaches: string[];
		target_price_psf: string;
		selected_comp_ids: number[];
		// Subject property context for auto-suggest
		subject_property_type?: string;
		subject_building_sf?: string;
		subject_county?: string;
		subject_property_id?: number;
		subject_apn?: string;
	}

	let {
		report_number = $bindable(),
		effective_date = $bindable(),
		client_name = $bindable(),
		intended_use = $bindable(),
		property_rights = $bindable(),
		approaches = $bindable(),
		target_price_psf = $bindable(),
		selected_comp_ids = $bindable([]),
		subject_property_type,
		subject_building_sf,
		subject_county,
		subject_property_id,
		subject_apn
	}: Props = $props();

	const approachOptions = [
		{ value: 'sales_comparison', label: 'Sales Comparison' },
		{ value: 'income_cap', label: 'Income Capitalization' },
		{ value: 'cost', label: 'Cost' }
	];

	function toggleApproach(approach: string) {
		if (approaches.includes(approach)) {
			approaches = approaches.filter(a => a !== approach);
		} else {
			approaches = [...approaches, approach];
		}
	}

	const previewSections = $derived(getSectionsForApproaches(approaches));

	const sectionTypeLabel: Record<string, string> = {
		boilerplate: 'boilerplate',
		comp: 'comp',
		narrative: 'narrative'
	};

	// ── Comp suggestions ──
	interface CompSuggestion {
		property_id: number;
		address: string;
		city: string;
		property_type: string | null;
		building_sf: number | null;
		year_built: number | null;
		sale_price: number | null;
		price_per_sf: number | null;
		sale_date: string | null;
		score: number;
		score_breakdown: { type_match: number; price_proximity: number; size_similarity: number; county_match: number };
	}

	let suggestions = $state<CompSuggestion[]>([]);
	let suggestLoading = $state(false);

	let debounceTimer: ReturnType<typeof setTimeout>;

	async function fetchSuggestions() {
		if (!subject_property_type || !subject_building_sf || !target_price_psf) {
			suggestions = [];
			return;
		}
		suggestLoading = true;
		const params = new URLSearchParams({
			property_type: subject_property_type,
			building_sf: subject_building_sf,
			target_price_psf: target_price_psf,
			county: subject_county || 'utah_county',
			...(subject_property_id ? { exclude_property_id: String(subject_property_id) } : {}),
			...(subject_apn ? { exclude_apn: subject_apn } : {})
		});
		try {
			const res = await fetch(`/api/comp-suggest?${params}`);
			if (res.ok) {
				const data = await res.json();
				suggestions = data.suggestions;
			}
		} catch { /* ignore */ }
		suggestLoading = false;
	}

	// Re-fetch suggestions when target $/SF changes (debounced)
	$effect(() => {
		const _psf = target_price_psf;
		clearTimeout(debounceTimer);
		if (_psf && Number(_psf) > 0) {
			debounceTimer = setTimeout(fetchSuggestions, 500);
		}
	});

	function toggleSuggestion(id: number) {
		if (selected_comp_ids.includes(id)) {
			selected_comp_ids = selected_comp_ids.filter(x => x !== id);
		} else {
			selected_comp_ids = [...selected_comp_ids, id];
		}
	}
</script>

<div class="step-report-config">
	<!-- Report Number + Effective Date -->
	<div class="field-row">
		<label class="field">
			<span class="field-label">Report number</span>
			<input
				type="text"
				bind:value={report_number}
				placeholder="26.004.C"
			/>
		</label>

		<label class="field">
			<span class="field-label">Effective date</span>
			<input
				type="date"
				bind:value={effective_date}
			/>
		</label>
	</div>

	<!-- Client Name -->
	<label class="field full-width">
		<span class="field-label">Client name</span>
		<input
			type="text"
			bind:value={client_name}
		/>
	</label>

	<!-- Intended Use + Property Rights -->
	<div class="field-row">
		<label class="field">
			<span class="field-label">Intended use</span>
			<input
				type="text"
				bind:value={intended_use}
			/>
		</label>

		<label class="field">
			<span class="field-label">Property rights</span>
			<select bind:value={property_rights}>
				<option value="Fee Simple">Fee Simple</option>
				<option value="Leased Fee">Leased Fee</option>
			</select>
		</label>
	</div>

	<!-- Valuation Approaches -->
	<div class="approaches-section">
		<span class="field-label">Valuation approaches</span>
		<div class="checkbox-row">
			{#each approachOptions as opt (opt.value)}
				<label class="checkbox-label">
					<input
						type="checkbox"
						checked={approaches.includes(opt.value)}
						onchange={() => toggleApproach(opt.value)}
					/>
					{opt.label}
				</label>
			{/each}
		</div>
		{#if approaches.length === 0}
			<p class="validation-msg">At least one approach must be selected.</p>
		{/if}
	</div>

	<!-- Target Price per SF -->
	{#if approaches.includes('sales_comparison')}
		<label class="field full-width">
			<span class="field-label">Target price per SF <span class="field-hint">(Brad's estimate — guides comp suggestions)</span></span>
			<div class="psf-input-row">
				<span class="psf-prefix">$</span>
				<input
					type="number"
					step="0.01"
					min="0"
					bind:value={target_price_psf}
					placeholder="e.g. 85.00"
				/>
				<span class="psf-suffix">/ SF</span>
			</div>
		</label>

		<!-- Suggested Comps -->
		{#if suggestions.length > 0}
			<div class="suggestions-section">
				<span class="field-label">Suggested comparables <span class="field-hint">({suggestions.length} found — select any to pre-add)</span></span>
				<div class="suggestion-list">
					{#each suggestions as s (s.property_id)}
						{@const selected = selected_comp_ids.includes(s.property_id)}
						<button
							class="suggestion-card"
							class:selected
							onclick={() => toggleSuggestion(s.property_id)}
						>
							<div class="suggestion-main">
								<span class="suggestion-addr">{s.address}, {s.city}</span>
								<span class="suggestion-meta">
									{s.building_sf?.toLocaleString() ?? '?'} SF
									{#if s.year_built}&middot; {s.year_built}{/if}
									{#if s.price_per_sf}&middot; ${s.price_per_sf.toFixed(2)}/SF{/if}
								</span>
							</div>
							<div class="suggestion-score">
								<span class="score-badge" class:high={s.score >= 70} class:medium={s.score >= 40 && s.score < 70}>
									{s.score}
								</span>
							</div>
							{#if selected}
								<span class="check-mark">&#10003;</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{:else if suggestLoading}
			<p class="suggest-loading">Finding similar properties...</p>
		{:else if target_price_psf && Number(target_price_psf) > 0 && subject_property_type}
			<p class="suggest-empty">No similar properties found in database.</p>
		{/if}
	{/if}

	<!-- Section Preview -->
	<div class="section-preview">
		<h4 class="preview-heading">{previewSections.length} sections</h4>
		<ul class="section-list">
			{#each previewSections as section (section.key)}
				<li class="section-item">
					<span class="section-label">{section.label}</span>
					<span class="section-type">{sectionTypeLabel[section.tier] ?? section.tier}</span>
				</li>
			{/each}
		</ul>
	</div>
</div>

<style>
	.step-report-config {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.field-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.full-width {
		width: 100%;
	}

	.field-label {
		font-size: 0.8rem;
		color: #555;
	}

	.field input,
	.field select {
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 0.9rem;
		background: #fff;
	}

	.field input:focus,
	.field select:focus {
		outline: none;
		border-color: #999;
	}

	.approaches-section {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.checkbox-row {
		display: flex;
		gap: 1.25rem;
		flex-wrap: wrap;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.9rem;
		color: #333;
		cursor: pointer;
	}

	.checkbox-label input[type='checkbox'] {
		accent-color: #555;
	}

	.validation-msg {
		margin: 0;
		font-size: 0.8rem;
		color: #c44;
	}

	.section-preview {
		border: 1px solid #ddd;
		border-radius: 6px;
		padding: 0.75rem;
		background: #fff;
	}

	.preview-heading {
		margin: 0 0 0.5rem;
		font-size: 0.85rem;
		font-weight: 600;
		color: #555;
	}

	.section-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.section-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.85rem;
		padding: 0.25rem 0;
	}

	.section-label {
		color: #333;
	}

	.section-type {
		font-size: 0.75rem;
		color: #999;
	}

	.field-hint {
		font-weight: 400;
		color: #999;
		font-size: 0.75rem;
	}

	.psf-input-row {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.psf-prefix, .psf-suffix {
		font-size: 0.85rem;
		color: #888;
		font-weight: 500;
	}

	.psf-input-row input {
		width: 120px;
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 0.9rem;
	}

	.suggestions-section {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.suggestion-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		max-height: 240px;
		overflow-y: auto;
	}

	.suggestion-card {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.6rem;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		background: #fff;
		cursor: pointer;
		text-align: left;
		font-size: 0.82rem;
		transition: border-color 0.15s;
	}

	.suggestion-card:hover {
		border-color: #999;
	}

	.suggestion-card.selected {
		border-color: #28a745;
		background: #f0fdf0;
	}

	.suggestion-main {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.suggestion-addr {
		font-weight: 500;
		color: #333;
	}

	.suggestion-meta {
		font-size: 0.75rem;
		color: #888;
	}

	.score-badge {
		font-size: 0.7rem;
		font-weight: 700;
		padding: 0.15rem 0.4rem;
		border-radius: 99px;
		background: #e0e0e0;
		color: #666;
	}

	.score-badge.high {
		background: #d4edda;
		color: #155724;
	}

	.score-badge.medium {
		background: #fff3cd;
		color: #856404;
	}

	.check-mark {
		color: #28a745;
		font-size: 1rem;
		font-weight: 700;
	}

	.suggest-loading, .suggest-empty {
		font-size: 0.8rem;
		color: #888;
		margin: 0;
	}
</style>
