import { ClientOnly } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { ProEditor as MonacoProEditor } from ".";

export function ProEditor(props: ComponentProps<typeof MonacoProEditor>) {
	const height =
		typeof props.height === "number" ? `${props.height}px` : props.height;

	return (
		<ClientOnly
			fallback={
				<div
					aria-hidden="true"
					className="animate-pulse rounded-lg border bg-muted/40"
					style={height ? { height } : undefined}
				/>
			}
		>
			<MonacoProEditor {...props} />
		</ClientOnly>
	);
}
