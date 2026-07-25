import { createFileRoute } from "@tanstack/react-router";
import { cancelBuildJob } from "#/features/builds/server/job-actions";
import { resolveStoreAccount } from "#/features/storefront/server/account";
import { getStoreOrder } from "#/features/storefront/server/order-query";
import { DomainError } from "#/lib/domain-error";
import { getEnv } from "#/server/db.server";

export const Route = createFileRoute(
	"/api/shop/orders/$orderNumber/automation/$jobId/cancel",
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
					const result = await cancelBuildJob(env.DB, params.jobId, {
						orderId: order.id,
						actorUserId: account?.user.id ?? null,
						request,
					});
					return Response.json(result, { headers: noStoreHeaders });
				} catch (error) {
					return actionError(error);
				}
			},
		},
	},
});

function actionError(error: unknown) {
	return Response.json(
		{ code: error instanceof DomainError ? error.code : "invalid_request" },
		{
			status: error instanceof DomainError ? error.status : 400,
			headers: noStoreHeaders,
		},
	);
}

const noStoreHeaders = { "Cache-Control": "private, no-store" };
