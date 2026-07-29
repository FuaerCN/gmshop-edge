import {
	BellRing,
	Boxes,
	Laptop,
	LayoutDashboard,
	PackageSearch,
	Settings,
} from "lucide-react";
import { m } from "#/paraglide/messages";

export const accountNavigation = [
	{
		to: "/account",
		label: () => m.shop_dashboard_title(),
		icon: LayoutDashboard,
	},
	{
		to: "/account/orders",
		label: () => m.store_account_orders(),
		icon: PackageSearch,
	},
	{
		to: "/account/entitlements",
		label: () => m.store_account_entitlements(),
		icon: Boxes,
	},
	{
		to: "/account/settings",
		label: () => m.store_account_settings(),
		icon: Settings,
	},
	{
		to: "/account/sessions",
		label: () => m.store_account_sessions(),
		icon: Laptop,
	},
	{
		to: "/account/notifications",
		label: () => m.store_account_notifications(),
		icon: BellRing,
	},
] as const;
