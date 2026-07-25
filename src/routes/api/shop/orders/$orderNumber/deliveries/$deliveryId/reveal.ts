import { createFileRoute } from "@tanstack/react-router";
import { storeDeliveryRevealResponse } from "#/features/storefront/server/delivery-response";
import { getEnv } from "#/server/db.server";

export const Route = createFileRoute(
	"/api/shop/orders/$orderNumber/deliveries/$deliveryId/reveal",
)({
	server: {
		handlers: {
			POST: ({ request, params }) =>
				storeDeliveryRevealResponse(
					request,
					params.orderNumber,
					params.deliveryId,
					getEnv().DB,
				),
		},
	},
});
