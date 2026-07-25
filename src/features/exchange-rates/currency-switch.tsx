"use client";

import { Check, Coins } from "lucide-react";
import { ProButton } from "#/components/pro/base/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { useCurrency } from "#/features/exchange-rates/currency-context";
import { cn } from "#/lib/utils";
import { m } from "#/paraglide/messages";
import { getLocale } from "#/paraglide/runtime";

export function CurrencySwitch() {
	const { currency, currencies, setCurrency } = useCurrency();
	const locale = getLocale();
	const currencyNames = new Intl.DisplayNames([locale], { type: "currency" });
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<ProButton
					className="rounded-full"
					size="icon"
					variant="ghost"
					tooltip={`${m.store_payment_currency()} · ${currency}`}
				>
					<Coins />
				</ProButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="max-h-[min(28rem,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto"
			>
				{currencies.map((item) => (
					<DropdownMenuItem key={item} onClick={() => setCurrency(item)}>
						<span className="w-5 font-semibold text-base">
							{symbolForCurrency(item, locale)}
						</span>
						<span className="font-medium">{item}</span>
						<span className="text-muted-foreground">
							· {currencyNames.of(item) ?? item}
						</span>
						<Check
							className={cn("ms-auto", item !== currency && "invisible")}
						/>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function symbolForCurrency(currency: string, locale: string) {
	return (
		new Intl.NumberFormat(locale, {
			style: "currency",
			currency,
			currencyDisplay: "narrowSymbol",
			maximumFractionDigits: 0,
		})
			.formatToParts(0)
			.find((part) => part.type === "currency")?.value ?? currency
	);
}
