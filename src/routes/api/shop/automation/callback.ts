import { createFileRoute } from "@tanstack/react-router";
import { processAutomationCallback } from "#/features/builds/server/callback";
import { DomainError } from "#/lib/domain-error";
import { getEnv } from "#/server/db.server";

export const Route = createFileRoute("/api/shop/automation/callback")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				if (Number(request.headers.get("content-length") ?? 0) > 64 * 1024)
					return Response.json({ code: "request_too_large" }, { status: 413 });
				try {
					const result = await processAutomationCallback(
						getEnv().DB,
						await request.text(),
						request.headers.get("x-gmshop-signature") ?? "",
					);
					return Response.json(result);
				} catch (error) {
					return errorResponse(error);
				}
			},
		},
	},
});

function errorResponse(error: unknown) {
	const status = error instanceof DomainError ? error.status : 400;
	const code = error instanceof DomainError ? error.code : "invalid_request";
	return Response.json({ code }, { status });
}
