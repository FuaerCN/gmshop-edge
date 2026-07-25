import type { ComponentProps } from "react";
import { cn } from "#/lib/utils";
import { m } from "#/paraglide/messages";

type HtmlViewerProps = Omit<ComponentProps<"iframe">, "srcDoc"> & {
	content: string;
	theme?: "light" | "dark";
};

export function HtmlViewer({
	content,
	theme = "light",
	sandbox = "allow-scripts",
	className,
	title = m.common_preview(),
	...props
}: HtmlViewerProps) {
	return (
		<iframe
			className={cn("size-full border-0 bg-background", className)}
			sandbox={sandbox}
			srcDoc={withViewerTheme(content, theme)}
			title={title}
			{...props}
		/>
	);
}

function withViewerTheme(content: string, theme: "light" | "dark") {
	const foreground = theme === "dark" ? "#fafafa" : "#0a0a0a";
	const background = theme === "dark" ? "#0a0a0a" : "#ffffff";
	const themeHead = `<meta name="color-scheme" content="${theme}"><style>:root{color-scheme:${theme}}html,body{background:${background};color:${foreground}}</style>`;
	const headMatch = content.match(/<head(?:\s[^>]*)?>/i);

	if (!headMatch || headMatch.index === undefined) {
		return `${themeHead}${content}`;
	}

	const insertionPoint = headMatch.index + headMatch[0].length;
	return `${content.slice(0, insertionPoint)}${themeHead}${content.slice(insertionPoint)}`;
}
