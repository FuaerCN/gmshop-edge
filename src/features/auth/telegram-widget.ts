import { z } from "zod";

export const telegramWidgetAuthDataSchema = z
	.object({
		id: z.number().int(),
		first_name: z.string().min(1).max(256),
		last_name: z.string().max(256).optional(),
		username: z.string().max(64).optional(),
		photo_url: z.string().max(2_048).optional(),
		auth_date: z.number().int().positive(),
		hash: z.string().regex(/^[a-f0-9]{64}$/i),
	})
	.strict();

export type TelegramWidgetAuthData = z.infer<
	typeof telegramWidgetAuthDataSchema
>;

export function decodeTelegramWidgetResult(value: string) {
	if (!value || value.length > 8_192) return null;
	try {
		const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
		const padded = normalized.padEnd(
			normalized.length + ((4 - (normalized.length % 4)) % 4),
			"=",
		);
		const binary = atob(padded);
		const bytes = Uint8Array.from(binary, (character) =>
			character.charCodeAt(0),
		);
		return telegramWidgetAuthDataSchema.parse(
			JSON.parse(new TextDecoder().decode(bytes)),
		);
	} catch {
		return null;
	}
}

export async function verifyTelegramWidgetAuthData(
	data: TelegramWidgetAuthData,
	botToken: string,
	options: { maxAgeMs?: number; now?: number } = {},
) {
	const now = options.now ?? Date.now();
	const authenticatedAt = data.auth_date * 1_000;
	const maxAgeMs = options.maxAgeMs ?? 300_000;
	if (authenticatedAt > now + 30_000 || now - authenticatedAt > maxAgeMs)
		return null;

	const checkString = Object.entries(data)
		.filter(([key]) => key !== "hash")
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, value]) => `${key}=${value}`)
		.join("\n");
	const secret = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(botToken),
	);
	const key = await crypto.subtle.importKey(
		"raw",
		secret,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = new Uint8Array(
		await crypto.subtle.sign(
			"HMAC",
			key,
			new TextEncoder().encode(checkString),
		),
	);
	const expected = Uint8Array.from(data.hash.match(/.{2}/g) ?? [], (byte) =>
		Number.parseInt(byte, 16),
	);
	if (signature.length !== expected.length) return null;
	let difference = 0;
	for (const [index, byte] of signature.entries())
		difference |= byte ^ (expected[index] ?? 0);
	if (difference !== 0) return null;
	return { authenticatedAt, replayDigest: data.hash.toLowerCase() };
}
