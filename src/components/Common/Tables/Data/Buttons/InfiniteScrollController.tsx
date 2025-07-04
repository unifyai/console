import React from 'react';
import { Button } from '@/components/UI/button';
import { Loader2, ChevronDown, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/UI/badge';

interface InfiniteScrollControllerProps {
  // Data state
  loadedCount: number;
  estimatedTotal?: number;
  totalCount?: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  
  // Actions
  onLoadMore: () => void;
  onRefresh?: () => void;
  
  // Optional props
  interactive?: boolean;
  itemName?: string; // e.g., "logs", "groups", "entries"
  className?: string;
  showRefresh?: boolean;
}

const InfiniteScrollController: React.FC<InfiniteScrollControllerProps> = ({
  loadedCount,
  estimatedTotal,
  totalCount,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onRefresh,
  interactive = true,
  itemName = "entries",
  className = "",
  showRefresh = false
}) => {
  // Format count display
  const formatCount = (count: number) => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
    return `${(count / 1000000).toFixed(1)}m`;
  };

  // Build count text
  const getCountText = () => {
    if (totalCount !== undefined && totalCount > 0) {
      // We have exact count
      if (loadedCount >= totalCount) {
        return `All ${formatCount(totalCount)} ${itemName}`;
      }
      return `${formatCount(loadedCount)} of ${formatCount(totalCount)} ${itemName}`;
    } else if (estimatedTotal && estimatedTotal > loadedCount) {
      // We have estimated count
      return `${formatCount(loadedCount)} of ~${formatCount(estimatedTotal)} ${itemName}`;
    } else if (hasNextPage) {
      // More available, no estimate
      return `${formatCount(loadedCount)} ${itemName} • More available`;
    } else {
      // All loaded
      return `All ${formatCount(loadedCount)} ${itemName}`;
    }
  };

  const getProgressPercentage = () => {
    const total = totalCount || estimatedTotal;
    if (!total || total === 0) return undefined;
    return Math.min((loadedCount / total) * 100, 100);
  };

  const progressPercentage = getProgressPercentage();

  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      {/* Count and Progress Indicator */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-sm">
          {getCountText()}
        </Badge>
        
        {progressPercentage !== undefined && (
          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {/* <div className="flex items-center gap-2">
        {showRefresh && onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={!interactive || isFetchingNextPage}
            className="h-8 px-2"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        )}
        
        {hasNextPage && (
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={!interactive || isFetchingNextPage}
            className="h-8 px-3"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Load More
              </>
            )}
          </Button>
        )}
      </div> */}
    </div>
  );
};

export default InfiniteScrollController; 