'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/UI/avatar";
import { ImagePlus, User, MessageSquare } from "lucide-react"; 
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';

interface ImageUploadProps {
  previewUrl?: string | null;
  videoUrl?: string | null;
  isPlayable?: boolean;
  fallbackText?: React.ReactNode;
  onFileChange: (file: File | null) => void;
  className?: string;
  avatarClassName?: string;
  disabled?: boolean;
}

export function ImageUpload({
  previewUrl,
  videoUrl,
  isPlayable = false,
  fallbackText = <User className="h-1/2 w-1/2" />,
  onFileChange,
  className,
  avatarClassName,
  disabled = false,
}: ImageUploadProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = React.useState(false);
  const [videoError, setVideoError] = React.useState(false);

  React.useEffect(() => {
    // Reset error when videoUrl changes, which happens on preset selection.
    if (videoUrl) {
      setVideoError(false);
    }
  }, [videoUrl]);

  React.useEffect(() => {
    // Explicitly pause the video if it becomes non-playable while it's running
    if (videoRef.current && !isPlayable) {
      videoRef.current.pause();
    }
  }, [isPlayable]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const file = event.target.files?.[0] ?? null;
    onFileChange(file); // Pass the selected file to the parent
  };

  const handleContainerClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  const shouldRenderVideo = videoUrl && !videoError;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className="relative group"
        onMouseEnter={() => !disabled && setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        title={disabled ? undefined : (previewUrl ? "Change photo" : "Upload photo")}
      >
        <div 
          onClick={handleContainerClick} 
          className={cn(
              "h-24 w-24 sm:h-28 sm:w-28 rounded-full overflow-hidden border-2 border-dashed flex items-center justify-center cursor-pointer",
              "hover:border-primary dark:hover:border-primary-foreground transition-all",
              disabled && "opacity-60 cursor-not-allowed hover:border-muted-foreground/30",
              (previewUrl || shouldRenderVideo) && "!border-muted hover:!border-primary dark:hover:!border-primary-foreground",
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
                !previewUrl && "bg-muted" // Only show bg-muted if no preview
              )}>
                  {!previewUrl && (
                      <>
                          {fallbackText}
                          <span className="mt-1 text-xs">Upload</span>
                      </>
                  )}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        {/* Upload Overlay */}
        {!disabled && isHovering && (
            <div
              onClick={handleContainerClick}
              className={cn(
                "absolute inset-0 bg-black/40 flex items-center justify-center rounded-full cursor-pointer",
                "opacity-0 group-hover:opacity-100 transition-opacity"
              )}
            >
              <ImagePlus className="h-7 w-7 text-white" />
            </div>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
}