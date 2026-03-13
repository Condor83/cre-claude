<script lang="ts">
	import { goto } from '$app/navigation';

	interface Property {
		id: number;
		address: string;
		city: string;
		property_type: string;
	}

	let searchQuery = $state('');
	let searchResults = $state<Property[]>([]);
	let selectedProperty = $state<Property | null>(null);
	let reportNumber = $state('');
	let approach = $state<'sales_comparison' | 'income_cap' | 'both'>('both');
	let effectiveDate = $state(new Date().toISOString().split('T')[0]);
	let creating = $state(false);

	async function searchProperties() {
		if (!searchQuery) {
			searchResults = [];
			return;
		}
		const res = await fetch(`/properties?q=${encodeURIComponent(searchQuery)}`);
		if (res.ok) {
			const data = await res.json();
			searchResults = data.properties;
		}
	}

	function selectProperty(prop: Property) {
		selectedProperty = prop;
		searchQuery = prop.address;
		searchResults = [];
	}

	async function createReport() {
		if (!selectedProperty) return;
		creating = true;

		const res = await fetch('/reports', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				subject_property_id: selectedProperty.id,
				report_number: reportNumber || undefined,
				approach,
				effective_date: effectiveDate
			})
		});

		if (res.ok) {
			const data = await res.json();
			goto(`/reports/${data.id}`);
		} else {
			creating = false;
		}
	}
</script>

<svelte:head>
	<title>CRE Copilot — New Report</title>
</svelte:head>

<h1>New Appraisal Report</h1>

<div class="wizard">
	<div class="step">
		<h2>1. Select Subject Property</h2>
		<div class="search-box">
			<input
				type="text"
				placeholder="Search for a property..."
				bind:value={searchQuery}
				oninput={searchProperties}
			/>
			{#if searchResults.length > 0}
				<div class="search-dropdown">
					{#each searchResults as prop}
						<button class="search-result" onclick={() => selectProperty(prop)}>
							<span class="result-address">{prop.address}</span>
							<span class="result-meta">{prop.city} &middot; {prop.property_type ?? 'Unknown'}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
		{#if selectedProperty}
			<div class="selected-property">
				Selected: <strong>{selectedProperty.address}</strong>, {selectedProperty.city}
			</div>
		{/if}
	</div>

	<div class="step">
		<h2>2. Report Details</h2>
		<div class="form-fields">
			<label>
				Report Number
				<input type="text" placeholder="e.g., 26.004.C" bind:value={reportNumber} />
			</label>
			<label>
				Approach
				<select bind:value={approach}>
					<option value="both">Both (Sales Comparison + Income)</option>
					<option value="sales_comparison">Sales Comparison Only</option>
					<option value="income_cap">Income Capitalization Only</option>
				</select>
			</label>
			<label>
				Effective Date
				<input type="date" bind:value={effectiveDate} />
			</label>
		</div>
	</div>

	<button class="btn" onclick={createReport} disabled={!selectedProperty || creating}>
		{creating ? 'Creating...' : 'Create Report'}
	</button>
</div>

<style>
	h1 {
		margin: 0 0 1.5rem 0;
		font-size: 1.5rem;
	}

	.wizard {
		max-width: 600px;
	}

	.step {
		background: #fff;
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 1rem;
		box-shadow: 0 1px 3px rgba(0,0,0,0.08);
	}

	.step h2 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		color: #444;
	}

	.search-box {
		position: relative;
	}

	.search-box input {
		width: 100%;
		padding: 0.6rem 0.75rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 0.9rem;
		box-sizing: border-box;
	}

	.search-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: #fff;
		border: 1px solid #ddd;
		border-radius: 0 0 6px 6px;
		box-shadow: 0 4px 8px rgba(0,0,0,0.1);
		z-index: 10;
		max-height: 200px;
		overflow-y: auto;
	}

	.search-result {
		display: block;
		width: 100%;
		padding: 0.6rem 0.75rem;
		border: none;
		background: none;
		text-align: left;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.search-result:hover {
		background: #f0f0f0;
	}

	.result-address {
		display: block;
		font-weight: 500;
	}

	.result-meta {
		display: block;
		font-size: 0.8rem;
		color: #888;
	}

	.selected-property {
		margin-top: 0.75rem;
		padding: 0.5rem 0.75rem;
		background: #e8f4e8;
		border-radius: 6px;
		font-size: 0.9rem;
		color: #2d5a2d;
	}

	.form-fields {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.form-fields label {
		display: flex;
		flex-direction: column;
		font-size: 0.85rem;
		color: #666;
		gap: 0.25rem;
	}

	.form-fields input, .form-fields select {
		padding: 0.5rem 0.75rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 0.9rem;
	}

	.btn {
		padding: 0.6rem 1.5rem;
		background: #1a1a2e;
		color: #fff;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
