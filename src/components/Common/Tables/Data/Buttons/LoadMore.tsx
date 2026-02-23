import React from 'react';
import { Button } from '@/components/UI/button';
import { Loader2 } from 'lucide-react';
import { TableRow, TableCell } from '@/components/UI/table';
import Tooltip from '@/components/Common/Misc/Tooltip';
import { Table } from '@tanstack/react-table';

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
  position?: 'sticky' | 'relative';

  // Button text customization
  buttonText?: string;
  loadingText?: string;

  table?: Table<any>;
}

const LoadMore: React.FC<LoadMoreProps> = ({
  onLoadMore,
  isLoading = false,
  disabled = false,
  interactive = true,
  className = '',
  asTableRow = false,
  colSpan = 1,
  hasNextPage = true,
  position = 'sticky',
  buttonText = 'Load More',
  loadingText = 'Loading...',
  table,
}) => {
  const isDisabled = !interactive || isLoading || disabled;
  const disabledTooltip = !interactive
    ? 'Table is not interactive'
    : disabled
      ? 'Loading is disabled while streaming'
      : isLoading
        ? 'Currently loading...'
        : '';

  // If not used as table row, render as regular button
  if (!asTableRow) {
    const button = (
      <Button
        variant="outline"
        size="sm"
        onClick={onLoadMore}
        disabled={isDisabled}
        className={`text-body-sm border-border/50 h-6 border px-2 shadow-md backdrop-blur-sm transition-colors ${
          isDisabled
            ? 'bg-muted/50 cursor-not-allowed text-muted-foreground opacity-50'
            : 'bg-background/90 hover:bg-accent hover:text-accent-foreground'
        } ${className}`}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            {loadingText}
          </>
        ) : (
          buttonText
        )}
      </Button>
    );

    return isDisabled && disabledTooltip ? (
      <Tooltip content={disabledTooltip}>{button}</Tooltip>
    ) : (
      button
    );
  }

  // Helper function to render button content
  const renderButtonContent = () => {
    const button = (
      <button
        onClick={onLoadMore}
        disabled={isDisabled}
        className={`border-border/50 rounded-md border px-6 py-2 shadow-md backdrop-blur-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
          isDisabled
            ? 'bg-muted/50 cursor-not-allowed text-muted-foreground opacity-50'
            : 'bg-background/90 text-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
      >
        {buttonText}
      </button>
    );

    // Simple centered layout - no CSS variable dependencies
    const content = (
      <div className="flex w-full items-center justify-center gap-2">
        {isDisabled && disabledTooltip ? (
          <Tooltip content={disabledTooltip}>{button}</Tooltip>
        ) : (
          button
        )}
      </div>
    );

    return content;
  };

  // Helper function to render loading content
  const renderLoadingContent = () => (
    <div className="flex w-full items-center justify-center gap-2">
      <div className="bg-background/90 border-border/50 flex items-center justify-center gap-2 rounded-md border px-6 py-2 shadow-md backdrop-blur-sm">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-muted-foreground">{loadingText}</span>
      </div>
    </div>
  );

  // Render as table row for table context
  return (
    <>
      {/* Load More button row - only show if there are more pages, or if it should be visible but disabled (e.g. during auto-update) */}
      {hasNextPage && !isLoading && (
        <TableRow>
          <TableCell
            colSpan={colSpan}
            className="relative border-t py-4"
            style={{ borderRight: '1px solid var(--muted)', borderLeft: '1px solid var(--muted)' }}
          >
            {renderButtonContent()}
          </TableCell>
        </TableRow>
      )}

      {/* Loading indicator row - show when fetching next page */}
      {isLoading && (
        <TableRow>
          <TableCell
            colSpan={colSpan}
            className="relative border-t py-4"
            style={{ borderRight: '1px solid var(--muted)', borderLeft: '1px solid var(--muted)' }}
          >
            {renderLoadingContent()}
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export default LoadMore;
