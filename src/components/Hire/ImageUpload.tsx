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
}

export function ImageUpload({
  previewUrl,
  fallbackText = <User className="h-1/2 w-1/2" />,
  onFileChange,
  onRemove, // Destructure new prop
  className,
  avatarClassName
}: ImageUploadProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isHovering, setIsHovering] = React.useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    onFileChange(file);
  };

  // This specifically triggers the file input
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // This handles clicking on the avatar itself (for removal)
  const handleAvatarClick = () => {
    if (previewUrl) {
      onRemove(); // Call the remove callback if an image exists
      // Reset the file input value in case the user wants to upload the same file again
      if (fileInputRef.current) {
          fileInputRef.current.value = "";
      }
    } else {
      // Optionally, trigger upload if clicking the placeholder
      // handleUploadClick();
    }
  };

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* Added relative positioning and hover handlers */}
      <div
        className="relative group" // Use group for hover state propagation
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <Avatar
          className={cn(
            "h-24 w-24 sm:h-28 sm:w-28 border transition-opacity",
             // Make avatar clickable only for removal, not file dialog trigger
             previewUrl ? "cursor-pointer" : "cursor-default",
             avatarClassName
          )}
          onClick={handleAvatarClick} // Use specific handler for avatar click
        >
          {previewUrl && <AvatarImage src={previewUrl} alt="Avatar Preview" />}
          <AvatarFallback className="text-muted-foreground bg-muted flex items-center justify-center">
            {!previewUrl && fallbackText}
          </AvatarFallback>
        </Avatar>

        {/* Overlay with Trash Icon - shows only on hover when previewUrl exists */}
        {previewUrl && (
          <div
            onClick={handleAvatarClick} // Also trigger remove on overlay click
            className={cn(
              "absolute inset-0 bg-black/50 flex items-center justify-center rounded-full", // Match Avatar shape
              "opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" // Show on hover
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
      />
      {/* Button now *only* triggers file input */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleUploadClick}
      >
        <Upload className="mr-2 h-4 w-4" />
        Upload Photo
      </Button>
    </div>
  );
}