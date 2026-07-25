import { describe, expect, it } from "vitest";
import { paymentProviderFamily } from "#/features/shop-payments/provider";
import { paymentCheckoutPresentation } from "#/features/shop-payments/providers";

describe("payment provider families", () => {
	it("groups Alipay and WeChat integration modes under one payment type", () => {
		expect(paymentProviderFamily("alipay_page")).toBe("alipay");
		expect(paymentProviderFamily("alipay_wap")).toBe("alipay");
		expect(paymentProviderFamily("wechat_native")).toBe("wechat");
		expect(paymentProviderFamily("wechat_h5")).toBe("wechat");
	});

	it("keeps standalone payment types unchanged", () => {
		expect(paymentProviderFamily("stripe")).toBe("stripe");
		expect(paymentProviderFamily("gmpay")).toBe("gmpay");
		expect(paymentProviderFamily("epay")).toBe("epay");
	});

	it("declares checkout presentation as a provider capability", () => {
		expect(paymentCheckoutPresentation("wechat_native")).toBe("qr");
		for (const provider of [
			"stripe",
			"gmpay",
			"epay",
			"alipay_page",
			"alipay_wap",
			"wechat_h5",
		])
			expect(paymentCheckoutPresentation(provider)).toBe("redirect");
	});
});
