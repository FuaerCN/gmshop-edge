import type { RbacAction } from "#/features/access/rbac-bitmask";
import type { SystemRbacModule } from "#/features/access/system-rbac";
import { m } from "#/paraglide/messages";

export function systemModuleLabel(id: SystemRbacModule) {
	return {
		dashboard: m.shop_dashboard_title(),
		products: m.nav_products(),
		inventory: m.nav_inventory(),
		orders: m.system_nav_orders(),
		customers: m.nav_customers(),
		coupons: m.nav_coupons(),
		payments: m.nav_payment_channels(),
		suppliers: m.nav_supplier_management(),
		delivery: m.nav_delivery(),
		automation: m.nav_automation(),
		notifications: m.settings_group_email(),
		users: m.nav_user_management(),
		roles: m.nav_role_management(),
		operations: m.nav_operations_center(),
		audit: m.nav_audit_logs(),
		settings: m.system_nav_settings(),
	}[id];
}

export function rbacActionLabel(action: RbacAction) {
	return {
		create: m.rbac_action_create(),
		read: m.rbac_action_read(),
		update: m.rbac_action_update(),
		delete: m.rbac_action_delete(),
		test: m.rbac_action_test(),
	}[action];
}
