export type MiniPosNestedItem = {
	id: string;
	label: string;
	price: number;
};

export type MiniPosService = {
	key: string;
	label: string;
	hasNested?: boolean;
	nestedItems?: MiniPosNestedItem[];
	oilTypes?: string[];
};

export const MINI_POS_SERVICES: MiniPosService[] = [
	{
		key: "mobil1",
		label: "Mobil 1",
		hasNested: true,
		nestedItems: [
			{ id: "m1-u75", label: "under 75K", price: 124.99 },
			{ id: "m1-xqt", label: "X-Qt MB1", price: 13.99 },
			{ id: "m1-hm", label: "High Mileage", price: 126.99 },
			{ id: "m1-xqt-hm", label: "X-Qt HM MB1", price: 14.99 },
			{ id: "m1-shop-fee", label: "Shop Fee", price: 4.99 },
			{ id: "m1-oil-type-header", label: "Oil Type/MB1", price: 0 },
			{ id: "m1-5w20", label: "5W20", price: 0 },
			{ id: "m1-5w30", label: "5W30", price: 0 },
			{ id: "m1-5w40", label: "5W40", price: 0 },
			{ id: "m1-0w40", label: "0W40", price: 0 },
			{ id: "m1-0w30", label: "0W30", price: 0 },
			{ id: "m1-0w20", label: "0W20", price: 0 },
		],
		oilTypes: ["5W20", "5W30", "5W40", "0W40", "0W30", "0W20"],
	},
	{
		key: "xlt",
		label: "XLT",
		hasNested: true,
		nestedItems: [
			{ id: "xlt-u75", label: "under 75K", price: 104.99 },
			{ id: "xlt-xqt", label: "X-Qt XLT", price: 10.99 },
			{ id: "xlt-hm", label: "High Mileage", price: 106.99 },
			{ id: "xlt-xqt-hm", label: "X-Qt HM XLT", price: 11.99 },
			{ id: "xlt-shop-fee", label: "Shop Fee", price: 4.99 },
			{ id: "xlt-oil-type-header", label: "Oil Type/XLT", price: 0 },
			{ id: "xlt-5w20", label: "5W20", price: 0 },
			{ id: "xlt-5w30", label: "5W30", price: 0 },
			{ id: "xlt-0w30", label: "0W30", price: 0 },
			{ id: "xlt-0w20", label: "0W20", price: 0 },
		],
		oilTypes: ["5W20", "5W30", "0W30", "0W20"],
	},
	{
		key: "premium",
		label: "Premium",
		hasNested: true,
		nestedItems: [
			{ id: "prem-u75", label: "under 75K", price: 90.99 },
			{ id: "prem-xqt", label: "X-Qt Prem.", price: 9.99 },
			{ id: "prem-hm", label: "High Mileage", price: 92.99 },
			{ id: "prem-xqt-hm", label: "X-Qt HM Prem.", price: 10.99 },
			{ id: "prem-shop-fee", label: "Shop Fee", price: 4.99 },
			{ id: "prem-oil-type-header", label: "Oil Type/Premium", price: 0 },
			{ id: "prem-5w20", label: "5W20", price: 0 },
			{ id: "prem-5w30", label: "5W30", price: 0 },
			{ id: "prem-0w20", label: "0W20", price: 0 },
		],
		oilTypes: ["5W20", "5W30", "0W20"],
	},
	{
		key: "economy",
		label: "Economy",
		hasNested: true,
		nestedItems: [
			{ id: "eco-u75", label: "under 75K", price: 55.99 },
			{ id: "eco-xqt", label: "X-Qt Eco.", price: 8.99 },
			{ id: "eco-hm", label: "High Mileage", price: 92.99 },
			{ id: "eco-xqt-hm", label: "X-Qt HM Eco.", price: 8.99 },
			{ id: "eco-shop-fee", label: "Shop Fee", price: 4.99 },
			{ id: "eco-oil-type-header", label: "Oil Type/Economy", price: 0 },
			{ id: "eco-5w20", label: "5W20", price: 0 },
			{ id: "eco-5w30", label: "5W30", price: 0 },
		],
		oilTypes: ["5W20", "5W30"],
	},
	{
		key: "diesel",
		label: "Diesel",
		hasNested: true,
		nestedItems: [
			{ id: "dsl-t4", label: "Rotella T4", price: 71.99 },
			{ id: "dsl-t5", label: "Rotella T5", price: 98.99 },
			{ id: "dsl-t6", label: "Rotella T6", price: 119.99 },
			{ id: "dsl-shop-fee", label: "Shop Fee", price: 4.99 },
			{ id: "dsl-fuel-filters", label: "Fuel Filters", price: 129.99 },
		],
	},
	{
		key: "byo",
		label: "BYO",
		hasNested: true,
		nestedItems: [
			{ id: "byo-own-oil", label: "Own Oil", price: 50.99 },
			{ id: "byo-own-oil-filter", label: "Own Oil & Filter", price: 47.99 },
			{ id: "byo-shop-fee", label: "Shop Fee", price: 4.99 },
			{ id: "byo-coolant-top-off", label: "Coolant Top Off", price: 0 },
			{ id: "byo-customer-check", label: "Customer Check", price: 0 },
			{ id: "byo-tire-check", label: "Tire Check", price: 0 },
		],
	},
	{
		key: "other_services",
		label: "Other services",
		hasNested: true,
		nestedItems: [
			{ id: "other-coolants", label: "coolants", price: 145.99 },
			{ id: "other-fs-cleaners", label: "FS Cleaners", price: 12.99 },
			{ id: "other-diff-front-1", label: "Differential - Front", price: 99.99 },
			{ id: "other-diff-rear-1", label: "Differential - Rear", price: 99.99 },
			{ id: "other-diff-front-2", label: "Differential - Front", price: 119.99 },
			{ id: "other-diff-rear-2", label: "Differential - Rear", price: 119.99 },
		],
	},
	{
		key: "filters_wipers",
		label: "Filters / Wipers",
		hasNested: true,
		nestedItems: [
			{ id: "fw-air-filters", label: "Air Filters", price: 34.99 },
			{ id: "fw-cabin-filters", label: "Cabin Filters", price: 49.99 },
			{ id: "fw-wipers-header", label: "Wipers", price: 0 },
			{ id: "fw-10a-rear", label: "10-A REAR 10 IN", price: 31.99 },
			{ id: "fw-12-180-beam", label: "12-180 BEAM 18 IN", price: 31.99 },
			{ id: "fw-12-240-beam", label: "12-240 BEAM 24 IN", price: 31.99 },
			{ id: "fw-30-180-conv-18", label: "30-180 CONVENTIONAL 18 IN", price: 19.99 },
			{ id: "fw-30-180-conv-24", label: "30-180 CONVENTIONAL 24 IN", price: 19.99 },
			{ id: "fw-35-180-winter-18", label: "35-180 WINTER 18 IN", price: 31.99 },
			{ id: "fw-35-240-winter-24", label: "35-240 WINTER 24 IN", price: 31.99 },
		],
	},
];
