const ENV_ENABLED = process.env.NEXT_PUBLIC_CONSOLE_DEBUG === 'true';
const LOCAL_STORAGE_KEY = 'console:debug';

function isEnabled(): boolean {
  if (ENV_ENABLED) return true;
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(LOCAL_STORAGE_KEY) === '1';
}

export function debugConsole(
  category: string,
  event: string,
  details: Record<string, unknown> = {}
) {
  if (!isEnabled()) return;
  console.log(`[ConsoleDebug:${category}]`, {
    event,
    ...details,
    at: new Date().toISOString(),
  });
}
