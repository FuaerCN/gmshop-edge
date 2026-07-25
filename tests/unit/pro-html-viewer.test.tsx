import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HtmlViewer } from "#/components/pro/viewer/html";

describe("HtmlViewer", () => {
	it("passes the resolved light theme into the preview document", () => {
		const html = renderToStaticMarkup(
			<HtmlViewer content="<main>Preview</main>" theme="light" />,
		);

		expect(html).toContain("color-scheme:light");
		expect(html).toContain("background:#ffffff");
		expect(html).toContain("&lt;main&gt;Preview&lt;/main&gt;");
	});

	it("injects the resolved dark theme into a complete HTML document", () => {
		const html = renderToStaticMarkup(
			<HtmlViewer
				content="<html><head><title>Preview</title></head><body>Dark</body></html>"
				theme="dark"
			/>,
		);

		expect(html).toContain("color-scheme:dark");
		expect(html).toContain("background:#0a0a0a");
		expect(html).toContain("&lt;title&gt;Preview&lt;/title&gt;");
	});
});
