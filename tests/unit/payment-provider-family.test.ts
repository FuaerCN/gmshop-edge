import { describe, expect, it } from "vitest";
import { paymentProviderFamily } from "#/features/shop-payments/provider";
import { paymentCheckoutPresentation } from "#/features/shop-payments/providers";
import { paymentChannelInputSchema } from "#/features/shop-payments/schema";

describe("payment provider families", () => {
	it("groups Alipay and WeChat integration modes under one payment type", () => {
		expect(paymentProviderFamily("alipay_page")).toBe("alipay");
		expect(paymentProviderFamily("alipay_wap")).toBe("alipay");
		expect(paymentProviderFamily("wechat_native")).toBe("wechat");
		expect(paymentProviderFamily("wechat_h5")).toBe("wechat");
	});

	it("keeps standalone payment types unchanged", () => {
		expect(paymentProviderFamily("stripe")).toBe("stripe");
		expect(paymentProviderFamily("cryptomus")).toBe("cryptomus");
		expect(paymentProviderFamily("gmpay")).toBe("gmpay");
		expect(paymentProviderFamily("epay")).toBe("epay");
	});

	it("declares checkout presentation as a provider capability", () => {
		expect(paymentCheckoutPresentation("wechat_native")).toBe("qr");
		for (const provider of [
			"stripe",
			"cryptomus",
			"gmpay",
			"epay",
			"alipay_page",
			"alipay_wap",
		])
			expect(paymentCheckoutPresentation(provider)).toBe("redirect");
		expect(paymentCheckoutPresentation("wechat_native")).toBe("qr");
		expect(paymentCheckoutPresentation("wechat_h5")).toBe("qr");
		expect(
			paymentCheckoutPresentation(
				"wechat_native",
				"https://wx.tenpay.com/mobile-checkout",
			),
		).toBe("redirect");
		expect(
			paymentCheckoutPresentation(
				"wechat_native",
				"weixin://wxpay/bizpayurl?pr=fixture",
			),
		).toBe("qr");
	});

	it("requires Cryptomus credentials on create and permits blank encrypted edits", () => {
		const input = {
			provider: "cryptomus" as const,
			name: "Cryptomus",
			currency: "USD",
			defaultToken: "",
			defaultNetwork: "",
			feeBps: 40,
			fixedFeeMinor: "0",
			sortOrder: 100,
			enabled: false,
			cryptomusMerchantId: "",
			cryptomusPaymentApiKey: "",
		};
		expect(paymentChannelInputSchema.safeParse(input).success).toBe(false);
		expect(
			paymentChannelInputSchema.safeParse({
				...input,
				id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
			}).success,
		).toBe(true);
		expect(
			paymentChannelInputSchema.safeParse({
				...input,
				cryptomusMerchantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
				cryptomusPaymentApiKey: "payment-api-key",
			}).success,
		).toBe(true);
	});
});
