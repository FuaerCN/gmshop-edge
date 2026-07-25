import { publishPendingBuilds } from "#/features/builds/server/outbox";
import { publishPendingDeliveries } from "#/features/fulfillment/server/outbox";
import { publishPendingNotifications } from "#/features/notifications/server/delivery";
import { fanOutPendingCommerceNotifications } from "#/features/notifications/server/fanout";
import { publishPendingRefunds } from "#/features/shop-payments/server/refunds";

export async function retryQueueWorkload(
	env: Env,
	context: {
		actorUserId: string;
		requestId?: string | null;
		ipAddress?: string | null;
		now?: number;
	},
) {
	const now = context.now ?? Date.now();
	const fanout = await fanOutPendingCommerceNotifications(env.DB, 50);
	const [deliveries, builds, refunds, notifications] = await Promise.all([
		publishPendingDeliveries(env.DB, env.COMMERCE_QUEUE, 50),
		publishPendingBuilds(env.DB, env.COMMERCE_QUEUE, 50),
		publishPendingRefunds(env.DB, env.COMMERCE_QUEUE, 50),
		publishPendingNotifications(env.DB, env.COMMERCE_QUEUE, 50),
	]);
	const queued =
		deliveries.published +
		builds.published +
		refunds.published +
		notifications.published;
	await env.DB.prepare(
		`INSERT INTO audit_logs
		 (id, actor_user_id, action, target_type, target_id, request_id,
		  ip_address, after, created_at)
		 VALUES (?, ?, 'queue.manual_retry', 'queue', 'commerce', ?, ?, ?, ?)`,
	)
		.bind(
			crypto.randomUUID(),
			context.actorUserId,
			context.requestId ?? null,
			context.ipAddress ?? null,
			JSON.stringify({ queued, fanout }),
			now,
		)
		.run();
	return { queued, fanout };
}
