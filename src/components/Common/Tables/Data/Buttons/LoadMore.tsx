import React from 'react';
import { Button } from '@/components/UI/button';
import { Loader2 } from 'lucide-react';
import { TableRow, TableCell } from '@/components/UI/table';

export interface LoadMoreProps {
  onLoadMore: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  interactive?: boolean;
  className?: string;
  // Table-specific props for when used in table context
  asTableRow?: boolean;
  colSpan?: number;
  hasNextPage?: boolean;
}

const LoadMore: React.FC<LoadMoreProps> = ({
  onLoadMore,
  isLoading = false,
  disabled = false,
  interactive = true,
  className = "",
  asTableRow = false,
  colSpan = 1,
  hasNextPage = true,
}) => {
  // If not used as table row, render as regular button
  if (!asTableRow) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={onLoadMore}
        disabled={!interactive || isLoading || disabled}
        className={`h-6 px-2 text-xs ${className}`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            Load More
          </>
        )}
      </Button>
    );
  }

  // Don't render anything if no more pages available
  if (!hasNextPage && !isLoading) {
    return null;
  }

  // Render as table row for table context
  return (
    <>
      {/* Load More button row - only show if there are more pages and not fetching */}
      {hasNextPage && !isLoading && (
        <TableRow>
          <TableCell 
            colSpan={colSpan} 
            className="relative py-4 border-t"
            style={{borderRight: "1px solid var(--muted)", borderLeft: "1px solid var(--muted)"}}
          >
            <div
              className="sticky left-1/2 transform -translate-x-1/2 inline-block"
              style={{ width: 'fit-content' }}
            >
              <button
                onClick={onLoadMore}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                disabled={!interactive || disabled}
              >
                Load More
              </button>
            </div>
          </TableCell>
        </TableRow>
      )}
      
      {/* Loading indicator row - show when fetching next page */}
      {isLoading && (
        <TableRow>
          <TableCell 
            colSpan={colSpan} 
            className="relative py-4 border-t"
            style={{borderRight: "1px solid var(--muted)", borderLeft: "1px solid var(--muted)"}}
          >
            <div
              className="sticky left-1/2 transform -translate-x-1/2 inline-block"
              style={{ width: 'fit-content' }}
            >
              <div className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-muted-foreground">Loading more...</span>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export default LoadMore; 