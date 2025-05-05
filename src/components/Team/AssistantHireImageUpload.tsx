'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/UI/avatar";
import { Button } from "@/components/UI/button";
import { Upload, User, Trash2 } from "lucide-react";
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  previewUrl?: string | null;
  fallbackText?: React.ReactNode;
  onFileChange: (file: File | null) => void;
  onRemove: () => void; // Added callback for removal
  className?: string;
  avatarClassName?: string;
  disabled?: boolean; // Add disabled prop
}

export function ImageUpload({
  previewUrl,
  fallbackText = <User className="h-1/2 w-1/2" />,
  onFileChange,
  onRemove, // Destructure new prop
  className,
  avatarClassName,
  disabled = false, // Default to false
}: ImageUploadProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isHovering, setIsHovering] = React.useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return; // Prevent change if disabled
    const file = event.target.files?.[0] ?? null;
    onFileChange(file);
  };

  const handleUploadClick = () => {
    if (disabled) return; // Prevent click if disabled
    fileInputRef.current?.click();
  };

  const handleAvatarClick = () => {
    if (disabled) return; // Prevent click if disabled
    if (previewUrl) {
      onRemove();
      if (fileInputRef.current) {
          fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div
        className="relative group"
        onMouseEnter={() => !disabled && setIsHovering(true)} // Disable hover effect if disabled
        onMouseLeave={() => setIsHovering(false)}
      >
        <Avatar
          className={cn(
            "h-24 w-24 sm:h-28 sm:w-28 border transition-opacity",
             previewUrl && !disabled ? "cursor-pointer" : "cursor-default", // Only clickable if preview exists and not disabled
             disabled && "opacity-50", // Dim if disabled
             avatarClassName
          )}
          onClick={handleAvatarClick}
        >
          {/* ... AvatarImage, AvatarFallback ... */}
           {previewUrl && <AvatarImage src={previewUrl} alt="Avatar Preview" />}
          <AvatarFallback className="text-muted-foreground bg-muted flex items-center justify-center">
            {!previewUrl && fallbackText}
          </AvatarFallback>
        </Avatar>

        {/* Overlay shows only on hover when previewUrl exists AND not disabled */}
        {previewUrl && !disabled && (
          <div
            onClick={handleAvatarClick}
            className={cn(
              "absolute inset-0 bg-black/50 flex items-center justify-center rounded-full",
              "opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            )}
          >
            <Trash2 className="h-6 w-6 text-white" />
          </div>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
        disabled={disabled} // Disable file input
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleUploadClick}
        disabled={disabled} // Disable button
      >
        <Upload className="mr-2 h-4 w-4" />
        Upload Photo
      </Button>
    </div>
  );
}