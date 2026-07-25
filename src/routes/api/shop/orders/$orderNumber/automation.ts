import { createFileRoute } from "@tanstack/react-router";
import { createBuildJob } from "#/features/builds/server/jobs";
import { publishPendingBuilds } from "#/features/builds/server/outbox";
import { resolveStoreAccount } from "#/features/storefront/server/account";
import { DomainError } from "#/lib/domain-error";
import { getEnv } from "#/server/db.server";

export const Route = createFileRoute(
	"/api/shop/orders/$orderNumber/automation",
)({
	server: {
		handlers: {
			POST: async ({ request, params }) => {
				if (Number(request.headers.get("content-length") ?? 0) > 128 * 1024)
					return Response.json({ code: "request_too_large" }, { status: 413 });
				try {
					const body: unknown = await request.json();
					const input =
						typeof body === "object" && body !== null
							? { ...body, orderNumber: params.orderNumber }
							: body;
					const env = getEnv();
					const account = await resolveStoreAccount(env.DB, request);
					const result = await createBuildJob(env.DB, input, {
						userId: account?.user.id,
						actorUserId: account?.user.id,
						request,
					});
					await publishPendingBuilds(env.DB, env.COMMERCE_QUEUE);
					return Response.json(result, {
						status: result.duplicate ? 200 : 201,
						headers: { "Cache-Control": "private, no-store" },
					});
				} catch (error) {
					const status = error instanceof DomainError ? error.status : 400;
					const code =
						error instanceof DomainError ? error.code : "invalid_request";
					return Response.json(
						{ code },
						{ status, headers: { "Cache-Control": "private, no-store" } },
					);
				}
			},
		},
	},
});
