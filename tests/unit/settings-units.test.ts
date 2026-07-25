import { describe, expect, it } from "vitest";
import { systemSettingUnit } from "#/features/settings/units";

describe("commerce setting units", () => {
	it.each([
		"orders.default_expiry_ms",
		"automation.artifact_retention_ms",
		"queue.retry_base_ms",
		"retention.audit_ms",
	])("marks %s as milliseconds", (key) => {
		expect(systemSettingUnit(key)).toBe("milliseconds");
	});

	it("leaves dimensionless settings unmarked", () => {
		expect(systemSettingUnit("queue.publish_batch_size")).toBeUndefined();
	});
});
