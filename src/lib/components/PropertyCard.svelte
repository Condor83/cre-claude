<script lang="ts">
	interface Props {
		property: {
			id: number;
			address: string;
			city: string;
			state: string;
			property_type: string;
			building_sf: number;
			year_built: number;
			apn: string;
			construction_class: string;
			quality: string;
			condition: string;
			zoning: string;
		};
	}

	let { property }: Props = $props();
</script>

<div class="property-card">
	<h3>{property.address}</h3>
	<p class="location">{property.city}, {property.state}</p>
	<div class="details">
		{#if property.property_type}
			<span class="detail"><span class="label">Type:</span> {property.property_type}</span>
		{/if}
		{#if property.building_sf}
			<span class="detail"><span class="label">Size:</span> {property.building_sf.toLocaleString()} SF</span>
		{/if}
		{#if property.year_built}
			<span class="detail"><span class="label">Built:</span> {property.year_built}</span>
		{/if}
		{#if property.apn}
			<span class="detail"><span class="label">APN:</span> {property.apn}</span>
		{/if}
		{#if property.construction_class}
			<span class="detail"><span class="label">Class:</span> {property.construction_class}</span>
		{/if}
		{#if property.zoning}
			<span class="detail"><span class="label">Zoning:</span> {property.zoning}</span>
		{/if}
	</div>
</div>

<style>
	.property-card {
		background: #fff;
		border: 1px solid #eee;
		border-radius: 8px;
		padding: 1rem;
	}

	h3 {
		margin: 0;
		font-size: 0.95rem;
	}

	.location {
		margin: 0.25rem 0 0.75rem;
		font-size: 0.85rem;
		color: #666;
	}

	.details {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.detail {
		font-size: 0.8rem;
		padding: 0.15rem 0.5rem;
		background: #f5f5f5;
		border-radius: 4px;
	}

	.label {
		color: #888;
	}
</style>
