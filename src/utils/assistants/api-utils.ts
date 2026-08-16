import { formatValidationDetail } from '@/utils/orchestra-error';
import { isStagingEnvironment } from '@/lib/environment/comms-env';

export { isStagingEnvironment };

function cleanUrl(url?: string | null): string {
  return String(url || '')
    .trim()
    .replace(/\/+$/, '');
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
 * Resolution order:
 *   1. params.localAdaptersUrl  - explicit override for local stacks
 *   2. UNIFY_ADAPTERS_URL       - per-environment host (staging vs production)
 *
 * There is intentionally no baked-in default: each environment must set
 * UNIFY_ADAPTERS_URL so the Cloud Run host is never hardcoded in source.
 */
export function getAdaptersBaseUrl(params?: { localAdaptersUrl?: string | null }): string {
  const explicitLocalAdaptersUrl = cleanUrl(params?.localAdaptersUrl);
  if (explicitLocalAdaptersUrl) {
    return explicitLocalAdaptersUrl;
  }

  const configuredAdaptersUrl = cleanUrl(process.env.UNIFY_ADAPTERS_URL);
  if (configuredAdaptersUrl) {
    return configuredAdaptersUrl;
  }

  throw new Error(
    'UNIFY_ADAPTERS_URL is not set. Configure it per environment ' +
      '(staging vs production adapters host), or pass localAdaptersUrl for local stacks.'
  );
}

export function formatFastApiError(detail: any): string {
  return formatValidationDetail(detail) ?? 'Unknown validation error.';
}
