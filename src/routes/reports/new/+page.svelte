<script lang="ts">
	import { goto } from '$app/navigation';
	import { SvelteSet } from 'svelte/reactivity';
	import StepAddress from '$lib/components/wizard/StepAddress.svelte';
	import StepPropertyFacts from '$lib/components/wizard/StepPropertyFacts.svelte';
	import StepReportConfig from '$lib/components/wizard/StepReportConfig.svelte';

	let step = $state(1);
	let creating = $state(false);
	let createError = $state('');

	// Step 1 — Address
	let address = $state('');
	let suite = $state('');
	let city = $state('');
	let zip = $state('');
	let county = $state('');
	let parcel = $state('');
	let scraperLoading = $state(false);
	let scraperError = $state('');
	let countyDataJson = $state('');

	// Step 2 — Property Facts
	let property_type = $state('');
	let apn = $state('');
	let zoning = $state('');
	let building_sf = $state('');
	let land_sf = $state('');
	let land_acres = $state('');
	let market_value = $state('');
	let year_built = $state('');
	let stories = $state('');
	let construction_class = $state('');
	let quality = $state('');
	let condition = $state('');
	let owner_name = $state('');
	let acquisition_date = $state('');
	let occupancy = $state('');
	let scraperFields = $state(new SvelteSet<string>());

	// Step 3 — Report Config
	let report_number = $state('');
	let effective_date = $state(new Date().toISOString().split('T')[0]);
	let client_name = $state('');
	let intended_use = $state('estimate market value');
	let property_rights = $state('fee simple');
	let approaches = $state(['sales_comparison', 'income_cap']);

	// County scraper — fires on Step 1 submit, before advancing to Step 2
	async function fireScraper(): Promise<void> {
		if (!county) return;
		// Parcel-first: if parcel is provided, use it; otherwise require address
		const hasParcel = parcel.trim().length > 0;
		if (!hasParcel && !address.trim()) return;
		scraperLoading = true;
		scraperError = '';
		try {
			let params: URLSearchParams;
			if (hasParcel) {
				params = new URLSearchParams({ parcel: parcel.trim(), county });
			} else {
				params = new URLSearchParams({
					address: address.trim(),
					city: city.trim(),
					county
				});
			}
			const res = await fetch(`/api/county-lookup?${params}`);
			if (res.ok) {
				const result = await res.json();
				if (result.found && result.data) {
					const fields = result.data;
					const filled = new SvelteSet<string>();
					if (fields.apn && !apn) {
						apn = fields.apn;
						filled.add('apn');
					}
					if (fields.year_built && !year_built) {
						year_built = String(fields.year_built);
						filled.add('year_built');
					}
					if (fields.building_sf && !building_sf) {
						building_sf = String(fields.building_sf);
						filled.add('building_sf');
					}
					if (fields.land_acres && !land_acres) {
						land_acres = String(fields.land_acres);
						filled.add('land_acres');
					}
					if (fields.land_sf && !land_sf) {
						land_sf = String(fields.land_sf);
						filled.add('land_sf');
					}
					if (fields.market_value && !market_value) {
						market_value = String(fields.market_value);
						filled.add('market_value');
					}
					if (fields.zoning && !zoning) {
						zoning = fields.zoning;
						filled.add('zoning');
					}
					if (fields.owner_name && !owner_name) {
						owner_name = fields.owner_name;
						filled.add('owner_name');
					}
					if (fields.construction_class && !construction_class) {
						construction_class = fields.construction_class;
						filled.add('construction_class');
					}
					if (fields.quality && !quality) {
						quality = fields.quality;
						filled.add('quality');
					}
					if (fields.acquisition_year && !acquisition_date) {
						acquisition_date = String(fields.acquisition_year);
						filled.add('acquisition_date');
					}
					// Map county property_type_raw to our dropdown values (best-effort)
					if (fields.property_type_raw && !property_type) {
						const raw = fields.property_type_raw.toUpperCase();
						// Order matters — check more specific patterns first
						if (raw.includes('FLEX')) {
							property_type = 'Flex - Office/Warehouse';
						} else if (raw.includes('WAREHOUSE') || raw.includes('WHSE') || raw.includes('INDUSTRIAL')) {
							property_type = 'Industrial/Warehouse';
						} else if (raw.includes('OFFICE')) {
							property_type = 'Office';
						} else if (raw.includes('RETAIL') || raw.includes('SHOPPING') || raw.includes('RESTAURANT') || raw.includes('FAST FOOD')) {
							property_type = 'Retail';
						} else if (raw.includes('APARTMENT') || raw.includes('MULTI') || raw.includes('DUPLEX') || raw.includes('TRIPLEX') || raw.includes('FOURPLEX') || raw.includes('PLEX')) {
							property_type = 'Multi-Family';
						} else if (raw.includes('HOTEL') || raw.includes('MOTEL') || raw.includes('HOSPITALITY') || raw.includes('LODGING')) {
							property_type = 'Hospitality';
						} else if (raw.includes('STORAGE')) {
							property_type = 'Self-Storage';
						} else if (raw.includes('VACANT') || raw.includes('LAND')) {
							property_type = 'Land';
						}
						// Unmapped types (generic "COMMERCIAL", etc.) left empty for manual selection
						if (property_type) filled.add('property_type');
					}
					scraperFields = filled;
					// Store raw county data JSON blob
					if (result.county_data) {
						countyDataJson = JSON.stringify(result.county_data);
					}
				} else {
					scraperError = 'County record not found for this address — enter details manually';
				}
			} else {
				scraperError = 'County lookup unavailable — enter details manually';
			}
		} catch {
			scraperError = 'County lookup unavailable — enter details manually';
		} finally {
			scraperLoading = false;
		}
	}

	// Navigation
	function canAdvance(): boolean {
		if (step === 1) {
			if (scraperLoading) return false;
			const hasParcel = parcel.trim() !== '' && county !== '';
			const hasAddress = address.trim() !== '' && city.trim() !== '';
			return hasParcel || hasAddress;
		}
		if (step === 2) return true;
		if (step === 3) return approaches.length > 0;
		return false;
	}

	async function nextStep() {
		if (!canAdvance() || step >= 3) return;
		if (step === 1) {
			// Fire scraper before advancing — await result, then move to Step 2
			await fireScraper();
		}
		step++;
	}

	function prevStep() {
		if (step > 1) step--;
	}

	// Create report
	async function handleCreateReport() {
		if (creating || approaches.length === 0) return;
		creating = true;
		createError = '';

		try {
			const res = await fetch('/reports', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					property: {
						address: address.trim(),
						city: city.trim(),
						state: 'UT',
						zip: zip.trim() || undefined,
						apn: apn.trim() || undefined,
						property_type: property_type || undefined,
						year_built: year_built ? Number(year_built) : undefined,
						building_sf: building_sf ? Number(building_sf) : undefined,
						land_sf: land_sf ? Number(land_sf) : undefined,
						land_acres: land_acres ? Number(land_acres) : undefined,
						market_value: market_value ? Number(market_value) : undefined,
						stories: stories ? Number(stories) : undefined,
						construction_class: construction_class || undefined,
						quality: quality.trim() || undefined,
						condition: condition.trim() || undefined,
						zoning: zoning.trim() || undefined,
						county: county || undefined,
						owner_name: owner_name.trim() || undefined,
						acquisition_date: acquisition_date || undefined,
						occupancy: occupancy || undefined,
						county_data_json: countyDataJson || undefined
					},
					report_number: report_number.trim() || undefined,
					effective_date: effective_date || undefined,
					client_name: client_name.trim() || undefined,
					intended_use: intended_use.trim() || undefined,
					property_rights: property_rights || undefined,
					approaches
				})
			});

			if (res.ok) {
				const data = await res.json();
				goto(`/reports/${data.id}`);
			} else {
				const err = await res.json().catch(() => null);
				createError = err?.error || 'Failed to create report';
				creating = false;
			}
		} catch {
			createError = 'Failed to create report';
			creating = false;
		}
	}
