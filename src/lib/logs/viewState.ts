import type { LogViewState, LogViewStateStore } from './types';
import { emptyLogViewState } from './types';

const MEMORY = new Map<string, LogViewState>();
const STORAGE_PREFIX = 'log-view-state:';

function readSession(key: string): LogViewState | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LogViewState>;
    return emptyLogViewState(parsed);
  } catch {
    return null;
  }
}

function writeSession(key: string, state: LogViewState): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state));
  } catch {
    // Quota / private mode — memory map still holds the value.
  }
}

/**
 * Session-scoped view-state store (memory + sessionStorage).
 * Swap for a persistent Orchestra-backed adapter later without changing LogGrid.
 */
export function createSessionLogViewStateStore(): LogViewStateStore {
  return {
    get(key: string): LogViewState {
      const cached = MEMORY.get(key);
      if (cached) return cached;
      const fromSession = readSession(key);
      if (fromSession) {
        MEMORY.set(key, fromSession);
        return fromSession;
      }
      const empty = emptyLogViewState();
      MEMORY.set(key, empty);
      return empty;
    },
    set(key: string, patch: Partial<LogViewState>): void {
      const prev = this.get(key);
      const next = { ...prev, ...patch };
      MEMORY.set(key, next);
      writeSession(key, next);
    },
    replace(key: string, next: LogViewState): void {
      MEMORY.set(key, next);
      writeSession(key, next);
    },
  };
}

/** Singleton used by the Assistants Data tab. */
export const sessionLogViewStateStore = createSessionLogViewStateStore();

export function dataViewStateKey(contextPath: string): string {
  return `data:${contextPath}`;
}
