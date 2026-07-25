import { m } from "#/paraglide/messages";

export function customerOperationErrorMessage(error: unknown) {
	if (!error || typeof error !== "object" || !("code" in error))
		return m.customers_operation_failed();
	if (error.code === "customer_not_found") return m.customers_error_not_found();
	if (error.code === "customer_deleted") return m.customers_error_deleted();
	return m.customers_operation_failed();
}
