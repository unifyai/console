import * as React from 'react';
import { useForm } from "react-hook-form";
import { AssistantFormData, AssistantActions, Voice, Assistant, AssistantPreset, PhotoUploadResponse, VoiceOption, AvailableSocialPlatform, AssistantUpdatePayload, SocialAccount, PreHireChatMessage, UserLocalDesktop } from '@/types/assistants/assistant';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';
import { Gender, SupportedLanguage } from '@cartesia/cartesia-js/api';
import voicePresetsConstant from "@/constants/assistants/voice_presets.js";
import { getCountryName, getCountryFlag } from '@/utils/assistants/country-utils';
import { AvailablePhoneCountry } from '@/types/assistants/assistant';
import { ASSISTANT_ONBOARDING_FEE, EMAIL_DOMAIN_WITH_AT, FALLBACK_DEFAULT_COUNTRY_CODE, PRIMARY_VOICE_PROVIDER } from '@/constants/assistants/settings';
import { ChatMessage } from '@/types/assistants/chat';
import { v4 as uuidv4 } from 'uuid';

export function useAssistantHireForm(
    assistantActions: AssistantActions,
    registeredVoices: VoiceOption[],
    onHireSuccess?: (newAssistant: Assistant, formData: AssistantFormData, chatHistory?: ChatMessage[]) => void,
    onUpdateSuccess?: (updatedPayload: Partial<AssistantUpdatePayload>) => void,
    isDialogOpen?: boolean
) {
    const toastIdRef = React.useRef<string | number | undefined>(undefined);

    // Find a default voice that matches the current PRIMARY_VOICE_PROVIDER
    const getDefaultVoiceForProvider = () => {
        let suitableDefault = (voicePresetsConstant as Voice[]).find(vp => vp.provider === PRIMARY_VOICE_PROVIDER);
        if (!suitableDefault && voicePresetsConstant.length > 0) {
            suitableDefault = (voicePresetsConstant as Voice[])[0]; // Fallback to first preset if no provider match
        }
        if (!suitableDefault) { // Absolute fallback if voicePresetsConstant is empty
            return { voice_id: '', name: 'Default', language: 'en', description: 'Default voice', gender: 'female', provider: PRIMARY_VOICE_PROVIDER };
        }
        return suitableDefault;
    };
    const defaultVoice = getDefaultVoiceForProvider();

    const [availablePhoneCountries, setAvailablePhoneCountries] = React.useState<AvailablePhoneCountry[]>([]);
    const [isLoadingCountries, setIsLoadingCountries] = React.useState(true);
    const [editingAssistant, setEditingAssistant] = React.useState<Assistant | null>(null);

    const hireFormMethods = useForm<AssistantFormData>({
        mode: 'onSubmit',
        defaultValues: {
            first_name: '', surname: '', age: null, nationality: 'United States', about: '',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            email: null,
            isEmailAdded: false,
            emailManuallyEdited: false,
            user_phone: '',
            user_phone_isVerified: false,
            user_phone_isVerifying: false,
            user_phone_verificationCodeSent: null,
            user_phone_verificationSentAt: null,
            user_phone_verificationAttempts: 0,
            user_phone_verificationError: null,
            user_whatsapp_number: null,
            social_accounts: [],
            phone_country: FALLBACK_DEFAULT_COUNTRY_CODE,
            photoFile: null,
            videoFile: null,
            profile_photo_url: null,
            profile_video_url: null,
            photoPreviewUrl: null,
            videoPreviewUrl: null,
            voice_id: defaultVoice.voice_id,
            voice_name: defaultVoice.name,
            voice_language: defaultVoice.language as SupportedLanguage,
            voice_description: defaultVoice.description,
            voice_gender: defaultVoice.gender as Gender,
            voice_provider: defaultVoice.provider || PRIMARY_VOICE_PROVIDER,
            voice_exists: false,
            isPresetPristine: false,
            presetOriginalValues: null,
            currentPreset: null,
            isPhoneNumberAdded: false,
            setup: 'remote',
            operating_system: 'ubuntu',
            video_source_voice_id: null,
            design_include_bio: false,
            fast_mode: false,
        },
    });

    const { setValue, getValues, setError, clearErrors, handleSubmit: reactHookFormHandleSubmit, reset, trigger, watch } = hireFormMethods;

    /* -------------------------
        General form utilities
    ------------------------- */
    React.useEffect(() => {
        async function loadCountries() {
            setIsLoadingCountries(true);
            const countries = await assistantActions.contact.listAvailablePhoneCountries();
            setAvailablePhoneCountries(countries);
            // Optionally set a default country from the fetched list if needed
            // For example, if the FALLBACK_DEFAULT_COUNTRY_CODE is not in the list, pick the first one
            if (countries.length > 0 && !countries.find(c => c.code === FALLBACK_DEFAULT_COUNTRY_CODE)) {
                 setValue("phone_country", countries[0].code);
            } else if (countries.length > 0 && countries.find(c => c.code === FALLBACK_DEFAULT_COUNTRY_CODE)) {
                // Ensure the default value is set explicitly if it exists
                setValue("phone_country", FALLBACK_DEFAULT_COUNTRY_CODE);
            } else if (countries.length === 0) {
                 // Handle case where no countries are returned (should be at least US from fallback in fetch)
                 const usName = getCountryName("US") || "United States";
                 const usFlag = getCountryFlag("US");
                 setAvailablePhoneCountries([{ code: "US", name: usName, flag: usFlag }]);
                 setValue("phone_country", "US");
            }
            setIsLoadingCountries(false);
        }
        if(isDialogOpen) {
            loadCountries();
        }
    }, [isDialogOpen, setValue]);


    const [isCheckingBalance, setIsCheckingBalance] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [showInsufficientFundsHint, setShowInsufficientFundsHint] = React.useState(false);
    const [fetchedAssistantEmails, setFetchedAssistantEmails] = React.useState<string[]>([]);
    const [isLoadingEmails, setIsLoadingEmails] = React.useState(false);

    React.useEffect(() => {
        if (isDialogOpen) {
            setIsLoadingEmails(true);
            assistantActions.contact.listAllAssistantEmails()
                .then(result => {
                    if (Array.isArray(result)) {
                        setFetchedAssistantEmails(result);
                    } else {
                        console.error(`[useAssistantHireForm] ${(result as ResponseProps).detail || "Could not fetch existing assistant emails."}`);
                        setFetchedAssistantEmails([]);
                    }
                })
                .catch(err => {
                    console.error("[useAssistantHireForm] Failed to fetch assistant emails.");
                    setFetchedAssistantEmails([]);
                })
                .finally(() => {
                    setIsLoadingEmails(false);
                });
        }
    }, [assistantActions.contact, isDialogOpen]);

    const watchedFields = watch([
        "first_name", "surname", "age", "nationality", "about",
        "voice_id", "photoFile", "profile_photo_url",
        "presetOriginalValues", "phone_country"
    ]);
    React.useEffect(() => {
        const [
            firstName, surname, age, nationality, about,
            voiceId, photoFile, profilePhotoUrl,
            originalValues, phone_country
        ] = watchedFields;

        if (photoFile) {
            if (getValues("isPresetPristine")) {
                setValue("isPresetPristine", false);
            }
            return;
        }

        if (!originalValues) {
            if (getValues("isPresetPristine")) {
                setValue("isPresetPristine", false);
            }
            return;
        }

        const currentPreset = getValues("currentPreset");
        const isVoicePristine = currentPreset
            ? (voiceId === currentPreset.voice_ids.openai || voiceId === currentPreset.voice_ids[PRIMARY_VOICE_PROVIDER])
            : (voiceId === originalValues.voice_id);

        let isPristine =
            firstName === originalValues.first_name &&
            surname === originalValues.surname &&
            age === originalValues.age &&
            (nationality ?? '') === (originalValues.nationality ?? '') &&
            phone_country === originalValues.phone_country &&
            isVoicePristine &&
            (profilePhotoUrl === originalValues.profile_photo_url || (!profilePhotoUrl && !originalValues.profile_photo_url));

        if (getValues("isPresetPristine") && !isPristine) {
            setValue("isPresetPristine", false);
        }
    }, [watchedFields, getValues, setValue]);

    const handleMediaRemove = React.useCallback(() => {
        const photoPreview = getValues("photoPreviewUrl");
        if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
        const videoPreview = getValues("videoPreviewUrl");
        if (videoPreview?.startsWith('blob:')) URL.revokeObjectURL(videoPreview);

        setValue("photoFile", null);
        setValue("videoFile", null);
        setValue("video_source_voice_id", null);
        setValue("photoPreviewUrl", null);
        setValue("videoPreviewUrl", null);
        setValue("profile_photo_url", null);
        setValue("profile_video_url", null);
        setValue("isPresetPristine", false);
    }, [getValues, setValue]);

    const onNewMediaReady = React.useCallback((file: File | null, mediaType: 'photo' | 'video', metadata?: { voiceId?: string }) => {
        if (mediaType === 'photo') {
            const currentPhotoPreview = getValues("photoPreviewUrl");
            if (currentPhotoPreview?.startsWith('blob:')) URL.revokeObjectURL(currentPhotoPreview);
            const currentVideoPreview = getValues("videoPreviewUrl");
            if (currentVideoPreview?.startsWith('blob:')) URL.revokeObjectURL(currentVideoPreview);

            setValue("photoFile", file);
            setValue("photoPreviewUrl", file ? URL.createObjectURL(file) : null);
            setValue("videoFile", null);
            setValue("video_source_voice_id", null);
            setValue("videoPreviewUrl", null);
            setValue("profile_video_url", null);
        } else { // video
            const currentVideoPreview = getValues("videoPreviewUrl");
            if (currentVideoPreview?.startsWith('blob:')) URL.revokeObjectURL(currentVideoPreview);
            setValue("videoFile", file);
            setValue("video_source_voice_id", metadata?.voiceId || null);
            setValue("videoPreviewUrl", file ? URL.createObjectURL(file) : null);
        }
        setValue("isPresetPristine", false);
    }, [getValues, setValue]);

    const selectPreset = React.useCallback((preset: AssistantPreset) => {
        handleMediaRemove();
        const isFastMode = getValues("fast_mode");

        setValue("setup", "remote");
        setValue("currentPreset", preset);
        setValue("first_name", preset.first_name, { shouldValidate: true });
        setValue("surname", preset.surname, { shouldValidate: true });
        setValue("age", preset.age, { shouldValidate: true });
        setValue("nationality", preset.nationality ?? 'United States', { shouldValidate: true });
        setValue("about", preset.about ?? '', { shouldValidate: true });
        setValue("profile_photo_url", preset.profile_photo);
        setValue("photoPreviewUrl", preset.profile_photo);
        setValue("photoFile", null);
        setValue("videoFile", null);
        setValue("video_source_voice_id", null);
        setValue("user_phone", '');
        setValue("user_phone_isVerified", false);
        setValue("user_phone_isVerifying", false);
        setValue("user_phone_verificationCodeSent", null);
        setValue("user_phone_verificationSentAt", null);
        setValue("user_phone_verificationAttempts", 0);
        setValue("user_phone_verificationError", null);
        setValue("social_accounts", []);
        setValue("timezone", preset.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

        // Determine the voice_id based on fast_mode or PRIMARY_VOICE_PROVIDER
        const preferredProvider = isFastMode ? "openai" : PRIMARY_VOICE_PROVIDER;
        const fallbackProvider = isFastMode ? PRIMARY_VOICE_PROVIDER : "openai";

        const providerSpecificVoiceId = preset.voice_ids[preferredProvider] ?? preset.voice_ids[fallbackProvider] ?? null;
        const finalProvider = providerSpecificVoiceId === preset.voice_ids[fallbackProvider] ? fallbackProvider : preferredProvider;
        
        // Find the full voice details from voicePresetsConstant using the providerSpecificVoiceId
        let selectedPresetVoiceDetails: VoiceOption | undefined = (voicePresetsConstant as VoiceOption[]).find(
            vp => vp.voice_id === providerSpecificVoiceId && (vp.provider === finalProvider)
        );

        if (!selectedPresetVoiceDetails && providerSpecificVoiceId) {
            console.warn(`Voice ID ${providerSpecificVoiceId} found in assistant preset but not in voice_presets.js. Using fallback.`);
            selectedPresetVoiceDetails = {
                voice_id: providerSpecificVoiceId, name: "Preset Voice", description: "Preset voice",
                gender: preset.gender === 'male' ? 'male' : 'female', language: 'en', provider: finalProvider,
                is_preset: true, isUserVoiceInOrchestra: false,
            };
        } else if (!selectedPresetVoiceDetails) {
            selectedPresetVoiceDetails = defaultVoice as VoiceOption;
            if(selectedPresetVoiceDetails) {
                 selectedPresetVoiceDetails.isUserVoiceInOrchestra = false;
                 selectedPresetVoiceDetails.is_preset = true;
            }
            console.warn(`No corresponding voice_id found in preset. Using default voice.`);
        }

        setValue("voice_id", selectedPresetVoiceDetails.voice_id);
        setValue("voice_name", selectedPresetVoiceDetails.name);
        setValue("voice_description", selectedPresetVoiceDetails.description);
        setValue("voice_language", selectedPresetVoiceDetails.language as SupportedLanguage);
        setValue("voice_gender", selectedPresetVoiceDetails.gender as Gender);
        setValue("voice_provider", selectedPresetVoiceDetails.provider || PRIMARY_VOICE_PROVIDER);

        const voiceAlreadyExists = registeredVoices.some(
            v => v.voice_id === providerSpecificVoiceId && v.isUserVoiceInOrchestra
        );
        setValue("voice_exists", voiceAlreadyExists);

        setValue("isPresetPristine", true);
        const originalValues = {
            first_name: preset.first_name,
            surname: preset.surname,
            age: preset.age,
            nationality: preset.nationality ?? '',
            voice_id: selectedPresetVoiceDetails.voice_id,
            video_source_voice_id: providerSpecificVoiceId,
            profile_photo_url: preset.profile_photo,
            phone_country: preset.phone_country || FALLBACK_DEFAULT_COUNTRY_CODE,
        };
        setValue("presetOriginalValues", originalValues);
        setValue("videoPreviewUrl", null);
        assistantActions.photo.downloadPresetVideo(preset.first_name, preset.surname, finalProvider)
            .then(res => {
                if (res.signedUrl) {
                    setValue("videoPreviewUrl", res.signedUrl);
                    setValue("video_source_voice_id", providerSpecificVoiceId);
                    setValue("profile_video_url", `gs://${process.env.NEXT_PUBLIC_ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME}/preset_assistants/${preset.first_name}_${preset.surname}_${finalProvider.toLowerCase()}.mp4`);
                } else {
                    setValue("isPresetPristine", false);
                }
            })
            .catch(err => {
                setValue("isPresetPristine", false);
                setValue("videoPreviewUrl", null);
            });

        clearErrors();
        setShowInsufficientFundsHint(false);
    }, [setValue, handleMediaRemove, clearErrors, defaultVoice, assistantActions.photo, getValues, registeredVoices]);

    const resetFormAndHints = React.useCallback((values?: AssistantFormData) => {
        reset({
            first_name: values?.first_name || '',
            surname: values?.surname || '',
            age: values?.age || null,
            nationality: values?.nationality || 'United States',
            about: values?.about || '',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            email: null,
            isEmailAdded: false,
            emailManuallyEdited: false,
            user_phone: '',
            user_phone_isVerified: false,
            user_phone_isVerifying: false,
            user_phone_verificationCodeSent: null,
            user_phone_verificationSentAt: null,
            user_phone_verificationAttempts: 0,
            user_phone_verificationError: null,
            user_whatsapp_number: null,
            social_accounts: [],
            phone_country: FALLBACK_DEFAULT_COUNTRY_CODE,
            photoFile: null,
            videoFile: null,
            profile_photo_url: null,
            profile_video_url: null,
            photoPreviewUrl: null,
            videoPreviewUrl: null,
            video_source_voice_id: null,
            voice_id: values?.voice_id || defaultVoice.voice_id,
            voice_name: values?.voice_name || defaultVoice.name,
            voice_language: values?.voice_language || defaultVoice.language as SupportedLanguage,
            voice_description: values?.voice_description || defaultVoice.description,
            voice_gender: values?.voice_gender || defaultVoice.gender as Gender,
            voice_exists: values?.voice_exists || false,
            voice_provider: values?.voice_provider || defaultVoice.provider || PRIMARY_VOICE_PROVIDER,
            isPresetPristine: false,
            presetOriginalValues: null,
            currentPreset: null,
            operating_system: 'ubuntu',
            design_include_bio: false,
        });
        setShowInsufficientFundsHint(false);
    }, [reset, defaultVoice]);

    /* ----------------------------
        Editing exsiting assistant
       ---------------------------- */
    const loadAssistantForEdit = React.useCallback((assistant: Assistant) => {
        setEditingAssistant(assistant);
        const socialAccounts: SocialAccount[] = [];
        if (assistant.user_whatsapp_number) {
            socialAccounts.push({ platform: 'whatsapp', identifier: assistant.user_whatsapp_number, isVerified: true, isInitial: true, isVerifying: false, verificationCodeSent: null, verificationSentAt: null, verificationAttempts: 0, verificationError: null });
        }
        const assistantVoiceDetails = registeredVoices.find(v => v.voice_id === assistant.voice_id && v.provider === assistant.voice_provider);
        reset({
            ...getValues(),

            // Profile
            first_name: assistant.first_name,
            surname: assistant.surname,
            age: assistant.age,
            nationality: assistant.nationality,
            about: assistant.about || '',
            timezone: assistant.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',

            // Media
            photoPreviewUrl: assistant.signedProfilePhotoUrl || assistant.profile_photo,
            videoPreviewUrl: assistant.signedProfileVideoUrl || assistant.profile_video,
            profile_photo_url: assistant.profile_photo,
            profile_video_url: assistant.profile_video,
            photoFile: null,
            videoFile: null,

            // Contact
            phone_country: assistant.phone_country || FALLBACK_DEFAULT_COUNTRY_CODE,
            user_phone: assistant.user_phone || '',
            user_phone_isVerified: !!assistant.user_phone,
            social_accounts: socialAccounts,
            isPhoneNumberAdded: !!assistant.phone,
            email: assistant.email || null,
            isEmailAdded: !!assistant.email,
            emailManuallyEdited: true, // Assume existing email was set

            // Voice
            voice_id: assistant.voice_id || undefined,
            voice_name: assistantVoiceDetails?.name,
            voice_description: assistantVoiceDetails?.description,
            voice_gender: assistantVoiceDetails?.gender,
            voice_language: assistantVoiceDetails?.language,
            voice_provider: assistant.voice_provider || assistantVoiceDetails?.provider || PRIMARY_VOICE_PROVIDER,
            voice_exists: !!assistantVoiceDetails, 

            // Advanced
            setup: assistant.user_local_desktop ? 'local' : 'remote',
            operating_system: (assistant.user_local_desktop as UserLocalDesktop | null) || 'ubuntu',
        });
        setShowInsufficientFundsHint(false);
    }, [reset, getValues, registeredVoices]);

    const initiateUpdateSequence = reactHookFormHandleSubmit(async (data: AssistantFormData) => {
        if (!editingAssistant) {
            toast.error("No assistant selected for editing.");
            return;
        }
        setIsSubmitting(true);
        clearErrors();

        toastIdRef.current = toast.loading("Updating assistant...", { id: toastIdRef.current });

        try {
            // Validations
            if (data.isEmailAdded) {
                const emailValue = data.email;
                if (!emailValue || !emailValue.endsWith(EMAIL_DOMAIN_WITH_AT)) {
                    setError("email", { type: "manual", message: `Valid email is required.` });
                    throw new Error(`Valid email ending with ${EMAIL_DOMAIN_WITH_AT} is required.`);
                }
            }
            if (data.isPhoneNumberAdded) {
                if (data.user_phone && !data.user_phone_isVerified) {
                    setError("user_phone", { type: "manual", message: "Your phone number must be verified." });
                    throw new Error("Your phone number must be verified.");
                }
            }
            if (data.social_accounts && data.social_accounts.some(acc => acc.identifier && !acc.isVerified)) {
                toast.error("All added social accounts must be verified before saving.");
                throw new Error("Unverified social accounts.");
            }

            // Construct payload with only changed fields
            const payload: Partial<AssistantUpdatePayload> = {};

            if (data.about !== editingAssistant.about) payload.about = data.about;
            if (data.timezone !== editingAssistant.timezone) payload.timezone = data.timezone;
            if (data.voice_id !== editingAssistant.voice_id) payload.voice_id = data.voice_id;
            if (data.voice_provider !== editingAssistant.voice_provider) payload.voice_provider = data.voice_provider;
            const new_voice_mode = data.fast_mode ? "sts" : "tts";
            if (new_voice_mode !== editingAssistant.voice_mode) payload.voice_mode = new_voice_mode;

            if (data.isEmailAdded) {
                if (data.email !== editingAssistant.email) {
                    payload.email = data.email || null;
                }
            } else { // Email was removed
                if (editingAssistant.email !== null) {
                    payload.email = null;
                }
            }

            if (data.isPhoneNumberAdded) {
                if (data.user_phone !== editingAssistant.user_phone) payload.user_phone = data.user_phone || null;
            }

            if (data.phone_country !== editingAssistant.phone_country) {
                payload.phone_country = data.phone_country;
            }

            const whatsappAccount = data.social_accounts?.find(acc => acc.platform === 'whatsapp' && acc.isVerified);
            const user_whatsapp_number = whatsappAccount ? whatsappAccount.identifier : null;
            if (user_whatsapp_number !== editingAssistant.user_whatsapp_number) payload.user_whatsapp_number = user_whatsapp_number;

            const setupValue = data.setup === 'local' ? data.operating_system : null;
            if (setupValue !== (editingAssistant.user_local_desktop || null)) {
                payload.user_local_desktop = setupValue;
            }

            // Image/Video upload logic
            if (data.photoFile) {
                const formData = new FormData();
                formData.append('file', data.photoFile);
                const photoUploadResult = await assistantActions.photo.upload(formData);
                if ((photoUploadResult as ResponseProps).detail) throw new Error(`Photo upload failed: ${(photoUploadResult as ResponseProps).detail}`);
                payload.profile_photo = (photoUploadResult as PhotoUploadResponse).gcs_url;
            }
            if (data.videoFile) {
                const formData = new FormData();
                formData.append('file', data.videoFile);
                const videoUploadResult = await assistantActions.photo.uploadVideo(formData);
                if ((videoUploadResult as ResponseProps).detail) throw new Error(`Video upload failed: ${(videoUploadResult as ResponseProps).detail}`);
                payload.profile_video = (videoUploadResult as PhotoUploadResponse).gcs_url;
            }

            if (data.voice_id && !data.voice_exists) {
                 const provider = data?.voice_provider || defaultVoice.provider || PRIMARY_VOICE_PROVIDER;
                 const voiceCreationResponse = await assistantActions.voice.register(data.voice_id, provider, data.voice_name!, data.voice_description!, data.voice_gender!, data.voice_language!, false);
                 if ('detail' in voiceCreationResponse && !voiceCreationResponse.detail.includes("already exists")) throw new Error(`Error registering voice: ${(voiceCreationResponse as ResponseProps).detail}`);
            }

            if (Object.keys(payload).length > 0) {
                const updateResult = await assistantActions.assistant.update(editingAssistant.agent_id, payload);
                if ((updateResult as ResponseProps).detail) {
                    throw new Error((updateResult as ResponseProps).detail);
                }
                toast.success(`Assistant ${data.first_name} updated!`, { id: toastIdRef.current });
            } else {
                toast.info("No changes to save.", { id: toastIdRef.current });
            }

            toastIdRef.current = undefined;
            if (onUpdateSuccess) onUpdateSuccess(payload);

        } catch (error: any) {
             const isRHFError = !!(hireFormMethods.formState.errors.user_phone || hireFormMethods.formState.errors.social_accounts);
             if (!isRHFError) toast.error(`An error occurred while updating. Please try again.`, { id: toastIdRef.current });
             else if(toastIdRef.current) toast.dismiss(toastIdRef.current);

             toastIdRef.current = undefined;
             console.error(`[useAssistantHireForm] Update process failed: ${error.message}`, error);
        } finally {
            setIsSubmitting(false);
        }
    });

    /* -------------------------
        Hiring new assistant
       ------------------------- */
    const submitAssistantData = async (data: AssistantFormData, chatHistory?: ChatMessage[]) => {
        setIsSubmitting(true);
        clearErrors();

        toastIdRef.current = toast.loading("Hiring assistant...", { id: toastIdRef.current });

        try {
            // Input validity checks
            if (!data.first_name) {
                setError("first_name", { type: "manual", message: "Missing assistant first name." });
                throw new Error("Missing assistant first name.");
            }
            if (!data.surname) {
                setError("surname", { type: "manual", message: "Missing assistant surname." });
                throw new Error("Missing assistant surname.");
            }
            const ageNumber = typeof data.age === 'string' ? parseInt(data.age, 10) : data.age;
            if (data.age != null && (isNaN(ageNumber as number) || (ageNumber as number) < 18 || (ageNumber as number) > 70)) {
                setError("age", { type: "manual", message: "Age must be between 18 and 70." });
                throw new Error("Invalid age provided.");
            }
            if (!data.nationality) {
                setError("nationality", { type: "manual", message: "Missing assistant nationality." });
                throw new Error("Missing assistant nationality.");
            }
            
            if (!data.voice_id || !data.voice_name || !data.voice_gender || !data.voice_language) {
                setError("voice_id", { type: "manual", message: "Voice selection is required." });
                throw new Error("No voice selected.");
            }

            // Generate initial greeting if no pre-hire chat exists
            let finalChatHistory = chatHistory;
            if (!chatHistory || chatHistory.length === 0) {
                try {
                    const greetingResponse = await fetch('/api/assistant/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'post-hire-greeting',
                            assistantName: `${data.first_name} ${data.surname}`,
                            assistantAge: data.age,
                            assistantBio: data.about,
                            assistantNationality: data.nationality,
                            preHireChat: []
                        }),
                    });
                    if (!greetingResponse.ok) throw new Error("Failed to generate assistant's first message.");
                    const { content } = await greetingResponse.json();
                    if (!content) throw new Error("Generated an empty greeting.");
                    finalChatHistory = [{ id: uuidv4(), role: 'assistant', content, timestamp: new Date() }];
                } catch (greetingError) {
                    console.error("[useAssistantHireForm] Greeting generation failed:", greetingError);
                }
            }

            // Registering voices / uploading custom photos/videos
            let finalImageUrlToSend: string | null = data.profile_photo_url || null;
            let finalVideoUrlToSend: string | null = data.profile_video_url || null;

            if (data.photoFile) {
                const photoFormData = new FormData();
                photoFormData.append('file', data.photoFile);
                const photoUploadResult = await assistantActions.photo.upload(photoFormData);
                if ((photoUploadResult as ResponseProps).detail) throw new Error(`Photo upload failed: ${(photoUploadResult as ResponseProps).detail}`);
                finalImageUrlToSend = (photoUploadResult as PhotoUploadResponse).gcs_url;
            }

            if (data.videoFile) {
                const videoFormData = new FormData();
                videoFormData.append('file', data.videoFile);
                const videoUploadResult = await assistantActions.photo.uploadVideo(videoFormData);
                if ((videoUploadResult as ResponseProps).detail) throw new Error(`Video upload failed: ${(videoUploadResult as ResponseProps).detail}`);
                finalVideoUrlToSend = (videoUploadResult as PhotoUploadResponse).gcs_url;
            }

            if (data.isPresetPristine) {
                 finalImageUrlToSend = data.profile_photo_url ?? null;
                 finalVideoUrlToSend = data.profile_video_url ?? null;
            }

            const voice_provider = data?.voice_provider || defaultVoice.provider || PRIMARY_VOICE_PROVIDER;
            if (!data.voice_exists && data.voice_id) {
                const voiceCreationResponse = await assistantActions.voice.register(
                    data.voice_id, voice_provider, data.voice_name, data.voice_description || data.voice_name,
                    data.voice_gender, data.voice_language, voicePresetsConstant.map(v => v.voice_id).includes(data.voice_id)
                );
                if ('detail' in voiceCreationResponse && !voiceCreationResponse.detail.includes("already exists")) {
                    throw new Error(`Error registering voice: ${(voiceCreationResponse as ResponseProps).detail}`);
                }
            }
            
            const user_local_desktop_payload = (data.setup === 'local' ? data.operating_system : null) as UserLocalDesktop | null;
            const formattedPreHireChat = finalChatHistory?.map(({ role, content }) => ({ role, msg: content }));
            const voice_mode = data.fast_mode ? "sts" : "tts";

            // Loading message updated to finalizing hire
            const assistantCreationResult = await assistantActions.assistant.create(
                data.first_name, data.surname, ageNumber, data.nationality, data.timezone,
                finalImageUrlToSend, finalVideoUrlToSend,
                data.about, data.voice_id, voice_provider, voice_mode,
                null, null, null, null, user_local_desktop_payload,
                formattedPreHireChat
            );
            if ("assistant" in assistantCreationResult && assistantCreationResult.assistant) {
                toast.success(`Assistant ${data.first_name} ${data.surname} hired!`, { id: toastIdRef.current });
                toastIdRef.current = undefined;
                resetFormAndHints();
                if (onHireSuccess) onHireSuccess(assistantCreationResult.assistant, data, finalChatHistory);
            } else {
                const errorDetail = (assistantCreationResult as ResponseProps).detail || "Failed to hire assistant (unknown error)";
                throw new Error(errorDetail);
            }

        } catch (error: any) {
            const isRHFError = !!(
                hireFormMethods.formState.errors.age ||
                hireFormMethods.formState.errors.email ||
                hireFormMethods.formState.errors.voice_id ||
                hireFormMethods.formState.errors.first_name ||
                hireFormMethods.formState.errors.surname ||
                hireFormMethods.formState.errors.about ||
                hireFormMethods.formState.errors.user_phone ||
                hireFormMethods.formState.errors.phone_country
            );

            if (!isRHFError) {
                 toast.error(`an error occurred during the hiring process. Please try again.`,  { id: toastIdRef.current });
            } else {
                 if(toastIdRef.current) toast.dismiss(toastIdRef.current);
            }
            toastIdRef.current = undefined;
            console.error(`[useAssistantHireForm] Hiring process failed: ${error.message}`, error);

        } finally {
            setIsSubmitting(false);
        }
    };

    const RHFSubmitHandler = (chatHistory?: ChatMessage[]) => reactHookFormHandleSubmit((data) => submitAssistantData(data, chatHistory));

    const initiateHireSequence = async (chatHistory?: ChatMessage[]) => {
        if (isSubmitting || isCheckingBalance || isLoadingEmails || isLoadingCountries) {
            if(isLoadingEmails || isLoadingCountries)
            return;
        }

        const isValid = await trigger();
        if (!isValid) {
            return;
        }

        setIsCheckingBalance(true);
        setShowInsufficientFundsHint(false);
        toastIdRef.current = toast.loading("Checking your balance...");

        try {
            const fetchBalance = async () => {
                try {
                    const balanceData  = await fetch(`/api/billing/balance`). then((response) => response.json());
                    if (!balanceData) return {detail: "Failed to fetch balance data"};
                    return balanceData as {balance: string, fullBalance: number}
                } catch (error) {
                    console.error("Error fetching balance:", error);
                    return {detail: "Failed to fetch balance data"};
                }
            };

            const balanceResult = await fetchBalance();

            if ('detail' in balanceResult || !balanceResult) {
                console.error(`[useAssistantHireForm] ${(balanceResult as ResponseProps)?.detail || "Failed to check balance."}`);
                toast.error("Failed to check balance.", { id: toastIdRef.current });
                toastIdRef.current = undefined;
                setIsCheckingBalance(false);
                return;
            }

            const currentBalance = (balanceResult as {balance: string, fullBalance: number}).fullBalance;
            const totalOnboardingFee = ASSISTANT_ONBOARDING_FEE;


            if (currentBalance < totalOnboardingFee) {
                setShowInsufficientFundsHint(true);
                if(toastIdRef.current) toast.dismiss(toastIdRef.current);
                toastIdRef.current = undefined;
            } else {
                await RHFSubmitHandler(chatHistory)();
            }
        } catch (error) {
            toast.error("Error during balance check process.", { id: toastIdRef.current });
            console.error("[useAssistantHireForm] Balance check/hire attempt error:", error);
            toastIdRef.current = undefined;
        } finally {
            setIsCheckingBalance(false);
        }
    };

    return {
        hireFormMethods,
        onNewMediaReady,
        initiateHireSequence,
        isCheckingBalance,
        showInsufficientFundsHint,
        setShowInsufficientFundsHint,
        selectPreset,
        loadAssistantForEdit,
        initiateUpdate: initiateUpdateSequence,
        isSubmitting,
        resetForm: resetFormAndHints,
        fetchedAssistantEmails,
        isLoadingEmails,
        availablePhoneCountries,
        isLoadingCountries,
    };
}