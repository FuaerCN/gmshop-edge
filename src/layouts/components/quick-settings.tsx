"use client";

import { Settings } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import {
	AccountSettingsPanel,
	type SettingsPanelPage,
} from "#/layouts/public/account-settings-panel";
import { m } from "#/paraglide/messages";

export function QuickSettings() {
	const [open, setOpen] = useState(false);
	const [page, setPage] = useState<SettingsPanelPage>("main");
	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) setPage("main");
	};
	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button
					aria-label={m.store_header_settings()}
					className="rounded-full"
					size="icon"
					variant="ghost"
				>
					<Settings />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-72 overflow-hidden p-0">
				<AccountSettingsPanel
					onClose={() => handleOpenChange(false)}
					onPageChange={setPage}
					onSignOut={() => {}}
					page={page}
				/>
			</PopoverContent>
		</Popover>
	);
}
