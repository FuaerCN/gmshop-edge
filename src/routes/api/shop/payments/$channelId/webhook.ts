import { createFileRoute } from "@tanstack/react-router";
import { handleShopPaymentWebhookRequest } from "#/features/shop-payments/server/webhook";
import { getEnv } from "#/server/db.server";

export const Route = createFileRoute("/api/shop/payments/$channelId/webhook")({
	server: {
		handlers: {
			GET: ({ request, params }) =>
				handleShopPaymentWebhookRequest(request, params.channelId, getEnv()),
			POST: ({ request, params }) =>
				handleShopPaymentWebhookRequest(request, params.channelId, getEnv()),
		},
	},
});
