import { useNavigate, useRouter } from "@tanstack/react-router";
import { SearchX } from "lucide-react";
import { Button } from "#/components/ui/button";
import { ErrorPage } from "#/features/errors/error-page";
import { m } from "#/paraglide/messages";

export function NotFoundError() {
	const navigate = useNavigate();
	const { history } = useRouter();

	return (
		<ErrorPage
			actions={
				<>
					<Button variant="ghost" onClick={() => history.go(-1)}>
						{m.common_goBack()}
					</Button>
					<Button onClick={() => navigate({ to: "/" })}>
						{m.errors_back_to_store()}
					</Button>
				</>
			}
			code="404"
			description={m.errors_notFoundDescription()}
			icon={SearchX}
			title={m.errors_notFoundTitle()}
		/>
	);
}
