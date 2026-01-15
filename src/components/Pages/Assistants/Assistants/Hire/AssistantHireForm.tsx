'use client';

import * as React from 'react';
import { UseFormReturn, FormProvider, Controller, useWatch } from "react-hook-form";
import { Input } from "@/components/UI/input";
import { Textarea } from "@/components/UI/textarea";
import { Label } from "@/components/UI/label";
import { AssistantPhotoViewer } from './AssistantHirePhotoPreview';
import { AssistantFormData, AssistantActions, VoiceOption, Assistant, Voice } from '@/types/assistants/assistant';
import { VoiceCustomization } from './AssistantHireVoiceCustomization';
import { PhotoCustomization } from './AssistantHirePhotoCustomization';
import { Volume2, User, Info, Image as ImageIcon, Settings, Laptop } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import { ScrollArea } from "@/components/UI/scroll-area";
import { Gender, SupportedLanguage } from '@cartesia/cartesia-js/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/UI/select";
import { PRIMARY_VOICE_PROVIDER } from '@/constants/assistants/settings';
import voicePresetsConstant from '@/constants/assistants/voice_presets.js';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/UI/accordion";
import { allCountryNames } from '@/constants/assistants/countries';
import { cn } from '@/lib/utils';
import { getLangCodeForNationality } from '@/utils/assistants/voice-utils';
import { FaUbuntu, FaWindows, FaApple } from "react-icons/fa";
import { generateTimezoneOptions } from '@/utils/assistants/timezone-utils';

const staticSkillsText = `The bio doesn't influence the assistant's abilities. All assistants come with the same foundational skills and can specialize in whichever area you want them to.`;

export interface HireFormProps {
  formMethods: UseFormReturn<AssistantFormData>;
  onSubmit?: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isSubmitting: boolean;
  assistantActions: AssistantActions;
  onPhotoProcessingStateChange?: (isProcessing: boolean) => void;
  onVoiceProcessingStateChange?: (isProcessing: boolean) => void;
  onNewMediaReady: (file: File | null, mediaType: 'photo' | 'video') => void;
  allDisplayableVoices: VoiceOption[];
  isLoadingUserVoices: boolean;
  fetchUserVoices: () => void;
  handleDeleteVoice: (voice: VoiceOption) => Promise<void>;
  assistants: Assistant[];
  mode?: 'hire' | 'edit';
}

