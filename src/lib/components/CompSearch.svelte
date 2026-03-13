<script lang="ts">
	interface Props {
		reportId: number;
		existingComps: Array<{ property_id: number; comp_type: string }>;
		onClose: () => void;
	}

	let { reportId, existingComps, onClose }: Props = $props();

	interface Property {
		id: number;
		address: string;
		city: string;
		property_type: string;
		building_sf: number;
		year_built: number;
		sales_json: string;
	}

	let query = $state('');
	let compType = $state<'sale' | 'lease'>('sale');
	let results = $state<Property[]>([]);
	let loading = $state(false);

	async function search() {
		loading = true;
		const params = new URLSearchParams();
		if (query) params.set('q', query);
		params.set('exclude_report', String(reportId));

		const res = await fetch(`/properties?${params}`);
		if (res.ok) {
			const data = await res.json();
			results = data.properties;
		}
		loading = false;
	}

	async function addComp(property: Property, saleId?: number, leaseId?: number) {
		const existingIds = existingComps.map((c) => c.property_id);
		if (existingIds.includes(property.id)) return;

		const rank = existingComps.filter((c) => c.comp_type === compType).length + 1;

		await fetch(`/reports/${reportId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'add_comp',
				comp_type: compType,
				property_id: property.id,
				sale_id: saleId,
				lease_id: leaseId,
				rank
			})
		});

		// Reload page to refresh comps
		window.location.reload();
	}

	$effect(() => {
		search();
	});
</script>

<div class="comp-search">
	<div class="search-header">
		<h3>Add Comparables</h3>
		<button class="close-btn" onclick={onClose}>&times;</button>
	</div>

	<div class="search-controls">
		<select bind:value={compType}>
			<option value="sale">Sale Comps</option>
			<option value="lease">Lease Comps</option>
		</select>
		<input
			type="text"
			placeholder="Search properties..."
			bind:value={query}
			oninput={search}
		/>
	</div>

	{#if loading}
		<p class="loading">Searching...</p>
	{:else if results.length === 0}
		<p class="empty">No properties found.</p>
	{:else}
		<div class="results">
			{#each results as prop}
				{@const isAdded = existingComps.some(c => c.property_id === prop.id)}
				<div class="result-card" class:added={isAdded}>
					<div class="result-info">
						<span class="result-address">{prop.address}</span>
						<span class="result-meta">
							{prop.city} &middot; {prop.building_sf?.toLocaleString() ?? '?'} SF
							{#if prop.year_built} &middot; {prop.year_built}{/if}
						</span>
					</div>
					{#if isAdded}
						<span class="added-badge">Added</span>
					{:else}
						<button class="add-btn" onclick={() => addComp(prop)}>+ Add</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.comp-search {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.search-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.search-header h3 {
		margin: 0;
		font-size: 1rem;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: #888;
		line-height: 1;
	}

	.search-controls {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.search-controls input, .search-controls select {
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 0.85rem;
	}

	.loading, .empty {
		color: #888;
		font-size: 0.85rem;
		text-align: center;
		padding: 1rem;
	}

	.results {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.result-card {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem;
		border: 1px solid #eee;
		border-radius: 6px;
		font-size: 0.85rem;
	}

	.result-card.added {
		opacity: 0.6;
	}

	.result-info {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.result-address {
		font-weight: 500;
	}

	.result-meta {
		font-size: 0.75rem;
		color: #888;
	}

	.add-btn {
		padding: 0.3rem 0.6rem;
		background: #e8f4e8;
		color: #2d5a2d;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.add-btn:hover {
		background: #d4edda;
	}

	.added-badge {
		font-size: 0.75rem;
		color: #888;
		padding: 0.2rem 0.5rem;
	}
</style>
