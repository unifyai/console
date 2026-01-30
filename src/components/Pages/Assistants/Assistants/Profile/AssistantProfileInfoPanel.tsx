'use client';

import * as React from 'react';
import { Clock } from 'lucide-react';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import Markdown from 'react-markdown';
import { AssistantPhotoViewer } from '../Hire/AssistantHirePhotoPreview';
import { Skeleton } from '@/components/UI/skeleton';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/UI/scroll-area';
import { getTimezoneOffsetInMinutes, formatOffset } from '@/utils/assistants/timezone-utils';
import { Button } from '@/components/UI/button';
import { useAssistantSpending } from '@/hooks/Assistants/useAssistantSpending';
import { AssistantSpendingSection } from './AssistantSpendingSection';
import { SpendingDisplayProps } from '@/types/assistants/spending';

interface AssistantProfileInfoPanelProps {
  assistant: Assistant;
  userTimezone?: string | null;
  onEdit: () => void;
  /** Whether the current user can edit this assistant */
  canWrite?: boolean;
  /** Spending-related server actions (optional - if not provided, spending section is hidden) */
  spendingActions?: AssistantActions['spending'];
  /** Callback when spending display data changes (for spending gate) */
  onSpendingDisplayChange?: (display: SpendingDisplayProps | null) => void;
}

