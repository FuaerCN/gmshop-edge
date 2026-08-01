import { createFileRoute } from "@tanstack/react-router";
import { sendWebSupportMessage } from "#/features/telegram/server/web-support";
import {
	readWebSupportBody,
	webSupportResponse,
} from "#/features/telegram/server/web-support-route";
import { webSupportMessageSchema } from "#/features/telegram/web-support-contract";
import { getEnv } from "#/server/db.server";

export const Route = createFileRoute("/api/support/web/messages")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					return Response.json(
						await sendWebSupportMessage(
							getEnv().DB,
							request,
							await readWebSupportBody(request, webSupportMessageSchema),
						),
					);
				} catch (error) {
					return webSupportResponse(error);
				}
			},
		},
	},
});
