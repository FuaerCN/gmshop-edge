import { z } from "zod";

export const sensitiveProofSchema = z.object({
	password: z.string().min(1).max(500),
});
