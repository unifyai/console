import * as React from 'react';
import { Voice, AssistantActions, VoiceOption, VoiceDesignPreviewItem, VoiceDesignGeneratePreviewsRequest, AssistantFormData } from '@/types/team/assistant';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';
import { SupportedLanguage } from "@cartesia/cartesia-js/api";
import { VOICE_PROVIDER, DESIGN_VOICE_DESC_MIN_LENGTH, DESIGN_VOICE_DESC_MAX_LENGTH, DESIGN_SAMPLE_TEXT_MIN_LENGTH, DESIGN_SAMPLE_TEXT_MAX_LENGTH } from '@/constants/assistants/settings';
import { useFormContext } from 'react-hook-form';

type CreateMode = 'clone' | 'design';

export function useVoiceCreator(
    assistantVoiceActions: AssistantActions['voice'],
    onVoiceCreatedAndSelected?: (voice: VoiceOption) => void,
    fetchUserVoices?: () => void
) {
    const [createMode, setCreateMode] = React.useState<CreateMode>('clone');
    const { getValues } = useFormContext<AssistantFormData>();

    // Clone state
    const [cloneFile, setCloneFile] = React.useState<File | null>(null);
    const [cloneFileName, setCloneFileName] = React.useState<string | null>(null);
    const [cloneName, setCloneName] = React.useState('');
    const [cloneDescription, setCloneDescription] = React.useState('');

    // Design state
    const [designVoiceDescription, setDesignVoiceDescription] = React.useState('');
    const [designSampleText, setDesignSampleText] = React.useState('');
    const [designPreviews, setDesignPreviews] = React.useState<VoiceDesignPreviewItem[]>([]);
    const [selectedPreviewId, setSelectedPreviewId] = React.useState<string | null>(null);
    const [isGeneratingPreviews, setIsGeneratingPreviews] = React.useState(false);
    const [designFinalVoiceName, setDesignFinalVoiceName] = React.useState(''); 

    const [isProcessingCreate, setIsProcessingCreate] = React.useState(false);

    const resetCreateForm = React.useCallback(() => { 
        setCloneFile(null); setCloneFileName(null); setCloneName(''); setCloneDescription('');
        setDesignVoiceDescription(''); setDesignSampleText(''); 
        setDesignPreviews([]); setSelectedPreviewId(null);
        setDesignFinalVoiceName('');
    }, []);

    const handleGenerateDesignPreviews = async () => {
        if (VOICE_PROVIDER !== 'elevenlabs') {
            toast.error("Voice design is only available for the ElevenLabs provider.");
            return;
        }
        
        const includeBio = getValues("design_include_bio");
        const bioText = getValues("about");
        const trimmedVoiceDesc = designVoiceDescription.trim();
        const trimmedSampleText = designSampleText.trim();
        
        if (!includeBio && (trimmedVoiceDesc.length < DESIGN_VOICE_DESC_MIN_LENGTH || trimmedVoiceDesc.length > DESIGN_VOICE_DESC_MAX_LENGTH)) {
            toast.error(`Voice description must be between ${DESIGN_VOICE_DESC_MIN_LENGTH} and ${DESIGN_VOICE_DESC_MAX_LENGTH} characters.`);
            return;
        }
        
        if (includeBio && !bioText?.trim()) {
            toast.error("Profile bio cannot be empty when 'Include profile bio' is checked.");
            return;
        }

        if (trimmedSampleText.length > 0 && (trimmedSampleText.length < DESIGN_SAMPLE_TEXT_MIN_LENGTH || trimmedSampleText.length > DESIGN_SAMPLE_TEXT_MAX_LENGTH)) {
            toast.error(`If sample text is provided, it must be between ${DESIGN_SAMPLE_TEXT_MIN_LENGTH} and ${DESIGN_SAMPLE_TEXT_MAX_LENGTH} characters.`);
            return;
        }

        setIsGeneratingPreviews(true);
        setDesignPreviews([]); 
        setSelectedPreviewId(null);
        const toastId = toast.loading("Generating voice design previews...");
        try {
            const payload: VoiceDesignGeneratePreviewsRequest = {};

            if (includeBio) {
                payload.bio = bioText;
                if (trimmedVoiceDesc) {
                    payload.voice_description = trimmedVoiceDesc;
                }
            } else {
                payload.voice_description = trimmedVoiceDesc;
            }

            if (trimmedSampleText.length > 0) {
                payload.text = trimmedSampleText;
            } else {
                payload.auto_generate_text = true;
            }

            const result = await assistantVoiceActions.preview(payload);

            if ('detail' in result) {
                console.error(`[useVoiceCreator] ${(result as ResponseProps).detail || "Failed to generate previews."}`)
                toast.error("Failed to generate previews.", { id: toastId });
            } else { 
                setDesignPreviews(result.previews || []);
                if ((result.previews || []).length === 0) {
                    toast.info("No previews were generated. Try a different description.", { id: toastId });
                } else {
                    toast.success("Previews generated!", { id: toastId });
                }
            }
        } catch (error: any) {
            console.error(`[useVoiceCreator] Preview generation failed: ${error.message}`)
            toast.error(`Preview generation failed.`, { id: toastId });
        } finally {
            setIsGeneratingPreviews(false);
        }
    };
    
    const handleCreateAndSelect = async () => {
        setIsProcessingCreate(true);
        let backendResponse: (Voice & { info?: string; is_preset?: boolean }) | ResponseProps | null = null;
        const toastId = toast.loading(`Creating voice via ${createMode} mode...`);
        
        try {
            if (createMode === 'clone') {
                if (!cloneFile || !cloneName) {
                    toast.error("Audio file and Voice Name are required for cloning.", { id: toastId });
                    setIsProcessingCreate(false); return;
                }
                const formData = new FormData();
                formData.append('file', cloneFile);
                formData.append('name', cloneName);
                if (cloneDescription) formData.append('description', cloneDescription);
                formData.append('provider', VOICE_PROVIDER);
                backendResponse = await assistantVoiceActions.clone(formData);
            } else if (createMode === 'design') {
                if (VOICE_PROVIDER !== 'elevenlabs') {
                    toast.error("Design mode is only available for ElevenLabs provider.", { id: toastId });
                    setIsProcessingCreate(false); return;
                }
                if (!selectedPreviewId || !designFinalVoiceName.trim()) {
                    toast.error("A preview must be selected and a final voice name is required.", { id: toastId });
                    setIsProcessingCreate(false); return;
                }
                
                // Find the selected preview to get its audio data
                const selectedPreview = designPreviews.find(p => p.generated_voice_id === selectedPreviewId);

                backendResponse = await assistantVoiceActions.design({
                    generated_voice_id: selectedPreviewId,
                    voice_name: designFinalVoiceName,
                    voice_description: cloneDescription || `Designed voice: ${designFinalVoiceName}`, // Reuse cloneDescription or make a new one
                    audio_base_64: selectedPreview?.audio_base_64 || null,
                    media_type: selectedPreview?.media_type || null
                    // labels: {} // Optional labels
                });
            } else {
                toast.error("Invalid voice creation mode.", { id: toastId });
                setIsProcessingCreate(false); return;
            }
            

            if (backendResponse && (backendResponse as ResponseProps).detail) {
                const errorDetail = (backendResponse as ResponseProps).detail || `Unknown ${createMode} error.`;
                console.error(`Error creating voice: ${errorDetail}`);
                toast.error(`Error creating voice: ${errorDetail}`, { id: toastId, duration: 7000 });
            } 
            else if (backendResponse && (backendResponse as Voice).voice_id && (backendResponse as Voice).name) {
                const voiceDataFromBackend = backendResponse as VoiceOption;

                const fullNewVoice: VoiceOption = {
                    ...voiceDataFromBackend,
                    provider: voiceDataFromBackend.provider || VOICE_PROVIDER, 
                    isUserVoiceInOrchestra: true, 
                    is_preset: voiceDataFromBackend.is_preset ?? false,
                };
                toast.success(`Voice "${fullNewVoice.name}" created & selected!`, { id: toastId });
                if (onVoiceCreatedAndSelected) onVoiceCreatedAndSelected(fullNewVoice);
                if (fetchUserVoices) fetchUserVoices(); 
                resetCreateForm();
            } 
            else { 
                console.error(`Error creating voice: Unexpected response structure from backend.`, backendResponse);
                toast.error(`Error creating voice: Unexpected response.`, { id: toastId, duration: 7000 });
            }

        } catch (error: any) {
            console.error(`Error creating voice: ${error.message}`);
            toast.error(`Voice creation process failed.`, { id: toastId, duration: 7000 });
        } finally {
            setIsProcessingCreate(false);
        }
    };

    return {
        createMode, setCreateMode,
        // Clone
        cloneFile, setCloneFile,
        cloneFileName, setCloneFileName,
        cloneName, setCloneName,
        cloneDescription, setCloneDescription,
        // Design
        designVoiceDescription, setDesignVoiceDescription,
        designSampleText, setDesignSampleText,
        designPreviews, setDesignPreviews,
        selectedPreviewId, setSelectedPreviewId,
        isGeneratingPreviews,
        handleGenerateDesignPreviews,
        designFinalVoiceName, setDesignFinalVoiceName,
        // Common
        isProcessingCreate,
        handleCreateAndSelect,
        resetCreateForm,
    };
}