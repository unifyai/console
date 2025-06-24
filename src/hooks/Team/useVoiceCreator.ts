import * as React from 'react';
import { Voice, AssistantActions, VoiceOption } from '@/types/team/assistant';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';
import { SupportedLanguage, Gender as CartesiaGender } from "@cartesia/cartesia-js/api";

export function useVoiceCreator(
    assistantVoiceActions: AssistantActions['voice'],
    onVoiceCreatedAndSelected?: (voice: VoiceOption) => void,
    fetchUserVoices?: () => void
) {
    // Clone state
    const [cloneFile, setCloneFile] = React.useState<File | null>(null);
    const [cloneFileName, setCloneFileName] = React.useState<string | null>(null);
    const [cloneName, setCloneName] = React.useState('');
    const [cloneDescription, setCloneDescription] = React.useState('');
    const [cloneLanguage, setCloneLanguage] = React.useState<SupportedLanguage>('en');

    const [isProcessingCreate, setIsProcessingCreate] = React.useState(false);

    const resetCreateForm = React.useCallback(() => {
        setCloneFile(null); setCloneFileName(null); setCloneName(''); setCloneDescription(''); setCloneLanguage('en');
    }, []);

    
    const handleCreateAndSelect = async () => {
        setIsProcessingCreate(true);
        let backendResponse: (Voice & { info?: string; is_preset?: boolean }) | ResponseProps | null = null;
        const toastId = toast.loading("Creating voice...");
        
        try {
            if (!cloneFile || !cloneName || !cloneLanguage) {
                toast.error("Audio file, Voice Name, and Language are required for cloning.", { id: toastId });
                setIsProcessingCreate(false); return;
            }
            const formData = new FormData();
            formData.append('file', cloneFile);
            formData.append('name', cloneName);
            formData.append('language', cloneLanguage);
            if (cloneDescription) formData.append('description', cloneDescription);
            backendResponse = await assistantVoiceActions.clone(formData);

            if (backendResponse && (backendResponse as ResponseProps).detail) {
                const errorDetail = (backendResponse as ResponseProps).detail || `Unknown clone error.`;
                console.error(`Error creating voice: ${errorDetail}`);
                toast.error(`Error creating voice`, { id: toastId, duration: 7000 });
            } 
            else if (backendResponse && (backendResponse as Voice).voice_id && (backendResponse as Voice).name) {
                const voiceDataFromBackend = backendResponse as VoiceOption;

                const fullNewVoice: VoiceOption = {
                    ...voiceDataFromBackend,
                    isUserVoiceInOrchestra: true, 
                    is_preset: voiceDataFromBackend.is_preset ?? false 
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
            toast.error(`Voice creation process failed`, { id: toastId, duration: 7000 });
        } finally {
            setIsProcessingCreate(false);
        }
    };

    return {
        cloneFile, setCloneFile,
        cloneFileName, setCloneFileName,
        cloneName, setCloneName,
        cloneDescription, setCloneDescription,
        cloneLanguage, setCloneLanguage,
        isProcessingCreate,
        handleCreateAndSelect,
        resetCreateForm,
    };
}