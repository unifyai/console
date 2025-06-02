import { ResponseProps } from "@/types/common";
import { LocalizeTargetLanguage, Gender as CartesiaGender, SupportedLanguage } from "@cartesia/cartesia-js/api";
import { Voice } from "@/types/team/assistant";

export const listVoices = async (apiKey: string) => {
    return async (): Promise<(Voice & {is_preset?: boolean})[] | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/voice`, { method: "GET", headers: { apiKey: apiKey }});
            const data = await response.json();
            if (!response.ok) return { detail: data.detail || `Failed: ${response.statusText}` };
            return (data.info || data) as (Voice & {is_preset?: boolean})[]; 
        } catch (error) { return { detail: error instanceof Error ? error.message : "Unknown error." }; }
    };
};

export const registerVoice = async (apiKey: string) => {
    return async (voice_id: string, name: string, description: string, gender: CartesiaGender | 'other', language: SupportedLanguage, is_preset: boolean): Promise<(Voice & {info?: string; is_preset?: boolean}) | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/voice`, {
                method: "POST", headers: { apiKey: apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ voice_id, name, description, gender, language, is_preset })
            });
            const data = await response.json();
            if (!response.ok) return { detail: data.detail || `Failed: ${response.statusText}` };
            return { ...(data.info as Voice), info: `Voice ${name} registered.`, is_preset: (data.info as any)?.is_preset };
        } catch (error) { return { detail: error instanceof Error ? error.message : "Unknown error." }; }
    };
};

export const deleteVoice = async (apiKey: string) => {
    return async (voice_id: string): Promise<ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/voice/${voice_id}`, { method: "DELETE", headers: { apiKey: apiKey }});
            if (!response.ok && response.status !== 404) { 
                 const data = await response.json().catch(() => ({}));
                return { detail: data.detail || `Failed to delete voice: ${response.statusText}` };
            }
            if (response.status === 204) return { info: `Voice ${voice_id} deleted.`};
            const data = await response.json().catch(() => ({info: `Voice ${voice_id} deleted.`}));
            return { info: data.info || `Voice ${voice_id} deleted.` };
        } catch (error) { return { detail: error instanceof Error ? error.message : "Unknown error." }; }
    };
};

export const cloneVoice = async (apiKey: string) => { 
    return async (file: File, name: string, language: SupportedLanguage, description?: string): Promise<(Voice & {info?:string; is_preset?: boolean}) | ResponseProps> => {
        "use server";
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('name', name);
            formData.append('language', language);
            if (description) formData.append('description', description);
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/voice/clone`, { 
                method: "POST", 
                headers: { apiKey: apiKey },
                body: formData 
            });
            const data = await response.json();
            if (!response.ok) return { detail: data.detail || `Voice clone failed: ${response.statusText}` };
            return data.info as (Voice & {info?:string; is_preset?: boolean});
        } catch (error) { return { detail: error instanceof Error ? error.message : "Unknown error during voice clone." }; }
    };
};

export const localizeVoice = async (apiKey: string) => {
    return async (baseCartesiaVoiceId: string, name: string, targetLanguage: LocalizeTargetLanguage, originalSpeakerGender: CartesiaGender, description?: string, dialect?: string): Promise<(Voice & {info?:string; is_preset?: boolean}) | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/voice/localize`, {
                method: "POST", headers: { apiKey: apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ base_cartesia_voice_id: baseCartesiaVoiceId, name, description, target_language: targetLanguage, original_speaker_gender: originalSpeakerGender, dialect })
            });
            const data = await response.json();
            if (!response.ok) return { detail: data.detail || `Voice localization failed: ${response.statusText}` };
            return data.info as (Voice & {info?:string; is_preset?: boolean});
        } catch (error) { return { detail: error instanceof Error ? error.message : "Unknown error during voice localization." }; }
    };
};