<script lang="ts">
	import GuidedSubsection from './GuidedSubsection.svelte';
	import type { SectionImage } from '$lib/db/index.js';
	import { COMP_SUBSECTIONS } from '$lib/config/sections.js';

	interface Props {
		comp: Record<string, unknown>;
		reportId: number;
		activeSubsection: string | null;
		images: SectionImage[];
		onSave: (subsectionKey: string, html: string, formData?: Record<string, unknown>) => void;
	}

	let { comp, reportId, activeSubsection, images, onSave }: Props = $props();

	const compId = $derived(comp.id as number);
	const compAddress = $derived(comp.address as string);
	const compRank = $derived(comp.rank as number);

	// Parse stored form_data
	function getSubsectionHtmls(): Record<string, string> {
		const fd = comp.form_data as string | null;
		if (!fd) return {};
		try {
			const parsed = JSON.parse(fd);
			return parsed._subsection_htmls ?? {};
		} catch { return {}; }
	}

	function getSubsectionFormData(key: string): Record<string, unknown> {
		const fd = comp.form_data as string | null;
		if (!fd) return {};
		try {
			const parsed = JSON.parse(fd);
			return parsed._subsection_form_data?.[key] ?? {};
		} catch { return {}; }
	}

	const subsectionHtmls = $derived(getSubsectionHtmls());
	const activeSub = $derived(COMP_SUBSECTIONS.find(s => s.key === activeSubsection) ?? COMP_SUBSECTIONS[0]);

	// Sale summary form fields (for comp_sale subsection)
	function getSaleFormData(): Record<string, unknown> {
		return {
			sale_price: comp.sale_price ?? '',
			sale_date: comp.sale_date ?? '',
			price_per_sf: comp.price_per_sf ?? '',
			grantor: comp.grantor ?? '',
			grantee: comp.grantee ?? '',
			financing: comp.financing ?? '',
			confidence: comp.sale_confidence ?? 'unverified',
		};
	}

	async function handleSave(html: string, formData?: Record<string, unknown>) {
		if (activeSubsection) {
			onSave(activeSubsection, html, formData);
		}
	}
</script>

<div class="comp-page">
	<div class="comp-header">
		<h2>Comparable {compRank}: {compAddress}</h2>
		{#if activeSub}
			<span class="subsection-breadcrumb">/ {activeSub.label}</span>
		{/if}
	</div>

	{#if activeSubsection === 'comp_sale'}
		{@const saleData = getSaleFormData()}
		<div class="sale-form">
			<div class="form-row">
				<label class="form-field">
					<span class="form-label">Sale Price</span>
					<div class="price-input">
						<span class="prefix">$</span>
						<input type="number" value={saleData.sale_price} placeholder="0" onblur={(e) => {
							const val = e.currentTarget.value;
							handleSave(`<p>Sale Price: $${Number(val).toLocaleString()}</p>`, { ...saleData, sale_price: val });
						}} />
					</div>
				</label>
				<label class="form-field">
					<span class="form-label">Sale Date</span>
					<input type="date" value={saleData.sale_date} onblur={(e) => {
						handleSave('', { ...saleData, sale_date: e.currentTarget.value });
					}} />
				</label>
			</div>
			<div class="form-row">
				<label class="form-field">
					<span class="form-label">Grantor (Seller)</span>
					<input type="text" value={saleData.grantor} placeholder="Seller name" onblur={(e) => {
						handleSave('', { ...saleData, grantor: e.currentTarget.value });
					}} />
				</label>
				<label class="form-field">
					<span class="form-label">Grantee (Buyer)</span>
					<input type="text" value={saleData.grantee} placeholder="Buyer name" onblur={(e) => {
						handleSave('', { ...saleData, grantee: e.currentTarget.value });
					}} />
				</label>
			</div>
			<div class="form-row">
				<label class="form-field">
					<span class="form-label">Financing</span>
					<input type="text" value={saleData.financing} placeholder="e.g. Conventional" onblur={(e) => {
						handleSave('', { ...saleData, financing: e.currentTarget.value });
					}} />
				</label>
				<label class="form-field">
					<span class="form-label">
						Verification
						{#if true}
							{@const conf = String(saleData.confidence ?? 'unverified')}
							<span class="confidence-badge" class:verified={conf === 'verified'} class:estimated={conf === 'estimated'} class:unverified={conf === 'unverified'}>
								{conf === 'verified' ? 'Verified' : conf === 'estimated' ? 'Estimated' : 'Unverified'}
							</span>
						{/if}
					</span>
					<select value={saleData.confidence} onchange={(e) => {
						handleSave('', { ...saleData, confidence: e.currentTarget.value });
					}}>
						<option value="unverified">Unverified</option>
						<option value="estimated">Estimated (lien-based)</option>
						<option value="verified">Verified</option>
					</select>
				</label>
			</div>
		</div>
	{:else if activeSub}
		<!-- Delegate to GuidedSubsection for auto/freeform/image tiers -->
		{#key `comp_${compId}_${activeSubsection}`}
			<GuidedSubsection
				subsection={activeSub}
				parentSectionKey={`comp_${compId}`}
				{reportId}
				html={subsectionHtmls[activeSubsection ?? ''] ?? ''}
				status="in_progress"
				{images}
				formData={getSubsectionFormData(activeSubsection ?? '')}
				onSave={handleSave}
				onRegenerate={() => {}}
			/>
		{/key}
	{/if}
</div>

<style>
	.comp-page { padding: 0; }
	.comp-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
	.comp-header h2 { margin: 0; font-size: 1.15rem; }
	.subsection-breadcrumb { font-size: 0.95rem; color: #888; }

	.sale-form { display: flex; flex-direction: column; gap: 0.75rem; }
	.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
	.form-field { display: flex; flex-direction: column; gap: 0.2rem; }
	.form-label { font-size: 0.8rem; color: #555; font-weight: 500; display: flex; align-items: center; gap: 0.4rem; }
	.form-field input, .form-field select { padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem; }
	.form-field input:focus, .form-field select:focus { outline: none; border-color: #999; }

	.price-input { display: flex; align-items: center; gap: 0.2rem; }
	.prefix { color: #888; font-weight: 500; }
	.price-input input { flex: 1; }

	.confidence-badge { font-size: 0.65rem; font-weight: 700; padding: 0.1rem 0.35rem; border-radius: 99px; }
	.confidence-badge.verified { background: #d4edda; color: #155724; }
	.confidence-badge.estimated { background: #fff3cd; color: #856404; }
	.confidence-badge.unverified { background: #f8d7da; color: #721c24; }
</style>
