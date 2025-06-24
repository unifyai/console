import * as React from 'react';
import { Voice, AssistantActions, VoiceOption } from '@/types/team/assistant';
import { ResponseProps } from '@/types/common';
import { showLoadingToast, showErrorToast, showSuccessToast } from '@/components/notifications';
import { SupportedLanguage, Gender as CartesiaGender, LocalizeTargetLanguage } from "@cartesia/cartesia-js/api";
import { getLanguageLabel } from '@/utils/team/voice-utils';

type CreateMode = 'clone' | 'localize';

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

    // Localize state
    const [localizeBaseVoiceInfo, setLocalizeBaseVoiceInfo] = React.useState<VoiceOption | null>(null);
    const [localizeNewName, setLocalizeNewName] = React.useState('');
    const [localizeNewDescription, setLocalizeNewDescription] = React.useState('');
    const [localizeTargetLanguage, setLocalizeTargetLanguage] = React.useState<LocalizeTargetLanguage>('es');
    const [localizeOriginalGender, setLocalizeOriginalGender] = React.useState<CartesiaGender>('female');

    const [isProcessingCreate, setIsProcessingCreate] = React.useState(false);

    const resetCreateForm = React.useCallback((switchToCloneMode: boolean = true) => {
        setCloneFile(null); setCloneFileName(null); setCloneName(''); setCloneDescription(''); setCloneLanguage('en');
        setLocalizeBaseVoiceInfo(null); setLocalizeNewName(''); setLocalizeNewDescription(''); setLocalizeTargetLanguage('es'); setLocalizeOriginalGender('female');
        if (switchToCloneMode) setCreateMode('clone');
    }, []);

    const prepareForLocalize = React.useCallback((baseVoice: VoiceOption, languageOptions: { value: SupportedLanguage }[]) => {
        setLocalizeBaseVoiceInfo(baseVoice);
        const targetLangDefault = languageOptions.find(l => l.value !== baseVoice.language)?.value || 'es'; // Default target if base is 'en'
        setLocalizeNewName(`${baseVoice.name} (${getLanguageLabel(targetLangDefault)})`);
        setLocalizeNewDescription(`Localized version of ${baseVoice.name} in ${getLanguageLabel(targetLangDefault)}`);
        setLocalizeTargetLanguage(targetLangDefault as LocalizeTargetLanguage);
        setLocalizeOriginalGender(baseVoice.gender === 'male' || baseVoice.gender === 'female' ? baseVoice.gender : 'female');
        setCreateMode('localize');
        setCloneFile(null); setCloneFileName(null); 
    }, []);

    
    const handleCreateAndSelect = async () => {
        setIsProcessingCreate(true);
        let backendResponse: (Voice & { info?: string; is_preset?: boolean }) | ResponseProps | null = null;
        const toastId = showLoadingToast("Creating voice...");
        
        try {
            if (createMode === 'clone') {
                if (!cloneFile || !cloneName || !cloneLanguage) {
                    showErrorToast("Audio file, Voice Name, and Language are required for cloning.", "Audio file, Voice Name, and Language are required for cloning.", toastId);
                    setIsProcessingCreate(false); return;
                }
                const formData = new FormData();
                formData.append('file', cloneFile);
                formData.append('name', cloneName);
                formData.append('language', cloneLanguage);
                if (cloneDescription) formData.append('description', cloneDescription);
                backendResponse = await assistantVoiceActions.clone(formData);
            } else {
                if (!localizeBaseVoiceInfo || !localizeNewName || !localizeTargetLanguage || !localizeOriginalGender) {
                    showErrorToast("Base voice, New Name, Target Language, and Original Gender are required for localization.", "Base voice, New Name, Target Language, and Original Gender are required for localization.", toastId);
                    setIsProcessingCreate(false); return;
                }
                backendResponse = await assistantVoiceActions.localize(
                    localizeBaseVoiceInfo.voice_id, localizeNewName, localizeTargetLanguage,
                    localizeOriginalGender, localizeNewDescription || undefined, undefined // dialect can be added if needed
                );
            }

            if (backendResponse && (backendResponse as ResponseProps).detail) {
                const errorDetail = (backendResponse as ResponseProps).detail || `Unknown ${createMode} error.`;
                console.error(`Error creating voice: ${errorDetail}`);
                showErrorToast(`Error creating voice`, `Error creating voice`, toastId);
            } 
            else if (backendResponse && (backendResponse as Voice).voice_id && (backendResponse as Voice).name) {
                const voiceDataFromBackend = backendResponse as VoiceOption;

                const fullNewVoice: VoiceOption = {
                    ...voiceDataFromBackend,
                    isUserVoiceInOrchestra: true, 
                    is_preset: voiceDataFromBackend.is_preset ?? false 
                };
                showSuccessToast(`Voice "${fullNewVoice.name}" created & selected!`, undefined, toastId);
                if (onVoiceCreatedAndSelected) onVoiceCreatedAndSelected(fullNewVoice);
                if (fetchUserVoices) fetchUserVoices(); 
                resetCreateForm();
            } 
            else { 
                console.error(`Error creating voice: Unexpected response structure from backend.`, backendResponse);
                showErrorToast(`Error creating voice: Unexpected response.`, `Error creating voice: Unexpected response.`, toastId);
            }

        } catch (error: any) {
            console.error(`Error creating voice: ${error.message}`);
            showErrorToast(`Voice creation process failed`, `Voice creation process failed`, toastId);
        } finally {
            setIsProcessingCreate(false);
        }
    };

    return {
        createMode, setCreateMode,
        cloneFile, setCloneFile,
        cloneFileName, setCloneFileName,
        cloneName, setCloneName,
        cloneDescription, setCloneDescription,
        cloneLanguage, setCloneLanguage,
        localizeBaseVoiceInfo,
        localizeNewName, setLocalizeNewName,
        localizeNewDescription, setLocalizeNewDescription,
        localizeTargetLanguage, setLocalizeTargetLanguage,
        localizeOriginalGender, setLocalizeOriginalGender,
        isProcessingCreate,
        handleCreateAndSelect,
        resetCreateForm,
        prepareForLocalize
    };
}