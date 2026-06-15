const DEFAULT_ORCHESTRA_URL = 'https://api.unify.ai';

export function getOrchestraV0BaseUrl(): string {
  const raw = process.env.ORCHESTRA_URL || DEFAULT_ORCHESTRA_URL;
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/v0') ? trimmed : `${trimmed}/v0`;
}

export function buildOrchestraV0Url(path: string): URL {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(`${getOrchestraV0BaseUrl()}${normalizedPath}`);
}
