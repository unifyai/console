/**
 * Returns the service-name prefix for the unity-adapters Cloud Run host.
 *
 * Priority:
 *   1. deploy_env === 'preview' → 'preview-'
 *   2. ORCHESTRA_URL contains 'staging' (or localhost for some callers) → 'staging-'
 *   3. Otherwise → '' (production)
 */
export function getAdaptersPrefix(deployEnv?: string | null, isStaging?: boolean): string {
  if (deployEnv === 'preview') return 'preview-';
  return isStaging ? 'staging-' : '';
}

function cleanUrl(url?: string | null): string {
  return String(url || '')
    .trim()
    .replace(/\/+$/, '');
}

export function isStagingEnvironment(orchestraUrl?: string | null): boolean {
  const normalizedUrl = cleanUrl(orchestraUrl).toLowerCase();
  return (
    normalizedUrl.includes('staging') ||
    normalizedUrl.includes('localhost') ||
    normalizedUrl.includes('127.0.0.1')
  );
}

/**
 * Returns the base URL for internal Next API calls from server actions.
 *
 * Preview revisions inject NEXT_PUBLIC_APP_URL with the tagged console host.
 * Falling back to NEXTAUTH_URL preserves canonical behavior for staging/prod.
 */
export function getInternalApiBaseUrl(): string {
  const publicAppUrl = cleanUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (publicAppUrl) {
    return publicAppUrl;
  }

  const nextAuthUrl = cleanUrl(process.env.NEXTAUTH_URL);
  if (nextAuthUrl) {
    return nextAuthUrl;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_APP_URL or NEXTAUTH_URL must be set for internal API calls.');
  }
  return 'http://localhost:3000';
}

/**
 * Returns the adapters base URL for server-side dispatch to Communication.
 *
 * Preview revisions inject UNITY_ADAPTERS_URL with the tagged adapters host.
 * If that env var is unavailable we fall back to the legacy prefix-based host.
 */
export function getAdaptersBaseUrl(params?: {
  deployEnv?: string | null;
  isStaging?: boolean;
  localAdaptersUrl?: string | null;
}): string {
  const explicitLocalAdaptersUrl = cleanUrl(params?.localAdaptersUrl);
  if (explicitLocalAdaptersUrl) {
    return explicitLocalAdaptersUrl;
  }

  const configuredAdaptersUrl = cleanUrl(process.env.UNITY_ADAPTERS_URL);
  if (configuredAdaptersUrl) {
    return configuredAdaptersUrl;
  }

  const prefix = getAdaptersPrefix(params?.deployEnv, params?.isStaging);
  return `https://unity-adapters-${prefix}ky4ja5fxna-uc.a.run.app`;
}

export function formatFastApiError(detail: any): string {
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((err: any) => {
        const field =
          err.loc && err.loc.length > 1
            ? err.loc.slice(1).join('.')
            : (err.loc && err.loc[0]) || 'body';
        return `${field}: ${err.msg}`;
      })
      .join('; ');
  }
  if (typeof detail === 'object' && detail !== null) {
    return JSON.stringify(detail); // Fallback for other object structures
  }
  return 'Unknown validation error.';
}
