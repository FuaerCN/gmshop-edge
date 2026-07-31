export async function deriveTelegramWebhookSecret(
	dataEncryptionSecret: string,
	botUserId: string,
	providerRevision: number,
) {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(dataEncryptionSecret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const value = `telegram-webhook:v1:${botUserId}:${providerRevision}`;
	const digest = new Uint8Array(
		await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
	);
	return bytesToBase64Url(digest);
}

export async function telegramDataKeyId(secret: string) {
	const digest = new Uint8Array(
		await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode(`telegram-data-key:v1:${secret}`),
		),
	);
	return bytesToBase64Url(digest.slice(0, 12));
}

export function constantTimeStringEqual(left: string, right: string) {
	const a = new TextEncoder().encode(left);
	const b = new TextEncoder().encode(right);
	if (a.length !== b.length) return false;
	let difference = 0;
	for (let index = 0; index < a.length; index += 1)
		difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
	return difference === 0;
}

function bytesToBase64Url(bytes: Uint8Array) {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}
