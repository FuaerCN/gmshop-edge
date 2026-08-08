import { createFileRoute } from "@tanstack/react-router";
import { handleSupplierApiRequest } from "#/features/supplier-api/server/http";
import { getCloudflareEnv } from "#/server/db.server";

export const Route = createFileRoute("/api/v1/supplier/$")({
	server: {
		handlers: {
			GET: ({ request }) =>
				handleSupplierApiRequest(request, getCloudflareEnv(request).DB),
			POST: ({ request }) =>
				handleSupplierApiRequest(request, getCloudflareEnv(request).DB),
		},
	},
});
