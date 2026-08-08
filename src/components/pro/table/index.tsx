"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
	type ColumnDef,
	type ColumnFiltersState,
	type ColumnPinningState,
	flexRender,
	getCoreRowModel,
	getFacetedRowModel,
	getFacetedUniqueValues,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type OnChangeFn,
	type PaginationState,
	type RowSelectionState,
	type SortingState,
	type Table,
	type TableOptions,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
	type Dispatch,
	type ReactNode,
	type RefObject,
	type SetStateAction,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { cn } from "#/lib/utils.ts";
import { m } from "#/paraglide/messages";
import type { ProButtonSize } from "../base/button";
import { ProPagination } from "../pagination";
import {
	getPinnedColumnClassName,
	getPinnedColumnStyle,
	ProTableBody,
} from "./body";
import { ProTableBulkActions } from "./bulk-actions";
import { ProTableColumnSettings } from "./column-settings";
import {
	getAriaSort,
	getLeafColumnIds,
	getPinnedColumnIds,
	getTablePaddingClass,
	sortRowsByRank,
	withProTableColumnDefaults,
} from "./state-utils";
import { ProTableToolbar } from "./toolbar";
import type {
	ProTableDragSortOptions,
	ProTablePinnedColumnOffsets,
	ProTableRenderContext,
	ProTableSearch,
	ProTableState,
	ProTableTableOptions,
	ProTableToolbarSlot,
	TableSize,
} from "./types";

export type { ColumnFilterConfig, ProTableState } from "./types";
export { useProTableUrlState } from "./url-state";

