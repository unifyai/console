'use client';

import * as React from 'react';
import { Button } from '@/components/UI/button';
import { ImagePlus, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';

interface PhotoCustomizationProps {
  onNewMediaReady: (file: File | null, mediaType: 'photo' | 'video') => void;
  disabled?: boolean;
  onProcessingStateChange?: (isProcessing: boolean) => void;
}

export function PhotoCustomization({
  onNewMediaReady,
  disabled = false,
  onProcessingStateChange,
}: PhotoCustomizationProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [isCameraDialogOpen, setIsCameraDialogOpen] = React.useState(false);
  const [cameraStream, setCameraStream] = React.useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    onProcessingStateChange?.(false);
  }, [onProcessingStateChange]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    onNewMediaReady(file, 'photo');
  };

  const handleOpenCamera = async () => {
    if (disabled) return;
    setCameraError(null);
    setIsCameraDialogOpen(true);
  };

  React.useEffect(() => {
    if (isCameraDialogOpen) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          setCameraStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.error('Camera access denied:', err);
          setCameraError('Camera access was denied. Please check your browser permissions.');
          toast.error('Camera access was denied.');
        });
    } else {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
      }
    }

    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isCameraDialogOpen, cameraStream]);

  const handleCloseCamera = () => {
    setIsCameraDialogOpen(false); // This will trigger the useEffect cleanup
  };

  const handleCapturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onNewMediaReady(file, 'photo');
        handleCloseCamera();
      } else {
        toast.error('Could not capture photo.');
      }
    }, 'image/jpeg');
  };

  return (
    <div className={cn('flex-1 self-stretch', disabled && 'cursor-not-allowed opacity-70')}>
      <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2">
        <label
          className="flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-background text-center transition-colors hover:border-primary"
          aria-disabled={disabled}
        >
          <ImagePlus className="mb-2 h-8 w-8 text-muted-foreground" />
          <span className="text-body text-muted-foreground">
            Drop file or <span className="text-link">browse</span>
          </span>
          <span className="text-caption text-muted-foreground/80 mt-1">PNG, JPG, WEBP to 50MB</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp"
            className="hidden"
            onChange={handleFileSelect}
            disabled={disabled}
          />
        </label>
        <div
          className="flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-background text-center transition-colors hover:border-primary"
          onClick={handleOpenCamera}
          role="button"
          aria-disabled={disabled}
        >
          <Camera className="mb-2 h-8 w-8 text-muted-foreground" />
          <span className="text-body text-muted-foreground">Use Camera</span>
          <span className="text-caption text-muted-foreground/80 mt-1">
            Capture a photo directly
          </span>
        </div>
      </div>

      <Dialog open={isCameraDialogOpen} onOpenChange={setIsCameraDialogOpen}>
        <DialogContent
          onInteractOutside={(e) => {
            e.preventDefault();
            handleCloseCamera();
          }}
          onEscapeKeyDown={handleCloseCamera}
          className="sm:max-w-[625px]"
        >
          <DialogHeader>
            <DialogTitle className="text-title">Take a Photo</DialogTitle>
            <DialogDescription className="text-subtitle">
              Position yourself in the frame and capture your new profile photo.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            {cameraError ? (
              <div className="flex h-80 flex-col items-center justify-center rounded-md bg-muted p-4 text-center">
                <p className="text-body text-destructive">{cameraError}</p>
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-auto w-full rounded-md bg-foreground"
              />
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseCamera}>
              Cancel
            </Button>
            <Button onClick={handleCapturePhoto} disabled={!cameraStream || !!cameraError}>
              <Camera className="mr-2 h-4 w-4" /> Capture Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
