'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/UI/avatar";
import { User, Download } from "lucide-react";
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/UI/skeleton';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import { showErrorToast } from "@/components/Common/Toasts/notifications";

const getFilenameFromUrl = (url: string, defaultFilenameBase: string): string => {
    try {
        const newUrl = new URL(url);
        const pathname = newUrl.pathname;
        // Extract the last part of the pathname
        const filenameWithPath = pathname.substring(pathname.lastIndexOf('/') + 1);
        // Remove query parameters from the extracted filename part
        const filenameWithoutQuery = filenameWithPath.split('?')[0];
        if (filenameWithoutQuery && filenameWithoutQuery.includes('.')) {
            return filenameWithoutQuery;
        }
    } catch (e) { /* Fall through if URL parsing fails (e.g. blob) or no filename */ }
    
    // Basic extension extraction if path parsing failed or no proper filename
    const extensionMatch = url.match(/\.(jpg|jpeg|png|webp|gif|mp4|mov|avi|webm)(\?|$)/i);
    const extension = extensionMatch ? extensionMatch[0].split('?')[0] : '';
    return `${defaultFilenameBase}${extension}`;
};


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
}

export function AssistantPhotoViewer({
  photoUrl,
  videoUrl,
  photoFile,
  videoFile,
  isPlayable = false,
  fallbackText = <User className="h-1/2 w-1/2" />,
  className,
  avatarClassName,
  disabled = false,
  onClick,
}: AssistantPhotoViewerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = React.useState(false);
  const [isVideoLoading, setIsVideoLoading] = React.useState(!!videoUrl);
  const [hasPlayedOnce, setHasPlayedOnce] = React.useState(false);

  React.useEffect(() => {
    if (videoUrl) {
      if (!isVideoLoading) setIsVideoLoading(true);
      setVideoError(false);
      setHasPlayedOnce(false);
    } else {
      setIsVideoLoading(false);
      setVideoError(false);
    }
  }, [videoUrl]);

  // Effect for autoplaying or pausing based on isPlayable
  React.useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement && videoUrl && !videoError) {
      if (isPlayable && !hasPlayedOnce && videoElement.paused && !isVideoLoading) {
        videoElement.play()
          .then(() => setHasPlayedOnce(true))
          .catch(error => {
            console.warn("Autoplay/Programmatic play failed:", error);
          });
      } else if (!isPlayable && !videoElement.paused) {
        videoElement.pause();
      }
    } else if (videoElement && !videoElement.paused) {
        videoElement.pause();
    }
  }, [videoUrl, videoError, isPlayable, hasPlayedOnce, isVideoLoading]);

  const shouldRenderVideo = videoUrl && !videoError;
  const showDownloadButton = photoFile || videoFile;
  const hasClickAction = !!onClick && shouldRenderVideo;


  const handleMouseEnter = () => {
    if (videoRef.current && shouldRenderVideo && videoRef.current.ended) {
      videoRef.current.play().catch(e => console.warn("Replay on hover failed:", e));
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const fileToDownload = videoFile || photoFile;
    if (!fileToDownload) {
        showErrorToast("No downloadable file available.");
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
        console.error("Error downloading media:", error);
        showErrorToast(`Could not download ${videoFile ? 'video' : 'image'}.`);
    }
  };

  return (
    <div
      className={cn("flex flex-col items-center gap-2", className, hasClickAction && "cursor-pointer")}
      onMouseEnter={handleMouseEnter}
      onClick={hasClickAction ? onClick : undefined}
    >
      <div className="relative group">
        <div
          className={cn(
              "h-44 w-44 rounded-lg overflow-hidden border-2 border-dashed flex items-center justify-center",
              (photoUrl || videoUrl) ? "!border-muted" : "border-muted-foreground/30",
              avatarClassName, "relative"
          )}
        >
          {showDownloadButton && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-1 right-1.5 z-20 h-7 w-7 bg-background/50 hover:bg-background/80 backdrop-blur-sm p-1 rounded-full" 
                    onClick={handleDownload} 
                    aria-label={videoFile ? "Download Video" : "Download Image"} 
                    type="button"
                  >
                    <Download className="h-4 w-4 text-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{videoFile ? "Download Video" : "Download Image"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {isVideoLoading && videoUrl && (
            <Skeleton className="absolute inset-0 h-full w-full rounded-lg animate-pulse bg-muted z-10" />
          )}

          {shouldRenderVideo ? (
              <video
                  key={videoUrl}
                  ref={videoRef}
                  src={videoUrl || undefined}
                  playsInline
                  className={cn(
                    "w-full h-full object-cover", 
                    (isVideoLoading || !videoUrl) && "opacity-0"
                  )}
                  poster={photoUrl || undefined}
                  onCanPlay={() => {
                    setIsVideoLoading(false);
                    if (isPlayable && !hasPlayedOnce && videoRef.current?.paused) {
                        videoRef.current.play()
                          .then(() => setHasPlayedOnce(true))
                          .catch(e => console.warn("OnCanPlay play attempt failed", e));
                    }
                  }}
                  onPlaying={() => {
                    setIsVideoLoading(false);
                  }}
                  onErrorCapture={(e) => {
                    console.error("Video error event (capture):", e);
                    setVideoError(true);
                    setIsVideoLoading(false);
                  }}
              />
          ) : (
            <Avatar className={cn("h-full w-full border-0 rounded-lg", avatarClassName)}>
              {photoUrl && <AvatarImage src={photoUrl} alt="Avatar Preview" className="object-cover" />}
              <AvatarFallback className={cn(
                "text-muted-foreground bg-transparent flex flex-col items-center justify-center text-xs rounded-lg",
                !photoUrl && "bg-muted"
              )}>
                  {!photoUrl && (
                    <> 
                      {fallbackText}
                      <span className="mt-1 text-xs">No Photo</span> 
                    </>
                  )}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </div>
  );
}