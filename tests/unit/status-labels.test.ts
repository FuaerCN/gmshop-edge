import { describe, expect, it } from "vitest";
import { statusLabel } from "#/components/status-badge";
import {
	notificationEventLabel,
	notificationHealthStatusLabel,
} from "#/features/notifications/labels";

describe("localized status labels", () => {
	it("maps commerce and automation state codes", () => {
		for (const value of [
			"created",
			"awaiting_supply",
			"delivered",
			"dispatching",
			"running",
			"resolved",
			"closed",
		])
			expect(statusLabel(value)).not.toBe(value);
	});

	it("maps notification event and health codes", () => {
		expect(notificationEventLabel("order_paid")).not.toBe("order_paid");
		expect(notificationHealthStatusLabel("healthy")).not.toBe("healthy");
		expect(notificationHealthStatusLabel("unhealthy")).not.toBe("unhealthy");
	});
});
