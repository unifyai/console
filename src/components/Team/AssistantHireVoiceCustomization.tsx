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
    Voice
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

// Language-specific sample lines
const sampleTTSLinesByLanguage: Record<SupportedLanguage | string, string[]> = {
    en: [
        "Hello, how can I assist you today?",
        "I'm here to help with any questions you might have.",
        "The weather today is quite pleasant, isn't it?",
    ],
    es: [
        "Hola, ¿en qué puedo ayudarte hoy?",
        "Estoy aquí para ayudar con cualquier pregunta que puedas tener.",
        "El clima hoy es bastante agradable, ¿no es así?",
    ],
    fr: [
        "Bonjour, comment puis-je vous aider aujourd'hui?",
        "Je suis là pour répondre à toutes vos questions.",
        "Le temps aujourd'hui est plutôt agréable, n'est-ce pas?",
    ],
    de: [
        "Hallo, wie kann ich Ihnen heute helfen?",
        "Ich bin hier, um bei allen Fragen zu helfen, die Sie möglicherweise haben.",
        "Das Wetter heute ist ziemlich angenehm, nicht wahr?",
    ],
    // Add more languages and 3 lines for each
    ja: [
        "こんにちは、今日はどのようにお手伝いできますか？",
        "ご不明な点がございましたら、お気軽にお問い合わせください。",
        "今日の天気はとても気持ちがいいですね。",
    ],
    zh: [
        "你好，今天我能为你做些什么？",
        "如果您有任何问题，我随时在这里提供帮助。",
        "今天的天气真不错，不是吗？",
    ],
    // Fallback for languages not explicitly defined
    default: [
        "This is a test sentence.",
        "Can you hear my voice clearly?",
        "I hope you have a wonderful day!",
    ]
};

const getRandomSampleLine = (language: SupportedLanguage): string => {
    const lines = sampleTTSLinesByLanguage[language] || sampleTTSLinesByLanguage.default;
    return lines[Math.floor(Math.random() * lines.length)];
};


