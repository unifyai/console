'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/UI/tabs";
import { ScrollArea } from "@/components/UI/scroll-area";
import { Button } from "@/components/UI/button";
import { Input } from "@/components/UI/input";
import { Textarea } from "@/components/UI/textarea";
import { Label } from "@/components/UI/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/UI/select";
import { 
    AssistantActions, 
    VoiceOption, 
    CartesiaVoiceInfo,
    Voice as OrchestraVoiceRecord // Represents a voice record from your Orchestra DB
} from '@/types/team/assistant';
import voicePresetsConstant from '@/constants/assistants/voice_presets.js';
import { Globe, Trash2, UploadCloud, Loader2, Info, CheckCircle2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import { SupportedLanguage, Gender as CartesiaGender, LocalizeTargetLanguage } from "@cartesia/cartesia-js/api";
import { ResponseProps } from '@/types/common';

const languageOptions: { value: SupportedLanguage; label: string; flag: string }[] = [
    { value: "en", label: "English", flag: "🇬🇧" }, { value: "es", label: "Spanish", flag: "🇪🇸" },
    { value: "fr", label: "French", flag: "🇫🇷" }, { value: "de", label: "German", flag: "🇩🇪" },
    { value: "pt", label: "Portuguese", flag: "🇵🇹" }, { value: "it", label: "Italian", flag: "🇮🇹" },
    { value: "pl", label: "Polish", flag: "🇵🇱" }, { value: "ja", label: "Japanese", flag: "🇯🇵" },
    { value: "hi", label: "Hindi", flag: "🇮🇳" }, { value: "zh", label: "Chinese", flag: "🇨🇳" },
    { value: "ko", label: "Korean", flag: "🇰🇷" }, { value: "nl", label: "Dutch", flag: "🇳🇱" },
    { value: "ru", label: "Russian", flag: "🇷🇺" }, { value: "sv", label: "Swedish", flag: "🇸🇪" },
    { value: "tr", label: "Turkish", flag: "🇹🇷" },
];

const getLanguageFlag = (langCode: string | undefined) => languageOptions.find(l => l.value === langCode)?.flag || "🏳️";
const getLanguageLabel = (langCode: string | undefined) => languageOptions.find(l => l.value === langCode)?.label || langCode?.toUpperCase() || "N/A";

const cartesiaLocalizeGenderOptions: { value: CartesiaGender; label: string }[] = [
    { value: "female", label: "Female" }, { value: "male", label: "Male" },
];

const sampleTTSLines = [
    "Hello, how can I assist you today?",
    "I'm here to help with any questions you might have.",
    "The weather today is quite pleasant, isn't it?",
    "Please tell me more about what you're looking for.",
    "Let's work together to find a solution."
];

interface VoiceCustomizationProps {
    assistantActions: AssistantActions;
    onVoiceSelected: (voiceId: string | null, languageCode: SupportedLanguage | null) => void;
    initialVoiceId?: string | null;
    initialLanguageCode?: SupportedLanguage | string | null; 
    disabled?: boolean;
}

type CreateMode = 'clone' | 'localize';

export function VoiceCustomization({
    assistantActions,
    onVoiceSelected,
    initialVoiceId = null,
    initialLanguageCode = null,
    disabled = false,
}: VoiceCustomizationProps) {
    const [activeTab, setActiveTab] = React.useState<'select' | 'create'>('select');
    const [selectedCartesiaVoiceId, setSelectedCartesiaVoiceId] = React.useState<string | null>(initialVoiceId);

    const [presetVoices] = React.useState<VoiceOption[]>(
        (voicePresetsConstant as CartesiaVoiceInfo[]).map(vp => ({ 
            ...vp, 
            id: vp.id, 
            language: vp.language,
            gender: vp.gender,
            isPreset: true 
        }))
    );
    const [userVoicesFromOrchestra, setUserVoicesFromOrchestra] = React.useState<VoiceOption[]>([]);
    const [isLoadingUserVoices, setIsLoadingUserVoices] = React.useState(false);
    
    const allDisplayableVoices = React.useMemo(() => {
        const combined = [...presetVoices, ...userVoicesFromOrchestra];
        combined.sort((a, b) => {
            if (a.isPreset && !b.isUserVoiceInOrchestra) return -1;
            if (!a.isPreset && b.isUserVoiceInOrchestra) return 1;
            return (a.name || 'Unnamed Voice').localeCompare(b.name || 'Unnamed Voice');
        });
        return combined;
    }, [presetVoices, userVoicesFromOrchestra]);

    // Create Voice Tab State
    const [createMode, setCreateMode] = React.useState<CreateMode>('clone');
    const [cloneFile, setCloneFile] = React.useState<File | null>(null);
    const [cloneFileName, setCloneFileName] = React.useState<string | null>(null);
    const [cloneName, setCloneName] = React.useState('');
    const [cloneDescription, setCloneDescription] = React.useState('');
    const [cloneLanguage, setCloneLanguage] = React.useState<SupportedLanguage>('en');

    const [localizeBaseVoiceInfo, setLocalizeBaseVoiceInfo] = React.useState<VoiceOption | null>(null);
    const [localizeNewName, setLocalizeNewName] = React.useState('');
    const [localizeNewDescription, setLocalizeNewDescription] = React.useState('');
    const [localizeTargetLanguage, setLocalizeTargetLanguage] = React.useState<LocalizeTargetLanguage>('es');
    const [localizeOriginalGender, setLocalizeOriginalGender] = React.useState<CartesiaGender>('female');
    
    const [isProcessingCreate, setIsProcessingCreate] = React.useState(false);
    const [isPlayingPreviewForVoiceId, setIsPlayingPreviewForVoiceId] = React.useState<string | null>(null);
    const audioRef = React.useRef<HTMLAudioElement | null>(null);


    const fetchUserVoicesFromOrchestra = React.useCallback(async () => {
        setIsLoadingUserVoices(true);
        try {
            const result = await assistantActions.voice.listVoicesFromOrchestra();
            if (Array.isArray(result)) {
                setUserVoicesFromOrchestra(result.map((v: OrchestraVoiceRecord) => ({ 
                    id: v.voice_id, 
                    name: v.name,
                    description: v.description,
                    language: v.language as SupportedLanguage,
                    gender: v.gender as CartesiaGender,
                    isUserVoiceInOrchestra: true 
                })));
            } else {
                toast.error(result.detail || "Failed to load custom voices."); setUserVoicesFromOrchestra([]);
            }
        } catch (error: any) { toast.error(`Error loading voices: ${error.message}`);
        } finally { setIsLoadingUserVoices(false); }
    }, [assistantActions.voice]);

    React.useEffect(() => { fetchUserVoicesFromOrchestra(); }, [fetchUserVoicesFromOrchestra]);
    
    React.useEffect(() => {
        setSelectedCartesiaVoiceId(initialVoiceId);
        if (initialVoiceId) setActiveTab('select');
    }, [initialVoiceId]);

    const handleSelectVoiceDisplay = (voice: VoiceOption) => {
        setSelectedCartesiaVoiceId(voice.id); 
        onVoiceSelected(voice.id, voice.language as SupportedLanguage);
    };

    const handleLocalizeRequest = (baseVoice: VoiceOption) => {
        setLocalizeBaseVoiceInfo(baseVoice);
        const targetLangDefault = languageOptions.find(l => l.value !== baseVoice.language)?.value || 'es';
        setLocalizeNewName(`${baseVoice.name} (${getLanguageLabel(targetLangDefault)})`);
        setLocalizeNewDescription(`Localized version of ${baseVoice.name} in ${getLanguageLabel(targetLangDefault)}`);
        setLocalizeTargetLanguage(targetLangDefault as LocalizeTargetLanguage);
        setLocalizeOriginalGender(baseVoice.gender === 'male' || baseVoice.gender === 'female' ? baseVoice.gender : 'female');
        setCreateMode('localize'); setActiveTab('create');
        setCloneFile(null); setCloneFileName(null);
    };

    const handleDeleteUserVoice = async (voiceToDelete: VoiceOption) => {
        if (!voiceToDelete.isUserVoiceInOrchestra || !voiceToDelete.id) return;
        const toastId = toast.loading(`Deleting voice "${voiceToDelete.name}"...`);
        try {
            const cartesiaDeleteResult = await assistantActions.voice.deleteVoiceFromCartesia(voiceToDelete.id);
            if (cartesiaDeleteResult.detail && !(cartesiaDeleteResult.info?.includes("not found"))) {
                toast.error(cartesiaDeleteResult.detail, { id: toastId }); return;
            }
            const dbDeleteResult = await assistantActions.voice.deleteVoiceFromOrchestra(voiceToDelete.id);
            if (dbDeleteResult.detail) {
                toast.error(`DB record deletion failed: ${dbDeleteResult.detail}.`, { id: toastId, duration: 5000 }); return;
            }
            toast.success(`Voice "${voiceToDelete.name}" deleted.`, { id: toastId });
            fetchUserVoicesFromOrchestra(); 
            if (selectedCartesiaVoiceId === voiceToDelete.id) { setSelectedCartesiaVoiceId(null); onVoiceSelected(null, null); }
        } catch (error: any) { toast.error(`Error deleting voice: ${error.message}`, { id: toastId }); }
    };
    
    const resetCreateForm = (switchToCloneMode: boolean = true) => {
        setCloneFile(null); setCloneFileName(null); setCloneName(''); setCloneDescription(''); setCloneLanguage('en');
        setLocalizeBaseVoiceInfo(null); setLocalizeNewName(''); setLocalizeNewDescription(''); setLocalizeTargetLanguage('es');
        if (switchToCloneMode) setCreateMode('clone');
    };

    const handleCreateAndSelect = async () => {
        setIsProcessingCreate(true);
        let cartesiaOpResult: CartesiaVoiceInfo | ResponseProps | null = null;
        const toastId = toast.loading("Creating voice on Cartesia...");

        try {
            if (createMode === 'clone') {
                if (!cloneFile||!cloneName||!cloneLanguage) { toast.error("File, Name, Language required.", {id:toastId}); setIsProcessingCreate(false); return; }
                const formData = new FormData();
                formData.append('file', cloneFile); formData.append('name', cloneName);
                formData.append('description', cloneDescription); formData.append('language', cloneLanguage);
                cartesiaOpResult = await assistantActions.voice.cloneVoiceOnCartesia(formData);
            } else { 
                if (!localizeBaseVoiceInfo||!localizeNewName||!localizeTargetLanguage||!localizeOriginalGender) { toast.error("Base voice, Name, Target Language, Gender required.", {id:toastId}); setIsProcessingCreate(false); return; }
                cartesiaOpResult = await assistantActions.voice.localizeVoiceOnCartesia(
                    localizeBaseVoiceInfo.id, localizeNewName, localizeNewDescription,
                    localizeTargetLanguage, localizeOriginalGender
                );
            }

            if (cartesiaOpResult && 'id' in cartesiaOpResult) { // Successfully created/localized on Cartesia
                const cartesiaInfo = cartesiaOpResult as CartesiaVoiceInfo;
                toast.success(`Voice "${cartesiaInfo.name}" on Cartesia. Registering...`, { id: toastId });
                const dbResult = await assistantActions.voice.createVoiceInOrchestra(
                    cartesiaInfo.id, cartesiaInfo.name, cartesiaInfo.description || '',
                    cartesiaInfo.gender, cartesiaInfo.language
                );

                if ('detail' in dbResult) { toast.error(`DB registration failed: ${dbResult.detail}.`, { id: toastId, duration: 7000 });
                } else {
                    toast.success(`Voice "${dbResult.name}" fully created & selected!`, { id: toastId });
                    onVoiceSelected(dbResult.voice_id, dbResult.language as SupportedLanguage); 
                    setSelectedCartesiaVoiceId(dbResult.voice_id);
                    fetchUserVoicesFromOrchestra(); resetCreateForm(); setActiveTab('select');
                }
            } else if (cartesiaOpResult && 'detail' in cartesiaOpResult) { toast.error((cartesiaOpResult as ResponseProps).detail, { id: toastId });
            } else { toast.error("Unknown error from Cartesia operation.", { id: toastId }); }
        } catch (error: any) { toast.error(`Creation failed: ${error.message}`, { id: toastId });
        } finally { setIsProcessingCreate(false); }
    };

    const handlePlayVoicePreview = async (voice: VoiceOption) => {
        if (isPlayingPreviewForVoiceId === voice.id) { // If same voice is playing, stop it
            if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
            setIsPlayingPreviewForVoiceId(null); return;
        }
        if (audioRef.current && !audioRef.current.paused) audioRef.current.pause(); // Stop any other playing preview

        const randomLine = sampleTTSLines[Math.floor(Math.random() * sampleTTSLines.length)];
        setIsPlayingPreviewForVoiceId(voice.id);
        const toastId = toast.loading(`Generating preview for "${voice.name}"...`);
        try {
            const result = await assistantActions.voice.generateTTS(voice.id, randomLine, voice.language);
            if (result instanceof Blob) {
                const audioURL = URL.createObjectURL(result);
                if (audioRef.current) {
                    audioRef.current.src = audioURL;
                    audioRef.current.play().catch(e => { toast.error("Audio play error.", { id: toastId }); setIsPlayingPreviewForVoiceId(null); });
                    audioRef.current.onended = () => { setIsPlayingPreviewForVoiceId(null); URL.revokeObjectURL(audioURL); };
                }
                toast.dismiss(toastId); // Or success: "Preview ready."
            } else { toast.error(result.detail || "TTS failed.", { id: toastId }); setIsPlayingPreviewForVoiceId(null); }
        } catch (e:any) { toast.error(`TTS Error: ${e.message}`,{id:toastId}); setIsPlayingPreviewForVoiceId(null); }
    };


    const VoiceListItem = ({ voice }: { voice: VoiceOption }) => {
        const isSelected = selectedCartesiaVoiceId === voice.id;
        return (
        <div 
            className={cn("flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer border",
                isSelected ? "bg-primary text-primary-foreground border-primary" : "border-transparent hover:border-muted-foreground/30"
            )}
            onClick={() => handleSelectVoiceDisplay(voice)}
        >
            <span className="text-md">{getLanguageFlag(voice.language)}</span>
            <span className="flex-1 truncate font-medium text-sm" title={voice.name}>{voice.name}</span>
            
            <div className={cn("flex items-center p-0 m-0 gap-2 justify-between", isSelected ? "text-primary-foreground" : "text-muted-foreground")}>
                <TooltipProvider delayDuration={100}>
                    <Tooltip><TooltipTrigger asChild>
                        <span className={cn("cursor-default p-1 mr-1 rounded-md", isSelected ? "hover:bg-primary/80" : "hover:bg-muted-foreground/10")} onClick={(e)=>e.stopPropagation()}>
                             <Info className={cn("h-4 w-4", isSelected ? "text-primary-foreground" : "text-muted-foreground")} />
                        </span>
                    </TooltipTrigger><TooltipContent side="top" className="max-w-xs text-sm"><p>{voice.description || "No description."}</p></TooltipContent></Tooltip>
                </TooltipProvider>

                <TooltipProvider delayDuration={100}>
                    <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className={cn("h-7 w-7", isSelected ? "text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground" : "text-muted-foreground hover:text-green-600 hover:bg-green-600/10" )} onClick={(e)=>{e.stopPropagation();handlePlayVoicePreview(voice);}} disabled={disabled || isProcessingCreate}>
                            {isPlayingPreviewForVoiceId === voice.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Play className="h-4 w-4" />}
                        </Button>
                    </TooltipTrigger><TooltipContent side="top" className="max-w-xs text-sm"><p>{`Preview "${voice.name}"`}</p></TooltipContent></Tooltip>
                </TooltipProvider>

                <TooltipProvider delayDuration={100}>
                    <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className={cn("h-7 w-7", isSelected ? "text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground" : "text-muted-foreground hover:text-green-600 hover:bg-green-600/10" )} onClick={(e)=>{e.stopPropagation();handleLocalizeRequest(voice);}} disabled={disabled || isProcessingCreate}><Globe className="h-4 w-4" /></Button>
                    </TooltipTrigger><TooltipContent side="top" className="max-w-xs text-sm"><p>{`Localize "${voice.name}"`}</p></TooltipContent></Tooltip>
                </TooltipProvider>
                
                {voice.isUserVoiceInOrchestra && (
                    <TooltipProvider delayDuration={100}>
                        <Tooltip><TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className={cn("h-7 w-7", isSelected ? "text-primary-foreground hover:bg-destructive/80 hover:text-primary-foreground" : "text-muted-foreground hover:text-destructive hover:bg-destructive/10" )} onClick={(e)=>{e.stopPropagation();handleDeleteUserVoice(voice);}} disabled={disabled || isProcessingCreate}><Trash2 className="h-4 w-4" /></Button>
                        </TooltipTrigger><TooltipContent side="top" className="max-w-xs text-sm"><p>{`Delete "${voice.name}"`}</p></TooltipContent></Tooltip>
                    </TooltipProvider>
                )}
            </div>
        </div>
    )};


    return (
        <div className={cn("", disabled && "opacity-70 cursor-not-allowed")}>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'select' | 'create')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-9">
                    <TabsTrigger value="select" disabled={disabled}>Select Voice</TabsTrigger>
                    <TabsTrigger value="create" disabled={disabled}>Create Voice</TabsTrigger>
                </TabsList>

                <TabsContent value="select" className="mt-1">
                    <ScrollArea className="h-[200px] p-2 border rounded-md">
                        <div className="space-y-1"> {allDisplayableVoices.map(v => <VoiceListItem key={(v.isPreset ? 'p-' : v.isUserVoiceInOrchestra ? 'u-' : 'c-') + v.id} voice={v} />)} </div>
                        {isLoadingUserVoices && <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin"/></div>}
                        {!isLoadingUserVoices && allDisplayableVoices.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No voices. Try creating one.</p>}
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="create" className="mt-2 p-3 border rounded-md space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground mb-0.5 flex items-center">
                        {createMode === 'clone' ? 'Clone Voice from Audio Clip' : `Localize: ${localizeBaseVoiceInfo?.name || 'N/A'}`}
                         {createMode === 'localize' && <Button variant="ghost" size="icon" className="h-6 w-6 ml-1 text-muted-foreground hover:text-destructive" onClick={() => resetCreateForm(true)} title="Cancel localization"><Trash2 className="h-3.5 w-3.5"/></Button>}
                    </h4>
                    
                    {createMode === 'clone' && (<>
                        <div> <Label htmlFor="clone-file" className="text-xs">Audio Clip (max 5s, .wav, .mp3)</Label>
                            {!cloneFileName ? (<label className="mt-0.5 flex justify-center w-full h-16 px-4 transition bg-background border-2 border-gray-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-gray-400 items-center disabled:opacity-50" aria-disabled={disabled||isProcessingCreate}> <span className="flex items-center space-x-2"> <UploadCloud className="w-5 h-5 text-gray-600" /> <span className="font-medium text-gray-600 text-sm">Drop or <span className="text-blue-600 underline">browse</span></span></span> <input type="file" id="clone-file" accept=".wav,.mp3" className="hidden" onChange={(e)=>{const f=e.target.files?.[0]; if(f){setCloneFile(f);setCloneFileName(f.name);}}} disabled={disabled||isProcessingCreate}/> </label>) 
                            : (<div className="mt-0.5 flex items-center justify-between p-1.5 border rounded-md bg-muted/50 text-sm h-9"> <span className="truncate">{cloneFileName}</span> <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={()=>{setCloneFile(null);setCloneFileName(null);}} disabled={disabled||isProcessingCreate}><Trash2 className="h-4 w-4"/></Button> </div>)}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div><Label htmlFor="clone-name" className="text-xs">Voice Name</Label><Input id="clone-name" value={cloneName} onChange={e=>setCloneName(e.target.value)} placeholder="e.g., My Clone" className="h-8 text-sm" disabled={disabled||isProcessingCreate}/></div>
                            <div> <Label htmlFor="clone-language" className="text-xs">Language of Clip</Label> <Select value={cloneLanguage} onValueChange={(v) => setCloneLanguage(v as SupportedLanguage)} disabled={disabled||isProcessingCreate}> <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Lang..." /></SelectTrigger> <SelectContent>{languageOptions.map(l=><SelectItem key={l.value} value={l.value} className="text-sm">{l.flag} {l.label}</SelectItem>)}</SelectContent> </Select> </div>
                        </div>
                        <div><Label htmlFor="clone-desc" className="text-xs">Description (Optional)</Label><Textarea id="clone-desc" value={cloneDescription} onChange={e=>setCloneDescription(e.target.value)} placeholder="Notes about this voice..." rows={2} className="text-sm min-h-[50px]" disabled={disabled||isProcessingCreate}/></div>
                    </>)}

                    {createMode === 'localize' && localizeBaseVoiceInfo && (<>
                        <div className="p-1.5 border rounded-md bg-muted/50 text-sm h-9 flex items-center"> Base Voice: <span className="font-semibold ml-1">{getLanguageFlag(localizeBaseVoiceInfo.language)} {localizeBaseVoiceInfo.name}</span> </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div><Label htmlFor="localize-name" className="text-xs">New Voice Name</Label><Input id="localize-name" value={localizeNewName} onChange={e=>setLocalizeNewName(e.target.value)} className="h-8 text-sm" disabled={disabled||isProcessingCreate}/></div>
                            <div> <Label htmlFor="localize-target-lang" className="text-xs">Target Language</Label> <Select value={localizeTargetLanguage} onValueChange={(v) => setLocalizeTargetLanguage(v as LocalizeTargetLanguage)} disabled={disabled||isProcessingCreate}> <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Target Lang..." /></SelectTrigger> <SelectContent>{languageOptions.filter(l => l.value !== localizeBaseVoiceInfo.language).map(l=><SelectItem key={l.value} value={l.value} className="text-sm">{l.flag} {l.label}</SelectItem>)}</SelectContent> </Select> </div>
                        </div>
                        <div> <Label htmlFor="localize-gender" className="text-xs">Original Speaker Gender</Label> <Select value={localizeOriginalGender} onValueChange={(v) => setLocalizeOriginalGender(v as CartesiaGender)} disabled={disabled||isProcessingCreate}> <SelectTrigger className="h-8 text-sm"><SelectValue/></SelectTrigger> <SelectContent>{cartesiaLocalizeGenderOptions.map(g=><SelectItem key={g.value} value={g.value} className="text-sm">{g.label}</SelectItem>)}</SelectContent> </Select> </div>
                        <div><Label htmlFor="localize-desc" className="text-xs">Description (Optional)</Label><Textarea id="localize-desc" value={localizeNewDescription} onChange={e=>setLocalizeNewDescription(e.target.value)} placeholder="Notes about localized voice..." rows={2} className="text-sm min-h-[50px]" disabled={disabled||isProcessingCreate}/></div>
                    </>)}
                    
                    <Button onClick={handleCreateAndSelect} className="w-full h-9 text-sm bg-green-600 hover:bg-green-700" disabled={disabled||isProcessingCreate}>
                        {isProcessingCreate ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle2 className="mr-2 h-4 w-4" /> } Create & Select Voice
                    </Button>
                </TabsContent>
            </Tabs>
            <audio ref={audioRef} className="hidden" />
        </div>
    );
}