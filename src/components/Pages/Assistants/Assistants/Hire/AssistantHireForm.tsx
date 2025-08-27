'use client';

import * as React from 'react';
import { UseFormReturn, useFieldArray, FormProvider, Controller, useFormContext, useWatch } from "react-hook-form";
import { Input } from "@/components/UI/input";
import { Textarea } from "@/components/UI/textarea";
import { Label } from "@/components/UI/label";
import { AssistantPhotoViewer } from './AssistantHirePhotoPreview';
import { AssistantFormData, AssistantActions, VoiceOption, AvailableSocialPlatform, Assistant } from '@/types/assistants/assistant';
import { VoiceCustomization } from './AssistantHireVoiceCustomization';
import { PhotoCustomization } from './AssistantHirePhotoCustomization';
import { Volume2, User, Info, Smartphone, Image as ImageIcon, Globe, Loader2 as LoaderIcon, PlusCircle, Check, RefreshCw, X, AlertCircle, Phone, CheckCircle2, Send, Mail } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import { ScrollArea } from "@/components/UI/scroll-area";
import { Gender, SupportedLanguage } from '@cartesia/cartesia-js/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/UI/select";
import { AvailablePhoneCountry } from '@/types/assistants/assistant';
import { getCountryFlag } from '@/utils/assistants/country-utils';
import { EMAIL_DOMAIN_WITH_AT, VOICE_PROVIDER, ASSISTANT_ONBOARDING_FEE, FALLBACK_DEFAULT_COUNTRY_CODE } from '@/constants/assistants/settings';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/UI/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/UI/accordion";
import { Button } from '@/components/UI/button';
import { toast } from 'sonner';
import { SocialAccountInput } from './SocialAccountInput';
import { allCountryNames } from '@/constants/assistants/countries';
import { cn } from '@/lib/utils';
import { useAccountVerification } from '@/hooks/Assistants/useAccountVerification';
import { getLangCodeForRegion } from '@/utils/assistants/voice-utils';

const staticSkillsText = `The bio doesn't influence the assistant's abilities. All assistants come with the same foundational skills and can specialize in whichever area you want them to.`;

