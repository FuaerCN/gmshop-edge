const encoder = new TextEncoder();

export async function hmacSha256Hex(secret: string, value: string) {
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(value),
	);
	return [...new Uint8Array(signature)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export async function sha256Hex(value: string) {
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export function constantTimeEqual(left: string, right: string) {
	const leftBytes = encoder.encode(left);
	const rightBytes = encoder.encode(right);
	let difference = leftBytes.length ^ rightBytes.length;
	const length = Math.max(leftBytes.length, rightBytes.length);
	for (let index = 0; index < length; index += 1)
		difference |=
			(leftBytes[index % leftBytes.length] ?? 0) ^
			(rightBytes[index % rightBytes.length] ?? 0);
	return difference === 0;
}

export function parseTimestampedSignature(header: string) {
	const values = header
		.split(",")
		.reduce<Record<string, string[]>>((result, part) => {
			const [key, value] = part.trim().split("=", 2);
			if (key && value) {
				const entries = result[key] ?? [];
				entries.push(value);
				result[key] = entries;
			}
			return result;
		}, {});
	const timestamp = Number(values.t?.[0]);
	if (!Number.isSafeInteger(timestamp)) return null;
	return { timestamp, signatures: values.v1 ?? [] };
}
