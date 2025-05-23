import { ResponseProps } from "@/types/common";
import { LocalizeTargetLanguage, Gender as CartesiaGender, SupportedLanguage } from "@cartesia/cartesia-js/api";
import { Voice } from "@/types/team/assistant";

export const listVoicesFromOrchestra = async (apiKey: string) => {
    return async (): Promise<Voice[] | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/voice`, { method: "GET", headers: { apiKey: apiKey }});
            const data = await response.json();
            if (!response.ok) return { detail: data.detail || `Failed: ${response.statusText}` };
            return (data.info || data) as Voice[]; // Orchestra returns { info: VoiceRead[] }
        } catch (error) { return { detail: error instanceof Error ? error.message : "Unknown error." }; }
    };
};

export const createVoiceInOrchestra = async (apiKey: string) => {
    return async (voice_id: string, name: string, description: string, gender: CartesiaGender | 'other', language: SupportedLanguage): Promise<(Voice & {info?: string}) | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/voice`, {
                method: "POST", headers: { apiKey: apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ voice_id, name, description, gender, language })
            });
            const data = await response.json();
            if (!response.ok) return { detail: data.detail || `Failed: ${response.statusText}` };
             // Orchestra returns { info: VoiceRead }
            return { ...(data.info as Voice), info: `Voice ${name} registered.` };
        } catch (error) { return { detail: error instanceof Error ? error.message : "Unknown error." }; }
    };
};

export const deleteVoiceFromOrchestra = async (apiKey: string) => {
    return async (voice_id: string): Promise<ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/voice/${voice_id}`, { method: "DELETE", headers: { apiKey: apiKey }});
            if (!response.ok && response.status !== 404) { // Allow 404 as "already deleted"
                 const data = await response.json().catch(() => ({}));
                return { detail: data.detail || `Failed: ${response.statusText}` };
            }
            return { info: `Voice record ${voice_id} deleted from DB.` };
        } catch (error) { return { detail: error instanceof Error ? error.message : "Unknown error." }; }
    };
};

export const cloneVoiceOnCartesia = async (apiKey: string) => { // apiKey might be used by proxy route for its own auth
    return async (formData: FormData): Promise<Voice | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/voices/user/clone`, { 
                method: "POST", 
                headers: { apiKey: apiKey }, // Auth for your proxy route
                body: formData 
            });
            const data = await response.json();
            if (!response.ok) return { detail: data.detail || `Cartesia clone failed: ${response.statusText}` };
            return data as Voice; // Proxy returns Voice structure
        } catch (error) { return { detail: error instanceof Error ? error.message : "Unknown error." }; }
    };
};

export const localizeVoiceOnCartesia = async (apiKey: string) => {
    return async (baseCartesiaVoiceId: string, name: string, description: string | null, targetLanguage: LocalizeTargetLanguage, originalSpeakerGender: CartesiaGender): Promise<Voice | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/voices/user/localize`, {
                method: "POST", headers: { apiKey: apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ baseCartesiaVoiceId, name, description, targetLanguage, originalSpeakerGender })
            });
            const data = await response.json();
            if (!response.ok) return { detail: data.detail || `Cartesia localization failed: ${response.statusText}` };
            return data as Voice;
        } catch (error) { return { detail: error instanceof Error ? error.message : "Unknown error." }; }
    };
};

export const deleteVoiceFromCartesia = async (apiKey: string) => {
    return async (cartesiaVoiceId: string): Promise<ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/voices/user/${cartesiaVoiceId}`, { // Path based on user's file structure
                method: "DELETE", headers: { apiKey: apiKey }
            });
             if (!response.ok && response.status !== 404 && response.status !== 204 && response.status !== 200) { // Allow 404, 204, 200 as success/already done
                const data = await response.json().catch(() => ({}));
                return { detail: data.detail || `Cartesia delete failed: ${response.statusText}` };
            }
            return { info: `Voice ${cartesiaVoiceId} deleted from Cartesia.` };
        } catch (error) { return { detail: error instanceof Error ? error.message : "Unknown error." }; }
    };
};