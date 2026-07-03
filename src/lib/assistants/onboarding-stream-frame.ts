import { snakeToCamelObject } from '@/utils/casing';

const RENDER_UPDATED_SUBTYPE = 'onboarding_render_updated';

export function onboardingStateUpdatedFrame(
  payload: Record<string, unknown>,
  publishTime?: string
): { type: string; data: { ts: string; reason: string | null } } | null {
  if (payload.thread !== 'unity_system_event') return null;

  const event = snakeToCamelObject<Record<string, unknown>>(payload.event ?? {});
  if (event.eventType !== 'coordinator_onboarding_event') return null;
  if (event.subtype !== RENDER_UPDATED_SUBTYPE) return null;

  const details =
    event.details && typeof event.details === 'object'
      ? (event.details as Record<string, unknown>)
      : {};

  return {
    type: 'OnboardingStateUpdated',
    data: {
      ts: publishTime ?? new Date().toISOString(),
      reason: typeof details.reason === 'string' ? details.reason : null,
    },
  };
}

export function encodeOnboardingInvalidationSse(
  payload: Record<string, unknown>,
  publishTime?: string
): string | null {
  const frame = onboardingStateUpdatedFrame(payload, publishTime);
  if (!frame) return null;
  return `data: ${JSON.stringify(frame)}\n\n`;
}
