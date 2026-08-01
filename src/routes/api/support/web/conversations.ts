import { createFileRoute } from "@tanstack/react-router";
import {
	createWebSupportConversation,
	webSupportCookie,
} from "#/features/telegram/server/web-support";
import {
	readWebSupportBody,
	webSupportResponse,
} from "#/features/telegram/server/web-support-route";
import { webSupportConversationSchema } from "#/features/telegram/web-support-contract";
import { getEnv } from "#/server/db.server";

export const Route = createFileRoute("/api/support/web/conversations")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const input = await readWebSupportBody(
						request,
						webSupportConversationSchema,
					);
					const result = await createWebSupportConversation(
						getEnv().DB,
						request,
						input,
					);
					const headers = new Headers();
					if (result.sessionToken)
						headers.set("set-cookie", webSupportCookie(result.sessionToken));
					return Response.json(
						{ id: result.id, status: result.status },
						{ headers },
					);
				} catch (error) {
					return webSupportResponse(error);
				}
			},
		},
	},
});
