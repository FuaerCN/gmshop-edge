import { useNavigate } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import type { HTMLAttributes } from "react";
import { Button } from "#/components/ui/button";
import { ErrorPage } from "#/features/errors/error-page";
import { m } from "#/paraglide/messages";

type GeneralErrorProps = HTMLAttributes<HTMLDivElement> & {
	minimal?: boolean;
};

export function GeneralError({
	className,
	minimal = false,
}: GeneralErrorProps) {
	const navigate = useNavigate();

	return (
		<ErrorPage
			actions={
				!minimal ? (
					<>
						<Button variant="ghost" onClick={() => window.location.reload()}>
							{m.common_retry()}
						</Button>
						<Button onClick={() => navigate({ to: "/" })}>
							{m.errors_back_to_store()}
						</Button>
					</>
				) : undefined
			}
			className={className}
			code={minimal ? undefined : "500"}
			description={m.errors_generalDescription()}
			icon={RotateCcw}
			minimal={minimal}
			title={m.errors_generalTitle()}
		/>
	);
}
