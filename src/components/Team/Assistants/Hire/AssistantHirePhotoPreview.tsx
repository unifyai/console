'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/UI/avatar";
import { User, Download } from "lucide-react";
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/UI/skeleton';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";

// Use the File's name if available, otherwise fallback
const getFilenameForDownload = (file: File | null, fallbackUrl?: string | null): string => {
  if (file && file.name) {
    return file.name;
  }
  if (fallbackUrl && fallbackUrl.startsWith('blob:')) {
    return 'preview-image.png'; // Generic for blobs if no file object
  }
  if (fallbackUrl) {
    try {
      const pathname = new URL(fallbackUrl).pathname;
      const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
      if (filename && filename.includes('.')) {
        return filename;
      }
      const extensionMatch = fallbackUrl.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i);
      const extension = extensionMatch ? extensionMatch[0].split('?')[0] : '.jpg';
      return `downloaded-image${extension}`;
    } catch (e) {
      // console.warn("Could not parse URL to get filename:", fallbackUrl, e);
    }
  }
  return 'downloaded-image.jpg'; // Ultimate fallback
};

interface ImageUploadProps {
  previewUrl?: string | null;
  videoUrl?: string | null;
  imageFile?: File | null;
  isPlayable?: boolean;
  fallbackText?: React.ReactNode;
  className?: string;
  avatarClassName?: string;
  disabled?: boolean;
}

export function ImageUpload({
  previewUrl,
  videoUrl,
  imageFile,
  isPlayable = false,
  fallbackText = <User className="h-1/2 w-1/2" />,
  className,
  avatarClassName,
  disabled = false,
}: ImageUploadProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = React.useState(false);
  const [isVideoLoading, setIsVideoLoading] = React.useState(!!videoUrl);
  const [hasPlayedOnce, setHasPlayedOnce] = React.useState(false);

  // Effect to manage loading state when videoUrl changes
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
  }, [videoUrl, videoError, isPlayable, isVideoLoading, hasPlayedOnce]);

  const shouldRenderVideo = videoUrl && !videoError;
  const showDownloadButton = imageFile && !isVideoLoading;

  const handleMouseEnter = () => {
    if (videoRef.current && shouldRenderVideo && videoRef.current.ended) {
      videoRef.current.play().catch(error => {
        console.warn("Could not replay video on hover:", error);
      });
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!imageFile) { // If there's no File object, we can't reliably download a blob
        console.warn("Download attempted without an imageFile for blob URL.");
        return;
    }

    // Create a new object URL from the actual File object for downloading
    // This ensures the browser has the correct file type and data.
    const downloadUrl = URL.createObjectURL(imageFile);
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = getFilenameForDownload(imageFile, previewUrl);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Revoke the *newly created* object URL used for download, not the previewUrl
    URL.revokeObjectURL(downloadUrl); 
  };

  return (
    <div 
      className={cn("flex flex-col items-center gap-2", className)}
      onMouseEnter={handleMouseEnter}
    >
      <div
        className="relative group"
      >
        <div 
          className={cn(
              "h-44 w-44 rounded-lg overflow-hidden border-2 border-dashed flex items-center justify-center",
              (previewUrl || shouldRenderVideo) ? "!border-muted" : "border-muted-foreground/30",
              avatarClassName,
              "relative" 
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
                    aria-label="Download Image"
                    type="button"
                  >
                    <Download className="h-4 w-4 text-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Download Image</p>
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
                  src={videoUrl}
                  playsInline
                  className={cn(
                    "w-full h-full object-cover",
                    (isVideoLoading || !videoUrl) && "opacity-0" 
                  )}
                  poster={(!isVideoLoading && previewUrl) ? previewUrl : undefined}
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
              {previewUrl && <AvatarImage src={previewUrl} alt="Avatar Preview" className="object-cover" />}
              <AvatarFallback className={cn(
                "text-muted-foreground bg-transparent flex flex-col items-center justify-center text-xs rounded-lg",
                !previewUrl && "bg-muted" 
              )}>
                  {!previewUrl && ( 
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