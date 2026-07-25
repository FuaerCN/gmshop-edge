import { describe, expect, it } from "vitest";
import { applyPartialEmailChannelOrder } from "#/features/notifications/email-channel-order";

describe("email channel partial ordering", () => {
	it("reorders only the slots occupied by the visible page", () => {
		expect(
			applyPartialEmailChannelOrder(
				["hidden-before", "first", "hidden-middle", "second", "hidden-after"],
				["second", "first"],
			),
		).toEqual([
			"hidden-before",
			"second",
			"hidden-middle",
			"first",
			"hidden-after",
		]);
	});

	it("is stable when the same order is submitted repeatedly", () => {
		const once = applyPartialEmailChannelOrder(
			["first", "hidden", "second"],
			["second", "first"],
		);
		expect(once).not.toBeNull();
		expect(
			applyPartialEmailChannelOrder(once ?? [], ["second", "first"]),
		).toEqual(once);
	});

	it("rejects an order containing a missing channel", () => {
		expect(
			applyPartialEmailChannelOrder(["first"], ["first", "missing"]),
		).toBeNull();
	});
});
