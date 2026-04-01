'use client';

import * as React from 'react';
import Cropper, { Area } from 'react-easy-crop';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/UI/dialog';
import { Button } from '@/components/UI/button';
import { Slider } from '@/components/UI/slider';
import { ZoomIn, ZoomOut, RotateCw, RotateCcw, FlipHorizontal, FlipVertical } from 'lucide-react';

interface PhotoCropDialogProps {
  /** The image source URL (typically from URL.createObjectURL) */
  imageSrc: string | null;
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the user confirms the crop; receives the cropped File */
  onConfirm: (croppedFile: File) => void;
  /** Called when the user cancels */
  onCancel: () => void;
  /** Original image MIME type – used to preserve transparency for PNG/WebP */
  sourceType?: string;
}

const TRANSPARENT_TYPES = new Set(['image/png', 'image/webp']);

export function outputMime(sourceType?: string): string {
  return sourceType && TRANSPARENT_TYPES.has(sourceType) ? 'image/png' : 'image/jpeg';
}

export function outputExtension(mime: string): string {
  return mime === 'image/png' ? '.png' : '.jpg';
}

/**
 * Creates an off-screen canvas, draws the cropped region, and returns a Blob.
 *
 * Uses a two-canvas approach so that areas outside the image (visible when
 * de-zooming with restrictPosition=false) stay transparent/black instead of
 * showing smeared edge-pixel artifacts from getImageData.
 */
async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
  rotation: number,
  sourceType?: string,
  flipH = false,
  flipV = false
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const mime = outputMime(sourceType);

  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));

  const rotatedWidth = image.width * cos + image.height * sin;
  const rotatedHeight = image.width * sin + image.height * cos;

  // Canvas 1: draw the full rotated image
  const rotCanvas = document.createElement('canvas');
  rotCanvas.width = rotatedWidth;
  rotCanvas.height = rotatedHeight;
  const rotCtx = rotCanvas.getContext('2d')!;

  rotCtx.translate(rotatedWidth / 2, rotatedHeight / 2);
  rotCtx.rotate(radians);
  rotCtx.drawImage(image, -image.width / 2, -image.height / 2);

  // Canvas 2: extract the crop via drawImage (clips to source bounds,
  // so out-of-image areas remain transparent rather than showing artifacts)
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = pixelCrop.width;
  cropCanvas.height = pixelCrop.height;
  const cropCtx = cropCanvas.getContext('2d')!;

  cropCtx.drawImage(
    rotCanvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  // Canvas 3 (optional): apply horizontal/vertical flip
  const outputCanvas = flipH || flipV ? document.createElement('canvas') : cropCanvas;
  if (flipH || flipV) {
    outputCanvas.width = cropCanvas.width;
    outputCanvas.height = cropCanvas.height;
    const flipCtx = outputCanvas.getContext('2d')!;
    flipCtx.translate(flipH ? outputCanvas.width : 0, flipV ? outputCanvas.height : 0);
    flipCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    flipCtx.drawImage(cropCanvas, 0, 0);
  }

  return new Promise<Blob>((resolve, reject) => {
    outputCanvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      },
      mime,
      mime === 'image/jpeg' ? 0.92 : undefined
    );
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (err) => reject(err));
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const INITIAL_ZOOM = (MIN_ZOOM + MAX_ZOOM) / 2;
const ZOOM_STEP = 0.01;

export function PhotoCropDialog({
  imageSrc,
  open,
  onConfirm,
  onCancel,
  sourceType,
}: PhotoCropDialogProps) {
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(INITIAL_ZOOM);
  const [rotation, setRotation] = React.useState(0);
  const [flipH, setFlipH] = React.useState(false);
  const [flipV, setFlipV] = React.useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Reset state when a new image is loaded
  React.useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(INITIAL_ZOOM);
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
      setCroppedAreaPixels(null);
    }
  }, [open, imageSrc]);

  const onCropComplete = React.useCallback((_croppedArea: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = React.useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const blob = await getCroppedBlob(
        imageSrc,
        croppedAreaPixels,
        rotation,
        sourceType,
        flipH,
        flipV
      );
      const mime = outputMime(sourceType);
      const ext = outputExtension(mime);
      const file = new File([blob], `cropped-photo${ext}`, { type: mime });
      onConfirm(file);
    } catch {
      onCancel();
    } finally {
      setIsProcessing(false);
    }
  }, [imageSrc, croppedAreaPixels, rotation, sourceType, flipH, flipV, onConfirm, onCancel]);

  const handleRotateCw = () => setRotation((prev) => (prev + 90) % 360);
  const handleRotateCcw = () => setRotation((prev) => (prev - 90 + 360) % 360);
  const handleFlipH = () => setFlipH((prev) => !prev);
  const handleFlipV = () => setFlipV((prev) => !prev);

  const cropTransform = `translate(${crop.x}px, ${crop.y}px) rotate(${rotation}deg) scale(${flipH ? -zoom : zoom}, ${flipV ? -zoom : zoom})`;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="px-6 pb-2 pt-6">
          <DialogTitle>Adjust Photo</DialogTitle>
          <DialogDescription>Drag to reposition. Use the slider to zoom.</DialogDescription>
        </DialogHeader>

        {/* Crop area */}
        <div className="relative mx-6 aspect-square overflow-hidden rounded-lg">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              cropShape="round"
              showGrid={false}
              restrictPosition={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              transform={cropTransform}
              style={{ containerStyle: { background: 'transparent' } }}
            />
          )}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-3 px-6 pb-1 pt-4">
          <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Slider
            value={[zoom]}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={ZOOM_STEP}
            onValueChange={([v]) => setZoom(v)}
            className="flex-1"
          />
          <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>

        {/* Rotate & flip controls */}
        <div className="flex items-center justify-center gap-1 px-6 pb-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleRotateCcw}
            aria-label="Rotate counter-clockwise"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleRotateCw}
            aria-label="Rotate clockwise"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <div className="mx-1 h-4 w-px bg-border" />
          <Button
            type="button"
            variant={flipH ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={handleFlipH}
            aria-label="Flip horizontal"
          >
            <FlipHorizontal className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={flipV ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={handleFlipV}
            aria-label="Flip vertical"
          >
            <FlipVertical className="h-4 w-4" />
          </Button>
        </div>

        <DialogFooter className="px-6 pb-6 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isProcessing}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isProcessing}>
            {isProcessing ? 'Processing...' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
