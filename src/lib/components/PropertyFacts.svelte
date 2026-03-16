<script lang="ts">
	import type { PropertyContext } from '$lib/db/index.js';

	interface Props {
		reportId: number;
		propertyContext: PropertyContext;
		onClose: () => void;
		onSaved: () => void;
	}

	let { reportId, propertyContext, onClose, onSaved }: Props = $props();

	// ── Tab state ──
	type Tab = 'facts' | 'appraisal' | 'values' | 'taxes' | 'deeds' | 'owners';
	let activeTab = $state<Tab>('facts');

	const tabs: { key: Tab; label: string }[] = [
		{ key: 'facts', label: 'Facts' },
		{ key: 'appraisal', label: 'Appraisal' },
		{ key: 'values', label: 'Values' },
		{ key: 'taxes', label: 'Taxes' },
		{ key: 'deeds', label: 'Deeds' },
		{ key: 'owners', label: 'Owners' }
	];

	// ── Parse county data ──
	interface CountyData {
		appraisal_fields?: Record<string, string>;
		value_history?: Array<{ year: number; land: number; improvement: number; total: number }>;
		tax_history?: Array<{ year: number; general_tax: number; special_tax: number; total_tax: number }>;
		deeds?: Array<{ date: string; grantor: string; grantee: string; entry_number: string }>;
		owner_history?: Array<{ years: string; name: string }>;
		fetched_at?: string;
		source?: string;
	}

	let countyData = $derived.by<CountyData | null>(() => {
		if (!propertyContext.county_data_json) return null;
		try { return JSON.parse(propertyContext.county_data_json); }
		catch { return null; }
	});

	// ── Editable facts form state ──
	function snapshot(ctx: PropertyContext) {
		return {
			address: ctx.address ?? '',
			city: ctx.city ?? '',
			stateCode: ctx.state ?? '',
			zip: ctx.zip ?? '',
			county: ctx.county ?? '',
			apn: ctx.apn ?? '',
			property_type: ctx.property_type ?? '',
			zoning: ctx.zoning ?? '',
			owner_name: ctx.owner_name ?? '',
			building_sf: ctx.building_sf ?? '' as string | number,
			year_built: ctx.year_built ?? '' as string | number,
			stories: ctx.stories ?? '' as string | number,
			construction_class: ctx.construction_class ?? '',
			quality: ctx.quality ?? '',
			condition: ctx.condition ?? '',
			land_sf: ctx.land_sf ?? '' as string | number,
			land_acres: ctx.land_acres ?? '' as string | number,
			market_value: ctx.market_value ?? '' as string | number,
			occupancy: ctx.occupancy ?? '',
			acquisition_date: ctx.acquisition_date ?? ''
		};
	}

	const init = snapshot(propertyContext);

	let address = $state(init.address);
	let city = $state(init.city);
	let stateCode = $state(init.stateCode);
	let zip = $state(init.zip);
	let county = $state(init.county);
	let apn = $state(init.apn);
	let property_type = $state(init.property_type);
	let zoning = $state(init.zoning);
	let owner_name = $state(init.owner_name);
	let building_sf = $state(init.building_sf);
	let year_built = $state(init.year_built);
	let stories = $state(init.stories);
	let construction_class = $state(init.construction_class);
	let quality = $state(init.quality);
	let condition = $state(init.condition);
	let land_sf = $state(init.land_sf);
	let land_acres = $state(init.land_acres);
	let market_value = $state(init.market_value);
	let occupancy = $state(init.occupancy);
	let acquisition_date = $state(init.acquisition_date);

	let saving = $state(false);
	let saved = $state(false);
	let errorMsg = $state('');

	function toNumberOrNull(val: string | number): number | null {
		if (val === '' || val === null || val === undefined) return null;
		const n = Number(val);
		return isNaN(n) ? null : n;
	}

	function fmtCurrency(val: number): string {
		return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 0 });
	}

	function fmtTax(val: number): string {
		return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	async function handleSave() {
		saving = true;
		saved = false;
		errorMsg = '';
		try {
			const res = await fetch(`/reports/${reportId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_property',
					property: {
						address, city, state: stateCode, zip, county,
						apn, property_type, zoning, owner_name,
						building_sf: toNumberOrNull(building_sf),
						year_built: toNumberOrNull(year_built),
						stories: toNumberOrNull(stories),
						construction_class, quality, condition,
						land_sf: toNumberOrNull(land_sf),
						land_acres: toNumberOrNull(land_acres),
						market_value: toNumberOrNull(market_value),
						occupancy, acquisition_date
					}
				})
			});
			if (res.ok) {
				saved = true;
				onSaved();
				setTimeout(() => { saved = false; }, 2000);
			} else {
				errorMsg = 'Save failed.';
			}
		} catch {
			errorMsg = 'Network error.';
		} finally {
			saving = false;
		}
	}
</script>

<div class="property-facts">
	<div class="panel-header">
		<h3>Property Facts</h3>
		<button class="close-btn" onclick={onClose}>&times;</button>
	</div>

	<div class="tab-bar">
		{#each tabs as tab}
			<button
				class="tab-btn"
				class:active={activeTab === tab.key}
				onclick={() => activeTab = tab.key}
			>{tab.label}</button>
		{/each}
	</div>

	<div class="panel-body">
		{#if activeTab === 'facts'}
			<!-- Editable property facts -->
			<fieldset>
				<legend>Location</legend>
				<label><span>Address</span><input type="text" bind:value={address} /></label>
				<div class="row-2">
					<label><span>City</span><input type="text" bind:value={city} /></label>
					<label><span>State</span><input type="text" bind:value={stateCode} /></label>
				</div>
				<div class="row-2">
					<label><span>ZIP</span><input type="text" bind:value={zip} /></label>
					<label><span>County</span><input type="text" bind:value={county} /></label>
				</div>
			</fieldset>
			<fieldset>
				<legend>Identification</legend>
				<div class="row-2">
					<label><span>APN</span><input type="text" bind:value={apn} /></label>
					<label><span>Property Type</span><input type="text" bind:value={property_type} /></label>
				</div>
				<div class="row-2">
					<label><span>Zoning</span><input type="text" bind:value={zoning} /></label>
					<label><span>Owner</span><input type="text" bind:value={owner_name} /></label>
				</div>
			</fieldset>
			<fieldset>
				<legend>Building</legend>
				<div class="row-2">
					<label><span>Building SF</span><input type="number" bind:value={building_sf} /></label>
					<label><span>Year Built</span><input type="number" bind:value={year_built} /></label>
				</div>
				<div class="row-2">
					<label><span>Stories</span><input type="number" bind:value={stories} /></label>
					<label><span>Construction</span><input type="text" bind:value={construction_class} /></label>
				</div>
				<div class="row-2">
					<label><span>Quality</span><input type="text" bind:value={quality} /></label>
					<label><span>Condition</span><input type="text" bind:value={condition} /></label>
				</div>
			</fieldset>
			<fieldset>
				<legend>Land</legend>
				<div class="row-2">
					<label><span>Land SF</span><input type="number" bind:value={land_sf} /></label>
					<label><span>Land Acres</span><input type="number" step="0.01" bind:value={land_acres} /></label>
				</div>
			</fieldset>
			<fieldset>
				<legend>Financial</legend>
				<label><span>Market Value</span><input type="number" bind:value={market_value} /></label>
				<div class="row-2">
					<label><span>Occupancy</span><input type="text" bind:value={occupancy} /></label>
					<label><span>Acquisition</span><input type="text" bind:value={acquisition_date} placeholder="YYYY" /></label>
				</div>
			</fieldset>

			<div class="panel-footer">
				{#if errorMsg}<p class="error-msg">{errorMsg}</p>{/if}
				{#if saved}<span class="saved-msg">Saved!</span>{/if}
				<button class="save-btn" onclick={handleSave} disabled={saving}>
					{saving ? 'Saving...' : 'Save Changes'}
				</button>
			</div>

		{:else if activeTab === 'appraisal'}
			<!-- Appraisal page key/value pairs -->
			{#if countyData?.appraisal_fields && Object.keys(countyData.appraisal_fields).length > 0}
				<table class="data-table">
					<thead><tr><th>Field</th><th>Value</th></tr></thead>
					<tbody>
						{#each Object.entries(countyData.appraisal_fields) as [key, value]}
							<tr><td class="field-label">{key}</td><td>{value}</td></tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="empty-msg">No appraisal data available.</p>
			{/if}

		{:else if activeTab === 'values'}
			<!-- Value history table -->
			{#if countyData?.value_history && countyData.value_history.length > 0}
				<table class="data-table">
					<thead><tr><th>Year</th><th>Land</th><th>Improvement</th><th>Total</th></tr></thead>
					<tbody>
						{#each countyData.value_history as row}
							<tr>
								<td>{row.year}</td>
								<td>{fmtCurrency(row.land)}</td>
								<td>{fmtCurrency(row.improvement)}</td>
								<td><strong>{fmtCurrency(row.total)}</strong></td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="empty-msg">No value history available.</p>
			{/if}

		{:else if activeTab === 'taxes'}
			<!-- Tax history table -->
			{#if countyData?.tax_history && countyData.tax_history.length > 0}
				<table class="data-table">
					<thead><tr><th>Year</th><th>General</th><th>Special</th><th>Total</th></tr></thead>
					<tbody>
						{#each countyData.tax_history as row}
							<tr>
								<td>{row.year}</td>
								<td>{fmtTax(row.general_tax)}</td>
								<td>{fmtTax(row.special_tax)}</td>
								<td><strong>{fmtTax(row.total_tax)}</strong></td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="empty-msg">No tax history available.</p>
			{/if}

		{:else if activeTab === 'deeds'}
			<!-- Deed history -->
			{#if countyData?.deeds && countyData.deeds.length > 0}
				<table class="data-table">
					<thead><tr><th>Date</th><th>Grantor</th><th>Grantee</th><th>Entry #</th></tr></thead>
					<tbody>
						{#each countyData.deeds as deed}
							<tr>
								<td>{deed.date}</td>
								<td>{deed.grantor}</td>
								<td>{deed.grantee}</td>
								<td class="mono">{deed.entry_number}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="empty-msg">No deed records found.</p>
			{/if}

		{:else if activeTab === 'owners'}
			<!-- Owner history -->
			{#if countyData?.owner_history && countyData.owner_history.length > 0}
				<table class="data-table">
					<thead><tr><th>Years</th><th>Owner</th></tr></thead>
					<tbody>
						{#each countyData.owner_history as owner}
							<tr>
								<td class="mono">{owner.years}</td>
								<td>{owner.name}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="empty-msg">No owner history available.</p>
			{/if}

			{#if countyData?.fetched_at}
				<p class="fetch-info">Data scraped: {new Date(countyData.fetched_at).toLocaleDateString()} from {countyData.source?.replace('_', ' ')}</p>
			{/if}
		{/if}
	</div>
</div>

<style>
	.property-facts {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #eee;
		flex-shrink: 0;
	}

	.panel-header h3 {
		margin: 0;
		font-size: 1rem;
		color: #1a1a2e;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: #888;
		line-height: 1;
	}

	.close-btn:hover { color: #333; }

	/* ── Tab bar ── */
	.tab-bar {
		display: flex;
		gap: 0;
		border-bottom: 1px solid #e0e0e0;
		margin-bottom: 0.75rem;
		flex-shrink: 0;
		overflow-x: auto;
	}

	.tab-btn {
		padding: 0.35rem 0.6rem;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		font-size: 0.72rem;
		font-weight: 500;
		color: #888;
		cursor: pointer;
		white-space: nowrap;
	}

	.tab-btn:hover { color: #555; }

	.tab-btn.active {
		color: #1a1a2e;
		font-weight: 600;
		border-bottom-color: #1a1a2e;
	}

	/* ── Scrollable body ── */
	.panel-body {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	/* ── Facts form styles ── */
	fieldset {
		border: none;
		padding: 0;
		margin: 0 0 0.75rem;
	}

	legend {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #1a1a2e;
		margin-bottom: 0.4rem;
		padding-bottom: 0.2rem;
		border-bottom: 1px solid #eee;
		width: 100%;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		margin-bottom: 0.4rem;
	}

	label span {
		font-size: 0.7rem;
		color: #666;
	}

	input {
		padding: 0.35rem 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.8rem;
		width: 100%;
		box-sizing: border-box;
	}

	input:focus {
		outline: none;
		border-color: #1a1a2e;
		box-shadow: 0 0 0 1px rgba(26, 26, 46, 0.15);
	}

	.row-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.panel-footer {
		padding-top: 0.75rem;
		border-top: 1px solid #eee;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-shrink: 0;
	}

	.save-btn {
		margin-left: auto;
		padding: 0.45rem 1rem;
		background: #1a1a2e;
		color: #fff;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.save-btn:hover:not(:disabled) { background: #2a2a4e; }
	.save-btn:disabled { opacity: 0.6; cursor: not-allowed; }

	.saved-msg { font-size: 0.8rem; color: #2d5a2d; font-weight: 500; }
	.error-msg { font-size: 0.8rem; color: #c33; margin: 0; }

	/* ── Data table styles (read-only tabs) ── */
	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.75rem;
	}

	.data-table th {
		text-align: left;
		padding: 0.3rem 0.4rem;
		background: #f5f5f8;
		border-bottom: 1px solid #ddd;
		font-weight: 600;
		font-size: 0.7rem;
		color: #555;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		position: sticky;
		top: 0;
	}

	.data-table td {
		padding: 0.3rem 0.4rem;
		border-bottom: 1px solid #f0f0f0;
		vertical-align: top;
	}

	.data-table .field-label {
		font-weight: 500;
		color: #555;
		min-width: 100px;
	}

	.data-table .mono {
		font-family: monospace;
		font-size: 0.72rem;
	}

	.empty-msg {
		color: #999;
		font-size: 0.85rem;
		text-align: center;
		padding: 2rem 0;
	}

	.fetch-info {
		font-size: 0.7rem;
		color: #999;
		text-align: center;
		margin-top: 1rem;
		font-style: italic;
	}
</style>
