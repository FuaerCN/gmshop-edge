import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireAdmin } from "#/features/access/server/require-admin";
import { systemPermission } from "#/features/access/system-rbac";
import { queryAdminDashboard } from "#/features/dashboard/server/query";
import { getCloudflareEnv } from "#/server/db.server";

const dashboardRangeSchema = z.object({
	days: z
		.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90)])
		.default(30),
});

export const getAdminDashboardFn = createServerFn({ method: "GET" })
	.validator((input: z.input<typeof dashboardRangeSchema>) =>
		dashboardRangeSchema.parse(input),
	)
	.handler(async ({ data }) => {
		const request = getRequest();
		await requireAdmin(request, systemPermission("dashboard", "read"));
		const db = getCloudflareEnv(request).DB;
		if (!db) throw new Error("D1 binding DB is unavailable");
		return queryAdminDashboard(db, Date.now(), data.days);
	});