export function AssistantProfileInfoPanel({
  assistant,
  userTimezone,
  onEdit,
  canWrite = true,
  spendingActions,
  onSpendingDisplayChange,
}: AssistantProfileInfoPanelProps) {
  const [isVideoPopoverOpen, setIsVideoPopoverOpen] = React.useState(false);
  const [isVideoLoading, setIsVideoLoading] = React.useState(false);
  const videoLoadTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  // Spending data (only if actions are provided)
  const spendingData = useAssistantSpending(
    spendingActions
      ? {
          assistantId: assistant.agentId,
          getSpendAction: spendingActions.getSpend,
          getLimitAction: spendingActions.getLimit,
          setLimitAction: spendingActions.setLimit,
        }
      : {
          assistantId: '',
          getSpendAction: async () => ({ detail: 'disabled' }),
          getLimitAction: async () => ({ detail: 'disabled' }),
          setLimitAction: async () => ({ detail: 'disabled' }),
          enablePolling: false,
        }
  );

  // Notify parent of spending display changes (for spending gate)
  React.useEffect(() => {
    if (onSpendingDisplayChange) {
      onSpendingDisplayChange(spendingData.display);
    }
  }, [spendingData.display, onSpendingDisplayChange]);

  const photoSrc = assistant.signedProfilePhotoUrl || (assistant.profilePhoto ?? undefined);
  const videoSrc = assistant.signedProfileVideoUrl || (assistant.profileVideo ?? undefined);

  const cleanupVideoTimeout = React.useCallback(() => {
    if (videoLoadTimeoutRef.current) {
      clearTimeout(videoLoadTimeoutRef.current);
      videoLoadTimeoutRef.current = null;
    }
  }, []);

  const handlePopoverOpenChange = (open: boolean) => {
    setIsVideoPopoverOpen(open);
    if (open && videoSrc) {
      setIsVideoLoading(true);
      cleanupVideoTimeout(); // Clear any existing timeout
      // Set a new timeout
      videoLoadTimeoutRef.current = setTimeout(() => {
        setIsVideoLoading(false);
        setIsVideoPopoverOpen(false);
        toast.error('Video preview failed to load in time.');
      }, 5000);
    } else {
      // Cleanup on close
      setIsVideoLoading(false);
      cleanupVideoTimeout();
    }
  };

  const handleVideoCanPlay = () => {
    cleanupVideoTimeout();
    setIsVideoLoading(false);
  };

  const handleVideoError = () => {
    cleanupVideoTimeout();
    setIsVideoLoading(false);
    setIsVideoPopoverOpen(false);
    toast.error('Video preview failed to load.');
  };

  const timezoneInfo = React.useMemo(() => {
    if (!assistant.timezone) return { friendlyName: 'Not set', relativeOffsetString: null };

    const assistantOffset = getTimezoneOffsetInMinutes(assistant.timezone);
    const localTimezone = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localOffset = getTimezoneOffsetInMinutes(localTimezone);

    const offsetDiffHours = (assistantOffset - localOffset) / 60;

    let relativeOffsetString: string | null = null;
    relativeOffsetString = `${offsetDiffHours >= 0 ? '+' : ''}${offsetDiffHours}H`;

    const assistantUtcOffset = formatOffset(assistantOffset);
    const friendlyName = `UTC${assistantUtcOffset} ${assistant.timezone.split('/').pop()?.replace(/_/g, ' ')}`;

    return { friendlyName, relativeOffsetString };
  }, [assistant.timezone, userTimezone]);

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        {/* Profile Info Section */}
        <div className="flex items-start gap-4">
          <Popover open={isVideoPopoverOpen} onOpenChange={handlePopoverOpenChange}>
            <PopoverTrigger asChild>
              <div className="group relative flex-shrink-0 cursor-pointer">
                <AssistantPhotoViewer
                  photoUrl={photoSrc}
                  className="flex-shrink-0"
                  avatarClassName="h-20 w-20 sm:h-20 sm:w-20 group-data-[state=open]:grayscale"
                  fallbackText={`${assistant.firstName?.[0] ?? ''}${assistant.surname?.[0] ?? ''}`.toUpperCase()}
                />
                {isVideoPopoverOpen && isVideoLoading && (
                  <Skeleton className="absolute inset-0 z-10 h-20 w-20 rounded-lg sm:h-20 sm:w-20" />
                )}
                {videoSrc && (
                  <div className="bg-muted-foreground/20 absolute left-0 top-0 -z-10 h-full w-full -translate-x-2 -translate-y-2 transform rounded-lg transition-transform duration-200 ease-in-out group-data-[state=open]:translate-x-0 group-data-[state=open]:translate-y-0" />
                )}
              </div>
            </PopoverTrigger>
            {videoSrc && (
              <PopoverContent
                side="bottom"
                align="start"
                sideOffset={-120}
                alignOffset={-40}
                className="h-40 w-40 border-none bg-transparent p-0 shadow-none"
              >
                <video
                  key={videoSrc}
                  src={videoSrc}
                  autoPlay
                  playsInline
                  onEnded={() => handlePopoverOpenChange(false)}
                  onCanPlay={handleVideoCanPlay}
                  onError={handleVideoError}
                  className={cn(
                    'h-full w-full rounded-lg object-cover shadow-xl',
                    isVideoLoading && 'opacity-0'
                  )}
                />
              </PopoverContent>
            )}
          </Popover>

          <div className="grid max-w-xs flex-1 grid-cols-2 gap-y-0.5 py-0.5">
            <span className="text-caption font-bold">First Name</span>
            <span className="text-caption">{assistant.firstName}</span>
            <span className="text-caption font-bold">Last Name</span>
            <span className="text-caption">{assistant.surname}</span>
            <span className="text-caption font-bold">Age</span>
            <span className="text-caption">{assistant.age ?? 'N/A'}</span>
            <span className="text-caption font-bold">Nationality</span>
            <span className="text-caption">{assistant.nationality ?? 'N/A'}</span>
          </div>
        </div>

        {/* Timezone Section */}
        <div className="group/assistant-timezone pt-2">
          <h3 className="text-title">Timezone</h3>
          <div className="grid max-w-sm grid-cols-2 items-center">
            <span
              className={cn('text-caption', canWrite && 'cursor-pointer hover:underline')}
              onClick={canWrite ? onEdit : undefined}
            >
              {timezoneInfo.friendlyName}
            </span>
            {timezoneInfo.relativeOffsetString && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-caption mr-3 h-auto gap-1 px-2 py-1"
                      onClick={() => window.open('/profile', '_blank', 'noopener,noreferrer')}
                    >
                      {timezoneInfo.relativeOffsetString}
                      <Clock className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Assistant&apos;s time relative to yours</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* About Section */}
        <div className="group/assistant-about pt-2">
          <h3 className="text-title">About Me</h3>
          <div
            className={cn(
              'text-caption prose max-w-none prose-p:my-1',
              canWrite && 'hover:bg-muted/50 -m-1 cursor-pointer rounded-md p-1'
            )}
            onClick={canWrite ? onEdit : undefined}
          >
            <Markdown>{assistant.about || 'No description provided.'}</Markdown>
          </div>
        </div>

        {/* Spending Section (only shown if spending actions are provided) */}
        {spendingActions && (
          <div className="pt-2">
            <AssistantSpendingSection
              assistantId={assistant.agentId}
              assistantFirstName={assistant.firstName}
              display={spendingData.display}
              currentLimit={spendingData.limit?.monthlySpendingCap ?? null}
              currentMonth={spendingData.currentMonth}
              isLoading={spendingData.isLoading}
              isRefreshing={spendingData.isRefreshing}
              error={spendingData.error}
              onUpdateLimit={spendingData.updateLimit}
              onRefresh={spendingData.refreshAll}
              canEdit={canWrite}
            />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
