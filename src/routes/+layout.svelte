<script>
	let { children } = $props();
</script>

<div class="app">
	<nav class="sidebar">
		<div class="logo">
			<h2>CRE Copilot</h2>
		</div>
		<ul>
			<li><a href="/">Dashboard</a></li>
			<li><a href="/properties">Properties</a></li>
			<li><a href="/reports/new">New Report</a></li>
		</ul>
	</nav>
	<main class="content">
		{@render children()}
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: #f5f5f5;
		color: #1a1a1a;
	}

	.app {
		display: flex;
		min-height: 100vh;
	}

	.sidebar {
		width: 220px;
		background: #1a1a2e;
		color: #e0e0e0;
		padding: 1rem;
		flex-shrink: 0;
	}

	.logo h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.1rem;
		color: #fff;
		padding-bottom: 1rem;
		border-bottom: 1px solid #333;
	}

	.sidebar ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.sidebar li {
		margin-bottom: 0.25rem;
	}

	.sidebar a {
		color: #b0b0b0;
		text-decoration: none;
		display: block;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		font-size: 0.9rem;
	}

	.sidebar a:hover {
		background: #16213e;
		color: #fff;
	}

	.content {
		flex: 1;
		padding: 2rem;
		overflow-y: auto;
	}
</style>
