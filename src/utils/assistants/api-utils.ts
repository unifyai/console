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
