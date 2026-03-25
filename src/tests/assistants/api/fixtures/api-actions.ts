/**
 * Real API action implementations for Assistant API tests.
 *
 * These actions make actual HTTP calls to the Next.js API routes,
 * which then proxy to Orchestra. Used with { meta: { mock: false } } tests.
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

/** Default timeout for API requests */
export const API_TIMEOUT_MS = 90000;

/** Default timeout for individual tests */
export const TEST_TIMEOUT_MS = 30000;

/** Extended timeout for slower operations */
export const TEST_TIMEOUT_EXTENDED_MS = 60000;

/** Common test options for real API tests */
export const realTestOptions = {
  meta: { mock: false },
  timeout: TEST_TIMEOUT_MS,
} as const;

/** Extended test options for slower operations */
export const realTestOptionsExtended = {
  meta: { mock: false },
  timeout: TEST_TIMEOUT_EXTENDED_MS,
} as const;

/**
 * Get the test API key from environment
 */
export function getTestApiKey(): string {
  const apiKey = process.env.VITE_TEST_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_TEST_API_KEY is not set in .env.test');
  }
  return apiKey;
}

/**
 * Get the admin API key from environment
 */
export function getAdminApiKey(): string {
  const apiKey = process.env.VITE_TEST_ADMIN_KEY;
  if (!apiKey) {
    throw new Error('VITE_TEST_ADMIN_KEY is not set in .env.test');
  }
  return apiKey;
}

/**
 * Check if the dev server is reachable.
 */
export async function isServerReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(BASE_URL, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok || response.status === 307;
  } catch {
    return false;
  }
}

/**
 * Skip test if server is not reachable.
 */
export async function skipIfServerNotReachable(): Promise<void> {
  const reachable = await isServerReachable();
  if (!reachable) {
    throw new Error(
      `Server at ${BASE_URL} is not reachable. ` +
        'Start the dev server with `npm run dev` before running @real tests.'
    );
  }
}

/**
 * API error with status code and response body
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
    message?: string
  ) {
    super(message || `API error ${status}: ${JSON.stringify(body)}`);
    this.name = 'ApiError';
  }

  isNotFound(): boolean {
    return this.status === 404;
  }

  isConflict(): boolean {
    return this.status === 409 || this.status === 400;
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Helper to make authenticated fetch requests
 */
async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
  apiKey?: string
): Promise<Response> {
  const key = apiKey || getTestApiKey();
  const url = `${BASE_URL}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        apiKey: key,
        ...options.headers,
      },
    });
    return res;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new TimeoutError(url, API_TIMEOUT_MS);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parse response with proper error handling
 */
async function parseResponse<T>(res: Response, url: string = 'unknown'): Promise<T> {
  const text = await res.text();
  let body: Record<string, unknown>;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid JSON response from ${url}. Response: ${text.slice(0, 100)}...`);
  }

  if (!res.ok) {
    throw new ApiError(res.status, body);
  }

  return body as T;
}

// ============================================
// Response Types
// ============================================

export interface AssistantData {
  agentId: number;
  firstName: string;
  surname: string;
  weeklyLimit?: number;
  country?: string;
  timezone?: string;
  photoUrl?: string;
  videoUrl?: string;
  about?: string;
}

export interface AssistantStatusResponse {
  running: boolean;
  [key: string]: unknown;
}

export interface AssistantUpdateResponse {
  info: AssistantData;
}

export interface AssistantCreateResponse {
  assistant: AssistantData;
}

export interface VoiceData {
  voiceId: string;
  provider: string;
  name?: string;
  description?: string;
}

export interface ContactCountry {
  code: string;
  name: string;
  flag: string;
}

export interface VerifySocialResponse {
  verificationCode?: string;
  detail?: string;
}

export interface PhotoUploadResponse {
  url?: string;
  gcsUrl?: string;
  info?: { url?: string; gcsUrl?: string };
  detail?: string;
}

export interface SecretData {
  logId: number;
  name: string;
  value: string;
  description?: string;
}

// ============================================
// Assistants API Actions
// ============================================

