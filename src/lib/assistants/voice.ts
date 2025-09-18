import { ResponseProps } from "@/types/common";
import { 
    GenerateSpeechPayload, 
    Voice, 
    VoiceDesignGeneratePreviewsRequest,
    VoiceDesignGeneratePreviewsAPIResponse,
    VoiceDesignCreateFromPreviewRequest
} from "@/types/assistants/assistant"; 
import { Gender as CartesiaGender, SupportedLanguage } from "@cartesia/cartesia-js/api"; 
import { arrayBufferToBase64 } from "@/utils/assistants/voice-utils";
import { formatFastApiError } from "@/utils/assistants/api-utils";

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
    return async (voice_id: string, provider: string, name: string, description: string, gender: CartesiaGender | 'other', language: SupportedLanguage | "multi", is_preset: boolean): Promise<(Voice & {info?: string; is_preset?: boolean}) | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/voice`, {
                method: "POST", headers: { apiKey: apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ voice_id, provider, name, description, gender, language, is_preset })
            });
            const data = await response.json();
            if (!response.ok) return { detail: data.detail || `Failed: ${response.statusText}` };
            return { ...(data.info as Voice), info: `Voice ${name} registered.`, is_preset: (data.info as any)?.is_preset }; 
        } catch (error) { return { detail: error instanceof Error ? error.message : "Unknown error." }; }
    };
};

export const deleteVoice = async (apiKey: string) => {
    return async (voice_id: string, provider: string): Promise<ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/voice/${voice_id}?provider=${provider}`, { method: "DELETE", headers: { apiKey: apiKey }});
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

export const designVoiceGeneratePreviews = async (apiKey: string) => {
    return async (payload: VoiceDesignGeneratePreviewsRequest): Promise<VoiceDesignGeneratePreviewsAPIResponse | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/voice/design/preview`, {
                method: "POST",
                headers: { apiKey, "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) {
                // Format the error detail before returning
                const errorMessage = formatFastApiError(data.detail);
                return { detail: errorMessage || `Failed to generate voice previews: ${response.statusText}`, status: response.status };
            }
            // The proxy returns the backend response directly, which might be { info: ... } or just the data
            // Backend schema for /v0/assistant/voice/design/preview is InfoResponse[VoiceDesignGeneratePreviewsAPIResponse]
            // So data should be { info: { previews: [], text: "" } }
            if (data.info && data.info.previews !== undefined) {
               return data.info as VoiceDesignGeneratePreviewsAPIResponse;
            }
            // If 'info' wrapper is missing but structure matches
            if (data.previews !== undefined) {
               return data as VoiceDesignGeneratePreviewsAPIResponse;
            }
            return { detail: "Unexpected response structure from preview generation.", status: response.status };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error generating voice previews.";
            return { detail: message };
        }
    };
};

export const designVoiceCreateFromPreview = async (apiKey: string) => {
    return async (payload: VoiceDesignCreateFromPreviewRequest): Promise<(Voice & {info?: string; is_preset?: boolean}) | ResponseProps> => {
        "use server";
        try {
            const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assistant/voice/design/create`, {
                method: "POST",
                headers: { apiKey, "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) {
                const errorMessage = formatFastApiError(data.detail);
                return { detail: errorMessage || `Failed to create voice from preview: ${response.statusText}`, status: response.status };
            }
            // Backend schema is InfoResponse[VoiceRead]
            // So data should be { info: { voice_id: ..., name: ...}}
            if (data.info && data.info.voice_id) {
                return data.info as (Voice & {info?: string; is_preset?: boolean});
            }
            // If 'info' wrapper is missing but structure matches
            if (data.voice_id) {
               return data as (Voice & {info?: string; is_preset?: boolean});
            }
            return { detail: "Unexpected response structure from voice creation.", status: response.status };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error creating voice from preview.";
            return { detail: message };
        }
    };
};