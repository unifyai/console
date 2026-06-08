'use client';

import * as React from 'react';
import Image from 'next/image';
import { Copy, Check } from 'lucide-react';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Button } from '@/components/UI/button';
import Markdown from 'react-markdown';
import { AssistantPhotoViewer } from '../Hire/AssistantHirePhotoPreview';
import { Skeleton } from '@/components/UI/skeleton';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/UI/scroll-area';
import { fetchMediaSignedUrls } from '@/lib/client/assistant';
import { isGcsPhoto } from '@/utils/assistants/gcs-utils';
import { clientLog, flushClientLogs } from '@/lib/logging/client-log-buffer';
import { InfoSquareButton } from '@/components/UI/info-square-button';

import Link from 'next/link';
import { useAssistantSpending } from '@/hooks/Assistants/useAssistantSpending';
import { SpendingDisplayProps } from '@/types/assistants/spending';

const signedUrlCache = new Map<string, string>();
const VIDEO_PREVIEW_LOAD_TIMEOUT_MS = 20_000;

type VideoPreviewFailure = 'timeout' | 'load_error' | 'unavailable' | null;

function getVideoSourceDiagnostics(source: string | undefined): Record<string, unknown> {
  if (!source) {
    return { sourceType: 'none' };
  }

  if (source.startsWith('gs://')) {
    const parts = source.split('/');
    return {
      sourceType: 'gcs',
      bucket: parts[2] ?? null,
      pathTail: parts.slice(-2).join('/'),
    };
  }

  if (!source.startsWith('http://') && !source.startsWith('https://')) {
    return {
      sourceType: 'path',
      pathTail: source.split('/').slice(-2).join('/'),
    };
  }

  try {
    const parsedUrl = new URL(source);
    return {
      sourceType: 'url',
      host: parsedUrl.host,
      pathTail: parsedUrl.pathname.split('/').slice(-2).join('/'),
      hasQuery: parsedUrl.search.length > 0,
      signedUrlExpiresSec: parsedUrl.searchParams.get('X-Goog-Expires'),
      signedUrlDate: parsedUrl.searchParams.get('X-Goog-Date'),
      signedUrlHasSignature: parsedUrl.searchParams.has('X-Goog-Signature'),
    };
  } catch {
    return { sourceType: 'unparseable' };
  }
}

function getNetworkDiagnostics(): Record<string, unknown> {
  if (typeof navigator === 'undefined') {
    return {};
  }

  const connection = (
    navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
        saveData?: boolean;
      };
    }
  ).connection;

  return {
    userAgent: navigator.userAgent,
    connectionEffectiveType: connection?.effectiveType ?? null,
    connectionDownlinkMbps: connection?.downlink ?? null,
    connectionRttMs: connection?.rtt ?? null,
    connectionSaveData: connection?.saveData ?? null,
  };
}

function getVideoElementDiagnostics(
  videoElement: HTMLVideoElement | null
): Record<string, unknown> {
  const mediaError = videoElement?.error as (MediaError & { message?: string }) | null | undefined;
  const duration =
    videoElement && Number.isFinite(videoElement.duration)
      ? Number(videoElement.duration.toFixed(3))
      : null;
  const currentTime = videoElement ? Number(videoElement.currentTime.toFixed(3)) : null;

  return {
    readyState: videoElement?.readyState ?? null,
    networkState: videoElement?.networkState ?? null,
    currentTime,
    duration,
    errorCode: mediaError?.code ?? null,
    errorMessage: mediaError?.message ?? null,
  };
}

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

