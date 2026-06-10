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
 * UNITY_ADAPTERS_URL overrides when injected (e.g. local stacks); otherwise
 * the canonical Cloud Run host for the resolved comms environment is used.
 */
export function getAdaptersBaseUrl(params?: { localAdaptersUrl?: string | null }): string {
  const explicitLocalAdaptersUrl = cleanUrl(params?.localAdaptersUrl);
  if (explicitLocalAdaptersUrl) {
    return explicitLocalAdaptersUrl;
  }

  const configuredAdaptersUrl = cleanUrl(process.env.UNITY_ADAPTERS_URL);
  if (configuredAdaptersUrl) {
    return configuredAdaptersUrl;
  }

  const prefix = isStagingEnvironment() ? 'staging-' : '';
  return `https://unity-adapters-${prefix}ky4ja5fxna-uc.a.run.app`;
}

export function formatFastApiError(detail: any): string {
  return formatValidationDetail(detail) ?? 'Unknown validation error.';
}
