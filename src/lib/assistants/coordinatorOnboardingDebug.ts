const ENV_ENABLED = process.env.NEXT_PUBLIC_DEBUG_COORDINATOR_ONBOARDING === 'true';
const LOCAL_STORAGE_KEY = 'console:debug:coordinator-onboarding';

function isEnabled(): boolean {
  if (ENV_ENABLED) return true;
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(LOCAL_STORAGE_KEY) === '1';
}

export function debugCoordinatorOnboarding(
  event: string,
  details: Record<string, unknown> = {}
): void {
  if (!isEnabled()) return;
  console.log('[CoordinatorOnboarding]', {
    event,
    ...details,
    at: new Date().toISOString(),
  });
}
