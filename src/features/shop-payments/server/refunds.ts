import { z } from "zod";
import { refundEntitlementGrantStatements } from "#/features/entitlements/server/ledger";
import { convertMinorAmount } from "#/features/exchange-rates/rates";
import type { ShopOrderStatus } from "#/features/shop-orders/schema";
import { getPaymentProvider } from "#/features/shop-payments/providers";
import { DomainError } from "#/lib/domain-error";
import { decryptSecret } from "#/lib/secrets";
import { createAuditStatement } from "#/server/audit";
import type { RefundQueueMessage } from "#/server/queue/types";
import { loadRuntimeConfig } from "#/server/runtime-config";

const refundRequestSchema = z.object({
	orderId: z.string().uuid(),
	amountMinor: z.string().regex(/^\d+$/),
	reason: z.string().trim().min(1).max(2_000),
	idempotencyKey: z.string().trim().min(8).max(200),
});

export async function requestShopRefund(
	db: D1Database,
	rawInput: z.input<typeof refundRequestSchema>,
	context: { actorUserId: string; request: Request },
) {
	const input = refundRequestSchema.parse(rawInput);
	if (BigInt(input.amountMinor) === 0n)
		throw new DomainError(
			"refund_amount_invalid",
			400,
			"Refund amount must be positive",
		);
	const existing = await db
		.prepare("SELECT id, status FROM refunds WHERE idempotency_key = ? LIMIT 1")
		.bind(input.idempotencyKey)
		.first<{ id: string; status: string }>();
	if (existing) return { ...existing, duplicate: true };
	const order = await db
		.prepare(
			`SELECT o.id, o.status, o.version, o.currency, o.currency_decimals,
			 o.paid_minor, pa.id AS payment_attempt_id,
			 pa.amount_minor AS payment_amount_minor,
			 pa.currency AS payment_currency,
			 pa.currency_decimals AS payment_currency_decimals,
			 pa.exchange_rate, pa.exchange_rate_direction, pc.provider
			 FROM shop_orders o JOIN payment_attempts pa ON pa.id = (
			  SELECT id FROM payment_attempts WHERE order_id = o.id AND status = 'succeeded'
			  ORDER BY updated_at DESC, id DESC LIMIT 1
			 ) JOIN payment_channels pc ON pc.id = pa.channel_id
			 WHERE o.id = ? LIMIT 1`,
		)
		.bind(input.orderId)
		.first<RefundableOrder>();
	if (!order)
		throw new DomainError(
			"refund_payment_missing",
			409,
			"A completed payment is required",
		);
	if (
		!(["paid", "fulfilling", "completed", "failed"] as string[]).includes(
			order.status,
		)
	)
		throw new DomainError(
			"refund_order_unavailable",
			409,
			"Order cannot be refunded",
		);
	const reserved = await db
		.prepare(
			`SELECT amount_minor, payment_amount_minor FROM refunds WHERE order_id = ?
			 AND status IN ('pending', 'processing', 'succeeded')`,
		)
		.bind(order.id)
		.all<{ amount_minor: string; payment_amount_minor: string }>();
	const available =
		BigInt(order.paid_minor) -
		reserved.results.reduce(
			(total, row) => total + BigInt(row.amount_minor),
			0n,
		);
	if (BigInt(input.amountMinor) > available)
		throw new DomainError(
			"refund_amount_exceeded",
			409,
			"Refund amount exceeds the refundable balance",
		);
	const paymentAvailable =
		BigInt(order.payment_amount_minor) -
		reserved.results.reduce(
			(total, row) => total + BigInt(row.payment_amount_minor),
			0n,
		);
	const convertedPaymentAmount =
		BigInt(input.amountMinor) === available
			? paymentAvailable.toString()
			: convertMinorAmount({
					amountMinor: input.amountMinor,
					fromCurrency: order.currency,
					fromDecimals: order.currency_decimals,
					toCurrency: order.payment_currency,
					rate: order.exchange_rate,
					direction:
						order.exchange_rate_direction === "divide" ? "divide" : "multiply",
				}).amountMinor;
	if (
		BigInt(convertedPaymentAmount) === 0n ||
		BigInt(convertedPaymentAmount) > paymentAvailable
	)
		throw new DomainError(
			"refund_payment_amount_exceeded",
			409,
			"Converted refund exceeds the provider payment balance",
		);
	const id = crypto.randomUUID();
	const now = Date.now();
	const nextVersion = order.version + 1;
	const manual = getPaymentProvider(order.provider).refundMode === "manual";
	const statements: D1PreparedStatement[] = [
		db
			.prepare(
				`UPDATE shop_orders SET status = 'refunding', version = ?, updated_at = ?
				 WHERE id = ? AND status = ? AND version = ?`,
			)
			.bind(nextVersion, now, order.id, order.status, order.version),
		db
			.prepare(
				`INSERT INTO refunds
				 (id, order_id, payment_attempt_id, idempotency_key, amount_minor,
				  currency, payment_amount_minor, payment_currency,
				  payment_currency_decimals, order_status_before, status, reason, requested_by,
				  failure_code, attempt_count, next_attempt_at, created_at, updated_at)
				 SELECT ?, id, ?, ?, ?, currency, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?
				 FROM shop_orders WHERE id = ? AND status = 'refunding' AND version = ?`,
			)
			.bind(
				id,
				order.payment_attempt_id,
				input.idempotencyKey,
				input.amountMinor,
				convertedPaymentAmount,
				order.payment_currency,
				order.payment_currency_decimals,
				order.status,
				manual ? "processing" : "pending",
				input.reason,
				context.actorUserId,
				manual ? "manual_action_required" : null,
				now,
				now,
				now,
				order.id,
				nextVersion,
			),
		db
			.prepare(
				`INSERT INTO shop_order_events
				 (id, order_id, event_type, visibility, from_status, to_status,
				  order_version, note, actor_type, actor_user_id, created_at)
				 SELECT ?, id, 'refund_requested', 'customer', ?, 'refunding', ?, ?,
				 'admin', ?, ? FROM shop_orders
				 WHERE id = ? AND status = 'refunding' AND version = ?`,
			)
			.bind(
				crypto.randomUUID(),
				order.status,
				nextVersion,
				input.reason,
				context.actorUserId,
				now,
				order.id,
				nextVersion,
			),
		refundRequestedAuditStatement(db, context.request, context.actorUserId, {
			id,
			orderId: order.id,
			amountMinor: input.amountMinor,
			currency: order.currency,
			now,
		}),
	];
	if (!manual)
		statements.splice(
			3,
			0,
			refundOutboxStatement(db, id, "refund.requested", now, now),
		);
	const results = await db.batch(statements);
	if (Number(results[0]?.meta.changes ?? 0) !== 1)
		throw new DomainError(
			"order_version_conflict",
			409,
			"Order changed; refresh and retry",
		);
	return {
		id,
		status: manual ? ("processing" as const) : ("pending" as const),
		manualActionRequired: manual,
		duplicate: false,
	};
}

