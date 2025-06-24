import { ResponseProps } from "@/types/common";
import { GenerateSpeechPayload, Voice } from "@/types/team/assistant";
import { Gender as CartesiaGender, SupportedLanguage } from "@cartesia/cartesia-js/api";

// Helper to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

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
    return async (formData: FormData): Promise<(Voice & {info?:string; is_preset?: boolean}) | ResponseProps> => {
        "use server";
        try {
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


export const generateSpeech = async (apiKey: string) => {
    return async (payload: GenerateSpeechPayload): Promise<{ audioBase64?: string; contentType?: string; detail?: string; status?: number }> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/voice/generate`, {
                method: "POST",
                headers: {
                    apiKey: apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const contentType = response.headers.get("content-type") || "application/octet-stream";

            if (!response.ok) {
                let errorDetail = "Failed to generate speech.";
                try {
                    const errorData = await response.json();
                    errorDetail = errorData.detail || errorDetail;
                } catch (e) {
                     const textError = await response.text();
                     errorDetail = textError || errorDetail;
                }
                return { detail: errorDetail, status: response.status, contentType };
            }
            
            const audioArrayBuffer = await response.arrayBuffer(); 
            if (audioArrayBuffer.byteLength === 0) {
                return { detail: "Generated audio was empty.", contentType };
            }
            const audioBase64 = arrayBufferToBase64(audioArrayBuffer); // Convert to Base64
            return { audioBase64, contentType }; // Return Base64 string

        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error generating speech.";
            return { detail: message };
        }
    };
};