import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(
	new URL("../../src/features/home/index.tsx", import.meta.url),
	"utf8",
);
const routeSource = readFileSync(
	new URL("../../src/routes/(public)/index.tsx", import.meta.url),
	"utf8",
);

describe("storefront home filters", () => {
	it("uses the shared select component for product sorting", () => {
		expect(homeSource).toContain("<Select");
		expect(homeSource).toContain("<SelectTrigger");
		expect(homeSource).toContain("<SelectContent");
		expect(homeSource).not.toContain("<select");
	});

	it("omits inactive filters and the default sort from the URL", () => {
		expect(routeSource).toContain(
			'stripSearchParams({ search: "", tag: "", sort: "featured" })',
		);
	});
});
