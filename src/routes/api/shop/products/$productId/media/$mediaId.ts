import { createFileRoute } from "@tanstack/react-router";
import { productMediaResponse } from "#/features/storefront/server/product-media";
import { getEnv } from "#/server/db.server";

export const Route = createFileRoute(
	"/api/shop/products/$productId/media/$mediaId",
)({
	server: {
		handlers: {
			GET: ({ request, params }) => {
				const env = getEnv();
				return productMediaResponse(
					request,
					params.productId,
					params.mediaId,
					env.DB,
					env.FILES,
				);
			},
		},
	},
});