function useProTable<TData, TValue>({
	columns,
	data,
	setData,
	toolbarSearch,
	size,
	paginationOptions,
	dragSort,
	tableOptions,
	manual = false,
	requestTotal,
	loading,
	pagination,
	setPagination,
	sorting,
	setSorting,
	columnFilters,
	setColumnFilters,
}: {
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	setData: Dispatch<SetStateAction<TData[]>>;
	pagination: PaginationState;
	setPagination: Dispatch<SetStateAction<PaginationState>>;
	sorting: SortingState;
	setSorting: Dispatch<SetStateAction<SortingState>>;
	columnFilters: ColumnFiltersState;
	setColumnFilters: Dispatch<SetStateAction<ColumnFiltersState>>;
	toolbarSearch?: ProTableSearch;
	size?: ProButtonSize;
	paginationOptions?: false;
	dragSort?: false | ProTableDragSortOptions<TData>;
	tableOptions?: ProTableTableOptions;
	manual?: boolean;
	requestTotal?: number;
	loading?: boolean;
}) {
	const [internalRowSelection, setInternalRowSelection] =
		useState<RowSelectionState>({});
	const rowSelection =
		tableOptions?.rowSelection?.value ?? internalRowSelection;
	const handleRowSelectionChange =
		tableOptions?.rowSelection?.onChange ?? setInternalRowSelection;
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [tableSize, setTableSize] = useState<TableSize>("default");
	const tableRef = useRef<HTMLTableElement>(null);
	const tableColumns = useMemo(
		() => withProTableColumnDefaults(columns, toolbarSearch),
		[columns, toolbarSearch],
	);
	const tableColumnIdsKey = getLeafColumnIds(tableColumns).join("\0");
	const rankedSortedRowModel = useMemo(() => {
		const sortedRowModel = getSortedRowModel<TData>();

		return (table: Table<TData>) => {
			const getSorted = sortedRowModel(table);

			return () => {
				const rowModel = getSorted();
				if (table.options.manualSorting || table.getState().sorting.length > 0)
					return rowModel;

				const rankedColumnId = rowModel.rows
					.flatMap((row) =>
						Object.keys(row.columnFiltersMeta).filter(
							(columnId) => !!row.columnFiltersMeta[columnId]?.itemRank,
						),
					)
					.at(0);
				if (!rankedColumnId) return rowModel;

				return {
					...rowModel,
					rows: sortRowsByRank(rowModel.rows, rankedColumnId),
					flatRows: sortRowsByRank(rowModel.flatRows, rankedColumnId),
				};
			};
		};
	}, []);
	const columnState = useProTableColumnState(tableColumns, tableOptions);
	useEffect(() => {
		const validIds = new Set(splitColumnIds(tableColumnIdsKey));
		setColumnVisibility((current) => {
			const next = Object.fromEntries(
				Object.entries(current).filter(([id]) => validIds.has(id)),
			);
			return Object.keys(next).length === Object.keys(current).length
				? current
				: next;
		});
	}, [tableColumnIdsKey]);
	const resetToFirstPage = useCallback(() => {
		setPagination((current) => ({ ...current, pageIndex: 0 }));
	}, [setPagination]);
	const handleSortingChange = useCallback<OnChangeFn<SortingState>>(
		(updater) => {
			setSorting(updater);
			resetToFirstPage();
		},
		[resetToFirstPage, setSorting],
	);
	const handleColumnFiltersChange = useCallback<OnChangeFn<ColumnFiltersState>>(
		(updater) => {
			setColumnFilters(updater);
			resetToFirstPage();
		},
		[resetToFirstPage, setColumnFilters],
	);
	const reactTableOptions: TableOptions<TData> = {
		data,
		columns: tableColumns,
		// URL-backed tables receive new data-array identities when navigation updates
		// the search string. Pagination is reset explicitly for sorting and filters,
		// so TanStack must not silently send a page change back to page one.
		autoResetPageIndex: false,
		state: {
			sorting,
			columnVisibility,
			rowSelection,
			columnFilters,
			columnOrder: columnState.columnOrder,
			columnPinning: columnState.columnPinning,
			pagination,
		},
		enableRowSelection: true,
		enableColumnPinning: columnState.pinningEnabled,
		onRowSelectionChange: handleRowSelectionChange,
		onSortingChange: handleSortingChange,
		onColumnFiltersChange: handleColumnFiltersChange,
		onColumnVisibilityChange: setColumnVisibility,
		onColumnOrderChange: columnState.setColumnOrder,
		onColumnPinningChange: columnState.handleColumnPinningChange,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel:
			paginationOptions === false ? undefined : getPaginationRowModel(),
		getSortedRowModel: rankedSortedRowModel,
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
	};
	if (manual) {
		reactTableOptions.manualPagination = true;
		reactTableOptions.manualSorting = true;
		reactTableOptions.manualFiltering = true;
		reactTableOptions.rowCount = requestTotal;
	}
	if (dragSort && dragSort.rowKey !== undefined) {
		const rowKey = dragSort.rowKey;
		reactTableOptions.getRowId = (row) => String(row[rowKey]);
	} else if (tableOptions?.rowKey) {
		const rowKey = tableOptions.rowKey;
		reactTableOptions.getRowId = (row) =>
			String((row as Record<string, unknown>)[rowKey]);
	}
	const table = useReactTable(reactTableOptions);
	const pageCount = table.getPageCount();

	useEffect(() => {
		if (
			paginationOptions === false ||
			loading ||
			pageCount <= 0 ||
			pagination.pageIndex < pageCount
		)
			return;
		setPagination((current) => ({ ...current, pageIndex: pageCount - 1 }));
	}, [
		loading,
		pageCount,
		pagination.pageIndex,
		paginationOptions,
		setPagination,
	]);

	const dragSortEnabled = !!dragSort;
	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);
	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			const { active, over } = event;
			if (!over || active.id === over.id) return;

			const rows = table.getRowModel().rows;
			const oldIndex = rows.findIndex((row) => row.id === String(active.id));
			const newIndex = rows.findIndex((row) => row.id === String(over.id));
			if (oldIndex === -1 || newIndex === -1) return;

			const oldRow = rows[oldIndex];
			const newRow = rows[newIndex];
			if (!(oldRow && newRow)) return;
			const oldDataIndex = data.indexOf(oldRow.original);
			const newDataIndex = data.indexOf(newRow.original);
			if (oldDataIndex === -1 || newDataIndex === -1) return;

			const nextData = arrayMove(data, oldDataIndex, newDataIndex);
			if (nextData === data) return;

			setData(nextData);
			if (dragSort) dragSort.onDragSortEnd?.(nextData);
		},
		[data, dragSort, setData, table],
	);
	const pinnedOffsets = useProTablePinnedColumnOffsets(
		table,
		tableRef,
		dragSortEnabled,
	);
	const rows = table.getRowModel().rows;
	const selectedRows = table.getFilteredSelectedRowModel().rows;
	const visibleColumns = table.getVisibleLeafColumns();
	const visibleColumnCount = visibleColumns.length + (dragSortEnabled ? 1 : 0);
	const renderContext: ProTableRenderContext<TData> = {
		table,
		rows,
		selectedRows,
		tableSize,
		size,
	};

	return {
		table,
		tableRef,
		tableSize,
		setTableSize,
		rows,
		selectedRows,
		visibleColumns,
		visibleColumnCount,
		renderContext,
		pinnedOffsets,
		sensors,
		handleDragEnd,
		dragSortEnabled,
		defaultColumnOrder: columnState.defaultColumnOrder,
		defaultColumnPinning: columnState.defaultColumnPinning,
	};
}

