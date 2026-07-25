import { describe, expect, it } from "vitest";
import { safeStorePaymentUrl } from "#/features/storefront/payment-url";

describe("store payment URL boundary", () => {
	it("allows same-origin paths and credential-free HTTPS URLs", () => {
		expect(safeStorePaymentUrl("/orders/order-1")).toBe("/orders/order-1");
		expect(safeStorePaymentUrl("https://pay.example/session")).toBe(
			"https://pay.example/session",
		);
		expect(safeStorePaymentUrl("weixin://wxpay/bizpayurl?pr=abc123")).toBe(
			"weixin://wxpay/bizpayurl?pr=abc123",
		);
	});

	it.each([
		"//evil.example/payment",
		"/\\evil.example/payment",
		"http://evil.example/payment",
		"javascript:alert(1)",
		"weixin://evil/bizpayurl?pr=abc123",
		"weixin://wxpay/other?pr=abc123",
		"https://user:secret@pay.example/session",
	])("rejects unsafe payment URL %s", (value) => {
		expect(safeStorePaymentUrl(value)).toBeNull();
	});
});
