import { useNavigate, useRouter } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { Button } from "#/components/ui/button";
import { ErrorPage } from "#/features/errors/error-page";
import { m } from "#/paraglide/messages";

export function UnauthorisedError() {
	const navigate = useNavigate();
	const { history } = useRouter();

	return (
		<ErrorPage
			actions={
				<>
					<Button variant="ghost" onClick={() => history.go(-1)}>
						{m.common_goBack()}
					</Button>
					<Button
						onClick={() =>
							navigate({
								to: "/sign-in",
								search: { redirect: undefined },
							})
						}
					>
						{m.auth_submit()}
					</Button>
				</>
			}
			code="401"
			description={m.errors_unauthorizedDescription()}
			icon={LogIn}
			title={m.errors_unauthorizedTitle()}
		/>
	);
}
