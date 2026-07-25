import { z } from "zod";
import { paymentProviderValues } from "#/features/shop-payments/provider";

const idSchema = z.string().uuid();

export const paymentChannelListSchema = z.object({
	pageIndex: z.number().int().min(0).default(0),
	pageSize: z.number().int().min(1).max(100).default(10),
	search: z.string().trim().max(200).default(""),
});

export const paymentChannelInputSchema = z
	.object({
		id: idSchema.optional(),
		provider: z.enum(paymentProviderValues),
		name: z.string().trim().min(1).max(120),
		currency: z
			.string()
			.trim()
			.toUpperCase()
			.regex(/^[A-Z]{3}$/),
		defaultToken: z.string().trim().toLowerCase().max(40).default(""),
		defaultNetwork: z.string().trim().toLowerCase().max(40).default(""),
		feeBps: z.number().int().min(0).max(10_000),
		fixedFeeMinor: z.string().trim().regex(/^\d+$/).max(40),
		sortOrder: z.number().int().min(0).max(1_000_000),
		enabled: z.boolean(),
		stripeSecretKey: z.string().trim().max(512).optional(),
		stripeWebhookSecret: z.string().trim().max(512).optional(),
		epusdtBaseUrl: z.string().trim().max(2_048).optional(),
		epusdtPid: z.string().trim().max(80).optional(),
		epusdtSecretKey: z.string().max(512).optional(),
		alipayAppId: z.string().trim().max(32).optional(),
		alipaySellerId: z.string().trim().max(32).optional(),
		alipayPrivateKeyPem: z.string().max(8_192).optional(),
		alipayPublicKeyPem: z.string().max(8_192).optional(),
		wechatAppId: z.string().trim().max(32).optional(),
		wechatMchId: z.string().trim().max(32).optional(),
		wechatMerchantSerialNumber: z.string().trim().max(128).optional(),
		wechatMerchantPrivateKeyPem: z.string().max(8_192).optional(),
		wechatApiV3Key: z.string().max(64).optional(),
		wechatPlatformSerialNumber: z.string().trim().max(128).optional(),
		wechatPlatformPublicKeyPem: z.string().max(8_192).optional(),
	})
	.superRefine((value, context) => {
		if (Boolean(value.defaultToken) !== Boolean(value.defaultNetwork))
			context.addIssue({
				code: "custom",
				path: value.defaultToken ? ["defaultNetwork"] : ["defaultToken"],
				message: "Default token and network must be configured together",
			});
		const changingStripe =
			Boolean(value.stripeSecretKey) || Boolean(value.stripeWebhookSecret);
		if (
			value.provider === "stripe" &&
			(!value.id || changingStripe) &&
			!value.stripeSecretKey?.startsWith("sk_")
		)
			context.addIssue({
				code: "custom",
				path: ["stripeSecretKey"],
				message: "Stripe secret key is required",
			});
		if (
			value.provider === "stripe" &&
			(!value.id || changingStripe) &&
			!value.stripeWebhookSecret?.startsWith("whsec_")
		)
			context.addIssue({
				code: "custom",
				path: ["stripeWebhookSecret"],
				message: "Stripe webhook secret is required",
			});
		if (value.provider === "stripe") return;
		if (
			["alipay_page", "alipay_wap", "wechat_native", "wechat_h5"].includes(
				value.provider,
			) &&
			value.currency !== "CNY"
		)
			context.addIssue({
				code: "custom",
				path: ["currency"],
				message: "This provider requires CNY",
			});
		if (value.provider === "alipay_page" || value.provider === "alipay_wap") {
			const fields = [
				["alipayAppId", value.alipayAppId],
				["alipaySellerId", value.alipaySellerId],
				["alipayPrivateKeyPem", value.alipayPrivateKeyPem],
				["alipayPublicKeyPem", value.alipayPublicKeyPem],
			] as const;
			if (!value.id || fields.some(([, field]) => Boolean(field)))
				for (const [path, field] of fields)
					if (!field)
						context.addIssue({
							code: "custom",
							path: [path],
							message: "Alipay credential is required",
						});
			return;
		}
		if (value.provider === "wechat_native" || value.provider === "wechat_h5") {
			const fields = [
				["wechatAppId", value.wechatAppId],
				["wechatMchId", value.wechatMchId],
				["wechatMerchantSerialNumber", value.wechatMerchantSerialNumber],
				["wechatMerchantPrivateKeyPem", value.wechatMerchantPrivateKeyPem],
				["wechatApiV3Key", value.wechatApiV3Key],
				["wechatPlatformSerialNumber", value.wechatPlatformSerialNumber],
				["wechatPlatformPublicKeyPem", value.wechatPlatformPublicKeyPem],
			] as const;
			if (!value.id || fields.some(([, field]) => Boolean(field)))
				for (const [path, field] of fields)
					if (!field)
						context.addIssue({
							code: "custom",
							path: [path],
							message: "WeChat Pay credential is required",
						});
			return;
		}
		const changingEpusdt = Boolean(
			value.epusdtBaseUrl || value.epusdtPid || value.epusdtSecretKey,
		);
		if (!value.id || changingEpusdt) {
			for (const [path, field] of [
				["epusdtBaseUrl", value.epusdtBaseUrl],
				["epusdtPid", value.epusdtPid],
				["epusdtSecretKey", value.epusdtSecretKey],
			] as const)
				if (!field)
					context.addIssue({
						code: "custom",
						path: [path],
						message: "Epusdt credential is required",
					});
		}
		if (
			value.provider === "epay" &&
			value.epusdtPid &&
			!/^\d+$/.test(value.epusdtPid)
		)
			context.addIssue({
				code: "custom",
				path: ["epusdtPid"],
				message: "EPay requires a numeric PID",
			});
	});

export const paymentChannelIdSchema = z.object({ id: idSchema });
export const paymentChannelOrderSchema = z.object({
	ids: z
		.array(idSchema)
		.min(1)
		.max(100)
		.refine((ids) => new Set(ids).size === ids.length),
});
export const paymentChannelEnabledSchema = z.object({
	id: idSchema,
	enabled: z.boolean(),
});
