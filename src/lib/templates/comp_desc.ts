// Auto-generates a property description for a comparable sale/lease
// using the comp's property data and county_data_json.

interface CompDescContext {
	address: string;
	city: string | null;
	county: string | null;
	property_type: string | null;
	building_sf: number | null;
	land_sf: number | null;
	land_acres: number | null;
	year_built: number | null;
	stories: number | null;
	construction_class: string | null;
	quality: string | null;
	condition: string | null;
	zoning: string | null;
	owner_name: string | null;
	county_data_json: string | null;
	// Sale-specific
	sale_price: number | null;
	sale_date: string | null;
	grantor: string | null;
	grantee: string | null;
}

export function renderCompDesc(ctx: CompDescContext): string {
	const parts: string[] = [];

	// Property identification
	const typeLabel = ctx.property_type || 'commercial';
	const sfFormatted = ctx.building_sf ? ctx.building_sf.toLocaleString() : '\u2014';
	const yearText = ctx.year_built ? `built in ${ctx.year_built}` : 'year built unknown';
	const storiesText = ctx.stories ? `${ctx.stories}-story` : '';
	const classText = ctx.construction_class ? `${ctx.construction_class} construction` : '';

	parts.push(`<p>This comparable is a ${[storiesText, classText, typeLabel].filter(Boolean).join(' ')} property located at ${ctx.address}${ctx.city ? `, ${ctx.city}` : ''}. The building contains approximately ${sfFormatted} square feet, ${yearText}.</p>`);

	// Land
	const landText = ctx.land_acres
		? `${ctx.land_acres.toFixed(2)} acres`
		: ctx.land_sf
			? `${ctx.land_sf.toLocaleString()} square feet`
			: null;
	if (landText) {
		parts.push(`<p>The site contains approximately ${landText}${ctx.zoning ? ` and is zoned ${ctx.zoning}` : ''}.</p>`);
	}

	// Ownership from county data
	let ownerHistory = '';
	if (ctx.county_data_json) {
		try {
			const cd = JSON.parse(ctx.county_data_json);
			if (cd.owner_history?.length > 0) {
				const current = cd.owner_history[0];
				ownerHistory = `The property is currently owned by ${current.name}.`;
			}
		} catch { /* ignore */ }
	}
	if (!ownerHistory && ctx.owner_name) {
		ownerHistory = `The property is currently owned by ${ctx.owner_name}.`;
	}
	if (ownerHistory) {
		parts.push(`<p>${ownerHistory}</p>`);
	}

	// Sale information
	if (ctx.sale_price) {
		const priceFormatted = `$${ctx.sale_price.toLocaleString()}`;
		const dateFormatted = ctx.sale_date
			? new Date(ctx.sale_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
			: null;
		const psfFormatted = ctx.sale_price && ctx.building_sf
			? `$${(ctx.sale_price / ctx.building_sf).toFixed(2)} per square foot`
			: null;

		let saleParts = [`The property sold for ${priceFormatted}`];
		if (psfFormatted) saleParts.push(`or ${psfFormatted}`);
		if (dateFormatted) saleParts.push(`on ${dateFormatted}`);
		let saleText = saleParts.join(', ') + '.';

		if (ctx.grantor && ctx.grantee) {
			saleText += ` The property was conveyed from ${ctx.grantor} to ${ctx.grantee}.`;
		}

		parts.push(`<p>${saleText}</p>`);
	}

	return parts.join('\n');
}
