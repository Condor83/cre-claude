<script lang="ts">
	interface Props {
		property_type: string;
		apn: string;
		zoning: string;
		building_sf: string;
		land_sf: string;
		land_acres: string;
		market_value: string;
		year_built: string;
		stories: string;
		construction_class: string;
		quality: string;
		condition: string;
		owner_name: string;
		acquisition_date: string;
		occupancy: string;
		scraperFields: Set<string>;
		scraperError: string;
		countyDataJson: string;
	}

	let {
		property_type = $bindable(),
		apn = $bindable(),
		zoning = $bindable(),
		building_sf = $bindable(),
		land_sf = $bindable(),
		land_acres = $bindable(),
		market_value = $bindable(),
		year_built = $bindable(),
		stories = $bindable(),
		construction_class = $bindable(),
		quality = $bindable(),
		condition = $bindable(),
		owner_name = $bindable(),
		acquisition_date = $bindable(),
		occupancy = $bindable(),
		scraperFields,
		scraperError,
		countyDataJson
	}: Props = $props();

	interface CountyData {
		appraisal_fields: Record<string, string>;
		value_history: Array<{ year: number; land: number; improvement: number; total: number }>;
		tax_history: Array<{ year: number; general_tax: number; special_tax: number; total_tax: number }>;
		deeds: Array<{ date: string; grantor: string; grantee: string; entry_number: string }>;
		owner_history: Array<{ years: string; name: string }>;
		partial_years?: boolean;
	}

	let countyData: CountyData | null = $derived.by(() => {
		if (!countyDataJson) return null;
		try { return JSON.parse(countyDataJson); } catch { return null; }
	});

	function fieldStyle(key: string): string {
		if (scraperFields.has(key)) {
			return 'background-color: #e8f5e9;';
		}
		return '';
	}

	function formatCurrency(value: number): string {
		return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
	}
</script>

