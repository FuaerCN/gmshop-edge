import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
	new URL("../../src/features/suppliers/pages/products.tsx", import.meta.url),
	"utf8",
);

describe("supplier products page", () => {
	it("searches upstream names and identifiers through the shared search column", () => {
		expect(source).toContain('id: "productName"');
		expect(source).toContain("row.productName");
		expect(source).toContain("row.skuName");
		expect(source).toContain("row.productId");
		expect(source).toContain("row.skuId");
	});
});
