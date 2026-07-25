export function selectStorefrontProductRow(db: D1Database, productId: string) {
	return db
		.prepare(
			`SELECT p.id, p.name, p.description, p.product_type,
			 p.cover_object_key, p.updated_at,
			 COALESCE((SELECT json_group_array(json_object(
			  'id', tag.id, 'name', tag.name))
			  FROM product_tag_links link JOIN product_tags tag ON tag.id = link.tag_id
			  WHERE link.product_id = p.id), '[]') AS tags_json
			 FROM products p
			 WHERE p.id = ? AND p.status = 'active' LIMIT 1`,
		)
		.bind(productId)
		.first<Record<string, unknown>>();
}
