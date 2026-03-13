<script lang="ts">
	interface Property {
		id: number;
		address: string;
		city: string;
		state: string;
		property_type: string;
		building_sf: number;
		year_built: number;
		apn: string;
		sales_json: string;
		leases_json: string;
	}

	let query = $state('');
	let city = $state('');
	let propertyType = $state('');
	let minSf = $state('');
	let maxSf = $state('');
	let properties = $state<Property[]>([]);
	let loading = $state(false);

	async function search() {
		loading = true;
		const params = new URLSearchParams();
		if (query) params.set('q', query);
		if (city) params.set('city', city);
		if (propertyType) params.set('type', propertyType);
		if (minSf) params.set('min_sf', minSf);
		if (maxSf) params.set('max_sf', maxSf);

		const res = await fetch(`/properties?${params}`);
		if (res.ok) {
			const data = await res.json();
			properties = data.properties;
		}
		loading = false;
	}

	$effect(() => {
		search();
	});
</script>

<svelte:head>
	<title>CRE Copilot — Properties</title>
</svelte:head>

<h1>Property Browser</h1>

<div class="filters">
	<input type="text" placeholder="Search address..." bind:value={query} oninput={search} />
	<select bind:value={city} onchange={search}>
		<option value="">All Cities</option>
		<option value="Payson">Payson</option>
		<option value="Provo">Provo</option>
		<option value="American Fork">American Fork</option>
		<option value="Lindon">Lindon</option>
		<option value="Orem">Orem</option>
		<option value="Spanish Fork">Spanish Fork</option>
		<option value="Springville">Springville</option>
	</select>
	<select bind:value={propertyType} onchange={search}>
		<option value="">All Types</option>
		<option value="retail">Retail</option>
		<option value="industrial">Industrial</option>
		<option value="office">Office</option>
		<option value="mixed">Mixed Use</option>
	</select>
	<input type="number" placeholder="Min SF" bind:value={minSf} oninput={search} />
	<input type="number" placeholder="Max SF" bind:value={maxSf} oninput={search} />
</div>

{#if loading}
	<p class="loading">Searching...</p>
{:else if properties.length === 0}
	<p class="empty">No properties found. Try adjusting your filters or <a href="/ingest">upload some reports</a>.</p>
{:else}
	<div class="property-grid">
		{#each properties as prop}
			<div class="property-card">
				<div class="card-header">
					<h3>{prop.address}</h3>
					<span class="type-badge">{prop.property_type ?? 'Unknown'}</span>
				</div>
				<div class="card-body">
					<div class="detail"><span class="label">City:</span> {prop.city}, {prop.state}</div>
					{#if prop.building_sf}
						<div class="detail"><span class="label">Building:</span> {prop.building_sf.toLocaleString()} SF</div>
					{/if}
					{#if prop.year_built}
						<div class="detail"><span class="label">Year Built:</span> {prop.year_built}</div>
					{/if}
					{#if prop.apn}
						<div class="detail"><span class="label">APN:</span> {prop.apn}</div>
					{/if}
					{#if prop.sales_json}
						{@const sales = JSON.parse(prop.sales_json).filter((s: {sale_price: unknown}) => s.sale_price)}
						{#if sales.length > 0}
							<div class="detail">
								<span class="label">Sales:</span>
								{#each sales as sale}
									<span class="sale-tag">${Number(sale.sale_price).toLocaleString()} ({sale.sale_date ?? 'N/A'})</span>
								{/each}
							</div>
						{/if}
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	h1 {
		margin: 0 0 1.5rem 0;
		font-size: 1.5rem;
	}

	.filters {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	.filters input, .filters select {
		padding: 0.5rem 0.75rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 0.9rem;
		background: #fff;
	}

	.filters input[type="text"] {
		flex: 1;
		min-width: 200px;
	}

	.filters input[type="number"] {
		width: 100px;
	}

	.loading, .empty {
		color: #888;
		text-align: center;
		padding: 2rem;
	}

	.empty a {
		color: #1a1a2e;
	}

	.property-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1rem;
	}

	.property-card {
		background: #fff;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0,0,0,0.08);
		overflow: hidden;
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 1rem 1rem 0.5rem;
	}

	.card-header h3 {
		margin: 0;
		font-size: 0.95rem;
		flex: 1;
	}

	.type-badge {
		font-size: 0.7rem;
		padding: 0.15rem 0.5rem;
		border-radius: 99px;
		background: #e8e8f0;
		color: #444;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		white-space: nowrap;
		margin-left: 0.5rem;
	}

	.card-body {
		padding: 0 1rem 1rem;
	}

	.detail {
		font-size: 0.85rem;
		color: #555;
		margin-bottom: 0.25rem;
	}

	.label {
		color: #888;
	}

	.sale-tag {
		display: inline-block;
		font-size: 0.8rem;
		background: #e8f4e8;
		color: #2d5a2d;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		margin: 0.1rem 0.25rem 0.1rem 0;
	}
</style>
