import { createFileRoute } from "@tanstack/react-router";
import { webSupportStatus } from "#/features/telegram/server/web-support";
import { webSupportResponse } from "#/features/telegram/server/web-support-route";
import { getEnv } from "#/server/db.server";

export const Route = createFileRoute("/api/support/web/status")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				try {
					return Response.json(await webSupportStatus(getEnv().DB, request));
				} catch (error) {
					return webSupportResponse(error);
				}
			},
		},
	},
});
