'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/UI/tabs';
import { Button } from '@/components/UI/button';
import { Textarea } from '@/components/UI/textarea';
import { ImagePlus, Loader2, Sparkles, Pen, PlayCircle, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePhotoCreator } from '@/hooks/Assistants/usePhotoCreator';
import { AssistantActions, VoiceOption } from '@/types/assistants/assistant';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import {
  PHOTO_OPERATION_COST,
  VIDEO_ANIMATION_COST,
  MIN_TTS_PROMPT_LENGTH,
} from '@/constants/assistants/settings';
import { toast } from 'sonner';
import { BillableActionGuard } from '@/components/Billing/BillableActionGuard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';

interface PhotoCustomizationProps {
  assistantActions: AssistantActions;
  onNewMediaReady: (file: File | null, mediaType: 'photo' | 'video') => void;
  currentImageUrl: string | null;
  currentImageFile: File | null;
  disabled?: boolean;
  selectedVoice: VoiceOption | null;
  firstName?: string | null;
  surname?: string | null;
  age?: number | null;
  activeTab: 'upload' | 'create' | 'edit' | 'animate';
  setActiveTab: (tab: 'upload' | 'create' | 'edit' | 'animate') => void;
  showAnimatePing?: boolean;
  onProcessingStateChange?: (isProcessing: boolean) => void;
  /** Callback to open the Stripe side panel for payment setup */
  onAddPaymentMethod?: () => void;
}

