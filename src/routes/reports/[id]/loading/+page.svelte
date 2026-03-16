<script lang="ts">
	import { goto } from '$app/navigation';

	let { data } = $props();
	const reportId = data.report.id;

	interface Task {
		id: string;
		label: string;
		state: 'pending' | 'running' | 'done' | 'failed';
		detail: string;
		error?: string;
		startedAt?: number;
		completedAt?: number;
	}

	interface Summary {
		success: number;
		failed: number;
		failedTasks: Array<{ label: string; error: string }>;
		subsectionsRendered: number;
		needsInput: string[];
	}

	let tasks = $state<Task[]>([]);
	let settled = $state(false);
	let summary = $state<Summary | null>(null);
	let noTasks = $state(false);
	let retrying = $state(false);

	// Tick counter to keep elapsed timers live for running tasks
	let tick = $state(0);

	$effect(() => {
		const hasRunning = tasks.some(t => t.state === 'running');
		if (!hasRunning) return;
		const timer = setInterval(() => { tick++; }, 500);
		return () => clearInterval(timer);
	});

	const completedCount = $derived(tasks.filter(t => t.state === 'done' || t.state === 'failed').length);
	const totalCount = $derived(tasks.length);

	function elapsed(task: Task): string {
		void tick; // reactive dependency — forces re-eval every 500ms
		if (!task.startedAt) return 'waiting';
		const end = task.completedAt ?? Date.now();
		const ms = end - task.startedAt;
		return `${(ms / 1000).toFixed(1)}s`;
	}

	function stateIcon(state: Task['state']): string {
		switch (state) {
			case 'pending': return '\u25CB';
			case 'running': return '\u25CF';
			case 'done': return '\u2713';
			case 'failed': return '\u2717';
		}
	}

	// SSE connection
	$effect(() => {
		const source = new EventSource(`/api/report-tasks/${reportId}`);

		source.onmessage = (e) => {
			try {
				const event = JSON.parse(e.data);
				if (event.type === 'snapshot' || event.type === 'update') {
					tasks = event.tasks;
					settled = event.settled;
				}
				if (event.type === 'summary') {
					summary = event;
				}
				if (event.type === 'no_tasks') {
					noTasks = true;
				}
			} catch { /* ignore parse errors */ }
		};

		source.onerror = () => {
			// Browser will auto-reconnect
		};

		return () => source.close();
	});

	async function handleRetry() {
		retrying = true;
		try {
			const res = await fetch(`/api/report-tasks/${reportId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'retry' })
			});
			if (res.ok) {
				settled = false;
				summary = null;
				noTasks = false;
			}
		} finally {
			retrying = false;
		}
	}

	async function handleRerun() {
		retrying = true;
		try {
			const res = await fetch(`/api/report-tasks/${reportId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'rerun' })
			});
			if (res.ok) {
				settled = false;
				summary = null;
				noTasks = false;
			}
		} finally {
			retrying = false;
		}
	}

	function openReport() {
		goto(`/reports/${reportId}`);
	}
</script>

<svelte:head>
	<title>CRE Copilot — Preparing Report</title>
</svelte:head>

