import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("interactive accessibility contracts", () => {
	it("gives every directly rendered Switch an accessible name", async () => {
		for (const file of await tsxFiles(resolve("src"))) {
			const source = await readFile(file, "utf8");
			for (const match of source.matchAll(/<Switch\b[\s\S]*?\/>/g)) {
				expect(
					/aria-label=|\bid=/.test(match[0]),
					`${file}: Switch requires aria-label or a linked id`,
				).toBe(true);
			}
		}
	});

	it("gives icon-only application buttons a label or named tooltip", async () => {
		for (const file of await tsxFiles(resolve("src"))) {
			const source = await readFile(file, "utf8");
			for (const match of source.matchAll(
				/<(Button|ProButton)\b([^>]*size="icon(?:-[a-z]+)?"[^>]*)>([\s\S]*?)<\/\1>/g,
			)) {
				const contract = `${match[2]} ${match[3]}`;
				expect(
					/aria-label=|tooltip=|className="[^"]*sr-only/.test(contract),
					`${file}: icon button requires aria-label, tooltip, or sr-only text`,
				).toBe(true);
			}
		}
	});

	it("keeps global motion respectful of reduced-motion preferences", async () => {
		const source = await readFile(resolve("src/styles/global.css"), "utf8");
		expect(source).toContain("@media (prefers-reduced-motion: reduce)");
		expect(source).toContain("animation-duration: 0.01ms");
		expect(source).toContain("transition-duration: 0.01ms");
		expect(source).toContain("scroll-behavior: auto");
	});

	it("provides skip targets and restores focus after route changes", async () => {
		const publicLayout = await readFile(
			resolve("src/layouts/public/index.tsx"),
			"utf8",
		);
		const dashboardLayout = await readFile(
			resolve("src/layouts/dashboard/index.tsx"),
			"utf8",
		);
		const root = await readFile(resolve("src/routes/__root.tsx"), "utf8");
		expect(publicLayout).toContain("<SkipToMain />");
		expect(publicLayout).toContain('id="content"');
		expect(dashboardLayout).toContain('id="content"');
		expect(root).toContain("function RouteFocusManager()");
		expect(root).toContain('document.getElementById("content")?.focus');
	});

	it("uses one centered content container for every admin route", async () => {
		const dashboardLayout = await readFile(
			resolve("src/layouts/dashboard/index.tsx"),
			"utf8",
		);
		const dashboardPage = await readFile(
			resolve("src/features/dashboard/pages/admin.tsx"),
			"utf8",
		);
		const settingsLayout = await readFile(
			resolve("src/layouts/settings/index.tsx"),
			"utf8",
		);
		const adminRoute = await readFile(
			resolve("src/routes/admin/route.tsx"),
			"utf8",
		);
		expect(dashboardLayout).not.toContain("<Main");
		expect(adminRoute).toContain("pageScroll={pageScroll}");
		expect(adminRoute).toContain("<Main fixed={!pageScroll}>");
		expect(dashboardPage).not.toContain("<Main");
		expect(settingsLayout).not.toContain("<Main");
	});

	it("links schema labels to searchable select triggers", async () => {
		const select = await readFile(
			resolve("src/components/pro/base/fields/select/index.tsx"),
			"utf8",
		);
		const form = await readFile(
			resolve("src/components/pro/form/index.tsx"),
			"utf8",
		);
		expect(select).toContain("aria-label={ariaLabel}");
		expect(select.match(/id=\{id\}/g)).toHaveLength(2);
		expect(form.match(/id=\{item\.name\}/g)?.length).toBeGreaterThanOrEqual(2);
	});
});

async function tsxFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map((entry) => {
			const path = resolve(directory, entry.name);
			return entry.isDirectory()
				? tsxFiles(path)
				: Promise.resolve(entry.name.endsWith(".tsx") ? [path] : []);
		}),
	);
	return nested.flat();
}
