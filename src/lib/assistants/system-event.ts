import { camelToSnakeObject } from '@/utils/casing';
import { getAdaptersBaseUrl } from '@/utils/assistants/api-utils';

export interface UnitySystemEventDispatch {
  assistantId: string | number;
  eventType: string;
  message?: string;
  extraEventFields?: Record<string, unknown>;
}

export interface UnitySystemEventDispatchResult {
  ok: boolean;
  status: number;
  data?: unknown;
  detail?: string;
}

export function unitySystemEventPayload(args: UnitySystemEventDispatch): Record<string, unknown> {
  return camelToSnakeObject({
    assistantId: Number(args.assistantId),
    eventType: args.eventType,
    message: args.message ?? '',
    extraEventFields: args.extraEventFields ?? {},
  });
}

function localOrchestraWithoutAdapters(): boolean {
  const orchestraUrl = (process.env.ORCHESTRA_URL ?? '').toLowerCase();
  return (
    !process.env.LOCAL_ADAPTERS_URL &&
    !process.env.UNIFY_ADAPTERS_URL &&
    (orchestraUrl.includes('localhost') || orchestraUrl.includes('127.0.0.1'))
  );
}

export async function dispatchUnitySystemEvent(
  args: UnitySystemEventDispatch
): Promise<UnitySystemEventDispatchResult> {
  const adminKey = process.env.ORCHESTRA_ADMIN_KEY;
  if (!adminKey) {
    return { ok: false, status: 500, detail: 'Server configuration error' };
  }

  if (localOrchestraWithoutAdapters()) {
    return { ok: true, status: 202, data: { skipped: true, reason: 'local-adapters-unset' } };
  }

  const webhookUrl = `${getAdaptersBaseUrl({
    localAdaptersUrl: process.env.LOCAL_ADAPTERS_URL,
  })}/unity/system-event`;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(unitySystemEventPayload(args)),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => 'Failed to send system event');
      return { ok: false, status: response.status, detail };
    }
    const data = await response.json().catch(() => ({}));
    return { ok: true, status: response.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      detail: error instanceof Error ? error.message : 'Failed to send system event',
    };
  }
}
