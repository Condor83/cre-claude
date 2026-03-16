import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketDataFreshness } from '$lib/db/index.js';
import { refreshMarketData, refreshAllDwsData } from '$lib/services/market-data.js';

/**
 * GET /api/market-data?market_area=X&data_type=Y
 * Returns freshness info + cached data
 */
export const GET: RequestHandler = async ({ url }) => {
	const marketArea = url.searchParams.get('market_area');
	const dataType = url.searchParams.get('data_type');

	if (!marketArea || !dataType) {
		return json({ error: 'market_area and data_type are required' }, { status: 400 });
	}

	const result = getMarketDataFreshness(marketArea, dataType);
	return json({
		fresh: result.fresh,
		ageInDays: result.ageInDays === Infinity ? null : Math.round(result.ageInDays * 10) / 10,
		data: result.data,
	});
};

/**
 * POST /api/market-data
 * Body: { market_area, data_type?, force? }
 * Triggers refresh of market data
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { market_area, data_type, force } = body;

	if (!market_area) {
		return json({ error: 'market_area is required' }, { status: 400 });
	}

	try {
		if (data_type) {
			const result = await refreshMarketData(market_area, data_type, force);
			return json({ ok: true, fresh: result.fresh, hasData: result.data != null });
		} else {
			const results = await refreshAllDwsData(market_area);
			return json({ ok: true, results });
		}
	} catch (err) {
		console.error('[market-data API] Refresh failed:', err);
		return json({ error: 'Refresh failed' }, { status: 500 });
	}
};
