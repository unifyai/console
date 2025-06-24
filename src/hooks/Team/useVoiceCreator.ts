import * as React from 'react';
import { Voice, AssistantActions, VoiceOption, VoiceDesignPreviewItem } from '@/types/team/assistant'; // Added VoiceDesignPreviewItem
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';
import { SupportedLanguage, Gender as CartesiaGender } from "@cartesia/cartesia-js/api";
import { VOICE_PROVIDER } from '@/constants/assistants/settings';

type CreateMode = 'clone' | 'design';

export function useVoiceCreator(
    assistantVoiceActions: AssistantActions['voice'],
    onVoiceCreatedAndSelected?: (voice: VoiceOption) => void,
    fetchUserVoices?: () => void
) {
    const [createMode, setCreateMode] = React.useState<CreateMode>('clone');

    // Clone state
    const [cloneFile, setCloneFile] = React.useState<File | null>(null);
    const [cloneFileName, setCloneFileName] = React.useState<string | null>(null);
    const [cloneName, setCloneName] = React.useState('');
    const [cloneDescription, setCloneDescription] = React.useState('');
    const [cloneLanguage, setCloneLanguage] = React.useState<SupportedLanguage>('en');

    // Design state (for ElevenLabs text-to-voice)
    const [designVoiceDescription, setDesignVoiceDescription] = React.useState('');
    const [designSampleText, setDesignSampleText] = React.useState('');
    const [designPreviews, setDesignPreviews] = React.useState<VoiceDesignPreviewItem[]>([]);
    const [selectedPreviewId, setSelectedPreviewId] = React.useState<string | null>(null);
    const [isGeneratingPreviews, setIsGeneratingPreviews] = React.useState(false);
    // For final creation from preview
    const [designFinalVoiceName, setDesignFinalVoiceName] = React.useState(''); 
    const [designFinalLanguage, setDesignFinalLanguage] = React.useState<SupportedLanguage>('en');
    const [designFinalGender, setDesignFinalGender] = React.useState<CartesiaGender | 'other'>('female');

    const [isProcessingCreate, setIsProcessingCreate] = React.useState(false); // For the final "Create & Select Voice"

    const resetCreateForm = React.useCallback(() => { 
        setCloneFile(null); setCloneFileName(null); setCloneName(''); setCloneDescription(''); setCloneLanguage('en');
        
        setDesignVoiceDescription(''); setDesignSampleText(''); 
        setDesignPreviews([]); setSelectedPreviewId(null);
        setDesignFinalVoiceName(''); setDesignFinalLanguage('en'); setDesignFinalGender('female');
        // setCreateMode('clone'); // Optionally reset mode, or let user keep current mode
    }, []);

    const handleGenerateDesignPreviews = async () => {
        if (VOICE_PROVIDER !== 'elevenlabs' || !designVoiceDescription.trim()) {
            toast.error("Voice description is required for design mode.");
            return;
        }
        setIsGeneratingPreviews(true);
        setDesignPreviews([]); // Clear old previews
        setSelectedPreviewId(null);
        const toastId = toast.loading("Generating voice design previews...");
        try {
            const result = await assistantVoiceActions.preview({
                voice_description: designVoiceDescription,
                text: designSampleText.trim() || undefined, // Send undefined if empty
                // model_id: "eleven_multilingual_ttv_v2" // Optional, backend might have a default
            });

            if ('detail' in result) { // Error
                toast.error((result as ResponseProps).detail || "Failed to generate previews.", { id: toastId });
            } else { // Success
                setDesignPreviews(result.previews || []);
                if ((result.previews || []).length === 0) {
                    toast.info("No previews were generated. Try a different description.", { id: toastId });
                } else {
                    toast.success("Previews generated!", { id: toastId });
                }
            }
        } catch (error: any) {
            toast.error(`Preview generation failed: ${error.message}`, { id: toastId });
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
                if (!cloneFile || !cloneName || !cloneLanguage) {
                    toast.error("Audio file, Voice Name, and Language are required for cloning.", { id: toastId });
                    setIsProcessingCreate(false); return;
                }
                const formData = new FormData();
                formData.append('file', cloneFile);
                formData.append('name', cloneName);
                formData.append('language', cloneLanguage);
                if (cloneDescription) formData.append('description', cloneDescription);
                formData.append('provider', VOICE_PROVIDER);
                backendResponse = await assistantVoiceActions.clone(formData);
            } else if (createMode === 'design') {
                if (VOICE_PROVIDER !== 'elevenlabs') {
                    toast.error("Design mode is only available for ElevenLabs provider.", { id: toastId });
                    setIsProcessingCreate(false); return;
                }
                if (!selectedPreviewId || !designFinalVoiceName.trim() || !designFinalLanguage) {
                    toast.error("A preview must be selected, and a final voice name and language are required.", { id: toastId });
                    setIsProcessingCreate(false); return;
                }
                backendResponse = await assistantVoiceActions.design({
                    generated_voice_id: selectedPreviewId,
                    voice_name: designFinalVoiceName,
                    voice_description: cloneDescription || `Designed voice: ${designFinalVoiceName}`, // Reuse cloneDescription or make a new one
                    language: designFinalLanguage,
                    gender: designFinalGender,
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
            toast.error(`Voice creation process failed: ${error.message}`, { id: toastId, duration: 7000 });
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
        cloneLanguage, setCloneLanguage,
        // Design
        designVoiceDescription, setDesignVoiceDescription,
        designSampleText, setDesignSampleText,
        designPreviews, setDesignPreviews,
        selectedPreviewId, setSelectedPreviewId,
        isGeneratingPreviews,
        handleGenerateDesignPreviews,
        designFinalVoiceName, setDesignFinalVoiceName,
        designFinalLanguage, setDesignFinalLanguage,
        designFinalGender, setDesignFinalGender,
        // Common
        isProcessingCreate,
        handleCreateAndSelect,
        resetCreateForm,
    };
}