export function HireForm({
    formMethods,
    onSubmit,
    isSubmitting,
    assistantActions,
    onPhotoProcessingStateChange,
    onVoiceProcessingStateChange,
    onNewMediaReady,
    allDisplayableVoices,
    isLoadingUserVoices,
    fetchUserVoices,
    handleDeleteVoice,
    assistants,
    mode = 'hire',
}: HireFormProps) {
    const { register, formState: { errors }, watch, setValue, getValues, trigger, control } = formMethods;

    const [photoCustomizationTab, setPhotoCustomizationTab] = React.useState<'upload' | 'create' | 'animate'>('upload');
    const [showAnimatePing, setShowAnimatePing] = React.useState(false);
    const [playedVideoUrls, setPlayedVideoUrls] = React.useState(new Set<string>());
    const fastMode = useWatch({ control, name: 'fast_mode' });
    const timezoneOptions = React.useMemo(() => generateTimezoneOptions(), []);

    const photoPreviewUrl = watch("photoPreviewUrl");
    const videoPreviewUrl = watch("videoPreviewUrl");
    const photoFile = watch("photoFile");
    const videoFile = watch("videoFile");
    const isPresetPristine = watch("isPresetPristine");
    const firstName = watch("first_name");
    const surname = watch("surname");
    const age = watch("age");
    const rhfNationality = watch("nationality");
    const nationalityRef = React.useRef(rhfNationality);
    
    // Re-validate the other name field when one changes to give immediate feedback on the duplicate check.
    React.useEffect(() => {
        if (getValues("surname")?.length > 0) {
            trigger("surname");
            }
        }, [firstName, trigger, getValues]);
        
        React.useEffect(() => {
            if (getValues("first_name")?.length > 0) {
            trigger("first_name");
            }
        }, [surname, trigger, getValues]);

    React.useEffect(() => {
        const isPristine = getValues("isPresetPristine");
        // Only trigger auto-selection if the nationality was changed manually, not by a preset.
        if (isPristine || nationalityRef.current === rhfNationality) {
            nationalityRef.current = rhfNationality;
            return;
        }
        nationalityRef.current = rhfNationality;
        
        if (allDisplayableVoices.length === 0) return;
        
        const preferredLanguage = getLangCodeForNationality(rhfNationality);
        if (!preferredLanguage) return;
        
        const currentVoiceId = getValues("voice_id");
        const currentVoice = allDisplayableVoices.find(v => v.voice_id === currentVoiceId);
        
        // If current voice already matches the new nationality's language, do nothing
        if (currentVoice && currentVoice.language === preferredLanguage) return;
        
        // Find the best new voice: a non-preset one is preferred
        const bestNewVoice = allDisplayableVoices.find(v => v.language === preferredLanguage && !v.is_preset)
        || allDisplayableVoices.find(v => v.language === preferredLanguage);
        
        if (bestNewVoice) {
            setValue("voice_id", bestNewVoice.voice_id, { shouldValidate: true });
            setValue("voice_name", bestNewVoice.name, { shouldValidate: true });
            setValue("voice_description", bestNewVoice.description ?? bestNewVoice.name, { shouldValidate: true });
            setValue("voice_gender", bestNewVoice.gender, { shouldValidate: true });
            setValue("voice_language", bestNewVoice.language, { shouldValidate: true });
            setValue("voice_provider", bestNewVoice.provider || PRIMARY_VOICE_PROVIDER, { shouldValidate: true });
            setValue("voice_exists", bestNewVoice.isUserVoiceInOrchestra ?? false, { shouldValidate: true });
        }
    }, [rhfNationality, allDisplayableVoices, getValues, setValue]);

    const rhfVoiceId = watch("voice_id");
    const rhfVoiceLanguage = watch("voice_language");
    const rhfVoiceGender = watch("voice_gender");
    const rhfVoiceName = watch("voice_name");
    const rhfVoiceDescription = watch("voice_description");
    const rhfIsPresetPristine = watch("isPresetPristine");
    const rhfProfileVideoUrl = watch("profile_video_url");
    const videoSourceVoiceId = watch("video_source_voice_id");
    
    // --- Start of Video Playability Logic ---
    const isVideoPlayable = React.useMemo(() => {
        const hasVideo = !!videoPreviewUrl;
        if (!hasVideo) return false;
    
        // An existing video on an assistant being edited is always playable,
        // as it's not dependent on the currently selected form voice.
        if (mode === 'edit' && !!rhfProfileVideoUrl && !videoFile) {
            return true;
        }

        // A preset video is playable only if the form state is still pristine.
        const isPresetVideo = rhfProfileVideoUrl?.includes('preset_assistants');
    
        // A preset video is playable if the form is pristine OR if the currently selected voice matches the video's original voice.
        if (isPresetVideo) {
            return isPresetPristine || rhfVoiceId === videoSourceVoiceId;
        }

        // A custom video (one the user animated themselves) is playable if the currently
        // selected voice matches the voice used to create the video.
        const hasCustomVideo = !!videoFile;
        if (hasCustomVideo) {
            return rhfVoiceId === videoSourceVoiceId;
        }
    
        return false; // Not a preset video and not a custom video, so not playable.
    }, [videoPreviewUrl, videoFile, isPresetPristine, rhfVoiceId, rhfProfileVideoUrl, videoSourceVoiceId, mode]);
    
    // --- End of Video Playability Logic ---

    const selectedVoiceForPhotoCustomization: VoiceOption | null = React.useMemo(() => {
        if (rhfVoiceId && rhfVoiceLanguage && rhfVoiceGender && rhfVoiceName) {
            return {
                voice_id: rhfVoiceId,
                language: rhfVoiceLanguage as SupportedLanguage,
                gender: rhfVoiceGender as Gender,
                name: rhfVoiceName,
                description: rhfVoiceDescription || '',
                provider: getValues("voice_provider") || PRIMARY_VOICE_PROVIDER,
                is_preset: rhfIsPresetPristine,
                isUserVoiceInOrchestra: getValues("voice_exists")
            };
        }
        return null;
    }, [rhfVoiceId, rhfVoiceLanguage, rhfVoiceGender, rhfVoiceName, rhfVoiceDescription, rhfIsPresetPristine, getValues]);
    
    const isEditMode = mode === 'edit';
    const handlePhotoViewerClick = () => {
        // This handler is only called from the viewer when it's appropriate to switch to the animate tab.
        setPhotoCustomizationTab('animate');
        setShowAnimatePing(true);
        setTimeout(() => setShowAnimatePing(false), 4000);
    };

    const handleVideoAutoplayed = React.useCallback((url: string) => {
        setPlayedVideoUrls(prev => new Set(prev).add(url));
    }, []);

    const shouldAutoplayVideo = !!videoPreviewUrl && !playedVideoUrls.has(videoPreviewUrl) && !isEditMode;
    
    React.useEffect(() => {
        const isPristine = getValues("isPresetPristine");
        const currentPreset = getValues("currentPreset");

        if (!isPristine || !currentPreset) return;

        const targetProvider = fastMode ? "openai" : PRIMARY_VOICE_PROVIDER;
        const fallbackProvider = fastMode ? PRIMARY_VOICE_PROVIDER : "openai";

        const voiceId = currentPreset.voice_ids[targetProvider] ?? currentPreset.voice_ids[fallbackProvider];
        const finalProvider = voiceId === currentPreset.voice_ids[fallbackProvider] ? fallbackProvider : targetProvider;

        if (!voiceId) return;

        const voiceDetails = (voicePresetsConstant as Voice[]).find(v => v.voice_id === voiceId && v.provider === finalProvider);
        if (!voiceDetails) return;

        // Update voice fields
        setValue("voice_id", voiceDetails.voice_id);
        setValue("voice_name", voiceDetails.name);
        setValue("voice_description", voiceDetails.description);
        setValue("voice_language", voiceDetails.language as SupportedLanguage);
        setValue("voice_gender", voiceDetails.gender as Gender);
        setValue("voice_provider", voiceDetails.provider);

        const userHasVoice = allDisplayableVoices.some(v => v.voice_id === voiceDetails.voice_id && v.provider === voiceDetails.provider && v.isUserVoiceInOrchestra);
        setValue("voice_exists", userHasVoice, { shouldValidate: true });

        // Update video
        setValue("videoPreviewUrl", null); // Clear old video to show loading
        assistantActions.photo.downloadPresetVideo(currentPreset.first_name, currentPreset.surname, finalProvider)
            .then(res => {
                if (res.signedUrl) {
                    setValue("videoPreviewUrl", res.signedUrl);
                    setValue("video_source_voice_id", voiceId);
                    setValue("profile_video_url", `gs://${process.env.NEXT_PUBLIC_ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME}/preset_assistants/${currentPreset.first_name}_${currentPreset.surname}_${finalProvider.toLowerCase()}.mp4`);
                    // Prevent autoplay by adding the new URL to the played list
                    setPlayedVideoUrls(prev => new Set(prev).add(res.signedUrl!));
                }
            });

    }, [fastMode, getValues, setValue, assistantActions.photo, allDisplayableVoices]);

    return (
    <FormProvider {...formMethods}>
        <form onSubmit={onSubmit} className="space-y-6 h-full flex flex-col">
            <ScrollArea className="flex-1 min-h-0">
                <fieldset disabled={isSubmitting} className="group px-4 py-2">
                    <Accordion type="multiple" defaultValue={["profile", "photo", "voice", "advanced"]} className="w-full">
                        
                        {/* Profile Section */}
                        <AccordionItem value="profile" aria-label='profile trigger'>
                            <AccordionTrigger className="text-title">
                                <div className='flex gap-2 items-center text-muted-foreground'>
                                    <User className="h-4 w-4"/>
                                    <span className="text-body">Profile</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2">
                                <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 flex-1">
                                        <div className="col-span-2 sm:col-span-1">
                                        <Label htmlFor="first_name">First Name</Label>
                                        <Input id="first_name" {...register("first_name", {
                                            required: "First name is required",
                                            validate: (value) => {
                                                if (isEditMode) return true;
                                                const currentSurname = getValues("surname") || '';
                                                const isDuplicate = assistants.some(
                                                    (a) =>
                                                        a.first_name?.trim().toLowerCase() === value.trim().toLowerCase() &&
                                                        a.surname?.trim().toLowerCase() === currentSurname.trim().toLowerCase()
                                                );
                                                return isDuplicate ? "An assistant with this full name already exists." : true;
                                            }
                                        })} disabled={isEditMode} />
                                        {errors.first_name && <p className="text-body text-strong text-destructive mt-1">{errors.first_name.message}</p>}
                                        </div>
                                        <div className="col-span-2 sm:col-span-1">
                                        <Label htmlFor="surname">Last Name</Label>
                                        <Input id="surname" {...register("surname", {
                                            required: "Last name is required",
                                            validate: (value) => {
                                                if (isEditMode) return true;
                                                const currentFirstName = getValues("first_name") || '';
                                                const isDuplicate = assistants.some(
                                                    (a) =>
                                                        a.surname?.trim().toLowerCase() === value.trim().toLowerCase() &&
                                                        a.first_name?.trim().toLowerCase() === currentFirstName.trim().toLowerCase()
                                                );
                                                return isDuplicate ? "An assistant with this full name already exists." : true;
                                            }
                                        })} disabled={isEditMode} />
                                        {errors.surname && <p className="text-body text-strong text-destructive mt-1">{errors.surname.message}</p>}
                                        </div>
                                        <div className="col-span-2 sm:col-span-1">
                                        <Label htmlFor="age">Age</Label>
                                        <Input id="age" type="number" {...register("age", { valueAsNumber: true, min: { value: 18, message: "Age must be at least 18" }, max: { value: 70, message: "Age must be 70 or less" } })} disabled={isEditMode} />
                                        {errors.age && <p className="text-body text-strong text-destructive mt-1">{errors.age.message}</p>}
                                        </div>
                                        <div className="col-span-2 sm:col-span-1">
                                            <Label htmlFor="nationality">Nationality</Label>
                                            <Select
                                                value={rhfNationality || ''}
                                                onValueChange={(value) => setValue("nationality", value, { shouldValidate: true })}
                                                disabled={isSubmitting || isEditMode}
                                            >
                                                <SelectTrigger id="nationality" {...register("nationality", { required: "Nationality is required." })}>
                                                    <SelectValue placeholder="Select a nationality..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {allCountryNames.map(countryName => (
                                                        <SelectItem key={countryName} value={countryName}>
                                                            {countryName}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {errors.nationality && <p className="text-body text-strong text-destructive mt-1">{errors.nationality.message}</p>}
                                        </div>
                                    </div>
                                    <div className="pt-1">
                                        <Label htmlFor="timezone">Timezone</Label>
                                        <Controller
                                            name="timezone"
                                            control={control}
                                            rules={{ required: "Timezone is required."}}
                                            render={({ field }) => (
                                                <Select
                                                    value={field.value || ''}
                                                    onValueChange={field.onChange}
                                                    disabled={isSubmitting}
                                                >
                                                    <SelectTrigger id="timezone">
                                                        <SelectValue placeholder="Select a timezone..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {timezoneOptions.map(option => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                        {errors.timezone && <p className="text-body text-strong text-destructive mt-1">{errors.timezone.message}</p>}
                                    </div>
                                    <div className="flex flex-col w-full space-y-2 pt-1">
                                        <div className="flex flex-row gap-2 items-center">
                                        <Label htmlFor="about">About</Label>
                                        <TooltipProvider delayDuration={100}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                                </TooltipTrigger>
                                                <TooltipContent side="right" align="end" className="max-w-xs text-caption">
                                                    <p>{staticSkillsText}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        </div>
                                        <Textarea
                                            id="about"
                                            placeholder="Describe the persona's background, personality, etc..."
                                            className="min-h-[100px] pr-8"
                                            {...register("about", { required: "About description is required" })}
                                        />
                                        {errors.about && <p className="text-body text-strong text-destructive mt-1">{errors.about.message}</p>}
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        {/* Photo Section */}
                        <AccordionItem value="photo" aria-label='photo trigger'>
                            <AccordionTrigger className="text-title">
                                <div className='flex gap-2 items-center text-muted-foreground'>
                                    <ImageIcon className="h-4 w-4"/>
                                    <span className="text-body">Appearance</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2">
                                <div className="flex flex-col sm:flex-row items-start gap-4">
                                    <AssistantPhotoViewer
                                        photoUrl={photoPreviewUrl}
                                        videoUrl={isVideoPlayable ? videoPreviewUrl : null}
                                        photoFile={photoFile}
                                        videoFile={videoFile}
                                        className="flex-shrink-0"
                                        isPlayable={isVideoPlayable}
                                        disabled={isSubmitting}
                                        onClick={handlePhotoViewerClick}
                                        shouldAutoplay={shouldAutoplayVideo}
                                        onAutoplay={handleVideoAutoplayed}
                                    />
                                    <PhotoCustomization
                                        assistantActions={assistantActions}
                                        onNewMediaReady={onNewMediaReady}
                                        currentImageUrl={photoPreviewUrl ?? null}
                                        currentImageFile={photoFile ?? null}
                                        disabled={isSubmitting}
                                        selectedVoice={selectedVoiceForPhotoCustomization}
                                        firstName={firstName}
                                        surname={surname}
                                        age={age as number | null}
                                        activeTab={photoCustomizationTab}
                                        setActiveTab={setPhotoCustomizationTab}
                                        showAnimatePing={showAnimatePing}
                                        onProcessingStateChange={onPhotoProcessingStateChange}
                                    />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        {/* Voice Section */}
                        <AccordionItem value="voice" aria-label='voice trigger'>
                             <AccordionTrigger className="text-title">
                                <div className='flex gap-2 items-center text-muted-foreground'>
                                    <Volume2 className="h-4 w-4"/>
                                    <span className="text-body">Voice</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2">
                                <VoiceCustomization
                                    assistantActions={assistantActions}
                                    onVoiceSelected={(selectedVoice) => {
                                        setValue("voice_id", selectedVoice?.voice_id, { shouldValidate: !!selectedVoice?.voice_id });
                                        setValue("voice_name", selectedVoice?.name, { shouldValidate: !!selectedVoice?.name });
                                        setValue("voice_description", selectedVoice?.description ?? selectedVoice?.name, { shouldValidate: !!selectedVoice?.description });
                                        setValue("voice_gender", selectedVoice?.gender, { shouldValidate: !!selectedVoice?.gender });
                                        setValue("voice_language", selectedVoice?.language, { shouldValidate: !!selectedVoice?.language });
                                        setValue("voice_provider", selectedVoice?.provider || PRIMARY_VOICE_PROVIDER, { shouldValidate: true });
                                        setValue("voice_exists", selectedVoice?.isUserVoiceInOrchestra ?? false, { shouldValidate: true });
                                    }}
                                    initialVoiceId={getValues("voice_id")}
                                    disabled={isSubmitting}
                                    onProcessingStateChange={onVoiceProcessingStateChange}
                                    allDisplayableVoices={allDisplayableVoices}
                                    isLoadingUserVoices={isLoadingUserVoices}
                                    fetchUserVoices={fetchUserVoices}
                                    handleDeleteVoice={handleDeleteVoice}
                                />
                                {errors.voice_id && <p className="text-body text-strong text-destructive mt-1">{errors.voice_id.message}</p>}
                                {errors.voice_language && !errors.voice_id && <p className="text-body text-strong text-destructive mt-1">{errors.voice_language.message}</p>}
                                {errors.voice_provider && !errors.voice_id && <p className="text-body text-strong text-destructive mt-1">{errors.voice_provider.message}</p>}
                            </AccordionContent>
                        </AccordionItem>
                        
                        <AccordionItem value="advanced" className="border-b-0" aria-label='advanced trigger'>
                            <AccordionTrigger className="text-title">
                                <div className='flex gap-2 items-center text-muted-foreground'>
                                    <Settings className="h-4 w-4"/>
                                    <span className="text-body">Advanced</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                       <div className="flex items-center gap-2">
                                           <Laptop className="h-4 w-4 text-muted-foreground mb-1" />
                                           <Label htmlFor="operating_system">Assistant&apos;s Setup</Label>
                                           <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="right" align="end" className="max-w-xs text-caption"><p>{isEditMode ? "Desktop mode cannot be changed after the assistant is created." : "Choose to run the assistant on a remote virtual machine (default) or connect it to a local desktop."}</p></TooltipContent></Tooltip></TooltipProvider>
                                       </div>
                                       <Controller
                                           name="setup"
                                           control={control}
                                           render={({ field }) => (
                                               <div className={cn("space-y-2", isEditMode && "opacity-60 pointer-events-none")}>
                                                   <div className={cn("flex items-center space-x-2 rounded-md border p-3", !isEditMode && "cursor-pointer", field.value === 'remote' && "border-primary")} onClick={() => !isEditMode && field.onChange('remote')}>
                                                       <div className={cn("w-4 h-4 rounded-full border border-muted-foreground flex items-center justify-center", field.value === 'remote' && "border-primary")}>
                                                           {field.value === 'remote' && <div className="w-2 h-2 rounded-full bg-primary" />}
                                                       </div>
                                                       <Label htmlFor="setup-remote" className={cn("text-label font-normal", !isEditMode && "cursor-pointer")}>Remote - Use a virtual machine</Label>
                                                   </div>
                                                   <div className={cn("flex flex-col space-y-3 rounded-md border p-3", !isEditMode && "cursor-pointer", field.value === 'local' && "border-primary")} onClick={() => !isEditMode && field.onChange('local')}>
                                                       <div className="flex items-center space-x-2">
                                                           <div className={cn("w-4 h-4 rounded-full border border-muted-foreground flex items-center justify-center", field.value === 'local' && "border-primary")}>
                                                               {field.value === 'local' && <div className="w-2 h-2 rounded-full bg-primary" />}
                                                           </div>
                                                           <Label htmlFor="setup-local" className={cn("text-label font-normal", !isEditMode && "cursor-pointer")}>Local - Connect to your desktop</Label>
                                                       </div>
                                                       {field.value === 'local' && (
                                                           <Controller
                                                               name="operating_system"
                                                               control={control}
                                                               render={({ field: osField }) => (
                                                                   <div className="pl-6 space-y-2">
                                                                       <div className={cn("flex items-center space-x-2", !isEditMode && "cursor-pointer")} onClick={(e) => { e.stopPropagation(); if (!isEditMode) osField.onChange('ubuntu'); }}>
                                                                           <div className={cn("w-4 h-4 rounded-full border border-muted-foreground flex items-center justify-center", osField.value === 'ubuntu' && "border-primary")}>
                                                                               {osField.value === 'ubuntu' && <div className="w-2 h-2 rounded-full bg-primary" />}
                                                                           </div>
                                                                           <FaUbuntu className="h-4 w-4" />
                                                                           <Label htmlFor="os-ubuntu" className={cn("text-label font-normal", !isEditMode && "cursor-pointer")}>Ubuntu</Label>
                                                                       </div>
                                                                       <div className={cn("flex items-center space-x-2", !isEditMode && "cursor-pointer")} onClick={(e) => { e.stopPropagation(); if (!isEditMode) osField.onChange('windows'); }}>
                                                                           <div className={cn("w-4 h-4 rounded-full border border-muted-foreground flex items-center justify-center", osField.value === 'windows' && "border-primary")}>
                                                                               {osField.value === 'windows' && <div className="w-2 h-2 rounded-full bg-primary" />}
                                                                           </div>
                                                                           <FaWindows className="h-4 w-4" />
                                                                           <Label htmlFor="os-windows" className={cn("text-label font-normal", !isEditMode && "cursor-pointer")}>Windows</Label>
                                                                       </div>
                                                                       <div className={cn("flex items-center space-x-2", !isEditMode && "cursor-pointer")} onClick={(e) => { e.stopPropagation(); if (!isEditMode) osField.onChange('macos'); }}>
                                                                           <div className={cn("w-4 h-4 rounded-full border border-muted-foreground flex items-center justify-center", osField.value === 'macos' && "border-primary")}>
                                                                               {osField.value === 'macos' && <div className="w-2 h-2 rounded-full bg-primary" />}
                                                                           </div>
                                                                           <FaApple className="h-4 w-4" />
                                                                           <Label htmlFor="os-macos" className={cn("text-label font-normal", !isEditMode && "cursor-pointer")}>MacOS</Label>
                                                                       </div>
                                                                   </div>
                                                               )}
                                                           />
                                                       )}
                                                   </div>
                                               </div>
                                           )}
                                       />
                                   </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </fieldset>
            </ScrollArea>
        </form>
    </FormProvider>
  );
}