const PhoneVerificationSection: React.FC<{ assistantActions: AssistantActions }> = ({ assistantActions }) => {
    const { control, getValues, setValue, formState: { errors }, register, clearErrors } = useFormContext<AssistantFormData>();

    const phoneFieldNames = React.useMemo(() => ({
        identifier: 'user_phone' as 'user_phone',
        isVerified: 'user_phone_isVerified' as 'user_phone_isVerified',
        isVerifying: 'user_phone_isVerifying' as 'user_phone_isVerifying',
        verificationCodeSent: 'user_phone_verificationCodeSent' as 'user_phone_verificationCodeSent',
        verificationSentAt: 'user_phone_verificationSentAt' as 'user_phone_verificationSentAt',
        verificationAttempts: 'user_phone_verificationAttempts' as 'user_phone_verificationAttempts',
        verificationError: 'user_phone_verificationError' as 'user_phone_verificationError',
    }), []);

    const {
        isVerifying,
        isVerificationFlowActive,
        verificationError,
        cooldown,
        verificationInput,
        setVerificationInput,
        handleVerify,
        handleCancelVerification,
        handleSubmitCode,
    } = useAccountVerification({
        platform: 'phone',
        fieldNames: phoneFieldNames,
        assistantActions
    });

    const handleVerifyClick = (isRetry: boolean) => {
        const phoneNumber = getValues('user_phone');
        if (!phoneNumber || phoneNumber.trim() === '') {
            toast.error("Please enter a phone number to verify.");
            return;
        }
        handleVerify(isRetry);
    };

    const isPhoneVerified = useWatch({ control, name: 'user_phone_isVerified' });
    const phoneValue = useWatch({ control, name: 'user_phone' });
    const isSubmitting = useFormContext<AssistantFormData>().formState.isSubmitting;

    return (
        <div className="space-y-2">
             <div className="flex items-center gap-2">
                <Input id="user_phone" type="tel" placeholder="e.g., +15551234567" className="h-9 flex-1" disabled={isVerifying || isSubmitting || isPhoneVerified} {...register('user_phone', {
                    pattern: {
                        value: /^\+[1-9]\d{7,14}$/,
                        message: "Please enter a valid number (e.g., +15551234567). Make sure there are no extra whitespace."
                    },
                    onChange: () => {
                        if (getValues('user_phone_isVerified')) {
                            setValue('user_phone_isVerified', false, { shouldDirty: true });
                        }
                        if (errors.user_phone) clearErrors('user_phone');
                    }
                })} />
                {isPhoneVerified ? (
                     <Button type="button" variant="default" className="h-9" disabled>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Verified
                    </Button>
                ) : (
                    <Button type="button" variant="outline" className="h-9" onClick={() => handleVerifyClick(false)} disabled={isVerifying || isSubmitting || !phoneValue}>
                        {isVerifying ? <LoaderIcon className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isVerifying ? 'Verifying...' : 'Verify'}
                    </Button>
                )}
            </div>
            {isVerificationFlowActive && (
                <div className="pl-4 flex items-start gap-3 border-l-2 border-muted">
                    <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                            <Input
                                id="user_phone_verification_code"
                                placeholder="Enter verification code..."
                                value={verificationInput}
                                onChange={(e) => setVerificationInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmitCode(); } }}
                                className={cn("h-9", verificationError && "border-destructive")}
                            />
                            <Button type="button" variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={handleSubmitCode}>
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                         {verificationError && <p className="text-sm font-medium text-destructive mt-1 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />{verificationError}</p>}
                    </div>
                    <div className="flex items-center gap-2 pt-0">
                        <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => handleVerifyClick(true)} disabled={cooldown > 0}>
                            {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend'}
                        </Button>
                        <Button type="button" variant="warning" size="sm" className="h-9" onClick={handleCancelVerification}>
                            Cancel
                        </Button>
                    </div>
                </div>
            )}
            {errors.user_phone && !isVerificationFlowActive && <p className="text-sm font-medium text-destructive mt-1">{errors.user_phone.message}</p>}
        </div>
    );
};