function useProTableColumnState<TData, TValue>(
	columns: ColumnDef<TData, TValue>[],
	tableOptions: ProTableTableOptions | undefined,
) {
	const pinningConfig =
		typeof tableOptions?.pinning === "object"
			? tableOptions.pinning
			: undefined;
	const pinningEnabled = tableOptions?.pinning !== false;
	const defaultColumnOrderKey = getLeafColumnIds(columns).join("\0");
	const defaultColumnOrder = splitColumnIds(defaultColumnOrderKey);
	const defaultColumnPinning = pinningEnabled
		? {
				left: getPinnedColumnIds(columns, "left"),
				right: getPinnedColumnIds(columns, "right"),
			}
		: {};
	const defaultColumnPinningKey = serializeColumnPinning(defaultColumnPinning);
	const [columnOrder, setColumnOrder] = useState<string[]>(defaultColumnOrder);
	const [internalColumnPinning, setInternalColumnPinning] =
		useState<ColumnPinningState>(defaultColumnPinning);
	const controlledPinning = pinningConfig?.value !== undefined;
	const columnPinning = pinningConfig?.value ?? internalColumnPinning;
	const previousColumnIds = useRef(new Set(defaultColumnOrder));
	const previousDefaultPinning = useRef(
		columnPinningById(defaultColumnPinning),
	);

	useEffect(() => {
		const nextDefaultColumnOrder = splitColumnIds(defaultColumnOrderKey);
		setColumnOrder((current) => {
			const remainingIds = new Set(nextDefaultColumnOrder);
			const next = [
				...current.filter((id) => remainingIds.delete(id)),
				...remainingIds,
			];
			return arraysEqual(current, next) ? current : next;
		});
	}, [defaultColumnOrderKey]);
	useEffect(() => {
		const nextDefaultColumnOrder = splitColumnIds(defaultColumnOrderKey);
		const validIds = new Set(nextDefaultColumnOrder);
		const nextDefaults = columnPinningById(
			deserializeColumnPinning(defaultColumnPinningKey),
		);
		const oldIds = previousColumnIds.current;
		const oldDefaults = previousDefaultPinning.current;

		setInternalColumnPinning((current) => {
			const nextById = columnPinningById(current);
			for (const id of Object.keys(nextById)) {
				if (!validIds.has(id)) delete nextById[id];
			}
			for (const id of nextDefaultColumnOrder) {
				if (!oldIds.has(id) || oldDefaults[id] !== nextDefaults[id]) {
					const side = nextDefaults[id];
					if (side) nextById[id] = side;
					else delete nextById[id];
				}
			}
			const next = columnPinningFromIds(nextDefaultColumnOrder, nextById);
			return serializeColumnPinning(current) === serializeColumnPinning(next)
				? current
				: next;
		});

		previousColumnIds.current = validIds;
		previousDefaultPinning.current = nextDefaults;
	}, [defaultColumnOrderKey, defaultColumnPinningKey]);

	const handleColumnPinningChange = useCallback<OnChangeFn<ColumnPinningState>>(
		(updater) => {
			if (controlledPinning) {
				const next =
					typeof updater === "function" ? updater(columnPinning) : updater;
				pinningConfig?.onChange?.(next);
				return;
			}
			setInternalColumnPinning((current) => {
				const next = typeof updater === "function" ? updater(current) : updater;
				pinningConfig?.onChange?.(next);
				return next;
			});
		},
		[columnPinning, controlledPinning, pinningConfig],
	);

	return {
		columnOrder,
		setColumnOrder,
		columnPinning,
		handleColumnPinningChange,
		defaultColumnOrder,
		defaultColumnPinning,
		pinningEnabled,
	};
}

