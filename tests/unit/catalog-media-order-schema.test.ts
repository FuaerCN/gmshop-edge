import { describe, expect, it } from "vitest";
import { productMediaOrderSchema } from "#/features/catalog/schema";

describe("product media ordering", () => {
	const productId = "00000000-0000-4000-8000-000000000001";
	const first = "00000000-0000-4000-8000-000000000002";
	const second = "00000000-0000-4000-8000-000000000003";

	it("accepts a unique complete ordering payload", () => {
		expect(
			productMediaOrderSchema.parse({
				productId,
				ids: [second, first],
			}),
		).toEqual({ productId, ids: [second, first] });
	});

	it("rejects duplicate media IDs", () => {
		expect(() =>
			productMediaOrderSchema.parse({
				productId,
				ids: [first, first],
			}),
		).toThrow();
	});
});
