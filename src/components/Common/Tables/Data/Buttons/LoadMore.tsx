import React from 'react';
import { Button } from '@/components/UI/button';
import { Loader2, Plus } from 'lucide-react';
import { TableRow, TableCell } from '@/components/UI/table';
import Tooltip from '@/components/Common/Misc/Tooltip';

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
  
  // CSS class props
  position?: "sticky" | "relative";
  
  // Button text customization
  buttonText?: string;
  loadingText?: string;
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
  position = "sticky",
  buttonText = "Load More",
  loadingText = "Loading...",
}) => {
  const isDisabled = !interactive || isLoading || disabled;
  const disabledTooltip = !interactive 
    ? "Table is not interactive" 
    : disabled 
      ? "Loading is disabled" 
      : isLoading 
        ? "Currently loading..." 
        : "";

  // If not used as table row, render as regular button
  if (!asTableRow) {
    const button = (
      <Tooltip content={buttonText}>
        <Button
          variant="outline"
          size="sm"
          onClick={onLoadMore}
          disabled={isDisabled}
          className={`h-6 px-2 text-xs backdrop-blur-sm border border-border/50 shadow-md transition-colors ${
            isDisabled 
              ? 'bg-muted/50 text-muted-foreground cursor-not-allowed opacity-50' 
              : 'bg-background/90 hover:bg-accent hover:text-accent-foreground'
          } ${className}`}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              {loadingText}
            </>
          ) : (
            buttonText
          )}
        </Button>
      </Tooltip>
    );

    return isDisabled && disabledTooltip ? (
      <Tooltip content={disabledTooltip}>
        {button}
      </Tooltip>
    ) : button;
  }

  // Don't render anything if no more pages available
  if (!hasNextPage && !isLoading) {
    return null;
  }

  const isSticky = !buttonText?.toLowerCase().includes('previous');

  // Helper function to render button content
  const renderButtonContent = () => {
    const content = (
      <div
        onClick={isDisabled ? undefined : onLoadMore}
        className={`flex items-center justify-between w-full px-2 py-2 text-sm transition-colors ${
          isDisabled
            ? 'bg-muted/50 text-muted-foreground cursor-not-allowed'
            : 'hover:bg-accent hover:text-accent-foreground cursor-pointer'
        }`}
      >
        
        {/* Centered Text */}
        <div className="flex-1 text-center font-medium">
          {buttonText}
        </div>

        {/* Right Spacer (to balance the icon for perfect centering) */}
        <div className="flex-shrink-0 w-12" />
      </div>
    );

    return isDisabled && disabledTooltip ? (
      <Tooltip content={disabledTooltip}>
        {content}
      </Tooltip>
    ) : (
      content
    );
  };

  // Helper function to render loading content
  const renderLoadingContent = () => (
    <div
      className="flex items-center justify-center w-full gap-2 px-6 py-2 text-muted-foreground"
    >
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span>{loadingText}</span>
    </div>
  );

  // Render as table row for table context
  return (
    <>
      {/* Load More button row - only show if there are more pages and not fetching */}
      {hasNextPage && !isLoading && (
        <TableRow className={isSticky ? 'sticky bottom-0 z-10' : ''}>
          <TableCell 
            colSpan={colSpan} 
            className={`p-0 ${isSticky ? 'bg-background' : ''}`}
            style={{borderTop: "1px solid var(--muted)", borderRight: "1px solid var(--muted)", borderLeft: "1px solid var(--muted)"}}
          >
            {renderButtonContent()}
          </TableCell>
        </TableRow>
      )}
      
      {/* Loading indicator row - show when fetching next page */}
      {isLoading && (
        <TableRow className={isSticky ? 'sticky bottom-0 z-10' : ''}>
          <TableCell 
            colSpan={colSpan} 
            className={`p-0 ${isSticky ? 'bg-background' : ''}`}
            style={{borderTop: "1px solid var(--muted)", borderRight: "1px solid var(--muted)", borderLeft: "1px solid var(--muted)"}}
          >
            {renderLoadingContent()}
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export default LoadMore;