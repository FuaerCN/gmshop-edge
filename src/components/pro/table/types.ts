import type { RankingInfo } from "@tanstack/match-sorter-utils";
import type {
	ColumnDef,
	ColumnFiltersState,
	ColumnPinningState,
	OnChangeFn,
	PaginationState,
	Row,
	RowSelectionState,
	SortingState,
	Table,
} from "@tanstack/react-table";
import type { ReactNode } from "react";
import type { ProButtonSize } from "../base/button";

export interface ProTableState {
	pagination: PaginationState;
	sorting: SortingState;
	columnFilters: ColumnFiltersState;
}

export type TableSize = "default" | "middle" | "compact";

export type ProTableSearch =
	| false
	| string
	| {
			columnId: string;
			placeholder?: string;
	  };

export interface ProTableDragSortOptions<TData> {
	rowKey?: Extract<keyof TData, string | number>;
	onDragSortEnd?: (newData: TData[]) => void;
}

export interface ProTableTableOptions {
	stickyHeader?: boolean;
	rowKey?: string;
	rowSelection?: {
		value: RowSelectionState;
		onChange: OnChangeFn<RowSelectionState>;
	};
	pinning?:
		| false
		| {
				value?: ColumnPinningState;
				onChange?: (value: ColumnPinningState) => void;
		  };
}

export interface ProTableRenderContext<TData> {
	table: Table<TData>;
	rows: Row<TData>[];
	selectedRows: Row<TData>[];
	tableSize: TableSize;
	size?: ProButtonSize;
}

export type ProTableToolbarSlot<TData> =
	| ReactNode
	| ((context: ProTableRenderContext<TData>) => ReactNode);

export interface ProTableProps<TData, TValue = unknown> {
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
	toolbarFilters?: false | ProTableToolbarSlot<TData>;
	toolbarSearch?: ProTableSearch;
	size?: ProButtonSize;
	toolbarDensity?: boolean;
	toolbarColumns?: boolean;
	onRefresh?: () => void;
	bulkToolbar?: false | ProTableToolbarSlot<TData>;
	pagination?: false;
	dragSort?: false | ProTableDragSortOptions<TData>;
	loading?: boolean | { rows?: number };
	layout?: "full" | "auto";
	table?: ProTableTableOptions;
	className?: string;
}

export type ColumnFilterConfig =
	| {
			columnId: string;
			searchKey: string;
			type?: "string";
			serialize?: (value: unknown) => unknown;
			deserialize?: (value: unknown) => unknown;
	  }
	| {
			columnId: string;
			searchKey: string;
			type: "array";
			serialize?: (value: unknown) => unknown;
			deserialize?: (value: unknown) => unknown;
	  };

export interface ColumnFilterMeta<TData> {
	options: Array<{
		label: string;
		value: string;
	}>;
	placeholder?: string;
	multiple?: boolean;
	searchable?: boolean;
	onFilter?: (value: string, record: TData) => boolean;
}

export interface ProTablePinnedColumnOffsets {
	left: Record<string, number>;
	right: Record<string, number>;
}

declare module "@tanstack/react-table" {
	interface ColumnMeta<TData, TValue> {
		pinned?: "left" | "right";
		align?: "left" | "center" | "right";
		className?: string;
		search?:
			| boolean
			| {
					placeholder?: string;
			  };
		filter?: ColumnFilterMeta<TData>;
	}
	interface FilterMeta {
		itemRank?: RankingInfo;
	}
}
