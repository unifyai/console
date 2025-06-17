'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/UI/tabs";
import { Button } from "@/components/UI/button";
import { Textarea } from "@/components/UI/textarea";
import { ImagePlus, Loader2, Sparkles, Pen, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePhotoCreator } from '@/hooks/Team/usePhotoCreator';
import { AssistantActions, VoiceOption } from '@/types/team/assistant';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";

const PHOTO_OPERATION_COST = 0.05; // For generate/edit
const VIDEO_ANIMATION_COST = 0.25; // For animate

interface PhotoCustomizationProps {
    assistantActions: AssistantActions;
    onNewFileReady: (file: File | null) => void;
    currentImageUrl: string | null;
    currentImageFile: File | null;
    disabled?: boolean;
    selectedVoice: VoiceOption | null;
    onNewVideoReady: (url: string) => void;
}

export function PhotoCustomization({
    assistantActions,
    onNewFileReady,
    currentImageUrl,
    currentImageFile,
    disabled = false,
    selectedVoice,
    onNewVideoReady,
}: PhotoCustomizationProps) {
    const [activeTab, setActiveTab] = React.useState<'upload' | 'create' | 'animate'>('upload');
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const {
        prompt, setPrompt,
        ttsPrompt, setTtsPrompt,
        isProcessing,
        handleGenerate,
        handleEdit,
        handleAnimate,
    } = usePhotoCreator(
        assistantActions.photo, 
        onNewFileReady,
        PHOTO_OPERATION_COST,
        VIDEO_ANIMATION_COST,
        selectedVoice
    );
    
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;
        onNewFileReady(file);
    };

    const isEditDisabled = !currentImageUrl || isProcessing || disabled;
    const isAnimateDisabled = !currentImageUrl || !ttsPrompt.trim() || !selectedVoice || isProcessing || disabled;
    const imageSourceForOperations = currentImageFile || currentImageUrl;

    return (
        <div className={cn("flex-1 self-stretch", disabled && "opacity-70 cursor-not-allowed")}>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full flex flex-col h-full">
                <TabsList className="grid w-full grid-cols-3 h-9"> {/* Changed to grid-cols-3 */}
                    <TabsTrigger value="upload" disabled={disabled}>Upload</TabsTrigger>
                    <TabsTrigger value="create" disabled={disabled}>Create</TabsTrigger>
                    <TabsTrigger value="animate" disabled={disabled}>Animate</TabsTrigger> 
                </TabsList>

                <TabsContent value="upload" className="mt-2 flex-1">
                    <label 
                        className="flex flex-col items-center justify-center w-full h-full text-center bg-background border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors"
                        aria-disabled={disabled}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <ImagePlus className="w-8 h-8 text-muted-foreground mb-2" />
                        <span className="font-medium text-muted-foreground text-sm">Drop file or <span className="text-primary underline">browse</span></span>
                        <span className="text-xs text-muted-foreground/80 mt-1">PNG, JPG, WEBP up to 5MB</span>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png, image/jpeg, image/webp"
                            className="hidden"
                            onChange={handleFileSelect}
                            disabled={disabled}
                        />
                    </label>
                </TabsContent>

                <TabsContent value="create" className="mt-2 flex-1">
                    <div className="relative w-full h-full rounded-lg border bg-background flex flex-col p-2.5">
                        <Textarea
                            id="photo-prompt"
                            placeholder="A photorealistic portrait of a friendly-looking person, studio lighting..."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
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

                                        </TooltipTrigger>
                                        <TooltipContent side="top" align="end" className="max-w-xs text-sm">
                                            <p>{!currentImageUrl ? "An existing photo is needed to edit" : "Edit current photo"}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider delayDuration={100}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8"
                                                onClick={handleGenerate}
                                                disabled={disabled || isProcessing}
                                            >
                                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" align="end" className="max-w-xs text-sm">
                                            <p>{"Generate new photo"}</p>
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
                            placeholder="Hi there! How can i help you today?"
                            value={ttsPrompt}
                            onChange={(e) => setTtsPrompt(e.target.value)}
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
                                    </TooltipTrigger>
                                    <TooltipContent side="top" align="end" className="max-w-xs text-sm">
                                        <p>{!currentImageUrl ? "An existing photo is needed to animate" : !selectedVoice ? "A voice must be selected to generate audio" : "Animate photo"}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}