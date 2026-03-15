<script lang="ts">
	import type { SectionImage } from '$lib/db/index';

	interface Props {
		reportId: number;
		sectionKey: string;
		images: SectionImage[];
		layout?: 'grid' | 'single';
		onchange?: (sectionKey: string, imageCount: number) => void;
	}

	let { reportId, sectionKey, images, layout = 'grid', onchange }: Props = $props();

	let localImages: SectionImage[] = $state([]);
	let uploading = $state(false);

	// Fetch images from API when section changes (prop is only initial data from page load)
	$effect(() => {
		const key = sectionKey;
		const rid = reportId;
		fetchImages(rid, key);
	});

	async function fetchImages(rid: number, key: string) {
		try {
			const res = await fetch(`/api/images?report_id=${rid}&section_key=${key}`);
			if (res.ok) {
				localImages = await res.json();
			} else {
				localImages = images ? [...images] : [];
			}
		} catch {
			localImages = images ? [...images] : [];
		}
	}

	let dragOver = $state(false);
	let editingCaptionId: number | null = $state(null);
	let editingCaptionText = $state('');
	let error: string | null = $state(null);

	let sortedImages = $derived(
		[...localImages].sort((a, b) => a.sort_order - b.sort_order)
	);

	let nextSortOrder = $derived(
		localImages.length > 0
			? Math.max(...localImages.map((i) => i.sort_order)) + 1
			: 0
	);

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		dragOver = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			uploadFiles(files);
		}
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			uploadFiles(input.files);
			input.value = '';
		}
	}

	async function uploadFiles(files: FileList) {
		uploading = true;
		error = null;

		let currentOrder = nextSortOrder;

		for (const file of files) {
			if (!file.type.startsWith('image/')) {
				continue;
			}

			try {
				const formData = new FormData();
				formData.append('file', file);
				formData.append('report_id', String(reportId));
				formData.append('section_key', sectionKey);
				formData.append('sort_order', String(currentOrder));

				const res = await fetch('/api/images', {
					method: 'POST',
					body: formData
				});

				if (!res.ok) {
					const body = await res.json().catch(() => ({}));
					throw new Error(body.error || `Upload failed (${res.status})`);
				}

				const newImage: SectionImage = await res.json();
				localImages.push(newImage);
				currentOrder++;
			} catch (err) {
				error = err instanceof Error ? err.message : 'Upload failed';
			}
		}

		uploading = false;
		onchange?.(sectionKey, localImages.length);
	}

	async function deleteImage(imageId: number) {
		if (!confirm('Delete this image?')) return;

		try {
			const res = await fetch(`/api/images?id=${imageId}`, {
				method: 'DELETE'
			});

			if (!res.ok) {
				throw new Error('Delete failed');
			}

			localImages = localImages.filter((img) => img.id !== imageId);
			onchange?.(sectionKey, localImages.length);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Delete failed';
		}
	}

	function startEditCaption(image: SectionImage) {
		editingCaptionId = image.id;
		editingCaptionText = image.caption ?? '';
	}

	async function saveCaption(imageId: number) {
		try {
			const res = await fetch('/api/images', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: imageId,
					caption: editingCaptionText
				})
			});

			if (!res.ok) {
				throw new Error('Failed to save caption');
			}

			const idx = localImages.findIndex((img) => img.id === imageId);
			if (idx !== -1) {
				localImages[idx].caption = editingCaptionText;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save caption';
		}

		editingCaptionId = null;
	}

	function handleCaptionKeydown(e: KeyboardEvent, imageId: number) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveCaption(imageId);
		}
		if (e.key === 'Escape') {
			editingCaptionId = null;
		}
	}

	async function moveImage(imageId: number, direction: -1 | 1) {
		const sorted = [...localImages].sort((a, b) => a.sort_order - b.sort_order);
		const currentIdx = sorted.findIndex((img) => img.id === imageId);
		const swapIdx = currentIdx + direction;

		if (swapIdx < 0 || swapIdx >= sorted.length) return;

		const current = sorted[currentIdx];
		const swap = sorted[swapIdx];

		const tempOrder = current.sort_order;
		current.sort_order = swap.sort_order;
		swap.sort_order = tempOrder;

		try {
			await Promise.all([
				fetch('/api/images', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: current.id, sort_order: current.sort_order })
				}),
				fetch('/api/images', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: swap.id, sort_order: swap.sort_order })
				})
			]);

			// Update local array entries
			const ci = localImages.findIndex((img) => img.id === current.id);
			const si = localImages.findIndex((img) => img.id === swap.id);
			if (ci !== -1) localImages[ci].sort_order = current.sort_order;
			if (si !== -1) localImages[si].sort_order = swap.sort_order;
		} catch (err) {
			// Revert on failure
			current.sort_order = swap.sort_order;
			swap.sort_order = tempOrder;
			error = 'Failed to reorder images';
		}
	}
</script>

