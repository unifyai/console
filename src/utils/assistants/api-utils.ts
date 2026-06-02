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

import { formatValidationDetail } from '@/utils/orchestra-error';

export function formatFastApiError(detail: any): string {
  return formatValidationDetail(detail) ?? 'Unknown validation error.';
}
