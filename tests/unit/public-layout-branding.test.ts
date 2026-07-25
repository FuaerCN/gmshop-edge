import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const publicLayoutSource = readFileSync(
	new URL("../../src/layouts/public/index.tsx", import.meta.url),
	"utf8",
);
const rootSource = readFileSync(
	new URL("../../src/routes/__root.tsx", import.meta.url),
	"utf8",
);

describe("public storefront branding", () => {
	it("scopes the configured background color and image to the public layout", () => {
		expect(publicLayoutSource).toContain(
			"backgroundColor, backgroundImageUrl, customHtml",
		);
		expect(publicLayoutSource).toContain("backgroundColor: backgroundColor");
		expect(publicLayoutSource).toContain("backgroundImage: backgroundImageUrl");
		expect(rootSource).not.toContain("backgroundImageUrl");
		expect(rootSource).not.toContain("brand.backgroundColor");
	});
});
