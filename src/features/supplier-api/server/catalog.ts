import { DomainError } from "#/lib/domain-error";

type ListingRow = {
	product_id: string;
	product_name: string;
	description: string | null;
	tag_names: string;
	product_updated_at: number;
	sku_id: string;
	sku_name: string;
	price_minor: string;
	stock_quantity: number;
	listing_updated_at: number;
};

export async function listSupplierCatalog(
	db: D1Database,
	input: { page: number; pageSize: number; updatedAfter?: string },
) {
	const updatedAfter = input.updatedAfter ? Date.parse(input.updatedAfter) : 0;
	const rows = await db
		.prepare(
			`SELECT product.id AS product_id, product.name AS product_name,
			 product.description, product.tag_names, product.updated_at AS product_updated_at,
			 item.id AS sku_id, item.name AS sku_name,
			 COALESCE(listing.price_minor, item.price_minor) AS price_minor,
			 COALESCE(listing.updated_at, item.updated_at) AS listing_updated_at,
			 (SELECT COUNT(*) FROM stock_entries stock WHERE stock.sellable_item_id = item.id
			  AND stock.status = 'available') AS stock_quantity
			 FROM product_sellable_items item
			 LEFT JOIN supplier_export_listings listing ON listing.sellable_item_id = item.id
			 JOIN products product ON product.id = item.product_id
			 WHERE COALESCE(listing.enabled, 1) = 1
			  AND product.status = 'active' AND product.product_type = 'stock'
			  AND item.enabled = 1 AND item.fulfillment_source = 'local'
			  AND item.currency = COALESCE((SELECT json_extract(value, '$') FROM system_settings
			   WHERE key = 'commerce.default_currency'), 'USD')
			  AND item.currency_decimals = COALESCE((SELECT CAST(json_extract(value, '$') AS INTEGER)
			   FROM system_settings WHERE key = 'commerce.currency_decimals'), 2)
			  AND MAX(product.updated_at, item.updated_at, COALESCE(listing.updated_at, 0)) >= ?
			 ORDER BY product.sort_order, product.id, item.sort_order, item.id`,
		)
		.bind(updatedAfter)
		.all<ListingRow>();
	const products = groupProducts(rows.results);
	const start = (input.page - 1) * input.pageSize;
	return {
		total: products.length,
		items: products.slice(start, start + input.pageSize),
	};
}

export async function getSupplierProduct(db: D1Database, productId: string) {
	const result = await listSupplierCatalog(db, { page: 1, pageSize: 10_000 });
	const product = result.items.find((item) => item.id === productId);
	if (!product)
		throw new DomainError(
			"supplier_product_not_found",
			404,
			"Product not found",
		);
	return { product };
}

function groupProducts(rows: ListingRow[]) {
	const grouped = new Map<string, ReturnType<typeof newProduct>>();
	for (const row of rows) {
		const item = grouped.get(row.product_id) ?? newProduct(row);
		item.skus.push({
			id: row.sku_id,
			name: row.sku_name,
			cost_minor: row.price_minor,
			stock_quantity: Number(row.stock_quantity),
			active: Number(row.stock_quantity) > 0,
		});
		grouped.set(row.product_id, item);
	}
	return [...grouped.values()];
}

function newProduct(row: ListingRow) {
	return {
		id: row.product_id,
		name: row.product_name,
		description: row.description ?? "",
		image_urls: [] as string[],
		category_names: JSON.parse(row.tag_names) as string[],
		active: true,
		updated_at: new Date(
			Math.max(row.product_updated_at, row.listing_updated_at),
		).toISOString(),
		skus: [] as Array<{
			id: string;
			name: string;
			cost_minor: string;
			stock_quantity: number;
			active: boolean;
		}>,
	};
}
