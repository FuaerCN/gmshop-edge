import { createFileRoute } from "@tanstack/react-router";
import { resolveStoreAccount } from "#/features/storefront/server/account";
import { storeAutomationArtifactResponse } from "#/features/storefront/server/build-artifact-response";
import { DomainError } from "#/lib/domain-error";
import { getEnv } from "#/server/db.server";

export const Route = createFileRoute(
	"/api/shop/orders/$orderNumber/automation/$jobId/artifacts/$artifactId",
)({
	server: {
		handlers: {
			POST: async ({ request, params }) => {
				if (Number(request.headers.get("content-length") ?? 0) > 4_096)
					return Response.json({ code: "request_too_large" }, { status: 413 });
				try {
					const env = getEnv();
					const account = await resolveStoreAccount(env.DB, request);
					return await storeAutomationArtifactResponse(
						request,
						{
							orderNumber: params.orderNumber,
							automationJobId: params.jobId,
							artifactId: params.artifactId,
						},
						env.DB,
						env.FILES,
						{ userId: account?.user.id },
					);
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