<div class="loading-page">
	<div class="loading-card">
		{#if noTasks && tasks.length === 0}
			<!-- No tasks found (server restart / direct nav) -->
			<div class="card-header">
				<h1>Report Tasks Not Found</h1>
				<p class="subtitle">
					{data.report.subject_address}, {data.report.subject_city}
				</p>
			</div>
			<p class="no-tasks-msg">Task state was lost (server may have restarted). You can re-run automations or open the report directly.</p>
			<div class="actions">
				<button class="btn btn-secondary" onclick={handleRerun} disabled={retrying}>
					{retrying ? 'Starting...' : 'Re-run Automations'}
				</button>
				<button class="btn btn-primary" onclick={openReport}>
					Open Report
				</button>
			</div>
		{:else if settled && summary}
			<!-- Pre-flight summary -->
			<div class="card-header">
				<h1>Report Ready</h1>
				<p class="subtitle">
					{data.report.subject_address}, {data.report.subject_city}
				</p>
			</div>

			<div class="summary-grid">
				{#if summary.subsectionsRendered > 0}
					<div class="summary-item success">
						<span class="summary-icon">{'\u2713'}</span>
						<span>{summary.subsectionsRendered} subsections auto-generated</span>
					</div>
				{/if}
				{#if summary.success > 0}
					<div class="summary-item success">
						<span class="summary-icon">{'\u2713'}</span>
						<span>{summary.success} of {totalCount} data sources loaded</span>
					</div>
				{/if}
				{#if summary.failed > 0}
					<div class="summary-item warning">
						<span class="summary-icon">!</span>
						<span>{summary.failed} data source{summary.failed > 1 ? 's' : ''} unavailable</span>
					</div>
					{#each summary.failedTasks as ft}
						<div class="summary-detail">
							{ft.label}: {ft.error}
						</div>
					{/each}
				{/if}
				{#if summary.needsInput.length > 0}
					<div class="summary-item needs-input">
						<span class="summary-icon">{'\u270E'}</span>
						<span>{summary.needsInput.length} sections need your input:</span>
					</div>
					<div class="needs-input-list">
						{summary.needsInput.join(', ')}
					</div>
				{/if}
			</div>

			<div class="actions">
				{#if summary.failed > 0}
					<button class="btn btn-secondary" onclick={handleRetry} disabled={retrying}>
						{retrying ? 'Retrying...' : 'Retry Failed'}
					</button>
				{/if}
				<button class="btn btn-primary" onclick={openReport}>
					Open Report
				</button>
			</div>
		{:else}
			<!-- Loading state: task cards -->
			<div class="card-header">
				<h1>Preparing Report</h1>
				<p class="subtitle">
					{data.report.subject_address}, {data.report.subject_city}
				</p>
			</div>

			<div class="task-list">
				{#each tasks as task (task.id)}
					<div class="task-row" class:pending={task.state === 'pending'} class:running={task.state === 'running'} class:done={task.state === 'done'} class:failed={task.state === 'failed'}>
						<span class="task-icon" class:spin={task.state === 'running'}>{stateIcon(task.state)}</span>
						<span class="task-label">{task.label}</span>
						<span class="task-elapsed">{elapsed(task)}</span>
					</div>
				{/each}
			</div>

			{#if totalCount > 0}
				<div class="progress-bar-container">
					<div class="progress-bar" style="width: {(completedCount / totalCount) * 100}%"></div>
				</div>
				<p class="progress-text">{completedCount} of {totalCount} tasks complete</p>
			{:else}
				<p class="progress-text">Initializing...</p>
			{/if}
		{/if}
	</div>
</div>

<style>
	.loading-page {
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding: 3rem 1rem;
		min-height: 80vh;
	}

	.loading-card {
		background: #fff;
		border-radius: 12px;
		padding: 2rem;
		max-width: 520px;
		width: 100%;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
	}

	.card-header {
		margin-bottom: 1.5rem;
	}

	.card-header h1 {
		margin: 0;
		font-size: 1.25rem;
		color: #1a1a2e;
	}

	.subtitle {
		margin: 0.25rem 0 0;
		font-size: 0.85rem;
		color: #888;
	}

	/* ── Task list ── */
	.task-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 1.25rem;
	}

	.task-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		font-size: 0.85rem;
		transition: background 0.2s;
	}

	.task-row.pending {
		color: #999;
	}

	.task-row.running {
		background: #e3f2fd;
		color: #1565c0;
	}

	.task-row.done {
		color: #2e7d32;
	}

	.task-row.failed {
		background: #fce4ec;
		color: #c62828;
	}

	.task-icon {
		width: 1.25rem;
		text-align: center;
		font-size: 1rem;
		flex-shrink: 0;
	}

	.task-icon.spin {
		animation: pulse 1.2s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	.task-label {
		flex: 1;
	}

	.task-elapsed {
		font-size: 0.75rem;
		font-family: monospace;
		color: #999;
		min-width: 3.5rem;
		text-align: right;
	}

	/* ── Progress bar ── */
	.progress-bar-container {
		height: 4px;
		background: #e8e8e8;
		border-radius: 2px;
		overflow: hidden;
		margin-bottom: 0.5rem;
	}

	.progress-bar {
		height: 100%;
		background: #1a1a2e;
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	.progress-text {
		font-size: 0.8rem;
		color: #999;
		text-align: center;
		margin: 0;
	}

	/* ── Summary ── */
	.summary-grid {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.summary-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		padding: 0.4rem 0;
	}

	.summary-icon {
		width: 1.25rem;
		text-align: center;
		font-weight: 700;
		flex-shrink: 0;
	}

	.summary-item.success {
		color: #2e7d32;
	}

	.summary-item.warning {
		color: #e65100;
	}

	.summary-item.needs-input {
		color: #5d4037;
	}

	.summary-detail {
		font-size: 0.8rem;
		color: #999;
		padding-left: 1.75rem;
	}

	.needs-input-list {
		font-size: 0.8rem;
		color: #888;
		padding-left: 1.75rem;
		line-height: 1.5;
	}

	/* ── No tasks ── */
	.no-tasks-msg {
		font-size: 0.9rem;
		color: #666;
		margin-bottom: 1.5rem;
	}

	/* ── Actions ── */
	.actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		padding-top: 0.5rem;
		border-top: 1px solid #f0f0f0;
	}

	.btn {
		padding: 0.55rem 1.25rem;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 500;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background: #1a1a2e;
		color: #fff;
	}

	.btn-primary:hover:not(:disabled) {
		background: #2a2a4e;
	}

	.btn-secondary {
		background: #e8e8e8;
		color: #333;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #ddd;
	}
</style>
