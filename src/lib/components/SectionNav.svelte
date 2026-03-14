<script lang="ts">
	import type { SectionGroup, SectionStatus } from '$lib/config/sections';
	import { GROUP_LABELS, GROUP_ORDER } from '$lib/config/sections';

	interface Section {
		key: string;
		label: string;
		group: string;
		tier: string;
	}

	interface Props {
		sections: Section[];
		activeSection: string;
		sectionStatuses: Record<string, SectionStatus>;
		onselect: (key: string) => void;
	}

	let { sections, activeSection, sectionStatuses, onselect }: Props = $props();

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

	function getStatusColor(key: string): { fill: string; stroke: string; filled: boolean } {
		const status = sectionStatuses[key] ?? 'empty';
		switch (status) {
			case 'reviewed':
				return { fill: '#28a745', stroke: '#28a745', filled: true };
			case 'auto_generated':
				return { fill: '#007bff', stroke: '#007bff', filled: true };
			case 'in_progress':
				return { fill: '#f0ad4e', stroke: '#f0ad4e', filled: true };
			default:
				return { fill: 'none', stroke: '#999', filled: false };
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
					{@const statusInfo = getStatusColor(section.key)}
					{@const tierBadge = getTierBadge(section.tier)}
					<button
						class="nav-item"
						class:active={activeSection === section.key}
						onclick={() => onselect(section.key)}
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
</style>
