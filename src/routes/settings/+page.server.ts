import { getAllAppraiserSettings, setAppraiserSettings } from '$lib/db/index.js';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async () => {
	const settings = getAllAppraiserSettings();
	return { settings };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();

		const keys = [
			'name',
			'company',
			'address',
			'phone',
			'email',
			'license_number',
			'license_state',
			'certification_type',
			'cv_text'
		];

		const settings: Record<string, string> = {};
		for (const key of keys) {
			const value = formData.get(key);
			if (typeof value === 'string') {
				settings[key] = value;
			}
		}

		setAppraiserSettings(settings);

		return { success: true };
	}
};
