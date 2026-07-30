import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { AccessDeniedError } from "#/features/access/server/access-cache";
import {
	type AdminSessionUser,
	getAdminPermissions,
	requireAdmin,
} from "#/features/access/server/require-admin";
import {
	hasSystemPermission,
	type SystemPermission,
} from "#/features/access/system-rbac";
import { getCloudflareEnv, getDb } from "./db.server";
import { loadRequestRuntimeConfig } from "./runtime-config";

export const getAdminServerContext = createServerOnlyFn(
	async (permission: SystemPermission) => {
		const request = getRequest();
		const currentUser = await requireAdmin(request, permission);

		return {
			request,
			currentUser,
			db: getDb(request),
		};
	},
);

export const getAdminServerContextAny = createServerOnlyFn(
	async (permissions: readonly SystemPermission[]) => {
		const request = getRequest();
		const currentUser = await getAdminPermissions(request);
		if (
			!permissions.some((permission) =>
				hasSystemPermission(currentUser.permissions, permission),
			)
		)
			throw new AccessDeniedError(403);
		return {
			request,
			currentUser,
			db: getDb(request),
		};
	},
);

export const getAdminRuntimeServerContext = createServerOnlyFn(
	async (permission: SystemPermission) => {
		const request = getRequest();
		const currentUser = await requireAdmin(request, permission);
		const env = getCloudflareEnv(request);
		if (!env.DB) throw new Error("D1 binding DB is unavailable");
		const runtime = await loadRequestRuntimeConfig(
			request,
			env.DB,
			new URL(request.url).origin,
		);
		return {
			request,
			currentUser: currentUser as AdminSessionUser,
			db: env.DB,
			env,
			runtime,
		};
	},
);
