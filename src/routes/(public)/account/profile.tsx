import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/(public)/account/profile")({
	beforeLoad: () => {
		throw redirect({ to: "/account/settings" });
	},
});
