import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { localeLabels, supportedLocales } from "#/lib/locales";

const locales = supportedLocales;

describe("Paraglide message resources", () => {
	it("keeps locale identifiers as fixed native labels", () => {
		expect(localeLabels).toEqual({
			"en-US": "English",
			"zh-CN": "简体中文",
		});
	});

	it("does not duplicate native locale labels in Paraglide resources", async () => {
		const resources = await Promise.all(
			locales.map(async (locale) => {
				const url = new URL(`../../messages/${locale}.json`, import.meta.url);
				return JSON.parse(await readFile(url, "utf8")) as Record<
					string,
					string
				>;
			}),
		);
		for (const resource of resources) {
			expect(
				Object.keys(resource).some((key) => key.startsWith("locale_")),
			).toBe(false);
		}
	});

	it("keeps keys, non-empty values, and placeholders aligned in every locale", async () => {
		const resources = await Promise.all(
			locales.map(async (locale) => {
				const url = new URL(`../../messages/${locale}.json`, import.meta.url);
				return JSON.parse(await readFile(url, "utf8")) as Record<
					string,
					string
				>;
			}),
		);
		const [canonical] = resources;
		if (!canonical) throw new Error("At least one locale is required");
		const canonicalKeys = Object.keys(canonical).sort();
		for (const [index, resource] of resources.entries()) {
			expect(Object.keys(resource).sort(), locales[index]).toEqual(
				canonicalKeys,
			);
			for (const key of canonicalKeys) {
				expect(
					resource[key]?.trim().length,
					`${locales[index]}:${key}`,
				).toBeGreaterThan(0);
				expect(
					placeholders(resource[key] ?? ""),
					`${locales[index]}:${key}`,
				).toEqual(placeholders(canonical[key] ?? ""));
			}
		}
		for (const resource of resources) {
			expect(
				Object.keys(resource).filter((key) => key.startsWith("locale_name_")),
			).toEqual([]);
		}
	});

	it("does not expose storage implementation names in user-facing copy", async () => {
		for (const locale of locales) {
			const resource = JSON.parse(
				await readFile(
					new URL(`../../messages/${locale}.json`, import.meta.url),
					"utf8",
				),
			) as Record<string, string>;
			expect(Object.values(resource).join("\n"), locale).not.toMatch(
				/\b(?:Cloudflare\s+)?D1\b/i,
			);
		}
	});

	it("keeps message resources aligned with every static source reference", async () => {
		const sourceRoot = new URL("../../src/", import.meta.url);
		const referenced = new Set<string>();
		for (const file of await sourceFiles(sourceRoot)) {
			if (file.pathname.includes("/paraglide/")) continue;
			const source = await readFile(file, "utf8");
			for (const match of source.matchAll(
				/(?:^|[^A-Za-z0-9_$])m\.([A-Za-z0-9_]+)/g,
			))
				if (match[1]) referenced.add(match[1]);
		}
		expect(referenced.size).toBeGreaterThan(0);
		const canonical = JSON.parse(
			await readFile(
				new URL("../../messages/en-US.json", import.meta.url),
				"utf8",
			),
		) as Record<string, string>;
		expect(Object.keys(canonical).sort()).toEqual([...referenced].sort());
	});
});

function placeholders(message: string) {
	return [...message.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)]
		.map((match) => match[1])
		.filter((name): name is string => name !== undefined)
		.sort();
}

async function sourceFiles(directory: URL): Promise<URL[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files: URL[] = [];
	for (const entry of entries) {
		const url = new URL(
			entry.name + (entry.isDirectory() ? "/" : ""),
			directory,
		);
		if (entry.isDirectory()) files.push(...(await sourceFiles(url)));
		else if (/\.tsx?$/.test(entry.name)) files.push(url);
	}
	return files;
}
