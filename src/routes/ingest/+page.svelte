<script lang="ts">
	let files = $state<FileList | null>(null);
	let uploading = $state(false);
	let results = $state<Array<{ filename: string; status: string; id?: number; error?: string }>>([]);
	let documents = $state<Array<{ id: number; filename: string; page_count: number; status: string; error_message?: string; report_number?: string }>>([]);

	async function loadDocuments() {
		const res = await fetch('/ingest');
		if (res.ok) {
			documents = await res.json();
		}
	}

	async function upload() {
		if (!files || files.length === 0) return;
		uploading = true;
		results = [];

		for (const file of files) {
			const formData = new FormData();
			formData.append('file', file);

			try {
				const res = await fetch('/ingest', { method: 'POST', body: formData });
				const data = await res.json();

				if (res.ok) {
					results = [...results, { filename: file.name, status: 'processing', id: data.id }];
				} else {
					results = [...results, { filename: file.name, status: 'error', error: data.error }];
				}
			} catch (err) {
				results = [...results, { filename: file.name, status: 'error', error: String(err) }];
			}
		}

		uploading = false;
		files = null;

		// Poll for updates
		pollStatus();
	}

	async function pollStatus() {
		const processing = results.filter((r) => r.status === 'processing');
		if (processing.length === 0) return;

		await new Promise((r) => setTimeout(r, 3000));
		await loadDocuments();

		// Update results with latest status
		results = results.map((r) => {
			if (r.id) {
				const doc = documents.find((d) => d.id === r.id);
				if (doc) return { ...r, status: doc.status };
			}
			return r;
		});

		// Keep polling if still processing
		if (results.some((r) => r.status === 'processing')) {
			pollStatus();
		}
	}

	// Load documents on mount
	$effect(() => {
		loadDocuments();
	});
</script>

<svelte:head>
	<title>CRE Copilot — Ingest Documents</title>
</svelte:head>

<h1>Document Ingestion</h1>
<p class="description">Upload appraisal report PDFs to extract properties, comps, and reusable content.</p>

<div class="upload-area">
	<input
		type="file"
		accept=".pdf"
		multiple
		bind:files
		id="file-input"
	/>
	<label for="file-input" class="upload-label">
		{#if files && files.length > 0}
			{files.length} file{files.length > 1 ? 's' : ''} selected
		{:else}
			Drop PDFs here or click to browse
		{/if}
	</label>
	<button onclick={upload} disabled={uploading || !files} class="btn">
		{uploading ? 'Uploading...' : 'Upload & Process'}
	</button>
</div>

{#if results.length > 0}
	<div class="results">
		<h2>Upload Results</h2>
		{#each results as result}
			<div class="result-row">
				<span class="filename">{result.filename}</span>
				<span class="status status-{result.status}">{result.status}</span>
				{#if result.error}
					<span class="error">{result.error}</span>
				{/if}
			</div>
		{/each}
	</div>
{/if}

{#if documents.length > 0}
	<div class="doc-table">
		<h2>Processed Documents</h2>
		<table>
			<thead>
				<tr>
					<th>Filename</th>
					<th>Pages</th>
					<th>Report #</th>
					<th>Status</th>
				</tr>
			</thead>
			<tbody>
				{#each documents as doc}
					<tr>
						<td>{doc.filename}</td>
						<td>{doc.page_count ?? '-'}</td>
						<td>{doc.report_number ?? '-'}</td>
						<td><span class="status status-{doc.status}">{doc.status}</span></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	h1 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
	}

	.description {
		color: #666;
		margin-bottom: 1.5rem;
	}

	.upload-area {
		background: #fff;
		border: 2px dashed #ddd;
		border-radius: 8px;
		padding: 2rem;
		text-align: center;
		margin-bottom: 2rem;
	}

	input[type="file"] {
		display: none;
	}

	.upload-label {
		display: block;
		cursor: pointer;
		padding: 1rem;
		color: #666;
		font-size: 0.95rem;
		margin-bottom: 1rem;
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

	.results, .doc-table {
		background: #fff;
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
		box-shadow: 0 1px 3px rgba(0,0,0,0.08);
	}

	.results h2, .doc-table h2 {
		margin: 0 0 1rem 0;
		font-size: 1.1rem;
	}

	.result-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid #f0f0f0;
	}

	.filename {
		flex: 1;
		font-weight: 500;
	}

	.error {
		color: #dc3545;
		font-size: 0.85rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th {
		text-align: left;
		font-size: 0.8rem;
		color: #888;
		padding: 0.5rem;
		border-bottom: 2px solid #eee;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	td {
		padding: 0.5rem;
		border-bottom: 1px solid #f0f0f0;
		font-size: 0.9rem;
	}

	.status {
		font-size: 0.75rem;
		padding: 0.15rem 0.5rem;
		border-radius: 99px;
		font-weight: 500;
	}

	.status-pending { background: #fff3cd; color: #856404; }
	.status-processing { background: #cce5ff; color: #004085; }
	.status-ready { background: #d4edda; color: #155724; }
	.status-error { background: #f8d7da; color: #721c24; }
</style>