<div class="step-property-facts">
	{#if scraperError}
		<div class="scraper-notice">{scraperError}</div>
	{/if}

	<!-- Identity -->
	<h3 class="group-heading">Identity</h3>
	<div class="field-grid">
		<label class="field">
			<span class="field-label">Property type</span>
			<select
				bind:value={property_type}
				style={fieldStyle('property_type')}
			>
				<option value="">--</option>
				<option value="Office">Office</option>
				<option value="Retail">Retail</option>
				<option value="Industrial/Warehouse">Industrial/Warehouse</option>
				<option value="Flex - Office/Warehouse">Flex - Office/Warehouse</option>
				<option value="Multi-Family">Multi-Family</option>
				<option value="Hospitality">Hospitality</option>
				<option value="Self-Storage">Self-Storage</option>
				<option value="Mixed Use">Mixed Use</option>
				<option value="Land">Land</option>
				<option value="Special Purpose">Special Purpose</option>
			</select>
		</label>

		<label class="field">
			<span class="field-label">Tax parcel number (APN)</span>
			<input
				type="text"
				bind:value={apn}
				style={fieldStyle('apn')}
			/>
		</label>

		<label class="field">
			<span class="field-label">Zoning</span>
			<input
				type="text"
				bind:value={zoning}
				style={fieldStyle('zoning')}
			/>
		</label>
	</div>

	<!-- Physical -->
	<h3 class="group-heading">Physical</h3>
	<div class="field-grid">
		<label class="field">
			<span class="field-label">Building SF</span>
			<input
				type="number"
				bind:value={building_sf}
				style={fieldStyle('building_sf')}
			/>
		</label>

		<label class="field">
			<span class="field-label">Land area (acres)</span>
			<input
				type="number"
				bind:value={land_acres}
				style={fieldStyle('land_acres')}
			/>
		</label>

		<label class="field">
			<span class="field-label">Land area (SF)</span>
			<input
				type="number"
				bind:value={land_sf}
				style={fieldStyle('land_sf')}
			/>
		</label>

		<label class="field">
			<span class="field-label">Year built</span>
			<input
				type="number"
				bind:value={year_built}
				style={fieldStyle('year_built')}
			/>
		</label>

		<label class="field">
			<span class="field-label">Stories</span>
			<input
				type="number"
				bind:value={stories}
				style={fieldStyle('stories')}
			/>
		</label>

		<label class="field">
			<span class="field-label">Construction class</span>
			<select
				bind:value={construction_class}
				style={fieldStyle('construction_class')}
			>
				<option value="">--</option>
				<option value="A">A</option>
				<option value="B">B</option>
				<option value="C">C</option>
				<option value="D">D</option>
				<option value="S">S</option>
			</select>
		</label>

		<label class="field">
			<span class="field-label">Quality</span>
			<input
				type="text"
				bind:value={quality}
				style={fieldStyle('quality')}
			/>
		</label>

		<label class="field">
			<span class="field-label">Condition</span>
			<input
				type="text"
				bind:value={condition}
				style={fieldStyle('condition')}
			/>
		</label>
	</div>

	<!-- Valuation -->
	<h3 class="group-heading">Valuation</h3>
	<div class="field-grid">
		<label class="field">
			<span class="field-label">Market value (assessed)</span>
			<input
				type="number"
				bind:value={market_value}
				style={fieldStyle('market_value')}
			/>
		</label>
	</div>

	<!-- Ownership -->
	<h3 class="group-heading">Ownership</h3>
	<div class="field-grid">
		<label class="field">
			<span class="field-label">Owner name</span>
			<input
				type="text"
				bind:value={owner_name}
				style={fieldStyle('owner_name')}
			/>
		</label>

		<label class="field">
			<span class="field-label">Acquisition year</span>
			<input
				type="text"
				placeholder="e.g. 2019"
				bind:value={acquisition_date}
				style={fieldStyle('acquisition_date')}
			/>
		</label>
	</div>

	<!-- Occupancy -->
	<h3 class="group-heading">Occupancy</h3>
	<div class="radio-group">
		<label class="radio-label">
			<input type="radio" bind:group={occupancy} value="Owner-occupied" />
			Owner-occupied
		</label>
		<label class="radio-label">
			<input type="radio" bind:group={occupancy} value="Tenant-occupied" />
			Tenant-occupied
		</label>
		<label class="radio-label">
			<input type="radio" bind:group={occupancy} value="Vacant" />
			Vacant
		</label>
	</div>

	<!-- County Data Tables (read-only, from scraper) -->
	{#if countyData}
		<div class="county-data">
			<h3 class="group-heading county-heading">County Records</h3>
			{#if countyData.partial_years}
				<div class="scraper-notice">Year coverage varies across parcels — totals may be partial for some years.</div>
			{/if}

			<!-- Value History -->
			{#if countyData.value_history.length > 0}
				<div class="data-table-section">
					<h4 class="table-heading">Assessed Market Value</h4>
					<table class="data-table">
						<thead>
							<tr>
								<th>Year</th>
								<th>Total Market Value</th>
							</tr>
						</thead>
						<tbody>
							{#each countyData.value_history as row, i (i)}
								<tr>
									<td>{row.year}</td>
									<td class="total">{formatCurrency(row.total)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			<!-- Tax History -->
			{#if countyData.tax_history.length > 0}
				<div class="data-table-section">
					<h4 class="table-heading">Tax History</h4>
					<table class="data-table">
						<thead>
							<tr>
								<th>Year</th>
								<th>General Taxes</th>
								<th>Adjustments</th>
								<th>Net Taxes</th>
							</tr>
						</thead>
						<tbody>
							{#each countyData.tax_history as row, i (i)}
								<tr>
									<td>{row.year}</td>
									<td>{formatCurrency(row.general_tax)}</td>
									<td>{formatCurrency(row.special_tax)}</td>
									<td class="total">{formatCurrency(row.total_tax)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			<!-- Owner History -->
			{#if countyData.owner_history.length > 0}
				<div class="data-table-section">
					<h4 class="table-heading">Owner History</h4>
					<table class="data-table">
						<thead>
							<tr>
								<th>Years</th>
								<th>Owner</th>
							</tr>
						</thead>
						<tbody>
							{#each countyData.owner_history as row, i (i)}
								<tr>
									<td>{row.years}</td>
									<td>{row.name}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			<!-- Deed Transactions -->
			{#if countyData.deeds.length > 0}
				<div class="data-table-section">
					<h4 class="table-heading">Warranty Deeds</h4>
					<table class="data-table">
						<thead>
							<tr>
								<th>Date</th>
								<th>Grantor</th>
								<th>Grantee</th>
								<th>Entry #</th>
							</tr>
						</thead>
						<tbody>
							{#each countyData.deeds as row, i (i)}
								<tr>
									<td>{row.date}</td>
									<td>{row.grantor}</td>
									<td>{row.grantee}</td>
									<td>{row.entry_number}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			<!-- All Appraisal Fields -->
			{#if Object.keys(countyData.appraisal_fields).length > 0}
				<details class="appraisal-details">
					<summary class="table-heading">All Appraisal Fields</summary>
					<table class="data-table kv-table">
						<tbody>
							{#each Object.entries(countyData.appraisal_fields) as [key, value] (key)}
								<tr>
									<td class="kv-key">{key}</td>
									<td>{value}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</details>
			{/if}
		</div>
	{/if}
</div>

<style>
	.step-property-facts {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.scraper-notice {
		font-size: 0.85rem;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		background: #fff8e6;
		color: #8a6d00;
		border-left: 3px solid #e6c200;
	}

	.group-heading {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #888;
		border-bottom: 1px solid #eee;
		padding-bottom: 0.35rem;
	}

	.field-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
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

	.radio-group {
		display: flex;
		gap: 1.25rem;
		flex-wrap: wrap;
	}

	.radio-label {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.9rem;
		color: #333;
		cursor: pointer;
	}

	.radio-label input[type='radio'] {
		accent-color: #555;
	}

	/* County data tables */
	.county-data {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 0.5rem;
	}

	.county-heading {
		color: #1a56db;
		border-bottom-color: #c8d8f0;
	}

	.data-table-section {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.table-heading {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 600;
		color: #555;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.82rem;
	}

	.data-table th {
		text-align: left;
		padding: 0.35rem 0.5rem;
		border-bottom: 2px solid #e0e0e0;
		color: #777;
		font-weight: 500;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.data-table td {
		padding: 0.35rem 0.5rem;
		border-bottom: 1px solid #f0f0f0;
		color: #333;
	}

	.data-table .total {
		font-weight: 600;
	}

	.appraisal-details {
		margin-top: 0.25rem;
	}

	.appraisal-details summary {
		cursor: pointer;
		user-select: none;
	}

	.appraisal-details[open] summary {
		margin-bottom: 0.35rem;
	}

	.kv-table .kv-key {
		font-weight: 500;
		color: #555;
		white-space: nowrap;
		width: 40%;
	}
</style>
