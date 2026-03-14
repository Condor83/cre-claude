<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let settings = $derived(data.settings);
</script>

<svelte:head>
	<title>CRE Copilot — Appraiser Settings</title>
</svelte:head>

<h1>Appraiser Settings</h1>

{#if form?.success}
	<div class="success-msg">Settings saved successfully.</div>
{/if}

<form method="POST" use:enhance>
	<div class="card">
		<h2>Contact Information</h2>

		<div class="form-grid">
			<label class="field">
				<span>Full Name</span>
				<input type="text" name="name" value={settings.name ?? ''} />
			</label>

			<label class="field">
				<span>Company Name</span>
				<input type="text" name="company" value={settings.company ?? ''} />
			</label>

			<label class="field full-width">
				<span>Business Address</span>
				<input type="text" name="address" value={settings.address ?? ''} />
			</label>

			<label class="field">
				<span>Phone</span>
				<input type="text" name="phone" value={settings.phone ?? ''} />
			</label>

			<label class="field">
				<span>Email</span>
				<input type="email" name="email" value={settings.email ?? ''} />
			</label>
		</div>

		<h2>Licensing</h2>

		<div class="form-grid">
			<label class="field">
				<span>License Number</span>
				<input type="text" name="license_number" value={settings.license_number ?? ''} />
			</label>

			<label class="field">
				<span>License State</span>
				<input type="text" name="license_state" value={settings.license_state ?? 'UT'} />
			</label>

			<label class="field full-width">
				<span>Certification Type</span>
				<select name="certification_type">
					<option value="" disabled selected={!settings.certification_type}>Select...</option>
					<option
						value="Certified General Appraiser"
						selected={settings.certification_type === 'Certified General Appraiser'}
					>
						Certified General Appraiser
					</option>
					<option
						value="Certified Residential Appraiser"
						selected={settings.certification_type === 'Certified Residential Appraiser'}
					>
						Certified Residential Appraiser
					</option>
					<option
						value="Licensed Appraiser"
						selected={settings.certification_type === 'Licensed Appraiser'}
					>
						Licensed Appraiser
					</option>
				</select>
			</label>
		</div>

		<h2>Professional Qualifications</h2>

		<label class="field full-width">
			<span>Professional Qualifications / CV</span>
			<textarea name="cv_text" rows="8">{settings.cv_text ?? ''}</textarea>
		</label>
	</div>

	<div class="form-actions">
		<button type="submit" class="btn">Save Settings</button>
	</div>
</form>

<style>
	h1 {
		margin: 0 0 1.5rem 0;
		font-size: 1.5rem;
	}

	h2 {
		margin: 0 0 1rem 0;
		font-size: 1.05rem;
		color: #555;
		font-weight: 600;
	}

	h2:not(:first-child) {
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid #eee;
	}

	.card {
		background: #fff;
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
		max-width: 680px;
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.field span {
		font-size: 0.82rem;
		font-weight: 500;
		color: #555;
	}

	.full-width {
		grid-column: 1 / -1;
	}

	input,
	select,
	textarea {
		padding: 0.5rem 0.65rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 0.9rem;
		font-family: inherit;
		background: #fafafa;
		color: #1a1a1a;
	}

	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: #1a1a2e;
		box-shadow: 0 0 0 2px rgba(26, 26, 46, 0.1);
	}

	textarea {
		resize: vertical;
	}

	.form-actions {
		margin-top: 1rem;
		max-width: 680px;
		display: flex;
		justify-content: flex-end;
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

	.btn:hover {
		background: #16213e;
	}

	.success-msg {
		background: #d4edda;
		color: #155724;
		padding: 0.75rem 1rem;
		border-radius: 6px;
		margin-bottom: 1rem;
		max-width: 680px;
		font-size: 0.9rem;
	}
</style>
