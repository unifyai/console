import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';

interface AssistantListGroupHeaderProps {
  label: string;
  count: number;
  isFolded: boolean;
  onToggleFold: () => void;
  description?: string | null;
  variant?: 'section' | 'group';
}

export function AssistantListGroupHeader({
  label,
  count,
  isFolded,
  onToggleFold,
  description,
  variant = 'group',
}: AssistantListGroupHeaderProps) {
  const Icon = isFolded ? ChevronRight : ChevronDown;
  const header = (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-1.5 border-b text-xs transition-colors hover:bg-muted hover:text-foreground',
        variant === 'section'
          ? 'px-2 py-2 font-semibold uppercase tracking-wide text-muted-foreground'
          : 'px-2 py-1.5 text-muted-foreground'
      )}
      aria-expanded={!isFolded}
      onClick={onToggleFold}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left font-medium">{label}</span>
      <span className="shrink-0 tabular-nums">{count}</span>
    </button>
  );

  if (!description) {
    return header;
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{header}</TooltipTrigger>
        <TooltipContent side="right" className="max-w-64">
          <p>{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