export const assistantsApi = {
  async list(apiKey?: string): Promise<AssistantData[]> {
    const endpoint = '/api/assistant';
    const res = await apiFetch(endpoint, {}, apiKey);
    const data = await parseResponse<{ info?: AssistantData[] } | AssistantData[]>(res, endpoint);
    // Handle both wrapped {info: [...]} and unwrapped [...] formats
    if (Array.isArray(data)) {
      return data;
    }
    return data.info || [];
  },

  async getStatus(assistantId: number, apiKey?: string): Promise<AssistantStatusResponse> {
    const endpoint = `/api/assistant/${assistantId}/status`;
    const res = await apiFetch(endpoint, {}, apiKey);
    const data = await parseResponse<{ info?: AssistantStatusResponse } | AssistantStatusResponse>(
      res,
      endpoint
    );
    // Handle wrapped {info: {...}} format
    if (
      data &&
      typeof data === 'object' &&
      'info' in data &&
      data.info &&
      typeof data.info === 'object' &&
      'running' in data.info
    ) {
      return data.info as AssistantStatusResponse;
    }
    return data as AssistantStatusResponse;
  },

  async update(
    assistantId: number,
    data: Partial<AssistantData>,
    apiKey?: string
  ): Promise<AssistantUpdateResponse> {
    const endpoint = `/api/assistant/${assistantId}`;
    const res = await apiFetch(
      endpoint,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
      apiKey
    );
    return parseResponse(res, endpoint);
  },

  async create(
    firstName: string,
    surname: string,
    weeklyLimit: number,
    country: string,
    timezone: string,
    photoUrl: string,
    videoUrl: string,
    about: string,
    apiKey?: string,
    createInfra: boolean = true
  ): Promise<AssistantCreateResponse> {
    const endpoint = '/api/assistant';
    const res = await apiFetch(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify({
          firstName,
          surname,
          weeklyLimit,
          country,
          timezone,
          photoUrl,
          videoUrl,
          about,
          create_infra: createInfra,
        }),
      },
      apiKey
    );
    const data = await parseResponse<{ info?: AssistantData } | AssistantCreateResponse>(
      res,
      endpoint
    );
    // Handle wrapped {info: {...}} format from Orchestra
    if (data && typeof data === 'object' && 'info' in data && !('assistant' in data)) {
      return { assistant: data.info as AssistantData };
    }
    return data as AssistantCreateResponse;
  },

  async delete(assistantId: number, apiKey?: string): Promise<{ info?: string }> {
    const endpoint = `/api/assistant/${assistantId}`;
    const res = await apiFetch(endpoint, { method: 'DELETE' }, apiKey);
    return parseResponse(res, endpoint);
  },
};

// ============================================
// Voice API Actions
// ============================================

export const voiceApi = {
  async list(apiKey?: string): Promise<VoiceData[]> {
    const endpoint = '/api/assistant/voice';
    const res = await apiFetch(endpoint, {}, apiKey);
    const data = await parseResponse<{ info?: VoiceData[] } | VoiceData[]>(res, endpoint);
    // Handle both wrapped {info: [...]} and unwrapped [...] formats
    if (Array.isArray(data)) {
      return data;
    }
    return data.info || [];
  },

  async generateSpeech(
    text: string,
    provider: string,
    voiceId: string,
    outputFormat: string = 'mp3',
    apiKey?: string
  ): Promise<{ audioBase64?: string; detail?: string }> {
    const endpoint = '/api/assistant/voice/generate';
    const res = await apiFetch(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify({ text, provider, voiceId, outputFormat }),
      },
      apiKey
    );
    // This endpoint may return binary or JSON
    const contentType = res.headers.get('content-type');
    if (contentType?.includes('audio')) {
      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      return { audioBase64: base64 };
    }
    return parseResponse(res, endpoint);
  },

  async register(
    voiceId: string,
    provider: string,
    name: string,
    description: string,
    gender: string,
    language: string,
    isPreset: boolean,
    apiKey?: string
  ): Promise<{ info?: string }> {
    const endpoint = '/api/assistant/voice';
    const res = await apiFetch(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify({ voiceId, provider, name, description, gender, language, isPreset }),
      },
      apiKey
    );
    return parseResponse(res, endpoint);
  },

  async delete(voiceId: string, provider: string, apiKey?: string): Promise<{ info?: string }> {
    const endpoint = `/api/assistant/voice/${encodeURIComponent(voiceId)}?provider=${encodeURIComponent(provider)}`;
    const res = await apiFetch(endpoint, { method: 'DELETE' }, apiKey);
    return parseResponse(res, endpoint);
  },
};

