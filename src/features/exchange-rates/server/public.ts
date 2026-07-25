import { createServerFn } from "@tanstack/react-start";
import { getDb } from "#/server/db.server";

type PublicRateRow = {
	id: string;
	base_currency: string;
	quote_currency: string;
	rate: string;
	observed_at: number;
};

export const getStoreCurrencyConfigurationFn = createServerFn({
	method: "GET",
}).handler(async () => {
	const db = getDb().$client;
	const [settings, rates] = await db.batch([
		db.prepare(
			`SELECT key, value FROM system_settings WHERE key IN
				 ('commerce.default_currency', 'commerce.currency_decimals',
				  'commerce.currency_symbol')`,
		),
		db.prepare(
			`SELECT id, base_currency, quote_currency, rate, observed_at
					 FROM exchange_rates
					 WHERE enabled = 1
					 ORDER BY sort_order, quote_currency, id`,
		),
	]);
	const values = new Map(
		((settings?.results ?? []) as Array<{ key: string; value: string }>).map(
			(row) => {
				try {
					return [row.key, JSON.parse(row.value) as unknown] as const;
				} catch {
					return [row.key, null] as const;
				}
			},
		),
	);
	const baseCurrency = String(
		values.get("commerce.default_currency") ?? "USD",
	).toUpperCase();
	const available = (rates?.results ?? []) as PublicRateRow[];
	return {
		baseCurrency,
		baseCurrencyDecimals: Number(values.get("commerce.currency_decimals") ?? 2),
		baseCurrencySymbol: String(values.get("commerce.currency_symbol") ?? "$"),
		currencies: [
			baseCurrency,
			...available.flatMap((rate) => [rate.base_currency, rate.quote_currency]),
		].filter((currency, index, values) => values.indexOf(currency) === index),
		rates: available.map((rate) => ({
			id: rate.id,
			baseCurrency: rate.base_currency,
			quoteCurrency: rate.quote_currency,
			rate: rate.rate,
			observedAt: rate.observed_at,
		})),
	};
});
