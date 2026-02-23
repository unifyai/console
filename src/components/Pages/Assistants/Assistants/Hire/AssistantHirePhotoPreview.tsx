'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { User, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/UI/skeleton';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { showErrorToast } from '@/components/Common/Toasts/notifications';

interface AssistantPhotoViewerProps {
  photoUrl?: string | null;
  videoUrl?: string | null;
  photoFile?: File | null;
  videoFile?: File | null;
  isPlayable?: boolean;
  fallbackText?: React.ReactNode;
  className?: string;
  avatarClassName?: string;
  disabled?: boolean;
  onClick?: () => void;
  shouldAutoplay?: boolean;
  onAutoplay?: (url: string) => void;
}

export function AssistantPhotoViewer({
  photoUrl,
  videoUrl,
  photoFile,
  videoFile,
  isPlayable = true,
  fallbackText = <User className="h-1/2 w-1/2" />,
  className,
  avatarClassName,
  disabled = false,
  onClick,
  shouldAutoplay = false,
  onAutoplay,
}: AssistantPhotoViewerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = React.useState(false);
  const [isVideoLoading, setIsVideoLoading] = React.useState(false);

  React.useEffect(() => {
    if (videoUrl) {
      setIsVideoLoading(true);
      setVideoError(false);
    } else {
      setIsVideoLoading(false);
      setVideoError(false);
    }
  }, [videoUrl]);

  const handleCanPlay = () => {
    setIsVideoLoading(false);
    if (shouldAutoplay && videoRef.current) {
      videoRef.current.play().catch((err) => {
        console.warn('Autoplay failed:', err);
      });
      if (onAutoplay && videoUrl) {
        onAutoplay(videoUrl);
      }
    }
  };

  const shouldRenderVideo = videoUrl && !videoError;
  const showDownloadButton = photoFile || videoFile;
  const hasClickAction = shouldRenderVideo || !!onClick;

  const handleClick = (e: React.MouseEvent) => {
    // If the click is on the download button, let its own handler (with stopPropagation) manage it.
    if ((e.target as HTMLElement).closest('button[aria-label*="Download"]')) {
      return;
    }

    if (disabled) return;

    // Try to play if possible and playable
    if (shouldRenderVideo && videoRef.current && isPlayable) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch((err) => console.warn('Play on click failed:', err));
      } else {
        videoRef.current.pause();
      }
    } else if (onClick) {
      // Otherwise, if there's an onClick action (like "Click to animate"), fire it
      onClick();
    }
  };

  const tooltipContent =
    shouldRenderVideo && isPlayable
      ? 'Click to play/pause animation'
      : onClick
        ? 'Click to animate'
        : 'No animation available';

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const fileToDownload = videoFile || photoFile;
    if (!fileToDownload) {
      showErrorToast('No downloadable file available.');
      return;
    }

    try {
      const objectUrl = URL.createObjectURL(fileToDownload);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileToDownload.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Error downloading media:', error);
      showErrorToast(`Could not download ${videoFile ? 'video' : 'image'}.`);
    }
  };

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex flex-col items-center gap-2',
              className,
              hasClickAction && !disabled && 'cursor-pointer'
            )}
            onClick={handleClick}
          >
            <div className="group relative">
              <div
                className={cn(
                  'flex h-44 w-44 items-center justify-center overflow-hidden rounded-lg',
                  photoUrl || videoUrl ? '!border-muted' : 'border-muted-foreground/30',
                  avatarClassName,
                  'relative'
                )}
              >
                {showDownloadButton && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="bg-background/50 hover:bg-background/80 absolute right-1.5 top-1 z-20 h-7 w-7 rounded-full p-1 backdrop-blur-sm"
                    onClick={handleDownload}
                    aria-label={videoFile ? 'Download Video' : 'Download Image'}
                    type="button"
                  >
                    <Download className="h-4 w-4 text-foreground" />
                  </Button>
                )}

                {isVideoLoading && videoUrl && (
                  <Skeleton className="absolute inset-0 z-10 h-full w-full animate-pulse rounded-lg bg-muted" />
                )}

                {shouldRenderVideo ? (
                  <video
                    key={videoUrl}
                    ref={videoRef}
                    src={videoUrl || undefined}
                    playsInline
                    className={cn(
                      'h-full w-full object-cover',
                      (isVideoLoading || !videoUrl) && 'opacity-0'
                    )}
                    poster={photoUrl || undefined}
                    onCanPlay={handleCanPlay}
                    onPlaying={() => setIsVideoLoading(false)}
                    onErrorCapture={() => {
                      setVideoError(true);
                      setIsVideoLoading(false);
                    }}
                  />
                ) : (
                  <Avatar className={cn('h-full w-full rounded-lg border-0', avatarClassName)}>
                    {photoUrl && (
                      <AvatarImage src={photoUrl} alt="Avatar Preview" className="object-cover" />
                    )}
                    <AvatarFallback
                      className={cn(
                        'text-caption flex flex-col items-center justify-center rounded-lg bg-transparent text-muted-foreground',
                        !photoUrl && 'bg-muted'
                      )}
                    >
                      {!photoUrl && (
                        <>
                          {' '}
                          {fallbackText} <span className="text-caption mt-1">No Photo</span>{' '}
                        </>
                      )}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            </div>
          </div>
        </TooltipTrigger>
        {hasClickAction && !disabled && (
          <TooltipContent side="top">
            <p>{tooltipContent}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
