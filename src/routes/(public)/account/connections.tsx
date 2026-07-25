import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/(public)/account/connections")({
	beforeLoad: () => {
		throw redirect({ to: "/account/settings" });
	},
});
