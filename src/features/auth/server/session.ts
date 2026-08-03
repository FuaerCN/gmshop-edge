import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { AccessDeniedError } from "#/features/access/server/access-cache";
import { loadAdminBootstrap } from "#/features/auth/server/admin-bootstrap";

export const getAdminBootstrapFn = createServerFn({ method: "GET" }).handler(
	() => loadAdminBootstrap(getRequest()),
);

export const getStorefrontAdminEntryFn = createServerFn({
	method: "GET",
}).handler(async () => {
	try {
		const bootstrap = await loadAdminBootstrap(getRequest());
		return { root: bootstrap.installed && bootstrap.access?.root === true };
	} catch (error) {
		if (error instanceof AccessDeniedError) return { root: false };
		throw error;
	}
});
