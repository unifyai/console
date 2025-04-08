import { ChevronRight } from "lucide-react";
import { Row } from "@tanstack/react-table";
import { useState, useEffect } from "react";

export interface RowExpandingProps {
    row: Row<any | unknown>;
    groupingColumnId: string;
    isLoading: boolean;
    isAnimating: boolean;
    setExpandingRowId: (id: string | null) => void;
    onExpand: (groupingColumnId: string, groupingValue: string, parentId: string, setExpandingRowId: (id: string | null) => void) => Promise<void>;
}

const RowExpanding = ({ 
    row, 
    groupingColumnId,
    isLoading: externalIsLoading,
    isAnimating: externalIsAnimating,
    setExpandingRowId,
    onExpand,
}: RowExpandingProps) => {
    const [isLoading, setIsLoading] = useState(externalIsLoading);
    const [isAnimating, setIsAnimating] = useState(externalIsAnimating);
    const isExpanded = row.getIsExpanded();

    const handleOnExpand = async () => {
        setIsLoading(true);
            try {
                const groupingValue = row.getValue(groupingColumnId);
                const parentId = row.original.id.split('>').slice(0, -1).join('>');
                await onExpand(groupingColumnId, groupingValue as string, parentId, setExpandingRowId);
            } finally {
            setIsLoading(false);
        }
    };

    const handleInitialExpand = async () => {
        if (isExpanded && !row.original.isPopulated) {
            // await handleOnExpand();
            row.toggleExpanded(false);
        }
    };

    // Effect to handle initial expanded state on page load
    useEffect(() => {
        handleInitialExpand();
    }, []);

    const handleClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        
        if (!isExpanded) {
            // Expanding
            setIsAnimating(true);
            
            if (!row.original.isPopulated) {
                // Only fetch data when we haven't populated this group's data before
                await handleOnExpand();
            }

            // Simply toggle this row's expanded state
            row.toggleExpanded(true);
        } else {
            // Collapsing - just collapse this row
            setIsAnimating(true);
            row.toggleExpanded(false);
        }

        // Reset animation state after transition
        setTimeout(() => setIsAnimating(false), 200);
    };

    return (
        <button 
            className={`transition-transform duration-200 ease-in-out cursor-pointer ${
                isAnimating ? 'rotate-90' : isExpanded ? 'rotate-90' : 'rotate-0'
            }`}
            onClick={handleClick}
            disabled={isLoading}
        >
            <ChevronRight />
        </button>
    );
};

export default RowExpanding;
