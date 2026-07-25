"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Upload } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ProButton } from "#/components/pro/base/button";
import { Input } from "#/components/pro/base/fields/input";
import { ProTable, type ProTableState } from "#/components/pro/table";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import { PageHeader } from "#/layouts/components/page-header";
import { formatBytes, formatDateTime } from "#/lib/format";
import { m } from "#/paraglide/messages";

type Asset = {
	id: string;
	productId: string;
	productName: string;
	componentId: string;
	sellableItemName: string;
	fileName: string;
	contentType: string;
	sizeBytes: number;
	checksumSha256: string;
	version: number;
	enabled: boolean;
	createdAt: number;
};
type Target = {
	productId: string;
	productName: string;
	componentId: string;
	sellableItemName: string;
};
type AssetResponse = { data: Asset[]; targets: Target[] };

export function ProductDownloadAssets({
	productId,
	componentId,
}: {
	productId: string;
	componentId?: string;
}) {
	return (
		<DownloadAssetsPage
			embedded
			productId={productId}
			componentId={componentId}
		/>
	);
}

export function DownloadAssetsPage({
	productId,
	componentId,
	embedded = false,
}: {
	productId?: string;
	componentId?: string;
	embedded?: boolean;
} = {}) {
	const client = useQueryClient();
	const [targetValue, setTargetValue] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const [refreshKey, setRefreshKey] = useState(0);
	const query = useQuery({
		queryKey: ["admin", "download-assets"],
		queryFn: fetchAssets,
	});
	const refresh = useCallback(async () => {
		await client.invalidateQueries({ queryKey: ["admin", "download-assets"] });
		setRefreshKey((value) => value + 1);
	}, [client]);
	const upload = useMutation({
		mutationFn: async () => {
			if (!file || !selectedTarget) throw new Error("invalid_upload");
			const [selectedProductId = "", selectedComponentId = ""] =
				selectedTarget.split(":", 2);
			const form = new FormData();
			form.set("productId", selectedProductId);
			form.set("componentId", selectedComponentId);
			form.set("file", file);
			const response = await fetch("/api/admin/download-assets", {
				method: "POST",
				body: form,
				credentials: "same-origin",
			});
			if (!response.ok) throw new Error("upload_failed");
		},
		onSuccess: async () => {
			setFile(null);
			await refresh();
			toast.success(m.download_assets_upload_success());
		},
		onError: () => toast.error(m.download_assets_operation_failed()),
	});
	const toggle = useMutation({
		mutationFn: async (input: { id: string; enabled: boolean }) => {
			const response = await fetch("/api/admin/download-assets", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(input),
				credentials: "same-origin",
			});
			if (!response.ok) throw new Error("update_failed");
		},
		onSuccess: refresh,
		onError: () => toast.error(m.download_assets_operation_failed()),
	});
	const request = useCallback(
		async (state: ProTableState) => {
			const result = await client.fetchQuery({
				queryKey: ["admin", "download-assets"],
				queryFn: fetchAssets,
			});
			const search = String(
				state.columnFilters.find((filter) => filter.id === "fileName")?.value ??
					"",
			).toLocaleLowerCase();
			const filtered = result.data.filter(
				(asset) =>
					(!productId || asset.productId === productId) &&
					(!componentId || asset.componentId === componentId) &&
					`${asset.fileName} ${asset.productName} ${asset.sellableItemName}`
						.toLocaleLowerCase()
						.includes(search),
			);
			const start = state.pagination.pageIndex * state.pagination.pageSize;
			return {
				data: filtered.slice(start, start + state.pagination.pageSize),
				total: filtered.length,
			};
		},
		[client, productId, componentId],
	);
	const targets = useMemo(
		() =>
			targetOptions(
				(query.data?.targets ?? []).filter(
					(target) =>
						(!productId || target.productId === productId) &&
						(!componentId || target.componentId === componentId),
				),
			),
		[query.data?.targets, productId, componentId],
	);
	const selectedTarget =
		targetValue || (targets.length === 1 ? (targets[0]?.value ?? "") : "");
	const columns = useMemo<ColumnDef<Asset>[]>(
		() => [
			{
				accessorKey: "enabled",
				header: m.common_enabled(),
				cell: ({ row }) => (
					<Switch
						aria-label={`${m.common_enabled()} · ${row.original.fileName}`}
						checked={row.original.enabled}
						disabled={toggle.isPending}
						onCheckedChange={(enabled) =>
							toggle.mutate({ id: row.original.id, enabled })
						}
					/>
				),
			},
			{
				accessorKey: "fileName",
				header: m.download_assets_file(),
				meta: { search: true },
				cell: ({ row }) => (
					<div>
						<strong className="block">{row.original.fileName}</strong>
						<span className="text-muted-foreground text-xs">
							{row.original.contentType}
						</span>
					</div>
				),
			},
			{
				accessorKey: "productName",
				header: m.nav_products(),
				cell: ({ row }) =>
					`${row.original.productName} · ${row.original.sellableItemName}`,
			},
			{
				accessorKey: "version",
				header: m.download_assets_version(),
				cell: ({ row }) => `v${row.original.version}`,
			},
			{
				accessorKey: "sizeBytes",
				header: m.download_assets_size(),
				cell: ({ row }) => formatBytes(row.original.sizeBytes),
			},
			{
				accessorKey: "createdAt",
				header: m.shop_orders_created_at(),
				cell: ({ row }) => formatDateTime(row.original.createdAt),
			},
		],
		[toggle],
	);

	return (
		<div className="flex min-h-0 w-full flex-1 flex-col gap-4">
			{embedded ? null : (
				<PageHeader
					title={m.download_assets_title()}
					description={m.download_assets_description()}
				/>
			)}
			<div className="grid gap-4 border-y py-4 md:grid-cols-[minmax(14rem,1fr)_minmax(14rem,1fr)_auto] md:items-end">
				{productId && componentId ? (
					<div className="text-muted-foreground text-sm">
						{targets[0]?.label ?? m.download_assets_select_product()}
					</div>
				) : (
					<div className="grid gap-2">
						<Label>{m.download_assets_product_plan()}</Label>
						<Select value={selectedTarget} onValueChange={setTargetValue}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder={m.download_assets_select_product()} />
							</SelectTrigger>
							<SelectContent>
								{targets.map((target) => (
									<SelectItem key={target.value} value={target.value}>
										{target.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}
				<div className="grid gap-2">
					<Label htmlFor="download-asset-file">
						{m.download_assets_file()}
					</Label>
					<Input
						id="download-asset-file"
						type="file"
						onChange={(event) => setFile(event.target.files?.[0] ?? null)}
					/>
				</div>
				<ProButton
					disabled={!file || !selectedTarget || upload.isPending}
					onClick={() => upload.mutate()}
				>
					<Upload />
					{m.download_assets_upload()}
				</ProButton>
			</div>
			<ProTable
				className="min-h-0 flex-1"
				columns={columns}
				request={request}
				requestKey={refreshKey}
				onRefresh={refresh}
				toolbarSearch={{
					columnId: "fileName",
					placeholder: m.common_search(),
				}}
				table={{ stickyHeader: true }}
			/>
		</div>
	);
}

async function fetchAssets(): Promise<AssetResponse> {
	const response = await fetch("/api/admin/download-assets", {
		credentials: "same-origin",
	});
	if (!response.ok) throw new Error("download_assets_unavailable");
	return response.json() as Promise<AssetResponse>;
}

function targetOptions(targets: Target[]) {
	const options = new Map<string, string>();
	for (const target of targets) {
		options.set(
			`${target.productId}:${target.componentId}`,
			`${target.productName} · ${target.sellableItemName}`,
		);
	}
	return [...options].map(([value, label]) => ({ value, label }));
}
