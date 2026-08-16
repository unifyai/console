const CHUNK_LOAD_RELOAD_SESSION_KEY = 'console:chunk-load-reload';

/** How long one reload attempt suppresses the next. */
const RELOAD_SUPPRESSION_MS = 30_000;

const EXPLICIT_CHUNK_ERROR =
  /(?:Loading (?:CSS )?chunk \d+ failed|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|Failed to load module script)/i;

const WEBPACK_STALE_MODULE_ERROR = /Cannot read properties of undefined \(reading 'call'\)/;

function readErrorParts(error: unknown): { message: string; stack: string; name: string } {
  if (error instanceof Error) {
    return {
      message: error.message ?? '',
      stack: error.stack ?? '',
      name: error.name ?? '',
    };
  }
  if (typeof error === 'string') {
    return { message: error, stack: '', name: '' };
  }
  if (error && typeof error === 'object') {
    const record = error as { message?: unknown; stack?: unknown; name?: unknown };
    return {
      message: typeof record.message === 'string' ? record.message : String(error),
      stack: typeof record.stack === 'string' ? record.stack : '',
      name: typeof record.name === 'string' ? record.name : '',
    };
  }
  return { message: '', stack: '', name: '' };
}

/** True when a lazy-loaded Next/webpack chunk is missing after a deploy. */
export function isChunkLoadError(error: unknown): boolean {
  const { message, stack, name } = readErrorParts(error);
  const haystack = `${name}\n${message}\n${stack}`;

  if (EXPLICIT_CHUNK_ERROR.test(haystack)) {
    return true;
  }

  if (!WEBPACK_STALE_MODULE_ERROR.test(message)) {
    return false;
  }

  return /\/_next\/static\/chunks\/|webpack-/i.test(stack);
}

function lastReloadAttemptAt(): number {
  try {
    const stored = Number(window.sessionStorage.getItem(CHUNK_LOAD_RELOAD_SESSION_KEY));
    return Number.isFinite(stored) ? stored : 0;
  } catch {
    return 0;
  }
}

function markChunkLoadReloadAttempted(at: number): void {
  try {
    window.sessionStorage.setItem(CHUNK_LOAD_RELOAD_SESSION_KEY, String(at));
  } catch {
    /* private mode — still attempt one reload */
  }
}

/**
 * Reload once per failure episode when stale bundles fail to load a chunk.
 * Returns true when a reload was triggered.
 *
 * The suppression is a cooldown rather than a once-ever latch because a tab
 * outlives many deploys: recovering from one deploy must not spend the tab's
 * only reload. A chunk that is still missing re-throws within a second or two
 * of the reload, so the repeat lands inside the window and falls through to the
 * error boundary instead of looping; the next deploy is far outside it.
 */
export function tryReloadForChunkLoadError(error: unknown): boolean {
  if (typeof window === 'undefined' || !isChunkLoadError(error)) {
    return false;
  }
  const now = Date.now();
  if (now - lastReloadAttemptAt() < RELOAD_SUPPRESSION_MS) {
    return false;
  }

  markChunkLoadReloadAttempted(now);
  window.location.reload();
  return true;
}
