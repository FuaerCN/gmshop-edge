import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { closeWebSupportConversation } from "#/features/telegram/server/web-support";
import {
	readWebSupportBody,
	webSupportResponse,
} from "#/features/telegram/server/web-support-route";
import { getEnv } from "#/server/db.server";

export const Route = createFileRoute("/api/support/web/close")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					await readWebSupportBody(request, z.object({}));
					return Response.json(
						await closeWebSupportConversation(getEnv().DB, request),
					);
				} catch (error) {
					return webSupportResponse(error);
				}
			},
		},
	},
});