export async function publishPendingRefunds(
	db: D1Database,
	queue: Queue<RefundQueueMessage>,
	limit = 25,
) {
	const rows = await db
		.prepare(
			`SELECT id, aggregate_id FROM outbox_events
			 WHERE event_type IN ('refund.requested', 'refund.check') AND status = 'pending'
			 AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
			 ORDER BY created_at, id LIMIT ?`,
		)
		.bind(Date.now(), Math.max(1, Math.min(100, Math.trunc(limit))))
		.all<{ id: string; aggregate_id: string }>();
	if (!rows.results.length) return { published: 0 };
	await queue.sendBatch(
		rows.results.map((row) => ({
			body: {
				kind: "commerce.refund",
				version: 1,
				refundId: row.aggregate_id,
			},
		})),
	);
	const now = Date.now();
	await db.batch(
		rows.results.map((row) =>
			db
				.prepare(
					`UPDATE outbox_events SET status = 'published', published_at = ?,
					 updated_at = ? WHERE id = ? AND status = 'pending'`,
				)
				.bind(now, now, row.id),
		),
	);
	return { published: rows.results.length };
}

export async function retryShopRefund(
	db: D1Database,
	refundId: string,
	context: { actorUserId: string; request: Request },
) {
	const refund = await db
		.prepare(
			`SELECT r.id, r.status, r.order_id, o.status AS order_status
			 FROM refunds r JOIN shop_orders o ON o.id = r.order_id WHERE r.id = ? LIMIT 1`,
		)
		.bind(refundId)
		.first<{
			id: string;
			status: string;
			order_id: string;
			order_status: ShopOrderStatus;
		}>();
	if (!refund)
		throw new DomainError("refund_not_found", 404, "Refund not found");
	if (refund.status !== "failed")
		throw new DomainError(
			"refund_not_retryable",
			409,
			"Refund is not retryable",
		);
	const now = Date.now();
	await db.batch([
		db
			.prepare(
				`UPDATE shop_orders SET status = 'refunding', version = version + 1,
				 updated_at = ? WHERE id = ? AND status <> 'refunding'`,
			)
			.bind(now, refund.order_id),
		db
			.prepare(
				`UPDATE refunds SET status = 'pending', failure_code = NULL,
				 next_attempt_at = ?, updated_at = ? WHERE id = ? AND status = 'failed'`,
			)
			.bind(now, now, refund.id),
		db
			.prepare(
				`INSERT INTO outbox_events
				 (id, event_type, aggregate_type, aggregate_id, idempotency_key, payload,
				  status, attempt_count, next_attempt_at, created_at, updated_at)
				 VALUES (?, 'refund.requested', 'refund', ?, ?, ?, 'pending', 0, ?, ?, ?)`,
			)
			.bind(
				crypto.randomUUID(),
				refund.id,
				`refund-manual-retry:${refund.id}:${now}`,
				JSON.stringify({ refundId: refund.id }),
				now,
				now,
				now,
			),
		createAuditStatement(db, context.request, context.actorUserId, {
			action: "refund.retried",
			targetType: "refund",
			targetId: refund.id,
			before: { status: refund.status, orderStatus: refund.order_status },
			after: { status: "pending", orderStatus: "refunding" },
		}),
	]);
	return { id: refund.id, status: "pending" as const };
}

