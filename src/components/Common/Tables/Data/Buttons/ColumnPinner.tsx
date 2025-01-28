import { Column, Table } from "@tanstack/react-table";
import { CSSProperties, useState, useEffect, useCallback } from "react";
import { Hand, ChevronLeft, ChevronRight } from "lucide-react";
import { getNextLeafColumn, getPreviousLeafColumn } from "@/utils/evals/columnOperations";
import { PinningColumnState } from "@/types/columns";
import { Transform } from "@dnd-kit/utilities";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";

const ColumnPinner = ({
    column,
    table,
    columnPinning,
    columnOrder,
    pinningState,
    setPinningState,
}: {
    column: Column<any, unknown>;
    table: Table<any>;
    columnPinning: { left?: string[]; right?: string[] };
    columnOrder: string[];
    pinningState: PinningColumnState;
    setPinningState: (state: PinningColumnState) => void;
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [overlayPosition, setOverlayPosition] = useState<{ left: number; top: number; height: number } | null>(null);

    const handleDragEnd = useCallback(() => {
        setIsDragging(false);
        setOverlayPosition(null);
        setPinningState({
            columnId: null,
            isPinning: false,
            direction: null,
            transform: null
        });
        setStartX(0);
    }, [setPinningState]);

    const getOverlayPosition = useCallback(() => {
        const currentHeader = document.querySelector(`[data-column-id="${column.id}"]`);
        const tableElement = currentHeader?.closest(".LogsTable");
        if (!currentHeader || !tableElement) return null;

        const currentRect = currentHeader.getBoundingClientRect();
        const tableRect = tableElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        // Get the footer element and its height
        const footerElement = tableElement.querySelector("tfoot");
        const footerHeight = footerElement?.getBoundingClientRect().height ?? 0;
        
        // Calculate the visible portion of the table
        const tableTop = Math.max(tableRect.top, 0); // Don't go above viewport
        const tableBottom = Math.min(tableRect.bottom - footerHeight, viewportHeight); // Subtract footer height
        const visibleHeight = tableBottom - tableTop;
        
        return {
            left: currentRect.right,
            top: Math.max(currentRect.top, 0), // Start from top of viewport if header is above
            height: Math.min(visibleHeight, viewportHeight - Math.max(currentRect.top, 0) - footerHeight) // Account for footer
        };
    }, [column.id]);

    const handleDragStart = useCallback((e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent interference with other drag handlers
        
        setIsDragging(true);
        setStartX(e.clientX);
        
        const position = getOverlayPosition();
        if (position) {
            setOverlayPosition(position);
            
            setPinningState({
                columnId: column.id,
                isPinning: true,
                direction: null,
                transform: { x: 0, y: 0, scaleX: 1, scaleY: 1 }
            });
        }
    }, [column.id, setPinningState, getOverlayPosition]);

    const nextColumn = getNextLeafColumn(column, columnOrder, table);
    const prevColumn = getPreviousLeafColumn(column, columnOrder, table);

    // Function to check if we're close to a column boundary
    const isNearColumnBoundary = useCallback((dragDelta: number) => {
        const nextHeader = nextColumn ? document.querySelector(`[data-column-id="${nextColumn.id}"]`) : null;
        const prevHeader = prevColumn ? document.querySelector(`[data-column-id="${prevColumn.id}"]`) : null;
        const currentHeader = document.querySelector(`[data-column-id="${column.id}"]`);

        if (!currentHeader) return false;

        const currentRect = currentHeader.getBoundingClientRect();
        const threshold = currentRect.width * 0.1; // 10% of column width

        if (dragDelta > 0 && nextHeader) {
            const nextRect = nextHeader.getBoundingClientRect();
            return Math.abs(nextRect.right - (currentRect.right + dragDelta)) < threshold;
        } else if (dragDelta < 0 && prevHeader) {
            const prevRect = prevHeader.getBoundingClientRect();
            return Math.abs(prevRect.right - (currentRect.right + dragDelta)) < threshold;
        }

        return false;
    }, [column.id, nextColumn, prevColumn]);

    // Simulate overlay animation
    const simulateOverlayAnimation = useCallback((direction: "left" | "right") => {
        const currentHeader = document.querySelector(`[data-column-id="${column.id}"]`);
        const targetHeader = direction === "right" 
            ? document.querySelector(`[data-column-id="${nextColumn?.id}"]`)
            : document.querySelector(`[data-column-id="${prevColumn?.id}"]`);

        if (!currentHeader || !targetHeader) return;

        const currentRect = currentHeader.getBoundingClientRect();
        const targetRect = targetHeader.getBoundingClientRect();
        const tableElement = currentHeader.closest(".LogsTable");
        if (!tableElement) return;

        const tableRect = tableElement.getBoundingClientRect();

        setOverlayPosition({
            left: currentRect.right,
            top: currentRect.top,
            height: tableRect.height - (currentRect.top - tableRect.top)
        });

        // Set pinning state to trigger animation
        setPinningState({
            columnId: column.id,
            isPinning: true,
            direction,
            transform: {
                x: direction === "right" ? targetRect.right - currentRect.right : targetRect.right - currentRect.right,
                y: 0,
                scaleX: 1,
                scaleY: 1
            }
        });

        // Clean up after animation
        setTimeout(() => {
            if (direction === "right" && nextColumn) {
                nextColumn.pin("left");
            } else if (direction === "left" && column.getIsPinned()) {
                column.pin(false);
            }
            handleDragEnd();
        }, 200);
    }, [column, nextColumn, prevColumn, handleDragEnd]);

    const handleDragMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !pinningState.isPinning || !overlayPosition) {
            return;
        }

        const dragDelta = e.clientX - startX;

        // Check if we're near a column boundary
        if (isNearColumnBoundary(dragDelta)) {
            handleDragEnd();
            return;
        }

        // Update overlay position
        setOverlayPosition(prev => prev ? {
            ...prev,
            left: prev.left + dragDelta
        } : null);

        const transform: Transform = {
            x: dragDelta,
            y: 0,
            scaleX: 1,
            scaleY: 1
        };

        // Get the next/previous leaf columns
        const nextColumn = getNextLeafColumn(column, columnOrder, table);
        const prevColumn = getPreviousLeafColumn(column, columnOrder, table);

        // Update pinning state with direction and transform
        const newPinningState = {
            ...pinningState,
            direction: dragDelta > 0 ? ("right" as const) : ("left" as const),
            transform
        };
        setPinningState(newPinningState);

        // If dragging right and there's a next leaf column that isn't pinned
        if (dragDelta > 50 && nextColumn && !nextColumn.getIsPinned()) {
            // Add the next column to pinned columns
            const currentPinned = columnPinning.left || [];
            if (!currentPinned.includes(nextColumn.id as string)) {
                nextColumn.pin("left")
                // Update start position after pinning
                setStartX(e.clientX);
            }
        }
        // If dragging left and current column is pinned and there's a previous leaf column
        else if (dragDelta < -50 && column.getIsPinned() && prevColumn) {
            // Only unpin if the previous column is still pinned (maintain contiguous pinned columns)
            if (prevColumn.getIsPinned()) {
                column.pin(false)
                // Update start position after unpinning
                setStartX(e.clientX);
            }
        }
    }, [isDragging, pinningState, startX, column, columnOrder, table, columnPinning, setPinningState, overlayPosition, isNearColumnBoundary, handleDragEnd]);

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

    const style: CSSProperties = {
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: 8,
        cursor: isDragging ? "grabbing" : "grab",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: !isDragging && isHovered ? "var(--primary)" : "transparent",
        opacity: !isDragging && isHovered ? 0.7 : 0,
        transition: "opacity 0.2s, background 0.2s",
        zIndex: 30,
        userSelect: "none",
        touchAction: "none"
    };

    // Show overlay on hover
    useEffect(() => {
        if (isDragging) {
            setOverlayPosition(getOverlayPosition());
        } else {
            setOverlayPosition(null);
        }
    }, [isDragging, getOverlayPosition]);

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
                            <Hand className="h-4 w-4 opacity-0 hover:opacity-70 transition-opacity" />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <div className="flex items-center gap-2">
                            {column.getIsPinned() && prevColumn && (
                                <button
                                    onClick={() => simulateOverlayAnimation("left")}
                                    className="hover:bg-muted p-1 rounded flex items-center gap-1"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    <span>Unpin</span>
                                </button>
                            )}
                            <span className="text-muted-foreground">Drag to Pin/Unpin</span>
                            {nextColumn && !nextColumn.getIsPinned() && (
                                <button
                                    onClick={() => simulateOverlayAnimation("right")}
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
            {overlayPosition && (
                <div
                    style={{
                        position: "fixed",
                        left: overlayPosition.left,
                        top: overlayPosition.top,
                        height: overlayPosition.height,
                        width: 4,
                        background: "var(--primary)",
                        opacity: 0.7,
                        transform: pinningState.transform ? `translateX(${pinningState.transform.x}px)` : undefined,
                        transition: "transform 0.2s ease-out",
                        pointerEvents: "none",
                        zIndex: 1000,
                        boxShadow: "0 0 4px var(--primary)"
                    }}
                />
            )}
        </>
    );
};

export default ColumnPinner;
