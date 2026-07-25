export async function signedTelegramInitData(
	token: string,
	authDateSeconds: number,
	overrides: Record<string, string> = {},
) {
	const values = {
		auth_date: String(authDateSeconds),
		query_id: "AAEAA-test-query",
		user: JSON.stringify({
			id: 900_719_925_474_000,
			first_name: "Mini",
			last_name: "User",
			username: "mini_user",
			language_code: "zh-CN",
		}),
		...overrides,
	};
	const check = Object.entries(values)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, value]) => `${key}=${value}`)
		.join("\n");
	const encoder = new TextEncoder();
	const secret = await hmac(
		encoder.encode("WebAppData"),
		encoder.encode(token),
	);
	const hash = await hmac(secret, encoder.encode(check));
	const parameters = new URLSearchParams(values);
	parameters.set("hash", bytesToHex(hash));
	return parameters.toString();
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

function bytesToHex(value: Uint8Array) {
	return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}
