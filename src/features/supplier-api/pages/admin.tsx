"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Save } from "lucide-react";
import { toast } from "sonner";
import { formBooleanValue, ProSchemaForm } from "#/components/pro/form";
import { Button } from "#/components/ui/button";
import { PageHeader } from "#/layouts/components/page-header";
import { m } from "#/paraglide/messages";
import {
	getSupplierApiConfigurationFn,
	setSupplierApiConfigurationFn,
} from "../server/admin";

const configurationKey = ["admin", "supplier-api", "configuration"] as const;

export function SupplierApiAdminPage() {
	const formId = "system-settings-supplier-api";
	const client = useQueryClient();
	const configuration = useQuery({
		queryKey: configurationKey,
		queryFn: () => getSupplierApiConfigurationFn(),
	});
	const toggle = useMutation({
		mutationFn: (enabled: boolean) =>
			setSupplierApiConfigurationFn({ data: { enabled } }),
		onSuccess: async () => {
			await client.invalidateQueries({ queryKey: configurationKey });
			toast.success(m.settings_saved());
		},
		onError: () => toast.error(m.web_support_failed()),
	});
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<PageHeader
				title={m.settings_supplier_api_enabled()}
				description={m.settings_supplier_api_enabled_description()}
				actions={
					<>
						<Button asChild variant="outline">
							<a href="/openapi" rel="noreferrer" target="_blank">
								<ExternalLink />
								{m.supplier_api_documentation()}
							</a>
						</Button>
						<Button
							disabled={configuration.isLoading || toggle.isPending}
							form={formId}
							type="submit"
						>
							<Save />
							{m.settings_save_changes()}
						</Button>
					</>
				}
			/>
			<div className="mt-6 min-h-0 flex-1 overflow-y-auto pe-3">
				<ProSchemaForm
					id={formId}
					key={String(configuration.data?.enabled ?? false)}
					schema={[
						{
							name: "enabled",
							label: m.settings_supplier_api_enabled(),
							description: m.settings_supplier_api_enabled_description(),
							valueType: "switch",
							disabled: configuration.isLoading || toggle.isPending,
						},
					]}
					initialValues={{ enabled: configuration.data?.enabled ?? false }}
					onFinish={async (values) => {
						await toggle.mutateAsync(formBooleanValue(values.enabled));
					}}
					submitter={false}
				/>
			</div>
		</div>
	);
}
