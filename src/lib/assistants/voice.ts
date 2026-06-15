'use server';

import { requireUserApiKey } from '@/lib/server-action-session';
import { ResponseProps } from '@/types/common';
import {
  GenerateSpeechPayload,
  Voice,
  VoiceDesignGeneratePreviewsRequest,
  VoiceDesignGeneratePreviewsAPIResponse,
  VoiceDesignCreateFromPreviewRequest,
} from '@/types/assistants/assistant';
import { Gender as CartesiaGender, SupportedLanguage } from '@cartesia/cartesia-js/api';
import { arrayBufferToBase64 } from '@/utils/assistants/voice-utils';
import { formatFastApiError, getInternalApiBaseUrl } from '@/utils/assistants/api-utils';
import { snakeToCamelObject, camelToSnakeObject } from '@/utils/casing';

export async function listVoices(): Promise<(Voice & { isPreset?: boolean })[] | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const response = await fetch(`${getInternalApiBaseUrl()}/api/assistant/voice`, {
      method: 'GET',
      headers: { apiKey: apiKey },
    });
    const data = await response.json();
    if (!response.ok) return { detail: data.detail || `Failed: ${response.statusText}` };
    const rawVoices = data.info || data;
    return snakeToCamelObject<(Voice & { isPreset?: boolean })[]>(rawVoices);
  } catch (error) {
    return { detail: error instanceof Error ? error.message : 'Unknown error.' };
  }
}
export async function registerVoice(
  voiceId: string,
  provider: string,
  name: string,
  description: string,
  gender: CartesiaGender | 'other',
  language: SupportedLanguage | 'multi',
  isPreset: boolean
): Promise<(Voice & { info?: string; isPreset?: boolean }) | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const response = await fetch(`${getInternalApiBaseUrl()}/api/assistant/voice`, {
      method: 'POST',
      headers: { apiKey: apiKey, 'Content-Type': 'application/json' },
      // API expects snake_case
      body: JSON.stringify({
        voiceId: voiceId,
        provider,
        name,
        description,
        gender,
        language,
        isPreset: isPreset,
      }),
    });
    const data = await response.json();
    if (!response.ok)
      return {
        detail: data.detail ? formatFastApiError(data.detail) : `Failed: ${response.statusText}`,
      };
    const voice = snakeToCamelObject<Voice>(data.info);
    return {
      ...voice,
      info: `Voice ${name} registered.`,
      isPreset: (data.info as any)?.isPreset,
    };
  } catch (error) {
    return { detail: error instanceof Error ? error.message : 'Unknown error.' };
  }
}
export async function deleteVoice(voiceId: string, provider: string): Promise<ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const response = await fetch(
      `${getInternalApiBaseUrl()}/api/assistant/voice/${voiceId}?provider=${provider}`,
      { method: 'DELETE', headers: { apiKey: apiKey } }
    );
    if (!response.ok && response.status !== 404) {
      const data = await response.json().catch(() => ({}));
      return { detail: data.detail || `Failed to delete voice: ${response.statusText}` };
    }
    if (response.status === 204) return { info: `Voice ${voiceId} deleted.` };
    const data = await response.json().catch(() => ({ info: `Voice ${voiceId} deleted.` }));
    return { info: data.info || `Voice ${voiceId} deleted.` };
  } catch (error) {
    return { detail: error instanceof Error ? error.message : 'Unknown error.' };
  }
}
export async function cloneVoice(
  formData: FormData
): Promise<(Voice & { info?: string; isPreset?: boolean }) | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const response = await fetch(`${getInternalApiBaseUrl()}/api/assistant/voice/clone`, {
      method: 'POST',
      headers: { apiKey: apiKey },
      body: formData,
    });
    const data = await response.json();
    if (!response.ok)
      return {
        detail: data.detail
          ? formatFastApiError(data.detail)
          : `Voice clone failed: ${response.statusText}`,
      };
    return snakeToCamelObject<Voice & { info?: string; isPreset?: boolean }>(data.info);
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : 'Unknown error during voice clone.',
    };
  }
}
export async function generateSpeech(
  payload: GenerateSpeechPayload
): Promise<{ audioBase64?: string; contentType?: string; detail?: string; status?: number }> {
  const apiKey = await requireUserApiKey();
  try {
    // Convert camelCase payload to snake_case for API
    const snakeCasePayload = camelToSnakeObject(payload);

    const response = await fetch(`${getInternalApiBaseUrl()}/api/assistant/voice/generate`, {
      method: 'POST',
      headers: {
        apiKey: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(snakeCasePayload),
    });

    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    if (!response.ok) {
      let errorDetail = 'Failed to generate speech.';
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
      return { detail: 'Generated audio was empty.', contentType };
    }
    const audioBase64 = arrayBufferToBase64(audioArrayBuffer); // Convert to Base64
    return { audioBase64, contentType }; // Return Base64 string
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error generating speech.';
    return { detail: message };
  }
}
export async function designVoiceGeneratePreviews(
  payload: VoiceDesignGeneratePreviewsRequest
): Promise<VoiceDesignGeneratePreviewsAPIResponse | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    // Convert camelCase payload to snake_case for API
    const snakeCasePayload = camelToSnakeObject(payload);

    const response = await fetch(`${getInternalApiBaseUrl()}/api/assistant/voice/design/preview`, {
      method: 'POST',
      headers: { apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(snakeCasePayload),
    });
    const data = await response.json();
    if (!response.ok) {
      // Format the error detail before returning
      const errorMessage = formatFastApiError(data.detail);
      return {
        detail: errorMessage || `Failed to generate voice previews: ${response.statusText}`,
        status: response.status,
      };
    }
    // The proxy returns the backend response directly, which might be { info: ... } or just the data
    // Backend schema for /v0/assistant/voice/design/preview is InfoResponse[VoiceDesignGeneratePreviewsAPIResponse]
    // So data should be { info: { previews: [], text: "" } }
    if (data.info && data.info.previews !== undefined) {
      return snakeToCamelObject<VoiceDesignGeneratePreviewsAPIResponse>(data.info);
    }
    // If 'info' wrapper is missing but structure matches
    if (data.previews !== undefined) {
      return snakeToCamelObject<VoiceDesignGeneratePreviewsAPIResponse>(data);
    }
    return {
      detail: 'Unexpected response structure from preview generation.',
      status: response.status,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error generating voice previews.';
    return { detail: message };
  }
}
export async function designVoiceCreateFromPreview(
  payload: VoiceDesignCreateFromPreviewRequest
): Promise<(Voice & { info?: string; isPreset?: boolean }) | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    // Convert camelCase payload to snake_case for API
    const snakeCasePayload = camelToSnakeObject(payload);

    const response = await fetch(`${getInternalApiBaseUrl()}/api/assistant/voice/design/create`, {
      method: 'POST',
      headers: { apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(snakeCasePayload),
    });
    const data = await response.json();
    if (!response.ok) {
      const errorMessage = formatFastApiError(data.detail);
      return {
        detail: errorMessage || `Failed to create voice from preview: ${response.statusText}`,
        status: response.status,
      };
    }
    // Backend schema is InfoResponse[VoiceRead]
    // So data should be { info: { voiceId: ..., name: ...}}
    if (data.info && data.info.voiceId) {
      return snakeToCamelObject<Voice & { info?: string; isPreset?: boolean }>(data.info);
    }
    // If 'info' wrapper is missing but structure matches
    if (data.voiceId) {
      return snakeToCamelObject<Voice & { info?: string; isPreset?: boolean }>(data);
    }
    return {
      detail: 'Unexpected response structure from voice creation.',
      status: response.status,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error creating voice from preview.';
    return { detail: message };
  }
}
