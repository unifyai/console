import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/UI/avatar";
import { Button } from "@/components/UI/button";
import { Textarea } from "@/components/UI/textarea";
import { Label } from "@/components/UI/label";
import { Separator } from "@/components/UI/separator";
import { Mail, Phone, Save, Undo2, X, Trash2, Loader2, AlertTriangle, Volume2, Languages } from "lucide-react";
import type { Assistant, AssistantActions, VoiceOption } from '@/types/team/assistant'; // Updated import
import { cn } from '@/lib/utils';
import ActionButton from '../Common/Buttons/Action';
import { ScrollArea } from '@/components/UI/scroll-area';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/UI/alert-dialog";
import { toast } from "sonner";
import voicePresetsConstant from '@/constants/assistants/voice_presets.js';
import { SupportedLanguage } from '@cartesia/cartesia-js/api';

interface AssistantProfilePanelProps {
    assistant: Assistant;
    onClose: () => void;
    onUpdateProfile: (id: string, about: string | null, phone: string | null, email: string | null, voice_id: string | null) => Promise<any>;
    onDeleteAssistant: (assistant: Assistant) => Promise<void>;
    assistantActions: AssistantActions; 
}

export function AssistantProfilePanel({
    assistant,
    onClose,
    onUpdateProfile,
    onDeleteAssistant,
    assistantActions
}: AssistantProfilePanelProps) {

    const [about, setAbout] = React.useState(assistant?.about || '');
    const [isEditingAbout, setIsEditingAbout] = React.useState(false);
    const [isSavingAbout, setIsSavingAbout] = React.useState(false);
    const originalAbout = React.useRef(assistant?.about || '');
    
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isAlertOpen, setIsAlertOpen] = React.useState(false);
    
    const [isPlayingAbout, setIsPlayingAbout] = React.useState(false);
    const audioRef = React.useRef<HTMLAudioElement | null>(null);

    const [userVoices, setUserVoices] = React.useState<VoiceOption[]>([]);
    React.useEffect(() => {
        const fetchVoices = async () => {
            const result = await assistantActions.voice.listVoicesFromOrchestra();
            if (Array.isArray(result)) {
                setUserVoices(result.map(v => ({...v, id: v.voice_id, isUserVoiceInOrchestra: true, language: v.language as SupportedLanguage, gender: v.gender as 'male'|'female'|'other' })));
            }
        };
        fetchVoices();
    }, [assistantActions.voice]);

    const [assistantLanguage, setAssistantLanguage] = React.useState<SupportedLanguage | undefined>()
    React.useEffect(() => {
        const language = userVoices.find(v => v.id === assistant.voice_id)?.language
        setAssistantLanguage(language)
    }, [userVoices, assistant])

    React.useEffect(() => {
        if (assistant) {
            setAbout(assistant.about ?? '');
            originalAbout.current = assistant.about ?? '';
            setIsEditingAbout(false);
            setIsSavingAbout(false);
            setIsDeleting(false);
        } else {
            setAbout('');
            setIsEditingAbout(false);
            setIsSavingAbout(false);
            setIsDeleting(false);
        }
    }, [assistant]);

    const handleSaveAbout = async () => {
        if (isSavingAbout || about === originalAbout.current) return;

        setIsSavingAbout(true);
        const toastId = toast.loading("Updating profile...");
        try {
            await onUpdateProfile(assistant.agent_id, about, assistant.phone, assistant.email, assistant.voice_id);
            originalAbout.current = about;
            setIsEditingAbout(false);
            toast.success(`${assistant.first_name}'s 'About' section updated.`, { id: toastId });
        } catch (error) {
            toast.error(`Failed to update 'About': ${error instanceof Error ? error.message : 'Unknown error'}`, { id: toastId });
        } finally {
            setIsSavingAbout(false);
        }
    };

    const handleDiscardAbout = () => {
        setAbout(originalAbout.current);
        setIsEditingAbout(false);
    };

     const handleDeleteConfirm = async () => {
        if (!assistant || isDeleting) return;
        setIsDeleting(true);
        try {
            await onDeleteAssistant(assistant);
            setIsAlertOpen(false); 
        } catch (error) {
             setIsAlertOpen(false);
        } finally {
             setIsDeleting(false);
        }
     };

    const playTTSAbout = async () => {

        if (!assistant.voice_id || !assistantLanguage || !about) {
            toast.error("Assistant voice not set or 'About' is empty.");
            return;
        }
        if (audioRef.current && !audioRef.current.paused) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlayingAbout(false);
            return; 
        }

        setIsPlayingAbout(true);
        const toastId = toast.loading("Generating audio preview...");
        try {
            const result = await assistantActions.voice.generateTTS(
                assistant.voice_id, 
                about, 
                assistantLanguage as SupportedLanguage
            );
            if (result instanceof Blob) {
                const audioURL = URL.createObjectURL(result);
                if (audioRef.current) {
                    audioRef.current.src = audioURL;
                    audioRef.current.play().catch(e => {
                        console.error("Error playing audio:", e);
                        toast.error("Could not play audio.", { id: toastId });
                        setIsPlayingAbout(false);
                    });
                    audioRef.current.onended = () => {
                        setIsPlayingAbout(false);
                        URL.revokeObjectURL(audioURL);
                    };
                }
                toast.success("Audio preview ready.", { id: toastId, duration: 2000 });
            } else {
                toast.error(result.detail || "Failed to generate TTS.", { id: toastId });
                setIsPlayingAbout(false);
            }
        } catch (error: any) {
            toast.error(`TTS Error: ${error.message}`, { id: toastId });
            setIsPlayingAbout(false);
        }
    };

    if (!assistant) return null;

    const photoSrc = assistant.signedProfilePhotoUrl || assistant.profile_photo;
    const displayName = `${assistant.first_name} ${assistant.surname}`;
    
    let voiceDisplayName = assistant.voice_id || 'N/A';
    if (assistant.voice_id) {
        const presetVoice = (voicePresetsConstant as VoiceOption[]).find(vp => vp.id === assistant.voice_id);
        if (presetVoice) {
            voiceDisplayName = presetVoice.name;
        } else {
            const userDbVoice = userVoices.find(uv => uv.id === assistant.voice_id);
            if (userDbVoice) {
                voiceDisplayName = userDbVoice.name;
            }
        }
    }


    return (
        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
            <div className="h-full flex flex-col w-full bg-background">
                {/* Manual Header */}
                <div className="px-4 py-3.5 sm:px-6 sm:py-3.5 border-b flex-shrink-0">
                    <div className='flex items-center justify-between'>
                        <h2 className="text-lg font-semibold">{`${displayName}'s profile`}</h2>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                            <X className="h-4 w-4" />
                            <span className="sr-only">Close Profile</span>
                        </Button>
                    </div>
                </div>

                <ScrollArea className="flex-1">
                    <div className="py-4 sm:py-6 space-y-6">
                        {/* Basic Info */}
                        <div className="flex items-start gap-4 sm:gap-6 px-4 sm:px-6">
                            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border">
                                <AvatarImage src={photoSrc} alt={displayName} />
                                <AvatarFallback className="text-xl">
                                    {`${assistant.first_name?.[0] ?? ''}${assistant.surname?.[0] ?? ''}`.toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm flex-1">
                                <Label className="text-muted-foreground">First Name</Label>
                                <span>{assistant.first_name}</span>
                                <Label className="text-muted-foreground">Last Name</Label>
                                <span>{assistant.surname}</span>
                                <Label className="text-muted-foreground">Age</Label>
                                <span>{assistant.age ?? 'N/A'}</span>
                                <Label className="text-muted-foreground">Region</Label>
                                <span>{assistant.region ?? 'N/A'}</span>
                            </div>
                        </div>

                        <Separator />

                        {/* About Section */}
                        {/* Keep 'group' on the outer div for hover detection */}
                        <div className="px-4 sm:px-6 space-y-2 group">
                             <div className="flex justify-between items-center">
                                <Label htmlFor={`about-${assistant.agent_id}`} className="text-base font-semibold">About</Label>
                                {assistant.voice_id && assistantLanguage && (
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={playTTSAbout}
                                        disabled={isPlayingAbout || !about}
                                        title="Preview About with selected voice"
                                        className="h-7 w-7"
                                    >
                                        {isPlayingAbout ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                                    </Button>
                                )}
                            </div>
                            <div className="relative">
                                <Textarea
                                    id={`about-${assistant.agent_id}`}
                                    value={about}
                                    onChange={(e) => { setAbout(e.target.value); setIsEditingAbout(true); }}
                                    placeholder="Enter details about the assistant..."
                                    disabled={isSavingAbout}
                                    className={cn(
                                        "text-sm min-h-[100px] resize-none peer", // Added peer class for potential focus-within alternatives if needed
                                        // Buttons will overlay the bottom-right corner, ensure textarea has enough internal padding if needed (usually default is fine)
                                        isEditingAbout ? "border-primary focus-visible:ring-primary/50" : "border-transparent bg-transparent focus-visible:bg-background focus-visible:border-input focus-visible:ring-input"
                                    )}
                                    rows={4}
                                />
                                {isEditingAbout && (
                                    // Position absolutely relative to the new wrapper div.
                                    // Adjusted bottom/right values for better placement inside padding area.
                                    // group-hover/focus-within still work because the outer div is the 'group'
                                    <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                                        <ActionButton
                                            tooltip="Save About"
                                            icon={isSavingAbout ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4 text-green-600"/>}
                                            onClick={handleSaveAbout}
                                            disabled={isSavingAbout || about === originalAbout.current}
                                            variant="ghost"
                                            size="sm"
                                            // Added explicit padding for smaller button footprint
                                            className="hover:bg-green-100 p-1.5 h-auto w-auto rounded-md"
                                        />
                                        <ActionButton
                                            tooltip="Discard About"
                                            icon={<Undo2 className="h-4 w-4 text-amber-600"/>}
                                            onClick={handleDiscardAbout}
                                            disabled={isSavingAbout}
                                            variant="ghost"
                                            size="sm"
                                            // Added explicit padding for smaller button footprint
                                            className="hover:bg-amber-100 p-1.5 h-auto w-auto rounded-md"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        <Separator />

                        {/* Contact Section */}
                        <div className="px-4 sm:px-6 space-y-3">
                            <h3 className="text-base font-semibold">Contact</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-3">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    {assistant.email ? (
                                        <a href={`mailto:${assistant.email}`} className="hover:underline text-primary truncate">
                                            {assistant.email}
                                        </a>
                                    ) : (
                                        <span>N/A</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    <span>{assistant.phone ?? 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                {/* Footer Action Button */}
                <div className="px-4 py-3 sm:px-6 sm:py-4 border-t flex justify-end flex-shrink-0">
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            End contract
                        </Button>
                    </AlertDialogTrigger>
                </div>
                <audio ref={audioRef} className="hidden" />
            </div>

            {/* Alert Dialog Content */}
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center">
                        <AlertTriangle className="h-5 w-5 text-destructive mr-2" />
                        Confirm End Contract
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        You are about to remove <strong>{displayName}</strong> from your team. This action cannot be undone. Are you sure?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDeleteConfirm}
                        disabled={isDeleting}
                        className={cn(
                            "bg-destructive hover:bg-destructive/90",
                            isDeleting && "cursor-not-allowed opacity-70"
                        )}
                    >
                        {isDeleting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Proceed
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
  );
}