import { compareItems, rankItem } from "@tanstack/match-sorter-utils";
import type {
	ColumnDef,
	FilterFn,
	Row,
	SortingFn,
} from "@tanstack/react-table";
import { cn } from "#/lib/utils";
import type { ColumnFilterMeta, ProTableSearch, TableSize } from "./types";

export function getLeafColumnIds<TData, TValue>(
	columns: ColumnDef<TData, TValue>[],
): string[] {
	return columns.flatMap((column, index) =>
		"columns" in column && Array.isArray(column.columns)
			? getLeafColumnIds(column.columns)
			: getColumnDefId(column, index),
	);
}

export function getSystemColumnPinning(id: string | undefined) {
	if (id === "select" || id === "drag") return "left";
	if (id === "actions" || id === "operation") return "right";
	return undefined;
}

export function getPinnedColumnIds<TData, TValue>(
	columns: ColumnDef<TData, TValue>[],
	side: "left" | "right",
): string[] {
	return columns.flatMap((column, index) => {
		if ("columns" in column && Array.isArray(column.columns)) {
			return getPinnedColumnIds(column.columns, side);
		}
		const id = getColumnDefId(column, index);
		const pinned = column.meta?.pinned ?? getSystemColumnPinning(id);
		return pinned === side ? [id] : [];
	});
}

export function withProTableColumnDefaults<TData, TValue>(
	columns: ColumnDef<TData, TValue>[],
	toolbarSearch?: ProTableSearch,
): ColumnDef<TData, TValue>[] {
	return columns.map((column, index) => {
		const children =
			"columns" in column && Array.isArray(column.columns)
				? withProTableColumnDefaults(column.columns, toolbarSearch)
				: undefined;
		const filter = column.meta?.filter;
		const columnId = getColumnDefId(column, index);
		const search =
			column.meta?.search ?? getColumnSearchEnabled(toolbarSearch, columnId);
		const shouldApplyFilter = filter && column.filterFn === undefined;
		const shouldApplySearchFilter =
			search && !filter && column.filterFn === undefined;
		const shouldApplyFuzzySort = search && column.sortingFn === undefined;
		const systemPinned = getSystemColumnPinning(columnId);

		if (
			!children &&
			!shouldApplyFilter &&
			!shouldApplySearchFilter &&
			!shouldApplyFuzzySort &&
			!systemPinned
		) {
			return column;
		}

		return {
			...column,
			...(children ? { columns: children } : {}),
			...(systemPinned
				? {
						enableHiding: column.enableHiding ?? false,
						meta: {
							pinned: systemPinned,
							...column.meta,
							className: cn("w-8", column.meta?.className),
						},
					}
				: {}),
			...(shouldApplyFilter ? { filterFn: getColumnFilterFn(filter) } : {}),
			...(shouldApplySearchFilter
				? {
						filterFn: ((row, currentColumnId, filterValue, addMeta) => {
							const value = String(filterValue ?? "");
							if (!value) return true;
							const itemRank = rankItem(row.getValue(currentColumnId), value);
							addMeta({ itemRank });
							return itemRank.passed;
						}) satisfies FilterFn<TData>,
					}
				: {}),
			...(shouldApplyFuzzySort
				? {
						sortingFn: ((rowA, rowB, currentColumnId) => {
							const rankA = rowA.columnFiltersMeta[currentColumnId]?.itemRank;
							const rankB = rowB.columnFiltersMeta[currentColumnId]?.itemRank;
							if (rankA && rankB) {
								const rankSort = compareItems(rankA, rankB);
								if (rankSort !== 0) return rankSort;
							}
							return collator.compare(
								String(rowA.getValue(currentColumnId) ?? ""),
								String(rowB.getValue(currentColumnId) ?? ""),
							);
						}) satisfies SortingFn<TData>,
					}
				: {}),
		};
	});
}

export function sortRowsByRank<TData>(rows: Row<TData>[], columnId: string) {
	return [...rows].sort((rowA, rowB) => {
		const rankA = rowA.columnFiltersMeta[columnId]?.itemRank;
		const rankB = rowB.columnFiltersMeta[columnId]?.itemRank;
		if (rankA && rankB) {
			const rankSort = compareItems(rankA, rankB);
			if (rankSort !== 0) return rankSort;
		}
		if (rankA) return -1;
		if (rankB) return 1;
		return rowA.index - rowB.index;
	});
}

export function getTablePaddingClass(size: TableSize) {
	if (size === "compact") return "py-1";
	if (size === "middle") return "py-2";
	return "py-3";
}

export function getAriaSort(canSort: boolean, sorted: false | "asc" | "desc") {
	if (!canSort) return undefined;
	if (sorted === "asc") return "ascending";
	if (sorted === "desc") return "descending";
	return "none";
}

function getColumnDefId<TData, TValue>(
	column: ColumnDef<TData, TValue>,
	index: number,
) {
	if (column.id) return column.id;
	if ("accessorKey" in column && typeof column.accessorKey === "string") {
		return column.accessorKey;
	}
	return String(index);
}

function getColumnSearchEnabled(
	toolbarSearch: ProTableSearch | undefined,
	columnId: string,
) {
	if (toolbarSearch === false || toolbarSearch === undefined) return undefined;
	if (typeof toolbarSearch === "string") return toolbarSearch === columnId;
	return toolbarSearch.columnId === columnId;
}

function getColumnFilterFn<TData>(filter: ColumnFilterMeta<TData>) {
	if (filter.onFilter) {
		return ((row, _columnId, filterValue) => {
			if (
				filterValue === undefined ||
				filterValue === null ||
				filterValue === ""
			) {
				return true;
			}
			if (Array.isArray(filterValue)) {
				if (filterValue.length === 0) return true;
				return filterValue.some((value) =>
					filter.onFilter?.(String(value), row.original),
				);
			}
			return !!filter.onFilter?.(String(filterValue), row.original);
		}) satisfies FilterFn<TData>;
	}

	if (filter.multiple) {
		return ((row, columnId, filterValue) => {
			if (
				filterValue === undefined ||
				filterValue === null ||
				filterValue === ""
			) {
				return true;
			}
			const rowValue = row.getValue(columnId);
			if (Array.isArray(filterValue)) {
				return filterValue.length === 0 || filterValue.includes(rowValue);
			}
			return filterValue === rowValue;
		}) satisfies FilterFn<TData>;
	}

	return "equals";
}

const collator = new Intl.Collator(undefined, {
	numeric: true,
	sensitivity: "base",
});