export interface HireFormProps {
  formMethods: UseFormReturn<AssistantFormData>;
  onSubmit?: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isSubmitting: boolean;
  assistantActions: AssistantActions;
  onPhotoProcessingStateChange?: (isProcessing: boolean) => void;
  onVoiceProcessingStateChange?: (isProcessing: boolean) => void;
  onNewMediaReady: (file: File | null, mediaType: 'photo' | 'video') => void;
  allAssistantEmails: string[];
  isLoadingEmails: boolean;
  availablePhoneCountries: AvailablePhoneCountry[];
  isLoadingCountries: boolean;
  availableSocialPlatforms: AvailableSocialPlatform[];
  isLoadingSocialPlatforms: boolean;
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
    allAssistantEmails,
    isLoadingEmails,
    availablePhoneCountries,
    isLoadingCountries,
    availableSocialPlatforms,
    isLoadingSocialPlatforms,
    allDisplayableVoices,
    isLoadingUserVoices,
    fetchUserVoices,
    handleDeleteVoice,
    assistants,
    mode = 'hire',
}: HireFormProps) {
    const { register, formState: { errors }, watch, setValue, getValues, trigger, control, clearErrors } = formMethods;
    const { fields, append, remove } = useFieldArray({
        control,
        name: "social_accounts",
    });

    const [photoCustomizationTab, setPhotoCustomizationTab] = React.useState<'upload' | 'create' | 'animate'>('upload');
    const [justAddedPlatform, setJustAddedPlatform] = React.useState<string | null>(null);
    const [showAnimatePing, setShowAnimatePing] = React.useState(false);
    const [playedVideoUrls, setPlayedVideoUrls] = React.useState(new Set<string>());

    const isPhoneNumberAdded = useWatch({ control, name: 'isPhoneNumberAdded' });

    const handleAddPhone = () => {
        setValue('isPhoneNumberAdded', true, { shouldDirty: true });
    };

    const handleRemovePhone = () => {
        setValue('isPhoneNumberAdded', false, { shouldDirty: true });
        // Clear related fields
        setValue('country', FALLBACK_DEFAULT_COUNTRY_CODE, { shouldDirty: true });
        setValue('user_phone', '', { shouldDirty: true });
        setValue('user_phone_isVerified', false, { shouldDirty: true });
        setValue('user_phone_isVerifying', false, { shouldDirty: true });
        setValue('user_phone_verificationCodeSent', null, { shouldDirty: true });
        setValue('user_phone_verificationSentAt', null, { shouldDirty: true });
        setValue('user_phone_verificationAttempts', 0, { shouldDirty: true });
        setValue('user_phone_verificationError', null, { shouldDirty: true });
        clearErrors(['country', 'user_phone']);
    };


    const handleAddSocialAccount = (platform: string) => {
        const platformAlreadyAdded = fields.some(field => field.platform === platform);
        if (platformAlreadyAdded) {
            toast.info(`You have already added an account for ${platform}.`);
            return;
        }

        const userPhone = getValues("user_phone");
        append({
            platform: platform,
            identifier: userPhone || '',
            isVerified: false,
            isInitial: false,
            isVerifying: false,
            verificationCodeSent: null,
            verificationSentAt: null,
            verificationAttempts: 0,
            verificationError: null,
        });
        setJustAddedPlatform(platform);
    };

    const photoPreviewUrl = watch("photoPreviewUrl");
    const videoPreviewUrl = watch("videoPreviewUrl");
    const photoFile = watch("photoFile");
    const videoFile = watch("videoFile");
    const isPresetPristine = watch("isPresetPristine");
    const firstName = watch("first_name");
    const surname = watch("surname");
    const age = watch("age");
    const rhfEmail = watch("email");
    const rhfCountry = watch("country");
    const rhfRegion = watch("region");
    const regionRef = React.useRef(rhfRegion);
    
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
        // Only trigger auto-selection if the region was changed manually, not by a preset.
        if (isPristine || regionRef.current === rhfRegion) {
            regionRef.current = rhfRegion;
            return;
        }
        regionRef.current = rhfRegion;
        
        if (allDisplayableVoices.length === 0) return;
        
        const preferredLanguage = getLangCodeForRegion(rhfRegion);
        if (!preferredLanguage) return;
        
        const currentVoiceId = getValues("voice_id");
        const currentVoice = allDisplayableVoices.find(v => v.voice_id === currentVoiceId);
        
        // If current voice already matches the new region's language, do nothing
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
            setValue("voice_provider", bestNewVoice.provider || VOICE_PROVIDER, { shouldValidate: true });
            setValue("voice_exists", bestNewVoice.isUserVoiceInOrchestra ?? false, { shouldValidate: true });
        }
    }, [rhfRegion, allDisplayableVoices, getValues, setValue]);

    const [emailLocalPart, setEmailLocalPart] = React.useState('');

    // Sync local part state from RHF's full email (e.g., on preset selection or reset)
    React.useEffect(() => {
        if (rhfEmail && rhfEmail.endsWith(EMAIL_DOMAIN_WITH_AT)) {
            const local = rhfEmail.substring(0, rhfEmail.length - EMAIL_DOMAIN_WITH_AT.length);
            if (local !== emailLocalPart) {
                setEmailLocalPart(local);
            }
        } else if (rhfEmail) {
            if (rhfEmail !== emailLocalPart) {
                setEmailLocalPart(rhfEmail);
                }
            } else {
                if (emailLocalPart !== '') {
                    setEmailLocalPart('');
                }
            }
        }, [rhfEmail, emailLocalPart]);
        
        // Auto-generate email based on names if not manually edited
    React.useEffect(() => {
        const generateUniqueEmail = (fname: string, sname: string) => {
            const cleanFname = fname?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
            const cleanSname = sname?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
            let baseLocalPart = "new-assistant";
            if (cleanFname && cleanSname) baseLocalPart = `${cleanFname}-${cleanSname}`;
            else if (cleanFname) baseLocalPart = cleanFname;
            else if (cleanSname) baseLocalPart = cleanSname;
            
            let finalLocalPart = baseLocalPart;
            let counter = 1;
            while (allAssistantEmails.includes(`${finalLocalPart}${EMAIL_DOMAIN_WITH_AT}`)) {
                finalLocalPart = `${baseLocalPart}-${counter}`;
                counter++;
            }
            return `${finalLocalPart}${EMAIL_DOMAIN_WITH_AT}`;
        };
        
        if (mode !== 'edit' && !getValues("emailManuallyEdited") && (firstName || surname)) {
            const newEmail = generateUniqueEmail(firstName, surname);
            setValue("email", newEmail, { shouldValidate: true });
        }
    }, [firstName, surname, setValue, getValues, allAssistantEmails, mode]);

    const handleLocalPartChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newLocalPart = event.target.value.replace(/[@\s]/g, '');
        setEmailLocalPart(newLocalPart);
        setValue("email", `${newLocalPart}${EMAIL_DOMAIN_WITH_AT}`, { shouldValidate: true });
        setValue("emailManuallyEdited", true);
        trigger("email");
    };

    const rhfVoiceId = watch("voice_id");
    const rhfVoiceLanguage = watch("voice_language");
    const rhfVoiceGender = watch("voice_gender");
    const rhfVoiceName = watch("voice_name");
    const rhfVoiceDescription = watch("voice_description");
    const rhfIsPresetPristine = watch("isPresetPristine");
    
    // --- Start of Video Playability Logic ---
    const isVideoPlayable = React.useMemo(() => {
        const hasVideo = !!videoPreviewUrl;
        if (!hasVideo) return false;
    
        // An existing video on an assistant being edited is always playable,
        // as it's not dependent on the currently selected form voice.
        if (mode === 'edit' && !!getValues("profile_video_url") && !videoFile) {
            return true;
        }

        // A preset video is playable only if the form state is still pristine.
        const rhfProfileVideoUrl = getValues("profile_video_url");
        const isPresetVideo = rhfProfileVideoUrl?.includes('preset_assistants');

        const videoVoiceId = getValues("video_source_voice_id");
    
        // A preset video is playable if the form is pristine OR if the currently selected voice matches the video's original voice.
        if (isPresetVideo) {
            return isPresetPristine || rhfVoiceId === videoVoiceId;
        }

        // A custom video (one the user animated themselves) is playable if the currently
        // selected voice matches the voice used to create the video.
        const hasCustomVideo = !!videoFile;
        if (hasCustomVideo) {
            const videoVoiceId = getValues("video_source_voice_id");
            return rhfVoiceId === videoVoiceId;
        }
    
        return false; // Not a preset video and not a custom video, so not playable.
    }, [videoPreviewUrl, videoFile, getValues, isPresetPristine, rhfVoiceId]);
    
    // --- End of Video Playability Logic ---

    const selectedVoiceForPhotoCustomization: VoiceOption | null = React.useMemo(() => {
        if (rhfVoiceId && rhfVoiceLanguage && rhfVoiceGender && rhfVoiceName) {
            return {
                voice_id: rhfVoiceId,
                language: rhfVoiceLanguage as SupportedLanguage,
                gender: rhfVoiceGender as Gender,
                name: rhfVoiceName,
                description: rhfVoiceDescription || '',
                provider: getValues("voice_provider") || VOICE_PROVIDER,
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

    return (
    <FormProvider {...formMethods}>
        <form onSubmit={onSubmit} className="space-y-6 h-full flex flex-col">
            <ScrollArea className="flex-1 min-h-0">
                <fieldset disabled={isSubmitting || isLoadingCountries || isLoadingEmails || isLoadingSocialPlatforms} className="group px-4 py-2">
                    <Accordion type="multiple" defaultValue={["profile", "photo", "voice", "contact"]} className="w-full">
                        
                        {/* Profile Section */}
                        <AccordionItem value="profile">
                            <AccordionTrigger className="text-base font-semibold">
                                <div className='flex gap-2 items-center text-muted-foreground'>
                                    <User className="h-4 w-4"/>
                                    <span>Profile</span>
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
                                        {errors.first_name && <p className="text-sm font-medium text-destructive mt-1">{errors.first_name.message}</p>}
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
                                        {errors.surname && <p className="text-sm font-medium text-destructive mt-1">{errors.surname.message}</p>}
                                        </div>
                                        <div className="col-span-2 sm:col-span-1">
                                        <Label htmlFor="age">Age</Label>
                                        <Input id="age" type="number" {...register("age", { valueAsNumber: true, min: { value: 18, message: "Age must be at least 18" }, max: { value: 70, message: "Age must be 70 or less" } })} disabled={isEditMode} />
                                        {errors.age && <p className="text-sm font-medium text-destructive mt-1">{errors.age.message}</p>}
                                        </div>
                                        <div className="col-span-2 sm:col-span-1">
                                            <Label htmlFor="region">Region</Label>
                                            <Select
                                                value={rhfRegion || ''}
                                                onValueChange={(value) => setValue("region", value, { shouldValidate: true })}
                                                disabled={isSubmitting || isEditMode}
                                            >
                                                <SelectTrigger id="region" {...register("region", { required: "Region is required." })}>
                                                    <SelectValue placeholder="Select a region..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {allCountryNames.map(countryName => (
                                                        <SelectItem key={countryName} value={countryName}>
                                                            {countryName}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {errors.region && <p className="text-sm font-medium text-destructive mt-1">{errors.region.message}</p>}
                                        </div>
                                    </div>
                                    <div className="flex flex-col w-full space-y-2 pt-1">
                                        <div className="flex flex-row gap-2 items-center">
                                        <Label htmlFor="about">About</Label>
                                        <TooltipProvider delayDuration={100}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                                </TooltipTrigger>
                                                <TooltipContent side="right" align="end" className="max-w-xs text-sm">
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
                                        {errors.about && <p className="text-sm font-medium text-destructive mt-1">{errors.about.message}</p>}
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        {/* Photo Section */}
                        <AccordionItem value="photo">
                            <AccordionTrigger className="text-base font-semibold">
                                <div className='flex gap-2 items-center text-muted-foreground'>
                                    <ImageIcon className="h-4 w-4"/>
                                    <span>Appearance</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2">
                                <div className="flex flex-col sm:flex-row items-start gap-4">
                                    <AssistantPhotoViewer
                                        photoUrl={photoPreviewUrl}
                                        videoUrl={videoPreviewUrl}
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
                        <AccordionItem value="voice">
                             <AccordionTrigger className="text-base font-semibold">
                                <div className='flex gap-2 items-center text-muted-foreground'>
                                    <Volume2 className="h-4 w-4"/>
                                    <span>Voice</span>
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
                                        setValue("voice_provider", selectedVoice?.provider || VOICE_PROVIDER, { shouldValidate: true });
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
                                {errors.voice_id && <p className="text-sm font-medium text-destructive mt-1">{errors.voice_id.message}</p>}
                                {errors.voice_language && !errors.voice_id && <p className="text-sm font-medium text-destructive mt-1">{errors.voice_language.message}</p>}
                                {errors.voice_provider && !errors.voice_id && <p className="text-sm font-medium text-destructive mt-1">{errors.voice_provider.message}</p>}
                            </AccordionContent>
                        </AccordionItem>
                        
                        {/* Contact Section */}
                        <AccordionItem value="contact" className="border-b-0">
                            <AccordionTrigger className="text-base font-semibold">
                                <div className='flex gap-2 items-center text-muted-foreground'>
                                    <Smartphone className="h-4 w-4"/>
                                    <span>Contact</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2">
                                 <div className="space-y-2">
                                      {/* Email Section (Hire Mode Only) */}
                                      {mode === 'hire' && (
                                         <div className="col-span-2 sm:col-span-1">
                                              <div className="flex flex-row items-center gap-2 mb-1.5">
                                                  <Mail className="h-4 w-4 text-muted-foreground" />
                                                  <Label htmlFor="email_local_part">Email address</Label>
                                              </div>
                                              <div className="flex items-center rounded-md">
                                                  <Input
                                                      id="email_local_part"
                                                      type="text"
                                                      value={emailLocalPart}
                                                      onChange={handleLocalPartChange}
                                                      placeholder="new-assistant"
                                                      className="flex max-w-[250px] focus-visible:ring-0 focus-visible:ring-offset-0 rounded-r-none h-9"
                                                      aria-describedby="email_domain_part"
                                                      disabled={isSubmitting || isLoadingEmails}
                                                  />
                                                  <span
                                                      id="email_domain_part"
                                                      className="px-3 py-2 bg-muted text-muted-foreground text-sm rounded-r-md border-l border-input select-none h-9 flex items-center" >
                                                      {EMAIL_DOMAIN_WITH_AT}
                                                  </span>
                                              </div>
                                              <input type="hidden" {...register("email", {
                                                  required: "Email is required",
                                                  pattern: {
                                                      value: new RegExp(`^[a-zA-Z0-9._-]+${EMAIL_DOMAIN_WITH_AT.replace(/\./g, '\\.')}$`),
                                                      message: `Valid email must end with ${EMAIL_DOMAIN_WITH_AT}`
                                                  },
                                                  validate: (value) => {
                                                      if (value.startsWith('@')) return `Email local part cannot be empty.`;
                                                      if (mode === 'hire' && allAssistantEmails.includes(value)) {
                                                          return "This email is already in use by another assistant.";
                                                      }
                                                      return true;
                                                  }
                                              })} />
                                              {errors.email && <p className="text-sm font-medium text-destructive mt-1">{errors.email.message}</p>}
                                          </div>
                                      )}
                                     <div className={cn("col-span-2", mode === 'hire' ? "sm:col-span-1" : "sm:col-span-2", "flex flex-col gap-2")}>
                                         {/* Phone Section (Conditional) */}
                                         {isPhoneNumberAdded ? (
                                             <div className="space-y-2">
                                                 <div className="flex items-center justify-between">
                                                     <div className="flex items-center gap-2">
                                                         <Phone className="h-4 w-4 text-muted-foreground" />
                                                         <Label>Phone Number</Label>
                                                     </div>
                                                     <Button type="button" variant="ghost" size="sm" onClick={handleRemovePhone} className="h-auto p-1 text-xs font-semibold text-muted-foreground hover:text-destructive">Remove</Button>
                                                  </div>
                                                 <div className="space-y-4 rounded-lg border p-4">
                                                     {mode === 'hire' && (
                                                         <div>
                                                             <div className="flex flex-row gap-2 items-center pb-1">
                                                                 <Label htmlFor="country">Assistant Phone</Label>
                                                                 <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="right" align="end" className="max-w-xs text-sm"><p>{"Assistant phone number will be provisioned upon hiring."}</p></TooltipContent></Tooltip></TooltipProvider>
                                                             </div>
                                                             <Select value={rhfCountry} onValueChange={(value) => setValue("country", value, { shouldValidate: true })} disabled={isSubmitting || isLoadingCountries} >
                                                                 <SelectTrigger id="country" {...register("country", { required: isPhoneNumberAdded ? "Phone number country is required." : false })}>
                                                                     <SelectValue placeholder={isLoadingCountries ? "Loading available countries..." : "Select country..."} />
                                                                 </SelectTrigger>
                                                                 <SelectContent>{isLoadingCountries ? (<SelectItem value="loading" disabled>Loading...</SelectItem>) : (availablePhoneCountries.map(country => (<SelectItem key={country.code} value={country.code}><span className="mr-2">{getCountryFlag(country.code)}</span> {country.name} ({country.code})</SelectItem>)))}</SelectContent>
                                                             </Select>
                                                             {errors.country && <p className="text-sm font-medium text-destructive mt-1">{errors.country.message}</p>}
                                                         </div>
                                                     )}
                                                     <div>
                                                         <div className="flex flex-row gap-2 items-center pb-1">
                                                             <Label htmlFor="user_phone">Your Phone</Label>
                                                             <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="right" align="end" className="max-w-xs text-sm"><p>{"This is the phone number you will contact the assistant with."}</p></TooltipContent></Tooltip></TooltipProvider>
                                                         </div>
                                                         <PhoneVerificationSection assistantActions={assistantActions} />
                                                     </div>
                                                 </div>
                                             </div>
                                         ) : (
                                             <Button type="button" variant="outline" className="w-full border-dashed justify-center p-3" onClick={handleAddPhone}>
                                                 <Phone className="mr-2 h-4 w-4" /> Add phone number
                                             </Button>
                                         )}
     
                                         {/* Social Accounts Section */}
                                         <div className="space-y-2">
                                             {fields.map((field, index) => {
                                                 const platformInfo = availableSocialPlatforms.find(p => p.name === field.platform);
                                                 const platformCost = platformInfo?.cost ?? ASSISTANT_ONBOARDING_FEE;
                                                 return (
                                                     <SocialAccountInput
                                                         key={field.id}
                                                         index={index}
                                                         platform={field.platform}
                                                         justAddedPlatform={justAddedPlatform}
                                                         onRemove={remove}
                                                         clearJustAdded={() => setJustAddedPlatform(null)}
                                                         assistantActions={assistantActions}
                                                         cost={platformCost}
                                                     />
                                                 );
                                             })}
                                             <DropdownMenu>
                                                 <DropdownMenuTrigger asChild>
                                                     <Button
                                                         type="button"
                                                         variant="outline"
                                                         className="w-full border-dashed justify-center p-3"
                                                         disabled={isLoadingSocialPlatforms || (availableSocialPlatforms.length > 0 && availableSocialPlatforms.every(p => fields.some(f => f.platform === p.name)))}
                                                     >
                                                         <User className="mr-2 h-4 w-4" />
                                                         Add social account
                                                     </Button>
                                                 </DropdownMenuTrigger>
                                                 <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
                                                    {isLoadingSocialPlatforms ? (<DropdownMenuItem disabled>Loading...</DropdownMenuItem>) : availableSocialPlatforms.length > 0 ? (
                                                         availableSocialPlatforms.map(platform => (
                                                             <DropdownMenuItem
                                                                 key={platform.name}
                                                                 onSelect={() => handleAddSocialAccount(platform.name)}
                                                                 disabled={fields.some(f => f.platform === platform.name)}
                                                                 className="capitalize flex justify-between"
                                                             >
                                                                 <span>{platform.name}</span>
                                                                 <span className="text-muted-foreground text-xs">{platform.cost.toFixed(2)} credits</span>
                                                             </DropdownMenuItem>
                                                         ))
                                                     ) : (<DropdownMenuItem disabled>No platforms available.</DropdownMenuItem>)}
                                                 </DropdownMenuContent>
                                             </DropdownMenu>
                                         </div>
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