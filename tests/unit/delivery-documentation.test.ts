import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

describe("project documentation", () => {
	it("keeps the root readme paired in English and Simplified Chinese", async () => {
		const [english, chinese] = await Promise.all([
			readFile(resolve("README.md"), "utf8"),
			readFile(resolve("README.zh-CN.md"), "utf8"),
		]);
		for (const source of [english, chinese]) {
			expect(source).toContain("GMShop Edge");
			expect(source).toContain("public/openapi.yaml");
			expect(source).toContain("deploy.workers.cloudflare.com/button");
		}
	});

	it("ships a parseable GMShop OpenAPI contract", async () => {
		const document = parse(
			await readFile(resolve("public/openapi.yaml"), "utf8"),
		) as {
			openapi?: string;
			info?: { title?: string };
			paths?: Record<string, unknown>;
		};
		expect(document.openapi).toBe("3.1.0");
		expect(document.info?.title).toBe("GMShop Edge HTTP API");
		expect(Object.keys(document.paths ?? {})).toContain(
			"/api/shop/payments/{channelId}/webhook",
		);
		expect(Object.keys(document.paths ?? {})).toContain(
			"/api/shop/automation/callback",
		);
	});

	it("keeps removed merchant-gateway artifacts out of the shop contract", async () => {
		for (const file of [
			resolve("README.md"),
			resolve("README.zh-CN.md"),
			resolve("AGENTS.md"),
			resolve("AGENTS.zh-CN.md"),
		]) {
			const source = await readFile(file, "utf8");
			expect(source, basename(file)).not.toMatch(
				/\/payments\/|payment_rails|receiving_methods|blockchain_transactions/i,
			);
		}
	});
});
