export async function productMediaResponse(
	request: Request,
	productId: string,
	mediaId: string,
	db: D1Database,
	bucket: R2Bucket | undefined,
) {
	if (!bucket) return new Response("Not found", { status: 404 });
	const media = await db
		.prepare(
			`SELECT media.object_key FROM product_media media
			 JOIN products product ON product.id = media.product_id
			 WHERE media.id = ? AND media.product_id = ? AND product.status = 'active'
			 LIMIT 1`,
		)
		.bind(mediaId, productId)
		.first<{ object_key: string }>();
	if (!media) return new Response("Not found", { status: 404 });
	const object = await bucket.get(media.object_key);
	if (!object) return new Response("Not found", { status: 404 });
	const headers = new Headers({
		"Cache-Control": "public, max-age=31536000, immutable",
		"Content-Security-Policy": "default-src 'none'; sandbox",
		"X-Content-Type-Options": "nosniff",
		ETag: object.httpEtag,
	});
	const contentType = object.httpMetadata?.contentType;
	if (!contentType?.startsWith("image/"))
		return new Response("Not found", { status: 404 });
	headers.set("Content-Type", contentType);
	if (request.headers.get("if-none-match") === object.httpEtag)
		return new Response(null, { status: 304, headers });
	return new Response(object.body, { headers });
}
