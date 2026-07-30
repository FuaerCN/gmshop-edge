import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	AuthProviderLogo,
	EmailProviderLogo,
	PaymentProviderLogo,
} from "#/components/provider-logo";

describe("provider logos", () => {
	it("uses official brand colors for mapped providers", () => {
		const telegram = renderToStaticMarkup(
			<AuthProviderLogo providerId="telegram" />,
		);
		const stripe = renderToStaticMarkup(
			<PaymentProviderLogo providerId="stripe" />,
		);
		const gmpay = renderToStaticMarkup(
			<PaymentProviderLogo providerId="gmpay" />,
		);
		const epay = renderToStaticMarkup(
			<PaymentProviderLogo providerId="epay" />,
		);
		const github = renderToStaticMarkup(
			<AuthProviderLogo providerId="github" />,
		);
		const microsoft = renderToStaticMarkup(
			<AuthProviderLogo providerId="microsoft" />,
		);
		const google = renderToStaticMarkup(
			<AuthProviderLogo providerId="google" />,
		);

		expect(telegram).toContain('fill="#26A5E4"');
		expect(stripe).toContain('fill="#635BFF"');
		expect(gmpay).toContain('fill="#50AF95"');
		expect(epay).toContain('stroke="#1677FF"');
		expect(github).toContain('fill="currentColor"');
		expect(microsoft).toContain('fill="#F25022"');
		expect(microsoft).toContain('fill="#00A4EF"');
		expect(google).toContain('fill="#FFC107"');
		expect(google).toContain('fill="#1976D2"');
	});

	it("maps built-in email providers to recognizable icons", () => {
		const resend = renderToStaticMarkup(
			<EmailProviderLogo providerId="resend" />,
		);
		const mailgun = renderToStaticMarkup(
			<EmailProviderLogo providerId="mailgun" />,
		);
		const cloudflare = renderToStaticMarkup(
			<EmailProviderLogo providerId="cloudflare_email" />,
		);
		const sendgrid = renderToStaticMarkup(
			<EmailProviderLogo providerId="sendgrid" />,
		);

		expect(resend).toContain('fill="currentColor"');
		expect(mailgun).toContain('fill="#F06B66"');
		expect(cloudflare).toContain('fill="#F38020"');
		expect(sendgrid).toContain('fill="#1A82E2"');
	});

	it("prefers uploaded logos and falls back for unknown providers", () => {
		const uploaded = renderToStaticMarkup(
			<AuthProviderLogo
				logoUrl="/api/configuration-logo/auth/google?v=1"
				providerId="google"
			/>,
		);
		const fallback = renderToStaticMarkup(
			<PaymentProviderLogo providerId="custom" />,
		);

		expect(uploaded).toContain("<img");
		expect(uploaded).toContain('src="/api/configuration-logo/auth/google?v=1"');
		expect(uploaded).not.toContain("<svg");
		expect(fallback).toContain("<svg");
	});
});
