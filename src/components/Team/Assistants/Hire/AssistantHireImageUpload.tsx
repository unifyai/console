'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/UI/avatar";
import { User } from "lucide-react"; 
import { cn } from '@/lib/utils';

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

  React.useEffect(() => {
    if (videoUrl) {
      setVideoError(false);
    }
  }, [videoUrl]);

  React.useEffect(() => {
    if (videoRef.current && !isPlayable) {
      videoRef.current.pause();
    }
  }, [isPlayable]);

  const shouldRenderVideo = videoUrl && !videoError;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className="relative group"
        title={disabled ? undefined : (previewUrl ? "Assistant photo preview" : "No photo")}
      >
        <div 
          className={cn(
              "h-24 w-24 sm:h-28 sm:w-28 rounded-full overflow-hidden border-2 border-dashed flex items-center justify-center",
              "transition-all",
              (previewUrl || shouldRenderVideo) && "!border-muted",
              avatarClassName
          )}
        >
          {shouldRenderVideo ? (
              <video
                  key={videoUrl}
                  ref={videoRef}
                  src={videoUrl}
                  autoPlay={isPlayable}
                  playsInline
                  className="w-full h-full object-cover"
                  poster={previewUrl || undefined}
                  onError={() => setVideoError(true)}
              />
          ) : (
            <Avatar className={cn("h-full w-full border-0", avatarClassName)}>
              {previewUrl && <AvatarImage src={previewUrl} alt="Avatar Preview" className="object-cover" />}
              <AvatarFallback className={cn(
                "text-muted-foreground bg-transparent flex flex-col items-center justify-center text-xs",
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