<div class="image-uploader">
	<!-- Drop zone -->
	<div
		class="drop-zone"
		class:drag-over={dragOver}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		role="region"
		aria-label="Image upload area"
	>
		{#if uploading}
			<div class="drop-content">
				<div class="spinner"></div>
				<p class="drop-text">Uploading...</p>
			</div>
		{:else}
			<div class="drop-content">
				<svg class="drop-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="17 8 12 3 7 8" />
					<line x1="12" y1="3" x2="12" y2="15" />
				</svg>
				<p class="drop-text">Drop images here</p>
				<label class="browse-btn">
					Browse files
					<input
						type="file"
						accept="image/*"
						multiple
						onchange={handleFileSelect}
						class="file-input"
					/>
				</label>
			</div>
		{/if}
	</div>

	<!-- Error message -->
	{#if error}
		<div class="error-msg">
			{error}
			<button class="error-dismiss" onclick={() => (error = null)}>dismiss</button>
		</div>
	{/if}

	<!-- Gallery -->
	{#if sortedImages.length > 0}
		<div class="gallery" class:grid-layout={layout === 'grid'} class:single-layout={layout === 'single'}>
			{#each sortedImages as image, idx (image.id)}
				<div class="image-card">
					<div class="image-wrapper">
						<img
							src="/api/images?id={image.id}"
							alt={image.caption || 'Section image'}
							class="thumbnail"
							loading="lazy"
						/>
						<button
							class="delete-btn"
							onclick={() => deleteImage(image.id)}
							title="Delete image"
							aria-label="Delete image"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
								<line x1="18" y1="6" x2="6" y2="18" />
								<line x1="6" y1="6" x2="18" y2="18" />
							</svg>
						</button>
						<div class="reorder-btns">
							{#if idx > 0}
								<button
									class="move-btn"
									onclick={() => moveImage(image.id, -1)}
									title="Move up"
									aria-label="Move image up"
								>
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
										<polyline points="18 15 12 9 6 15" />
									</svg>
								</button>
							{/if}
							{#if idx < sortedImages.length - 1}
								<button
									class="move-btn"
									onclick={() => moveImage(image.id, 1)}
									title="Move down"
									aria-label="Move image down"
								>
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
										<polyline points="6 9 12 15 18 9" />
									</svg>
								</button>
							{/if}
						</div>
					</div>
					<div class="caption-area">
						{#if editingCaptionId === image.id}
							<input
								type="text"
								class="caption-input editing"
								bind:value={editingCaptionText}
								onblur={() => saveCaption(image.id)}
								onkeydown={(e) => handleCaptionKeydown(e, image.id)}
							/>
						{:else}
							<button
								class="caption-display"
								onclick={() => startEditCaption(image)}
								title="Click to edit caption"
							>
								{image.caption || 'Add caption...'}
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.image-uploader {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* ── Drop zone ── */
	.drop-zone {
		border: 2px dashed #d0d0d0;
		border-radius: 8px;
		background: #fafafa;
		padding: 1.5rem;
		text-align: center;
		transition: border-color 0.2s, background 0.2s;
		cursor: default;
	}

	.drop-zone.drag-over {
		border-color: #1a1a2e;
		background: #f0f0f8;
	}

	.drop-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.drop-icon {
		color: #999;
	}

	.drop-zone.drag-over .drop-icon {
		color: #1a1a2e;
	}

	.drop-text {
		margin: 0;
		font-size: 0.85rem;
		color: #888;
	}

	.browse-btn {
		display: inline-block;
		padding: 0.35rem 0.9rem;
		background: #1a1a2e;
		color: #fff;
		border-radius: 4px;
		font-size: 0.78rem;
		cursor: pointer;
		transition: background 0.15s;
	}

	.browse-btn:hover {
		background: #2d2d4e;
	}

	.file-input {
		display: none;
	}

	/* ── Spinner ── */
	.spinner {
		width: 24px;
		height: 24px;
		border: 2.5px solid #e8e8e8;
		border-top-color: #1a1a2e;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* ── Error ── */
	.error-msg {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		background: #fff0f0;
		border: 1px solid #fcc;
		border-radius: 4px;
		font-size: 0.8rem;
		color: #c33;
	}

	.error-dismiss {
		background: none;
		border: none;
		color: #999;
		font-size: 0.75rem;
		cursor: pointer;
		text-decoration: underline;
	}

	/* ── Gallery ── */
	.gallery {
		display: grid;
		gap: 0.75rem;
	}

	.gallery.grid-layout {
		grid-template-columns: 1fr 1fr;
	}

	.gallery.single-layout {
		grid-template-columns: 1fr;
	}

	/* ── Image card ── */
	.image-card {
		display: flex;
		flex-direction: column;
		border: 1px solid #e8e8e8;
		border-radius: 6px;
		overflow: hidden;
		background: #fff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
	}

	.image-wrapper {
		position: relative;
		width: 100%;
		aspect-ratio: 4 / 3;
		overflow: hidden;
		background: #f5f5f5;
	}

	.thumbnail {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	/* ── Delete button ── */
	.delete-btn {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.55);
		border: none;
		border-radius: 50%;
		cursor: pointer;
		color: #fff;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.image-wrapper:hover .delete-btn {
		opacity: 1;
	}

	.delete-btn:hover {
		background: rgba(200, 40, 40, 0.85);
	}

	/* ── Reorder buttons ── */
	.reorder-btns {
		position: absolute;
		bottom: 4px;
		right: 4px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.image-wrapper:hover .reorder-btns {
		opacity: 1;
	}

	.move-btn {
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.55);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		color: #fff;
	}

	.move-btn:hover {
		background: rgba(0, 0, 0, 0.75);
	}

	/* ── Caption ── */
	.caption-area {
		padding: 0.35rem 0.5rem;
		min-height: 2rem;
	}

	.caption-display {
		display: block;
		width: 100%;
		background: none;
		border: none;
		text-align: left;
		padding: 0.15rem 0;
		font-size: 0.78rem;
		color: #666;
		cursor: text;
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.caption-display:hover {
		color: #333;
	}

	.caption-input {
		width: 100%;
		border: none;
		border-bottom: 1.5px solid #1a1a2e;
		outline: none;
		font-size: 0.78rem;
		padding: 0.15rem 0;
		background: transparent;
		color: #333;
		line-height: 1.3;
	}
</style>