function arraysEqual(left: string[], right: string[]) {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}

function serializeColumnPinning(value: ColumnPinningState) {
	return `${(value.left ?? []).join("\0")}\u0001${(value.right ?? []).join("\0")}`;
}

function deserializeColumnPinning(value: string): ColumnPinningState {
	const [left = "", right = ""] = value.split("\u0001");
	return { left: splitColumnIds(left), right: splitColumnIds(right) };
}

function splitColumnIds(value: string) {
	return value ? value.split("\0") : [];
}

function columnPinningById(value: ColumnPinningState) {
	const result: Record<string, "left" | "right"> = {};
	for (const id of value.left ?? []) result[id] = "left";
	for (const id of value.right ?? []) result[id] = "right";
	return result;
}

function columnPinningFromIds(
	columnOrder: string[],
	value: Record<string, "left" | "right">,
): ColumnPinningState {
	return {
		left: columnOrder.filter((id) => value[id] === "left"),
		right: columnOrder.filter((id) => value[id] === "right"),
	};
}

function renderToolbarSlot<TData>(
	toolbar: false | ProTableToolbarSlot<TData> | undefined,
	context: ProTableRenderContext<TData>,
) {
	if (toolbar === false) return undefined;
	if (typeof toolbar === "function") return toolbar(context);
	return toolbar;
}

function renderSortIcon(sorted: false | "asc" | "desc") {
	if (sorted === "asc") return <ArrowUp size={14} />;
	if (sorted === "desc") return <ArrowDown size={14} />;
	return <ArrowUpDown size={14} className="opacity-40" />;
}

function useProTablePinnedColumnOffsets<TData>(
	table: Table<TData>,
	tableRef: RefObject<HTMLTableElement | null>,
	dragSort: boolean,
): ProTablePinnedColumnOffsets {
	const [offsets, setOffsets] = useState<ProTablePinnedColumnOffsets>({
		left: {},
		right: {},
	});
	const visibleColumnKey = table
		.getVisibleLeafColumns()
		.map((column) => column.id)
		.join("\0");
	const leftPinnedKey = (table.getState().columnPinning.left ?? []).join("\0");
	const rightPinnedKey = (table.getState().columnPinning.right ?? []).join(
		"\0",
	);

	useLayoutEffect(() => {
		// These serialized keys intentionally retrigger measurement when pinning or visibility changes.
		void leftPinnedKey;
		void rightPinnedKey;
		void visibleColumnKey;
		const tableElement = tableRef.current;
		if (!tableElement) return;

		const updateOffsets = () => {
			const widths = new Map<string, number>();

			for (const element of tableElement.querySelectorAll<HTMLElement>(
				"[data-pro-table-column-id]",
			)) {
				const columnId = element.dataset.proTableColumnId;
				if (!columnId || widths.has(columnId)) continue;
				widths.set(columnId, element.getBoundingClientRect().width);
			}

			const next: ProTablePinnedColumnOffsets = { left: {}, right: {} };
			let left = dragSort ? 32 : 0;

			for (const column of table.getLeftVisibleLeafColumns()) {
				next.left[column.id] = left;
				left += widths.get(column.id) ?? column.getSize();
			}

			let right = 0;
			const rightColumns = table.getRightVisibleLeafColumns();
			for (let index = rightColumns.length - 1; index >= 0; index -= 1) {
				const column = rightColumns[index];
				if (!column) continue;
				next.right[column.id] = right;
				right += widths.get(column.id) ?? column.getSize();
			}

			setOffsets((current) =>
				arePinnedColumnOffsetsEqual(current, next) ? current : next,
			);
		};

		updateOffsets();
		if (typeof ResizeObserver === "undefined") return undefined;

		const observer = new ResizeObserver(updateOffsets);
		observer.observe(tableElement);
		for (const element of tableElement.querySelectorAll<HTMLElement>(
			"[data-pro-table-column-id]",
		)) {
			observer.observe(element);
		}

		return () => observer.disconnect();
	}, [
		dragSort,
		leftPinnedKey,
		rightPinnedKey,
		table,
		tableRef,
		visibleColumnKey,
	]);

	return offsets;
}

