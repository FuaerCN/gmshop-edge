import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { useCallback, useMemo } from "react";
import type { ColumnFilterConfig, ProTableState } from "./types";

export function useProTableUrlState(params: {
	search: Record<string, unknown>;
	navigate: (opts: {
		search:
			| true
			| Record<string, unknown>
			| ((
					prev: Record<string, unknown>,
			  ) => Partial<Record<string, unknown>> | Record<string, unknown>);
		replace?: boolean;
	}) => void;
	pagination?: {
		pageKey?: string;
		pageSizeKey?: string;
		defaultPage?: number;
		defaultPageSize?: number;
	};
	sorting?: {
		sortKey?: string;
		orderKey?: string;
	};
	columnFilters?: ColumnFilterConfig[];
}): {
	initialState: Partial<ProTableState>;
	onChange: (state: ProTableState) => void;
} {
	const {
		search,
		navigate,
		pagination: paginationConfig,
		sorting: sortingConfig,
		columnFilters: columnFilterConfigs,
	} = params;
	const pageKey = paginationConfig?.pageKey ?? "page";
	const pageSizeKey = paginationConfig?.pageSizeKey ?? "pageSize";
	const defaultPage = paginationConfig?.defaultPage ?? 1;
	const defaultPageSize = paginationConfig?.defaultPageSize ?? 10;
	const sortKey = sortingConfig?.sortKey ?? "sort";
	const orderKey = sortingConfig?.orderKey ?? "order";

	const initialState = useMemo<Partial<ProTableState>>(() => {
		const page =
			typeof search[pageKey] === "number"
				? search[pageKey]
				: Number(search[pageKey]);
		const pageSize =
			typeof search[pageSizeKey] === "number"
				? search[pageSizeKey]
				: Number(search[pageSizeKey]);
		const sortId = search[sortKey];
		const columnFilters: ColumnFiltersState = (
			columnFilterConfigs ?? []
		).flatMap<{ id: string; value: unknown }>((config) => {
			const value = config.deserialize
				? config.deserialize(search[config.searchKey])
				: search[config.searchKey];
			if (config.type === "array") {
				return Array.isArray(value) && value.length > 0
					? [{ id: config.columnId, value }]
					: [];
			}
			return typeof value === "string" && value.trim() !== ""
				? [{ id: config.columnId, value }]
				: [];
		});
		const sorting: SortingState =
			typeof sortId === "string" && sortId.trim() !== ""
				? [{ id: sortId, desc: search[orderKey] === "desc" }]
				: [];

		return {
			pagination: {
				pageIndex: Math.max(
					0,
					(Number.isFinite(page) ? page : defaultPage) - 1,
				),
				pageSize: Number.isFinite(pageSize) ? pageSize : defaultPageSize,
			},
			sorting,
			columnFilters,
		};
	}, [
		columnFilterConfigs,
		defaultPage,
		defaultPageSize,
		orderKey,
		pageKey,
		pageSizeKey,
		search,
		sortKey,
	]);

	const onChange = useCallback(
		(state: ProTableState) => {
			const sorting = state.sorting[0];
			const patch: Record<string, unknown> = {
				[pageKey]: undefined,
				[pageSizeKey]: undefined,
				[sortKey]: undefined,
				[orderKey]: undefined,
			};
			const nextPage = state.pagination.pageIndex + 1;
			if (nextPage > defaultPage) patch[pageKey] = nextPage;
			if (state.pagination.pageSize !== defaultPageSize) {
				patch[pageSizeKey] = state.pagination.pageSize;
			}
			if (sorting) {
				patch[sortKey] = sorting.id;
				patch[orderKey] = sorting.desc ? "desc" : "asc";
			}

			const filterValues = new Map(
				state.columnFilters.map((filter) => [filter.id, filter.value] as const),
			);
			for (const config of columnFilterConfigs ?? []) {
				const filterValue = filterValues.get(config.columnId);
				patch[config.searchKey] = undefined;
				if (config.type === "array") {
					const value = Array.isArray(filterValue) ? filterValue : [];
					if (value.length > 0) {
						patch[config.searchKey] = config.serialize
							? config.serialize(value)
							: value;
					}
					continue;
				}
				const value = typeof filterValue === "string" ? filterValue : "";
				if (value.trim() !== "") {
					patch[config.searchKey] = config.serialize
						? config.serialize(value)
						: value;
				}
			}

			navigate({ search: (previous) => ({ ...previous, ...patch }) });
		},
		[
			columnFilterConfigs,
			defaultPage,
			defaultPageSize,
			navigate,
			orderKey,
			pageKey,
			pageSizeKey,
			sortKey,
		],
	);

	return { initialState, onChange };
}
