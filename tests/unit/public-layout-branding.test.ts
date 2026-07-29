import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const publicLayoutSource = readFileSync(
	new URL("../../src/layouts/public/index.tsx", import.meta.url),
	"utf8",
);
describe("public storefront branding", () => {
	it("uses only the theme background on the public layout", () => {
		expect(publicLayoutSource).toContain(
			"const { customHtml } = useSiteBrand()",
		);
		expect(publicLayoutSource).toContain("bg-background");
		expect(publicLayoutSource).not.toMatch(
			/backgroundColor|backgroundImageUrl|backgroundImage:/,
		);
	});
});
