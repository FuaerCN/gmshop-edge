import type {
	PaymentProvider,
	PaymentProviderAdapter,
} from "#/features/shop-payments/provider";
import { DomainError } from "#/lib/domain-error";
import { createAlipayProvider } from "./alipay";
import { epayPaymentProvider } from "./epay";
import { gmpayPaymentProvider } from "./gmpay";
import { stripePaymentProvider } from "./stripe";
import { createWechatPayProvider } from "./wechatpay";

const providers: Record<PaymentProvider, PaymentProviderAdapter> = {
	stripe: stripePaymentProvider,
	gmpay: gmpayPaymentProvider,
	epay: epayPaymentProvider,
	alipay_page: createAlipayProvider("FAST_INSTANT_TRADE_PAY"),
	alipay_wap: createAlipayProvider("QUICK_WAP_WAY"),
	wechat_native: createWechatPayProvider("native"),
	wechat_h5: createWechatPayProvider("h5"),
};

export function getPaymentProvider(provider: string) {
	const adapter = providers[provider as PaymentProvider];
	if (!adapter)
		throw new DomainError(
			"payment_provider_unsupported",
			400,
			"Unsupported payment provider",
		);
	return adapter;
}

export function paymentCheckoutPresentation(provider: string) {
	return getPaymentProvider(provider).checkoutPresentation;
}
