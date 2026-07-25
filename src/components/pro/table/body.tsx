import {
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	type Cell,
	type Column,
	flexRender,
	type Row,
} from "@tanstack/react-table";
import { GripVertical, Inbox } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "#/lib/utils";
import { m } from "#/paraglide/messages";
import { ProButton } from "../base/button";
import type { ProTablePinnedColumnOffsets } from "./types";

const tableRowClassName =
	"group/row [&>td]:border-b [&>td]:border-border [&>td]:transition-[background-color,border-color] [&>td]:duration-150 hover:[&>td]:bg-muted/50 has-aria-expanded:[&>td]:bg-muted/50 data-[state=selected]:[&>td]:bg-muted";

function getAutoFilterValues(autoRender: boolean, cellValue: unknown) {
	if (!autoRender) return [];
	if (typeof cellValue === "string") return [cellValue];
	if (
		Array.isArray(cellValue) &&
		cellValue.every((item) => typeof item === "string")
	) {
		return cellValue;
	}
	return [];
}

export function ProTableBody<TData>({
	rows,
	visibleColumns,
	visibleColumnCount,
	dragSort,
	loading,
	loadingRows,
	paddingClass,
	emptyFallbackText,
	pinnedOffsets,
}: {
	rows: Row<TData>[];
	visibleColumns: ReturnType<Row<TData>["getVisibleCells"]>[number]["column"][];
	visibleColumnCount: number;
	dragSort: boolean;
	loading: boolean;
	loadingRows: number;
	paddingClass: string;
	emptyFallbackText?: ReactNode;
	pinnedOffsets: ProTablePinnedColumnOffsets;
}) {
	const emptyRow = (
		<tr data-slot="pro-table-row" className={tableRowClassName}>
			<td
				data-slot="pro-table-cell"
				colSpan={visibleColumnCount}
				className={
					"p-2 align-middle whitespace-nowrap h-32 text-center text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]"
				}
			>
				<div className="flex flex-col items-center gap-2">
					<Inbox className="size-8 opacity-40" />
					<span className="text-sm">
						{emptyFallbackText ?? m.pro_table_noData()}
					</span>
				</div>
			</td>
		</tr>
	);

	if (loading) {
		return Array.from({ length: loadingRows }, (_, index) => (
			<tr
				// biome-ignore lint/suspicious/noArrayIndexKey: loading skeleton rows are static placeholders.
				key={`skeleton-row-${index}`}
				data-slot="pro-table-row"
				className={tableRowClassName}
			>
				{dragSort && (
					<td
						data-slot="pro-table-cell"
						className={
							"p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] sticky left-0 z-20 w-8 bg-background pr-0 shadow-[6px_0_10px_-10px_hsl(var(--foreground)/0.45),1px_0_0_0_var(--border)]"
						}
					>
						<div
							data-slot="pro-table-skeleton"
							className="size-4 animate-pulse rounded-md bg-accent"
						/>
					</td>
				)}
				{visibleColumns.map((column) => (
					<td
						key={column.id}
						data-slot="pro-table-cell"
						className={getPinnedColumnClassName(
							column,
							cn(
								"p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
								column.columnDef.meta?.className,
							),
						)}
						style={getPinnedColumnStyle(
							column,
							pinnedOffsets,
							dragSort ? 32 : 0,
						)}
						data-pro-table-column-id={column.id}
					>
						<div
							data-slot="pro-table-skeleton"
							className="h-4 w-full animate-pulse rounded-md bg-accent"
						/>
					</td>
				))}
			</tr>
		));
	}

	if (dragSort) {
		return (
			<SortableContext
				items={rows.map((row) => row.id)}
				strategy={verticalListSortingStrategy}
			>
				{rows.map((row) => (
					<SortableRow key={row.id} row={row} paddingClass={paddingClass}>
						{row.getVisibleCells().map((cell) => (
							<BodyCell
								key={cell.id}
								cell={cell}
								dragSort
								paddingClass={paddingClass}
								pinnedOffsets={pinnedOffsets}
							/>
						))}
					</SortableRow>
				))}
				{rows.length === 0 && emptyRow}
			</SortableContext>
		);
	}

	if (rows.length === 0) return emptyRow;
	return rows.map((row) => (
		<tr
			key={row.id}
			data-slot="pro-table-row"
			data-state={row.getIsSelected() && "selected"}
			className={tableRowClassName}
		>
			{row.getVisibleCells().map((cell) => (
				<BodyCell
					key={cell.id}
					cell={cell}
					paddingClass={paddingClass}
					pinnedOffsets={pinnedOffsets}
				/>
			))}
		</tr>
	));
}

