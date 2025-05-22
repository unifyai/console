// src/hooks/useHireAssistantForm.ts
import * as React from 'react';
import { useForm } from "react-hook-form";
import { AssistantFormData, AssistantActions, Voice, Assistant, AssistantPreset } from '@/types/team/assistant';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';
import { Gender, SupportedLanguage } from '@cartesia/cartesia-js/api';
import voicePresetsConstant from '@/constants/assistants/voice_presets.js'; // Assuming direct import
import { uploadImageToGCS } from '@/utils/team/gcs-utils';

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
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handleImageRemove = React.useCallback(() => {
        const currentPreview = getValues("imagePreview");
        if (currentPreview && currentPreview.startsWith('blob:')) {
            URL.revokeObjectURL(currentPreview);
        }
        setValue("imageFile", null);
        setValue("imagePreview", null);
    }, [getValues, setValue]);

    const selectPreset = React.useCallback((preset: AssistantPreset) => {
        handleImageRemove();
        setValue("first_name", preset.first_name, { shouldValidate: true });
        setValue("surname", preset.surname, { shouldValidate: true });
        setValue("age", preset.age, { shouldValidate: true });
        setValue("region", preset.region ?? '', { shouldValidate: true });
        setValue("about", preset.about ?? '', { shouldValidate: true });
        setValue("imagePreview", preset.profile_photo); // URL from preset
        setValue("imageFile", null);

        const presetVoice = (voicePresetsConstant as Voice[]).find(vp => vp.voice_id === preset.voice_id) || defaultVoice;
        setValue("voice_id", presetVoice.voice_id);
        setValue("voice_name", presetVoice.name);
        setValue("voice_description", presetVoice.description);
        setValue("voice_language", presetVoice.language as SupportedLanguage);
        setValue("voice_gender", presetVoice.gender as Gender);
        setValue("voice_exists", false); // Presets are not user's custom voices initially

        clearErrors();
    }, [setValue, handleImageRemove, clearErrors, defaultVoice]);

    const submitAssistantData = async (data: AssistantFormData) => {

        setIsSubmitting(true);
        clearErrors();
        const toastId = toast.loading("Hiring assistant...");
        let finalImageUrlToSend: string | null = null;

        try {
            const ageNumber = typeof data.age === 'string' ? parseInt(data.age, 10) : data.age;
            if (data.age != null && (isNaN(ageNumber as number) || (ageNumber as number) <= 0)) {
                setError("age", { type: "manual", message: "Valid age is required." });
                toast.error("Invalid age provided.", { id: toastId });
                setIsSubmitting(false); return;
            }

            if (!data.voice_id || !data.voice_name || !data.voice_gender || !data.voice_language) {
                setError("voice_id", { type: "manual", message: "Voice selection is required." });
                toast.error("No voice selected.", { id: toastId }); setIsSubmitting(false); return;
            }

            if (!data.voice_exists) { 
                const voiceCreationResponse = await assistantActions.voice.createVoiceInOrchestra(
                    data.voice_id, data.voice_name, data.voice_description || data.voice_name,
                    data.voice_gender, data.voice_language
                );
                if ('detail' in voiceCreationResponse) {
                    console.error(`[useAssistantHireForm.ts] Error registering voice: ${voiceCreationResponse.detail}. Hire aborted.`);
                    toast.error(`Error creating voice. Hiring aborted.`, { id: toastId, duration: 7000 });
                    setIsSubmitting(false); return;
                }
            }

            const imageFile = data.imageFile;
            if (imageFile instanceof File) {
                const createImageResult = await assistantActions.photo.upload(imageFile.type, imageFile.size);
                if ('detail' in createImageResult) {
                    console.error(`[useAssistantHireForm.ts] Image creation error: ${createImageResult.detail}. Hire aborted.`);
                    toast.error(`Error creating photo. Hiring aborted.`, { id: toastId });
                    setIsSubmitting(false); return;
                }
                const { signedUrl, filePath, bucketName } = createImageResult;
                const uploadSuccess = await uploadImageToGCS(imageFile, signedUrl);
                if (!uploadSuccess) {
                    setIsSubmitting(false); return; 
                }
                finalImageUrlToSend = `https://storage.googleapis.com/${bucketName}/${filePath}`;
            } else if (data.imagePreview && !data.imagePreview.startsWith('blob:')) {
                finalImageUrlToSend = data.imagePreview; 
            }
            
            const result = await assistantActions.assistant.create(
                data.first_name, data.surname, ageNumber, data.region, finalImageUrlToSend, data.about, data.voice_id
            );

            if ("assistant" in result && result.assistant) {
                toast.success(`Assistant ${data.first_name} ${data.surname} hired!`, { id: toastId });
                reset(); 
                if (onSuccess) onSuccess(result.assistant);
            } else {
                const errorResult = result as ResponseProps;
                console.error("[useAssistantHireForm.ts] ", errorResult?.detail || "Failed to hire assistant.");
                toast.error("Failed to hire assistant.", { id: toastId });
            }
        } catch (error: any) {
            console.error(`An error occurred: ${error.message}`, { id: toastId });
            toast.error(`Failed to hire assistant.`, { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };


    return {
        hireFormMethods,
        isSubmitting,
        onSubmit: reactHookFormHandleSubmit(submitAssistantData),
        handleImageRemove,
        selectPreset, // Expose this new method
        resetForm: reset // Expose reset if needed externally
    };
}