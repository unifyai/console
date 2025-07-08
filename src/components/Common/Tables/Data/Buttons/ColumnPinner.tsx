import { Column, Table } from "@tanstack/react-table";
import { CSSProperties, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getNextLeafColumn, getPreviousLeafColumn } from "@/utils/interfaces/table/columnOperations";
import { DraggingColumnPinnerState } from "@/types/interfaces/columns";
import { Transform } from "@dnd-kit/utilities";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import { createPortal } from 'react-dom';

const ColumnPinner = ({
    column,
    table,
    columnOrder,
    draggingColumnPinner,
    setDraggingColumnPinner,
}: {
    column: Column<any, unknown>;
    table: Table<any>;
    columnOrder: string[];
    draggingColumnPinner: DraggingColumnPinnerState;
    setDraggingColumnPinner: (state: DraggingColumnPinnerState) => void;
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [overlayPosition, setOverlayPosition] = useState<{ left: number; top: number; height: number } | null>(null);
    const [overlayStartLeft, setOverlayStartLeft] = useState<number>(0);

    // Computes table boundaries for overlay (Y-axis only). X comes from columnPositions.
    const getOverlayMetrics = useCallback(() => {
        const tableElement = document.querySelector(".LogsTable");
        if (!tableElement) return null;
        const tableRect = tableElement.getBoundingClientRect();
        const footerElement = tableElement.querySelector("tfoot");
        const footerHeight = footerElement?.getBoundingClientRect().height ?? 0;
        const viewportHeight = window.innerHeight;

        const tableTop = Math.max(tableRect.top, 0);
        const tableBottom = Math.min(tableRect.bottom - footerHeight, viewportHeight);
        const visibleHeight = tableBottom - tableTop;

        return { top: tableTop, height: visibleHeight };
    }, []);

    const handleDragStart = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();

        if (isDragging) return;

        const metrics = getOverlayMetrics();
        if (!metrics) return;

        setIsDragging(true);
        setStartX(e.clientX);

        setOverlayStartLeft(e.clientX);
        setOverlayPosition({ left: e.clientX, top: metrics.top, height: metrics.height });

        setDraggingColumnPinner({
            columnId: column.id,
            isPinning: true,
            direction: null,
            transform: { x: 0, y: 0, scaleX: 1, scaleY: 1 },
        });
    }, [column.id, getOverlayMetrics, isDragging, setDraggingColumnPinner]);

    const nextColumn = getNextLeafColumn(column, columnOrder, table);
    const prevColumn = getPreviousLeafColumn(column, columnOrder, table);

    const handleDragMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !overlayPosition) return;

        const dragDelta = e.clientX - startX;

        setOverlayPosition((prev) =>
            prev ? { ...prev, left: overlayStartLeft + dragDelta } : null
        );

        const newDragging = {
            ...draggingColumnPinner,
            direction: dragDelta >= 0 ? ("right" as const) : ("left" as const),
            transform: null as Transform | null,
        };
        setDraggingColumnPinner(newDragging);
    }, [isDragging, overlayPosition, startX, overlayStartLeft, draggingColumnPinner, setDraggingColumnPinner]);

    const isPinned = column.getIsPinned();
    const commitPinChanges = useCallback((finalLeft: number) => {
        const leafs: Column<any, unknown>[] = (table as any).getVisibleLeafColumns?.() ?? (table as any).getLeafColumns?.() ?? [];

        if (draggingColumnPinner.direction === "right") {
            // Pin only the immediate next column to the right
            const next = getNextLeafColumn(column, columnOrder, table);
            if (next && !next.getIsPinned()) {
              next.pin("left");
            }
        } else if (draggingColumnPinner.direction === "left") {
            // Unpin only the current column
            if (isPinned) {
              column.pin(false);
            }
        }
    }, [table, draggingColumnPinner.direction, isPinned, column, columnOrder]);

    // Handle drag end early so it can be referenced before declaration
    const handleDragEnd = useCallback(() => {
        if (overlayPosition) {
            commitPinChanges(overlayPosition.left);
        }

        setIsDragging(false);
        setOverlayPosition(null);
        setDraggingColumnPinner({ columnId: null, isPinning: false, direction: null, transform: null });
        setStartX(0);
    }, [overlayPosition, commitPinChanges, setDraggingColumnPinner]);

    // Simple click handlers (no animation) for pin/unpin buttons
    const handleClickUnpin = () => {
        if (column.getIsPinned()) {
            column.pin(false);
        }
    };

    const handleClickPin = () => {
        if (nextColumn && !nextColumn.getIsPinned()) {
            nextColumn.pin("left");
        }
    };

    // Set up event listeners using useEffect
    useEffect(() => {
        if (isDragging) {
            window.addEventListener("mousemove", handleDragMove, { capture: true });
            window.addEventListener("mouseup", handleDragEnd, { capture: true });

            // Cleanup function
            return () => {
                window.removeEventListener("mousemove", handleDragMove, { capture: true });
                window.removeEventListener("mouseup", handleDragEnd, { capture: true });
            };
        }
    }, [isDragging, handleDragMove, handleDragEnd]);

    // Update overlay top/height when dragging starts or viewport scrolls
    useEffect(() => {
        if (!isDragging) return;
        const metrics = getOverlayMetrics();
        if (!metrics) return;
        setOverlayPosition((prev) => (prev ? { ...prev, top: metrics.top, height: metrics.height } : prev));
    }, [isDragging, getOverlayMetrics]);

    const style: CSSProperties = {
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: 8,
        cursor: "grabbing",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: !isDragging && isHovered ? "var(--primary)" : "transparent",
        opacity: !isDragging && isHovered ? 0.7 : 0,
        transition: isDragging ? undefined : "transform 0.2s ease-out",
        zIndex: 30,
        userSelect: "none",
        touchAction: "none"
    };

    return (
        <>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div
                            style={{
                                ...style,
                                background: "transparent",
                                opacity: 1
                            }}
                            onMouseDown={handleDragStart}
                            onMouseEnter={() => setIsHovered(true)}
                            onMouseLeave={() => setIsHovered(false)}
                        >
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <div className="flex items-center gap-2">
                            {column.getIsPinned() && prevColumn && (
                                <button
                                    onClick={handleClickUnpin}
                                    className="hover:bg-muted p-1 rounded flex items-center gap-1"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    <span>Unpin</span>
                                </button>
                            )}
                            <span className="text-muted-foreground">Drag to Pin/Unpin</span>
                            {nextColumn && !nextColumn.getIsPinned() && (
                                <button
                                    onClick={handleClickPin}
                                    className="hover:bg-muted p-1 rounded flex items-center gap-1"
                                >
                                    <span>Pin</span>
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            
            {/* Draggable overlay border */}
            {overlayPosition && createPortal(
                <div
                    style={{
                        position: "fixed",
                        left: overlayPosition.left,
                        top: overlayPosition.top,
                        height: overlayPosition.height,
                        width: 4,
                        background: "var(--primary)",
                        opacity: 0.7,
                        transition: isDragging ? undefined : "transform 0.2s ease-out",
                        pointerEvents: "none",
                        zIndex: 10000,
                        boxShadow: "0 0 4px var(--primary)"
                    }}
                />,
                document.body
            )}
        </>
    );
};

export default ColumnPinner;