export async function processShopRefund(
	db: D1Database,
	refundId: string,
	fetcher: typeof fetch = fetch,
) {
	const refund = await loadRefund(db, refundId);
	if (!refund)
		throw new DomainError("refund_not_found", 404, "Refund not found");
	if (["succeeded", "cancelled"].includes(refund.status))
		return { id: refund.id, status: refund.status, duplicate: true };
	const runtime = await loadRuntimeConfig(db);
	if (!runtime.commerceSecret || !refund.credential_encrypted)
		throw new DomainError(
			"payment_secret_unavailable",
			503,
			"Payment configuration unavailable",
		);
	const credential: unknown = JSON.parse(
		await decryptSecret(
			refund.credential_encrypted,
			runtime.commerceSecret,
			"payment-credential",
		),
	);
	const adapter = getPaymentProvider(refund.provider);
	const attempt = refund.attempt_count + 1;
	await db
		.prepare(
			`UPDATE refunds SET status = 'processing', attempt_count = ?,
			 next_attempt_at = NULL, updated_at = ? WHERE id = ?
			 AND status IN ('pending', 'processing', 'failed')`,
		)
		.bind(attempt, Date.now(), refund.id)
		.run();
	try {
		const result = refund.provider_refund_id
			? await adapter.queryRefund(
					refund.provider_refund_id,
					credential,
					fetcher,
				)
			: await adapter.refundPayment(
					{
						refundId: refund.id,
						providerPaymentId: refund.provider_payment_id,
						amountMinor: refund.payment_amount_minor,
						reason: refund.reason,
					},
					credential,
					fetcher,
				);
		if (result.status === "pending")
			return scheduleRefundCheck(
				db,
				refund.id,
				result.providerRefundId,
				attempt,
			);
		return finalizeRefund(
			db,
			refund,
			result.status,
			result.failureCode,
			result.providerRefundId,
		);
	} catch {
		return recordRefundProviderFailure(db, refund, attempt);
	}
}

async function loadRefund(db: D1Database, id: string) {
	return db
		.prepare(
			`SELECT r.*, o.status AS order_status, o.version AS order_version,
			 o.paid_minor, pa.provider_payment_id, pc.provider, pc.credential_encrypted
			 FROM refunds r JOIN shop_orders o ON o.id = r.order_id
			 JOIN payment_attempts pa ON pa.id = r.payment_attempt_id
			 JOIN payment_channels pc ON pc.id = pa.channel_id
			 WHERE r.id = ? LIMIT 1`,
		)
		.bind(id)
		.first<RefundContext>();
}

export async function completeManualShopRefund(
	db: D1Database,
	refundId: string,
	reference: string,
	context: { actorUserId: string; request: Request },
) {
	const refund = await loadRefund(db, refundId);
	if (!refund)
		throw new DomainError("refund_not_found", 404, "Refund not found");
	if (refund.status === "succeeded")
		return { id: refund.id, status: "succeeded" as const, duplicate: true };
	if (
		getPaymentProvider(refund.provider).refundMode !== "manual" ||
		refund.status !== "processing" ||
		refund.failure_code !== "manual_action_required"
	)
		throw new DomainError(
			"refund_manual_confirmation_unavailable",
			409,
			"Refund does not require manual confirmation",
		);
	const normalizedReference = reference.trim();
	if (!normalizedReference || normalizedReference.length > 200)
		throw new DomainError(
			"refund_reference_invalid",
			400,
			"External refund reference is required",
		);
	return finalizeRefund(
		db,
		refund,
		"succeeded",
		null,
		`manual:${normalizedReference}`,
		context,
	);
}

