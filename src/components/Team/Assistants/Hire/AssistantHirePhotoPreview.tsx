'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/UI/avatar";
import { User } from "lucide-react"; 
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/UI/skeleton';

interface ImageUploadProps {
  previewUrl?: string | null;
  videoUrl?: string | null;
  isPlayable?: boolean;
  fallbackText?: React.ReactNode;
  className?: string;
  avatarClassName?: string;
  disabled?: boolean;
}

export function ImageUpload({
  previewUrl,
  videoUrl,
  isPlayable = false,
  fallbackText = <User className="h-1/2 w-1/2" />,
  className,
  avatarClassName,
  disabled = false,
}: ImageUploadProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = React.useState(false);
  // Initialize isVideoLoading to true if videoUrl is present on mount,
  // primarily to handle the initial state correctly before effects run.
  const [isVideoLoading, setIsVideoLoading] = React.useState(!!videoUrl);
  const [hasPlayedOnce, setHasPlayedOnce] = React.useState(false);

  // Effect to manage loading state when videoUrl changes
  React.useEffect(() => {
    if (videoUrl) {
      // If videoUrl is present (or changes to a new one), ensure loading state is active.
      // This also handles cases where the component might re-render without videoUrl initially,
      // and then videoUrl is provided later.
      if (!isVideoLoading) setIsVideoLoading(true); // Set loading if not already true
      setVideoError(false); // Reset error for new video
      setHasPlayedOnce(false); // Reset play state for new video
      // videoRef.current?.load(); // Usually not needed due to key on video
    } else {
      // If videoUrl is removed, reset loading and error states.
      setIsVideoLoading(false);
      setVideoError(false);
    }
  }, [videoUrl]); // Rerun when videoUrl changes

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
        videoElement.pause(); // Ensure video is paused if src removed or error
    }
  }, [videoUrl, videoError, isPlayable, isVideoLoading, hasPlayedOnce]);


  const shouldRenderVideo = videoUrl && !videoError;

  const handleMouseEnter = () => {
    if (videoRef.current && shouldRenderVideo && videoRef.current.ended) {
      videoRef.current.play().catch(error => {
        console.warn("Could not replay video on hover:", error);
      });
    }
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
          {/* Skeleton Loader: Rendered when isVideoLoading is true AND a videoUrl is present. */}
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
                    // Hide the video element itself (not just its content) if skeleton is active
                    // to prevent its own poster/first-frame from flashing.
                    (isVideoLoading || !videoUrl) && "opacity-0" 
                  )}
                  // Poster is only shown if not loading AND a previewUrl exists.
                  // This prevents the poster from flashing if isVideoLoading is true.
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
                    setIsVideoLoading(false); // Ensure loading is false when actually playing
                  }}
                  onErrorCapture={(e) => { // Using onErrorCapture for better reliability with React
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