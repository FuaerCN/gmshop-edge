import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const retainedRoutes = ["sessions", "notifications"];
const legacySettingsRoutes = ["profile", "security", "connections"];
const sourceRoot = new URL("../../src/", import.meta.url);

describe("account route flattening", () => {
	it.each(retainedRoutes)("serves %s directly below /account", (page) => {
		const route = new URL(`routes/(public)/account/${page}.tsx`, sourceRoot);
		expect(existsSync(route)).toBe(true);
		expect(readFileSync(route, "utf8")).toContain(
			`createFileRoute("/(public)/account/${page}")`,
		);
	});

	it("uses one canonical account settings route and redirects legacy links", () => {
		const settings = new URL(
			"routes/(public)/account/settings.tsx",
			sourceRoot,
		);
		expect(existsSync(settings)).toBe(true);
		expect(readFileSync(settings, "utf8")).toContain(
			'createFileRoute("/(public)/account/settings")',
		);
		for (const page of legacySettingsRoutes) {
			const legacy = readFileSync(
				new URL(`routes/(public)/account/${page}.tsx`, sourceRoot),
				"utf8",
			);
			expect(legacy).toContain(`createFileRoute("/(public)/account/${page}")`);
			expect(legacy).toContain('redirect({ to: "/account/settings" })');
		}
	});

	it("presents one settings destination in navigation and the generated tree", () => {
		const layout = readFileSync(
			new URL("features/storefront/components/account-layout.tsx", sourceRoot),
			"utf8",
		);
		expect(layout).toContain("/account/settings");
		for (const page of legacySettingsRoutes)
			expect(layout).not.toContain(`/account/${page}`);
		for (const page of retainedRoutes)
			expect(layout).toContain(`/account/${page}`);

		const routeTree = readFileSync(
			new URL("routeTree.gen.ts", sourceRoot),
			"utf8",
		);
		expect(routeTree).toContain("'/account/settings'");
		for (const page of [...legacySettingsRoutes, ...retainedRoutes])
			expect(routeTree).toContain(`'/account/${page}'`);
	});
});