// ============================================
// Contact API Actions
// ============================================

export const contactApi = {
  async listCountries(apiKey?: string): Promise<ContactCountry[]> {
    const endpoint = '/api/contact/phone/available-countries';
    const res = await apiFetch(endpoint, {}, apiKey);
    return parseResponse(res, endpoint);
  },

  async listPlatforms(apiKey?: string): Promise<string[]> {
    const endpoint = '/api/contact/social/available-platforms';
    const res = await apiFetch(endpoint, {}, apiKey);
    return parseResponse(res, endpoint);
  },

  async listEmails(apiKey?: string): Promise<string[]> {
    const endpoint = '/api/contact/email';
    const res = await apiFetch(endpoint, {}, apiKey);
    const data = await parseResponse<{ emails?: string[] }>(res, endpoint);
    return data.emails || [];
  },

  async verifySocial(
    platform: string,
    accountIdentifier: string,
    apiKey?: string
  ): Promise<VerifySocialResponse> {
    const endpoint = '/api/contact/social/verify';
    const res = await apiFetch(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify({ platform, accountIdentifier }),
      },
      apiKey
    );
    return parseResponse(res, endpoint);
  },

  async deleteContact(
    assistantId: number,
    contactType: string,
    apiKey?: string
  ): Promise<{ info?: string; assistant?: AssistantData }> {
    const endpoint = `/api/assistant/${assistantId}/contact`;
    const res = await apiFetch(
      endpoint,
      {
        method: 'DELETE',
        body: JSON.stringify({ contactType }),
      },
      apiKey
    );
    return parseResponse(res, endpoint);
  },
};

// ============================================
// Photo API Actions
// ============================================

export const photoApi = {
  async uploadPhoto(formData: FormData, apiKey?: string): Promise<PhotoUploadResponse> {
    const key = apiKey || getTestApiKey();
    const url = `${BASE_URL}/api/assistant/photo/upload`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: {
          apiKey: key,
        },
      });
      clearTimeout(timeoutId);
      const data = await parseResponse<{ info?: PhotoUploadResponse } | PhotoUploadResponse>(
        res,
        url
      );
      // Handle wrapped {info: {...}} format
      if (data && typeof data === 'object' && 'info' in data && typeof data.info === 'object') {
        return data.info as PhotoUploadResponse;
      }
      return data as PhotoUploadResponse;
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof Error && e.name === 'AbortError') {
        throw new TimeoutError(url, API_TIMEOUT_MS);
      }
      throw e;
    }
  },

  async uploadVideo(formData: FormData, apiKey?: string): Promise<PhotoUploadResponse> {
    const key = apiKey || getTestApiKey();
    const url = `${BASE_URL}/api/assistant/video/upload`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: {
          apiKey: key,
        },
      });
      clearTimeout(timeoutId);
      const data = await parseResponse<{ info?: PhotoUploadResponse } | PhotoUploadResponse>(
        res,
        url
      );
      // Handle wrapped {info: {...}} format
      if (data && typeof data === 'object' && 'info' in data && typeof data.info === 'object') {
        return data.info as PhotoUploadResponse;
      }
      return data as PhotoUploadResponse;
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof Error && e.name === 'AbortError') {
        throw new TimeoutError(url, API_TIMEOUT_MS);
      }
      throw e;
    }
  },

  async generate(
    prompt: string,
    apiKey?: string
  ): Promise<{
    url?: string;
    gcsUrl?: string;
    info?: { url?: string; gcsUrl?: string };
    detail?: string;
  }> {
    const endpoint = '/api/assistant/photo/generate';
    const res = await apiFetch(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      },
      apiKey
    );
    const data = await parseResponse<
      | { info?: { url?: string; gcsUrl?: string } }
      | { url?: string; gcsUrl?: string; detail?: string }
    >(res, endpoint);
    // Handle wrapped {info: {...}} format - return with unwrapped url at top level
    if (data && typeof data === 'object' && 'info' in data && typeof data.info === 'object') {
      const info = data.info as { url?: string; gcsUrl?: string };
      return { url: info.url, gcsUrl: info.gcsUrl, info };
    }
    return data as { url?: string; gcsUrl?: string; detail?: string };
  },
};

