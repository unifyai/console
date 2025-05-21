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
    Voice as OrchestraVoice // Renamed to avoid confusion with Cartesia's concepts
} from '@/types/team/assistant';
import voicePresetsConstant from '@/constants/assistants/voice_presets.js';
import { Globe, Trash2, UploadCloud, Loader2, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import { SupportedLanguage, Gender as CartesiaGender, LocalizeTargetLanguage } from "@cartesia/cartesia-js/api";

// Language options for UI (ensure these are valid SupportedLanguage for Cartesia)
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

const genderOptions: { value: CartesiaGender; label: string }[] = [
    { value: "female", label: "Female" },
    { value: "male", label: "Male" },
    // Cartesia's Gender type doesn't include 'other', but originalSpeakerGender for localize does.
    // For cloning, Cartesia infers gender. For localization, it's required.
];
const cartesiaLocalizeGenderOptions: { value: CartesiaGender; label: string }[] = [
    { value: "female", label: "Female" },
    { value: "male", label: "Male" },
];


interface VoiceCustomizationProps {
    assistantActions: AssistantActions;
    onVoiceSelected: (voiceId: string | null, languageCode: SupportedLanguage | null) => void;
    initialVoiceId?: string | null;
    initialLanguageCode?: SupportedLanguage | string | null; // Allow string for initial prop flexibility
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
            id: vp.id, // Cartesia ID is the primary ID for presets
            language: vp.language as SupportedLanguage,
            gender: vp.gender as CartesiaGender,
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
    // Cartesia's clone 'mode' is fixed to 'stability' in this example, can be added if needed

    const [localizeBaseVoiceInfo, setLocalizeBaseVoiceInfo] = React.useState<VoiceOption | null>(null);
    const [localizeNewName, setLocalizeNewName] = React.useState('');
    const [localizeNewDescription, setLocalizeNewDescription] = React.useState('');
    const [localizeTargetLanguage, setLocalizeTargetLanguage] = React.useState<LocalizeTargetLanguage>('es');
    const [localizeOriginalGender, setLocalizeOriginalGender] = React.useState<CartesiaGender>('female');
    
    const [isProcessingCreate, setIsProcessingCreate] = React.useState(false);

    const fetchUserVoicesFromOrchestra = React.useCallback(async () => {
        setIsLoadingUserVoices(true);
        try {
            const result = await assistantActions.voice.listVoicesFromOrchestra();
            if (Array.isArray(result)) {
                setUserVoicesFromOrchestra(result.map((v: OrchestraVoice) => ({ 
                    id: v.voice_id, // This is Cartesia ID from your Orchestra
                    name: v.name,
                    description: v.description,
                    language: v.language as SupportedLanguage,
                    gender: v.gender as CartesiaGender,
                    isUserVoiceInOrchestra: true 
                })));
            } else {
                toast.error(result.detail || "Failed to load custom voices from Orchestra.");
                setUserVoicesFromOrchestra([]);
            }
        } catch (error: any) {
            toast.error(`Error loading custom voices: ${error.message}`);
        } finally {
            setIsLoadingUserVoices(false);
        }
    }, [assistantActions.voice]);

    React.useEffect(() => {
        fetchUserVoicesFromOrchestra();
    }, [fetchUserVoicesFromOrchestra]);
    
    React.useEffect(() => {
        setSelectedCartesiaVoiceId(initialVoiceId);
        if (initialVoiceId) setActiveTab('select');
    }, [initialVoiceId]);

    const handleSelectVoiceDisplay = (voice: VoiceOption) => {
        setSelectedCartesiaVoiceId(voice.id); // voice.id is Cartesia ID
        onVoiceSelected(voice.id, voice.language as SupportedLanguage);
    };

    const handleLocalizeRequest = (baseVoice: VoiceOption) => {
        setLocalizeBaseVoiceInfo(baseVoice);
        const targetLangDefault = languageOptions.find(l => l.value !== baseVoice.language)?.value || 'es';
        setLocalizeNewName(`${baseVoice.name} (${getLanguageLabel(targetLangDefault)})`);
        setLocalizeNewDescription(`Localized version of ${baseVoice.name} in ${getLanguageLabel(targetLangDefault)}`);
        setLocalizeTargetLanguage(targetLangDefault as LocalizeTargetLanguage);
        setLocalizeOriginalGender(baseVoice.gender === 'male' || baseVoice.gender === 'female' ? baseVoice.gender : 'female'); // Default if 'other'
        setCreateMode('localize');
        setActiveTab('create');
        setCloneFile(null); setCloneFileName(null); // Clear clone form state
    };

    const handleDeleteUserVoice = async (voiceToDelete: VoiceOption) => {
        if (!voiceToDelete.isUserVoiceInOrchestra || !voiceToDelete.id) return; // id is Cartesia ID
        const toastId = toast.loading(`Deleting voice "${voiceToDelete.name}"...`);
        try {
            // 1. Delete from Cartesia
            const cartesiaDeleteResult = await assistantActions.voice.deleteVoiceFromCartesia(voiceToDelete.id);
            if (cartesiaDeleteResult.detail && !(cartesiaDeleteResult.info?.includes("not found"))) { // Allow "not found" as success from Cartesia
                toast.error(cartesiaDeleteResult.detail, { id: toastId });
                return;
            }
            toast.success("Deleted from Cartesia (or already gone).", {id: toastId, duration: 1500});

            // 2. Delete from your Orchestra
            const dbDeleteResult = await assistantActions.voice.deleteVoiceFromOrchestra(voiceToDelete.id);
            if (dbDeleteResult.detail) {
                toast.error(`Orchestra record deletion failed: ${dbDeleteResult.detail}. Please check console. Voice may still exist on Cartesia.`, { id: toastId, duration: 5000 });
                return;
            }
            
            toast.success(`Voice "${voiceToDelete.name}" fully deleted.`, { id: toastId });
            fetchUserVoicesFromOrchestra(); 
            if (selectedCartesiaVoiceId === voiceToDelete.id) {
                setSelectedCartesiaVoiceId(null);
                onVoiceSelected(null, null);
            }
        } catch (error: any) {
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
        let cartesiaVoiceInfo: CartesiaVoiceInfo | null = null;
        const toastId = toast.loading("Creating voice on Cartesia...");

        try {
            if (createMode === 'clone') {
                if (!cloneFile || !cloneName || !cloneLanguage) {
                    toast.error("File, Name, and Language are required for cloning.", { id: toastId }); setIsProcessingCreate(false); return;
                }
                const formData = new FormData();
                formData.append('file', cloneFile);
                formData.append('name', cloneName);
                formData.append('description', cloneDescription);
                formData.append('language', cloneLanguage);
                // formData.append('mode', 'stability'); // If mode is configurable

                const result = await assistantActions.voice.cloneVoiceOnCartesia(formData);
                if ('detail' in result) { toast.error(result.detail, { id: toastId }); setIsProcessingCreate(false); return; }
                cartesiaVoiceInfo = result as CartesiaVoiceInfo;
            } else { // Localize
                if (!localizeBaseVoiceInfo || !localizeNewName || !localizeTargetLanguage || !localizeOriginalGender) {
                    toast.error("Base voice, New Name, Target Language, and Original Gender are required for localization.", { id: toastId }); setIsProcessingCreate(false); return;
                }
                const result = await assistantActions.voice.localizeVoiceOnCartesia(
                    localizeBaseVoiceInfo.id, localizeNewName, localizeNewDescription,
                    localizeTargetLanguage, localizeOriginalGender
                );
                if ('detail' in result) { toast.error(result.detail, { id: toastId }); setIsProcessingCreate(false); return; }
                cartesiaVoiceInfo = result as CartesiaVoiceInfo;
            }

            if (cartesiaVoiceInfo) {
                toast.success(`Voice "${cartesiaVoiceInfo.name}" created on Cartesia. Registering...`, { id: toastId });
                const dbResult = await assistantActions.voice.createVoiceInOrchestra(
                    cartesiaVoiceInfo.id, cartesiaVoiceInfo.name, cartesiaVoiceInfo.description || '',
                    cartesiaVoiceInfo.gender, cartesiaVoiceInfo.language
                );

                if ('detail' in dbResult) {
                    toast.error(`Failed to register voice in Orchestra: ${dbResult.detail}. Voice exists on Cartesia.`, { id: toastId, duration: 7000 });
                } else {
                    toast.success(`Voice "${dbResult.name}" fully created and selected!`, { id: toastId });
                    onVoiceSelected(dbResult.voice_id, dbResult.language as SupportedLanguage); // dbResult.voice_id is Cartesia ID
                    setSelectedCartesiaVoiceId(dbResult.voice_id);
                    fetchUserVoicesFromOrchestra();
                    resetCreateForm();
                    setActiveTab('select');
                }
            }
        } catch (error: any) {
            toast.error(`Creation failed: ${error.message}`, { id: toastId });
        } finally {
            setIsProcessingCreate(false);
        }
    };

    const VoiceListItem = ({ voice }: { voice: VoiceOption }) => (
        <div 
            className={cn("flex items-center gap-3 p-2.5 rounded-md hover:bg-muted cursor-pointer border items-center",
                selectedCartesiaVoiceId === voice.id ? "bg-primary text-white" : "border-transparent hover:border-muted-foreground/30"
            )}
            onClick={() => handleSelectVoiceDisplay(voice)}
        >
            <span className="text-lg">{getLanguageFlag(voice.language)}</span>
            <span className="flex-1 truncate font-medium text-sm" title={voice.name}>{voice.name}</span>
            {voice.description && (
                 <TooltipProvider delayDuration={100}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-60 hover:opacity-100" onClick={(e)=>e.stopPropagation()}><Info className="h-4 w-4"/></Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs"><p>{voice.description}</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e)=>{e.stopPropagation();handleLocalizeRequest(voice);}} title={`Localize "${voice.name}"`} disabled={disabled || isProcessingCreate}><Globe className="h-4 w-4" /></Button>
            {voice.isUserVoiceInOrchestra && (<Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive/90" onClick={(e)=>{e.stopPropagation();handleDeleteUserVoice(voice);}} title={`Delete "${voice.name}"`} disabled={disabled || isProcessingCreate}><Trash2 className="h-4 w-4" /></Button>)}
        </div>
    );

    return (
        <div className={cn("", disabled && "opacity-70 cursor-not-allowed")}>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'select' | 'create')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-9">
                    <TabsTrigger value="select" disabled={disabled}>Select Voice</TabsTrigger>
                    <TabsTrigger value="create" disabled={disabled}>Create Voice</TabsTrigger>
                </TabsList>

                <TabsContent value="select" className="mt-1">
                    <ScrollArea className="h-[200px] p-2 border rounded-md">
                        <div className="space-y-1.5"> {allDisplayableVoices.map(v => <VoiceListItem key={(v.isPreset ? 'p-' : v.isUserVoiceInOrchestra ? 'u-' : 'c-') + v.id} voice={v} />)} </div>
                        {!isLoadingUserVoices && allDisplayableVoices.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No voices. Try creating one.</p>}
                        {isLoadingUserVoices && <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin"/></div>}
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="create" className="mt-2 p-3 border rounded-md space-y-4">
                    
                    {createMode === 'clone' && (<>
                        <div> <Label htmlFor="clone-file" className="text-xs">Audio Clip (max 5s, .wav, .mp3)</Label>
                            {!cloneFileName 
                                ? (<label className="mt-1 flex justify-center w-full h-20 px-4 transition bg-background border-2 border-gray-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-gray-400 items-center disabled:opacity-50" aria-disabled={disabled||isProcessingCreate}> <span className="flex items-center space-x-2"> <UploadCloud className="w-5 h-5 text-gray-600" /> <span className="font-medium text-gray-600 text-sm">Drop or <span className="text-blue-600 underline">browse</span></span></span> <input type="file" id="clone-file" accept=".wav,.mp3" className="hidden" onChange={(e)=>{const f=e.target.files?.[0]; if(f){setCloneFile(f);setCloneFileName(f.name);}}} disabled={disabled||isProcessingCreate}/> </label>) 
                                : (<div className="mt-1 flex items-center justify-between p-2 border rounded-md bg-muted/50 text-sm"> <span className="truncate">{cloneFileName}</span> <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={()=>{setCloneFile(null);setCloneFileName(null);}} disabled={disabled||isProcessingCreate}><Trash2 className="h-4 w-4"/></Button> </div>)
                            }
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><Label htmlFor="clone-name" className="text-xs">Voice Name</Label><Input id="clone-name" value={cloneName} onChange={e=>setCloneName(e.target.value)} placeholder="e.g., My Clone" className="h-8 text-sm" disabled={disabled||isProcessingCreate}/></div>
                            <div> <Label htmlFor="clone-language" className="text-xs">Language of Clip</Label> <Select value={cloneLanguage} onValueChange={(v) => setCloneLanguage(v as SupportedLanguage)} disabled={disabled||isProcessingCreate}> <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Lang..." /></SelectTrigger> <SelectContent>{languageOptions.map(l=><SelectItem key={l.value} value={l.value} className="text-sm">{l.flag} {l.label}</SelectItem>)}</SelectContent> </Select> </div>
                        </div>
                        <div><Label htmlFor="clone-desc" className="text-xs">Description (Optional)</Label><Textarea id="clone-desc" value={cloneDescription} onChange={e=>setCloneDescription(e.target.value)} placeholder="Notes about this voice..." rows={2} className="text-sm" disabled={disabled||isProcessingCreate}/></div>
                    </>)}

                    {createMode === 'localize' && localizeBaseVoiceInfo && (<>
                        <div className="p-2 flex items-center border rounded-md bg-muted/50 text-sm"> 
                            Base Voice: 
                            <span className="font-semibold">{getLanguageFlag(localizeBaseVoiceInfo.language)} {localizeBaseVoiceInfo.name}</span> 
                            <Button variant="ghost" size="icon" className="h-6 w-6 ml-1 text-muted-foreground hover:text-destructive" onClick={() => resetCreateForm(true)} title="Cancel localization"><Trash2 className="h-3.5 w-3.5"/></Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><Label htmlFor="localize-name" className="text-xs">New Voice Name</Label><Input id="localize-name" value={localizeNewName} onChange={e=>setLocalizeNewName(e.target.value)} className="h-8 text-sm" disabled={disabled||isProcessingCreate}/></div>
                            <div> <Label htmlFor="localize-target-lang" className="text-xs">Target Language</Label> <Select value={localizeTargetLanguage} onValueChange={(v) => setLocalizeTargetLanguage(v as LocalizeTargetLanguage)} disabled={disabled||isProcessingCreate}> <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Target Lang..." /></SelectTrigger> <SelectContent>{languageOptions.filter(l => l.value !== localizeBaseVoiceInfo.language).map(l=><SelectItem key={l.value} value={l.value} className="text-sm">{l.flag} {l.label}</SelectItem>)}</SelectContent> </Select> </div>
                        </div>
                        <div> <Label htmlFor="localize-gender" className="text-xs">Original Speaker Gender</Label> <Select value={localizeOriginalGender} onValueChange={(v) => setLocalizeOriginalGender(v as CartesiaGender)} disabled={disabled||isProcessingCreate}> <SelectTrigger className="h-8 text-sm"><SelectValue/></SelectTrigger> <SelectContent>{cartesiaLocalizeGenderOptions.map(g=><SelectItem key={g.value} value={g.value} className="text-sm">{g.label}</SelectItem>)}</SelectContent> </Select> </div>
                        <div><Label htmlFor="localize-desc" className="text-xs">Description (Optional)</Label><Textarea id="localize-desc" value={localizeNewDescription} onChange={e=>setLocalizeNewDescription(e.target.value)} placeholder="Notes about localized voice..." rows={2} className="text-sm" disabled={disabled||isProcessingCreate}/></div>
                    </>)}
                    
                    <Button onClick={handleCreateAndSelect} className="w-full h-9 text-sm bg-green-600 hover:bg-green-700" disabled={disabled||isProcessingCreate}>
                        {isProcessingCreate ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle2 className="mr-2 h-4 w-4" /> } Create & Select Voice
                    </Button>
                </TabsContent>
            </Tabs>
        </div>
    );
}