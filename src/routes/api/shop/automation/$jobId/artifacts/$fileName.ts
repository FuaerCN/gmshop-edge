import { createFileRoute } from "@tanstack/react-router";
import { uploadAutomationArtifact } from "#/features/builds/server/callback";
import { DomainError } from "#/lib/domain-error";
import { getEnv } from "#/server/db.server";

export const Route = createFileRoute(
	"/api/shop/automation/$jobId/artifacts/$fileName",
)({
	server: {
		handlers: {
			POST: async ({ request, params }) => {
				if (
					Number(request.headers.get("content-length") ?? 0) >
					100 * 1024 * 1024
				)
					return Response.json({ code: "request_too_large" }, { status: 413 });
				try {
					const env = getEnv();
					const result = await uploadAutomationArtifact(
						env.DB,
						env.FILES,
						{
							jobId: params.jobId,
							artifactId: request.headers.get("x-gmshop-artifact-id") ?? "",
							fileName: params.fileName,
							contentType:
								request.headers.get("content-type") ??
								"application/octet-stream",
						},
						await request.arrayBuffer(),
						request.headers.get("x-gmshop-signature") ?? "",
					);
					return Response.json(result, {
						status: result.duplicate ? 200 : 201,
					});
				} catch (error) {
					const status = error instanceof DomainError ? error.status : 400;
					const code =
						error instanceof DomainError ? error.code : "invalid_request";
					return Response.json({ code }, { status });
				}
			},
		},
	},
});
