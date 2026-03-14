<script lang="ts">
	interface Row {
		label: string;
		value: string;
		auto?: boolean;
	}

	interface Props {
		reportId: number;
		sectionKey: string;
		initialRows: Row[];
		status: string;
		onSave: (rows: Row[], html: string) => void;
	}

	let { reportId, sectionKey, initialRows, status, onSave }: Props = $props();

	let rows = $state<Row[]>(initialRows.map(r => ({ ...r })));
	let newLabel = $state('');
	let newValue = $state('');
	let dirty = $state(false);

	function rowsToHtml(data: Row[]): string {
		const trs = data
			.map(r => `<tr><td><strong>${r.label}</strong></td><td>${r.value}</td></tr>`)
			.join('\n');
		return `
<p><strong>SUMMARY OF SALIENT FACTS AND CONCLUSIONS</strong></p>
<table>
<tbody>
${trs}
</tbody>
</table>`.trim();
	}

	function handleChange() {
		dirty = true;
	}

	function addRow() {
		if (!newLabel.trim()) return;
		rows.push({ label: newLabel.trim(), value: newValue.trim() });
		newLabel = '';
		newValue = '';
		dirty = true;
	}

	function removeRow(index: number) {
		rows.splice(index, 1);
		dirty = true;
	}

	function moveRow(index: number, dir: -1 | 1) {
		const newIdx = index + dir;
		if (newIdx < 0 || newIdx >= rows.length) return;
		const temp = rows[index];
		rows[index] = rows[newIdx];
		rows[newIdx] = temp;
		dirty = true;
	}

	function save() {
		const html = rowsToHtml(rows);
		onSave(rows, html);
		dirty = false;
	}
</script>

<div class="facts-table-editor">
	<table class="facts-table">
		<tbody>
			{#each rows as row, i}
				<tr>
					<td class="label-cell">
						<input
							type="text"
							bind:value={row.label}
							oninput={handleChange}
							class="cell-input label-input"
						/>
					</td>
					<td class="value-cell">
						<input
							type="text"
							bind:value={row.value}
							oninput={handleChange}
							class="cell-input value-input"
						/>
					</td>
					<td class="action-cell">
						<button class="row-btn" onclick={() => moveRow(i, -1)} title="Move up" disabled={i === 0}>&#9650;</button>
						<button class="row-btn" onclick={() => moveRow(i, 1)} title="Move down" disabled={i === rows.length - 1}>&#9660;</button>
						<button class="row-btn del-btn" onclick={() => removeRow(i)} title="Remove">&times;</button>
					</td>
				</tr>
			{/each}
		</tbody>
		<tfoot>
			<tr class="add-row">
				<td class="label-cell">
					<input
						type="text"
						bind:value={newLabel}
						placeholder="New field label..."
						class="cell-input label-input add-input"
						onkeydown={(e) => { if (e.key === 'Enter') addRow(); }}
					/>
				</td>
				<td class="value-cell">
					<input
						type="text"
						bind:value={newValue}
						placeholder="Value..."
						class="cell-input value-input add-input"
						onkeydown={(e) => { if (e.key === 'Enter') addRow(); }}
					/>
				</td>
				<td class="action-cell">
					<button class="add-btn" onclick={addRow} disabled={!newLabel.trim()}>Add</button>
				</td>
			</tr>
		</tfoot>
	</table>

	<div class="table-footer">
		<button class="save-btn" onclick={save} disabled={!dirty}>
			{dirty ? 'Save Changes' : 'Saved'}
		</button>
	</div>
</div>

<style>
	.facts-table-editor {
		background: #fff;
		border: 1px solid #ddd;
		border-radius: 8px;
		overflow: hidden;
	}

	.facts-table {
		width: 100%;
		border-collapse: collapse;
	}

	.facts-table tr {
		border-bottom: 1px solid #f0f0f0;
	}

	.facts-table tr:hover {
		background: #fafafa;
	}

	.label-cell {
		width: 40%;
	}

	.value-cell {
		width: auto;
	}

	.action-cell {
		width: 80px;
		text-align: center;
		white-space: nowrap;
	}

	.cell-input {
		width: 100%;
		border: none;
		padding: 0.5rem 0.6rem;
		font-size: 0.9rem;
		font-family: 'Times New Roman', Georgia, serif;
		background: transparent;
		box-sizing: border-box;
	}

	.cell-input:focus {
		outline: none;
		background: #f8f9ff;
	}

	.label-input {
		font-weight: 600;
		color: #333;
	}

	.value-input {
		color: #444;
	}

	.add-input {
		color: #999;
	}

	.add-input:focus {
		color: #333;
	}

	.add-row {
		border-top: 2px solid #eee;
		background: #fafafa;
	}

	.row-btn {
		background: none;
		border: none;
		cursor: pointer;
		color: #bbb;
		font-size: 0.7rem;
		padding: 0.1rem 0.2rem;
		line-height: 1;
	}

	.row-btn:hover:not(:disabled) {
		color: #666;
	}

	.row-btn:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.del-btn:hover:not(:disabled) {
		color: #c33;
	}

	.add-btn {
		padding: 0.2rem 0.5rem;
		background: #e8e8e8;
		border: none;
		border-radius: 3px;
		font-size: 0.75rem;
		cursor: pointer;
		color: #555;
	}

	.add-btn:hover:not(:disabled) {
		background: #ddd;
	}

	.add-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.table-footer {
		display: flex;
		justify-content: flex-end;
		padding: 0.5rem 0.75rem;
		border-top: 1px solid #eee;
		background: #fafafa;
	}

	.save-btn {
		padding: 0.35rem 1rem;
		background: #1a1a2e;
		color: #fff;
		border: none;
		border-radius: 5px;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.save-btn:hover:not(:disabled) {
		background: #2a2a4e;
	}

	.save-btn:disabled {
		background: #28a745;
		cursor: default;
	}
</style>
