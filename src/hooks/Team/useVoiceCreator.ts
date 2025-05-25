import * as React from 'react';
import { Voice, AssistantActions, VoiceOption } from '@/types/team/assistant';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';
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
    const [localizeTargetLanguage, setLocalizeTargetLanguage] = React.useState<LocalizeTargetLanguage>('es'); // Default if base is 'en'
    const [localizeOriginalGender, setLocalizeOriginalGender] = React.useState<CartesiaGender>('female'); // Cartesia's default for some ops

    const [isProcessingCreate, setIsProcessingCreate] = React.useState(false);

    const resetCreateForm = React.useCallback((switchToCloneMode: boolean = true) => {
        setCloneFile(null); setCloneFileName(null); setCloneName(''); setCloneDescription(''); setCloneLanguage('en');
        setLocalizeBaseVoiceInfo(null); setLocalizeNewName(''); setLocalizeNewDescription(''); setLocalizeTargetLanguage('es');
        if (switchToCloneMode) setCreateMode('clone');
    }, []);

    const prepareForLocalize = React.useCallback((baseVoice: VoiceOption, languageOptions: { value: SupportedLanguage }[]) => {
        setLocalizeBaseVoiceInfo(baseVoice);
        const targetLangDefault = languageOptions.find(l => l.value !== baseVoice.language)?.value || 'es';
        setLocalizeNewName(`${baseVoice.name} (${getLanguageLabel(targetLangDefault)})`);
        setLocalizeNewDescription(`Localized version of ${baseVoice.name} in ${getLanguageLabel(targetLangDefault)}`);
        setLocalizeTargetLanguage(targetLangDefault as LocalizeTargetLanguage);
        setLocalizeOriginalGender(baseVoice.gender === 'male' || baseVoice.gender === 'female' ? baseVoice.gender : 'female');
        setCreateMode('localize');
        setCloneFile(null); setCloneFileName(null); // Clear clone fields
    }, []);


const handleCreateAndSelect = async () => {
        setIsProcessingCreate(true);
        let cartesiaOpResult: Voice | ResponseProps | null = null;
        const toastId = toast.loading("Creating voice...");
        let createdCartesiaVoiceId: string | null = null;

        try {
            if (createMode === 'clone') {
                if (!cloneFile || !cloneName || !cloneLanguage) {
                    toast.error("Audio file, Voice Name, and Language are required for cloning.", { id: toastId });
                    setIsProcessingCreate(false); return;
                }
                const formData = new FormData();
                formData.append('file', cloneFile);
                formData.append('name', cloneName);
                if (cloneDescription) formData.append('description', cloneDescription);
                formData.append('language', cloneLanguage);
                cartesiaOpResult = await assistantVoiceActions.cloneVoiceOnCartesia(formData);
            } else {
                if (!localizeBaseVoiceInfo || !localizeNewName || !localizeTargetLanguage || !localizeOriginalGender) {
                    toast.error("Base voice, New Name, Target Language, and Original Gender are required for localization.", { id: toastId });
                    setIsProcessingCreate(false); return;
                }
                cartesiaOpResult = await assistantVoiceActions.localizeVoiceOnCartesia(
                    localizeBaseVoiceInfo.voice_id, localizeNewName, localizeNewDescription,
                    localizeTargetLanguage, localizeOriginalGender
                );
            }

            if (cartesiaOpResult && 'voice_id' in cartesiaOpResult) {
                const cartesiaInfo = cartesiaOpResult as Voice; // This is the Cartesia voice object
                createdCartesiaVoiceId = cartesiaInfo.voice_id; // Store for potential cleanup

                // Now register this new/cloned/localized voice in Orchestra DB
                toast.loading("Registering voice...", { id: toastId });
                const dbResult = await assistantVoiceActions.createVoiceInOrchestra(
                    cartesiaInfo.voice_id, cartesiaInfo.name, cartesiaInfo.description || '',
                    cartesiaInfo.gender, cartesiaInfo.language
                );

                if ('detail' in dbResult) { 
                    throw new Error(`Voice registration failed`);
                } else {
                    const newVoiceData = (dbResult as (Voice & {info?:string})).info ? dbResult as Voice : dbResult as Voice;
                    const fullNewVoice: VoiceOption = {
                        ...newVoiceData,
                        isUserVoiceInOrchestra: true
                    };
                    toast.success(`Voice "${fullNewVoice.name}" created & selected!`, { id: toastId });
                    if (onVoiceCreatedAndSelected) onVoiceCreatedAndSelected(fullNewVoice);
                    if (fetchUserVoices) fetchUserVoices();
                    resetCreateForm();
                    createdCartesiaVoiceId = null;
                }
            } else { 
                const errorDetail = (cartesiaOpResult as ResponseProps)?.detail || "Unknown Cartesia operation error.";
                console.error(`[useVoiceCreator.ts] Error creating voice in Cartesia: ${errorDetail}.`, { id: toastId, duration: 7000 });
                toast.error(`Error creating voice`, { id: toastId });
            }

        } catch (error: any) {
            toast.error(`Voice creation process failed`, { id: toastId, duration: 7000 });
            if (createdCartesiaVoiceId) {
                try {
                    await assistantVoiceActions.deleteVoiceFromCartesia(createdCartesiaVoiceId);
                } catch (cartesiaCleanupError: any) {
                    console.error(`[useVoiceCreator] Cartesia cleanup failed for ${createdCartesiaVoiceId}:`, cartesiaCleanupError);
                }
            }
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