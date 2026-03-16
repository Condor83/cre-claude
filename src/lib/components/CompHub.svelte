<script lang="ts">
	interface Props {
		reportId: number;
		existingComps: Array<{ id: number; property_id: number; comp_type: string; rank: number; address: string; city: string }>;
		subjectPropertyId?: number;
		subjectCounty?: string;
		onClose: () => void;
		onCompChanged: () => void;
	}

	let { reportId, existingComps, subjectPropertyId, subjectCounty, onClose, onCompChanged }: Props = $props();

	// Tab state
	let activeTab = $state<'search' | 'new' | 'manage'>('search');

	// ── Search mode ──
	let query = $state('');
	let filterCity = $state('');
	let filterType = $state('');
	let filterMinSf = $state('');
	let filterMaxSf = $state('');
	let results = $state<Array<Record<string, unknown>>>([]);
	let searchLoading = $state(false);
	let compType = $state<'sale' | 'lease'>('sale');

	let searchTimer: ReturnType<typeof setTimeout>;

	async function search() {
		searchLoading = true;
		const params = new URLSearchParams();
		if (query) params.set('q', query);
		if (filterCity) params.set('city', filterCity);
		if (filterType) params.set('property_type', filterType);
		if (filterMinSf) params.set('min_sf', filterMinSf);
		if (filterMaxSf) params.set('max_sf', filterMaxSf);
		params.set('exclude_report', String(reportId));

		const res = await fetch(`/properties?${params}`);
		if (res.ok) {
			const data = await res.json();
			results = data.properties ?? [];
		}
		searchLoading = false;
	}

	function debouncedSearch() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(search, 300);
	}

	$effect(() => {
		if (activeTab === 'search') search();
	});

	// ── New comp by parcel ──
	let parcelId = $state('');
	let parcelCounty = $state(subjectCounty || 'utah_county');
	let fetchLoading = $state(false);
	let fetchResult = $state<Record<string, unknown> | null>(null);
	let fetchError = $state('');

	async function fetchByParcel() {
		if (!parcelId.trim()) return;
		fetchLoading = true;
		fetchError = '';
		fetchResult = null;

		const params = new URLSearchParams({ parcel: parcelId.trim(), county: parcelCounty });
		const res = await fetch(`/api/county-lookup?${params}`);
		if (res.ok) {
			const data = await res.json();
			if (data.found) {
				fetchResult = data;
			} else {
				fetchError = data.error || 'Parcel not found. Check the serial number and county.';
			}
		} else {
			fetchError = 'County lookup failed. Try again or add manually.';
		}
		fetchLoading = false;
	}

	async function addComp(propertyId: number, saleId?: number) {
		const existingIds = existingComps.map(c => c.property_id);
		if (existingIds.includes(propertyId)) return;

		const rank = existingComps.filter(c => c.comp_type === compType).length + 1;

		await fetch(`/reports/${reportId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'add_comp',
				comp_type: compType,
				property_id: propertyId,
				sale_id: saleId,
				rank
			})
		});

		onCompChanged();
	}

	async function addFromFetch() {
		if (!fetchResult?.data) return;
		const d = fetchResult.data as Record<string, unknown>;
		const rank = existingComps.filter(c => c.comp_type === compType).length + 1;

		// Fix 2: Single PUT with county_data — server creates property inline
		await fetch(`/reports/${reportId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'add_comp',
				comp_type: compType,
				rank,
				county_data: {
					address: d.address,
					city: d.city,
					apn: d.apn,
					property_type: d.property_type_raw,
					year_built: d.year_built,
					building_sf: d.building_sf,
					land_sf: d.land_sf,
					land_acres: d.land_acres,
					zoning: d.zoning,
					construction_class: d.construction_class,
					quality: d.quality,
					market_value: d.market_value,
					owner_name: d.owner_name,
					county: parcelCounty
				},
				county_data_json: JSON.stringify(fetchResult.county_data)
			})
		});

		// Reset
		parcelId = '';
		fetchResult = null;
		activeTab = 'search';
		onCompChanged();
	}

	function getLatestSaleId(prop: Record<string, unknown>): number | undefined {
		if (!prop.sales_json) return undefined;
		try {
			const sales = JSON.parse(prop.sales_json as string) as Array<{ id: number; sale_price: number | null }>;
			// Filter out the null placeholder that json_group_array creates for properties with no sales
			const real = sales.filter(s => s.id != null);
			return real.length > 0 ? real[0].id : undefined;
		} catch { return undefined; }
	}

	function isAdded(propertyId: number): boolean {
		return existingComps.some(c => c.property_id === propertyId);
	}
