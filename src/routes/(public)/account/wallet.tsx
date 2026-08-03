import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/(public)/account/wallet")({
	beforeLoad: () => {
		throw redirect({ to: "/account" });
	},
});
