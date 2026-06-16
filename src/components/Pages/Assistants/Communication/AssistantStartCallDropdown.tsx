import * as React from 'react';
import { Phone } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';

interface AssistantStartCallDropdownProps {
  children: React.ReactNode;
  onStartCall: () => void;
  disabled?: boolean;
  tooltip?: string;
  triggerClassName?: string;
  contentSide?: 'top' | 'right' | 'bottom' | 'left';
  contentAlign?: 'start' | 'center' | 'end';
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
  ariaLabel?: string;
  testId?: string;
}

export function AssistantStartCallDropdown({
  children,
  onStartCall,
  disabled = false,
  tooltip = 'Start call',
  triggerClassName,
  contentSide = 'bottom',
  contentAlign = 'center',
  tooltipSide = 'right',
  ariaLabel = 'Open assistant call actions',
  testId,
}: AssistantStartCallDropdownProps) {
  const handleSelect = React.useCallback(
    (event: Event) => {
      if (disabled) {
        event.preventDefault();
        return;
      }
      onStartCall();
    },
    [disabled, onStartCall]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'rounded-control block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            triggerClassName
          )}
          aria-label={ariaLabel}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {children}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={contentSide}
        align={contentAlign}
        className="min-w-0 p-1"
        onClick={(event) => event.stopPropagation()}
      >
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuItem
                className={cn(
                  'flex h-8 w-8 items-center justify-center p-0',
                  disabled && 'cursor-not-allowed opacity-50'
                )}
                onSelect={handleSelect}
                aria-disabled={disabled}
                aria-label={tooltip}
                data-testid={testId}
              >
                <Phone className="h-4 w-4" />
              </DropdownMenuItem>
            </TooltipTrigger>
            <TooltipContent side={tooltipSide}>
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