</script>

<svelte:head>
	<title>CRE Copilot — New Report</title>
</svelte:head>

<h1>New Appraisal Report</h1>

<div class="wizard">
	<!-- Stepper: 3 circles in a row -->
	<div class="stepper">
		{#each [
			{ num: 1, label: 'Address' },
			{ num: 2, label: 'Property Facts' },
			{ num: 3, label: 'Report Config' }
		] as s (s.num)}
			<div class="stepper-item" class:active={step === s.num} class:done={step > s.num}>
				<div class="stepper-circle">{step > s.num ? '\u2713' : s.num}</div>
				<span class="stepper-label">{s.label}</span>
			</div>
			{#if s.num < 3}<div class="stepper-line" class:done={step > s.num}></div>{/if}
		{/each}
	</div>

	<!-- Step content -->
	<div class="step-content">
		{#if step === 1}
			<StepAddress
				bind:address
				bind:suite
				bind:city
				bind:zip
				bind:county
				bind:parcel
				state="UT"
			/>
		{:else if step === 2}
			<StepPropertyFacts
				bind:property_type
				bind:apn
				bind:zoning
				bind:building_sf
				bind:land_sf
				bind:land_acres
				bind:market_value
				bind:year_built
				bind:stories
				bind:construction_class
				bind:quality
				bind:condition
				bind:owner_name
				bind:acquisition_date
				bind:occupancy
				{scraperFields}
				{scraperError}
				{countyDataJson}
			/>
		{:else if step === 3}
			<StepReportConfig
				bind:report_number
				bind:effective_date
				bind:client_name
				bind:intended_use
				bind:property_rights
				bind:approaches
			/>
		{/if}
	</div>

	<!-- Navigation -->
	<div class="wizard-nav">
		{#if step > 1}
			<button class="btn btn-secondary" onclick={prevStep}>Back</button>
		{:else}
			<div></div>
		{/if}
		{#if step < 3}
			<button class="btn" onclick={nextStep} disabled={!canAdvance()}>
				{scraperLoading ? 'Looking up county records...' : 'Next'}
			</button>
		{:else}
			<div class="create-col">
				{#if createError}
					<span class="create-error">{createError}</span>
				{/if}
				<button
					class="btn btn-primary"
					onclick={handleCreateReport}
					disabled={creating || approaches.length === 0}
				>
					{creating ? 'Creating...' : 'Create Report'}
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	h1 {
		margin: 0 0 1.5rem 0;
		font-size: 1.5rem;
	}

	.wizard {
		max-width: 680px;
	}

	.stepper {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0;
		margin-bottom: 1.5rem;
	}

	.stepper-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
	}

	.stepper-circle {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: #e8e8e8;
		color: #888;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.stepper-item.active .stepper-circle {
		background: #1a1a2e;
		color: #fff;
	}

	.stepper-item.done .stepper-circle {
		background: #28a745;
		color: #fff;
	}

	.stepper-label {
		font-size: 0.75rem;
		color: #888;
	}

	.stepper-item.active .stepper-label {
		color: #1a1a2e;
		font-weight: 600;
	}

	.stepper-line {
		width: 3rem;
		height: 2px;
		background: #e8e8e8;
		margin: 0 0.5rem;
		margin-bottom: 1.2rem;
	}

	.stepper-line.done {
		background: #28a745;
	}

	.step-content {
		background: #fff;
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 1rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	.wizard-nav {
		display: flex;
		justify-content: space-between;
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

	.btn-secondary {
		background: #e8e8e8;
		color: #333;
	}

	.btn-primary {
		background: #1a1a2e;
	}

	.create-col {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.5rem;
	}

	.create-error {
		font-size: 0.85rem;
		color: #c0392b;
	}
</style>
