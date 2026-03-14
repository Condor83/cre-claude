<script lang="ts">
	interface Props {
		address: string;
		suite: string;
		city: string;
		state: string;
		zip: string;
		county: string;
		parcel: string;
	}

	let {
		address = $bindable(),
		suite = $bindable(),
		city = $bindable(),
		state = 'UT',
		zip = $bindable(),
		county = $bindable(),
		parcel = $bindable()
	}: Props = $props();

	const CITY_COUNTY_MAP: Record<string, string> = {
		'payson': 'utah_county', 'provo': 'utah_county', 'orem': 'utah_county',
		'lehi': 'utah_county', 'spanish fork': 'utah_county', 'springville': 'utah_county',
		'american fork': 'utah_county', 'pleasant grove': 'utah_county', 'lindon': 'utah_county',
		'mapleton': 'utah_county', 'salem': 'utah_county', 'santaquin': 'utah_county',
		'saratoga springs': 'utah_county', 'eagle mountain': 'utah_county', 'cedar hills': 'utah_county',
		'highland': 'utah_county', 'alpine': 'utah_county', 'vineyard': 'utah_county',
		'elk ridge': 'utah_county', 'woodland hills': 'utah_county', 'genola': 'utah_county',
		'goshen': 'utah_county', 'lake shore': 'utah_county',
		'salt lake city': 'salt_lake_county', 'murray': 'salt_lake_county',
		'sandy': 'salt_lake_county', 'west jordan': 'salt_lake_county',
		'south jordan': 'salt_lake_county', 'draper': 'salt_lake_county',
		'west valley city': 'salt_lake_county', 'taylorsville': 'salt_lake_county',
		'midvale': 'salt_lake_county', 'cottonwood heights': 'salt_lake_county',
		'holladay': 'salt_lake_county', 'millcreek': 'salt_lake_county',
		'riverton': 'salt_lake_county', 'herriman': 'salt_lake_county',
		'bluffdale': 'salt_lake_county', 'south salt lake': 'salt_lake_county',
		'magna': 'salt_lake_county', 'kearns': 'salt_lake_county',
		'alta': 'salt_lake_county', 'brighton': 'salt_lake_county'
	};

	const COUNTY_LABELS: Record<string, string> = {
		'utah_county': 'Utah County',
		'salt_lake_county': 'Salt Lake County'
	};

	let detectedCounty = $derived(CITY_COUNTY_MAP[city.trim().toLowerCase()] ?? '');
	let countyLabel = $derived(COUNTY_LABELS[detectedCounty] ?? '');
	let cityKnown = $derived(detectedCounty !== '');

	// Sync detected county to parent binding
	$effect(() => {
		if (detectedCounty && detectedCounty !== county) {
			county = detectedCounty;
		}
	});
</script>

<div class="step-address">
	<h2 class="step-title">Subject Property</h2>
	<p class="step-description">Start with the parcel number for the most complete county data lookup.</p>

	<div class="form-row parcel-row">
		<div class="form-group parcel-field">
			<label for="parcel">Parcel Number(s)</label>
			<input
				id="parcel"
				type="text"
				bind:value={parcel}
				placeholder="46:764:0002"
			/>
			<span class="hint">Separate multiple parcels with commas</span>
		</div>
		<div class="form-group county-field">
			<label for="county-select">County</label>
			<select id="county-select" bind:value={county} disabled={cityKnown}>
				<option value="">Select...</option>
				<option value="utah_county">Utah County</option>
				<option value="salt_lake_county">Salt Lake County</option>
			</select>
		</div>
	</div>

	<div class="divider">
		<span class="divider-line"></span>
		<span class="divider-text">or look up by address</span>
		<span class="divider-line"></span>
	</div>

	<div class="form-group">
		<label for="address">Street Address</label>
		<input
			id="address"
			type="text"
			bind:value={address}
			placeholder="123 Main Street"
		/>
	</div>

	<div class="form-row half">
		<div class="form-group">
			<label for="suite">Suite / Unit <span class="optional">(optional)</span></label>
			<input
				id="suite"
				type="text"
				bind:value={suite}
				placeholder="Suite 200"
			/>
		</div>
	</div>

	<div class="form-row city-state-zip">
		<div class="form-group city">
			<label for="city">City</label>
			<input
				id="city"
				type="text"
				bind:value={city}
				placeholder="Provo"
			/>
		</div>
		<div class="form-group state-field">
			<label for="state">State</label>
			<input
				id="state"
				type="text"
				value={state}
				disabled
			/>
		</div>
		<div class="form-group zip-field">
			<label for="zip">Zip</label>
			<input
				id="zip"
				type="text"
				bind:value={zip}
				placeholder="84601"
				maxlength="10"
			/>
		</div>
	</div>

	{#if city.trim().length > 0 && !cityKnown}
		<span class="county-unknown">County not auto-detected — select above</span>
	{/if}

</div>

<style>
	.step-address {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.step-title {
		margin: 0;
		font-size: 1.1rem;
		color: #1a1a2e;
		font-weight: 600;
	}

	.step-description {
		margin: -0.5rem 0 0.25rem;
		font-size: 0.85rem;
		color: #888;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.form-group label {
		font-size: 0.8rem;
		font-weight: 500;
		color: #555;
	}

	.optional {
		font-weight: 400;
		color: #aaa;
	}

	.form-group input {
		padding: 0.5rem 0.65rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 0.9rem;
		background: #fff;
		color: #1a1a2e;
		transition: border-color 0.15s ease;
	}

	.form-group input:focus {
		outline: none;
		border-color: #1a1a2e;
	}

	.form-group input:disabled {
		background: #f5f5f5;
		color: #999;
		cursor: not-allowed;
	}

	.form-row.half {
		max-width: 50%;
	}

	.form-row.city-state-zip {
		display: flex;
		gap: 0.75rem;
	}

	.form-group.city {
		flex: 3;
	}

	.form-group.state-field {
		flex: 0 0 4.5rem;
	}

	.form-group.zip-field {
		flex: 0 0 6rem;
	}

	.form-row.parcel-row {
		display: flex;
		gap: 0.75rem;
	}

	.form-group.parcel-field {
		flex: 1;
	}

	.form-group.county-field {
		flex: 0 0 10rem;
	}

	.form-group select {
		padding: 0.5rem 0.65rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 0.9rem;
		background: #fff;
		color: #1a1a2e;
		transition: border-color 0.15s ease;
	}

	.form-group select:focus {
		outline: none;
		border-color: #1a1a2e;
	}

	.form-group select:disabled {
		background: #f5f5f5;
		color: #999;
		cursor: not-allowed;
	}

	.county-unknown {
		font-size: 0.8rem;
		color: #aaa;
		font-style: italic;
	}

	.hint {
		font-size: 0.75rem;
		color: #aaa;
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 0.25rem 0;
	}

	.divider-line {
		flex: 1;
		height: 1px;
		background: #e0e0e0;
	}

	.divider-text {
		font-size: 0.8rem;
		color: #aaa;
		white-space: nowrap;
	}

</style>
