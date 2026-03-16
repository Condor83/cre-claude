<script lang="ts">
	let { data } = $props();
	let reports = $state(data.reports);
	let reportCount = $state(data.reportCount);

	async function handleDelete(e: MouseEvent, reportId: number) {
		e.preventDefault();
		e.stopPropagation();
		if (!confirm('Delete this report? This cannot be undone.')) return;

		const res = await fetch('/reports', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: reportId })
		});
		if (res.ok) {
			reports = reports.filter(r => r.id !== reportId);
			reportCount--;
		}
	}
</script>

<svelte:head>
	<title>CRE Copilot — Dashboard</title>
</svelte:head>

<h1>Dashboard</h1>

<div class="stats">
	<div class="stat-card">
		<span class="stat-value">{data.documentCount}</span>
		<span class="stat-label">Documents</span>
	</div>
	<div class="stat-card">
		<span class="stat-value">{data.propertyCount}</span>
		<span class="stat-label">Properties</span>
	</div>
	<div class="stat-card">
		<span class="stat-value">{reportCount}</span>
		<span class="stat-label">Reports</span>
	</div>
</div>

<section class="section">
	<div class="section-header">
		<h2>Recent Reports</h2>
		<a href="/reports/new" class="btn">+ New Report</a>
	</div>
	{#if reports.length === 0}
		<p class="empty">No reports yet. <a href="/reports/new">Create your first report</a> or <a href="/ingest">upload appraisal PDFs</a> to get started.</p>
	{:else}
		<div class="report-list">
			{#each reports as report (report.id)}
				<a href="/reports/{report.id}" class="report-card">
					<div class="report-title">{report.subject_address}</div>
					<div class="report-meta">
						{report.subject_city} &middot; {report.report_number || 'Draft'} &middot;
						<span class="status status-{report.status}">{report.status}</span>
					</div>
					<button class="delete-btn" onclick={(e) => handleDelete(e, report.id)} title="Delete report">
						&times;
					</button>
				</a>
			{/each}
		</div>
	{/if}
</section>

<section class="section">
	<div class="section-header">
		<h2>Document Ingestion</h2>
		<a href="/ingest" class="btn btn-secondary">Upload PDFs</a>
	</div>
	{#if data.documents.length === 0}
		<p class="empty">No documents ingested yet.</p>
	{:else}
		<div class="doc-list">
			{#each data.documents as doc}
				<div class="doc-row">
					<span class="doc-name">{doc.filename}</span>
					<span class="doc-pages">{doc.page_count ?? '?'} pages</span>
					<span class="status status-{doc.status}">{doc.status}</span>
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	h1 {
		margin: 0 0 1.5rem 0;
		font-size: 1.5rem;
	}

	.stats {
		display: flex;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.stat-card {
		background: #fff;
		border-radius: 8px;
		padding: 1.25rem 1.5rem;
		box-shadow: 0 1px 3px rgba(0,0,0,0.08);
		display: flex;
		flex-direction: column;
		min-width: 120px;
	}

	.stat-value {
		font-size: 2rem;
		font-weight: 700;
		color: #1a1a2e;
	}

	.stat-label {
		font-size: 0.85rem;
		color: #666;
		margin-top: 0.25rem;
	}

	.section {
		background: #fff;
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 1px 3px rgba(0,0,0,0.08);
		margin-bottom: 1.5rem;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.section-header h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	.btn {
		display: inline-block;
		padding: 0.5rem 1rem;
		background: #1a1a2e;
		color: #fff;
		border-radius: 6px;
		text-decoration: none;
		font-size: 0.85rem;
	}

	.btn-secondary {
		background: #e8e8e8;
		color: #333;
	}

	.empty {
		color: #888;
		font-size: 0.9rem;
	}

	.empty a {
		color: #1a1a2e;
	}

	.report-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.report-card {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		padding: 0.75rem 1rem;
		border: 1px solid #eee;
		border-radius: 6px;
		text-decoration: none;
		color: inherit;
		position: relative;
	}

	.report-card:hover {
		border-color: #ccc;
		background: #fafafa;
	}

	.report-title {
		width: 100%;
	}

	.report-meta {
		flex: 1;
	}

	.delete-btn {
		background: none;
		border: none;
		font-size: 1.2rem;
		color: #ccc;
		cursor: pointer;
		padding: 0.2rem 0.4rem;
		line-height: 1;
		border-radius: 4px;
		flex-shrink: 0;
	}

	.delete-btn:hover {
		color: #dc3545;
		background: #fce4ec;
	}

	.report-title {
		font-weight: 600;
		font-size: 0.95rem;
	}

	.doc-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.doc-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid #f0f0f0;
		font-size: 0.9rem;
	}

	.doc-name {
		flex: 1;
		font-weight: 500;
	}

	.doc-pages {
		color: #888;
		font-size: 0.8rem;
	}

	.status {
		font-size: 0.75rem;
		padding: 0.15rem 0.5rem;
		border-radius: 99px;
		font-weight: 500;
	}

	.status-draft, .status-pending {
		background: #fff3cd;
		color: #856404;
	}

	.status-processing {
		background: #cce5ff;
		color: #004085;
	}

	.status-ready, .status-final {
		background: #d4edda;
		color: #155724;
	}

	.status-review {
		background: #e2e3f1;
		color: #383d6e;
	}

	.status-error {
		background: #f8d7da;
		color: #721c24;
	}
</style>
