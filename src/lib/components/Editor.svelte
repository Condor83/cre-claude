<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor as TiptapEditor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Placeholder from '@tiptap/extension-placeholder';

	interface Props {
		sectionKey: string;
		initialContent: string;
		reportId: number;
		onSave: (json: string, html: string) => void;
		onRequestGhostText: (currentText: string) => Promise<string>;
	}

	let { sectionKey, initialContent, reportId, onSave, onRequestGhostText }: Props = $props();

	let editorElement: HTMLDivElement;
	let editor: TiptapEditor | null = null;
	let ghostText = $state('');
	let showGhost = $state(false);
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	let autosaveInterval: ReturnType<typeof setInterval> | null = null;
	let ghostTimeout: ReturnType<typeof setTimeout> | null = null;
	let suppressUpdate = false;

	onMount(() => {
		editor = new TiptapEditor({
			element: editorElement,
			extensions: [
				StarterKit,
				Placeholder.configure({
					placeholder: 'Start writing or press Ctrl+Space for AI suggestions...'
				})
			],
			content: initialContent || '',
			onUpdate: ({ editor: e }) => {
				// Skip save/ghost when programmatically resetting content on section switch
				if (suppressUpdate) return;

				// Clear ghost text on any edit
				ghostText = '';
				showGhost = false;

				// Debounced save
				if (saveTimeout) clearTimeout(saveTimeout);
				saveTimeout = setTimeout(() => {
					const json = JSON.stringify(e.getJSON());
					const html = e.getHTML();
					onSave(json, html);
				}, 2000);

				// Request ghost text after a pause in typing
				if (ghostTimeout) clearTimeout(ghostTimeout);
				ghostTimeout = setTimeout(async () => {
					const currentText = e.getText();
					if (currentText.length > 10) {
						const suggestion = await onRequestGhostText(currentText);
						if (suggestion) {
							ghostText = suggestion;
							showGhost = true;
						}
					}
				}, 3000);
			}
		});

		// Autosave every 30 seconds
		autosaveInterval = setInterval(() => {
			if (editor) {
				const json = JSON.stringify(editor.getJSON());
				const html = editor.getHTML();
				onSave(json, html);
			}
		}, 30000);
	});

	onDestroy(() => {
		editor?.destroy();
		if (saveTimeout) clearTimeout(saveTimeout);
		if (autosaveInterval) clearInterval(autosaveInterval);
		if (ghostTimeout) clearTimeout(ghostTimeout);
	});

	function handleKeydown(event: KeyboardEvent) {
		// Tab to accept ghost text
		if (event.key === 'Tab' && showGhost && ghostText) {
			event.preventDefault();
			editor?.commands.insertContent(ghostText);
			ghostText = '';
			showGhost = false;
			return;
		}

		// Cmd+Right for word-by-word accept
		if (event.key === 'ArrowRight' && event.metaKey && showGhost && ghostText) {
			event.preventDefault();
			const nextSpace = ghostText.indexOf(' ');
			const word = nextSpace > -1 ? ghostText.slice(0, nextSpace + 1) : ghostText;
			editor?.commands.insertContent(word);
			ghostText = nextSpace > -1 ? ghostText.slice(nextSpace + 1) : '';
			if (!ghostText) showGhost = false;
			return;
		}

		// Escape to dismiss
		if (event.key === 'Escape' && showGhost) {
			ghostText = '';
			showGhost = false;
			return;
		}

		// Ctrl+Space to request ghost text
		if (event.key === ' ' && event.ctrlKey) {
			event.preventDefault();
			const currentText = editor?.getText() ?? '';
			onRequestGhostText(currentText).then((suggestion) => {
				if (suggestion) {
					ghostText = suggestion;
					showGhost = true;
				}
			});
		}
	}

	// Reset editor when section changes
	$effect(() => {
		if (editor && sectionKey) {
			suppressUpdate = true;
			editor.commands.setContent(initialContent || '');
			suppressUpdate = false;
			ghostText = '';
			showGhost = false;
		}
	});
</script>

<div class="editor-wrapper" onkeydown={handleKeydown} role="textbox" tabindex="-1">
	<div bind:this={editorElement} class="tiptap-editor"></div>
	{#if showGhost && ghostText}
		<div class="ghost-overlay">
			<span class="ghost-text">{ghostText}</span>
			<div class="ghost-hints">
				<kbd>Tab</kbd> accept &middot; <kbd>Cmd+Right</kbd> word &middot; <kbd>Esc</kbd> dismiss
			</div>
		</div>
	{/if}
</div>

<style>
	.editor-wrapper {
		position: relative;
		outline: none;
	}

	.tiptap-editor {
		min-height: 400px;
		background: #fff;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 1.5rem;
		font-family: 'Times New Roman', Georgia, serif;
		font-size: 1rem;
		line-height: 1.6;
	}

	:global(.tiptap-editor .ProseMirror) {
		outline: none;
		min-height: 350px;
	}

	:global(.tiptap-editor .ProseMirror p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: #adb5bd;
		pointer-events: none;
		height: 0;
	}

	:global(.tiptap-editor .ProseMirror p) {
		margin: 0 0 0.75rem 0;
	}

	:global(.tiptap-editor .ProseMirror h1,
	.tiptap-editor .ProseMirror h2,
	.tiptap-editor .ProseMirror h3) {
		margin: 1rem 0 0.5rem;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.ghost-overlay {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: linear-gradient(transparent, #f8f9fa);
		padding: 1rem 1.5rem;
		border-radius: 0 0 8px 8px;
	}

	.ghost-text {
		display: block;
		color: #999;
		font-family: 'Times New Roman', Georgia, serif;
		font-size: 1rem;
		line-height: 1.6;
		font-style: italic;
		max-height: 4.8rem;
		overflow: hidden;
	}

	.ghost-hints {
		margin-top: 0.5rem;
		font-size: 0.75rem;
		color: #aaa;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.ghost-hints kbd {
		padding: 0.1rem 0.3rem;
		background: #e8e8e8;
		border-radius: 3px;
		font-size: 0.7rem;
	}
</style>
