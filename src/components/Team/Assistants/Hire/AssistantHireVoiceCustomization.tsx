'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/UI/tabs";
import { ScrollArea } from "@/components/UI/scroll-area";
import { Button } from "@/components/UI/button";
import { Input } from "@/components/UI/input";
import { Textarea } from "@/components/UI/textarea";
import { Label } from "@/components/UI/label";
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/UI/select";
import { AssistantActions, VoiceOption, VoiceDesignPreviewItem } from '@/types/team/assistant';
import { Trash2, UploadCloud, Loader2, Info, CheckCircle2, Play, Wand2, MicVocal } from 'lucide-react'; 
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import { SupportedLanguage } from "@cartesia/cartesia-js/api"; 

// Import Hooks
import { useVoiceOptions } from '@/hooks/Team/useVoiceOptions';
import { useVoiceCreator } from '@/hooks/Team/useVoiceCreator';
import { useTTSPreview } from '@/hooks/Team/useTTSPreview';

// Import Utils/Constants
import { languageOptions, getLanguageFlag } from '@/utils/team/voice-utils'; 
import { VOICE_PROVIDER, DESIGN_VOICE_DESC_MIN_LENGTH, DESIGN_VOICE_DESC_MAX_LENGTH, DESIGN_SAMPLE_TEXT_MIN_LENGTH, DESIGN_SAMPLE_TEXT_MAX_LENGTH } from '@/constants/assistants/settings';

interface VoiceCustomizationProps {
    assistantActions: AssistantActions; 
    onVoiceSelected: (selectedVoice: VoiceOption | null) => void;
    initialVoiceId?: string | null;
    disabled?: boolean;
    onProcessingStateChange?: (isProcessing: boolean) => void;
}

type ActiveCreatorTab = "select" | "clone" | "design";

