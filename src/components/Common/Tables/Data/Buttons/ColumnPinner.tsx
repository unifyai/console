import { Column, Table } from "@tanstack/react-table";
import { CSSProperties, useState, useEffect, useCallback } from "react";
import { Hand } from "lucide-react";
import { getNextLeafColumn, getPreviousLeafColumn } from "@/utils/evals/columnOperations";
import { PinningColumnState } from "@/types/columns";
import { Transform } from "@dnd-kit/utilities";

const ColumnPinner = ({
    column,
    table,
    columnPinning,
    setColumnPinning,
    columnOrder,
    pinningState,
    setPinningState,
}: {
    column: Column<any, unknown>;
    table: Table<any>;
    columnPinning: { left?: string[]; right?: string[] };
    setColumnPinning: (pinning: { left?: string[]; right?: string[] }) => void;
    columnOrder: string[];
    pinningState: PinningColumnState;
    setPinningState: (state: PinningColumnState) => void;
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);

    // Memoize handlers to prevent recreating them on each render
    const handleDragStart = useCallback((e: React.MouseEvent) => {
        console.log('🔵 handleDragStart fired', {
            columnId: column.id,
            isPinned: column.getIsPinned(),
            startX: e.clientX
        });
        e.stopPropagation(); // Prevent interference with other drag handlers
        setStartX(e.clientX);
        setIsDragging(true);
        
        // Initialize pinning state
        const newPinningState = {
            columnId: column.id,
            isPinning: true,
            direction: null,
            transform: { x: 0, y: 0, scaleX: 1, scaleY: 1 }
        };
        console.log('🔵 Setting initial pinning state:', newPinningState);
        setPinningState(newPinningState);
    }, [column.id, setPinningState]);

    const handleDragMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !pinningState.isPinning) {
            console.log('🟡 handleDragMove ignored - not dragging or not pinning', { isDragging, isPinning: pinningState.isPinning });
            return;
        }

        const dragDelta = e.clientX - startX;
        console.log('🟡 handleDragMove', {
            columnId: column.id,
            dragDelta,
            startX,
            currentX: e.clientX,
            direction: dragDelta > 0 ? 'right' : 'left',
            isDragging,
            isPinning: pinningState.isPinning
        });

        const transform: Transform = {
            x: dragDelta,
            y: 0,
            scaleX: 1,
            scaleY: 1
        };

        // Get the next/previous leaf columns
        const nextColumn = getNextLeafColumn(column, columnOrder, table);
        const prevColumn = getPreviousLeafColumn(column, columnOrder, table);

        console.log('🟡 Adjacent columns:', {
            nextColumnId: nextColumn?.id,
            prevColumnId: prevColumn?.id,
            nextColumnPinned: nextColumn?.getIsPinned(),
            prevColumnPinned: prevColumn?.getIsPinned()
        });

        // Update pinning state with direction and transform
        const newPinningState = {
            ...pinningState,
            direction: dragDelta > 0 ? ('right' as const) : ('left' as const),
            transform
        };
        console.log('🟡 Updating pinning state:', newPinningState);
        setPinningState(newPinningState);

        // If dragging right and there's a next leaf column that isn't pinned
        if (dragDelta > 50 && nextColumn && !nextColumn.getIsPinned()) {
            console.log('🟢 Pinning next column to left:', nextColumn.id);
            // Add the next column to pinned columns
            const currentPinned = columnPinning.left || [];
            if (!currentPinned.includes(nextColumn.id as string)) {
                nextColumn.pin("left")
            }
            setStartX(e.clientX);
        }
        // If dragging left and current column is pinned and there's a previous leaf column
        else if (dragDelta < -50 && column.getIsPinned() && prevColumn) {
            console.log('🔴 Unpinning current column:', column.id);
            // Only unpin if the previous column is still pinned (maintain contiguous pinned columns)
            const currentPinned = columnPinning.left || [];
            if (prevColumn.getIsPinned()) {
                column.pin(false)
            }
            setStartX(e.clientX);
        }
    }, [isDragging, pinningState, startX, column, columnOrder, table, columnPinning, setPinningState]);

    const handleDragEnd = useCallback(() => {
        console.log('⚫ handleDragEnd fired', {
            columnId: column.id,
            finalPinningState: pinningState,
            isDragging
        });
        
        setIsDragging(false);
        setPinningState({
            columnId: null,
            isPinning: false,
            direction: null,
            transform: null
        });
        setStartX(0);
    }, [column.id, pinningState, isDragging, setPinningState]);

    // Set up event listeners using useEffect
    useEffect(() => {
        if (isDragging) {
            console.log('🎯 Adding mousemove and mouseup listeners');
            window.addEventListener('mousemove', handleDragMove, { capture: true });
            window.addEventListener('mouseup', handleDragEnd, { capture: true });

            // Cleanup function
            return () => {
                console.log('🎯 Removing mousemove and mouseup listeners');
                window.removeEventListener('mousemove', handleDragMove, { capture: true });
                window.removeEventListener('mouseup', handleDragEnd, { capture: true });
            };
        }
    }, [isDragging, handleDragMove, handleDragEnd]);

    const style: CSSProperties = {
        position: 'absolute',
        right: -4,
        top: 0,
        bottom: 0,
        width: 8,
        cursor: isDragging ? 'grabbing' : 'grab',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: pinningState.isPinning || isHovered ? 'var(--primary)' : 'transparent',
        opacity: pinningState.isPinning ? 1 : isHovered ? 0.7 : 0,
        transition: pinningState.isPinning ? 'none' : 'opacity 0.2s, background 0.2s',
        zIndex: 30,
        userSelect: 'none',
        touchAction: 'none'
    };

    return (
        <div
            style={style}
            onMouseDown={handleDragStart}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="hover:opacity-100 opacity-0 transition-all"
        >
            <Hand className="h-4 w-4" />
        </div>
    );
};

export default ColumnPinner;