async function scheduleRefundCheck(
	db: D1Database,
	id: string,
	providerRefundId: string,
	attempt: number,
) {
	const now = Date.now();
	const nextAttemptAt =
		now + Math.min(3_600_000, 30_000 * 2 ** Math.min(attempt - 1, 6));
	await db.batch([
		db
			.prepare(
				`UPDATE refunds SET status = 'processing', provider_refund_id = ?,
				 next_attempt_at = ?, failure_code = NULL, updated_at = ? WHERE id = ?`,
			)
			.bind(providerRefundId, nextAttemptAt, now, id),
		refundOutboxStatement(db, id, "refund.check", now, nextAttemptAt, attempt),
	]);
	return { id, status: "processing" as const, duplicate: false };
}

async function recordRefundProviderFailure(
	db: D1Database,
	refund: RefundContext,
	attempt: number,
) {
	const now = Date.now();
	if (attempt < 5) {
		const nextAttemptAt =
			now + Math.min(3_600_000, 10_000 * 2 ** (attempt - 1));
		await db.batch([
			db
				.prepare(
					`UPDATE refunds SET status = 'failed', failure_code = 'provider_unavailable',
					 next_attempt_at = ?, updated_at = ? WHERE id = ?`,
				)
				.bind(nextAttemptAt, now, refund.id),
			refundOutboxStatement(
				db,
				refund.id,
				"refund.requested",
				now,
				nextAttemptAt,
				attempt,
			),
		]);
		return { id: refund.id, status: "retrying" as const, duplicate: false };
	}
	return finalizeRefund(
		db,
		refund,
		"failed",
		"provider_unavailable",
		refund.provider_refund_id,
	);
}

async function finalizeRefund(
	db: D1Database,
	refund: RefundContext,
	status: "succeeded" | "failed" | "cancelled",
	failureCode: string | null,
	providerRefundId: string | null,
	actor?: { actorUserId: string; request: Request },
) {
	const now = Date.now();
	const succeeded = await db
		.prepare(
			`SELECT amount_minor FROM refunds WHERE order_id = ? AND status = 'succeeded'
			 AND id <> ?`,
		)
		.bind(refund.order_id, refund.id)
		.all<{ amount_minor: string }>();
	const refundedMinor = succeeded.results.reduce(
		(total, row) => total + BigInt(row.amount_minor),
		status === "succeeded" ? BigInt(refund.amount_minor) : 0n,
	);
	const orderStatus: ShopOrderStatus =
		status === "succeeded" && refundedMinor >= BigInt(refund.paid_minor)
			? "refunded"
			: refund.order_status_before;
	const statements: D1PreparedStatement[] = [
		db
			.prepare(
				`UPDATE refunds SET status = ?, provider_refund_id = ?, failure_code = ?, next_attempt_at = NULL,
				 completed_at = ?, updated_at = ? WHERE id = ? AND status IN ('processing', 'failed')`,
			)
			.bind(status, providerRefundId, failureCode, now, now, refund.id),
		db
			.prepare(
				`UPDATE shop_orders SET status = ?, version = version + 1,
				 refunded_at = CASE WHEN ? = 'refunded' THEN ? ELSE refunded_at END,
				 updated_at = ? WHERE id = ?`,
			)
			.bind(orderStatus, orderStatus, now, now, refund.order_id),
		db
			.prepare(
				`INSERT INTO shop_order_events
				 (id, order_id, event_type, visibility, from_status, to_status,
				  order_version, note, actor_type, actor_user_id, created_at)
				 SELECT ?, id, ?, 'customer', 'refunding', ?, version, ?, ?, ?, ?
				 FROM shop_orders WHERE id = ? AND status = ?`,
			)
			.bind(
				crypto.randomUUID(),
				status === "succeeded" ? "refund_succeeded" : "refund_failed",
				orderStatus,
				failureCode,
				actor ? "admin" : "provider",
				actor?.actorUserId ?? null,
				now,
				refund.order_id,
				orderStatus,
			),
		refundOutboxStatement(
			db,
			refund.id,
			status === "succeeded" ? "refund.succeeded" : "refund.failed",
			now,
			now,
		),
		actor
			? createAuditStatement(db, actor.request, actor.actorUserId, {
					action: "refund.manual_completed",
					targetType: "refund",
					targetId: refund.id,
					after: { status, orderStatus, providerRefundId },
				})
			: db
					.prepare(
						`INSERT INTO audit_logs
						 (id, action, target_type, target_id, after, created_at)
						 VALUES (?, 'refund.processed', 'refund', ?, ?, ?)`,
					)
					.bind(
						crypto.randomUUID(),
						refund.id,
						JSON.stringify({
							status,
							orderStatus,
							failureCode,
							providerRefundId,
						}),
						now,
					),
	];
	if (status === "succeeded" && orderStatus === "refunded")
		statements.push(
			...(await refundEntitlementGrantStatements(db, refund.order_id, now)),
			db
				.prepare(
					`UPDATE supplier_orders SET state = 'refunded',
					 next_retry_at = NULL, updated_at = ?
					 WHERE order_id = ? AND state <> 'refunded'`,
				)
				.bind(now, refund.order_id),
			db
				.prepare(
					`UPDATE outbox_events SET status = 'published',
					 published_at = COALESCE(published_at, ?), updated_at = ?
					 WHERE event_type = 'supplier.requested'
					  AND aggregate_id IN (
					   SELECT id FROM supplier_orders WHERE order_id = ?
					  ) AND status IN ('pending', 'processing')`,
				)
				.bind(now, now, refund.order_id),
		);
	const results = await db.batch(statements);
	if (Number(results[0]?.meta.changes ?? 0) !== 1)
		return { id: refund.id, status, duplicate: true };
	return { id: refund.id, status, duplicate: false };
}

