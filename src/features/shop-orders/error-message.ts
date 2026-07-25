import { m } from "#/paraglide/messages";

export function shopOrderOperationErrorMessage(error: unknown) {
	if (!error || typeof error !== "object" || !("code" in error))
		return m.shop_orders_operation_failed();
	if (error.code === "order_not_found") return m.shop_orders_error_not_found();
	if (error.code === "order_version_conflict")
		return m.shop_orders_error_conflict();
	if (error.code === "order_transition_invalid")
		return m.shop_orders_error_transition();
	return m.shop_orders_operation_failed();
}