// ============================================
// Call API Actions
// ============================================

export const callApi = {
  async getConnectionDetails(
    assistantId: number,
    assistantName: string,
    apiKey?: string
  ): Promise<{ serverUrl?: string; token?: string; roomName?: string; detail?: string }> {
    const endpoint = `/api/assistant/call/connect?assistantId=${assistantId}&assistantName=${encodeURIComponent(assistantName)}`;
    const res = await apiFetch(endpoint, {}, apiKey);
    return parseResponse(res, endpoint);
  },

  async dispatch(
    assistantId: number,
    roomName: string,
    apiKey?: string
  ): Promise<{ info?: string; detail?: string }> {
    const endpoint = '/api/assistant/call/dispatch';
    const res = await apiFetch(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify({ assistantId, roomName }),
      },
      apiKey
    );
    return parseResponse(res, endpoint);
  },
};

// ============================================
// Desktop API Actions
// ============================================

export const desktopApi = {
  async getLiveviewUrl(
    assistantId: number,
    userId: string,
    apiKey?: string
  ): Promise<{ liveviewUrl?: string; detail?: string }> {
    const endpoint = `/api/assistant/desktop/liveview?assistantId=${assistantId}&userId=${encodeURIComponent(userId)}`;
    const res = await apiFetch(endpoint, {}, apiKey);
    return parseResponse(res, endpoint);
  },

  async sendSystemEvent(
    assistantId: number,
    eventType: string,
    message: string,
    apiKey?: string
  ): Promise<{ info?: string; detail?: string }> {
    const endpoint = '/api/assistant/desktop/event';
    const res = await apiFetch(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify({ assistantId, eventType, message }),
      },
      apiKey
    );
    return parseResponse(res, endpoint);
  },
};

// ============================================
// Chat API Actions
// ============================================

export const chatApi = {
  async getContactIdByEmail(
    userName: string,
    assistantName: string,
    email: string,
    apiKey?: string
  ): Promise<number | null> {
    const params = new URLSearchParams({ userName, assistantName, email });
    const endpoint = `/api/assistant/chat/contact?${params.toString()}`;
    try {
      const res = await apiFetch(endpoint, {}, apiKey);
      const data = await parseResponse<{ contactId?: number }>(res, endpoint);
      return data.contactId ?? null;
    } catch {
      return null;
    }
  },

  async getTranscripts(
    userName: string,
    assistantName: string,
    contactId: number,
    apiKey?: string
  ): Promise<Array<Record<string, unknown>>> {
    const params = new URLSearchParams({
      userName,
      assistantName,
      contactId: String(contactId),
    });
    const endpoint = `/api/assistant/chat/transcripts?${params.toString()}`;
    const res = await apiFetch(endpoint, {}, apiKey);
    return parseResponse(res, endpoint);
  },

  async messageAssistant(
    assistantId: number,
    contactId: number,
    message: string,
    apiKey?: string
  ): Promise<{ info?: string; detail?: string }> {
    const endpoint = '/api/assistant/chat/message';
    const res = await apiFetch(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify({ assistantId, contactId, message }),
      },
      apiKey
    );
    return parseResponse(res, endpoint);
  },
};

// ============================================
// Secret API Actions
// ============================================

export const secretApi = {
  async list(assistantId: number, userName: string, apiKey?: string): Promise<SecretData[]> {
    const params = new URLSearchParams({ userName });
    const endpoint = `/api/assistant/${assistantId}/secrets?${params.toString()}`;
    const res = await apiFetch(endpoint, {}, apiKey);
    return parseResponse(res, endpoint);
  },

  async create(
    assistantId: number,
    userName: string,
    secret: { name: string; value: string; description?: string },
    apiKey?: string
  ): Promise<{ info?: string; detail?: string }> {
    const params = new URLSearchParams({ userName });
    const endpoint = `/api/assistant/${assistantId}/secrets?${params.toString()}`;
    const res = await apiFetch(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(secret),
      },
      apiKey
    );
    return parseResponse(res, endpoint);
  },

  async delete(
    assistantId: number,
    userName: string,
    secretId: number,
    apiKey?: string
  ): Promise<{ info?: string; detail?: string }> {
    const params = new URLSearchParams({ userName });
    const endpoint = `/api/assistant/${assistantId}/secrets/${secretId}?${params.toString()}`;
    const res = await apiFetch(endpoint, { method: 'DELETE' }, apiKey);
    return parseResponse(res, endpoint);
  },
};

