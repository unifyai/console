'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/UI/tabs";
import { Button } from "@/components/UI/button";
import { Textarea } from "@/components/UI/textarea";
import { Label } from "@/components/UI/label";
import { ImagePlus, Loader2, Wand2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePhotoCreator } from '@/hooks/Team/usePhotoCreator';
import { AssistantActions } from '@/types/team/assistant';

interface PhotoCustomizationProps {
    assistantActions: AssistantActions;
    onPhotoUrlCreated: (newUrl: string) => void;
    onFileChange: (file: File | null) => void;
    currentImageUrl: string | null;
    currentImageFile: File | null;
    disabled?: boolean;
}

export function PhotoCustomization({
    assistantActions,
    onPhotoUrlCreated,
    onFileChange,
    currentImageUrl,
    currentImageFile,
    disabled = false,
}: PhotoCustomizationProps) {
    const [activeTab, setActiveTab] = React.useState<'upload' | 'create'>('upload');
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const {
        prompt,
        setPrompt,
        isProcessing,
        handleGenerate,
        handleEdit,
    } = usePhotoCreator(assistantActions.photo, onPhotoUrlCreated);
    
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;
        onFileChange(file);
    };

    const isEditDisabled = !currentImageUrl || isProcessing || disabled;
    const imageSourceForEdit = currentImageFile || currentImageUrl;

    return (
        <div className={cn("flex-1", disabled && "opacity-70 cursor-not-allowed")}>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-9">
                    <TabsTrigger value="upload" disabled={disabled}>Upload</TabsTrigger>
                    <TabsTrigger value="create" disabled={disabled}>Create with AI</TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="mt-1">
                    <div className="p-2 border rounded-md h-[180px] flex items-center justify-center">
                        <label 
                            className="flex flex-col items-center justify-center w-full h-full text-center bg-background border-2 border-dashed rounded-md cursor-pointer hover:border-primary transition-colors"
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
                    </div>
                </TabsContent>

                <TabsContent value="create" className="p-2 border rounded-md space-y-2 h-[180px] flex flex-col">
                    <Label htmlFor="photo-prompt" className="text-xs font-semibold">Prompt</Label>
                    <Textarea
                        id="photo-prompt"
                        placeholder="e.g., A photorealistic portrait of a friendly-looking person, studio lighting..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="text-sm flex-1 resize-none"
                        disabled={disabled || isProcessing}
                    />
                    <div className="flex justify-end gap-2 pt-1">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(imageSourceForEdit!)}
                            disabled={isEditDisabled}
                            title={!currentImageUrl ? "An existing photo is needed to edit" : "Edit photo based on prompt"}
                        >
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Edit
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleGenerate}
                            disabled={disabled || isProcessing}
                        >
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                            Generate
                        </Button>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}