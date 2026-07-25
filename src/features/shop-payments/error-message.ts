import { m } from "#/paraglide/messages";

export function paymentChannelErrorMessage(error: unknown) {
	if (!error || typeof error !== "object" || !("code" in error))
		return m.payment_channels_operation_failed();
	if (error.code === "payment_channel_in_use")
		return m.payment_channels_error_in_use();
	if (error.code === "payment_provider_immutable")
		return m.payment_channels_error_provider_immutable();
	if (error.code === "payment_credential_required")
		return m.payment_channels_error_credentials();
	return m.payment_channels_operation_failed();
}
