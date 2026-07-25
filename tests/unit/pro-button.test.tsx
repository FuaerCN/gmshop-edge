import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProButton } from "#/components/pro/base/button";

describe("ProButton", () => {
	it("supports an asChild link inside a tooltip", () => {
		expect(() =>
			renderToString(
				<ProButton asChild tooltip="Open supplier">
					<a href="https://supplier.example.invalid">Supplier</a>
				</ProButton>,
			),
		).not.toThrow();
	});
});
