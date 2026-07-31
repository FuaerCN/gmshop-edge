import { createFileRoute } from "@tanstack/react-router";
import {
	processTelegramWebhook,
	TelegramWebhookError,
} from "#/features/telegram/server/webhook";
import { getEnv } from "#/server/db.server";

const maximumBodyBytes = 256 * 1024;

export const Route = createFileRoute("/api/telegram/webhook")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				if (
					!request.headers.get("content-type")?.startsWith("application/json")
				)
					return Response.json(
						{ code: "unsupported_media_type" },
						{ status: 415 },
					);
				if (
					Number(request.headers.get("content-length") ?? 0) > maximumBodyBytes
				)
					return Response.json({ code: "request_too_large" }, { status: 413 });
				const body = await request.text();
				if (new TextEncoder().encode(body).byteLength > maximumBodyBytes)
					return Response.json({ code: "request_too_large" }, { status: 413 });
				try {
					const result = await processTelegramWebhook(
						getEnv().DB,
						body,
						request.headers.get("x-telegram-bot-api-secret-token") ?? "",
					);
					return Response.json(result);
				} catch (error) {
					if (error instanceof TelegramWebhookError)
						return Response.json(
							{ code: error.code },
							{ status: error.status },
						);
					throw error;
				}
			},
		},
	},
});