</script>

<div class="comp-hub">
	<div class="hub-header">
		<h3>Comparables</h3>
		<button class="close-btn" onclick={onClose}>&times;</button>
	</div>

	<!-- Tab bar -->
	<div class="tab-bar">
		<button class="tab" class:active={activeTab === 'search'} onclick={() => activeTab = 'search'}>Search DB</button>
		<button class="tab" class:active={activeTab === 'new'} onclick={() => activeTab = 'new'}>+ New</button>
		<button class="tab" class:active={activeTab === 'manage'} onclick={() => activeTab = 'manage'}>Manage ({existingComps.length})</button>
	</div>

	<!-- Comp type toggle -->
	<div class="type-toggle">
		<select bind:value={compType}>
			<option value="sale">Sale Comps</option>
			<option value="lease">Lease Comps</option>
		</select>
	</div>

	{#if activeTab === 'search'}
		<!-- Search mode -->
		<div class="search-filters">
			<input type="text" placeholder="Search address..." bind:value={query} oninput={debouncedSearch} />
			<div class="filter-row">
				<input type="text" placeholder="City" bind:value={filterCity} oninput={debouncedSearch} />
				<input type="text" placeholder="Type" bind:value={filterType} oninput={debouncedSearch} />
			</div>
			<div class="filter-row">
				<input type="number" placeholder="Min SF" bind:value={filterMinSf} oninput={debouncedSearch} />
				<input type="number" placeholder="Max SF" bind:value={filterMaxSf} oninput={debouncedSearch} />
			</div>
		</div>

		{#if searchLoading}
			<p class="status-msg">Searching...</p>
		{:else if results.length === 0}
			<p class="status-msg">No properties found.</p>
		{:else}
			<div class="result-list">
				{#each results as prop}
					{@const added = isAdded(prop.id as number)}
					<div class="result-card" class:added>
						<div class="result-info">
							<span class="result-address">{prop.address}</span>
							<span class="result-meta">
								{prop.city} &middot; {(prop.building_sf as number)?.toLocaleString() ?? '?'} SF
								{#if prop.year_built}&middot; {prop.year_built}{/if}
								{#if prop.property_type}&middot; {prop.property_type}{/if}
							</span>
						</div>
						{#if added}
							<span class="added-badge">Added</span>
						{:else}
							<button class="add-btn" onclick={() => addComp(prop.id as number, getLatestSaleId(prop))}>+ Add</button>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

	{:else if activeTab === 'new'}
		<!-- Add new by parcel -->
		<div class="new-comp-form">
			<label class="field">
				<span class="field-label">Parcel ID / Serial Number</span>
				<input type="text" bind:value={parcelId} placeholder="e.g. 46:764:0002" />
			</label>
			<label class="field">
				<span class="field-label">County</span>
				<select bind:value={parcelCounty}>
					<option value="utah_county">Utah County</option>
					<option value="salt_lake_county">Salt Lake County</option>
				</select>
			</label>
			<button class="fetch-btn" onclick={fetchByParcel} disabled={fetchLoading || !parcelId.trim()}>
				{fetchLoading ? 'Fetching...' : 'Fetch County Data'}
			</button>

			{#if fetchError}
				<p class="error-msg">{fetchError}</p>
			{/if}

			{#if fetchResult?.data}
				{@const d = fetchResult.data as Record<string, unknown>}
				<div class="fetch-preview">
					<h4>Property Found</h4>
					<div class="preview-grid">
						<span class="preview-label">Address</span><span>{d.address}</span>
						<span class="preview-label">City</span><span>{d.city}</span>
						<span class="preview-label">Type</span><span>{d.property_type_raw ?? '\u2014'}</span>
						<span class="preview-label">Size</span><span>{(d.building_sf as number)?.toLocaleString() ?? '\u2014'} SF</span>
						<span class="preview-label">Year</span><span>{d.year_built ?? '\u2014'}</span>
						<span class="preview-label">Zoning</span><span>{d.zoning ?? '\u2014'}</span>
					</div>
					<button class="add-btn full" onclick={addFromFetch}>Add as Comparable</button>
				</div>
			{/if}
		</div>

	{:else}
		<!-- Manage existing comps -->
		<div class="manage-list">
			{#each existingComps.filter(c => c.comp_type === compType).sort((a, b) => a.rank - b.rank) as comp (comp.id)}
				<div class="manage-card">
					<span class="manage-rank">#{comp.rank}</span>
					<div class="manage-info">
						<span class="manage-addr">{comp.address}</span>
						<span class="manage-city">{comp.city}</span>
					</div>
					<button class="remove-btn" onclick={async () => {
						if (confirm(`Remove ${comp.address} from comparables?`)) {
							await fetch(`/reports/${reportId}`, {
								method: 'PUT',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ action: 'remove_comp', comp_id: comp.id, comp_type: compType })
							});
							onCompChanged();
						}
					}}>&times;</button>
				</div>
			{/each}
			{#if existingComps.filter(c => c.comp_type === compType).length === 0}
				<p class="status-msg">No {compType} comps added yet.</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.comp-hub { display: flex; flex-direction: column; height: 100%; font-size: 0.85rem; }
	.hub-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
	.hub-header h3 { margin: 0; font-size: 1rem; }
	.close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #888; line-height: 1; }

	.tab-bar { display: flex; gap: 0; margin-bottom: 0.75rem; border-bottom: 2px solid #eee; }
	.tab { flex: 1; padding: 0.4rem 0; border: none; background: none; cursor: pointer; font-size: 0.8rem; color: #888; border-bottom: 2px solid transparent; margin-bottom: -2px; }
	.tab.active { color: #1a1a2e; border-bottom-color: #1a1a2e; font-weight: 600; }

	.type-toggle { margin-bottom: 0.5rem; }
	.type-toggle select { width: 100%; padding: 0.4rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.8rem; }

	.search-filters { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.5rem; }
	.search-filters input { padding: 0.4rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.8rem; }
	.filter-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; }

	.status-msg { color: #888; font-size: 0.8rem; text-align: center; padding: 1rem; }

	.result-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.4rem; }
	.result-card { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border: 1px solid #eee; border-radius: 6px; }
	.result-card.added { opacity: 0.6; }
	.result-info { flex: 1; display: flex; flex-direction: column; }
	.result-address { font-weight: 500; }
	.result-meta { font-size: 0.72rem; color: #888; }
	.add-btn { padding: 0.3rem 0.6rem; background: #e8f4e8; color: #2d5a2d; border: none; border-radius: 4px; cursor: pointer; font-size: 0.78rem; white-space: nowrap; }
	.add-btn:hover { background: #d4edda; }
	.add-btn.full { width: 100%; text-align: center; padding: 0.5rem; margin-top: 0.5rem; }
	.added-badge { font-size: 0.72rem; color: #888; padding: 0.2rem 0.5rem; }

	.new-comp-form { display: flex; flex-direction: column; gap: 0.5rem; }
	.field { display: flex; flex-direction: column; gap: 0.2rem; }
	.field-label { font-size: 0.75rem; color: #555; }
	.field input, .field select { padding: 0.4rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem; }
	.fetch-btn { padding: 0.5rem; background: #1a1a2e; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
	.fetch-btn:disabled { opacity: 0.5; cursor: default; }
	.error-msg { color: #c44; font-size: 0.8rem; margin: 0; }

	.fetch-preview { border: 1px solid #d4edda; border-radius: 6px; padding: 0.75rem; background: #f0fdf0; }
	.fetch-preview h4 { margin: 0 0 0.5rem; font-size: 0.85rem; color: #155724; }
	.preview-grid { display: grid; grid-template-columns: auto 1fr; gap: 0.2rem 0.5rem; font-size: 0.8rem; }
	.preview-label { color: #888; font-weight: 500; }

	.manage-list { display: flex; flex-direction: column; gap: 0.4rem; }
	.manage-card { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border: 1px solid #eee; border-radius: 6px; }
	.manage-rank { font-weight: 700; color: #1a1a2e; font-size: 0.85rem; min-width: 1.5rem; }
	.manage-info { flex: 1; display: flex; flex-direction: column; }
	.manage-addr { font-weight: 500; font-size: 0.82rem; }
	.manage-city { font-size: 0.72rem; color: #888; }
	.remove-btn { background: none; border: none; color: #c44; font-size: 1.2rem; cursor: pointer; padding: 0 0.3rem; }
	.remove-btn:hover { color: #a00; }
</style>
