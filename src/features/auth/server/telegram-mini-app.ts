import { z } from "zod";

const encoder = new TextEncoder();

const telegramUserSchema = z.object({
	id: z.union([z.number().int().safe(), z.string().regex(/^\d{1,20}$/)]),
	is_bot: z.boolean().optional(),
	first_name: z.string().trim().min(1).max(256),
	last_name: z.string().trim().max(256).optional(),
	username: z.string().trim().max(64).optional(),
	language_code: z.string().trim().max(35).optional(),
	photo_url: z.url().max(2_048).optional(),
});

export type TelegramMiniAppIdentity = {
	telegramUserId: string;
	firstName: string;
	lastName: string | null;
	username: string | null;
	languageCode: string | null;
	photoUrl: string | null;
	authenticatedAt: number;
	replayDigest: string;
};

export class TelegramMiniAppAuthError extends Error {
	constructor(readonly code: string) {
		super("Telegram Mini App authentication failed");
		this.name = "TelegramMiniAppAuthError";
	}
}

export async function verifyTelegramMiniAppInitData(
	initData: string,
	botToken: string,
	options: { now?: number; maxAgeMs?: number } = {},
): Promise<TelegramMiniAppIdentity> {
	if (!initData || initData.length > 16_384 || !botToken)
		throw new TelegramMiniAppAuthError("invalid_input");
	const parameters = new URLSearchParams(initData);
	const keys = [...parameters.keys()];
	if (new Set(keys).size !== keys.length)
		throw new TelegramMiniAppAuthError("duplicate_parameter");
	const receivedHash = parameters.get("hash");
	if (!receivedHash || !/^[\da-f]{64}$/i.test(receivedHash))
		throw new TelegramMiniAppAuthError("invalid_hash");
	const dataCheckString = keys
		.filter((key) => key !== "hash")
		.sort()
		.map((key) => `${key}=${parameters.get(key) ?? ""}`)
		.join("\n");
	const secretKey = await hmac(
		encoder.encode("WebAppData"),
		encoder.encode(botToken),
	);
	const calculatedHash = await hmac(secretKey, encoder.encode(dataCheckString));
	if (!constantTimeEqual(hexToBytes(receivedHash), calculatedHash))
		throw new TelegramMiniAppAuthError("invalid_signature");

	const authDateSeconds = Number(parameters.get("auth_date"));
	if (!Number.isSafeInteger(authDateSeconds) || authDateSeconds <= 0)
		throw new TelegramMiniAppAuthError("invalid_auth_date");
	const authenticatedAt = authDateSeconds * 1_000;
	const now = options.now ?? Date.now();
	const maxAgeMs = options.maxAgeMs ?? 300_000;
	if (authenticatedAt > now + 30_000)
		throw new TelegramMiniAppAuthError("future_auth_date");
	if (now - authenticatedAt > maxAgeMs)
		throw new TelegramMiniAppAuthError("expired_auth_date");

	const userValue = parameters.get("user");
	if (!userValue) throw new TelegramMiniAppAuthError("missing_user");
	let unknownUser: unknown;
	try {
		unknownUser = JSON.parse(userValue);
	} catch {
		throw new TelegramMiniAppAuthError("invalid_user");
	}
	const user = telegramUserSchema.safeParse(unknownUser);
	if (!user.success || user.data.is_bot)
		throw new TelegramMiniAppAuthError("invalid_user");
	return {
		telegramUserId: String(user.data.id),
		firstName: user.data.first_name,
		lastName: user.data.last_name ?? null,
		username: user.data.username ?? null,
		languageCode: user.data.language_code ?? null,
		photoUrl: user.data.photo_url ?? null,
		authenticatedAt,
		replayDigest: await sha256Hex(initData),
	};
}

async function hmac(
	key: Uint8Array<ArrayBuffer>,
	value: Uint8Array<ArrayBuffer>,
) {
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		key,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, value));
}

async function sha256Hex(value: string) {
	const digest = new Uint8Array(
		await crypto.subtle.digest("SHA-256", encoder.encode(value)),
	);
	return bytesToHex(digest);
}

function hexToBytes(value: string) {
	return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) =>
		Number.parseInt(byte, 16),
	);
}

function bytesToHex(value: Uint8Array) {
	return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
	if (left.length !== right.length) return false;
	let difference = 0;
	for (let index = 0; index < left.length; index += 1)
		difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
	return difference === 0;
}
