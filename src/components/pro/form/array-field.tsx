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
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "#/lib/utils";
import { ProButton } from "../base/button";

export interface ProArrayFieldContext {
	index: number;
	remove: () => void;
}

interface ProArrayFieldProps<T> {
	value: readonly T[];
	onChange: (value: T[]) => void;
	create: () => T;
	getKey: (item: T, index: number) => string;
	itemLabel: (item: T, index: number) => ReactNode;
	itemExtra?: (item: T, index: number) => ReactNode;
	canRemoveItem?: (item: T, index: number) => boolean;
	children: (item: T, context: ProArrayFieldContext) => ReactNode;
	addLabel: ReactNode;
	removeLabel: string;
	reorderLabel: string;
	min?: number;
	max?: number;
	className?: string;
}

export function ProArrayField<T>({
	value,
	onChange,
	create,
	getKey,
	itemLabel,
	itemExtra,
	canRemoveItem,
	children,
	addLabel,
	removeLabel,
	reorderLabel,
	min = 0,
	max,
	className,
}: ProArrayFieldProps<T>) {
	const canAdd = max == null || value.length < max;
	const canRemove = value.length > min;
	const itemIds = value.map(getKey);
	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);
	function reorder(event: DragEndEvent) {
		if (!event.over || event.active.id === event.over.id) return;
		const from = itemIds.indexOf(String(event.active.id));
		const to = itemIds.indexOf(String(event.over.id));
		if (from < 0 || to < 0) return;
		onChange(arrayMove([...value], from, to));
	}

	return (
		<div className={cn("grid gap-6", className)} data-slot="pro-array-field">
			<DndContext
				collisionDetection={closestCenter}
				onDragEnd={reorder}
				sensors={sensors}
			>
				<SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
					{value.map((item, index) => (
						<SortableArrayItem
							canRemove={canRemove && (canRemoveItem?.(item, index) ?? true)}
							id={getKey(item, index)}
							itemExtra={itemExtra?.(item, index)}
							itemLabel={itemLabel(item, index)}
							key={getKey(item, index)}
							onRemove={() =>
								onChange(value.filter((_, itemIndex) => itemIndex !== index))
							}
							removeLabel={removeLabel}
							reorderLabel={reorderLabel}
						>
							{children(item, {
								index,
								remove: () =>
									onChange(value.filter((_, itemIndex) => itemIndex !== index)),
							})}
						</SortableArrayItem>
					))}
				</SortableContext>
			</DndContext>
			<ProButton
				className="justify-self-start"
				disabled={!canAdd}
				onClick={() => onChange([...value, create()])}
				type="button"
				variant="outline"
			>
				<Plus />
				{addLabel}
			</ProButton>
		</div>
	);
}

function SortableArrayItem({
	id,
	itemLabel,
	itemExtra,
	canRemove,
	onRemove,
	removeLabel,
	reorderLabel,
	children,
}: {
	id: string;
	itemLabel: ReactNode;
	itemExtra?: ReactNode;
	canRemove: boolean;
	onRemove: () => void;
	removeLabel: string;
	reorderLabel: string;
	children: ReactNode;
}) {
	const {
		attributes,
		isDragging,
		listeners,
		setNodeRef,
		transform,
		transition,
	} = useSortable({ id });
	return (
		<div
			className={cn(
				"grid min-w-0 gap-4 rounded-lg border bg-background p-4",
				isDragging && "z-10 opacity-70 shadow-lg",
			)}
			data-slot="pro-array-field-item"
			ref={setNodeRef}
			style={{
				transform: CSS.Transform.toString(transform),
				transition,
			}}
		>
			<div className="flex flex-wrap items-center gap-2">
				<button
					aria-label={reorderLabel}
					className="inline-flex size-8 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
					type="button"
					{...attributes}
					{...listeners}
				>
					<GripVertical className="size-4" />
				</button>
				<div className="min-w-0 flex-1 truncate font-medium">{itemLabel}</div>
				{itemExtra != null ? (
					<div className="flex flex-wrap items-center gap-2">{itemExtra}</div>
				) : null}
				{canRemove ? (
					<ProButton
						onClick={onRemove}
						className="text-destructive-foreground hover:bg-destructive/10 hover:text-destructive-foreground"
						size="icon-sm"
						tooltip={removeLabel}
						type="button"
						variant="ghost"
					>
						<Trash2 />
					</ProButton>
				) : null}
			</div>
			{children}
		</div>
	);
}
