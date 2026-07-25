import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sensitiveProofSchema } from "#/features/auth/reauthentication-schema";

const source = (path: string) =>
	readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("password-only sensitive reauthentication", () => {
	it("accepts only a current password proof", () => {
		expect(
			sensitiveProofSchema.safeParse({ password: "current" }).success,
		).toBe(true);
		expect(sensitiveProofSchema.safeParse({}).success).toBe(false);
		expect(sensitiveProofSchema.safeParse({ totpCode: "123456" }).success).toBe(
			false,
		);
	});

	it("does not install two-factor auth plugins or challenge routes", () => {
		expect(source("src/features/auth/auth-client.ts")).not.toContain(
			"twoFactorClient",
		);
		expect(source("src/features/auth/server/auth-factory.ts")).not.toContain(
			"twoFactor(",
		);
		expect(
			existsSync(
				new URL("../../src/routes/(auth)/two-factor.tsx", import.meta.url),
			),
		).toBe(false);
		expect(source("src/routeTree.gen.ts")).not.toContain("/two-factor");
	});

	it("offers local-password setup to accounts that need sensitive actions", () => {
		const accountPage = source(
			"src/features/storefront/pages/account-sections.tsx",
		);
		expect(accountPage).toContain("setAccountPasswordFn");
		expect(accountPage).toContain("store_account_set_password");
	});
});
