"use client";

import {
	ChevronLeft,
	ChevronRight,
	Maximize2,
	Minimize2,
	RotateCcw,
	RotateCcwSquare,
	RotateCw,
	X,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import {
	type MouseEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "#/lib/utils";
import { m } from "#/paraglide/messages";
import { ProButton } from "../../base/button";
import { useFullscreen } from "../../base/hooks/use-fullscreen";

const DEFAULT_IMAGE_TRANSFORM = { scale: 1, rotate: 0, x: 0, y: 0 };
const IMAGE_SCALE_STEP = 0.25;

export function ImageViewer({
	images,
	open,
	onClose,
	index: controlledIndex,
	initialIndex = 0,
	onIndexChange,
	alt = m.pro_viewer_imageDefaultAlt(),
	container,
	className,
}: {
	images: string | string[];
	open: boolean;
	onClose: () => void;
	index?: number;
	initialIndex?: number;
	onIndexChange?: (index: number) => void;
	alt?: string;
	container?: Element | DocumentFragment | null;
	className?: string;
}) {
	const list = Array.isArray(images) ? images : [images];
	const [uncontrolledIndex, setUncontrolledIndex] = useState(initialIndex);
	const fullscreen = useFullscreen({ mode: "screen" });
	const index = Math.min(
		Math.max(controlledIndex ?? uncontrolledIndex, 0),
		list.length - 1,
	);
	const [transform, setTransform] = useState<typeof DEFAULT_IMAGE_TRANSFORM>(
		DEFAULT_IMAGE_TRANSFORM,
	);
	const [dragging, setDragging] = useState(false);
	const dragStart = useRef<{
		x: number;
		y: number;
		tx: number;
		ty: number;
	} | null>(null);
	const reset = useCallback(() => {
		setTransform(DEFAULT_IMAGE_TRANSFORM);
	}, []);

	function zoomBy(delta: number) {
		setTransform((current) => ({
			...current,
			scale: Math.min(5, Math.max(0.1, current.scale + delta)),
		}));
	}

	function rotateBy(delta: number) {
		setTransform((current) => ({ ...current, rotate: current.rotate + delta }));
	}

	const select = useCallback(
		(nextIndex: number) => {
			if (!list.length) return;
			const normalizedIndex = (nextIndex + list.length) % list.length;
			if (controlledIndex === undefined) setUncontrolledIndex(normalizedIndex);
			onIndexChange?.(normalizedIndex);
			reset();
		},
		[controlledIndex, list.length, onIndexChange, reset],
	);

	function handleMouseDown(event: MouseEvent) {
		setDragging(true);
		dragStart.current = {
			x: event.clientX,
			y: event.clientY,
			tx: transform.x,
			ty: transform.y,
		};
	}

	function handleMouseMove(event: MouseEvent) {
		if (!dragging || !dragStart.current) return;
		const start = dragStart.current;
		setTransform((current) => ({
			...current,
			x: start.tx + event.clientX - start.x,
			y: start.ty + event.clientY - start.y,
		}));
	}

	function stopDrag() {
		setDragging(false);
		dragStart.current = null;
	}

	useEffect(() => {
		if (!open) return;

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") onClose();
			if (event.key === "ArrowLeft") select(index - 1);
			if (event.key === "ArrowRight") select(index + 1);
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [open, onClose, index, select]);

	useEffect(() => {
		if (!open) return;
		if (controlledIndex === undefined) setUncontrolledIndex(initialIndex);
		reset();
	}, [open, initialIndex, controlledIndex, reset]);

	if (!open || list.length === 0) return null;

	const portalTarget = getPortalTarget(container);

	const hasMultipleImages = list.length > 1;

	const content = (
		<div
			ref={fullscreen.ref}
			role="dialog"
			aria-modal="true"
			aria-label={m.pro_viewer_imageLabel()}
			className={cn(
				"fixed inset-0 z-50 flex flex-col bg-background/95 text-foreground",
				className,
			)}
			onWheel={(event) => {
				event.preventDefault();
				zoomBy(event.deltaY > 0 ? -IMAGE_SCALE_STEP : IMAGE_SCALE_STEP);
			}}
		>
			<div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 py-3 text-foreground">
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					<ProButton
						size="icon"
						variant="ghost"
						tooltip={m.pro_viewer_imageZoomOut()}
						onClick={() => zoomBy(-IMAGE_SCALE_STEP)}
					>
						<ZoomOut />
					</ProButton>
					<span className="min-w-[48px] text-center text-sm tabular-nums">
						{Math.round(transform.scale * 100)}%
					</span>
					<ProButton
						size="icon"
						variant="ghost"
						tooltip={m.pro_viewer_imageZoomIn()}
						onClick={() => zoomBy(IMAGE_SCALE_STEP)}
					>
						<ZoomIn />
					</ProButton>
					<div
						aria-hidden="true"
						className="mx-1 hidden h-5 w-px shrink-0 bg-border sm:block"
					/>
					<ProButton
						size="icon"
						variant="ghost"
						tooltip={m.pro_viewer_imageRotateCounterclockwise()}
						onClick={() => rotateBy(-90)}
					>
						<RotateCcw />
					</ProButton>
					<ProButton
						size="icon"
						variant="ghost"
						tooltip={m.pro_viewer_imageRotateClockwise()}
						onClick={() => rotateBy(90)}
					>
						<RotateCw />
					</ProButton>
					<div
						aria-hidden="true"
						className="mx-1 hidden h-5 w-px shrink-0 bg-border sm:block"
					/>
					<ProButton
						size="icon"
						variant="ghost"
						tooltip={m.pro_viewer_imageReset()}
						onClick={reset}
					>
						<RotateCcwSquare />
					</ProButton>
					<ProButton
						size="icon"
						variant="ghost"
						tooltip={
							fullscreen.fullscreen
								? m.pro_viewer_imageExitFullscreen()
								: m.pro_viewer_imageEnterFullscreen()
						}
						onClick={() => fullscreen.setFullscreen(!fullscreen.fullscreen)}
					>
						{fullscreen.fullscreen ? <Minimize2 /> : <Maximize2 />}
					</ProButton>
				</div>
				<div className="justify-self-center">
					{hasMultipleImages && (
						<span className="text-sm text-muted-foreground">
							{index + 1} / {list.length}
						</span>
					)}
				</div>
				<div className="flex justify-end">
					<ProButton
						size="icon"
						variant="ghost"
						tooltip={m.pro_viewer_imageClose()}
						onClick={onClose}
					>
						<X />
					</ProButton>
				</div>
			</div>

			<span className="sr-only" aria-live="polite" aria-atomic="true">
				Image {index + 1} of {list.length}
			</span>

			<div
				role="none"
				className={cn(
					"relative flex flex-1 items-center justify-center overflow-hidden",
					dragging ? "cursor-grabbing" : "cursor-grab",
				)}
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={stopDrag}
				onMouseLeave={stopDrag}
			>
				{hasMultipleImages && (
					<>
						<ProButton
							variant="ghost"
							size="icon"
							className="absolute left-4 z-10 size-10 rounded-full bg-background/70 text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
							onClick={(event) => {
								event.stopPropagation();
								select(index - 1);
							}}
							aria-label={m.pro_viewer_imagePrevious()}
						>
							<ChevronLeft className="size-5" />
						</ProButton>
						<ProButton
							variant="ghost"
							size="icon"
							className="absolute right-4 z-10 size-10 rounded-full bg-background/70 text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
							onClick={(event) => {
								event.stopPropagation();
								select(index + 1);
							}}
							aria-label={m.pro_viewer_imageNext()}
						>
							<ChevronRight className="size-5" />
						</ProButton>
					</>
				)}
				<img
					src={list[index]}
					alt={m.pro_viewer_imageAlt({ alt, index: index + 1 })}
					draggable={false}
					className="max-h-full max-w-full select-none object-contain"
					style={{
						transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale}) rotate(${transform.rotate}deg)`,
						transition: dragging ? "none" : "transform 0.15s ease",
					}}
				/>
			</div>

			{hasMultipleImages && (
				<div className="flex justify-center gap-2 px-4 py-3">
					{list.map((src, imageIndex) => (
						<ProButton
							// biome-ignore lint/suspicious/noArrayIndexKey: duplicate image URLs have distinct viewer positions.
							key={`${src}-${imageIndex}`}
							variant="ghost"
							size="icon"
							onClick={() => select(imageIndex)}
							className={cn(
								"size-12 overflow-hidden rounded border-2 transition-colors",
								imageIndex === index
									? "border-primary"
									: "border-transparent opacity-50 hover:opacity-80",
							)}
							aria-label={m.pro_viewer_imageOpen({
								alt,
								index: imageIndex + 1,
							})}
						>
							<img
								src={src}
								alt={m.pro_viewer_imageThumbnail({
									alt,
									index: imageIndex + 1,
								})}
								className="size-full object-cover"
							/>
						</ProButton>
					))}
				</div>
			)}
		</div>
	);

	if (portalTarget) return createPortal(content, portalTarget);
	return content;
}

function getPortalTarget(
	container: Element | DocumentFragment | null | undefined,
) {
	if (container !== undefined) return container;
	if (typeof document === "undefined") return null;
	return document.body;
}