function BodyCell<TData>({
	cell,
	dragSort,
	paddingClass,
	pinnedOffsets,
}: {
	cell: Cell<TData, unknown>;
	dragSort?: boolean;
	paddingClass: string;
	pinnedOffsets: ProTablePinnedColumnOffsets;
}) {
	const meta = cell.column.columnDef.meta;
	const pinned = cell.column.getIsPinned();
	const align =
		meta?.align ?? (pinned === "right" ? "right" : pinned || undefined);
	const filter = meta?.filter;
	const autoRender = !!filter && cell.column.columnDef.cell === undefined;
	const cellValue = cell.getValue();
	const autoFilterValues = getAutoFilterValues(autoRender, cellValue);
	const autoFilterLabels = new Map(
		autoRender
			? filter.options.map((option) => [option.value, option.label] as const)
			: [],
	);
	const cellContent = renderTableCellContent({
		autoRender,
		autoFilterValues,
		autoFilterLabels,
		cell,
	});
	return (
		<td
			data-slot="pro-table-cell"
			className={getPinnedColumnClassName(
				cell.column,
				cn(
					"p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
					paddingClass,
					align === "center" && "text-center",
					align === "right" && "text-right",
					align === "left" && "text-left",
					meta?.className,
				),
			)}
			style={getPinnedColumnStyle(
				cell.column,
				pinnedOffsets,
				dragSort ? 32 : 0,
			)}
			data-pro-table-column-id={cell.column.id}
		>
			{cellContent}
		</td>
	);
}

function renderTableCellContent<TData>({
	autoRender,
	autoFilterValues,
	autoFilterLabels,
	cell,
}: {
	autoRender: boolean;
	autoFilterValues: string[];
	autoFilterLabels: Map<string, string>;
	cell: Cell<TData, unknown>;
}) {
	if (!autoRender)
		return flexRender(cell.column.columnDef.cell, cell.getContext());
	if (autoFilterValues.length === 0)
		return <span className="text-muted-foreground">-</span>;

	return (
		<div className="flex flex-wrap gap-1">
			{autoFilterValues.map((itemValue) => (
				<span
					key={itemValue}
					className={
						"inline-flex shrink-0 items-center justify-center rounded-sm bg-secondary px-2 py-0.5 text-xs font-normal text-secondary-foreground"
					}
				>
					{autoFilterLabels.get(itemValue) ?? itemValue}
				</span>
			))}
		</div>
	);
}

function SortableRow<TData>({
	row,
	children,
	paddingClass,
}: {
	row: Row<TData>;
	children: ReactNode;
	paddingClass: string;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: row.id,
	});

	return (
		<tr
			ref={setNodeRef}
			data-slot="pro-table-row"
			data-state={row.getIsSelected() && "selected"}
			className={tableRowClassName}
			style={{
				transform: CSS.Transform.toString(transform),
				transition,
				opacity: isDragging ? 0.5 : 1,
				position: isDragging ? "relative" : undefined,
				zIndex: isDragging ? 10 : undefined,
			}}
		>
			<td
				data-slot="pro-table-cell"
				className={cn(
					"p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
					paddingClass,
					"sticky left-0 z-20 w-8 bg-background pr-0 shadow-[6px_0_10px_-10px_hsl(var(--foreground)/0.45),1px_0_0_0_var(--border)]",
				)}
			>
				<ProButton
					variant="ghost"
					size="icon-xs"
					{...attributes}
					{...listeners}
					className="cursor-grab active:cursor-grabbing"
					aria-label={m.pro_action_dragToReorder()}
				>
					<GripVertical />
				</ProButton>
			</td>
			{children}
		</tr>
	);
}

export function getPinnedColumnClassName<TData>(
	column: Column<TData, unknown>,
	className?: string,
) {
	const pinned = column.getIsPinned();

	return cn(
		pinned && "sticky z-10 bg-background",
		pinned === "left" &&
			column.getIsLastColumn("left") &&
			"shadow-[6px_0_10px_-10px_hsl(var(--foreground)/0.45),1px_0_0_0_var(--border)]",
		pinned === "right" &&
			column.getIsFirstColumn("right") &&
			"shadow-[-6px_0_10px_-10px_hsl(var(--foreground)/0.45),-1px_0_0_0_var(--border)]",
		className,
	);
}

export function getPinnedColumnStyle<TData>(
	column: Column<TData, unknown>,
	offsets: ProTablePinnedColumnOffsets,
	leftOffset = 0,
): CSSProperties {
	const pinned = column.getIsPinned();
	const style: CSSProperties = {};

	if (pinned === "left") {
		style.left = `${offsets.left[column.id] ?? column.getStart("left") + leftOffset}px`;
	}

	if (pinned === "right") {
		style.right = `${offsets.right[column.id] ?? column.getAfter("right")}px`;
	}

	return style;
}
