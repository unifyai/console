import 'server-only';

import { resolveFeatures, type FeatureAuthority, type Features } from './features';
import { resolveEnvironment, type Environment } from '@/lib/environment/environment';

/**
 * Server-side feature resolution that folds in Orchestra's authoritative
 * capability flags.
 *
 * Some features (billing) require credentials that live in a *different*
 * service. Resolving them purely from Console's env would be wrong — e.g.
 * Console has the Stripe publishable key but Orchestra lacks the secret/price
 * IDs, so checkout would 500. Console therefore asks Orchestra (the owner of
 * those credentials) what it can actually do and AND-merges the answer with its
 * own local resolution.
 */

const ORCHESTRA_FEATURES_TIMEOUT_MS = 2_000;

/** How long Next.js may cache Orchestra's capability flags (seconds). */
const ORCHESTRA_FEATURES_REVALIDATE_S = 60;

function localOrchestra(url: string): boolean {
  const normalized = url.toLowerCase();
  return normalized.includes('localhost') || normalized.includes('127.0.0.1');
}

async function fetchOrchestraAuthority(): Promise<FeatureAuthority> {
  const base = process.env.ORCHESTRA_URL;
  if (!base) {
    return {};
  }

  try {
    const res = await fetch(`${base}/v0/features`, {
      // Deployment capabilities change rarely; cache to avoid a round-trip on
      // every authenticated page render.
      next: { revalidate: ORCHESTRA_FEATURES_REVALIDATE_S },
      signal: AbortSignal.timeout(ORCHESTRA_FEATURES_TIMEOUT_MS),
    });
    if (!res.ok) {
      return {};
    }
    // Orchestra reports snake_case flags; read them as a loose map so we don't
    // declare snake_case type properties (which the naming-convention lint
    // rejects), then map to our camelCase authority shape.
    const data = (await res.json()) as Record<string, unknown>;
    const bool = (key: string): boolean | undefined =>
      typeof data[key] === 'boolean' ? (data[key] as boolean) : undefined;
    const localAuthority = localOrchestra(base);
    const billingAuthority = localAuthority
      ? {}
      : {
          billing: bool('billing'),
          manualTopup: bool('manual_topup'),
        };
    const contactAuthority = localAuthority
      ? {}
      : {
          contactPhone: bool('contact_phone'),
          contactWhatsapp: bool('contact_whatsapp'),
          contactDiscord: bool('contact_discord'),
        };
    return {
      ...billingAuthority,
      accountReset: bool('account_reset'),
      workspaceGoogle: bool('workspace_google'),
      workspaceMicrosoft: bool('workspace_microsoft'),
      ...contactAuthority,
    };
  } catch {
    // Orchestra unreachable → fall back to local env resolution only.
    return {};
  }
}

/**
 * Resolve the deployment feature set server-side, merging Orchestra's
 * authoritative capability flags with Console's local credential checks.
 * Use this from Server Components/layouts; pass the result to the client via
 * `EnvironmentProvider`.
 *
 * Accepts the already-resolved `Environment` so callers that also build the
 * environment for the context don't resolve it twice.
 */
export async function getServerFeatures(
  environment: Environment = resolveEnvironment()
): Promise<Features> {
  const authority = await fetchOrchestraAuthority();
  return resolveFeatures(process.env, environment, authority);
}
