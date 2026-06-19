/**
 * Environment — the deployment-identity axis.
 *
 * This is one of the two orthogonal axes the app is configured by:
 *
 *  - **Environment** (this module): *where/how* the deployment runs — its
 *    topology (`deployment`) and how identity is established (`authMode`). These
 *    are facts no provider credential captures.
 *  - **Features** (`@/lib/features/features`): *what the deployment can do* —
 *    capabilities derived from which provider credentials are present.
 *
 * Keep the two separate. Use `Environment` for topology/policy decisions
 * (spawning the local runtime, one-click owner login, staging access gates) and
 * `Features` for credential-gated capabilities (billing, voice, captcha, …).
 *
 * Resolution is pure and runs server-side (all env vars available); the result
 * is injected into the client via `EnvironmentProvider` and read with
 * `useEnvironment()`.
 */

type EnvVars = Record<string, string | undefined>;

/**
 * Deployment topology. Mutually exclusive — resolved by priority so a single
 * value always describes the install.
 *
 *  - `selfhost`   — local single-owner install co-located with a Droid runtime
 *                   it can spawn (highest priority; orthogonal to NODE_ENV).
 *  - `staging`    — hosted pre-production (Orchestra URL points at staging).
 *  - `dev`        — local development with seeded data (NODE_ENV !== production).
 *  - `production` — the hosted cloud deployment.
 */
export type Deployment = 'production' | 'staging' | 'selfhost' | 'dev';

/**
 * How user identity is established.
 *
 *  - `managed`  — Console/Orchestra own auth (NextAuth email+password, plus
 *    OAuth when configured). Covers cloud and self-host.
 *  - `external` — identity injected by an external system (reverse proxy /
 *    enterprise SSO) via session/user JSON; NextAuth is bypassed. Subsumes the
 *    legacy `ON_PREM` flag.
 */
export type AuthMode = 'managed' | 'external';

export interface Environment {
  deployment: Deployment;
  authMode: AuthMode;
  /** Convenience booleans derived from `deployment` (avoid string compares). */
  isProduction: boolean;
  isStaging: boolean;
  isSelfHost: boolean;
  isDev: boolean;
}

/**
 * Whether this is a self-host install. Reads both the server (`SELF_HOST`) and
 * public (`NEXT_PUBLIC_SELF_HOST`) flags so it resolves consistently on either
 * side of the server/client boundary.
 */
export function isSelfHost(env: EnvVars = process.env): boolean {
  return env.SELF_HOST === '1' || env.NEXT_PUBLIC_SELF_HOST === '1';
}

/** When set to ``compose``, Console writes coordinator runtime state only; CM runs in a container. */
export function isComposeSelfHostRuntime(env: EnvVars = process.env): boolean {
  return isSelfHost(env) && env.SELF_HOST_RUNTIME_MODE === 'compose';
}

/**
 * Resolve the auth mode. `external` is selected by the explicit
 * `AUTH_MODE=external` setting or the legacy `ON_PREM` flag (backward compat).
 */
export function resolveAuthMode(env: EnvVars = process.env): AuthMode {
  const external = env.AUTH_MODE === 'external' || (env.ON_PREM ?? '').trim() !== '';
  return external ? 'external' : 'managed';
}

/**
 * Resolve the deployment topology. Priority order matters: a self-host install
 * is always `selfhost` regardless of `NODE_ENV`; hosted staging is detected from
 * the Orchestra URL; anything else non-production is local `dev`.
 */
export function resolveDeployment(env: EnvVars = process.env): Deployment {
  if (isSelfHost(env)) return 'selfhost';
  if ((env.ORCHESTRA_URL ?? '').includes('staging')) return 'staging';
  if (env.NODE_ENV !== 'production') return 'dev';
  return 'production';
}

/**
 * Resolve the full environment. MUST be called server-side, then passed to the
 * client via `EnvironmentProvider` and read through `useEnvironment()`.
 */
export function resolveEnvironment(env: EnvVars = process.env): Environment {
  const deployment = resolveDeployment(env);
  return {
    deployment,
    authMode: resolveAuthMode(env),
    isProduction: deployment === 'production',
    isStaging: deployment === 'staging',
    isSelfHost: deployment === 'selfhost',
    isDev: deployment === 'dev',
  };
}
