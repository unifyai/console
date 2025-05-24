'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/UI/avatar";
import { ImagePlus, User } from "lucide-react"; 
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  previewUrl?: string | null;
  fallbackText?: React.ReactNode;
  onFileChange: (file: File | null) => void;
  className?: string;
  avatarClassName?: string;
  disabled?: boolean;
}

export function ImageUpload({
  previewUrl,
  fallbackText = <User className="h-1/2 w-1/2" />,
  onFileChange,
  className,
  avatarClassName,
  disabled = false,
}: ImageUploadProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isHovering, setIsHovering] = React.useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const file = event.target.files?.[0] ?? null;
    onFileChange(file); // Pass the selected file to the parent
  };

  const handleAvatarClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className="relative group cursor-pointer"
        onMouseEnter={() => !disabled && setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={handleAvatarClick} 
        title={disabled ? undefined : (previewUrl ? "Change photo" : "Upload photo")}
      >
        <Avatar
          className={cn(
            "h-24 w-24 sm:h-28 sm:w-28 border-2 border-dashed hover:border-primary dark:hover:border-primary-foreground transition-all", 
            disabled && "opacity-60 cursor-not-allowed hover:border-muted-foreground/30",
            isHovering && !disabled && "border-primary dark:border-primary-foreground brightness-90",
            previewUrl && "!border-muted hover:!border-primary dark:hover:!border-primary-foreground", // Solid border if image exists
            avatarClassName
          )}
        >
           {previewUrl && <AvatarImage src={previewUrl} alt="Avatar Preview" className="object-cover"/>}
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

        {!disabled && isHovering && ( // Show overlay only on hover and not disabled
          <div
            className={cn(
              "absolute inset-0 bg-black/40 flex items-center justify-center rounded-full",
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