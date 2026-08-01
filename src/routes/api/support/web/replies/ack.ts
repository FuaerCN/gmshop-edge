import { createFileRoute } from "@tanstack/react-router";
import { acknowledgeWebSupportReplies } from "#/features/telegram/server/web-support";
import {
	readWebSupportBody,
	webSupportResponse,
} from "#/features/telegram/server/web-support-route";
import { webSupportAckSchema } from "#/features/telegram/web-support-contract";
import { getEnv } from "#/server/db.server";

export const Route = createFileRoute("/api/support/web/replies/ack")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const input = await readWebSupportBody(request, webSupportAckSchema);
					return Response.json(
						await acknowledgeWebSupportReplies(getEnv().DB, request, input.ids),
					);
				} catch (error) {
					return webSupportResponse(error);
				}
			},
		},
	},
});
