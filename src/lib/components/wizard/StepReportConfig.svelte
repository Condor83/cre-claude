<script lang="ts">
	import { getSectionsForApproaches } from '$lib/config/sections.js';

	interface Props {
		report_number: string;
		effective_date: string;
		client_name: string;
		intended_use: string;
		property_rights: string;
		approaches: string[];
	}

	let {
		report_number = $bindable(),
		effective_date = $bindable(),
		client_name = $bindable(),
		intended_use = $bindable(),
		property_rights = $bindable(),
		approaches = $bindable()
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

	<!-- Section Preview -->
	<div class="section-preview">
		<h4 class="preview-heading">{previewSections.length} sections</h4>
		<ul class="section-list">
			{#each previewSections as section (section.key)}
				<li class="section-item">
					<span class="section-label">{section.label}</span>
					<span class="section-type">{sectionTypeLabel[section.sectionType]}</span>
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
</style>