export function VoiceCustomization({
    assistantActions,
    onVoiceSelected,
    initialVoiceId = null,
    disabled = false,
    onProcessingStateChange,
}: VoiceCustomizationProps) {
    const [activeMainTab, setActiveMainTab] = React.useState<ActiveCreatorTab>('select');
    const [selectedVoiceId, setSelectedVoiceId] = React.useState<string | null>(initialVoiceId);

    const handleVoiceDeletedFromHook = React.useCallback((deletedVoiceId: string) => {
        if (selectedVoiceId === deletedVoiceId) {
            setSelectedVoiceId(null);
            onVoiceSelected(null);
        }
    }, [selectedVoiceId, onVoiceSelected]);

    const {
        allDisplayableVoices,
        isLoadingUserVoices,
        fetchUserVoices,
        deleteUserVoice,
    } = useVoiceOptions(assistantActions.voice, handleVoiceDeletedFromHook);

    const handleVoiceCreatedAndSelectedByHook = React.useCallback((newVoice: VoiceOption) => {
        onVoiceSelected(newVoice);
        setSelectedVoiceId(newVoice.voice_id);
        setActiveMainTab('select'); 
    }, [onVoiceSelected]);

    const {
        createMode, setCreateMode, // Keep createMode, set it based on activeMainTab
        cloneFile, setCloneFile, cloneFileName, setCloneFileName,
        cloneName, setCloneName, cloneDescription, setCloneDescription, cloneLanguage, setCloneLanguage,
        designVoiceDescription, setDesignVoiceDescription,
        designSampleText, setDesignSampleText,
        designPreviews, 
        selectedPreviewId, setSelectedPreviewId,
        isGeneratingPreviews, handleGenerateDesignPreviews,
        designFinalVoiceName, setDesignFinalVoiceName,
        designFinalLanguage, setDesignFinalLanguage,
        isProcessingCreate,
        handleCreateAndSelect,
        resetCreateForm, 
    } = useVoiceCreator(assistantActions.voice, handleVoiceCreatedAndSelectedByHook, fetchUserVoices);

    // Effect to inform parent about processing state changes
    React.useEffect(() => {
        if (onProcessingStateChange) {
            onProcessingStateChange(isProcessingCreate || isGeneratingPreviews);
        }
    }, [isProcessingCreate, isGeneratingPreviews, onProcessingStateChange]);

    const {
        playPreview,
        isPlayingPreviewForVoiceId,
    } = useTTSPreview({ generateSpeechAction: assistantActions.voice.generate }); 

    React.useEffect(() => {
        setSelectedVoiceId(initialVoiceId);
        if (initialVoiceId && activeMainTab !== 'select') { 
             const voice = allDisplayableVoices.find(v => v.voice_id === initialVoiceId);
             if (voice) {
                setActiveMainTab('select');
             }
        }
    }, [initialVoiceId, allDisplayableVoices]);

    // Update createMode in useVoiceCreator hook when tab changes
    React.useEffect(() => {
        if (activeMainTab === 'clone') {
            setCreateMode('clone');
        } else if (activeMainTab === 'design') {
            setCreateMode('design');
        }
    }, [activeMainTab, setCreateMode]);

    const handleSelectVoiceDisplay = (voice: VoiceOption) => {
        setSelectedVoiceId(voice.voice_id);
        onVoiceSelected(voice); 
    };

    const VoiceListItem = React.memo(({ voice }: { voice: VoiceOption }) => {
        const isSelected = selectedVoiceId === voice.voice_id;
        const itemIsDisabled = disabled || isProcessingCreate || isGeneratingPreviews;
        return (
            <div
                className={cn("flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer border",
                    isSelected ? "bg-primary text-primary-foreground border-primary" : "border-transparent hover:border-muted-foreground/30",
                    itemIsDisabled && "opacity-60 cursor-not-allowed hover:bg-transparent" 
                )}
                onClick={() => !itemIsDisabled && handleSelectVoiceDisplay(voice)}
            >
                <span className="text-md">{getLanguageFlag(voice.language)}</span>
                <span className="flex-1 truncate font-medium text-sm" title={voice.name}>{voice.name}</span>

                <div className={cn("flex items-center p-0 m-0 gap-1 sm:gap-2 justify-between", isSelected ? "text-primary-foreground" : "text-muted-foreground")}>
                    <TooltipProvider delayDuration={100}>
                        <Tooltip><TooltipTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" className={cn("h-7 w-7", isSelected ? "hover:bg-primary/80" : "hover:bg-muted-foreground/10")} onClick={(e) => e.stopPropagation()} disabled={itemIsDisabled}>
                                <Info className={cn("h-4 w-4", isSelected ? "text-primary-foreground" : "text-muted-foreground")} />
                            </Button>
                        </TooltipTrigger><TooltipContent side="top" className="max-w-xs text-sm"><p>{voice.description || "No description."}</p></TooltipContent></Tooltip>
                    </TooltipProvider>

                    <TooltipProvider delayDuration={100}>
                        <Tooltip><TooltipTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" className={cn("h-7 w-7", isSelected ? "text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground" : "text-muted-foreground hover:text-green-600 hover:bg-green-600/10")} onClick={(e) => { e.stopPropagation(); playPreview(voice); }} disabled={itemIsDisabled || (isPlayingPreviewForVoiceId === voice.voice_id && isPlayingPreviewForVoiceId !== null) }>
                                {isPlayingPreviewForVoiceId === voice.voice_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                            </Button>
                        </TooltipTrigger><TooltipContent side="top" className="max-w-xs text-sm"><p>{`Preview "${voice.name}"`}</p></TooltipContent></Tooltip>
                    </TooltipProvider>
                    
                    {!voice.is_preset && voice.isUserVoiceInOrchestra && (
                        <TooltipProvider delayDuration={100}>
                            <Tooltip><TooltipTrigger asChild>
                                <Button type="button" variant="ghost" size="icon" className={cn("h-7 w-7", isSelected ? "text-primary-foreground hover:bg-destructive/80 hover:text-primary-foreground" : "text-muted-foreground hover:text-destructive hover:bg-destructive/10")} onClick={(e) => { e.stopPropagation(); deleteUserVoice(voice); }} disabled={itemIsDisabled}><Trash2 className="h-4 w-4" /></Button>
                            </TooltipTrigger><TooltipContent side="top" className="max-w-xs text-sm"><p>{`Delete "${voice.name}"`}</p></TooltipContent></Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            </div>
        )
    });
    VoiceListItem.displayName = "VoiceListItem";

    const audioPreviewRefs = React.useRef<Record<string, HTMLAudioElement | null>>({});

    const playDesignPreviewAudio = (event: React.MouseEvent<HTMLButtonElement>, preview: VoiceDesignPreviewItem) => {
         event.stopPropagation(); // Prevent event bubbling
         event.preventDefault(); // Prevent default button action if any
        
         const audioId = `design-preview-${preview.generated_voice_id}`;
         let audio = audioPreviewRefs.current[audioId];
         if (!audio) {
             audio = new Audio();
             audioPreviewRefs.current[audioId] = audio;
             audio.onended = () => {
                 // Only deselect if this audio was the one playing
                 if (selectedPreviewId === preview.generated_voice_id) {
                     setSelectedPreviewId(null);
                 }
             }
         }

         // If clicking the currently selected and playing preview, stop it.
         if (selectedPreviewId === preview.generated_voice_id && !audio.paused) {
             audio.pause();
             audio.currentTime = 0;
             // Keep it selected, user might want to replay or finalize. 
             // To deselect, they can click another or it ends.
         } else { // Play new or replay paused/ended
             Object.values(audioPreviewRefs.current).forEach(audElem => {
                 if (audElem !== audio) audElem?.pause(); // Pause others
             });
             audio.src = `data:${preview.media_type};base64,${preview.audio_base_64}`;
             audio.play().catch(e => {
                 toast.error("Failed to play preview audio.");
                 console.error("Preview play error:", e);
                 if (selectedPreviewId === preview.generated_voice_id) {
                      setSelectedPreviewId(null); // Deselect on error
                 }
             });
             setSelectedPreviewId(preview.generated_voice_id); 
         }
    };

    // Helper to get character count class
    const getCharCountClass = (currentLength: number, min: number, max: number, isOptionalAndEmpty?: boolean) => {
        if (isOptionalAndEmpty && currentLength === 0) return "text-muted-foreground"; // Optional and empty is fine
        if (currentLength < min || currentLength > max) return "text-destructive";
        return "text-muted-foreground";
    };

    return (
        <div className={cn("", (disabled || isProcessingCreate || isGeneratingPreviews) && "opacity-70 cursor-not-allowed")}>
            <Tabs 
                value={activeMainTab} 
                onValueChange={(v) => setActiveMainTab(v as ActiveCreatorTab)} 
                className="w-full"
            >
                <TabsList className={cn("grid w-full h-9", VOICE_PROVIDER === 'elevenlabs' ? "grid-cols-3" : "grid-cols-2")}>
                    <TabsTrigger value="select" disabled={disabled || isProcessingCreate || isGeneratingPreviews}>Select</TabsTrigger>
                    <TabsTrigger value="clone" disabled={disabled || isProcessingCreate || isGeneratingPreviews}>Clone</TabsTrigger>
                    {VOICE_PROVIDER === 'elevenlabs' && (
                        <TabsTrigger value="design" disabled={disabled || isProcessingCreate || isGeneratingPreviews}>Design</TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="select" className="mt-1">
                    <ScrollArea className="h-[260px] p-2 border rounded-md">
                        <div className="space-y-1">
                            {isLoadingUserVoices ? (
                                <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                            ) : allDisplayableVoices.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">No voices. Try creating or designing one.</p>
                            ) : (
                                allDisplayableVoices.map(v => <VoiceListItem key={(v.is_preset ? 'p-' : 'u-') + v.voice_id} voice={v} />)
                            )}
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="clone" className="p-3 border rounded-md space-y-3 min-h-[276px]"> {/* Added min-height for consistency */}
                    <div className="grid grid-cols-2 gap-2">
                        <div><Label htmlFor="clone-name" className="text-xs">Voice Name</Label><Input id="clone-name" value={cloneName} onChange={e => setCloneName(e.target.value)} placeholder="e.g., My Clone" className="h-8 text-sm" disabled={disabled || isProcessingCreate || isGeneratingPreviews} /></div>
                        <div>
                            <Label htmlFor="clone-language" className="text-xs">Language</Label>
                            <Select value={cloneLanguage} onValueChange={(v) => setCloneLanguage(v as SupportedLanguage)} disabled={disabled || isProcessingCreate || isGeneratingPreviews}>
                                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Lang..." /></SelectTrigger>
                                <SelectContent>{languageOptions.map(l => <SelectItem key={l.value} value={l.value} className="text-sm">{l.flag} {l.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="clone-file" className="text-xs">Audio Clip (max 5s, .wav, .mp3)</Label>
                        {!cloneFileName ? (
                            <label className="mt-0.5 flex justify-center w-full h-16 px-4 transition bg-background border-2 border-gray-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-gray-400 items-center disabled:opacity-50" aria-disabled={disabled || isProcessingCreate || isGeneratingPreviews}>
                                <span className="flex items-center space-x-2"> <UploadCloud className="w-5 h-5 text-gray-600" /> <span className="font-medium text-gray-600 text-sm">Drop or <span className="text-blue-600 underline">browse</span></span></span>
                                <input type="file" id="clone-file" accept=".wav,.mp3" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setCloneFile(f); setCloneFileName(f.name); } }} disabled={disabled || isProcessingCreate || isGeneratingPreviews} />
                            </label>
                        ) : (
                            <div className="mt-0.5 flex items-center justify-between p-1.5 border rounded-md bg-muted/50 text-sm h-9">
                                <span className="truncate">{cloneFileName}</span>
                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => { setCloneFile(null); setCloneFileName(null); }} disabled={disabled || isProcessingCreate || isGeneratingPreviews}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                        )}
                    </div>
                    <div><Label htmlFor="clone-desc" className="text-xs">Description (Optional)</Label><Textarea id="clone-desc" value={cloneDescription} onChange={e => setCloneDescription(e.target.value)} placeholder="Notes about this voice..." rows={2} className="text-sm min-h-[50px]" disabled={disabled || isProcessingCreate || isGeneratingPreviews} /></div>
                    
                    <Button type="button" onClick={handleCreateAndSelect} className="w-full h-9 text-sm bg-green-600 hover:bg-green-700" disabled={disabled || isProcessingCreate || isGeneratingPreviews || !cloneFile || !cloneName}>
                        {isProcessingCreate && createMode === 'clone' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Create & Select Voice
                    </Button>
                </TabsContent>

                {VOICE_PROVIDER === 'elevenlabs' && (
                    <TabsContent value="design" className="p-3 border rounded-md space-y-3 min-h-[276px]">
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                    <Label htmlFor="design-final-name" className="text-xs">Voice Name</Label>
                                    <Input id="design-final-name" value={designFinalVoiceName} onChange={e => setDesignFinalVoiceName(e.target.value)} placeholder="e.g., My Designed Voice" className="h-8 text-sm" disabled={disabled || isProcessingCreate || isGeneratingPreviews} />
                                </div>
                                <div>
                                    <Label htmlFor="design-final-lang" className="text-xs">Language</Label>
                                    <Select value={designFinalLanguage} onValueChange={(v) => setDesignFinalLanguage(v as SupportedLanguage)} disabled={disabled || isProcessingCreate || isGeneratingPreviews}>
                                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                        <SelectContent>{languageOptions.map(l => <SelectItem key={l.value} value={l.value} className="text-sm">{l.flag} {l.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="design-desc" className="text-xs">Voice Description Prompt</Label>
                                <Textarea 
                                    id="design-desc" 
                                    value={designVoiceDescription} 
                                    onChange={e => setDesignVoiceDescription(e.target.value)} 
                                    placeholder="e.g., A calm and soothing female voice with a British accent..." 
                                    rows={2} 
                                    className="text-sm min-h-[50px]" 
                                    disabled={disabled || isProcessingCreate || isGeneratingPreviews} 
                                    maxLength={DESIGN_VOICE_DESC_MAX_LENGTH}
                                />
                                <p className={cn("text-xs text-right mt-0.5", getCharCountClass(designVoiceDescription.length, DESIGN_VOICE_DESC_MIN_LENGTH, DESIGN_VOICE_DESC_MAX_LENGTH))}>
                                    {designVoiceDescription.length}/{DESIGN_VOICE_DESC_MAX_LENGTH} (min {DESIGN_VOICE_DESC_MIN_LENGTH})
                                </p>
                            </div>
                            <div>
                                <Label htmlFor="design-sample" className="text-xs">Sample Text for Previews (Optional)</Label>
                                <Input 
                                    id="design-sample" 
                                    value={designSampleText} 
                                    onChange={e => setDesignSampleText(e.target.value)} 
                                    placeholder={`e.g., Hello, this is a sample reference text for generating the voice.`}
                                    className="h-8 text-sm" 
                                    disabled={disabled || isProcessingCreate || isGeneratingPreviews}
                                    maxLength={DESIGN_SAMPLE_TEXT_MAX_LENGTH}
                                />
                                <p className={cn("text-xs text-right mt-0.5", getCharCountClass(designSampleText.length, DESIGN_SAMPLE_TEXT_MIN_LENGTH, DESIGN_SAMPLE_TEXT_MAX_LENGTH, true))}>
                                    {designSampleText.length}/{DESIGN_SAMPLE_TEXT_MAX_LENGTH} 
                                    {designSampleText.length > 0 && ` (min ${DESIGN_SAMPLE_TEXT_MIN_LENGTH})`}
                                </p>
                            </div>
                            <Button type="button" onClick={handleGenerateDesignPreviews} className="w-full h-8 text-sm" disabled={disabled || isProcessingCreate || isGeneratingPreviews || !designVoiceDescription.trim()}>
                                {isGeneratingPreviews ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />} Generate Previews
                            </Button>

                            {designPreviews.length > 0 && (
                                <div className="space-y-2 pt-2">
                                    <Label className="text-xs">Select a Preview to Finalize:</Label>
                                    <ScrollArea className="h-[120px] border rounded-md p-1"> {/* Increased height */}
                                        {designPreviews.map((preview, idx) => (
                                            <Button
                                                type="button" // Explicitly set type
                                                key={preview.generated_voice_id}
                                                variant={selectedPreviewId === preview.generated_voice_id ? "default" : "outline"}
                                                size="sm"
                                                className="w-full justify-start h-8 mb-1 text-xs"
                                                onClick={(e) => playDesignPreviewAudio(e, preview)}
                                                disabled={isGeneratingPreviews || isProcessingCreate}
                                            >
                                                <MicVocal className="mr-2 h-3 w-3" />
                                                Preview {idx + 1}
                                                {selectedPreviewId === preview.generated_voice_id && <Play className="ml-auto h-3 w-3" />}
                                            </Button>
                                        ))}
                                    </ScrollArea>
                                </div>
                            )}
                            <Button type="button" onClick={handleCreateAndSelect} className="w-full h-9 text-sm bg-green-600 hover:bg-green-700" disabled={disabled || isProcessingCreate || isGeneratingPreviews || (createMode === 'design' && !selectedPreviewId)}>
                                {isProcessingCreate && createMode === 'design' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Create & Select Voice
                            </Button>
                        </div>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}