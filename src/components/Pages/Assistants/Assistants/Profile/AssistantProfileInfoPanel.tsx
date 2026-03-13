'use client';

import * as React from 'react';
import Image from 'next/image';
import { Info, Copy, Check } from 'lucide-react';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import Markdown from 'react-markdown';
import { AssistantPhotoViewer } from '../Hire/AssistantHirePhotoPreview';
import { Skeleton } from '@/components/UI/skeleton';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/UI/scroll-area';

import Link from 'next/link';
import { useAssistantSpending } from '@/hooks/Assistants/useAssistantSpending';
import { SpendingDisplayProps } from '@/types/assistants/spending';

const signedUrlCache = new Map<string, string>();

function useResolvedImageUrl(image: string | null | undefined): string | null {
  const cached = image
    ? (signedUrlCache.get(image) ?? (image.startsWith('gs://') ? null : image))
    : null;
  const [url, setUrl] = React.useState<string | null>(cached);

  React.useEffect(() => {
    if (!image) {
      setUrl(null);
      return;
    }
    if (signedUrlCache.has(image)) {
      setUrl(signedUrlCache.get(image)!);
      return;
    }
    if (!image.startsWith('gs://')) {
      setUrl(image);
      return;
    }
    let cancelled = false;
    fetch('/api/storage/signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // eslint-disable-next-line @typescript-eslint/naming-convention
      body: JSON.stringify({ gs_url: image }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.signed_url) {
          signedUrlCache.set(image, data.signed_url);
          setUrl(data.signed_url);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [image]);

  return url;
}

interface AssistantProfileInfoPanelProps {
  assistant: Assistant;
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
  onEdit,
  canWrite = true,
  spendingActions,
  onSpendingDisplayChange,
}: AssistantProfileInfoPanelProps) {
  const [isVideoPopoverOpen, setIsVideoPopoverOpen] = React.useState(false);
  const [isVideoLoading, setIsVideoLoading] = React.useState(false);
  const [isIdCopied, setIsIdCopied] = React.useState(false);
  const videoLoadTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const resolvedSupervisorImage = useResolvedImageUrl(assistant.userImage);

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

          <div className="grid max-w-xs flex-1 grid-cols-2 py-0.5">
            <span className="text-caption font-bold">First Name</span>
            <span className="text-caption">{assistant.firstName}</span>
            <span className="text-caption font-bold">Last Name</span>
            <span className="text-caption">{assistant.surname}</span>
            <span className="text-caption font-bold">Age</span>
            <span className="text-caption">{assistant.age ?? 'N/A'}</span>
            <span className="text-caption font-bold">Nationality</span>
            <span className="text-caption">{assistant.nationality ?? 'N/A'}</span>
            <span className="text-caption font-bold">ID</span>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="text-caption group/id flex cursor-pointer items-center gap-1"
                    onClick={() => {
                      navigator.clipboard.writeText(assistant.agentId);
                      setIsIdCopied(true);
                      setTimeout(() => setIsIdCopied(false), 2000);
                    }}
                  >
                    {isIdCopied ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3 text-muted-foreground transition-colors group-hover/id:text-foreground" />
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>
                    Click to copy assistant ID. Used for programmatic integration, see{' '}
                    <a
                      href="https://docs.unify.ai/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      docs
                    </a>
                    .
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Supervisor Section */}
        {assistant.organizationId && (
          <div className="pt-2">
            <div className="flex items-center gap-1.5">
              <h3 className="text-title">Supervisor</h3>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p>
                      {assistant.firstName} directly reports to{' '}
                      {[assistant.userFirstName, assistant.userLastName]
                        .filter(Boolean)
                        .join(' ') || 'their supervisor'}
                      . The tasks {assistant.firstName} can and cannot assist with are at the
                      discretion of{' '}
                      {[assistant.userFirstName, assistant.userLastName]
                        .filter(Boolean)
                        .join(' ') || 'their supervisor'}
                      .
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Link
              href="/organizations?tab=members"
              className="flex items-center gap-1.5 hover:underline"
            >
              {assistant.userImage && (
                <span className="inline-block h-4 w-4 flex-shrink-0">
                  {resolvedSupervisorImage && (
                    <Image
                      src={resolvedSupervisorImage}
                      alt=""
                      width={16}
                      height={16}
                      className="h-4 w-4 rounded-full object-cover"
                      unoptimized
                    />
                  )}
                </span>
              )}
              <span className="text-caption">
                {[assistant.userFirstName, assistant.userLastName].filter(Boolean).join(' ') ||
                  'N/A'}
              </span>
            </Link>
          </div>
        )}

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
      </ScrollArea>
    </div>
  );
}
