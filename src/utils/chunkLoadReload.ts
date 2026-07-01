const CHUNK_LOAD_RELOAD_SESSION_KEY = 'console:chunk-load-reload';

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

function hasAlreadyReloadedForChunkLoad(): boolean {
  try {
    return window.sessionStorage.getItem(CHUNK_LOAD_RELOAD_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function markChunkLoadReloadAttempted(): void {
  try {
    window.sessionStorage.setItem(CHUNK_LOAD_RELOAD_SESSION_KEY, '1');
  } catch {
    /* private mode — still attempt one reload */
  }
}

/**
 * Reload once per browser tab when stale bundles fail to load a chunk.
 * Returns true when a reload was triggered.
 */
export function tryReloadForChunkLoadError(error: unknown): boolean {
  if (typeof window === 'undefined' || !isChunkLoadError(error)) {
    return false;
  }
  if (hasAlreadyReloadedForChunkLoad()) {
    return false;
  }

  markChunkLoadReloadAttempted();
  window.location.reload();
  return true;
}
