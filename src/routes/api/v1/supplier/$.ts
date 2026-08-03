import { createFileRoute } from "@tanstack/react-router";
import { createWalletTopupPayment } from "#/features/shop-payments/server/service";
import { authenticateSupplierApi } from "#/features/supplier-api/server/auth";
import {
	getSupplierProduct,
	listSupplierCatalog,
} from "#/features/supplier-api/server/catalog";
import {
	cancelSupplierApiOrder,
	createSupplierApiOrder,
	getSupplierApiOrder,
} from "#/features/supplier-api/server/orders";
import { walletTopupSchema } from "#/features/wallet/schema";
import { DomainError } from "#/lib/domain-error";
import { getCloudflareEnv } from "#/server/db.server";

export const Route = createFileRoute("/api/v1/supplier/$")({
	server: {
		handlers: {
			GET: ({ request }) => handle(request),
			POST: ({ request }) => handle(request),
		},
	},
});

async function handle(request: Request) {
	try {
		const db = getCloudflareEnv(request).DB;
		if (!db)
			throw new DomainError("service_unavailable", 503, "Database unavailable");
		const rawBody = request.method === "POST" ? await readBody(request) : "";
		const identity = await authenticateSupplierApi(request, db, rawBody);
		const url = new URL(request.url);
		const path = url.pathname.replace(/^\/api\/v1\/supplier\/?/, "");
		if (request.method === "POST" && path === "ping") {
			const [user, settings] = await Promise.all([
				db
					.prepare("SELECT balance_minor FROM users WHERE id = ?")
					.bind(identity.userId)
					.first<{ balance_minor: string }>(),
				db
					.prepare(
						"SELECT key, value FROM system_settings WHERE key IN ('site.name', 'commerce.default_currency')",
					)
					.all<{ key: string; value: string }>(),
			]);
			const values = new Map(
				settings.results.map((row) => [row.key, JSON.parse(row.value)]),
			);
			return Response.json({
				ok: true,
				site_name: String(values.get("site.name") ?? "GMShop Edge"),
				balance_minor: user?.balance_minor ?? "0",
				currency: String(values.get("commerce.default_currency") ?? "USD"),
			});
		}
		if (request.method === "GET" && path === "products") {
			const page = positiveInt(url.searchParams.get("page"), 1);
			const pageSize = Math.min(
				100,
				positiveInt(url.searchParams.get("page_size"), 50),
			);
			return Response.json(
				await listSupplierCatalog(db, {
					page,
					pageSize,
					updatedAfter: url.searchParams.get("updated_after") ?? undefined,
				}),
			);
		}
		if (request.method === "GET" && path === "categories") {
			const rows = await db
				.prepare(
					`SELECT DISTINCT value AS name
					 FROM product_sellable_items item
					 JOIN products product ON product.id = item.product_id,
					 json_each(product.tag_names)
					 WHERE product.status = 'active' AND product.product_type = 'stock'
					  AND item.enabled = 1 AND item.fulfillment_source = 'local'
					 ORDER BY name`,
				)
				.all<{ name: string }>();
			return Response.json({
				items: rows.results.map((row, index) => ({
					id: String(index + 1),
					name: row.name,
				})),
			});
		}
		if (request.method === "GET" && path === "payment-channels") {
			const channels = await db
				.prepare(
					"SELECT id, name, provider, currency FROM payment_channels WHERE enabled = 1 ORDER BY sort_order, name, id",
				)
				.all();
			return Response.json({ items: channels.results });
		}
		if (request.method === "POST" && path === "topups") {
			const body = JSON.parse(rawBody) as Record<string, unknown>;
			const topup = walletTopupSchema.parse({
				amountMinor: body.amount_minor,
				channelId: body.channel_id,
				idempotencyKey: body.request_no,
				paymentCurrency: body.payment_currency,
			});
			const origin = url.origin;
			return Response.json(
				await createWalletTopupPayment(db, {
					userId: identity.userId,
					amountMinor: topup.amountMinor,
					channelId: topup.channelId,
					idempotencyKey: `supplier-topup:${identity.userId}:${topup.idempotencyKey}`,
					paymentCurrency: topup.paymentCurrency,
					successUrl: new URL("/account", origin).toString(),
					cancelUrl: new URL("/account", origin).toString(),
				}),
			);
		}
		const topupMatch = /^topups\/([^/]+)$/.exec(path);
		if (request.method === "GET" && topupMatch?.[1]) {
			const topup = await db
				.prepare(
					"SELECT id, amount_minor, currency, status, paid_at, refunded_at, created_at FROM wallet_topups WHERE id = ? AND user_id = ? LIMIT 1",
				)
				.bind(decodeURIComponent(topupMatch[1]), identity.userId)
				.first();
			if (!topup)
				throw new DomainError("topup_not_found", 404, "Top-up not found");
			return Response.json(topup);
		}
		const productMatch = /^products\/([^/]+)$/.exec(path);
		if (request.method === "GET" && productMatch?.[1])
			return Response.json(
				await getSupplierProduct(db, decodeURIComponent(productMatch[1])),
			);
		if (request.method === "POST" && path === "orders") {
			const body = JSON.parse(rawBody) as Record<string, unknown>;
			return Response.json(
				await createSupplierApiOrder(db, identity, {
					skuId: String(body.sku_id ?? ""),
					quantity: Number(body.quantity),
					downstreamOrderNo: String(body.downstream_order_no ?? ""),
					callbackUrl: body.callback_url ? String(body.callback_url) : null,
					traceId: body.trace_id ? String(body.trace_id) : undefined,
				}),
			);
		}
		const orderMatch = /^orders\/([^/]+)$/.exec(path);
		if (request.method === "GET" && orderMatch?.[1])
			return Response.json(
				await getSupplierApiOrder(
					db,
					identity.userId,
					decodeURIComponent(orderMatch[1]),
				),
			);
		const cancelMatch = /^orders\/([^/]+)\/cancel$/.exec(path);
		if (request.method === "POST" && cancelMatch?.[1])
			return Response.json(
				await cancelSupplierApiOrder(
					db,
					identity.userId,
					decodeURIComponent(cancelMatch[1]),
				),
			);
		throw new DomainError(
			"supplier_endpoint_not_found",
			404,
			"Endpoint not found",
		);
	} catch (error) {
		if (error instanceof DomainError)
			return Response.json(
				{ ok: false, error_code: error.code },
				{ status: error.status },
			);
		return Response.json(
			{ ok: false, error_code: "invalid_request" },
			{ status: 400 },
		);
	}
}

async function readBody(request: Request) {
	const length = Number(request.headers.get("content-length") ?? 0);
	if (length > 64_000)
		throw new DomainError("body_too_large", 413, "Body too large");
	const body = await request.text();
	if (body.length > 64_000)
		throw new DomainError("body_too_large", 413, "Body too large");
	return body;
}

function positiveInt(value: string | null, fallback: number) {
	const parsed = Number(value ?? fallback);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