// ============================================
// Extended Photo API Actions
// ============================================

export const photoApiExtended = {
  async downloadMedia(
    photoUrl: string,
    apiKey?: string
  ): Promise<{ signedUrl?: string; detail?: string }> {
    const endpoint = `/api/assistant/photo/download?url=${encodeURIComponent(photoUrl)}`;
    const res = await apiFetch(endpoint, {}, apiKey);
    return parseResponse(res, endpoint);
  },

  async downloadPresetPhoto(
    firstName: string,
    surname: string,
    apiKey?: string
  ): Promise<{ signedUrl?: string; gcsUrl?: string; detail?: string }> {
    const params = new URLSearchParams({ firstName, surname });
    const endpoint = `/api/assistant/photo/preset?${params.toString()}`;
    const res = await apiFetch(endpoint, {}, apiKey);
    return parseResponse(res, endpoint);
  },

  async downloadPresetVideo(
    firstName: string,
    surname: string,
    provider: string,
    apiKey?: string
  ): Promise<{ signedUrl?: string; gcsUrl?: string; detail?: string }> {
    const params = new URLSearchParams({ firstName, surname, provider });
    const endpoint = `/api/assistant/video/preset?${params.toString()}`;
    const res = await apiFetch(endpoint, {}, apiKey);
    return parseResponse(res, endpoint);
  },

  async edit(
    formData: FormData,
    apiKey?: string
  ): Promise<{
    url?: string;
    gcsUrl?: string;
    info?: { url?: string; gcsUrl?: string };
    detail?: string;
  }> {
    const key = apiKey || getTestApiKey();
    const url = `${BASE_URL}/api/assistant/photo/edit`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: { apiKey: key },
      });
      clearTimeout(timeoutId);
      const data = await parseResponse<
        | { info?: { url?: string; gcsUrl?: string } }
        | { url?: string; gcsUrl?: string; detail?: string }
      >(res, url);
      // Handle wrapped {info: {...}} format
      if (data && typeof data === 'object' && 'info' in data && typeof data.info === 'object') {
        const info = data.info as { url?: string; gcsUrl?: string };
        return { url: info.url, gcsUrl: info.gcsUrl, info };
      }
      return data as { url?: string; gcsUrl?: string; detail?: string };
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof Error && e.name === 'AbortError') {
        throw new TimeoutError(url, API_TIMEOUT_MS);
      }
      throw e;
    }
  },

  async animate(
    formData: FormData,
    apiKey?: string
  ): Promise<{ id?: string; status?: string; output?: string | string[]; detail?: string }> {
    const key = apiKey || getTestApiKey();
    const url = `${BASE_URL}/api/assistant/photo/animate`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: { apiKey: key },
      });
      clearTimeout(timeoutId);
      return parseResponse(res, url);
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof Error && e.name === 'AbortError') {
        throw new TimeoutError(url, API_TIMEOUT_MS);
      }
      throw e;
    }
  },

  async getAnimationStatus(
    predictionId: string,
    apiKey?: string
  ): Promise<{ status?: string; output?: string | string[]; detail?: string }> {
    const endpoint = `/api/assistant/photo/animate/${predictionId}`;
    const res = await apiFetch(endpoint, {}, apiKey);
    return parseResponse(res, endpoint);
  },

  async cancelAnimation(
    predictionId: string,
    apiKey?: string
  ): Promise<{ info?: string; detail?: string }> {
    const endpoint = `/api/assistant/photo/animate/${predictionId}`;
    const res = await apiFetch(endpoint, { method: 'DELETE' }, apiKey);
    return parseResponse(res, endpoint);
  },

  async listMedia(
    userId: string,
    apiKey?: string
  ): Promise<{ files?: Array<{ url: string }>; detail?: string }> {
    const endpoint = `/api/assistant/photo/list?userId=${encodeURIComponent(userId)}`;
    const res = await apiFetch(endpoint, {}, apiKey);
    return parseResponse(res, endpoint);
  },
};

// ============================================
// Extended Voice API Actions
// ============================================

