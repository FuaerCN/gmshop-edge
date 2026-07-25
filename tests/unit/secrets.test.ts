import { describe, expect, it } from "vitest";
import {
	createSecretKeyring,
	decryptSecret,
	encryptSecret,
	rotateSecretKeyring,
	secretKeyIds,
} from "#/lib/secrets";

describe("secret encryption", () => {
	it("decrypts ciphertext with the configured integration secret", async () => {
		const encrypted = await encryptSecret(
			"provider-credential",
			"integration-secret",
		);

		await expect(decryptSecret(encrypted, "integration-secret")).resolves.toBe(
			"provider-credential",
		);
	});

	it("retains old keys after rotation while new writes use a new key ID", async () => {
		const keyring = createSecretKeyring();
		const before = await encryptSecret("before", keyring, "inventory");
		const rotated = rotateSecretKeyring(keyring);
		const after = await encryptSecret("after", rotated, "inventory");
		expect(secretKeyIds(rotated)).toEqual({
			current: "k2",
			ids: ["k1", "k2"],
		});
		expect(before.startsWith("v1.k1.")).toBe(true);
		expect(after.startsWith("v1.k2.")).toBe(true);
		await expect(decryptSecret(before, rotated, "inventory")).resolves.toBe(
			"before",
		);
		await expect(decryptSecret(after, rotated, "inventory")).resolves.toBe(
			"after",
		);
	});

	it("cryptographically separates secret purposes", async () => {
		const keyring = createSecretKeyring();
		const encrypted = await encryptSecret("stock", keyring, "card-secret");
		await expect(
			decryptSecret(encrypted, keyring, "payment-credential"),
		).rejects.toThrow();
	});
});
