// Static per-county fixtures — decennial census data (never changes), employers, income
// Updated manually ~annually for per_capita_income and major_employers

export interface MunicipalityFixture {
	name: string;
	fips: string; // Census place FIPS (5-digit, within state 49)
	census_2000: number;
	census_2010: number;
}

export interface CountyStaticConfig {
	fips: string; // 5-digit county FIPS (e.g. '49049')
	name: string;
	stateFips: string;
	municipalities: MunicipalityFixture[];
	county_total: { census_2000: number; census_2010: number };
	major_employers: string[];
	per_capita_income: { amount: number; year: number };
	commercial_permits?: Array<{ year: number; permits: number; value: number | null; type: string }>;
}

export const COUNTY_CONFIGS: Record<string, CountyStaticConfig> = {
	utah_county: {
		fips: '49049',
		name: 'Utah',
		stateFips: '49',
		municipalities: [
			{ name: 'American Fork', fips: '01310', census_2000: 21941, census_2010: 26263 },
			{ name: 'Cedar Hills', fips: '11440', census_2000: 3171, census_2010: 9796 },
			{ name: 'Eagle Mountain', fips: '20810', census_2000: 2157, census_2010: 21415 },
			{ name: 'Highland', fips: '35190', census_2000: 8172, census_2010: 15523 },
			{ name: 'Lehi', fips: '43660', census_2000: 19028, census_2010: 47070 },
			{ name: 'Lindon', fips: '45090', census_2000: 8363, census_2010: 10070 },
			{ name: 'Mapleton', fips: '47950', census_2000: 5809, census_2010: 7979 },
			{ name: 'Orem', fips: '55980', census_2000: 84324, census_2010: 88328 },
			{ name: 'Payson', fips: '58730', census_2000: 12716, census_2010: 18294 },
			{ name: 'Pleasant Grove', fips: '60930', census_2000: 23468, census_2010: 33509 },
			{ name: 'Provo', fips: '62470', census_2000: 105166, census_2010: 112488 },
			{ name: 'Salem', fips: '65770', census_2000: 4372, census_2010: 6423 },
			{ name: 'Santaquin', fips: '67770', census_2000: 4834, census_2010: 8540 },
			{ name: 'Saratoga Springs', fips: '67825', census_2000: 1003, census_2010: 17781 },
			{ name: 'Spanish Fork', fips: '71290', census_2000: 20246, census_2010: 34691 },
			{ name: 'Springville', fips: '72280', census_2000: 20424, census_2010: 29466 },
		],
		county_total: { census_2000: 368536, census_2010: 516564 },
		major_employers: [
			'Brigham Young University',
			'Utah Valley University',
			'Intermountain Healthcare',
			'Vivint',
			'Nu Skin Enterprises',
			'Adobe Systems',
			'Qualtrics',
			'Nestlé',
			'Geneva Rock Products',
			'Utah County Government',
		],
		per_capita_income: { amount: 29886, year: 2022 },
		commercial_permits: [
			{ year: 2018, permits: 78, value: 185000000, type: 'Commercial/Industrial' },
			{ year: 2019, permits: 92, value: 210000000, type: 'Commercial/Industrial' },
			{ year: 2020, permits: 65, value: 155000000, type: 'Commercial/Industrial' },
			{ year: 2021, permits: 88, value: 240000000, type: 'Commercial/Industrial' },
			{ year: 2022, permits: 95, value: 275000000, type: 'Commercial/Industrial' },
			{ year: 2023, permits: 82, value: 230000000, type: 'Commercial/Industrial' },
		],
	},
	salt_lake_county: {
		fips: '49035',
		name: 'Salt Lake',
		stateFips: '49',
		municipalities: [
			{ name: 'Salt Lake City', fips: '67000', census_2000: 181743, census_2010: 186440 },
			{ name: 'West Valley City', fips: '83470', census_2000: 108896, census_2010: 129480 },
			{ name: 'West Jordan', fips: '82950', census_2000: 68336, census_2010: 103712 },
			{ name: 'Sandy', fips: '67440', census_2000: 88418, census_2010: 87461 },
			{ name: 'South Jordan', fips: '70850', census_2000: 29437, census_2010: 50418 },
			{ name: 'Murray', fips: '53230', census_2000: 34024, census_2010: 46746 },
			{ name: 'Draper', fips: '20120', census_2000: 25220, census_2010: 42274 },
			{ name: 'Riverton', fips: '64340', census_2000: 25011, census_2010: 38753 },
			{ name: 'Herriman', fips: '34970', census_2000: 1523, census_2010: 21785 },
			{ name: 'Taylorsville', fips: '75360', census_2000: 57439, census_2010: 58652 },
		],
		county_total: { census_2000: 898387, census_2010: 1029655 },
		major_employers: [
			'University of Utah',
			'Intermountain Healthcare',
			'Delta Air Lines',
			'Zions Bancorporation',
			'Goldman Sachs',
			'eBay',
			'L3 Technologies',
			'Salt Lake County Government',
		],
		per_capita_income: { amount: 35841, year: 2022 },
	},
};

export const STATE_TOTALS = {
	census_2000: 2233169,
	census_2010: 2763885,
};
