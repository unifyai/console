'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/UI/tabs";
import { Button } from "@/components/UI/button";
import { Textarea } from "@/components/UI/textarea";
import { ImagePlus, Loader2, Sparkles, Pen, PlayCircle, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePhotoCreator } from '@/hooks/Assistants/usePhotoCreator';
import { AssistantActions, VoiceOption } from '@/types/assistants/assistant';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import { PHOTO_OPERATION_COST, VIDEO_ANIMATION_COST } from '@/constants/assistants/settings';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/UI/dialog";

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
    activeTab: 'upload' | 'create' | 'animate';
    setActiveTab: (tab: 'upload' | 'create' | 'animate') => void;
    showAnimatePing?: boolean;
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
}: PhotoCustomizationProps) {
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Camera state
    const [isCameraDialogOpen, setIsCameraDialogOpen] = React.useState(false);
    const [cameraStream, setCameraStream] = React.useState<MediaStream | null>(null);
    const [cameraError, setCameraError] = React.useState<string | null>(null);
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    const {
        prompt, setPrompt,
        ttsPrompt, setTtsPrompt,
        isProcessing,
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

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;
        onNewMediaReady(file, 'photo');
    };

    const isGenerateDisabled = !prompt.trim() || isProcessing || disabled;
    const isEditDisabled = !currentImageUrl || !prompt.trim() || isProcessing || disabled;
    const isAnimateDisabled = !currentImageUrl || !ttsPrompt.trim() || !selectedVoice || isProcessing || disabled;
    const imageSourceForOperations = currentImageFile || currentImageUrl;

    const handleCreateKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isGenerateDisabled) {
                handleGenerate();
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
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(stream => {
                    setCameraStream(stream);
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                })
                .catch(err => {
                    console.error("Camera access denied:", err);
                    setCameraError("Camera access was denied. Please check your browser permissions.");
                    toast.error("Camera access was denied.");
                });
        } else {
            // Cleanup when dialog closes
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
                setCameraStream(null);
            }
        }

        // Cleanup function for when component unmounts
        return () => {
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [isCameraDialogOpen]); // Only re-run when dialog open state changes

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

        canvas.toBlob(blob => {
            if (blob) {
                const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
                onNewMediaReady(file, 'photo');
                handleCloseCamera();
            } else {
                toast.error("Could not capture photo.");
            }
        }, 'image/jpeg');
    };

    const generateTooltipContent = !prompt.trim()
        ? "Please enter a prompt to generate a photo."
        : "Generate new photo";

    const editTooltipContent = !currentImageUrl
        ? "An existing photo is needed to edit."
        : !prompt.trim()
        ? "Please enter a prompt to edit the photo."
        : "Edit current photo";

    const animateTooltipContent = !currentImageUrl
        ? "An existing photo is needed to animate."
        : !selectedVoice
        ? "A voice must be selected to generate audio."
        : !ttsPrompt.trim()
        ? "Please enter text for the animation's audio."
        : "Animate photo";

    return (
        <div className={cn("flex-1 self-stretch", disabled && "opacity-70 cursor-not-allowed")}>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full flex flex-col h-full">
                <TabsList className="grid w-full grid-cols-3 h-9">
                    <TabsTrigger value="upload" disabled={disabled}>Upload</TabsTrigger>
                    <TabsTrigger value="create" disabled={disabled}>Create</TabsTrigger>
                    <TabsTrigger value="animate" disabled={disabled}>Animate</TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="mt-2 flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
                        {/* File Upload Input */}
                        <label
                            className="flex flex-col items-center justify-center w-full h-full text-center bg-background border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors"
                            aria-disabled={disabled}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <ImagePlus className="w-8 h-8 text-muted-foreground mb-2" />
                            <span className="font-medium text-muted-foreground text-sm">Drop file or <span className="text-primary underline">browse</span></span>
                            <span className="text-xs text-muted-foreground/80 mt-1">PNG, JPG, WEBP to 50MB</span>
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
                            className="flex flex-col items-center justify-center w-full h-full text-center bg-background border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors"
                            onClick={handleOpenCamera}
                            role="button"
                            aria-disabled={disabled}
                        >
                            <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                            <span className="font-medium text-muted-foreground text-sm">Use Camera</span>
                            <span className="text-xs text-muted-foreground/80 mt-1">Capture a photo directly</span>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="create" className="mt-2 flex-1">
                    <div className="relative w-full h-full rounded-lg border bg-background flex flex-col p-2.5">
                        <Textarea
                            id="photo-prompt"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={handleCreateKeyDown}
                            className="flex-1 bg-transparent border-0 resize-none p-1 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm h-auto"
                            disabled={disabled || isProcessing}
                            maxLength={150}
                        />
                        <div className="flex justify-between items-center pt-1">
                             <p className="text-xs text-muted-foreground px-1">
                                Cost: {PHOTO_OPERATION_COST.toFixed(2)} credits
                            </p>
                            <div className="flex gap-1">
                                <TooltipProvider delayDuration={100}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            {/* Wrap the disabled button in a span to allow tooltip events */}
                                            <span tabIndex={0}>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => handleEdit(imageSourceForOperations!)}
                                                    disabled={isEditDisabled}
                                                >
                                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pen className="h-4 w-4" />}
                                                </Button>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" align="end" className="max-w-xs text-sm">
                                            <p>{editTooltipContent}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider delayDuration={100}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span tabIndex={0}>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={handleGenerate}
                                                    disabled={isGenerateDisabled}
                                                >
                                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                                </Button>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" align="end" className="max-w-xs text-sm">
                                            <p>{generateTooltipContent}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="animate" className="mt-2 flex-1">
                    <div className="relative w-full h-full rounded-lg border bg-background flex flex-col p-2.5">
                        <Textarea
                            id="tts-prompt"
                            value={ttsPrompt}
                            onChange={(e) => setTtsPrompt(e.target.value)}
                            onKeyDown={handleAnimateKeyDown}
                            className="flex-1 bg-transparent border-0 resize-none p-1 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm h-auto"
                            disabled={disabled || isProcessing}
                            maxLength={50}
                        />
                        <div className="flex justify-between items-center pt-1">
                             <p className="text-xs text-muted-foreground px-1">
                                Cost: {VIDEO_ANIMATION_COST.toFixed(2)} credits
                            </p>
                            <TooltipProvider delayDuration={100}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span tabIndex={0} className="relative">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handleAnimate(imageSourceForOperations!)}
                                                disabled={isAnimateDisabled}
                                            >
                                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                                            </Button>
                                             {showAnimatePing && (
                                                <span className="absolute top-0.5 right-0.5 flex h-3 w-3">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                                                </span>
                                            )}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" align="end" className="max-w-xs text-sm">
                                        <p>{animateTooltipContent}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            <Dialog open={isCameraDialogOpen} onOpenChange={setIsCameraDialogOpen}>
                <DialogContent onInteractOutside={(e) => { e.preventDefault(); handleCloseCamera(); }} onEscapeKeyDown={handleCloseCamera} className="sm:max-w-[625px]">
                    <DialogHeader>
                        <DialogTitle>Take a Photo</DialogTitle>
                        <DialogDescription>
                            Position yourself in the frame and capture your new profile photo.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="relative">
                        {cameraError ? (
                            <div className="flex flex-col items-center justify-center h-80 bg-muted rounded-md text-center p-4">
                                <p className="text-destructive">{cameraError}</p>
                            </div>
                        ) : (
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-auto rounded-md bg-black"
                            />
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseCamera}>Cancel</Button>
                        <Button onClick={handleCapturePhoto} disabled={!cameraStream || !!cameraError}>
                            <Camera className="mr-2 h-4 w-4" /> Capture Photo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}