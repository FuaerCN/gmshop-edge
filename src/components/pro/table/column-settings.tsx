import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Column, ColumnPinningState, Table } from "@tanstack/react-table";
import { GripVertical, Pin, PinOff, RotateCcw } from "lucide-react";
import { useId } from "react";
import { m } from "#/paraglide/messages";
import { ProButton } from "../base/button";
import { CheckboxControl } from "../base/fields/checkbox";
import { getSystemColumnPinning } from "./state-utils";

export function ProTableColumnSettings<TData>({
	table,
	defaultColumnOrder,
	defaultColumnPinning,
}: {
	table: Table<TData>;
	defaultColumnOrder: string[];
	defaultColumnPinning: ColumnPinningState;
}) {
	const columns = table.getAllLeafColumns();
	const tableState = table.getState();
	const columnOrder = tableState.columnOrder.length
		? tableState.columnOrder
		: defaultColumnOrder;
	const columnLookup = new Map(
		columns.map((column) => [column.id, column] as const),
	);
	const orderedIds = new Set<string>();
	const orderedColumns = [
		...columnOrder.flatMap((columnId) => {
			const column = columnLookup.get(columnId);
			if (!column || orderedIds.has(column.id)) return [];
			orderedIds.add(column.id);
			return [column];
		}),
		...columns.filter((column) => {
			if (orderedIds.has(column.id)) return false;
			orderedIds.add(column.id);
			return true;
		}),
	];
	const hideableColumns = orderedColumns.filter(
		(column) =>
			column.getCanHide() && getSystemColumnPinning(column.id) === undefined,
	);
	const canPinColumns = table.options.enableColumnPinning !== false;
	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	return (
		<>
			<div className="flex items-center justify-between px-2 py-1.5">
				<span className="text-xs font-medium text-muted-foreground">
					{m.pro_action_columns()}
				</span>
				<ProButton
					variant="ghost"
					size="xs"
					onClick={() => {
						table.resetColumnVisibility();
						table.setColumnOrder(defaultColumnOrder);
						if (canPinColumns) table.setColumnPinning(defaultColumnPinning);
					}}
				>
					<RotateCcw className="mr-1" />
					{m.pro_action_reset()}
				</ProButton>
			</div>
			<div aria-hidden="true" className="h-px w-full shrink-0 bg-border" />
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={({ active, over }) => {
					if (!over || active.id === over.id) return;

					const oldIndex = columnOrder.indexOf(String(active.id));
					const newIndex = columnOrder.indexOf(String(over.id));
					if (oldIndex === -1 || newIndex === -1) return;
					table.setColumnOrder(arrayMove(columnOrder, oldIndex, newIndex));
				}}
			>
				<SortableContext
					items={hideableColumns.map((column) => column.id)}
					strategy={verticalListSortingStrategy}
				>
					<div className="py-1">
						{hideableColumns.map((column) => (
							<SortableColumnItem
								key={column.id}
								column={column}
								canPin={canPinColumns}
							/>
						))}
					</div>
				</SortableContext>
			</DndContext>
		</>
	);
}

function SortableColumnItem<TData>({
	column,
	canPin,
}: {
	column: Column<TData, unknown>;
	canPin: boolean;
}) {
	const checkboxId = useId();
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: column.id,
	});
	const pinned = column.getIsPinned();
	const canPinColumn = canPin && column.getCanPin();
	const leftPinned = pinned === "left";
	const rightPinned = pinned === "right";

	return (
		<div
			ref={setNodeRef}
			style={{
				transform: CSS.Transform.toString(transform),
				transition,
				opacity: isDragging ? 0.5 : 1,
			}}
			className="flex items-center gap-1 px-2 py-1.5 text-sm"
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
			{canPinColumn && (
				<ProButton
					variant={leftPinned ? "secondary" : "ghost"}
					size="icon-xs"
					className="shrink-0"
					aria-pressed={leftPinned}
					aria-label={
						leftPinned ? m.pro_action_unpinLeft() : m.pro_action_pinLeft()
					}
					title={leftPinned ? m.pro_action_unpinLeft() : m.pro_action_pinLeft()}
					onPointerDown={(event) => event.stopPropagation()}
					onClick={(event) => {
						event.stopPropagation();
						column.pin(leftPinned ? false : "left");
					}}
				>
					{leftPinned ? <PinOff /> : <Pin />}
				</ProButton>
			)}
			<label
				htmlFor={checkboxId}
				className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 select-none"
			>
				<CheckboxControl
					id={checkboxId}
					checked={column.getIsVisible()}
					disabled={!column.getCanHide()}
					onCheckedChange={(checked) =>
						column.toggleVisibility(checked === true)
					}
					onClick={(event) => event.stopPropagation()}
				/>
				<span className="truncate">
					{typeof column.columnDef.header === "string"
						? column.columnDef.header
						: column.id}
				</span>
			</label>
			{canPinColumn && (
				<ProButton
					variant={rightPinned ? "secondary" : "ghost"}
					size="icon-xs"
					className="shrink-0"
					aria-pressed={rightPinned}
					aria-label={
						rightPinned ? m.pro_action_unpinRight() : m.pro_action_pinRight()
					}
					title={
						rightPinned ? m.pro_action_unpinRight() : m.pro_action_pinRight()
					}
					onPointerDown={(event) => event.stopPropagation()}
					onClick={(event) => {
						event.stopPropagation();
						column.pin(rightPinned ? false : "right");
					}}
				>
					{rightPinned ? <PinOff /> : <Pin />}
				</ProButton>
			)}
		</div>
	);
}