export const voiceApiExtended = {
  async designPreview(
    voiceDescription: string,
    autoGenerateText: boolean = true,
    apiKey?: string
  ): Promise<{ previews?: Array<{ generatedVoiceId: string }>; detail?: string }> {
    const endpoint = '/api/assistant/voice/design/preview';
    const res = await apiFetch(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify({ voiceDescription, autoGenerateText }),
      },
      apiKey
    );
    return parseResponse(res, endpoint);
  },

  async designCreate(
    generatedVoiceId: string,
    voiceName: string,
    voiceDescription: string,
    apiKey?: string
  ): Promise<{ voiceId?: string; detail?: string }> {
    const endpoint = '/api/assistant/voice/design/create';
    const res = await apiFetch(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify({ generatedVoiceId, voiceName, voiceDescription }),
      },
      apiKey
    );
    return parseResponse(res, endpoint);
  },

  async clone(
    formData: FormData,
    apiKey?: string
  ): Promise<{ voiceId?: string; info?: { voiceId?: string }; detail?: string }> {
    const key = apiKey || getTestApiKey();
    const url = `${BASE_URL}/api/assistant/voice/clone`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: { apiKey: key },
      });
      clearTimeout(timeoutId);
      const data = await parseResponse<
        { info?: { voiceId?: string } } | { voiceId?: string; detail?: string }
      >(res, url);
      // Handle wrapped {info: {...}} format
      if (data && typeof data === 'object' && 'info' in data && typeof data.info === 'object') {
        const info = data.info as { voiceId?: string };
        return { voiceId: info.voiceId, info };
      }
      return data as { voiceId?: string; detail?: string };
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof Error && e.name === 'AbortError') {
        throw new TimeoutError(url, API_TIMEOUT_MS);
      }
      throw e;
    }
  },
};

// ============================================
// Extended Desktop API Actions
// ============================================

export const desktopApiExtended = {
  async getLiveviewUrl(
    assistantId: number,
    userId: string,
    apiKey?: string
  ): Promise<{ liveviewUrl?: string; detail?: string }> {
    const endpoint = `/api/assistant/desktop/liveview?assistantId=${assistantId}&userId=${encodeURIComponent(userId)}`;
    const res = await apiFetch(endpoint, {}, apiKey);
    return parseResponse(res, endpoint);
  },
};

// ============================================
// User API Actions
// ============================================

// ============================================
// Admin API Actions
// ============================================

export interface CreditGrantLink {
  id: string;
  token: string;
  expiresAt: string;
  claimedAt?: string | null;
  userId?: string | null;
  creditAmount?: number | null;
}

export interface CreditGrantLinksResponse {
  links?: CreditGrantLink[];
}

export const adminApi = {
  /**
   * List credit grant links (requires admin key)
   */
  async listCreditGrantLinks(limit?: number, offset?: number): Promise<CreditGrantLink[]> {
    const adminKey = getAdminApiKey();
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit.toString());
    if (offset) params.set('offset', offset.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    const endpoint = `/api/admin/credit-grant-link${query}`;
    const res = await apiFetch(endpoint, {}, adminKey);
    return parseResponse<CreditGrantLink[]>(res, endpoint);
  },

  /**
   * Create a credit grant link (requires admin key)
   */
  async createCreditGrantLink(
    expiresInDays: number = 7,
    creditAmount?: number | null
  ): Promise<CreditGrantLink> {
    const adminKey = getAdminApiKey();
    const endpoint = `/api/admin/credit-grant-link`;
    const body: Record<string, unknown> = { expiresInDays };
    if (creditAmount != null) {
      body.creditAmount = creditAmount;
    }
    const res = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(body) }, adminKey);
    return parseResponse<CreditGrantLink>(res, endpoint);
  },

  /**
   * Delete a credit grant link (requires admin key)
   */
  async deleteCreditGrantLink(linkId: string): Promise<void> {
    const adminKey = getAdminApiKey();
    const endpoint = `/api/admin/credit-grant-link/${linkId}`;
    const res = await apiFetch(endpoint, { method: 'DELETE' }, adminKey);
    if (res.status === 204) return;
    // If not 204, check for error
    await parseResponse<Record<string, unknown>>(res, endpoint);
  },
};

// ============================================
// Organizations API Actions
// ============================================

export interface TeamData {
  id: string;
  name: string;
  description?: string;
}

