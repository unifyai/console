import { getObjectPathFromUrl } from '@/utils/assistants/gcs-utils';

const FALLBACK_SIGNED_URL_TTL_MS = 12 * 60 * 1000;
const SIGNED_URL_EXPIRY_BUFFER_MS = 60 * 1000;
const STORAGE_URL_PREFIX = 'https://storage.googleapis.com/';

interface MediaSignedUrlCacheEntry {
  signedUrl: string;
  cachedAtMs: number;
  expiresAtMs: number;
}

const signedUrlCache = new Map<string, MediaSignedUrlCacheEntry>();
const signedUrlInFlight = new Map<string, Promise<string | null>>();

function parseGoogleSignedUrlDate(value: string): number | null {
  if (!/^\d{8}T\d{6}Z$/.test(value)) return null;

  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  const hour = value.slice(9, 11);
  const minute = value.slice(11, 13);
  const second = value.slice(13, 15);
  const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  const parsedDateMs = Date.parse(isoString);

  return Number.isNaN(parsedDateMs) ? null : parsedDateMs;
}

function isSignedHttpUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}

function computeSignedUrlExpiryMs(signedUrl: string, nowMs: number): number {
  try {
    const parsedUrl = new URL(signedUrl);
    const googleDate = parsedUrl.searchParams.get('X-Goog-Date');
    const googleExpires = parsedUrl.searchParams.get('X-Goog-Expires');
    if (!googleDate || !googleExpires) {
      return nowMs + FALLBACK_SIGNED_URL_TTL_MS;
    }

    const startMs = parseGoogleSignedUrlDate(googleDate);
    const ttlSeconds = Number.parseInt(googleExpires, 10);
    if (startMs === null || !Number.isFinite(ttlSeconds)) {
      return nowMs + FALLBACK_SIGNED_URL_TTL_MS;
    }

    return startMs + ttlSeconds * 1000;
  } catch {
    return nowMs + FALLBACK_SIGNED_URL_TTL_MS;
  }
}

function isFresh(entry: MediaSignedUrlCacheEntry, nowMs: number): boolean {
  return entry.expiresAtMs - SIGNED_URL_EXPIRY_BUFFER_MS > nowMs;
}

export function normalizeMediaPathKey(path: string): string {
  const trimmedPath = path.trim();
  if (!trimmedPath) return trimmedPath;
  if (trimmedPath.startsWith('gs://')) return trimmedPath;
  if (!trimmedPath.startsWith(STORAGE_URL_PREFIX)) return trimmedPath;

  const objectPath = getObjectPathFromUrl(trimmedPath);
  if (!objectPath) return trimmedPath;

  try {
    const parsedUrl = new URL(trimmedPath);
    const bucketName = parsedUrl.pathname.split('/').filter(Boolean)[0];
    if (!bucketName) return trimmedPath;
    return `gs://${bucketName}/${objectPath}`;
  } catch {
    return trimmedPath;
  }
}

export function seedMediaSignedUrls(
  urlsByPath: Record<string, string>,
  nowMs: number = Date.now()
): void {
  Object.entries(urlsByPath).forEach(([path, signedUrl]) => {
    if (!path || !signedUrl || !isSignedHttpUrl(signedUrl)) return;
    const cacheKey = normalizeMediaPathKey(path);
    if (!cacheKey) return;

    signedUrlCache.set(cacheKey, {
      signedUrl,
      cachedAtMs: nowMs,
      expiresAtMs: computeSignedUrlExpiryMs(signedUrl, nowMs),
    });
  });
}

export function readCachedMediaSignedUrls(
  paths: string[],
  nowMs: number = Date.now()
): Record<string, string> {
  const resolved: Record<string, string> = {};

  paths.forEach((path) => {
    if (!path) return;
    const cacheKey = normalizeMediaPathKey(path);
    if (!cacheKey) return;
    const cached = signedUrlCache.get(cacheKey);
    if (cached && isFresh(cached, nowMs)) {
      resolved[path] = cached.signedUrl;
    }
  });

  return resolved;
}

export function getMediaSignedUrlInFlight(path: string): Promise<string | null> | undefined {
  return signedUrlInFlight.get(normalizeMediaPathKey(path));
}

export function setMediaSignedUrlInFlight(path: string, promise: Promise<string | null>): void {
  signedUrlInFlight.set(normalizeMediaPathKey(path), promise);
}

export function clearMediaSignedUrlInFlight(path: string): void {
  signedUrlInFlight.delete(normalizeMediaPathKey(path));
}

export function clearMediaSignedUrlCacheForTests(): void {
  signedUrlCache.clear();
  signedUrlInFlight.clear();
}
