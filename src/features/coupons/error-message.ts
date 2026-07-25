import { m } from "#/paraglide/messages";

export function couponOperationErrorMessage(error: unknown) {
	if (!error || typeof error !== "object" || !("code" in error))
		return m.coupons_operation_failed();
	if (error.code === "coupon_not_found") return m.coupons_error_not_found();
	if (error.code === "coupon_code_conflict")
		return m.coupons_error_code_conflict();
	if (error.code === "coupon_scope_invalid")
		return m.coupons_error_scope_invalid();
	if (error.code === "coupon_in_use") return m.coupons_error_in_use();
	return m.coupons_operation_failed();
}