function arePinnedColumnOffsetsEqual(
	current: ProTablePinnedColumnOffsets,
	next: ProTablePinnedColumnOffsets,
) {
	for (const side of ["left", "right"] as const) {
		let currentCount = 0;
		let nextCount = 0;

		for (const [columnId, offset] of Object.entries(current[side])) {
			currentCount += 1;
			if (next[side][columnId] !== offset) return false;
		}

		for (const [columnId, offset] of Object.entries(next[side])) {
			nextCount += 1;
			if (current[side][columnId] !== offset) return false;
		}

		if (currentCount !== nextCount) return false;
	}

	return true;
}

export function ProTable<TData, TValue>({
	columns,
	data,
	request,
	requestKey,
	initialState,
	onChange,
	header,
	toolbar,
	toolbarFilters,
	toolbarSearch,
	size,
	toolbarDensity,
	toolbarColumns,
	onRefresh,
	bulkToolbar,
	pagination,
	dragSort,
	loading,
	layout,
	table,
	className,
}: {
	columns: ColumnDef<TData, TValue>[];
	data?: TData[];
	request?: (
		params: ProTableState,
		requestKey?: unknown,
	) =>
		| Promise<{ data: TData[]; total?: number }>
		| { data: TData[]; total?: number };
	requestKey?: unknown;
	initialState?: Partial<ProTableState>;
	onChange?: (state: ProTableState) => void;
	header?: ReactNode | ((context: ProTableRenderContext<TData>) => ReactNode);
	toolbar?: false | ProTableToolbarSlot<TData>;
	toolbarFilters?: ProTableToolbarSlot<TData>;
	toolbarSearch?: ProTableSearch;
	size?: ProButtonSize;
	toolbarDensity?: boolean;
	toolbarColumns?: boolean;
	onRefresh?: () => void;
	bulkToolbar?: false | ProTableToolbarSlot<TData>;
	pagination?: false;
	dragSort?: false | ProTableDragSortOptions<TData>;
	loading?:
		| boolean
		| {
				rows?: number;
		  };
	layout?: "full" | "auto";
	table?: ProTableTableOptions;
	className?: string;
}) {
	const toolbarButtonSize = size ?? "icon";
	const [tableData, setTableData] = useState<TData[]>(data ?? []);
	const [requestLoading, setRequestLoading] = useState(false);
	const [requestError, setRequestError] = useState<unknown>();
	const [requestTotal, setRequestTotal] = useState<number>();
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
		initialState?.columnFilters ?? [],
	);
	const [sorting, setSorting] = useState<SortingState>(
		initialState?.sorting ?? [],
	);
	const [paginationState, setPagination] = useState<PaginationState>(
		initialState?.pagination ?? {
			pageIndex: 0,
			pageSize: 10,
		},
	);
	const state = useMemo<ProTableState>(
		() => ({ pagination: paginationState, sorting, columnFilters }),
		[paginationState, sorting, columnFilters],
	);
	const mountedRef = useRef(false);
	const onChangeRef = useRef(onChange);

	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	useEffect(() => {
		const next = initialState?.pagination;
		if (!next) return;
		setPagination((current) =>
			current.pageIndex === next.pageIndex && current.pageSize === next.pageSize
				? current
				: next,
		);
	}, [initialState?.pagination]);

	useEffect(() => {
		const next = initialState?.sorting;
		if (!next) return;
		setSorting((current) =>
			JSON.stringify(current) === JSON.stringify(next) ? current : next,
		);
	}, [initialState?.sorting]);

	useEffect(() => {
		const next = initialState?.columnFilters;
		if (!next) return;
		setColumnFilters((current) =>
			JSON.stringify(current) === JSON.stringify(next) ? current : next,
		);
	}, [initialState?.columnFilters]);

	useEffect(() => {
		if (request) return;
		setTableData(data ?? []);
	}, [data, request]);

	useEffect(() => {
		if (!mountedRef.current) {
			mountedRef.current = true;
			return;
		}
		onChangeRef.current?.(state);
	}, [state]);

	useEffect(() => {
		if (!request) return;

		let canceled = false;
		setRequestLoading(true);
		setRequestError(undefined);

		Promise.resolve(request(state, requestKey))
			.then((result) => {
				if (canceled) return;
				setTableData(result.data);
				setRequestTotal(result.total);
			})
			.catch((error) => {
				if (canceled) return;
				setRequestError(error);
				setTableData([]);
				setRequestTotal(undefined);
			})
			.finally(() => {
				if (!canceled) setRequestLoading(false);
			});

		return () => {
			canceled = true;
		};
	}, [request, requestKey, state]);

	const loadingRows = typeof loading === "object" ? (loading.rows ?? 5) : 5;
	const loadingEnabled =
		(loading !== undefined && loading !== false) || requestLoading;
	const proTable = useProTable({
		columns,
		data: tableData,
		setData: setTableData,
		toolbarSearch,
		size: toolbarButtonSize,
		paginationOptions: pagination,
		dragSort,
		tableOptions: table,
		manual: !!request,
		requestTotal,
		loading: loadingEnabled,
		pagination: paginationState,
		setPagination,
		sorting,
		setSorting,
		columnFilters,
		setColumnFilters,
	});
	const isFullLayout = (layout ?? "full") === "full";
	const headerContent =
		typeof header === "function" ? header(proTable.renderContext) : header;
	const toolbarActions = renderToolbarSlot(toolbar, proTable.renderContext);
	const toolbarFilterControls = renderToolbarSlot(
		toolbarFilters,
		proTable.renderContext,
	);
	const bulkActions = renderToolbarSlot(bulkToolbar, proTable.renderContext);
	const tableState = proTable.table.getState();
	const stickyHeader = table?.stickyHeader ?? true;
	const paddingClass = getTablePaddingClass(proTable.tableSize);
	const content = (
		<>
			<div
				className={cn(
					"w-full max-w-full overflow-auto rounded-md border",
					"[scrollbar-gutter:auto] [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:rgba(148,163,184,0.45)_transparent] [&::-webkit-scrollbar]:size-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-track]:shadow-none [&::-webkit-scrollbar-corner]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-0 [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/35",
				)}
			>
				<table
					ref={proTable.tableRef}
					data-slot="pro-table"
					className="w-full min-w-max caption-bottom text-sm"
				>
					<thead data-slot="pro-table-header" className="[&_tr]:border-b">
						{proTable.table.getHeaderGroups().map((headerGroup) => (
							<tr
								key={headerGroup.id}
								data-slot="pro-table-row"
								className={
									"border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted"
								}
							>
								{proTable.dragSortEnabled && (
									<th
										data-slot="pro-table-head-cell"
										className={cn(
											"h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
											"sticky left-0 z-20 w-8 bg-background pr-0 shadow-[6px_0_10px_-10px_hsl(var(--foreground)/0.45),1px_0_0_0_var(--border)] transition-colors duration-150 hover:bg-muted",
											stickyHeader && "top-0 z-30",
										)}
									/>
								)}
								{headerGroup.headers.map((header) => {
									const canSort =
										!proTable.dragSortEnabled && header.column.getCanSort();
									const sorted = header.column.getIsSorted();
									const sortHandler = canSort
										? header.column.getToggleSortingHandler()
										: undefined;
									const pinned = header.column.getIsPinned();
									const align =
										header.column.columnDef.meta?.align ??
										(pinned === "right" ? "right" : pinned || undefined);
									const ariaSort = getAriaSort(canSort, sorted);
									const headerContent = header.isPlaceholder ? null : (
										<div className="flex items-center gap-1.5">
											{flexRender(
												header.column.columnDef.header,
												header.getContext(),
											)}
											{canSort && (
												<span
													className="text-muted-foreground"
													aria-hidden="true"
												>
													{renderSortIcon(sorted)}
												</span>
											)}
										</div>
									);

									return (
										<th
											key={header.id}
											data-slot="pro-table-head-cell"
											colSpan={header.colSpan}
											className={cn(
												"h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
												stickyHeader && "sticky top-0 z-10 bg-background",
												"transition-colors duration-150 hover:bg-muted",
												getPinnedColumnClassName(
													header.column,
													header.column.getIsPinned() && stickyHeader
														? "z-30"
														: undefined,
												),
												align === "center" &&
													"text-center [&>div]:justify-center",
												align === "right" && "text-right [&>div]:justify-end",
												align === "left" && "text-left [&>div]:justify-start",
												header.column.columnDef.meta?.className,
												canSort && "cursor-pointer select-none",
											)}
											style={getPinnedColumnStyle(
												header.column,
												proTable.pinnedOffsets,
												proTable.dragSortEnabled ? 32 : 0,
											)}
											data-pro-table-column-id={header.column.id}
											aria-sort={ariaSort}
											tabIndex={canSort ? 0 : undefined}
											onClick={sortHandler}
											onKeyDown={
												canSort
													? (event) => {
															if (event.key !== "Enter" && event.key !== " ")
																return;
															event.preventDefault();
															sortHandler?.(event);
														}
													: undefined
											}
										>
											{headerContent}
										</th>
									);
								})}
							</tr>
						))}
					</thead>
					<tbody
						data-slot="pro-table-body"
						className="[&_tr:last-child]:border-0"
					>
						<ProTableBody
							rows={proTable.rows}
							visibleColumns={proTable.visibleColumns}
							visibleColumnCount={proTable.visibleColumnCount}
							dragSort={proTable.dragSortEnabled}
							loading={loadingEnabled}
							loadingRows={loadingRows}
							paddingClass={paddingClass}
							emptyFallbackText={
								requestError ? m.pro_table_loadFailed() : undefined
							}
							pinnedOffsets={proTable.pinnedOffsets}
						/>
					</tbody>
				</table>
			</div>
			{isFullLayout && <div className="min-h-0 flex-1" aria-hidden="true" />}
			{pagination !== false && (
				<div className={isFullLayout ? "shrink-0" : undefined}>
					<ProPagination
						current={tableState.pagination.pageIndex + 1}
						pageCount={proTable.table.getPageCount()}
						pageSize={tableState.pagination.pageSize}
						total={proTable.table.getRowCount()}
						onPageChange={(page) => proTable.table.setPageIndex(page - 1)}
						onPageSizeChange={(pageSize) => {
							proTable.table.setPageSize(pageSize);
							proTable.table.setPageIndex(0);
						}}
					/>
				</div>
			)}
		</>
	);
	return (
		<div
			className={cn(
				"max-w-full",
				isFullLayout ? "flex h-full min-h-0 flex-col gap-3" : "space-y-3",
				className,
			)}
		>
			{headerContent != null && <div className="shrink-0">{headerContent}</div>}
			{toolbar !== false && (
				<ProTableToolbar
					table={proTable.table}
					disabled={loadingEnabled}
					search={toolbarSearch}
					filters={toolbarFilterControls}
					actions={toolbarActions}
					size={size}
					columnSettings={
						(toolbarColumns ?? true) ? (
							<ProTableColumnSettings
								table={proTable.table}
								defaultColumnOrder={proTable.defaultColumnOrder}
								defaultColumnPinning={proTable.defaultColumnPinning}
							/>
						) : undefined
					}
					density={toolbarDensity ?? true}
					refresh={onRefresh}
					tableSize={proTable.tableSize}
					onTableSizeChange={proTable.setTableSize}
				/>
			)}
			{proTable.dragSortEnabled && !loadingEnabled ? (
				<DndContext
					sensors={proTable.sensors}
					collisionDetection={closestCenter}
					onDragEnd={proTable.handleDragEnd}
				>
					{content}
				</DndContext>
			) : (
				content
			)}
			{bulkActions != null && (
				<ProTableBulkActions table={proTable.table}>
					<div className="flex flex-wrap items-center justify-end gap-2">
						{bulkActions}
					</div>
				</ProTableBulkActions>
			)}
		</div>
	);
}
