<script lang="ts">
	import { untrack } from 'svelte';
	import type { SectionGroup, SectionStatus, SubsectionDef } from '$lib/config/sections';
	import { GROUP_LABELS, GROUP_ORDER, GUIDED_SUBSECTIONS } from '$lib/config/sections';

	interface Section {
		key: string;
		label: string;
		group: string;
		tier: string;
	}

	interface Props {
		sections: Section[];
		activeSection: string;
		activeSubsection: string | null;
		sectionStatuses: Record<string, SectionStatus>;
		onselect: (key: string) => void;
		onselectsubsection: (sectionKey: string, subsectionKey: string) => void;
	}

	let { sections, activeSection, activeSubsection = null, sectionStatuses, onselect, onselectsubsection }: Props = $props();

	// Track which guided sections have expanded accordions
	let expandedSections = $state<Set<string>>(new Set());

	function toggleAccordion(sectionKey: string) {
		const next = new Set(expandedSections);
		if (next.has(sectionKey)) {
			next.delete(sectionKey);
		} else {
			next.add(sectionKey);
		}
		expandedSections = next;
	}

	// Auto-expand when a guided section is active
	$effect(() => {
		if (activeSection && GUIDED_SUBSECTIONS[activeSection]) {
			const current = untrack(() => expandedSections);
			if (!current.has(activeSection)) {
				const next = new Set(current);
				next.add(activeSection);
				expandedSections = next;
			}
		}
	});

	function getSubsections(sectionKey: string): SubsectionDef[] {
		return GUIDED_SUBSECTIONS[sectionKey] ?? [];
	}

	function hasSubsections(sectionKey: string): boolean {
		return (GUIDED_SUBSECTIONS[sectionKey]?.length ?? 0) > 0;
	}

	function getSubsectionTierBadge(tier: string): { text: string; bg: string; fg: string } {
		switch (tier) {
			case 'auto': return { text: 'AUTO', bg: '#d4edda', fg: '#155724' };
			case 'freeform': return { text: 'EDIT', bg: '#cce5ff', fg: '#004085' };
			case 'form': return { text: 'FORM', bg: '#fff3cd', fg: '#856404' };
			case 'image': return { text: 'IMG', bg: '#e8d5f5', fg: '#6f42c1' };
			default: return { text: '', bg: 'transparent', fg: '#666' };
		}
	}

	let completedCount = $derived(
		sections.filter((s) => (sectionStatuses[s.key] ?? 'empty') !== 'empty').length
	);

	let totalCount = $derived(sections.length);

	let progressPercent = $derived(totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0);

	let groupedSections = $derived.by(() => {
		const groups: { group: string; label: string; sections: Section[] }[] = [];

		for (const groupKey of GROUP_ORDER) {
			const groupSections = sections.filter((s) => s.group === groupKey);
			if (groupSections.length > 0) {
				groups.push({
					group: groupKey,
					label: GROUP_LABELS[groupKey as SectionGroup],
					sections: groupSections
				});
			}
		}

		return groups;
	});

	function getStatusColor(key: string, tier: string): { fill: string; stroke: string; filled: boolean } {
		const status = sectionStatuses[key] ?? 'empty';
		switch (status) {
			case 'reviewed':
				return { fill: '#28a745', stroke: '#28a745', filled: true }; // green — approved
			case 'auto_generated':
			case 'in_progress':
				return { fill: '#007bff', stroke: '#007bff', filled: true }; // blue — has content, not yet approved
			default: {
				// Empty: red for auto/guided sections (should have content), gray for prose/freeform
				const shouldHaveContent = tier === 'auto' || tier === 'guided';
				if (shouldHaveContent) {
					return { fill: '#dc3545', stroke: '#dc3545', filled: true }; // red — missing content
				}
				return { fill: 'none', stroke: '#ccc', filled: false }; // gray outline — awaiting input
			}
		}
	}

	function getTierBadge(tier: string): { text: string; bg: string; fg: string } {
		switch (tier) {
			case 'auto':
				return { text: 'AUTO', bg: '#d4edda', fg: '#155724' };
			case 'guided':
				return { text: 'GUIDED', bg: '#fff3cd', fg: '#856404' };
			case 'prose':
				return { text: 'PROSE', bg: '#cce5ff', fg: '#004085' };
			case 'images':
				return { text: 'IMG', bg: '#e8d5f5', fg: '#6f42c1' };
			case 'upload':
				return { text: 'UPLOAD', bg: '#e2e3e5', fg: '#495057' };
			default:
				return { text: '', bg: 'transparent', fg: '#666' };
		}
	}
</script>

