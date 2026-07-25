import { z } from "zod";
import type { DeliveryQueueMessage } from "#/server/queue/types";

const deliveryPayloadSchema = z.object({
	deliveryId: z.string().min(1).max(128),
	orderItemId: z.string().min(1).max(128),
});

export async function publishPendingDeliveries(
	db: D1Database,
	queue: Queue<DeliveryQueueMessage>,
	limit = 25,
) {
	const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
	const rows = await db
		.prepare(
			`SELECT id, payload FROM outbox_events
			 WHERE event_type = 'delivery.requested' AND status = 'pending'
			 AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
			 ORDER BY created_at, id LIMIT ?`,
		)
		.bind(Date.now(), boundedLimit)
		.all<{ id: string; payload: string }>();
	if (rows.results.length === 0) return { published: 0 };
	const messages = rows.results.map((row) => {
		const payload = deliveryPayloadSchema.parse(JSON.parse(row.payload));
		return {
			outboxId: row.id,
			body: {
				kind: "commerce.delivery",
				version: 1,
				deliveryId: payload.deliveryId,
			} satisfies DeliveryQueueMessage,
		};
	});
	await queue.sendBatch(messages.map(({ body }) => ({ body })));
	const now = Date.now();
	await db.batch(
		messages.map(({ outboxId }) =>
			db
				.prepare(
					`UPDATE outbox_events SET status = 'published', published_at = ?,
					 updated_at = ? WHERE id = ? AND status = 'pending'`,
				)
				.bind(now, now, outboxId),
		),
	);
	return { published: messages.length };
}
