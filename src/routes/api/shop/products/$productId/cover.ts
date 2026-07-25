import { createFileRoute } from "@tanstack/react-router";
import { productCoverResponse } from "#/features/storefront/server/product-cover";
import { getEnv } from "#/server/db.server";

export const Route = createFileRoute("/api/shop/products/$productId/cover")({
	server: {
		handlers: {
			GET: ({ request, params }) => {
				const env = getEnv();
				return productCoverResponse(
					request,
					params.productId,
					env.DB,
					env.FILES,
				);
			},
		},
	},
});
