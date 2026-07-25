// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	readGuestOrderEmail,
	writeGuestOrderEmail,
} from "#/features/storefront/order-access-storage";

const orderNumber = `GM${"1".repeat(32)}`;

describe("guest order access session storage", () => {
	beforeEach(() => window.sessionStorage.clear());

	it("stores a normalized email for one order in session storage", () => {
		expect(
			writeGuestOrderEmail(orderNumber.toLowerCase(), " Buyer@Example.com "),
		).toBe("buyer@example.com");
		expect(readGuestOrderEmail(orderNumber)).toBe("buyer@example.com");
		expect(
			JSON.parse(
				window.sessionStorage.getItem(
					`gmshop-order-access:v1:${orderNumber}`,
				) ?? "{}",
			),
		).toEqual({
			version: 1,
			orderNumber,
			email: "buyer@example.com",
		});
	});

	it("isolates orders and rejects malformed or tampered entries", () => {
		const otherOrderNumber = `GM${"2".repeat(32)}`;
		writeGuestOrderEmail(orderNumber, "buyer@example.com");
		expect(readGuestOrderEmail(otherOrderNumber)).toBe("");

		window.sessionStorage.setItem(
			`gmshop-order-access:v1:${otherOrderNumber}`,
			JSON.stringify({
				version: 1,
				orderNumber,
				email: "buyer@example.com",
			}),
		);
		expect(readGuestOrderEmail(otherOrderNumber)).toBe("");

		window.sessionStorage.setItem(
			`gmshop-order-access:v1:${orderNumber}`,
			"not-json",
		);
		expect(readGuestOrderEmail(orderNumber)).toBe("");
	});

	it("fails closed when session storage is unavailable", () => {
		const setItem = vi
			.spyOn(Storage.prototype, "setItem")
			.mockImplementationOnce(() => {
				throw new DOMException("Storage denied", "SecurityError");
			});
		expect(writeGuestOrderEmail(orderNumber, "buyer@example.com")).toBe("");
		setItem.mockRestore();
	});
});
