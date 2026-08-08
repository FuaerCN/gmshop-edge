import { createFileRoute } from "@tanstack/react-router";
import {
	createAdminDownloadAsset,
	listAdminDownloadAssets,
	updateAdminDownloadAsset,
} from "#/features/fulfillment/server/download-assets-admin";

export const Route = createFileRoute("/api/admin/download-assets")({
	server: {
		handlers: {
			GET: ({ request }) => listAdminDownloadAssets(request),
			POST: ({ request }) => createAdminDownloadAsset(request),
			PATCH: ({ request }) => updateAdminDownloadAsset(request),
		},
	},
});
