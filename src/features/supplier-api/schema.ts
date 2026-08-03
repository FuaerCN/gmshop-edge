import { z } from "zod";

export const supplierApiKeyCreateSchema = z.object({});

export const supplierApiKeyIdSchema = z.object({ id: z.string().uuid() });
