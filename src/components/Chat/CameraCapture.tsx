'use client';

import * as React from 'react';
import { Button } from '@/components/UI/button';
import { Camera, SwitchCamera, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';
import { toast } from 'sonner';

interface CameraCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
}

export function CameraCapture({ open, onOpenChange, onCapture }: CameraCaptureProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [facingMode, setFacingMode] = React.useState<'user' | 'environment'>('user');
  const [hasMultipleCameras, setHasMultipleCameras] = React.useState(false);
  const [isStarting, setIsStarting] = React.useState(false);

  const stopStream = React.useCallback((s: MediaStream | null) => {
    s?.getTracks().forEach((track) => track.stop());
  }, []);

  const startCamera = React.useCallback(
    async (facing: 'user' | 'environment') => {
      setIsStarting(true);
      setError(null);

      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
        });
        setStream((prev) => {
          stopStream(prev);
          return newStream;
        });
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
      } catch {
        setError('Camera access was denied. Please check your browser permissions.');
        toast.error('Camera access was denied.');
      } finally {
        setIsStarting(false);
      }
    },
    [stopStream]
  );

  React.useEffect(() => {
    if (!open) {
      setStream((prev) => {
        stopStream(prev);
        return null;
      });
      setError(null);
      return;
    }

    startCamera(facingMode);

    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setHasMultipleCameras(videoInputs.length > 1);
    });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    return () => stopStream(stream);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwitchCamera = React.useCallback(() => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    startCamera(next);
  }, [facingMode, startCamera]);

  const handleCapture = React.useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
          onCapture(file);
          onOpenChange(false);
        } else {
          toast.error('Could not capture photo.');
        }
      },
      'image/jpeg',
      0.92
    );
  }, [onCapture, onOpenChange]);

  const handleClose = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault();
          handleClose();
        }}
        onEscapeKeyDown={handleClose}
        className="sm:max-w-[625px]"
      >
        <DialogHeader>
          <DialogTitle className="text-title">Take a Photo</DialogTitle>
          <DialogDescription className="text-subtitle">
            Position the document or subject in the frame and capture.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          {error ? (
            <div className="flex h-80 flex-col items-center justify-center rounded-md bg-muted p-4 text-center">
              <p className="text-body text-destructive">{error}</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-auto w-full rounded-md bg-black"
            />
          )}
          <canvas ref={canvasRef} className="hidden" />
          {hasMultipleCameras && !error && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8 rounded-full bg-black/50 text-white hover:bg-black/70"
              onClick={handleSwitchCamera}
              disabled={isStarting}
            >
              <SwitchCamera className="h-4 w-4" />
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleCapture} disabled={!stream || !!error || isStarting}>
            {isStarting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Camera className="mr-2 h-4 w-4" />
            )}
            Capture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
