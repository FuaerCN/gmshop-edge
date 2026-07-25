import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/suppliers/")({
	beforeLoad: () => {
		throw redirect({ to: "/admin/suppliers/products" });
	},
});
