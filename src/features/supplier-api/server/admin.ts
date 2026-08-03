import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { systemPermission } from "#/features/access/system-rbac";
import { getAdminServerContext } from "#/server/context";

export const getSupplierApiConfigurationFn = createServerFn({
	method: "GET",
}).handler(async () => {
	const { db } = await getAdminServerContext(
		systemPermission("suppliers", "read"),
	);
	const setting = await db.$client
		.prepare(
			"SELECT value FROM system_settings WHERE key = 'commerce.supplier_api_enabled' LIMIT 1",
		)
		.first<{ value: string }>();
	return {
		enabled: setting ? JSON.parse(setting.value) === true : false,
	};
});

export const setSupplierApiConfigurationFn = createServerFn({ method: "POST" })
	.validator((value: { enabled: boolean }) =>
		z.object({ enabled: z.boolean() }).parse(value),
	)
	.handler(async ({ data }) => {
		const { currentUser, db } = await getAdminServerContext(
			systemPermission("suppliers", "update"),
		);
		const now = Date.now();
		await db.$client
			.prepare(`INSERT INTO system_settings
		 (key, value, is_secret, updated_by, created_at, updated_at)
		 VALUES ('commerce.supplier_api_enabled', ?, 0, ?, ?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value,
		 updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
			.bind(JSON.stringify(data.enabled), currentUser.id, now, now)
			.run();
		return data;
	});