export interface MemberData {
  userId: string;
  email: string;
  role?: string;
}

export const organizationsApi = {
  /**
   * List teams for an organization
   */
  async listTeams(orgId: string, apiKey?: string): Promise<TeamData[]> {
    const endpoint = `/api/organizations/${orgId}/teams`;
    const res = await apiFetch(endpoint, {}, apiKey);
    const data = await parseResponse<{ info?: TeamData[] } | TeamData[]>(res, endpoint);
    if (Array.isArray(data)) return data;
    return data.info || [];
  },

  /**
   * List members for an organization
   */
  async listMembers(orgId: string, apiKey?: string): Promise<MemberData[]> {
    const endpoint = `/api/organizations/${orgId}/members`;
    const res = await apiFetch(endpoint, {}, apiKey);
    const data = await parseResponse<{ info?: MemberData[] } | MemberData[]>(res, endpoint);
    if (Array.isArray(data)) return data;
    return data.info || [];
  },
};

// ============================================
// Bootstrap API Actions
// ============================================

export interface BootstrapResponse {
  project?: string;
  projectsTree: unknown[];
  interfaces: unknown[];
  contexts: unknown[];
  fields: unknown[];
  fetchedAt: string;
  statuses: {
    projectsTree: number;
    interfaces: number;
    contexts: number;
    fields: number;
  };
}

export const bootstrapApi = {
  /**
   * Fetch bootstrap data (aggregated data for initial page load)
   */
  async fetch(projectName?: string, apiKey?: string): Promise<BootstrapResponse> {
    const params = projectName ? `?project=${encodeURIComponent(projectName)}` : '';
    const endpoint = `/api/bootstrap${params}`;
    const res = await apiFetch(endpoint, {}, apiKey);
    return parseResponse<BootstrapResponse>(res, endpoint);
  },
};

// ============================================
// Test Helpers
// ============================================

/**
 * Generate a unique name for test resources
 */
export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Cleanup helper
 */
export async function safeDelete(
  deleteFn: () => Promise<unknown>,
  resourceDescription?: string
): Promise<void> {
  try {
    await deleteFn();
  } catch (e) {
    if (process.env.DEBUG_CLEANUP) {
      console.warn(
        `Cleanup failed${resourceDescription ? ` for ${resourceDescription}` : ''}:`,
        e instanceof Error ? e.message : e
      );
    }
  }
}

/**
 * Get a test assistant for other tests to use.
 * If no assistants exist, attempts to create one.
 */
export async function getTestAssistant(apiKey?: string): Promise<AssistantData> {
  const assistants = await assistantsApi.list(apiKey);
  if (Array.isArray(assistants) && assistants.length > 0) {
    return assistants[0];
  }

  // No assistants exist - try to create one
  console.log('No assistants found. Attempting to create a test assistant...');
  try {
    const createRes = await assistantsApi.create(
      'Test',
      'Agent',
      40,
      'GB',
      'UTC',
      'gs://bucket/preset_assistants/photos/Test_Agent.jpg',
      'gs://bucket/preset_assistants/videos/Ricardo_Silva_elevenlabs.mp4',
      'Integration test assistant for automated testing',
      apiKey,
      false // createInfra: false for local testing - skip pubsub/wake-up
    );

    if (createRes.assistant) {
      console.log(`Created test assistant: ${createRes.assistant.agentId}`);
      return createRes.assistant;
    }
  } catch (e) {
    // Handle 409 conflict - another test already created the assistant
    // Also handle 500 wake-up errors - assistant may have been partially created
    if (e instanceof ApiError && (e.status === 409 || e.status === 500)) {
      console.log('Creation conflict/error - checking if assistant exists now...');
      const retryAssistants = await assistantsApi.list(apiKey);
      if (Array.isArray(retryAssistants) && retryAssistants.length > 0) {
        return retryAssistants[0];
      }
    }
    console.error('Failed to create test assistant:', e);
  }

  throw new Error('No assistants found and could not create one. Cannot run test.');
}

/**
 * Get a test voice for other tests to use
 */
export async function getTestVoice(apiKey?: string): Promise<VoiceData> {
  const voices = await voiceApi.list(apiKey);
  if (!Array.isArray(voices) || voices.length === 0) {
    throw new Error('No voices found. Cannot run test.');
  }
  return voices[0];
}