function refundOutboxStatement(
	db: D1Database,
	refundId: string,
	eventType: string,
	now: number,
	nextAttemptAt: number,
	attempt = 0,
) {
	return db
		.prepare(
			`INSERT INTO outbox_events
			 (id, event_type, aggregate_type, aggregate_id, idempotency_key, payload,
			  status, attempt_count, next_attempt_at, created_at, updated_at)
			 SELECT ?, ?, 'refund', id, ?, ?, 'pending', 0, ?, ?, ?
			 FROM refunds WHERE id = ?
			 ON CONFLICT(idempotency_key) DO NOTHING`,
		)
		.bind(
			crypto.randomUUID(),
			eventType,
			`${eventType}:${refundId}:${attempt}`,
			JSON.stringify({ refundId }),
			nextAttemptAt,
			now,
			now,
			refundId,
		);
}

function refundRequestedAuditStatement(
	db: D1Database,
	request: Request,
	actorUserId: string,
	refund: {
		id: string;
		orderId: string;
		amountMinor: string;
		currency: string;
		now: number;
	},
) {
	return db
		.prepare(
			`INSERT INTO audit_logs
			 (id, actor_user_id, action, target_type, target_id, request_id,
			  ip_address, before, after, created_at)
			 SELECT ?, ?, 'refund.requested', 'refund', id, ?, ?, NULL, ?, ?
			 FROM refunds WHERE id = ?`,
		)
		.bind(
			crypto.randomUUID(),
			actorUserId,
			request.headers.get("x-request-id"),
			request.headers.get("cf-connecting-ip"),
			JSON.stringify({
				orderId: refund.orderId,
				amountMinor: refund.amountMinor,
				currency: refund.currency,
			}),
			refund.now,
			refund.id,
		);
}

type RefundableOrder = {
	id: string;
	status: ShopOrderStatus;
	version: number;
	currency: string;
	currency_decimals: number;
	paid_minor: string;
	payment_attempt_id: string;
	payment_amount_minor: string;
	payment_currency: string;
	payment_currency_decimals: number;
	exchange_rate: string;
	exchange_rate_direction: "parity" | "multiply" | "divide";
	provider: string;
};

type RefundContext = {
	id: string;
	order_id: string;
	payment_attempt_id: string;
	provider_refund_id: string | null;
	failure_code: string | null;
	amount_minor: string;
	currency: string;
	payment_amount_minor: string;
	payment_currency: string;
	payment_currency_decimals: number;
	order_status_before: ShopOrderStatus;
	status: string;
	reason: string;
	attempt_count: number;
	order_status: ShopOrderStatus;
	order_version: number;
	paid_minor: string;
	provider_payment_id: string;
	provider: string;
	credential_encrypted: string | null;
};
