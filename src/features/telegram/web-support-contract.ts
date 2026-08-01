import Bowser from "bowser";
import { z } from "zod";

const publicKeySchema = z
	.object({
		kty: z.literal("RSA"),
		n: z.string().min(300).max(800),
		e: z.string().min(1).max(12),
		alg: z.literal("RSA-OAEP-256").optional(),
		key_ops: z.array(z.string()).max(4).optional(),
		ext: z.boolean().optional(),
	})
	.passthrough();

export const webSupportConversationSchema = z.object({
	email: z.string().trim().email().max(254).optional(),
	visitorId: z.string().uuid(),
	publicKeyJwk: publicKeySchema,
	fingerprint: z
		.object({
			visitorId: z.string().regex(/^[a-f0-9]{16,128}$/i),
			version: z
				.string()
				.regex(/^\d+(?:\.\d+){0,2}$/)
				.max(20),
		})
		.optional(),
	diagnostics: z.object({
		locale: z.enum(["en-US", "zh-CN"]),
		timeZone: z.string().trim().min(1).max(64),
	}),
});

export const webSupportMessageSchema = z.object({
	clientMessageId: z.string().uuid(),
	text: z.string().trim().min(1).max(3500),
});

export const webSupportAckSchema = z.object({
	ids: z.array(z.string().uuid()).min(1).max(100),
});

export function parseDevice(userAgent: string | null) {
	const ua = (userAgent ?? "").slice(0, 512);
	if (!ua)
		return {
			browser: "Unknown",
			system: "Unknown",
			device: "Unknown device",
		};
	const parsed = Bowser.parse(ua);
	const browser = formatParsedName(parsed.browser.name, parsed.browser.version);
	const system = formatParsedName(parsed.os.name, parsed.os.version);
	const category =
		parsed.platform.type === "mobile"
			? "Phone"
			: parsed.platform.type === "tablet"
				? "Tablet"
				: parsed.platform.type === "desktop"
					? "Desktop"
					: "Unknown device";
	const details = sanitizeDeviceDetails(
		[parsed.platform.vendor, parsed.platform.model].filter(Boolean).join(" ") ||
			(category === "Desktop" ? parsed.os.name : undefined),
	);
	return {
		browser,
		system,
		device: details ? `${category} · ${details}` : category,
	};
}

function formatParsedName(name?: string, version?: string) {
	return (
		[name, version?.split(".").slice(0, 2).join(".")]
			.filter(Boolean)
			.join(" ") || "Unknown"
	);
}

function sanitizeDeviceDetails(value?: string) {
	return value
		?.replace(/[^\p{L}\p{N} ._+-]/gu, "")
		.trim()
		.slice(0, 60);
}
