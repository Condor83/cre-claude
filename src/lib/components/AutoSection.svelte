<script lang="ts">
	interface Props {
		html: string;
		sectionKey: string;
		reportId: number;
		status?: string;
		onOverride: () => void;
		onRegenerate: () => void;
		dataSource?: string;
		dataAge?: number | null;
		onRefreshData?: () => void;
	}

	let { html, sectionKey, reportId, status = 'auto_generated', onOverride, onRegenerate, dataSource, dataAge, onRefreshData }: Props = $props();

	const isReviewed = $derived(status === 'reviewed');

	let regenerating = $state(false);
	let refreshing = $state(false);

	const freshnessColor = $derived(
		dataAge == null ? 'red' :
		dataAge < 30 ? 'green' :
		dataAge < 180 ? 'amber' : 'red'
	);

	const freshnessLabel = $derived(
		dataAge == null ? 'No data' :
		dataAge < 1 ? 'Data: today' :
		`Data: ${Math.round(dataAge)}d old`
	);

	async function handleRefresh() {
		if (!onRefreshData) return;
		refreshing = true;
		try {
			onRefreshData();
		} finally {
			setTimeout(() => { refreshing = false; }, 2000);
		}
	}

	async function handleRegenerate() {
		regenerating = true;
		try {
			onRegenerate();
		} finally {
			// Brief visual feedback — parent handles the actual fetch
			setTimeout(() => { regenerating = false; }, 500);
		}
	}
</script>

<div class="auto-section" class:reviewed={isReviewed}>
	<div class="auto-header">
		{#if isReviewed}
			<span class="reviewed-badge">Reviewed</span>
		{:else}
			<span class="auto-badge">Auto</span>
		{/if}
		{#if dataSource}
			<div class="freshness-indicator">
				<span class="freshness-dot" class:green={freshnessColor === 'green'} class:amber={freshnessColor === 'amber'} class:red={freshnessColor === 'red'}></span>
				<span class="freshness-label">{freshnessLabel}</span>
			</div>
		{/if}
		<div class="header-actions">
			{#if dataSource && onRefreshData}
				<button class="action-btn refresh-btn" onclick={handleRefresh} disabled={refreshing}>
					{refreshing ? 'Refreshing...' : 'Refresh Data'}
				</button>
			{/if}
			<button class="action-btn" onclick={handleRegenerate} disabled={regenerating}>
				{regenerating ? 'Regenerating...' : 'Regenerate'}
			</button>
			<button class="action-btn" onclick={onOverride}>
				Edit
			</button>
		</div>
	</div>
	<div class="auto-content">
		{@html html}
	</div>
</div>

<style>
	.auto-section {
		position: relative;
		background: #fff;
		border: 1px solid #ddd;
		border-left: 3px solid #4caf50;
		border-radius: 8px;
		overflow: hidden;
	}

	.auto-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 1rem;
		background: #fafafa;
		border-bottom: 1px solid #eee;
	}

	.header-actions {
		display: flex;
		gap: 0.5rem;
	}

	.auto-section.reviewed {
		border-left-color: #28a745;
	}

	.reviewed-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.15rem 0.6rem;
		background: #d4edda;
		color: #155724;
		font-size: 0.75rem;
		font-weight: 600;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		border-radius: 4px;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.auto-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.15rem 0.6rem;
		background: #e8f5e9;
		color: #2e7d32;
		font-size: 0.75rem;
		font-weight: 600;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		border-radius: 4px;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.action-btn {
		padding: 0.3rem 0.75rem;
		background: transparent;
		color: #666;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.8rem;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.action-btn:hover:not(:disabled) {
		background: #f5f5f5;
		color: #333;
		border-color: #ccc;
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.auto-content {
		padding: 1.5rem;
		font-family: 'Times New Roman', Georgia, serif;
		font-size: 1rem;
		line-height: 1.6;
		color: #333;
	}

	:global(.auto-content p) {
		margin: 0 0 0.75rem 0;
	}

	:global(.auto-content h1),
	:global(.auto-content h2),
	:global(.auto-content h3) {
		margin: 1rem 0 0.5rem;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	:global(.auto-content ul),
	:global(.auto-content ol) {
		margin: 0 0 0.75rem 0;
		padding-left: 1.5rem;
	}

	:global(.auto-content table) {
		width: 100%;
		border-collapse: collapse;
		margin: 0.75rem 0;
	}

	:global(.auto-content th),
	:global(.auto-content td) {
		border: 1px solid #ddd;
		padding: 0.4rem 0.6rem;
		text-align: left;
	}

	:global(.auto-content th) {
		background: #f9f9f9;
		font-weight: 600;
	}

	.freshness-indicator {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin-left: auto;
		margin-right: 0.5rem;
	}

	.freshness-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}

	.freshness-dot.green { background: #4caf50; }
	.freshness-dot.amber { background: #ff9800; }
	.freshness-dot.red { background: #f44336; }

	.freshness-label {
		font-size: 0.7rem;
		color: #888;
	}

	.refresh-btn {
		color: #1565c0 !important;
		border-color: #90caf9 !important;
	}

	.refresh-btn:hover:not(:disabled) {
		background: #e3f2fd !important;
	}
</style>