<nav class="section-nav">
	<div class="progress-bar-container">
		<div class="progress-header">
			<span class="progress-label">Completion</span>
			<span class="progress-value">{completedCount}/{totalCount} ({progressPercent}%)</span>
		</div>
		<div class="progress-track">
			<div class="progress-fill" style:width="{progressPercent}%"></div>
		</div>
	</div>

	<div class="sections-list">
		{#each groupedSections as group (group.group)}
			<div class="group">
				<div class="group-header">{group.label}</div>
				{#each group.sections as section (section.key)}
					{@const statusInfo = getStatusColor(section.key, section.tier)}
					{@const tierBadge = getTierBadge(section.tier)}
					{@const isGuided = hasSubsections(section.key)}
					{@const isExpanded = expandedSections.has(section.key)}
					<button
						class="nav-item"
						class:active={activeSection === section.key}
						class:has-subsections={isGuided}
						onclick={() => { onselect(section.key); if (isGuided) toggleAccordion(section.key); }}
					>
						<svg class="status-dot" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
							<circle
								cx="4"
								cy="4"
								r="3"
								fill={statusInfo.fill}
								stroke={statusInfo.stroke}
								stroke-width="1.5"
							/>
						</svg>
						<span class="nav-label">{section.label}</span>
						{#if isGuided}
							<span class="accordion-arrow" class:expanded={isExpanded}>▸</span>
						{/if}
						{#if tierBadge.text}
							<span
								class="tier-badge"
								style:background={tierBadge.bg}
								style:color={tierBadge.fg}
							>
								{tierBadge.text}
							</span>
						{/if}
					</button>
					{#if isGuided}
						<div class="subsection-list" class:collapsed={!isExpanded}>
							{#each getSubsections(section.key) as sub (sub.key)}
								{@const subBadge = getSubsectionTierBadge(sub.tier)}
								<button
									class="nav-sub-item"
									class:active={activeSection === section.key && activeSubsection === sub.key}
									onclick={() => onselectsubsection(section.key, sub.key)}
								>
									<span class="sub-label">{sub.label}</span>
									{#if subBadge.text}
										<span
											class="sub-tier-badge"
											style:background={subBadge.bg}
											style:color={subBadge.fg}
										>
											{subBadge.text}
										</span>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				{/each}
			</div>
		{/each}
	</div>
</nav>

<style>
	.section-nav {
		display: flex;
		flex-direction: column;
		flex: 1;
		overflow: hidden;
		font-size: 0.78rem;
	}

	/* ── Progress bar ── */
	.progress-bar-container {
		padding: 0.6rem 0.75rem;
		border-bottom: 1px solid #e5e5e5;
		flex-shrink: 0;
	}

	.progress-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.3rem;
	}

	.progress-label {
		font-size: 0.7rem;
		font-weight: 600;
		color: #1a1a2e;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.progress-value {
		font-size: 0.7rem;
		color: #666;
		font-variant-numeric: tabular-nums;
	}

	.progress-track {
		width: 100%;
		height: 4px;
		background: #e5e5e5;
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: #28a745;
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	/* ── Scrollable sections list ── */
	.sections-list {
		flex: 1;
		overflow-y: auto;
		padding: 0.25rem 0;
	}

	/* ── Group headers ── */
	.group {
		margin-bottom: 0.15rem;
	}

	.group-header {
		padding: 0.4rem 0.75rem 0.2rem;
		font-size: 0.65rem;
		font-weight: 700;
		color: #1a1a2e;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		user-select: none;
	}

	/* ── Section items ── */
	.nav-item {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		width: 100%;
		padding: 0.25rem 0.75rem;
		border: none;
		background: none;
		text-align: left;
		cursor: pointer;
		border-radius: 0;
		font-size: 0.78rem;
		color: #555;
		line-height: 1.35;
	}

	.nav-item:hover {
		background: #f5f5f5;
	}

	.nav-item.active {
		background: #e8e8f0;
		color: #1a1a2e;
		font-weight: 600;
	}

	/* ── Status dot ── */
	.status-dot {
		flex-shrink: 0;
	}

	/* ── Label ── */
	.nav-label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* ── Tier badge pills ── */
	.tier-badge {
		flex-shrink: 0;
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		padding: 0.08rem 0.3rem;
		border-radius: 3px;
		line-height: 1.4;
		white-space: nowrap;
	}

	/* ── Accordion arrow ── */
	.accordion-arrow {
		flex-shrink: 0;
		font-size: 0.65rem;
		color: #999;
		transition: transform 0.15s ease;
		display: inline-block;
	}

	.accordion-arrow.expanded {
		transform: rotate(90deg);
	}

	.has-subsections .nav-label {
		font-weight: 500;
	}

	/* ── Subsection list ── */
	.subsection-list.collapsed {
		display: none;
	}

	.subsection-list {
		padding-left: 1.2rem;
		border-left: 2px solid #e8e8f0;
		margin-left: 0.9rem;
	}

	.nav-sub-item {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		width: 100%;
		padding: 0.15rem 0.5rem;
		border: none;
		background: none;
		text-align: left;
		cursor: pointer;
		font-size: 0.7rem;
		color: #777;
		line-height: 1.3;
	}

	.nav-sub-item:hover {
		background: #f5f5f5;
		color: #555;
	}

	.nav-sub-item.active {
		background: #e8e8f0;
		color: #1a1a2e;
		font-weight: 600;
	}

	.sub-label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sub-tier-badge {
		flex-shrink: 0;
		font-size: 0.5rem;
		font-weight: 700;
		padding: 0.05rem 0.2rem;
		border-radius: 2px;
		line-height: 1.3;
	}
</style>