export function PhotoCustomization({
  assistantActions,
  onNewMediaReady,
  currentImageUrl,
  currentImageFile,
  disabled = false,
  selectedVoice,
  firstName,
  surname,
  age,
  activeTab,
  setActiveTab,
  showAnimatePing,
  onProcessingStateChange,
  onAddPaymentMethod,
}: PhotoCustomizationProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Camera state
  const [isCameraDialogOpen, setIsCameraDialogOpen] = React.useState(false);
  const [cameraStream, setCameraStream] = React.useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const {
    prompt,
    setPrompt,
    ttsPrompt,
    setTtsPrompt,
    isProcessing,
    isGenerating,
    isEditing,
    handleGenerate,
    handleEdit,
    handleAnimate,
  } = usePhotoCreator(
    assistantActions.photo,
    assistantActions.voice.generate,
    onNewMediaReady,
    PHOTO_OPERATION_COST,
    VIDEO_ANIMATION_COST,
    selectedVoice,
    firstName,
    surname,
    age
  );

  React.useEffect(() => {
    onProcessingStateChange?.(isProcessing);
  }, [isProcessing, onProcessingStateChange]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    onNewMediaReady(file, 'photo');
  };

  const isGenerateDisabled = !prompt.trim() || isProcessing || disabled;
  const isEditDisabled = !currentImageUrl || !prompt.trim() || isProcessing || disabled;
  const isAnimateDisabled =
    !currentImageUrl ||
    !ttsPrompt.trim() ||
    ttsPrompt.trim().length < MIN_TTS_PROMPT_LENGTH ||
    !selectedVoice ||
    isProcessing ||
    disabled;
  const imageSourceForOperations = currentImageFile || currentImageUrl;

  const handleCreateKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerateDisabled) {
        handleGenerate();
      }
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isEditDisabled) {
        handleEdit(imageSourceForOperations!);
      }
    }
  };

  const handleAnimateKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isAnimateDisabled) {
        handleAnimate(imageSourceForOperations!);
      }
    }
  };

  const handleOpenCamera = async () => {
    if (disabled) return;
    setCameraError(null);
    setIsCameraDialogOpen(true);
  };

  // Effect to start camera when dialog opens
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
      // Cleanup when dialog closes
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
      }
    }

    // Cleanup function for when component unmounts
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

  const generateTooltipContent = !prompt.trim()
    ? 'Please enter a prompt to generate a photo.'
    : 'Generate new photo';

  const editTooltipContent = !currentImageUrl
    ? 'An existing photo is needed to edit.'
    : !prompt.trim()
      ? 'Please enter a prompt to edit the photo.'
      : 'Edit current photo';

  const animateTooltipContent = !currentImageUrl
    ? 'An existing photo is needed to animate.'
    : !selectedVoice
      ? 'A voice must be selected to generate audio.'
      : !ttsPrompt.trim()
        ? "Please enter text for the animation's audio."
        : ttsPrompt.trim().length < MIN_TTS_PROMPT_LENGTH
          ? `Text must be at least ${MIN_TTS_PROMPT_LENGTH} characters.`
          : 'Animate photo';

  return (
    <div className={cn('flex-1 self-stretch', disabled && 'cursor-not-allowed opacity-70')}>
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
        className="flex h-full w-full flex-col"
      >
        <TabsList className="grid h-9 w-full grid-cols-4">
          <TabsTrigger value="upload" disabled={disabled}>
            Upload
          </TabsTrigger>
          <TabsTrigger value="create" disabled={disabled}>
            Create
          </TabsTrigger>
          <TabsTrigger value="edit" disabled={disabled}>
            Edit
          </TabsTrigger>
          <TabsTrigger value="animate" disabled={disabled}>
            Animate
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-2 flex-1">
          <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2">
            {/* File Upload Input */}
            <label
              className="w/full flex h-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-background text-center transition-colors hover:border-primary"
              aria-disabled={disabled}
            >
              <ImagePlus className="mb-2 h-8 w-8 text-muted-foreground" />
              <span className="text-body text-muted-foreground">
                Drop file or <span className="text-link">browse</span>
              </span>
              <span className="text-caption text-muted-foreground/80 mt-1">
                PNG, JPG, WEBP to 50MB
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
                onChange={handleFileSelect}
                disabled={disabled}
              />
            </label>
            {/* Camera Input */}
            <div
              className="w/full flex h-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-background text-center transition-colors hover:border-primary"
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
        </TabsContent>

        <TabsContent value="create" className="mt-2 flex-1">
          <div className="relative flex h-full w-full flex-col rounded-lg border bg-background p-2.5">
            <Textarea
              id="photo-prompt-create"
              aria-label="Photo Prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleCreateKeyDown}
              className="text-body h-auto flex-1 resize-none border-0 bg-transparent p-1 focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={disabled || isProcessing}
              maxLength={150}
            />
            <div className="flex items-center justify-between pt-1">
              <p className="text-caption px-1 text-muted-foreground">
                Cost: {PHOTO_OPERATION_COST.toFixed(2)} credits per image
              </p>
              <BillableActionGuard
                onAddPaymentMethod={onAddPaymentMethod}
                creditsRequired={PHOTO_OPERATION_COST}
                tooltipSide="top"
                tooltipMessage="Generate new photo"
              >
                <Button
                  aria-label="Generate new photo"
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleGenerate}
                  disabled={isGenerateDisabled}
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </BillableActionGuard>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="edit" className="mt-2 flex-1">
          <div className="relative flex h-full w-full flex-col rounded-lg border bg-background p-2.5">
            <Textarea
              id="photo-prompt-edit"
              aria-label="Photo Edit Prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleEditKeyDown}
              className="text-body h-auto flex-1 resize-none border-0 bg-transparent p-1 focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={disabled || isProcessing}
              maxLength={150}
            />
            <div className="flex items-center justify-between pt-1">
              <p className="text-caption px-1 text-muted-foreground">
                Cost: {PHOTO_OPERATION_COST.toFixed(2)} credits per image
              </p>
              <BillableActionGuard
                onAddPaymentMethod={onAddPaymentMethod}
                creditsRequired={PHOTO_OPERATION_COST}
                tooltipSide="top"
                tooltipMessage="Edit photo"
              >
                <Button
                  aria-label="Edit photo"
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleEdit(imageSourceForOperations!)}
                  disabled={isEditDisabled}
                >
                  {isEditing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Pen className="h-4 w-4" />
                  )}
                </Button>
              </BillableActionGuard>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="animate" className="mt-2 flex-1">
          <div className="relative flex h-full w-full flex-col rounded-lg border bg-background p-2.5">
            <Textarea
              id="tts-prompt"
              aria-label="TTS Prompt"
              value={ttsPrompt}
              onChange={(e) => setTtsPrompt(e.target.value)}
              onKeyDown={handleAnimateKeyDown}
              className="text-body h-auto flex-1 resize-none border-0 bg-transparent p-1 focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={disabled || isProcessing}
              maxLength={50}
            />
            <div className="flex items-center justify-between pt-1">
              <p className="text-caption px-1 text-muted-foreground">
                Cost: {VIDEO_ANIMATION_COST.toFixed(2)} credits per second. (Min 3 sec)
              </p>
              <BillableActionGuard
                onAddPaymentMethod={onAddPaymentMethod}
                creditsRequired={VIDEO_ANIMATION_COST}
                tooltipSide="top"
                tooltipMessage="Animate photo"
              >
                <span tabIndex={0} className="relative inline-flex">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleAnimate(imageSourceForOperations!)}
                    disabled={isAnimateDisabled}
                    aria-label="Animate photo"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PlayCircle className="h-4 w-4" />
                    )}
                  </Button>
                  {showAnimatePing && (
                    <span className="absolute right-0.5 top-0.5 flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-primary"></span>
                    </span>
                  )}
                </span>
              </BillableActionGuard>
            </div>
          </div>
        </TabsContent>
      </Tabs>

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
                className="h-auto w-full rounded-md bg-black"
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
