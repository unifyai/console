'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/UI/avatar";
import { User, Download } from "lucide-react";
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/UI/skeleton';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import { toast } from "sonner";

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
    const extension = extensionMatch ? extensionMatch[0].split('?')[0] : ''; // Get extension including dot
    return `${defaultFilenameBase}${extension}`; // e.g. downloaded-video.mp4
};


interface ImageUploadProps {
  previewUrl?: string | null; // Can be blob URL for image/video, or remote URL for image
  videoUrl?: string | null;   // Remote URL for video (e.g., from preset or if animation result is not downloaded)
  imageFile?: File | null;    // The actual File object (image or video)
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
  const [isVideoLoading, setIsVideoLoading] = React.useState(!!(videoUrl || (imageFile && imageFile.type.startsWith('video/'))));
  const [hasPlayedOnce, setHasPlayedOnce] = React.useState(false);

  const isImageFileVideo = imageFile && imageFile.type.startsWith('video/');
  const videoSource = isImageFileVideo ? previewUrl : videoUrl; // Prioritize local blob video if imageFile is a video

  // Effect to manage loading state when videoSource changes
  React.useEffect(() => {
    if (videoSource) {
      if (!isVideoLoading) setIsVideoLoading(true);
      setVideoError(false);
      setHasPlayedOnce(false);
    } else {
      setIsVideoLoading(false);
      setVideoError(false);
    }
  }, [videoSource]);

  // Effect for autoplaying or pausing based on isPlayable
  React.useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement && videoSource && !videoError) {
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
  }, [videoSource, videoError, isPlayable, isVideoLoading, hasPlayedOnce]);

  const shouldRenderVideo = videoSource && !videoError;
  const showDownloadButton = (imageFile || videoSource) && !isVideoLoading;


  const handleMouseEnter = () => {
    if (videoRef.current && shouldRenderVideo && videoRef.current.ended) {
      videoRef.current.play().catch(error => {
        console.warn("Could not replay video on hover:", error);
      });
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    let sourceToDownload: File | string | null = null;
    let filenameForDownload: string = 'download';

    if (imageFile) { // Prioritize local File object (could be an image or a video)
        sourceToDownload = imageFile;
        filenameForDownload = imageFile.name;
    } else if (videoUrl) { // Then remote video URL (if imageFile is not set or not a video)
        sourceToDownload = videoUrl;
        filenameForDownload = getFilenameFromUrl(videoUrl, 'downloaded-video');
    } else if (previewUrl && !previewUrl.startsWith('blob:')) { // Then remote image URL
        sourceToDownload = previewUrl;
        filenameForDownload = getFilenameFromUrl(previewUrl, 'downloaded-image');
    }

    if (!sourceToDownload) {
        console.warn("Download attempted without a downloadable source.");
        toast.warning("No downloadable content available.");
        return;
    }

    try {
        let blobToDownload: Blob;
        if (sourceToDownload instanceof File) {
            blobToDownload = sourceToDownload;
        } else { // It's a URL string, fetch it
             const response = await fetch(sourceToDownload);
             if (!response.ok) {
                 const errorText = await response.text();
                 console.error("Failed to fetch media for download:", response.status, errorText);
                 throw new Error(`Failed to fetch media: ${response.statusText}`);
             }
             blobToDownload = await response.blob();
        }

        const objectUrl = URL.createObjectURL(blobToDownload);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filenameForDownload;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl); // Clean up the object URL

    } catch (error) {
        console.error("Error downloading media:", error);
        // Determine if it was likely a video or image based on original sources
        const wasVideo = (imageFile && imageFile.type.startsWith('video/')) || videoUrl;
        toast.error(`Could not download ${wasVideo ? 'video' : 'image'}.`);
    }
  };
  
  // Determine poster: if current preview is an image (not a video blob), use it.
  const posterUrl = (imageFile && !isImageFileVideo && previewUrl) ? previewUrl :
                    (!imageFile && previewUrl && !videoSource) ? previewUrl : undefined;


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
              (previewUrl || videoSource) ? "!border-muted" : "border-muted-foreground/30",
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
                    aria-label={(imageFile && isImageFileVideo) || videoUrl ? "Download Video" : "Download Image"}
                    type="button"
                  >
                    <Download className="h-4 w-4 text-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{(imageFile && isImageFileVideo) || videoUrl ? "Download Video" : "Download Image"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {isVideoLoading && videoSource && (
            <Skeleton className="absolute inset-0 h-full w-full rounded-lg animate-pulse bg-muted z-10" />
          )}

          {shouldRenderVideo ? (
              <video
                  key={videoSource} 
                  ref={videoRef}
                  src={videoSource || undefined} // Ensure src is string | undefined
                  playsInline
                  className={cn(
                    "w-full h-full object-cover",
                    (isVideoLoading || !videoSource) && "opacity-0" 
                  )}
                  poster={posterUrl}
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