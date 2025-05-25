import * as React from 'react';
import { useForm } from "react-hook-form";
import { AssistantFormData, AssistantActions, Voice, Assistant, AssistantPreset } from '@/types/team/assistant';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';
import { Gender, SupportedLanguage } from '@cartesia/cartesia-js/api';
import voicePresetsConstant from '@/constants/assistants/voice_presets.js';
import { uploadImageToGCS } from '@/utils/team/gcs-utils';

const ASSISTANT_ONBOARDING_FEE = 10;

interface CreatedResource {
    type: 'email' | 'phone' | 'orchestra-voice' | 'gcs-photo';
    identifier: string; // e.g., email address, phone number, voice_id, GCS URL/path
    // Optionally, add more data if needed for deletion, e.g. for Cartesia voice that might need separate cleanup
    cartesiaVoiceIdIfNewlyCreated?: string;
}

export function useAssistantHireForm(
    assistantActions: AssistantActions,
    onSuccess?: (newAssistant: Assistant) => void
) {
    const defaultVoice = (voicePresetsConstant as Voice[])[0];
    const hireFormMethods = useForm<AssistantFormData>({
        defaultValues: {
            first_name: '', surname: '', age: null, region: '', about: '',
            imageFile: null, imagePreview: null,
            voice_id: defaultVoice.voice_id,
            voice_name: defaultVoice.name,
            voice_language: defaultVoice.language as SupportedLanguage,
            voice_description: defaultVoice.description,
            voice_gender: defaultVoice.gender as Gender,
            voice_exists: false,
        },
    });
    const { setValue, getValues, setError, clearErrors, handleSubmit: reactHookFormHandleSubmit, reset } = hireFormMethods;

    const [isCheckingBalance, setIsCheckingBalance] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [showInsufficientFundsHint, setShowInsufficientFundsHint] = React.useState(false);

    const handleImageRemove = React.useCallback(() => {
        const currentPreview = getValues("imagePreview");
        if (currentPreview && currentPreview.startsWith('blob:')) {
            URL.revokeObjectURL(currentPreview);
        }
        setValue("imageFile", null);
        setValue("imagePreview", null);
        setShowInsufficientFundsHint(false);
    }, [getValues, setValue]);

    const selectPreset = React.useCallback((preset: AssistantPreset) => {
        handleImageRemove();
        setValue("first_name", preset.first_name, { shouldValidate: true });
        setValue("surname", preset.surname, { shouldValidate: true });
        setValue("age", preset.age, { shouldValidate: true });
        setValue("region", preset.region ?? '', { shouldValidate: true });
        setValue("about", preset.about ?? '', { shouldValidate: true });
        setValue("imagePreview", preset.profile_photo);
        setValue("imageFile", null);

        const presetVoice = (voicePresetsConstant as Voice[]).find(vp => vp.voice_id === preset.voice_id) || defaultVoice;
        setValue("voice_id", presetVoice.voice_id);
        setValue("voice_name", presetVoice.name);
        setValue("voice_description", presetVoice.description);
        setValue("voice_language", presetVoice.language as SupportedLanguage);
        setValue("voice_gender", presetVoice.gender as Gender);
        setValue("voice_exists", false);

        clearErrors();
        setShowInsufficientFundsHint(false);
    }, [setValue, handleImageRemove, clearErrors, defaultVoice]);

    const resetFormAndHints = React.useCallback((values?: AssistantFormData) => {
        reset(values);
        setShowInsufficientFundsHint(false);
    }, [reset]);

    const submitAssistantData = async (data: AssistantFormData) => {
        setIsSubmitting(true);
        clearErrors();
        const toastId = toast.loading("Hiring assistant...");
        let finalImageUrlToSend: string | null = null;
        const createdResourcesForCleanup: CreatedResource[] = [];

        try {
            // --- Validate Form Data ---
            const ageNumber = typeof data.age === 'string' ? parseInt(data.age, 10) : data.age;
            if (data.age != null && (isNaN(ageNumber as number) || (ageNumber as number) <= 0)) {
                setError("age", { type: "manual", message: "Valid age is required." });
                throw new Error("Invalid age provided.");
            }
            if (!data.voice_id || !data.voice_name || !data.voice_gender || !data.voice_language) {
                setError("voice_id", { type: "manual", message: "Voice selection is required." });
                throw new Error("No voice selected.");
            }

            // --- Create Email ---
            toast.loading("Provisioning email...", { id: toastId });
            const emailResult = await assistantActions.contact.createEmail(data.first_name, data.surname);
            if ('detail' in emailResult) {
                throw new Error(`Email creation failed`);
            }
            createdResourcesForCleanup.push({ type: 'email', identifier: emailResult.email });

            // --- Create Phone Number ---
            toast.loading("Provisioning phone number...", { id: toastId });
            const phoneResult = await assistantActions.contact.createPhoneNumber();
            if ('detail' in phoneResult) {
                throw new Error(`Phone number provisioning failed`);
            }
            createdResourcesForCleanup.push({ type: 'phone', identifier: phoneResult.phoneNumber });

            // --- Register Voice in Orchestra if not existing ---
            if (!data.voice_exists) {
                toast.loading("Registering voice...", { id: toastId });
                const voiceCreationResponse = await assistantActions.voice.createVoiceInOrchestra(
                    data.voice_id, data.voice_name, data.voice_description || data.voice_name,
                    data.voice_gender, data.voice_language
                );
                if ('detail' in voiceCreationResponse) {
                    throw new Error(`Error registering voice`);
                }
                // If successfully registered in Orchestra, it means this voice_id (Cartesia ID)
                // is now linked. If hire fails later, both Orchestra and Cartesia entries for this
                // voice_id should be cleaned up.
                createdResourcesForCleanup.push({
                    type: 'orchestra-voice',
                    identifier: data.voice_id,
                    cartesiaVoiceIdIfNewlyCreated: data.voice_id
                });
            }

            // --- Upload Profile Photo ---
            const imageFile = data.imageFile;
            if (imageFile instanceof File) {
                toast.loading("Uploading profile photo...", { id: toastId });
                const createImageResult = await assistantActions.photo.upload(imageFile.type, imageFile.size);
                if ('detail' in createImageResult) {
                    throw new Error(`Image creation error`);
                }
                const { signedUrl, filePath, bucketName } = createImageResult;
                const uploadSuccess = await uploadImageToGCS(imageFile, signedUrl);
                if (!uploadSuccess) {
                    throw new Error("Profile photo GCS upload failed.");
                }
                finalImageUrlToSend = `https://storage.googleapis.com/${bucketName}/${filePath}`;
                createdResourcesForCleanup.push({ type: 'gcs-photo', identifier: finalImageUrlToSend });
            } else if (data.imagePreview && !data.imagePreview.startsWith('blob:')) {
                finalImageUrlToSend = data.imagePreview;
            }

            // --- Create Assistant in Orchestra ---
            toast.loading("Finalizing assistant hire...", { id: toastId });
            const assistantCreationResult = await assistantActions.assistant.create(
                data.first_name, data.surname, ageNumber, data.region,
                finalImageUrlToSend, data.about, data.voice_id,
                emailResult.email, phoneResult.phoneNumber
            );

            if ("assistant" in assistantCreationResult && assistantCreationResult.assistant) {
                toast.success(`Assistant ${data.first_name} ${data.surname} hired!`, { id: toastId });
                resetFormAndHints();
                if (onSuccess) onSuccess(assistantCreationResult.assistant);
                // Success, no cleanup needed
                createdResourcesForCleanup.length = 0; // Clear the list
            } else {
                const errorDetail = (assistantCreationResult as ResponseProps).detail || "Failed to hire assistant (unknown error)";
                throw new Error(errorDetail);
            }
        } catch (error: any) {
            console.error(`[useAssistantHireForm] Hiring process failed: ${error.message}`, error);
            toast.error(`${error.message}. Hiring aborted.`, { id: toastId, duration: 7000 });

            // --- Compensation Logic ---
            for (const resource of [...createdResourcesForCleanup].reverse()) {
                try {
                    switch (resource.type) {
                        case 'email':
                            await assistantActions.contact.deleteEmail(resource.identifier);
                            break;
                        case 'phone':
                            await assistantActions.contact.deletePhoneNumber(resource.identifier);
                            break;
                        case 'orchestra-voice':
                            await assistantActions.voice.deleteVoiceFromOrchestra(resource.identifier);
                            if(resource.cartesiaVoiceIdIfNewlyCreated) {
                                await assistantActions.voice.deleteVoiceFromCartesia(resource.cartesiaVoiceIdIfNewlyCreated);
                            }
                            break;
                        case 'gcs-photo':
                            await assistantActions.photo.delete(resource.identifier);
                            break;
                    }
                } catch (cleanupError: any) {
                    console.error(`[useAssistantHireForm] Failed to cleanup ${resource.type} (${resource.identifier}): ${cleanupError.message}`);
                }
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const RHFSubmitHandler = reactHookFormHandleSubmit(submitAssistantData);

    const initiateHireSequence = async () => {
        if (isSubmitting || isCheckingBalance) return;

        setIsCheckingBalance(true);
        setShowInsufficientFundsHint(false);
        const balanceToastId = toast.loading("Checking your balance...");

        try {
            const fetchBalance = async () => {
                try {
                    const balanceData  = await fetch(`/api/billing/balance`). then((response) => response.json());
    
                    if (!balanceData) {
                        return {detail: "Failed to fetch balance data"};
                    }
                    return balanceData as {balance: string, fullBalance: number}
                } catch (error) {
                    console.error("Error fetching balance:", error);
                    return {detail: "Failed to fetch balance data"};
                }
            };

            const balanceResult = await fetchBalance();

            if ('detail' in balanceResult || !balanceResult) {
                toast.error((balanceResult as ResponseProps)?.detail || "Failed to check balance.", { id: balanceToastId });
                return;
            }

            const currentBalance = (balanceResult as {balance: string, fullBalance: number}).fullBalance;

            if (currentBalance < ASSISTANT_ONBOARDING_FEE) {
                toast.dismiss(balanceToastId);
                setShowInsufficientFundsHint(true);
            } else {
                toast.dismiss(balanceToastId);
                await RHFSubmitHandler();
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
        rhfInternalFormSubmit: RHFSubmitHandler
    };
}