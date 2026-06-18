/**
 * Single source of truth for which comms environment (staging vs
 * production) this Console deployment talks to.
 *
 * Backend resource names (adapters hosts, per-assistant Pub/Sub topics,
 * billing topics) are partitioned by a `-staging` suffix/prefix. Console
 * derives the environment from ORCHESTRA_URL: a staging Orchestra means
 * staging comms resources. Local development (localhost Orchestra) also
 * maps to staging so the console exercises real staging infrastructure
 * instead of production.
 */

function cleanUrl(url?: string | null): string {
  return String(url || '')
    .trim()
    .replace(/\/+$/, '');
}

export function isStagingEnvironment(
  orchestraUrl: string | null | undefined = process.env.ORCHESTRA_URL
): boolean {
  const normalizedUrl = cleanUrl(orchestraUrl).toLowerCase();
  return (
    normalizedUrl.includes('staging') ||
    normalizedUrl.includes('localhost') ||
    normalizedUrl.includes('127.0.0.1')
  );
}

/**
 * Suffix appended to environment-partitioned Pub/Sub topic names
 * (e.g. `droid-{assistantId}` and `billing-account-{id}`).
 *
 * PUBSUB_TOPIC_SUFFIX is an explicit override (set it to '' to force
 * production names, '-staging' for staging names); otherwise the suffix
 * follows the resolved comms environment.
 */
export function topicSuffix(): string {
  const explicitSuffix = process.env.PUBSUB_TOPIC_SUFFIX;
  if (explicitSuffix !== undefined) {
    return explicitSuffix;
  }
  return isStagingEnvironment() ? '-staging' : '';
}
