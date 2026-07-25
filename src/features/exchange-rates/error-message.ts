import { m } from "#/paraglide/messages";

export function exchangeRateErrorMessage(error: unknown) {
	if (!error || typeof error !== "object" || !("code" in error))
		return m.common_operation_failed();
	switch (error.code) {
		case "exchange_rate_base_currency_invalid":
			return m.exchange_rates_error_base_currency();
		case "exchange_rate_exists":
			return m.exchange_rates_error_exists();
		case "exchange_rate_expiry_invalid":
			return m.exchange_rates_error_expiry();
		case "exchange_rate_in_use":
			return m.exchange_rates_error_in_use();
		case "exchange_rate_not_found":
			return m.exchange_rates_error_not_found();
		case "exchange_rate_sync_not_configured":
			return m.exchange_rates_error_sync_unconfigured();
		case "exchange_rate_sync_credentials_required":
			return m.exchange_rates_error_sync_credentials();
		case "exchange_rate_sync_failed":
			return m.exchange_rates_error_sync_failed();
		default:
			return m.common_operation_failed();
	}
}
