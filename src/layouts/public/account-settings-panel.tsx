"use client";

import { Link } from "@tanstack/react-router";
import {
	ArrowLeft,
	Check,
	ChevronRight,
	Coins,
	Globe2,
	LayoutDashboard,
	LogOut,
	Monitor,
	Moon,
	PackageSearch,
	Palette,
	Settings,
	Sun,
} from "lucide-react";
import type { MouseEvent } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import { useThemeSelection } from "#/layouts/components/theme-switch";
import { localeLabels } from "#/lib/locales";
import { cn } from "#/lib/utils";
import { m } from "#/paraglide/messages";
import { getLocale, locales, setLocale } from "#/paraglide/runtime";
import type { Theme } from "#/stores/preferences-store";

export type HeaderUser = {
	name?: string | null;
	email?: string | null;
	image?: string | null;
};

export type SettingsPanelPage = "main" | "currency" | "locale" | "theme";

export type SettingsCurrency = {
	currency: string;
	currencies: string[];
	setCurrency: (currency: string) => void;
};

export function AccountSettingsPanel({
	page,
	user,
	onClose,
	onPageChange,
	onSignOut,
	root = false,
	currencySelection,
	showAccountLinks = true,
	showHeading = true,
	showSignOut = true,
}: {
	page: SettingsPanelPage;
	user?: HeaderUser | null;
	onClose: () => void;
	onPageChange: (page: SettingsPanelPage) => void;
	onSignOut: () => void;
	root?: boolean;
	currencySelection?: SettingsCurrency;
	showAccountLinks?: boolean;
	showHeading?: boolean;
	showSignOut?: boolean;
}) {
	const currentLocale = getLocale();
	const { theme, selectTheme } = useThemeSelection();

	if (page === "currency" && currencySelection) {
		return (
			<SelectionPage
				label={m.store_payment_currency()}
				onBack={() => onPageChange("main")}
				options={currencySelection.currencies.map((value) => ({
					label: value,
					selected: value === currencySelection.currency,
					value,
				}))}
				onSelect={(value) => {
					currencySelection.setCurrency(value);
					onPageChange("main");
				}}
			/>
		);
	}

	if (page === "locale") {
		return (
			<SelectionPage
				label={m.switch_language()}
				onBack={() => onPageChange("main")}
				options={locales.map((value) => ({
					label: localeLabels[value] ?? value,
					selected: value === currentLocale,
					value,
				}))}
				onSelect={(value) => {
					if (value !== currentLocale) setLocale(value);
					onPageChange("main");
				}}
			/>
		);
	}

	if (page === "theme") {
		const themeOptions: Array<{
			icon: typeof Sun;
			label: string;
			value: Theme;
		}> = [
			{ icon: Sun, label: m.theme_light(), value: "light" },
			{ icon: Moon, label: m.theme_dark(), value: "dark" },
			{ icon: Monitor, label: m.theme_system(), value: "auto" },
		];
		return (
			<SelectionPage
				label={m.toggle_theme()}
				onBack={() => onPageChange("main")}
				options={themeOptions.map(({ icon, label, value }) => ({
					icon,
					label,
					selected: value === theme,
					value,
				}))}
				onSelect={(value, event) => {
					selectTheme(value, event);
					onPageChange("main");
				}}
			/>
		);
	}

	const name = user?.name || user?.email || m.store_account_title();
	return (
		<div className="grid max-h-[min(38rem,calc(100svh-2rem))] overflow-y-auto">
			{user ? (
				<div
					className={cn(
						"flex items-center gap-3 p-4",
						showAccountLinks && "border-b",
					)}
				>
					<Avatar className="size-11">
						<AvatarImage alt={name} src={user.image || ""} />
						<AvatarFallback>
							{userFallback(name, user.email || "")}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1">
						<p className="truncate font-medium">{name}</p>
						{user.email ? (
							<p className="truncate text-muted-foreground text-xs">
								{user.email}
							</p>
						) : null}
					</div>
					{showAccountLinks ? null : (
						<Button
							asChild
							aria-label={m.store_account_settings()}
							className="rounded-full"
							size="icon"
							variant="ghost"
						>
							<Link onClick={onClose} to="/account/settings">
								<Settings />
							</Link>
						</Button>
					)}
				</div>
			) : showHeading ? (
				<div className="border-b p-4">
					<h2 className="font-semibold">{m.store_header_settings()}</h2>
				</div>
			) : null}

			{user && showAccountLinks ? (
				<div className="grid gap-1 border-b p-2">
					{root ? (
						<PanelLink
							icon={LayoutDashboard}
							label={m.store_admin_dashboard()}
							onClick={onClose}
							to="/admin"
						/>
					) : null}
					<PanelLink
						icon={Settings}
						label={m.store_account_settings()}
						onClick={onClose}
						to="/account/settings"
					/>
					<PanelLink
						icon={PackageSearch}
						label={m.store_account_orders()}
						onClick={onClose}
						to="/account/orders"
					/>
				</div>
			) : null}

			<div className="grid gap-1 p-2">
				{currencySelection ? (
					<PreferenceButton
						icon={Coins}
						label={m.store_payment_currency()}
						onClick={() => onPageChange("currency")}
						value={currencySelection.currency}
					/>
				) : null}
				<PreferenceButton
					icon={Globe2}
					label={m.switch_language()}
					onClick={() => onPageChange("locale")}
					value={localeLabels[currentLocale] ?? currentLocale}
				/>
				<PreferenceButton
					icon={Palette}
					label={m.toggle_theme()}
					onClick={() => onPageChange("theme")}
					value={themeLabel(theme)}
				/>
			</div>

			{user && showSignOut ? (
				<div className="border-t p-2">
					<Button
						className="w-full justify-start text-destructive-foreground hover:bg-destructive/10 hover:text-destructive-foreground"
						onClick={onSignOut}
						variant="ghost"
					>
						<LogOut />
						{m.layout_signOut_title()}
					</Button>
				</div>
			) : null}
		</div>
	);
}

