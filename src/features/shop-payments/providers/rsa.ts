import { DomainError } from "#/lib/domain-error";

const encoder = new TextEncoder();

export async function rsaSha256Sign(privateKeyPem: string, value: string) {
	const key = await importRsaKey(privateKeyPem, "pkcs8", ["sign"]);
	const signature = await crypto.subtle.sign(
		{ name: "RSASSA-PKCS1-v1_5" },
		key,
		encoder.encode(value),
	);
	return bytesToBase64(new Uint8Array(signature));
}

export async function rsaSha256Verify(
	publicKeyPem: string,
	value: string,
	signature: string,
) {
	let signatureBytes: Uint8Array;
	try {
		signatureBytes = base64ToBytes(signature);
	} catch {
		return false;
	}
	const key = await importRsaKey(publicKeyPem, "spki", ["verify"]);
	return crypto.subtle.verify(
		{ name: "RSASSA-PKCS1-v1_5" },
		key,
		new Uint8Array(signatureBytes).buffer,
		encoder.encode(value),
	);
}

export function base64ToBytes(value: string) {
	const binary = atob(value);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function bytesToBase64(value: Uint8Array) {
	let binary = "";
	for (const byte of value) binary += String.fromCharCode(byte);
	return btoa(binary);
}

async function importRsaKey(
	pem: string,
	format: "pkcs8" | "spki",
	usages: KeyUsage[],
) {
	const contents = pem
		.replace(/-----BEGIN [^-]+-----/g, "")
		.replace(/-----END [^-]+-----/g, "")
		.replace(/\s+/g, "");
	try {
		return await crypto.subtle.importKey(
			format,
			base64ToBytes(contents),
			{
				name: "RSASSA-PKCS1-v1_5",
				hash: "SHA-256",
			},
			false,
			usages,
		);
	} catch {
		throw new DomainError(
			"payment_credential_invalid",
			400,
			"Payment RSA key is invalid",
		);
	}
}
