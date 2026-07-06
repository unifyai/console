/** Client-side signals that Coordinator/State may have changed server-side. */

export const COORDINATOR_ONBOARDING_STALE_KEY =
  'console:assistants:coordinator-onboarding-stale-at';
export const COORDINATOR_ONBOARDING_STALE_EVENT = 'coordinator-onboarding-stale';

export function markCoordinatorOnboardingStale(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COORDINATOR_ONBOARDING_STALE_KEY, String(Date.now()));
  } catch {
    /* private mode / quota */
  }
  window.dispatchEvent(new Event(COORDINATOR_ONBOARDING_STALE_EVENT));
}

export function readCoordinatorOnboardingStaleAt(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(COORDINATOR_ONBOARDING_STALE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

export function clearCoordinatorOnboardingStaleFlag(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(COORDINATOR_ONBOARDING_STALE_KEY);
  } catch {
    /* ignore */
  }
}
