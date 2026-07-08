import type { LogItemProps, LogProps } from '@/types/interfaces/logs';

/** Identifies the active assistant container session for liveview lookup. */
export type DesktopSessionScope = {
  bindingId?: string | null;
  jobName?: string | null;
};

export function desktopReadyStorageKey(assistantId: string, sessionScope: string): string {
  return `desktop-ready-${assistantId}-${sessionScope}`;
}

export function readDesktopReadyEventField(
  data: Record<string, unknown> | null | undefined,
  snake: string,
  camel: string
): string | null {
  if (!data) return null;
  const value = data[snake] ?? data[camel];
  return typeof value === 'string' && value.trim() ? value : null;
}

export function readLogEntryField(entries: LogItemProps, snake: string, camel: string): unknown {
  return entries[snake] ?? entries[camel];
}

/** Return whether a startup_events row belongs to the requested session scope. */
export function logEntryMatchesSessionScope(
  entries: LogItemProps,
  scope: DesktopSessionScope | null | undefined
): boolean {
  if (!scope?.bindingId && !scope?.jobName) {
    return false;
  }
  const entryBinding = readLogEntryField(entries, 'binding_id', 'bindingId');
  const entryJob = readLogEntryField(entries, 'job_name', 'jobName');
  if (scope.bindingId) {
    return entryBinding === scope.bindingId;
  }
  if (scope.jobName) {
    return entryJob === scope.jobName;
  }
  return false;
}

/** Pick the newest scoped startup_events row that already has a liveview URL. */
export function findScopedStartupLiveviewLog(
  logs: LogProps[] | undefined,
  scope: DesktopSessionScope | null | undefined
): LogProps | undefined {
  if (!logs?.length || (!scope?.bindingId && !scope?.jobName)) {
    return undefined;
  }
  for (const log of logs) {
    const entries = log.entries;
    if (!entries || typeof entries !== 'object') continue;
    const liveview = readLogEntryField(entries, 'liveview_url', 'liveviewUrl');
    if (typeof liveview !== 'string' || !liveview.trim()) continue;
    if (logEntryMatchesSessionScope(entries, scope)) {
      return log;
    }
  }
  return undefined;
}

export function clearDesktopReadyCache(assistantId: string): void {
  try {
    sessionStorage.removeItem(`desktop-ready-${assistantId}`);
    const prefix = `${desktopReadyStorageKey(assistantId, '')}`;
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(prefix)) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    /* SSR-safe */
  }
}

export function liveviewHealthProbeUrl(liveviewUrl: string): string | null {
  try {
    const urlObj = new URL(liveviewUrl);
    const path = urlObj.pathname?.trim() || '/desktop/custom.html';
    return `${urlObj.origin}${path.startsWith('/') ? path : `/${path}`}`;
  } catch {
    return null;
  }
}
