import { z } from "zod";
import { RBAC_REGISTERED_ACTION_MASK } from "#/features/access/rbac-bitmask";
import {
	type SystemPermissionGrant,
	systemRbacModuleIds,
} from "#/features/access/system-rbac";

const roleIdSchema = z.uuid().transform((value) => value.toLowerCase());

export const roleIdsInputSchema = z.array(roleIdSchema).max(32);

export const storedRoleIdsSchema = z
	.array(z.uuid())
	.max(32)
	.superRefine((value, context) => {
		const canonical = [...new Set(value.map((id) => id.toLowerCase()))].sort();
		if (
			canonical.length !== value.length ||
			canonical.some((id, index) => id !== value[index])
		)
			context.addIssue({
				code: "custom",
				message: "Role IDs must be unique, lowercase, and sorted",
			});
	});

export const permissionsJsonSchema = z
	.record(z.string(), z.number().int().min(0).max(RBAC_REGISTERED_ACTION_MASK))
	.superRefine((value, context) => {
		for (const module of Object.keys(value))
			if (!systemRbacModuleIds.includes(module as never))
				context.addIssue({
					code: "custom",
					path: [module],
					message: "Unknown permission module",
				});
	});

export function normalizeRoleIds(input: readonly string[]) {
	return [
		...new Set(roleIdsInputSchema.parse(input).map((id) => id.toLowerCase())),
	].sort();
}

export function permissionsJsonFromGrants(
	grants: readonly SystemPermissionGrant[],
) {
	return permissionsJsonSchema.parse(
		Object.fromEntries(
			grants.map(({ module, permissionMask }) => [module, permissionMask]),
		),
	);
}
