import * as React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';

interface AssistantStartCallButtonProps {
  children: React.ReactNode;
  onStartCall: () => void;
  disabled?: boolean;
  tooltip?: string;
  triggerClassName?: string;
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
  ariaLabel?: string;
  testId?: string;
}

export function AssistantStartCallButton({
  children,
  onStartCall,
  disabled = false,
  tooltip = 'Call',
  triggerClassName,
  tooltipSide = 'right',
  ariaLabel = 'Call',
  testId,
}: AssistantStartCallButtonProps) {
  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (disabled) return;
      onStartCall();
    },
    [disabled, onStartCall]
  );

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn('inline-flex', disabled && 'cursor-not-allowed')}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={cn(
                'rounded-control block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                disabled && 'pointer-events-none cursor-not-allowed opacity-50',
                triggerClassName
              )}
              aria-label={ariaLabel}
              disabled={disabled}
              onClick={handleClick}
              onKeyDown={(event) => event.stopPropagation()}
              data-testid={testId}
            >
              {children}
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
