import { createFileRoute } from "@tanstack/react-router";
import {
	configurationLogoResponse,
	resolvePublicConfigurationLogoKey,
} from "#/server/configuration-logo";
import { getEnv } from "#/server/db.server";

export const Route = createFileRoute("/api/configuration-logo/$scope/$id")({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				const env = getEnv();
				const key = await resolvePublicConfigurationLogoKey(
					env.DB,
					params.scope,
					params.id,
				);
				return configurationLogoResponse(request, env.FILES, key);
			},
		},
	},
});