function SelectionPage<T extends string>({
	label,
	onBack,
	onSelect,
	options,
}: {
	label: string;
	onBack: () => void;
	onSelect: (value: T, event: MouseEvent<HTMLButtonElement>) => void;
	options: Array<{
		icon?: typeof Sun;
		label: string;
		selected: boolean;
		value: T;
	}>;
}) {
	return (
		<div className="grid max-h-[min(38rem,calc(100svh-2rem))] grid-rows-[auto_minmax(0,1fr)]">
			<div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center border-b p-2">
				<Button
					aria-label={m.store_header_settings_back()}
					onClick={onBack}
					size="icon"
					variant="ghost"
				>
					<ArrowLeft />
				</Button>
				<h2 className="text-center font-semibold">{label}</h2>
			</div>
			<div className="overflow-y-auto p-2">
				{options.map((option) => (
					<Button
						className="h-11 w-full justify-start rounded-lg px-3"
						key={option.value}
						onClick={(event) => onSelect(option.value, event)}
						variant="ghost"
					>
						{option.icon ? <option.icon /> : null}
						<span className="truncate">{option.label}</span>
						<Check className={cn("ms-auto", !option.selected && "invisible")} />
					</Button>
				))}
			</div>
		</div>
	);
}

function PanelLink({
	icon: Icon,
	label,
	onClick,
	to,
}: {
	icon: typeof Settings;
	label: string;
	onClick: () => void;
	to: "/account/orders" | "/account/settings" | "/admin";
}) {
	return (
		<Button asChild className="justify-start" variant="ghost">
			<Link onClick={onClick} to={to}>
				<Icon />
				{label}
				<ChevronRight className="ms-auto" />
			</Link>
		</Button>
	);
}

function PreferenceButton({
	icon: Icon,
	label,
	onClick,
	value,
}: {
	icon: typeof Coins;
	label: string;
	onClick: () => void;
	value: string;
}) {
	return (
		<Button className="h-12 justify-start" onClick={onClick} variant="ghost">
			<Icon />
			<span>{label}</span>
			<span className="ms-auto max-w-32 truncate text-muted-foreground text-xs">
				{value}
			</span>
			<ChevronRight />
		</Button>
	);
}

function themeLabel(theme: Theme) {
	if (theme === "light") return m.theme_light();
	if (theme === "dark") return m.theme_dark();
	return m.theme_system();
}

function userFallback(name: string, email: string) {
	return (name || email || "U")
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join("");
}
