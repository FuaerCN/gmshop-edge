const encoder = new TextEncoder();
const decoder = new TextDecoder();
const envelopeVersion = "v1";
const legacyKeyId = "legacy";

type SecretKeyring = {
	version: 1;
	current: string;
	keys: Record<string, string>;
};
function toBase64(value: Uint8Array): string {
	let binary = "";
	for (const byte of value) binary += String.fromCharCode(byte);
	return btoa(binary);
}
function fromBase64(value: string): Uint8Array<ArrayBuffer> {
	const binary = atob(value);
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
async function encryptionKey(
	material: string,
	purpose: string,
): Promise<CryptoKey> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		encoder.encode(`gmshop:${purpose}\0${material}`),
	);
	return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
		"encrypt",
		"decrypt",
	]);
}

async function legacyEncryptionKey(material: string): Promise<CryptoKey> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		encoder.encode(material),
	);
	return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
		"encrypt",
		"decrypt",
	]);
}
export async function encryptSecret(
	value: string,
	keyringValue: string,
	purpose = "default",
): Promise<string> {
	const keyring = parseKeyring(keyringValue);
	const material = keyring.keys[keyring.current];
	if (!material)
		throw new Error("Current secret encryption key is unavailable");
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encrypted = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		await encryptionKey(material, purpose),
		encoder.encode(value),
	);
	return `${envelopeVersion}.${keyring.current}.${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}
export async function decryptSecret(
	value: string,
	keyringValue: string,
	purpose = "default",
): Promise<string> {
	const parts = value.split(".");
	const versioned = parts.length === 4 && parts[0] === envelopeVersion;
	const keyId = versioned ? parts[1] : legacyKeyId;
	const iv = versioned ? parts[2] : parts[0];
	const ciphertext = versioned ? parts[3] : parts[1];
	if (!keyId || !iv || !ciphertext) throw new Error("Invalid encrypted secret");
	const material = parseKeyring(keyringValue).keys[keyId];
	if (!material) throw new Error("Secret encryption key is unavailable");
	const clear = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: fromBase64(iv) },
		versioned
			? await encryptionKey(material, purpose)
			: await legacyEncryptionKey(material),
		fromBase64(ciphertext),
	);
	return decoder.decode(clear);
}

export function createSecretKeyring() {
	return serializeKeyring({
		version: 1,
		current: "k1",
		keys: { k1: randomKeyMaterial() },
	});
}

export function rotateSecretKeyring(value: string) {
	const keyring = parseKeyring(value);
	const versions = Object.keys(keyring.keys).map((key) => {
		const version = /^k(\d+)$/.exec(key)?.[1];
		return version ? Number(version) : 0;
	});
	const keyId = `k${Math.max(0, ...versions) + 1}`;
	return serializeKeyring({
		version: 1,
		current: keyId,
		keys: { ...keyring.keys, [keyId]: randomKeyMaterial() },
	});
}

export function secretKeyIds(value: string) {
	const keyring = parseKeyring(value);
	return { current: keyring.current, ids: Object.keys(keyring.keys) };
}

export async function reencryptSecret(
	value: string,
	keyringValue: string,
	purpose = "default",
) {
	const keyring = parseKeyring(keyringValue);
	const parts = value.split(".");
	if (
		parts.length === 4 &&
		parts[0] === envelopeVersion &&
		parts[1] === keyring.current
	)
		return null;
	return encryptSecret(
		await decryptSecret(value, keyringValue, purpose),
		keyringValue,
		purpose,
	);
}

function parseKeyring(value: string): SecretKeyring {
	try {
		const parsed = JSON.parse(value) as Partial<SecretKeyring>;
		if (
			parsed.version === 1 &&
			typeof parsed.current === "string" &&
			parsed.keys &&
			typeof parsed.keys === "object" &&
			Object.values(parsed.keys).every(
				(key) => typeof key === "string" && key.length >= 32,
			) &&
			typeof parsed.keys[parsed.current] === "string"
		)
			return parsed as SecretKeyring;
	} catch {
		// Existing installations store one raw key and use legacy two-part envelopes.
	}
	if (value.length < 16)
		throw new Error("Secret encryption key is unavailable");
	return { version: 1, current: legacyKeyId, keys: { [legacyKeyId]: value } };
}

function serializeKeyring(keyring: SecretKeyring) {
	return JSON.stringify(keyring);
}

function randomKeyMaterial() {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}
export function generateApiSecret(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return `gms_${toBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")}`;
}
export function generateApiPid(): string {
	const value = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
	return String(100_000_000_000 + value);
}
