import { z } from "zod";
import { sensitiveProofSchema } from "#/features/auth/reauthentication-schema";
import { userIdSchema } from "#/features/users/schema";

export const customerStatuses = ["active", "disabled"] as const;

export const customerListSchema = z.object({
	pageIndex: z.number().int().min(0).default(0),
	pageSize: z.number().int().min(1).max(100).default(10),
	search: z.string().trim().max(200).default(""),
});

export const customerUpdateSchema = z.object({
	id: userIdSchema,
	name: z
		.string()
		.trim()
		.max(100)
		.transform((value) => value || null),
	note: z
		.string()
		.trim()
		.max(2_000)
		.transform((value) => value || null),
	status: z.enum(customerStatuses),
});

export const customerIdSchema = z.object({ id: userIdSchema });

export const customerSensitiveActionSchema = sensitiveProofSchema.extend({
	id: userIdSchema,
});