function getInitialVideoSrc(assistant: Assistant): string | undefined {
  if (assistant.signedProfileVideoUrl) {
    return assistant.signedProfileVideoUrl;
  }
  const videoPath = assistant.profileVideo ?? undefined;
  if (videoPath && !isGcsPhoto(videoPath)) {
    return videoPath;
  }
  return undefined;
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
  const [videoPreviewFailure, setVideoPreviewFailure] = React.useState<VideoPreviewFailure>(null);
  const [isIdCopied, setIsIdCopied] = React.useState(false);
  const [videoSrc, setVideoSrc] = React.useState<string | undefined>(() =>
    getInitialVideoSrc(assistant)
  );
  const videoLoadTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const videoElementRef = React.useRef<HTMLVideoElement | null>(null);
  const videoLoadStartRef = React.useRef<number | null>(null);
  const videoOpenRequestIdRef = React.useRef(0);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const resolvedSupervisorImage = useResolvedImageUrl(assistant.userImage);

  const logVideoPreview = React.useCallback(
    (event: string, data?: Record<string, unknown>) => {
      clientLog(`VIDEO_PREVIEW_${event}`, {
        assistantId: assistant.agentId,
        assistantOwnerId: assistant.userId,
        profileVideoRef: getVideoSourceDiagnostics(assistant.profileVideo ?? undefined),
        ...(data ?? {}),
      });
    },
    [assistant.agentId, assistant.profileVideo, assistant.userId]
  );

  // Spending data (only if actions are provided)
  const spendingData = useAssistantSpending(
    spendingActions
      ? {
          assistantId: assistant.agentId,
          setLimitAction: spendingActions.setLimit,
        }
      : {
          assistantId: '',
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
  const hasVideo = Boolean(assistant.profileVideo || assistant.signedProfileVideoUrl);

  const cleanupVideoTimeout = React.useCallback(() => {
    if (videoLoadTimeoutRef.current) {
      clearTimeout(videoLoadTimeoutRef.current);
      videoLoadTimeoutRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    setVideoSrc(getInitialVideoSrc(assistant));
    setVideoPreviewFailure(null);
    setIsVideoLoading(false);
    videoLoadStartRef.current = null;
    cleanupVideoTimeout();
  }, [assistant, cleanupVideoTimeout]);

  React.useEffect(() => cleanupVideoTimeout, [cleanupVideoTimeout]);

  const resolveFreshVideoSrc = React.useCallback(async (): Promise<string | undefined> => {
    const profileVideo = assistant.profileVideo;
    if (!profileVideo) {
      return videoSrc;
    }
    if (!isGcsPhoto(profileVideo)) {
      return profileVideo;
    }
    const signedUrlMap = await fetchMediaSignedUrls([profileVideo], {
      onDiagnostic: (diagnostic) => {
        logVideoPreview('BATCH_URLS', {
          requestedPath: getVideoSourceDiagnostics(profileVideo),
          ...diagnostic,
        });
      },
    });
    const refreshedVideoSrc = signedUrlMap[profileVideo];
    if (refreshedVideoSrc) {
      setVideoSrc(refreshedVideoSrc);
      return refreshedVideoSrc;
    }
    return assistant.signedProfileVideoUrl ?? undefined;
  }, [assistant.profileVideo, assistant.signedProfileVideoUrl, logVideoPreview, videoSrc]);

  const closeVideoPreview = React.useCallback(
    (reason: string) => {
      videoOpenRequestIdRef.current += 1;
      setIsVideoPopoverOpen(false);
      setIsVideoLoading(false);
      setVideoPreviewFailure(null);
      videoLoadStartRef.current = null;
      cleanupVideoTimeout();
      logVideoPreview('CLOSED', { reason });
    },
    [cleanupVideoTimeout, logVideoPreview]
  );

  const startVideoPreviewLoad = React.useCallback(
    async (trigger: 'open' | 'retry') => {
      const requestId = videoOpenRequestIdRef.current + 1;
      videoOpenRequestIdRef.current = requestId;

      setIsVideoPopoverOpen(true);
      setIsVideoLoading(true);
      setVideoPreviewFailure(null);
      cleanupVideoTimeout();
      videoLoadStartRef.current = null;

      const resolveStartMs = Date.now();
      logVideoPreview('OPEN_REQUESTED', {
        requestId,
        trigger,
        hasVideo,
        profileVideoIsGcs: Boolean(assistant.profileVideo && isGcsPhoto(assistant.profileVideo)),
        existingSource: getVideoSourceDiagnostics(videoSrc),
        ...getNetworkDiagnostics(),
      });

      let nextVideoSrc: string | undefined;
      try {
        nextVideoSrc = await resolveFreshVideoSrc();
      } catch (error) {
        logVideoPreview('RESOLVE_ERROR', {
          requestId,
          trigger,
          error: error instanceof Error ? error.message : 'Unknown resolve error',
        });
        nextVideoSrc = undefined;
      }

      if (videoOpenRequestIdRef.current !== requestId) {
        logVideoPreview('STALE_REQUEST_IGNORED', { requestId, trigger });
        return;
      }

      if (!nextVideoSrc) {
        setIsVideoLoading(false);
        setVideoPreviewFailure('unavailable');
        logVideoPreview('SOURCE_UNAVAILABLE', {
          requestId,
          trigger,
          resolveElapsedMs: Date.now() - resolveStartMs,
          profileVideo: assistant.profileVideo ?? null,
          signedProfileVideoUrl: assistant.signedProfileVideoUrl ?? null,
        });
        flushClientLogs();
        toast.error('Video preview is unavailable.');
        return;
      }

      setVideoSrc(nextVideoSrc);
      videoLoadStartRef.current = Date.now();
      const resolutionStrategy = !assistant.profileVideo
        ? 'existing_video_src'
        : !isGcsPhoto(assistant.profileVideo)
          ? 'direct_profile_video'
          : nextVideoSrc === assistant.signedProfileVideoUrl
            ? 'fallback_signed_profile_video'
            : 'refreshed_batch_signed_url';
      logVideoPreview('SOURCE_READY', {
        requestId,
        trigger,
        resolutionStrategy,
        resolveElapsedMs: Date.now() - resolveStartMs,
        source: getVideoSourceDiagnostics(nextVideoSrc),
      });

      videoLoadTimeoutRef.current = setTimeout(() => {
        if (videoOpenRequestIdRef.current !== requestId) return;
        setIsVideoLoading(false);
        setVideoPreviewFailure('timeout');
        logVideoPreview('TIMEOUT', {
          requestId,
          trigger,
          timeoutMs: VIDEO_PREVIEW_LOAD_TIMEOUT_MS,
          loadElapsedMs: videoLoadStartRef.current ? Date.now() - videoLoadStartRef.current : null,
          source: getVideoSourceDiagnostics(nextVideoSrc),
          videoElement: getVideoElementDiagnostics(videoElementRef.current),
        });
        flushClientLogs();
        toast.info('Video preview is taking longer than expected. Retry if needed.');
      }, VIDEO_PREVIEW_LOAD_TIMEOUT_MS);
    },
    [
      assistant.profileVideo,
      assistant.signedProfileVideoUrl,
      cleanupVideoTimeout,
      hasVideo,
      logVideoPreview,
      resolveFreshVideoSrc,
      videoSrc,
    ]
  );

  const handlePopoverOpenChange = (open: boolean) => {
    if (!open) {
      closeVideoPreview('manual_close');
      return;
    }
    if (!hasVideo) {
      logVideoPreview('OPEN_BLOCKED_NO_VIDEO');
      return;
    }
    void startVideoPreviewLoad('open');
  };

  const markVideoReady = React.useCallback(
    (event: 'CAN_PLAY' | 'LOADED_DATA' | 'LOADED_METADATA') => {
      cleanupVideoTimeout();
      setIsVideoLoading(false);
      setVideoPreviewFailure(null);
      logVideoPreview(event, {
        loadElapsedMs: videoLoadStartRef.current ? Date.now() - videoLoadStartRef.current : null,
        source: getVideoSourceDiagnostics(videoSrc),
        videoElement: getVideoElementDiagnostics(videoElementRef.current),
      });
    },
    [cleanupVideoTimeout, logVideoPreview, videoSrc]
  );

  const handleVideoCanPlay = () => markVideoReady('CAN_PLAY');
  const handleVideoLoadedData = () => markVideoReady('LOADED_DATA');
  const handleVideoLoadedMetadata = () => markVideoReady('LOADED_METADATA');

  const handleVideoError = () => {
    cleanupVideoTimeout();
    setIsVideoLoading(false);
    setVideoPreviewFailure('load_error');
    logVideoPreview('ERROR', {
      source: getVideoSourceDiagnostics(videoSrc),
      videoElement: getVideoElementDiagnostics(videoElementRef.current),
      ...getNetworkDiagnostics(),
    });
    flushClientLogs();
    toast.error('Video preview failed to load.');
  };

  const handleRetryVideoPreview = () => {
    logVideoPreview('RETRY_CLICKED', {
      previousFailure: videoPreviewFailure,
      source: getVideoSourceDiagnostics(videoSrc),
    });
    void startVideoPreviewLoad('retry');
  };

  const previewFailureMessage =
    videoPreviewFailure === 'timeout'
      ? 'Video is taking longer than expected to become playable.'
      : videoPreviewFailure === 'load_error'
        ? 'Video failed to load in this browser session.'
        : 'Could not retrieve a valid preview URL.';

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        {/* Profile Info Section */}
        <div className="flex items-start gap-4">
          <Popover open={isVideoPopoverOpen} onOpenChange={handlePopoverOpenChange}>
            <PopoverTrigger asChild>
              <div
                className={cn(
                  'group relative flex-shrink-0',
                  hasVideo ? 'cursor-pointer' : 'cursor-default'
                )}
              >
                <AssistantPhotoViewer
                  photoUrl={photoSrc}
                  className="flex-shrink-0"
                  avatarClassName="h-20 w-20 sm:h-20 sm:w-20 group-data-[state=open]:grayscale"
                  fallbackText={`${assistant.firstName?.[0] ?? ''}${assistant.surname?.[0] ?? ''}`.toUpperCase()}
                />
                {isVideoPopoverOpen && isVideoLoading && (
                  <Skeleton className="absolute inset-0 z-10 h-20 w-20 rounded-lg sm:h-20 sm:w-20" />
                )}
                {hasVideo && (
                  <div className="bg-muted-foreground/20 absolute left-0 top-0 -z-10 h-full w-full -translate-x-2 -translate-y-2 transform rounded-lg transition-transform duration-200 ease-in-out group-data-[state=open]:translate-x-0 group-data-[state=open]:translate-y-0" />
                )}
              </div>
            </PopoverTrigger>
            {hasVideo && (
              <PopoverContent
                side="bottom"
                align="start"
                sideOffset={-120}
                alignOffset={-40}
                className="h-40 w-40 border-none bg-transparent p-0 shadow-none"
              >
                <div className="relative h-40 w-40 overflow-hidden rounded-lg shadow-xl">
                  {videoSrc ? (
                    <video
                      key={videoSrc}
                      ref={videoElementRef}
                      src={videoSrc}
                      autoPlay
                      playsInline
                      onEnded={() => closeVideoPreview('ended')}
                      onCanPlay={handleVideoCanPlay}
                      onLoadedData={handleVideoLoadedData}
                      onLoadedMetadata={handleVideoLoadedMetadata}
                      onError={handleVideoError}
                      className={cn('h-full w-full object-cover', isVideoLoading && 'opacity-0')}
                    />
                  ) : (
                    <div className="bg-muted/60 flex h-full w-full items-center justify-center p-2 text-center">
                      <span className="text-caption text-muted-foreground">
                        Preparing video preview...
                      </span>
                    </div>
                  )}

                  {isVideoLoading && (
                    <Skeleton className="absolute inset-0 z-10 h-full w-full rounded-lg" />
                  )}

                  {videoPreviewFailure && (
                    <div className="bg-background/90 absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 p-2 text-center">
                      <p className="text-caption text-muted-foreground">{previewFailureMessage}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={handleRetryVideoPreview}
                      >
                        Retry
                      </Button>
                    </div>
                  )}
                </div>
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
                      <Check className="h-3 w-3 text-[color:var(--status-success)]" />
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
                    <InfoSquareButton />
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
