'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/UI/tabs";
import { ScrollArea } from "@/components/UI/scroll-area";
import { Button } from "@/components/UI/button";
import { Input } from "@/components/UI/input";
import { Textarea } from "@/components/UI/textarea";
import { Label } from "@/components/UI/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/UI/select";
import { AssistantActions, VoiceOption } from '@/types/team/assistant';
import { Globe, Trash2, UploadCloud, Loader2, Info, CheckCircle2, Play, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import { SupportedLanguage, Gender as CartesiaGender, LocalizeTargetLanguage } from "@cartesia/cartesia-js/api";

// Import Hooks
import { useVoiceOptions } from '@/hooks/Team/useVoiceOptions';
import { useVoiceCreator } from '@/hooks/Team/useVoiceCreator';
import { useTTSPreview } from '@/hooks/Team/useTTSPreview';

// Import Utils/Constants
import { languageOptions, getLanguageFlag, getLanguageLabel, cartesiaLocalizeGenderOptions } from '@/utils/team/voice-utils';

interface VoiceCustomizationProps {
    assistantActions: AssistantActions; // Full actions for hooks
    onVoiceSelected: (selectedVoice: VoiceOption | null) => void;
    initialVoiceId?: string | null;
    disabled?: boolean;
    onProcessingStateChange?: (isProcessing: boolean) => void;
}

export function VoiceCustomization({
    assistantActions,
    onVoiceSelected,
    initialVoiceId = null,
    disabled = false,
    onProcessingStateChange,
}: VoiceCustomizationProps) {
    const [activeTab, setActiveTab] = React.useState<'select' | 'create'>('select');
    const [selectedCartesiaVoiceId, setSelectedCartesiaVoiceId] = React.useState<string | null>(initialVoiceId);

    const handleVoiceDeletedFromHook = React.useCallback((deletedVoiceId: string) => {
        if (selectedCartesiaVoiceId === deletedVoiceId) {
            setSelectedCartesiaVoiceId(null);
            onVoiceSelected(null);
        }
    }, [selectedCartesiaVoiceId, onVoiceSelected]);

    const {
        allDisplayableVoices,
        isLoadingUserVoices,
        fetchUserVoices,
        deleteUserVoice,
    } = useVoiceOptions(assistantActions.voice, handleVoiceDeletedFromHook);

    const handleVoiceCreatedAndSelectedByHook = React.useCallback((newVoice: VoiceOption) => {
        onVoiceSelected(newVoice);
        setSelectedCartesiaVoiceId(newVoice.voice_id);
        setActiveTab('select'); // Switch back to select tab
    }, [onVoiceSelected]);

    const {
        createMode, setCreateMode,
        cloneFile, setCloneFile, cloneFileName, setCloneFileName,
        cloneName, setCloneName, cloneDescription, setCloneDescription, cloneLanguage, setCloneLanguage,
        localizeBaseVoiceInfo, localizeNewName, setLocalizeNewName,
        localizeNewDescription, setLocalizeNewDescription, localizeTargetLanguage, setLocalizeTargetLanguage,
        localizeOriginalGender, setLocalizeOriginalGender, 
        isProcessingCreate,
        handleCreateAndSelect,
        resetCreateForm, 
        prepareForLocalize,
    } = useVoiceCreator(assistantActions.voice, handleVoiceCreatedAndSelectedByHook, fetchUserVoices);

    // Effect to inform parent about processing state changes
    React.useEffect(() => {
        if (onProcessingStateChange) {
            onProcessingStateChange(isProcessingCreate);
        }
    }, [isProcessingCreate, onProcessingStateChange]);


    const {
        playPreview,
        isPlayingPreviewForVoiceId,
        // stopPreview, // if needed
    } = useTTSPreview();

    React.useEffect(() => {
        setSelectedCartesiaVoiceId(initialVoiceId);
        if (initialVoiceId && activeTab !== 'select') { 
             const voice = allDisplayableVoices.find(v => v.voice_id === initialVoiceId);
             if (voice) {
                setActiveTab('select');
             }
        }
    }, [initialVoiceId, allDisplayableVoices, activeTab]);


    const handleSelectVoiceDisplay = (voice: VoiceOption) => {
        setSelectedCartesiaVoiceId(voice.voice_id);
        onVoiceSelected(voice); 
    };

    const handleLocalizeRequestFromList = (baseVoice: VoiceOption) => {
        prepareForLocalize(baseVoice, languageOptions); 
        setActiveTab('create');
    };

    const VoiceListItem = React.memo(({ voice }: { voice: VoiceOption }) => {
        const isSelected = selectedCartesiaVoiceId === voice.voice_id;
        const itemIsDisabled = disabled || isProcessingCreate; // Disable item interactions if any creation is ongoing or main form disabled

        return (
            <div
                className={cn("flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer border",
                    isSelected ? "bg-primary text-primary-foreground border-primary" : "border-transparent hover:border-muted-foreground/30",
                    itemIsDisabled && "opacity-60 cursor-not-allowed hover:bg-transparent" // Style for disabled item
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

                    <TooltipProvider delayDuration={100}>
                        <Tooltip><TooltipTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" className={cn("h-7 w-7", isSelected ? "text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground" : "text-muted-foreground hover:text-green-600 hover:bg-green-600/10")} onClick={(e) => { e.stopPropagation(); handleLocalizeRequestFromList(voice); }} disabled={itemIsDisabled}><Globe className="h-4 w-4" /></Button>
                        </TooltipTrigger><TooltipContent side="top" className="max-w-xs text-sm"><p>{`Localize "${voice.name}"`}</p></TooltipContent></Tooltip>
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


    return (
        <div className={cn("", (disabled || isProcessingCreate) && "opacity-70 cursor-not-allowed")}>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'select' | 'create')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-9">
                    <TabsTrigger value="select" disabled={disabled || isProcessingCreate}>Select Voice</TabsTrigger>
                    <TabsTrigger value="create" disabled={disabled || isProcessingCreate}>Create Voice</TabsTrigger>
                </TabsList>

                <TabsContent value="select" className="mt-1">
                    <ScrollArea className="h-[200px] p-2 border rounded-md">
                        <div className="space-y-1">
                            {allDisplayableVoices.map(v => <VoiceListItem key={(v.is_preset ? 'p-' : 'u-') + v.voice_id} voice={v} />)}
                        </div>
                        {isLoadingUserVoices && <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin" /></div>}
                        {!isLoadingUserVoices && allDisplayableVoices.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No voices. Try creating one.</p>}
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="create" className="p-3 border rounded-md space-y-3">
                    {/* Clone Mode UI */}
                    {createMode === 'clone' && (<>
                        <div>
                            <Label htmlFor="clone-file" className="text-xs">Audio Clip (max 5s, .wav, .mp3)</Label>
                            {!cloneFileName ? (
                                <label className="mt-0.5 flex justify-center w-full h-16 px-4 transition bg-background border-2 border-gray-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-gray-400 items-center disabled:opacity-50" aria-disabled={disabled || isProcessingCreate}>
                                    <span className="flex items-center space-x-2"> <UploadCloud className="w-5 h-5 text-gray-600" /> <span className="font-medium text-gray-600 text-sm">Drop or <span className="text-blue-600 underline">browse</span></span></span>
                                    <input type="file" id="clone-file" accept=".wav,.mp3" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setCloneFile(f); setCloneFileName(f.name); } }} disabled={disabled || isProcessingCreate} />
                                </label>
                            ) : (
                                <div className="mt-0.5 flex items-center justify-between p-1.5 border rounded-md bg-muted/50 text-sm h-9">
                                    <span className="truncate">{cloneFileName}</span>
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => { setCloneFile(null); setCloneFileName(null); }} disabled={disabled || isProcessingCreate}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div><Label htmlFor="clone-name" className="text-xs">Voice Name</Label><Input id="clone-name" value={cloneName} onChange={e => setCloneName(e.target.value)} placeholder="e.g., My Clone" className="h-8 text-sm" disabled={disabled || isProcessingCreate} /></div>
                            <div>
                                <Label htmlFor="clone-language" className="text-xs">Language of Clip</Label>
                                <Select value={cloneLanguage} onValueChange={(v) => setCloneLanguage(v as SupportedLanguage)} disabled={disabled || isProcessingCreate}>
                                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Lang..." /></SelectTrigger>
                                    <SelectContent>{languageOptions.map(l => <SelectItem key={l.value} value={l.value} className="text-sm">{l.flag} {l.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div><Label htmlFor="clone-desc" className="text-xs">Description (Optional)</Label><Textarea id="clone-desc" value={cloneDescription} onChange={e => setCloneDescription(e.target.value)} placeholder="Notes about this voice..." rows={2} className="text-sm min-h-[50px]" disabled={disabled || isProcessingCreate} /></div>
                    </>)}

                    {/* Localize Mode UI */}
                    {createMode === 'localize' && localizeBaseVoiceInfo && (<>
                        <div className="py-1 px-2 border rounded-md bg-muted/50 text-sm h-9 flex items-center justify-between">
                            <div className="flex items-center">
                                <span>Base: </span>
                                <span className="font-semibold ml-1">{getLanguageFlag(localizeBaseVoiceInfo.language)} {localizeBaseVoiceInfo.name}</span>
                            </div>
                            <TooltipProvider delayDuration={100}>
                                <Tooltip><TooltipTrigger asChild>
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 ml-1 text-muted-foreground hover:text-destructive" onClick={() => resetCreateForm(true)} disabled={disabled || isProcessingCreate}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger><TooltipContent side="top" className="max-w-xs text-sm"><p>Cancel localization & switch to Clone</p></TooltipContent></Tooltip>
                            </TooltipProvider>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div><Label htmlFor="localize-name" className="text-xs">New Voice Name</Label><Input id="localize-name" value={localizeNewName} onChange={e => setLocalizeNewName(e.target.value)} className="h-8 text-sm" disabled={disabled || isProcessingCreate} /></div>
                            <div>
                                <Label htmlFor="localize-target-lang" className="text-xs">Target Language</Label>
                                <Select value={localizeTargetLanguage} onValueChange={(v) => setLocalizeTargetLanguage(v as LocalizeTargetLanguage)} disabled={disabled || isProcessingCreate}>
                                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Target Lang..." /></SelectTrigger>
                                    <SelectContent>{languageOptions.filter(l => l.value !== localizeBaseVoiceInfo.language).map(l => <SelectItem key={l.value} value={l.value} className="text-sm">{l.flag} {l.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="localize-gender" className="text-xs">Original Speaker Gender (of base voice)</Label>
                            <Select value={localizeOriginalGender} onValueChange={(v) => setLocalizeOriginalGender(v as CartesiaGender)} disabled={disabled || isProcessingCreate }>
                                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>{cartesiaLocalizeGenderOptions.map(g => <SelectItem key={g.value} value={g.value} className="text-sm">{g.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div><Label htmlFor="localize-desc" className="text-xs">Description (Optional)</Label><Textarea id="localize-desc" value={localizeNewDescription} onChange={e => setLocalizeNewDescription(e.target.value)} placeholder="Notes about localized voice..." rows={2} className="text-sm min-h-[50px]" disabled={disabled || isProcessingCreate} /></div>
                    </>)}
                    {createMode === 'localize' && !localizeBaseVoiceInfo && (
                        <p className="text-sm text-muted-foreground text-center py-4">Select a voice from the Select Voice tab and click the <Globe className="inline h-4 w-4"/> icon to localize it.</p>
                    )}


                    <Button type="button" onClick={handleCreateAndSelect} className="w-full h-9 text-sm bg-green-600 hover:bg-green-700" disabled={disabled || isProcessingCreate || (createMode === 'localize' && !localizeBaseVoiceInfo)}>
                        {isProcessingCreate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Create & Select Voice
                    </Button>
                </TabsContent>
            </Tabs>
            {/* Audio element is managed by useTTSPreview hook */}
        </div>
    );
}