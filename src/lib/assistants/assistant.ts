'use server';

import { requireUserApiKey } from '@/lib/server-action-session';
import { ResponseProps } from '@/types/common';
import {
  Assistant,
  AssistantUpdatePayload,
  AssistantStatus,
  PreHireChatMessage,
  DesktopMode,
  VoiceProvider,
  AssistantHiringSufficientFunds,
} from '@/types/assistants/assistant';
import { ASSISTANT_ONBOARDING_FEE } from '@/constants/assistants/settings';
import { snakeToCamelObject, camelToSnakeObject } from '@/utils/casing';
import { formatValidationDetail } from '@/utils/orchestra-error';
import { checkCreditsBalance } from '@/lib/user/credits';
import { getInternalApiBaseUrl } from '@/utils/assistants/api-utils';

export async function listAssistants(
  listAllOrg: boolean = false,
  includeDemo: boolean = false
): Promise<Assistant[] | (ResponseProps & { status?: number })> {
  const apiKey = await requireUserApiKey();
  try {
    const url = new URL(`${getInternalApiBaseUrl()}/api/assistant`);
    if (listAllOrg) {
      url.searchParams.set('list_all_org', 'true');
    }
    if (includeDemo) {
      url.searchParams.set('demo', 'true');
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { apiKey: apiKey },
    });

    let data;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        console.error(
          `[actions.ts listAssistants] Received non-JSON response with status ${response.status}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }
    } catch (parseError) {
      console.error(`[actions.ts listAssistants] Failed to parse JSON response ${parseError}`);
      return { detail: 'Received an invalid response from the server.' };
    }

    if (!response.ok) {
      const errorMessage = data.detail || `Failed to list assistants: ${response.statusText}`;
      return { detail: errorMessage, status: response.status };
    }

    if ('info' in data) {
      // In case data is nested inside an info property
      return snakeToCamelObject<Assistant[]>(data.info);
    }
    return snakeToCamelObject<Assistant[]>(data);
  } catch (error) {
    console.error(`[actions.ts listAssistants] Error fetching assistants:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error occurred.';
    return { detail: errorMessage };
  }
}
export async function getAssistantStatus(
  assistantId: string
): Promise<(AssistantStatus & ResponseProps) | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const response = await fetch(`${getInternalApiBaseUrl()}/api/assistant/${assistantId}/status`, {
      method: 'GET',
      headers: { apiKey: apiKey },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        detail:
          data.detail ||
          `Failed to get status for assistant ${assistantId}: ${response.statusText}`,
      };
    }

    if (data.info) {
      return snakeToCamelObject<AssistantStatus>(data.info);
    }

    if ('running' in data) {
      return snakeToCamelObject<AssistantStatus>(data);
    }

    return { detail: 'Unexpected response format from status endpoint.' };
  } catch (error) {
    console.error(
      `[assistant.ts getAssistantStatus] Error fetching status for assistant ${assistantId}:`,
      error
    );
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error occurred.';
    return { detail: errorMessage };
  }
}
export async function deleteAssistant(assistantId: string): Promise<ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const response = await fetch(`${getInternalApiBaseUrl()}/api/assistant/${assistantId}`, {
      method: 'DELETE',
      headers: { apiKey: apiKey },
    });

    if (!response.ok) {
      let errorData;
      let errorMessage = `Failed to delete assistant: ${response.statusText} (Status: ${response.status})`;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          errorData = await response.json();
          errorMessage = errorData?.detail || errorMessage;
        }
      } catch (parseError) {
        console.error(
          `[actions.ts deleteAssistant] Failed to parse error JSON response: ${parseError}`
        );
      }
      return { detail: errorMessage };
    }
    const data = await response.json();
    return { info: data.info || `Assistant ${assistantId} deleted successfully.` };
  } catch (error) {
    console.error(`[actions.ts deleteAssistant] Error deleting assistant ${assistantId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error occurred.';
    return { detail: errorMessage };
  }
}
export async function updateAssistant(
  assistantId: string,
  payload: AssistantUpdatePayload
): Promise<ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    // Convert camelCase payload to snake_case for API
    const snakeCasePayload = camelToSnakeObject<Record<string, unknown>>(payload);

    const response = await fetch(`${getInternalApiBaseUrl()}/api/assistant/${assistantId}`, {
      method: 'PATCH',
      headers: {
        apiKey: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...snakeCasePayload,
        createInfra: true,
      }),
    });

    let data;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        console.error(
          `[actions.ts updateAssistant] Received non-JSON response with status ${response.status}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }
    } catch (parseError) {
      console.error(`[actions.ts updateAssistant] Failed to parse JSON response ${parseError}`);
      return { detail: 'Received an invalid response from the server.' };
    }

    if (!response.ok) {
      let errorMessage = `Failed to update assistant: ${response.statusText}`;
      if (Array.isArray(data.detail)) {
        // FastAPI/Pydantic 422 returns detail as an array of validation error objects
        errorMessage = data.detail.map((d: { msg?: string }) => d.msg || String(d)).join(', ');
      } else if (data.detail) {
        errorMessage = String(data.detail);
      }
      return { detail: errorMessage };
    }

    const successMessage = data.info || `Assistant ${assistantId} updated successfully.`;
    return { info: successMessage };
  } catch (error) {
    console.error(`[actions.ts updateAssistant] Error updating assistant ${assistantId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error occurred.';
    return { detail: errorMessage };
  }
}
export async function createAssistant(
  firstName: string,
  surname: string,
  jobTitle: string | null,
  age: number | null,
  nationality: string | null,
  timezone: string | null,
  profilePhoto: string | null,
  profileVideo: string | null,
  about: string | null,
  voiceId: string | null,
  voiceProvider: VoiceProvider | null,
  isUserDesktop: boolean,
  desktopMode: DesktopMode | null,
  preHireChat?: PreHireChatMessage[]
): Promise<ResponseProps & { assistant?: Assistant }> {
  const apiKey = await requireUserApiKey();
  try {
    const response = await fetch(`${getInternalApiBaseUrl()}/api/assistant`, {
      method: 'POST',
      headers: {
        apiKey: apiKey,
        'Content-Type': 'application/json',
      },
      // API expects snake_case
      body: JSON.stringify({
        firstName: firstName,
        surname,
        jobTitle,
        age,
        nationality,
        profilePhoto: profilePhoto,
        profileVideo: profileVideo,
        about,
        voiceId: voiceId,
        voiceProvider: voiceProvider,
        timezone,
        isUserDesktop: isUserDesktop,
        desktopMode: desktopMode,
        maxParallel: 10,
        weeklyLimit: 40,
        createInfra: true,
        preHireChat: preHireChat,
      }),
    });

    let data;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        console.error(
          `[actions.ts createAssistant] Received non-JSON response with status ${response.status}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }
    } catch (parseError) {
      console.error(`[actions.ts createAssistant] Failed to parse JSON response ${parseError}`);
      return { detail: 'Received an invalid response from the server.' };
    }

    if (!response.ok) {
      const errorMessage =
        formatValidationDetail(data.detail) || `Failed to create assistant: ${response.statusText}`;
      return { detail: errorMessage };
    }

    const successMessage = `Assistant created successfully.`;
    const createdAssistant = snakeToCamelObject<Assistant>(data.info);
    return { info: successMessage, assistant: createdAssistant };
  } catch (error) {
    console.error(`[actions.ts createAssistant] Error creating assistant:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error occurred.';
    return { detail: errorMessage };
  }
}

export async function listSourceAssistants(): Promise<
  Assistant[] | (ResponseProps & { status?: number })
> {
  return listAssistants(false, false);
}

export async function checkHiringFunds(
  hiringFee: number
): Promise<AssistantHiringSufficientFunds | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const fee = hiringFee ?? ASSISTANT_ONBOARDING_FEE;
    const result = await checkCreditsBalance(apiKey, fee);

    if (result.error) return { detail: result.error };
    return { sufficient: result.hasSufficientCredits };
  } catch (error) {
    console.error('[Server Action checkHiringFunds] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error checking balance.';
    return { detail: message };
  }
}
