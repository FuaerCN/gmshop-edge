import { createFileRoute } from "@tanstack/react-router";
import { retryBuildJob } from "#/features/builds/server/job-actions";
import { publishPendingBuilds } from "#/features/builds/server/outbox";
import { resolveStoreAccount } from "#/features/storefront/server/account";
import { getStoreOrder } from "#/features/storefront/server/order-query";
import { DomainError } from "#/lib/domain-error";
import { getEnv } from "#/server/db.server";

export const Route = createFileRoute(
	"/api/shop/orders/$orderNumber/automation/$jobId/retry",
)({
	server: {
		handlers: {
			POST: async ({ request, params }) => {
				try {
					const env = getEnv();
					const account = await resolveStoreAccount(env.DB, request);
					const order = await getStoreOrder(
						env.DB,
						{ orderNumber: params.orderNumber },
						{ userId: account?.user.id },
					);
					const result = await retryBuildJob(env.DB, params.jobId, {
						orderId: order.id,
						actorUserId: account?.user.id ?? null,
						request,
					});
					await publishPendingBuilds(env.DB, env.COMMERCE_QUEUE);
					return Response.json(result, {
						headers: { "Cache-Control": "private, no-store" },
					});
				} catch (error) {
					return Response.json(
						{
							code:
								error instanceof DomainError ? error.code : "invalid_request",
						},
						{
							status: error instanceof DomainError ? error.status : 400,
							headers: { "Cache-Control": "private, no-store" },
						},
					);
				}
			},
		},
	},
});
