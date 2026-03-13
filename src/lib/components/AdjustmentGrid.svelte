<script lang="ts">
	interface Comp {
		id: number;
		address: string;
		city: string;
		building_sf: number;
		year_built: number;
		sale_price: number;
		price_per_sf: number;
		sale_cap_rate: number;
		sale_mls_sourced: boolean;
		lease_mls_sourced: boolean;
		adjustment_json: string;
		comp_type: string;
	}

	interface Props {
		comps: Comp[];
		reportId: number;
	}

	let { comps, reportId }: Props = $props();

	const ADJUSTMENT_ROWS = [
		{ key: 'property_rights', label: 'Property Rights' },
		{ key: 'terms_of_sale', label: 'Terms of Sale' },
		{ key: 'conditions_of_sale', label: 'Conditions of Sale' },
		{ key: 'market_conditions', label: 'Market Conditions (Date)' },
		{ key: 'location', label: 'Location' },
		{ key: 'quality', label: 'Quality' },
		{ key: 'age_condition', label: 'Age/Condition' },
		{ key: 'size', label: 'Size' },
		{ key: 'retail_office_pct', label: '% Retail/Office' },
		{ key: 'clear_height', label: 'Clear Height' },
		{ key: 'building_land_ratio', label: 'Building-to-Land Ratio' },
		{ key: 'site_improvements', label: 'Site Improvements' },
		{ key: 'other', label: 'Other/Mezzanine' }
	];

	// Parse existing adjustment data
	function getAdjustments(comp: Comp): Record<string, number> {
		try {
			return comp.adjustment_json ? JSON.parse(comp.adjustment_json) : {};
		} catch {
			return {};
		}
	}

	let adjustments = $state<Record<number, Record<string, number>>>({});

	$effect(() => {
		adjustments = Object.fromEntries(comps.map((c) => [c.id, getAdjustments(c)]));
	});

	function setAdjustment(compId: number, key: string, value: string) {
		const numVal = parseFloat(value) || 0;
		if (!adjustments[compId]) adjustments[compId] = {};
		adjustments[compId][key] = numVal;
	}

	function getNetAdjustment(compId: number): number {
		const adj = adjustments[compId] ?? {};
		return Object.values(adj).reduce((sum, v) => sum + v, 0);
	}

	function getGrossAdjustment(compId: number): number {
		const adj = adjustments[compId] ?? {};
		return Object.values(adj).reduce((sum, v) => sum + Math.abs(v), 0);
	}

	function getAdjustedPrice(comp: Comp): number {
		const basePsf = comp.price_per_sf ?? 0;
		const net = getNetAdjustment(comp.id);
		return basePsf + (basePsf * net / 100);
	}

	async function saveAdjustments(compId: number) {
		await fetch(`/reports/${reportId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'update_comp',
				comp_id: compId,
				adjustment_json: JSON.stringify(adjustments[compId] ?? {})
			})
		});
	}

	function isMlsSourced(comp: Comp): boolean {
		return !!(comp.sale_mls_sourced || comp.lease_mls_sourced);
	}

	function isStale(comp: Comp): boolean {
		// Check if sale is older than 24 months
		// Using a simple check based on the comp data available
		return false; // Would need sale_date to implement
	}
</script>

{#if comps.length === 0}
	<div class="empty">
		<p>No comps selected. Use "Manage Comps" to add comparables.</p>
	</div>
{:else}
	<div class="grid-wrapper">
		<h3>Adjustment Grid</h3>
		<div class="grid-scroll">
			<table class="adjustment-grid">
				<thead>
					<tr>
						<th class="row-label">Adjustment Factor</th>
						{#each comps as comp, i}
							<th class="comp-header">
								<span class="comp-num">Comp {i + 1}</span>
								<span class="comp-addr">{comp.address}</span>
								{#if isMlsSourced(comp)}
									<span class="mls-badge" title="MLS-sourced: review before publishing">MLS</span>
								{/if}
							</th>
						{/each}
					</tr>
					<tr class="base-row">
						<td class="row-label">Sale Price/SF</td>
						{#each comps as comp}
							<td class="value-cell">${comp.price_per_sf?.toFixed(2) ?? 'N/A'}</td>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each ADJUSTMENT_ROWS as row}
						<tr>
							<td class="row-label">{row.label}</td>
							{#each comps as comp}
								<td class="input-cell">
									<input
										type="number"
										step="0.5"
										value={adjustments[comp.id]?.[row.key] ?? ''}
										oninput={(e) => setAdjustment(comp.id, row.key, e.currentTarget.value)}
										onblur={() => saveAdjustments(comp.id)}
										placeholder="0"
									/>
									<span class="unit">%</span>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr class="total-row">
						<td class="row-label">Net Adjustment</td>
						{#each comps as comp}
							<td class="value-cell" class:negative={getNetAdjustment(comp.id) < 0}>
								{getNetAdjustment(comp.id).toFixed(1)}%
							</td>
						{/each}
					</tr>
					<tr class="total-row">
						<td class="row-label">Gross Adjustment</td>
						{#each comps as comp}
							<td class="value-cell">{getGrossAdjustment(comp.id).toFixed(1)}%</td>
						{/each}
					</tr>
					<tr class="result-row">
						<td class="row-label">Adjusted Price/SF</td>
						{#each comps as comp}
							<td class="value-cell result">${getAdjustedPrice(comp).toFixed(2)}</td>
						{/each}
					</tr>
				</tfoot>
			</table>
		</div>
	</div>
{/if}

<style>
	.empty {
		text-align: center;
		padding: 1.5rem;
		color: #888;
		background: #f9f9f9;
		border-radius: 8px;
		margin-top: 1.5rem;
	}

	.grid-wrapper {
		margin-top: 2rem;
	}

	.grid-wrapper h3 {
		margin: 0 0 1rem 0;
		font-size: 1.1rem;
	}

	.grid-scroll {
		overflow-x: auto;
	}

	.adjustment-grid {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
		background: #fff;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 1px 3px rgba(0,0,0,0.08);
	}

	th, td {
		padding: 0.4rem 0.6rem;
		border-bottom: 1px solid #eee;
		text-align: right;
	}

	.row-label {
		text-align: left;
		font-weight: 500;
		color: #555;
		min-width: 180px;
		white-space: nowrap;
	}

	thead th {
		background: #f5f5f8;
		font-weight: 600;
	}

	.comp-header {
		min-width: 130px;
		text-align: center;
	}

	.comp-num {
		display: block;
		font-size: 0.75rem;
		color: #888;
	}

	.comp-addr {
		display: block;
		font-size: 0.8rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 140px;
	}

	.mls-badge {
		display: inline-block;
		font-size: 0.65rem;
		padding: 0.1rem 0.3rem;
		background: #fff3cd;
		color: #856404;
		border-radius: 3px;
		margin-top: 0.2rem;
		cursor: help;
	}

	.base-row td {
		font-weight: 600;
		background: #f9f9fc;
	}

	.input-cell {
		position: relative;
		padding: 0.2rem;
	}

	.input-cell input {
		width: 60px;
		padding: 0.25rem 0.4rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		text-align: right;
		font-size: 0.85rem;
	}

	.input-cell input:focus {
		border-color: #1a1a2e;
		outline: none;
	}

	.unit {
		font-size: 0.75rem;
		color: #999;
		margin-left: 0.15rem;
	}

	.total-row td {
		border-top: 2px solid #ddd;
		font-weight: 600;
	}

	.result-row td {
		border-top: 2px solid #333;
		font-weight: 700;
	}

	.value-cell {
		font-variant-numeric: tabular-nums;
	}

	.value-cell.negative {
		color: #dc3545;
	}

	.value-cell.result {
		color: #155724;
		font-size: 0.95rem;
	}
</style>
