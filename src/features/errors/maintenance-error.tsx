import { Wrench } from "lucide-react";
import { Button } from "#/components/ui/button";
import { ErrorPage } from "#/features/errors/error-page";
import { m } from "#/paraglide/messages";

export function MaintenanceError() {
	return (
		<ErrorPage
			actions={
				<Button onClick={() => window.location.reload()}>
					{m.common_retry()}
				</Button>
			}
			code="503"
			description={m.errors_maintenanceDescription()}
			icon={Wrench}
			title={m.errors_maintenanceTitle()}
		/>
	);
}