interface VoiceCustomizationProps {
    assistantActions: AssistantActions;
    onVoiceSelected: (selectedVoice: VoiceOption | null) => void;
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
        (voicePresetsConstant as Voice[]).map(vp => ({ 
            ...vp, 
            id: vp.voice_id, 
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
                setUserVoicesFromOrchestra(result.map((v: Voice) => ({ 
                    voice_id: v.voice_id, 
                    name: v.name,
                    description: v.description,
                    language: v.language as SupportedLanguage,
                    gender: v.gender as CartesiaGender,
                    isUserVoiceInOrchestra: true 
                })));
            } else {
                console.error(result.detail || "Failed to load custom voices.");
                setUserVoicesFromOrchestra([]);
            }
        } catch (error: any) { console.error(`Error loading voices: ${error.message}`);
        } finally { setIsLoadingUserVoices(false); }
    }, [assistantActions.voice]);

    React.useEffect(() => { fetchUserVoicesFromOrchestra(); }, [fetchUserVoicesFromOrchestra]);
    
    React.useEffect(() => {
        setSelectedCartesiaVoiceId(initialVoiceId);
        if (initialVoiceId) setActiveTab('select');
    }, [initialVoiceId]);

    const handleSelectVoiceDisplay = (voice: VoiceOption) => {
        setSelectedCartesiaVoiceId(voice.voice_id); 
        onVoiceSelected({...voice, isUserVoiceInOrchestra: userVoicesFromOrchestra.map(v => v.voice_id).includes(voice.voice_id)});
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
        if (!voiceToDelete.isUserVoiceInOrchestra || !voiceToDelete.voice_id) return;
        const toastId = toast.loading(`Deleting voice "${voiceToDelete.name}"...`);
        try {
            const cartesiaDeleteResult = await assistantActions.voice.deleteVoiceFromCartesia(voiceToDelete.voice_id);
            if (cartesiaDeleteResult.detail && !(cartesiaDeleteResult.info?.includes("not found"))) {
                console.error("[VoiceCustomization.tsx] Error deleting voice:", cartesiaDeleteResult.detail); 
                toast.error(cartesiaDeleteResult.detail, { id: toastId }); 
                return;
            }
            const dbDeleteResult = await assistantActions.voice.deleteVoiceFromOrchestra(voiceToDelete.voice_id);
            if (dbDeleteResult.detail) {
                console.error("[VoiceCustomization.tsx] Error deleting voice:", cartesiaDeleteResult.detail); 
                toast.error(`Error deleting voice: ${dbDeleteResult.detail}.`, { id: toastId, duration: 5000 }); return;
            }
            toast.success(`Voice "${voiceToDelete.name}" deleted.`, { id: toastId });
            fetchUserVoicesFromOrchestra(); 
            if (selectedCartesiaVoiceId === voiceToDelete.voice_id) { setSelectedCartesiaVoiceId(null); onVoiceSelected(null); }
        } catch (error: any) { 
            console.error("[VoiceCustomization.tsx] Error deleting voice:", error.message); 
            toast.error(`Error deleting voice: ${error.message}`, { id: toastId }); 
        }
    };
    
    const resetCreateForm = (switchToCloneMode: boolean = true) => {
        setCloneFile(null); setCloneFileName(null); setCloneName(''); setCloneDescription(''); setCloneLanguage('en');
        setLocalizeBaseVoiceInfo(null); setLocalizeNewName(''); setLocalizeNewDescription(''); setLocalizeTargetLanguage('es');
        if (switchToCloneMode) setCreateMode('clone');
    };

    const handleCreateAndSelect = async () => {
        setIsProcessingCreate(true);
        let cartesiaOpResult: Voice | ResponseProps | null = null;
        const toastId = toast.loading("Creating voice...");

        try {
            // --- Create voice in Cartesia through localization or cloning
            if (createMode === 'clone') {
                if (!cloneFile||!cloneName||!cloneLanguage) { toast.error("File, Name, Language required.", {id:toastId}); setIsProcessingCreate(false); return; }
                const formData = new FormData();
                formData.append('file', cloneFile); formData.append('name', cloneName);
                formData.append('description', cloneDescription); formData.append('language', cloneLanguage);
                cartesiaOpResult = await assistantActions.voice.cloneVoiceOnCartesia(formData);
            } else { 
                if (!localizeBaseVoiceInfo||!localizeNewName||!localizeTargetLanguage||!localizeOriginalGender) { toast.error("Base voice, Name, Target Language, Gender required.", {id:toastId}); setIsProcessingCreate(false); return; }
                cartesiaOpResult = await assistantActions.voice.localizeVoiceOnCartesia(
                    localizeBaseVoiceInfo.voice_id, localizeNewName, localizeNewDescription,
                    localizeTargetLanguage, localizeOriginalGender
                );
            }

            // --- Create voice in orchestra from new Cartesia voice
            if (cartesiaOpResult && 'voice_id' in cartesiaOpResult) { 
                const cartesiaInfo = cartesiaOpResult as Voice;
                const dbResult = await assistantActions.voice.createVoiceInOrchestra(
                    cartesiaInfo.voice_id, cartesiaInfo.name, cartesiaInfo.description || '',
                    cartesiaInfo.gender, cartesiaInfo.language
                );

                if ('detail' in dbResult) { 
                    console.error(`[VoiceCustomization.tsx] Error creating voice in orchestra: ${dbResult.detail}.`, { id: toastId, duration: 7000 });
                    toast.error(`Error creating voice: ${dbResult.detail}.`, { id: toastId, duration: 7000 });
                } else {
                    toast.success(`Voice "${(dbResult as Voice).name}" created & selected!`, { id: toastId });
                    onVoiceSelected({
                        voice_id: (dbResult as Voice).voice_id,
                        name: (dbResult as Voice).name,
                        gender: (dbResult as Voice).gender as CartesiaGender,
                        language: (dbResult as Voice).language as SupportedLanguage,
                        description: (dbResult as Voice).description,
                        isUserVoiceInOrchestra: true
                    }); 
                    setSelectedCartesiaVoiceId((dbResult as Voice).voice_id);
                    fetchUserVoicesFromOrchestra(); resetCreateForm(); setActiveTab('select');
                }

            } else { 
                console.error("[VoiceCustomization.tsx] Error creating voice", (cartesiaOpResult as ResponseProps).detail);
                toast.error("Error creating voice", { id: toastId });
            }

        } catch (error: any) { 
            console.error("[VoiceCustomization.tsx] Error creating voice", error.message);
            toast.error(`Error creating voice`, { id: toastId });
        } finally { setIsProcessingCreate(false); }
    };

    const handlePlayVoicePreview = async (voice: VoiceOption) => {
        if (isPlayingPreviewForVoiceId === voice.voice_id) { 
            if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
            setIsPlayingPreviewForVoiceId(null); return;
        }
        if (audioRef.current && !audioRef.current.paused) audioRef.current.pause();

        const randomLine = getRandomSampleLine(voice.language);
        setIsPlayingPreviewForVoiceId(voice.voice_id);
        try {
            const response = await fetch(`/api/voices/tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cartesiaVoiceId: voice.voice_id, text: randomLine, language: voice.language })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: "TTS generation failed" }));
                setIsPlayingPreviewForVoiceId(null); return;
            }
            
            const blob = await response.blob();
            if (blob.size === 0) {
                setIsPlayingPreviewForVoiceId(null); return;
            }

            const audioURL = URL.createObjectURL(blob);
            if (audioRef.current) {
                audioRef.current.src = audioURL;
                audioRef.current.play().catch(e => { 
                    console.error(`[VoiceCustomization.tsx] TTS Error: {e.message}`)
                    setIsPlayingPreviewForVoiceId(null); 
                });
                audioRef.current.onended = () => { setIsPlayingPreviewForVoiceId(null); URL.revokeObjectURL(audioURL); };
            }
        } catch (e:any) { 
            console.error(`[VoiceCustomization.tsx] TTS Error: ${e.message}`); 
            setIsPlayingPreviewForVoiceId(null); }
    };

    const VoiceListItem = ({ voice }: { voice: VoiceOption }) => {
        const isSelected = selectedCartesiaVoiceId === voice.voice_id;
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
                            {isPlayingPreviewForVoiceId === voice.voice_id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Play className="h-4 w-4" />}
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
                        <div className="space-y-1"> {allDisplayableVoices.map(v => <VoiceListItem key={(v.isPreset ? 'p-' : v.isUserVoiceInOrchestra ? 'u-' : 'c-') + v.voice_id} voice={v} />)} </div>
                        {isLoadingUserVoices && <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin"/></div>}
                        {!isLoadingUserVoices && allDisplayableVoices.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No voices. Try creating one.</p>}
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="create" className="p-3 border rounded-md space-y-3">
                    
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
                        <div className="py-1 px-2 border rounded-md bg-muted/50 text-sm h-9 flex items-center justify-between"> 
                            <div className="flex items-center">
                                <span>Base Voice: </span> 
                                <span className="font-semibold ml-1">{getLanguageFlag(localizeBaseVoiceInfo.language)} {localizeBaseVoiceInfo.name}</span> 
                            </div>
                            <TooltipProvider delayDuration={100}>
                                <Tooltip><TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 ml-1 text-muted-foreground hover:text-destructive" onClick={() => resetCreateForm(true)} >
                                        <Trash2 className="h-4 w-4"/>
                                    </Button>
                                </TooltipTrigger><TooltipContent side="top" className="max-w-xs text-sm"><p>Cancel localization</p></TooltipContent></Tooltip>
                            </TooltipProvider>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div><Label htmlFor="localize-name" className="text-xs">New Voice Name</Label><Input id="localize-name" value={localizeNewName} onChange={e=>setLocalizeNewName(e.target.value)} className="h-8 text-sm" disabled={disabled||isProcessingCreate}/></div>
                            <div> <Label htmlFor="localize-target-lang" className="text-xs">Target Language</Label> <Select value={localizeTargetLanguage} onValueChange={(v) => setLocalizeTargetLanguage(v as LocalizeTargetLanguage)} disabled={disabled||isProcessingCreate}> <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Target Lang..." /></SelectTrigger> <SelectContent>{languageOptions.filter(l => l.value !== localizeBaseVoiceInfo.language).map(l=><SelectItem key={l.value} value={l.value} className="text-sm">{l.flag} {l.label}</SelectItem>)}</SelectContent> </Select> </div>
                        </div>
                        <div> <Label htmlFor="localize-gender" className="text-xs">Original Speaker Gender</Label> <Select value={localizeOriginalGender} onValueChange={(v) => setLocalizeOriginalGender(v as CartesiaGender)} disabled={true}> <SelectTrigger className="h-8 text-sm"><SelectValue/></SelectTrigger> <SelectContent>{cartesiaLocalizeGenderOptions.map(g=><SelectItem key={g.value} value={g.value} className="text-sm">{g.label}</SelectItem>)}</SelectContent> </Select> </div>
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