<script lang="ts">
	interface Section {
		key: string;
		label: string;
	}

	interface Props {
		sections: Section[];
		activeSection: string;
		completedSections: string[];
		onselect: (key: string) => void;
	}

	let { sections, activeSection, completedSections, onselect }: Props = $props();
</script>

<nav class="section-nav">
	{#each sections as section}
		<button
			class="nav-item"
			class:active={activeSection === section.key}
			class:completed={completedSections.includes(section.key)}
			onclick={() => onselect(section.key)}
		>
			<span class="nav-indicator">
				{#if completedSections.includes(section.key)}
					&#10003;
				{:else}
					&#9675;
				{/if}
			</span>
			<span class="nav-label">{section.label}</span>
		</button>
	{/each}
</nav>

<style>
	.section-nav {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		flex: 1;
		overflow-y: auto;
	}

	.nav-item {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.4rem 0.5rem;
		border: none;
		background: none;
		text-align: left;
		cursor: pointer;
		border-radius: 4px;
		font-size: 0.8rem;
		color: #666;
		line-height: 1.3;
	}

	.nav-item:hover {
		background: #f5f5f5;
	}

	.nav-item.active {
		background: #e8e8f0;
		color: #1a1a2e;
		font-weight: 600;
	}

	.nav-item.completed .nav-indicator {
		color: #28a745;
	}

	.nav-indicator {
		flex-shrink: 0;
		width: 1rem;
		text-align: center;
		font-size: 0.75rem;
	}

	.nav-label {
		flex: 1;
	}
</style>
