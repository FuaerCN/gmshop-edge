import { describe, expect, it } from "vitest";
import {
	isRuntimeSecret,
	presentSettingValue,
	shouldPreserveRuntimeSecret,
} from "#/features/settings/secrecy";

describe("runtime setting secrecy", () => {
	it("returns configured runtime secrets to the permission-protected settings page", () => {
		const secret = "a-real-runtime-secret-visible-to-settings-admins";
		expect(presentSettingValue("runtime.better_auth_secret", secret)).toEqual({
			value: secret,
			configured: true,
		});
		expect(
			presentSettingValue("runtime.data_encryption_secret", secret),
		).toEqual({
			value: secret,
			configured: true,
		});
	});

	it("keeps the canonical URL visible because it is not a secret", () => {
		expect(isRuntimeSecret("runtime.better_auth_url")).toBe(false);
		expect(
			presentSettingValue("runtime.better_auth_url", "https://pay.example"),
		).toEqual({ value: "https://pay.example", configured: undefined });
	});

	it("treats a blank secret input as preserve, not overwrite", () => {
		expect(shouldPreserveRuntimeSecret("runtime.better_auth_secret", "")).toBe(
			true,
		);
		expect(
			shouldPreserveRuntimeSecret("runtime.better_auth_secret", "replacement"),
		).toBe(false);
		expect(shouldPreserveRuntimeSecret("runtime.better_auth_url", "")).toBe(
			false,
		);
	});
});
