import { z } from "zod";

const defaultRetentionAuditMs = 31_536_000_000;
const retentionSchema = z
	.number()
	.int()
	.min(2_592_000_000)
	.max(315_360_000_000);

export async function loadOperationalSettings(db: D1Database) {
	const row = await db
		.prepare(
			"SELECT value FROM system_settings WHERE key = 'retention.audit_ms' LIMIT 1",
		)
		.first<{ value: string }>();
	if (!row) return { retentionAuditMs: defaultRetentionAuditMs };
	try {
		const parsed = retentionSchema.safeParse(JSON.parse(row.value));
		return {
			retentionAuditMs: parsed.success ? parsed.data : defaultRetentionAuditMs,
		};
	} catch {
		return { retentionAuditMs: defaultRetentionAuditMs };
	}
}
