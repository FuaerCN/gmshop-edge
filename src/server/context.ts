import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import {
	type AdminSessionUser,
	requireAdmin,
} from "#/features/access/server/require-admin";
import type { SystemPermission } from "#/features/access/system-rbac";
import { getCloudflareEnv, getDb } from "./db.server";
import { loadRequestRuntimeConfig } from "./runtime-config";

export const getAdminServerContext = createServerOnlyFn(
	async (permission: SystemPermission) => {
		const request = getRequest();
		const currentUser = await requireAdmin(request, permission);

		return {
			request,
			currentUser: currentUser as AdminSessionUser,
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
