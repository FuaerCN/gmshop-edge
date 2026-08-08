"use client";

import { Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CopyButton } from "#/components/pro/base/button";
import { Skeleton } from "#/components/ui/skeleton";
import { cn } from "#/lib/utils";
import { m } from "#/paraglide/messages";

export function DeliveryRevealContent({
	deliveryId,
	orderNumber,
	email,
	className,
	skeletonClassName,
}: {
	deliveryId: string;
	orderNumber: string;
	email?: string;
	className?: string;
	skeletonClassName?: string;
}) {
	const requested = useRef(false);
	const [content, setContent] = useState("");
	const [failed, setFailed] = useState(false);
	const endpoint = `/api/shop/orders/${encodeURIComponent(orderNumber)}/deliveries/${encodeURIComponent(deliveryId)}/reveal`;

	useEffect(() => {
		if (requested.current) return;
		requested.current = true;
		void fetch(endpoint, revealRequest(email))
			.then(async (response) => {
				if (!response.ok) throw new Error("delivery_reveal_failed");
				const body = (await response.json()) as { content?: unknown };
				if (typeof body.content !== "string")
					throw new Error("delivery_reveal_failed");
				setContent(body.content);
			})
			.catch(() => setFailed(true));
	}, [email, endpoint]);

	if (failed)
		return (
			<p className="text-destructive text-sm">
				{m.store_delivery_reveal_failed()}
			</p>
		);
	if (!content)
		return (
			<Skeleton className={cn("h-12 w-full rounded-xl", skeletonClassName)} />
		);
	return (
		<div
			className={cn(
				"flex min-w-0 items-center gap-2 rounded-xl border bg-muted/30 p-2 pl-3",
				className,
			)}
		>
			<code className="min-w-0 flex-1 overflow-x-auto font-mono text-sm whitespace-pre">
				{content}
			</code>
			<CopyButton
				aria-label={m.store_copy_delivery()}
				copy={content}
				icon={<Copy />}
				onClick={() => void fetch(endpoint, revealRequest(email, "copied"))}
				size="icon-sm"
				tooltip={m.store_copy_delivery()}
				variant="ghost"
			/>
		</div>
	);
}

function revealRequest(email?: string, action?: "copied"): RequestInit {
	return {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ action, email }),
		credentials: "same-origin",
	};
}
