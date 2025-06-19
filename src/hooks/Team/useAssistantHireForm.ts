import * as React from 'react';
import { useForm } from "react-hook-form";
import { AssistantFormData, AssistantActions, Voice, Assistant, AssistantPreset, PhotoUploadResponse } from '@/types/team/assistant';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';
import { Gender, SupportedLanguage } from '@cartesia/cartesia-js/api';
import voicePresetsConstant from '@/constants/assistants/voice_presets.js';
import { getCountryName, getCountryFlag } from '@/utils/team/country-utils';
import { fetchAvailablePhoneCountries } from '@/lib/team/phone';
import { AvailablePhoneCountry } from '@/types/team/assistant';
import { ASSISTANT_ONBOARDING_FEE, EMAIL_DOMAIN_WITH_AT, FALLBACK_DEFAULT_COUNTRY_CODE } from '@/constants/assistants/assistant_creation';

export function useAssistantHireForm(
    assistantActions: AssistantActions,
    onSuccess?: (newAssistant: Assistant) => void,
    isHireDialogInitiallyOpen?: boolean
) {
    const defaultVoice = (voicePresetsConstant as Voice[])[0];
    const initialLocalPart = "new-assistant";
    const initialEmail = `${initialLocalPart}${EMAIL_DOMAIN_WITH_AT}`;
    const [availablePhoneCountries, setAvailablePhoneCountries] = React.useState<AvailablePhoneCountry[]>([]);
    const [isLoadingCountries, setIsLoadingCountries] = React.useState(true);

    const hireFormMethods = useForm<AssistantFormData>({
        defaultValues: {
            first_name: '', surname: '', age: null, region: '', about: '',
            email: initialEmail,
            emailManuallyEdited: false,
            user_phone: '',
            country: FALLBACK_DEFAULT_COUNTRY_CODE,
            imageFile: null,
            profile_photo_url: null,
            imagePreview: null,
            voice_id: defaultVoice.voice_id,
            voice_name: defaultVoice.name,
            voice_language: defaultVoice.language as SupportedLanguage,
            voice_description: defaultVoice.description,
            voice_gender: defaultVoice.gender as Gender,
            voice_exists: false,
            videoUrl: null,
            isPresetPristine: false,
            presetOriginalValues: null,
        },
    });
    const { setValue, getValues, setError, clearErrors, handleSubmit: reactHookFormHandleSubmit, reset, trigger, watch } = hireFormMethods;

    React.useEffect(() => {
        async function loadCountries() {
            setIsLoadingCountries(true);
            const countries = await fetchAvailablePhoneCountries();
            setAvailablePhoneCountries(countries);
            // Optionally set a default country from the fetched list if needed
            // For example, if the FALLBACK_DEFAULT_COUNTRY_CODE is not in the list, pick the first one
            if (countries.length > 0 && !countries.find(c => c.code === FALLBACK_DEFAULT_COUNTRY_CODE)) {
                 setValue("country", countries[0].code);
            } else if (countries.length > 0 && countries.find(c => c.code === FALLBACK_DEFAULT_COUNTRY_CODE)) {
                // Ensure the default value is set explicitly if it exists
                setValue("country", FALLBACK_DEFAULT_COUNTRY_CODE);
            } else if (countries.length === 0) {
                 // Handle case where no countries are returned (should be at least US from fallback in fetch)
                 const usName = getCountryName("US") || "United States";
                 const usFlag = getCountryFlag("US");
                 setAvailablePhoneCountries([{ code: "US", name: usName, flag: usFlag }]);
                 setValue("country", "US");
            }
            setIsLoadingCountries(false);
        }
        if(isHireDialogInitiallyOpen) { // Only fetch if dialog is to be shown
            loadCountries();
        }
    }, [isHireDialogInitiallyOpen, setValue]);


    const [isCheckingBalance, setIsCheckingBalance] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [showInsufficientFundsHint, setShowInsufficientFundsHint] = React.useState(false);
    const [fetchedAssistantEmails, setFetchedAssistantEmails] = React.useState<string[]>([]);
    const [isLoadingEmails, setIsLoadingEmails] = React.useState(false);

    React.useEffect(() => {
        if (isHireDialogInitiallyOpen) {
            setIsLoadingEmails(true);
            assistantActions.contact.listAllAssistantEmails()
                .then(result => {
                    if (Array.isArray(result)) {
                        setFetchedAssistantEmails(result);
                    } else {
                        toast.error((result as ResponseProps).detail || "Could not fetch existing assistant emails.");
                        setFetchedAssistantEmails([]);
                    }
                })
                .catch(err => {
                    toast.error("Failed to fetch assistant emails.");
                    setFetchedAssistantEmails([]);
                })
                .finally(() => {
                    setIsLoadingEmails(false);
                });
        }
    }, [assistantActions.contact, isHireDialogInitiallyOpen]);

    const watchedFields = watch(["first_name", "surname", "age", "region", "voice_id", "imageFile", "profile_photo_url", "presetOriginalValues", "country"]);
    React.useEffect(() => {
        const [firstName, surname, age, region, voiceId, imageFile, profilePhotoUrl, originalValues, country] = watchedFields;
    
        if (imageFile) {
            if (getValues("isPresetPristine")) setValue("isPresetPristine", false);
            if (getValues("videoUrl")) setValue("videoUrl", null);
            return;
        }
    
        if (!originalValues) {
            if (getValues("isPresetPristine")) setValue("isPresetPristine", false);
            return;
        }
        
        const isPristine = 
            firstName === originalValues.first_name &&
            surname === originalValues.surname &&
            age === originalValues.age &&
            region === originalValues.region &&
            country === originalValues.country &&
            voiceId === originalValues.voice_id;
    
        if (getValues("isPresetPristine") !== isPristine) {
            setValue("isPresetPristine", isPristine);
        }
    }, [watchedFields, getValues, setValue]);


    const handleImageRemove = React.useCallback(() => {
        const currentPreview = getValues("imagePreview");
        if (currentPreview && currentPreview.startsWith('blob:')) {
            URL.revokeObjectURL(currentPreview);
        }
        setValue("imageFile", null);
        setValue("imagePreview", null);
        setValue("profile_photo_url", null);
        setValue("videoUrl", null);
        setValue("isPresetPristine", false);
    }, [getValues, setValue]);

    const selectPreset = React.useCallback((preset: AssistantPreset) => {
        handleImageRemove();
        setValue("first_name", preset.first_name, { shouldValidate: true });
        setValue("surname", preset.surname, { shouldValidate: true });
        setValue("age", preset.age, { shouldValidate: true });
        setValue("region", preset.region ?? '', { shouldValidate: true });
        setValue("about", preset.about ?? '', { shouldValidate: true });
        setValue("profile_photo_url", preset.profile_photo);
        setValue("imagePreview", preset.profile_photo);
        setValue("imageFile", null);
        setValue("user_phone", '');
        
        const presetCountryIsValid = availablePhoneCountries.find(c => c.code === preset.country);
        setValue("country", presetCountryIsValid ? preset.country : (availablePhoneCountries[0]?.code || FALLBACK_DEFAULT_COUNTRY_CODE), { shouldValidate: true });

        const cleanFname = preset.first_name?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
        const cleanSname = preset.surname?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
        let localPart = "new-assistant";
        if (cleanFname && cleanSname) localPart = `${cleanFname}-${cleanSname}`;
        else if (cleanFname) localPart = cleanFname;
        else if (cleanSname) localPart = cleanSname;
        setValue("email", `${localPart}${EMAIL_DOMAIN_WITH_AT}`, { shouldValidate: true });
        setValue("emailManuallyEdited", false);


        const presetVoice = (voicePresetsConstant as Voice[]).find(vp => vp.voice_id === preset.voice_id) || defaultVoice;
        setValue("voice_id", presetVoice.voice_id);
        setValue("voice_name", presetVoice.name);
        setValue("voice_description", presetVoice.description);
        setValue("voice_language", presetVoice.language as SupportedLanguage);
        setValue("voice_gender", presetVoice.gender as Gender);
        setValue("voice_exists", false);
        setValue("isPresetPristine", true);

        const originalValues = {
            first_name: preset.first_name,
            surname: preset.surname,
            age: preset.age,
            region: preset.region ?? '',
            voice_id: presetVoice.voice_id,
            country: presetCountryIsValid ? preset.country : (availablePhoneCountries[0]?.code || FALLBACK_DEFAULT_COUNTRY_CODE),
        };
        setValue("presetOriginalValues", originalValues); 
        
        assistantActions.photo.downloadPresetVideo(preset.first_name, preset.surname)
            .then(res => {
                if (res.signedUrl) {
                    setValue("videoUrl", res.signedUrl);
                } else {
                    setValue("isPresetPristine", false);
                    setValue("videoUrl", null);
                    console.warn(res.detail || `Preset video could not be loaded for ${preset.first_name} ${preset.surname}.`);
                }
            })
            .catch(err => {
                setValue("isPresetPristine", false);
                setValue("videoUrl", null);
                console.error('Error fetching preset video:', err);
            });

        clearErrors();
        setShowInsufficientFundsHint(false);
    }, [setValue, handleImageRemove, clearErrors, defaultVoice, assistantActions.photo, availablePhoneCountries]);

    const resetFormAndHints = React.useCallback((values?: AssistantFormData) => {
        const defaultFirstName = values?.first_name || '';
        const defaultSurname = values?.surname || '';
        const defaultLocalPart = (defaultFirstName && defaultSurname) ? `${defaultFirstName}-${defaultSurname}`.toLowerCase().replace(/[^a-z0-9-]/g, '') : 'new-assistant';
        const initialCountry = values?.country || (availablePhoneCountries.find(c => c.code === FALLBACK_DEFAULT_COUNTRY_CODE) ? FALLBACK_DEFAULT_COUNTRY_CODE : availablePhoneCountries[0]?.code);

        reset({
            first_name: defaultFirstName,
            surname: defaultSurname,
            age: values?.age || null,
            region: values?.region || '',
            about: values?.about || '',
            email: values?.email || `${defaultLocalPart}${EMAIL_DOMAIN_WITH_AT}`,
            emailManuallyEdited: values?.emailManuallyEdited || false,
            user_phone: values?.user_phone || '',
            country: initialCountry,
            imageFile: null, 
            profile_photo_url: null,
            imagePreview: null,
            voice_id: values?.voice_id || defaultVoice.voice_id,
            voice_name: values?.voice_name || defaultVoice.name,
            voice_language: values?.voice_language || defaultVoice.language as SupportedLanguage,
            voice_description: values?.voice_description || defaultVoice.description,
            voice_gender: values?.voice_gender || defaultVoice.gender as Gender,
            voice_exists: values?.voice_exists || false,
            videoUrl: null,
            isPresetPristine: false,
            presetOriginalValues: null,
        });
        setShowInsufficientFundsHint(false);
    }, [reset, defaultVoice, availablePhoneCountries]);

    const submitAssistantData = async (data: AssistantFormData) => {
        setIsSubmitting(true);
        clearErrors();
        const toastId = toast.loading("Hiring assistant...");
                
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
            if (data.age != null && (isNaN(ageNumber as number) || (ageNumber as number) <= 0)) {
                setError("age", { type: "manual", message: "Valid age is required." });
                throw new Error("Invalid age provided.");
            }
            if (!data.region) {
                setError("region", { type: "manual", message: "Missing assistant region." });
                throw new Error("Missing assistant region.");
            }
            if (!data.country) {
                setError("country", {type: "manual", message: "Phone number country is required."});
                throw new Error("Phone number country is required.");
            }
            const emailValue = data.email;
            if (!emailValue || !emailValue.endsWith(EMAIL_DOMAIN_WITH_AT)) {
                setError("email", { type: "manual", message: `Valid email is required.` });
                throw new Error(`Valid email ending with ${EMAIL_DOMAIN_WITH_AT} is required.`);
            }
            if (fetchedAssistantEmails.includes(emailValue)) {
                setError("email", { type: "manual", message: "This email is already in use." });
                throw new Error("Email already in use.");
            }
            if (!data.user_phone) {
                setError("user_phone", { type: "manual", message: "Valid international phone number is required."});
                throw new Error("Valid international phone number is required");
            }
            if (!data.voice_id || !data.voice_name || !data.voice_gender || !data.voice_language) {
                setError("voice_id", { type: "manual", message: "Voice selection is required." });
                throw new Error("No voice selected.");
            }

            // Registering voices / uploading custom photos
            let finalImageUrlToSend = data.profile_photo_url;
            if (data.imageFile) {
                const formData = new FormData();
                formData.append('file', data.imageFile);
                const photoUploadResult = await assistantActions.photo.upload(formData);
                if ((photoUploadResult as ResponseProps).detail) {
                    throw new Error(`Photo upload failed: ${(photoUploadResult as ResponseProps).detail}`);
                }
                finalImageUrlToSend = (photoUploadResult as PhotoUploadResponse).gcs_url;
                if (!finalImageUrlToSend) {
                    throw new Error("Photo uploaded, but GCS URL was not returned.");
                }
            } else if (data.profile_photo_url) { 
                finalImageUrlToSend = data.profile_photo_url;
            } else if (data.imagePreview && !data.imagePreview.startsWith('blob:')) {
                finalImageUrlToSend = data.imagePreview;
            }
            if (!data.voice_exists && data.voice_id) {
                const voiceCreationResponse = await assistantActions.voice.register(
                    data.voice_id, data.voice_name, data.voice_description || data.voice_name,
                    data.voice_gender, data.voice_language, voicePresetsConstant.map(v => v.voice_id).includes(data.voice_id)
                );
                if ('detail' in voiceCreationResponse) {
                    throw new Error(`Error registering voice: ${(voiceCreationResponse as ResponseProps).detail}`);
                }
            }

            toast.loading("Finalizing assistant hire...", { id: toastId });
            const assistantCreationResult = await assistantActions.assistant.create(
                data.first_name, data.surname, ageNumber, data.region,
                finalImageUrlToSend as string | null,
                data.about, data.voice_id, 
                data.email, data.user_phone, data.country
            );
            if ("assistant" in assistantCreationResult && assistantCreationResult.assistant) {
                toast.success(`Assistant ${data.first_name} ${data.surname} hired!`, { id: toastId });
                resetFormAndHints();
                if (onSuccess) onSuccess(assistantCreationResult.assistant);
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
                hireFormMethods.formState.errors.country
            );

            if (!isRHFError) {
                 toast.error(`${error.message}. Hiring aborted.`, { id: toastId, duration: 7000 });
            } else {
                toast.dismiss(toastId);
            }
            console.error(`[useAssistantHireForm] Hiring process failed: ${error.message}`, error);

        } finally {
            setIsSubmitting(false);
        }
    };

    const RHFSubmitHandler = reactHookFormHandleSubmit(submitAssistantData);

    const initiateHireSequence = async (event?: React.BaseSyntheticEvent) => {
        if (isSubmitting || isCheckingBalance || isLoadingEmails || isLoadingCountries) {
            if(isLoadingEmails || isLoadingCountries)
            return;
        }

        const isValid = await trigger();
        if (!isValid) {
            return;
        }
        
        const currentEmail = getValues("email");
        if (!currentEmail || currentEmail.startsWith('@')) { 
            setError("email", { type: "manual", message: "Email local part cannot be empty." });
            toast.error("Email local part cannot be empty.");
            return;
        }
        if (fetchedAssistantEmails.includes(currentEmail)) {
            setError("email", { type: "manual", message: "This email is already in use." });
            toast.error("This email is already in use. Please choose another.");
            return;
        }

        setIsCheckingBalance(true);
        setShowInsufficientFundsHint(false);
        const balanceToastId = toast.loading("Checking your balance...");

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
                toast.error((balanceResult as ResponseProps)?.detail || "Failed to check balance.", { id: balanceToastId });
                setIsCheckingBalance(false);
                return;
            }

            const currentBalance = (balanceResult as {balance: string, fullBalance: number}).fullBalance;

            if (currentBalance < ASSISTANT_ONBOARDING_FEE) {
                toast.dismiss(balanceToastId);
                setShowInsufficientFundsHint(true);
            } else {
                toast.dismiss(balanceToastId);
                await RHFSubmitHandler(event); 
            }
        } catch (error) {
            toast.error("Error during balance check process.", { id: balanceToastId });
            console.error("Balance check/hire attempt error:", error);
        } finally {
            setIsCheckingBalance(false);
        }
    };

    return {
        hireFormMethods,
        initiateHireSequence,
        isCheckingBalance,
        isSubmitting,
        showInsufficientFundsHint,
        setShowInsufficientFundsHint,
        handleImageRemove,
        selectPreset,
        resetForm: resetFormAndHints,
        rhfInternalFormSubmit: RHFSubmitHandler,
        fetchedAssistantEmails,
        isLoadingEmails,
        availablePhoneCountries,
        isLoadingCountries,
    };
}