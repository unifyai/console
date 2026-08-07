/**
 * Features — credential/key-driven capability resolution.
 *
 * A feature is *what the deployment can do*, derived from which provider
 * credentials are present. The hosted cloud deployment has every credential, so
 * all features resolve to `true`; a self-host install enables only what the
 * operator configured (BYOK). This keeps cloud and self-host on a single code
 * path and avoids `if (selfHost) … else …` branching.
 *
 * This is one of two orthogonal axes — see `@/lib/environment/environment` for
 * the other (deployment topology + auth mode). Features are credentials;
 * Environment is topology/policy. The only place they meet is where a deliberate
 * policy disables a credentialed feature (e.g. self-host never bills), which is
 * why `resolveFeatures` takes the resolved `Environment`.
 *
 * Resolution is pure and runs server-side (where all env vars are available).
 * The result is injected into the client via `EnvironmentProvider` — client
 * components read it through `useFeatures()` and never touch env vars directly.
 */

import { resolveEnvironment, type Environment } from '@/lib/environment/environment';

export type FeatureEnv = Record<string, string | undefined>;

/**
 * Authoritative capability signals reported by the service that owns the
 * underlying credentials (resolved via `getServerFeatures()`). These are
 * AND-merged with this service's local credential checks so a cross-service
 * feature is only enabled when *both* the consumer and the owning service can
 * fulfil it. Omitted fields fall back to local resolution.
 */
export interface FeatureAuthority {
  /** Billing operability reported by Orchestra (Stripe + plans configured). */
  billing?: boolean;
  /**
   * Manual-top-up mode reported by Orchestra (staging): credits are metered
   * and gate work, but replenished for free with no Stripe / card.
   */
  manualTopup?: boolean;
  /**
   * Staging-only "reset my account" tool reported by Orchestra. Rewinds a
   * user's personal workspace to its fresh-signup state.
   */
  accountReset?: boolean;
  /** Google workspace BYOD connect, reported by Orchestra (OAuth client ID). */
  workspaceGoogle?: boolean;
  /** Microsoft workspace BYOD connect, reported by Orchestra (OAuth client ID). */
  workspaceMicrosoft?: boolean;
  /** Assistant phone channel (Twilio), probed by Orchestra from the comms layer. */
  contactPhone?: boolean;
  /** Assistant WhatsApp channel (Twilio WA), probed from the comms layer. */
  contactWhatsapp?: boolean;
  /** Assistant Discord channel, probed from the comms layer. */
  contactDiscord?: boolean;
}

export interface Features {
  /** Billing/credits enforcement + UI (Stripe-backed). */
  billing: boolean;

  /**
   * Manual-top-up mode (staging): billing is enforced (credits meter and gate
   * work) but replenished via a free self-serve top-up — no Stripe key, no
   * card, no charge. When true, `billing` is also true so the billing surfaces
   * render; the billing page swaps its Stripe tiers/card UI for a top-up
   * control. Sourced from Orchestra's authority (it owns the deployment mode).
   */
  manualTopup: boolean;

  /**
   * Staging-only "reset my account" tool for Unify staff. Combined with a
   * Unify-org membership check at the call site, it gates the profile-menu
   * control that rewinds a user's personal workspace to its fresh-signup state.
   * Sourced from Orchestra's authority (it owns the staging/override policy).
   */
  accountReset: boolean;

  /**
   * Voice calls. Requires the full duplex chain: LiveKit (transport) **and** a
   * TTS provider (so the assistant can speak) **and** STT (so it can hear).
   * Gating on LiveKit alone would let a call connect to a silent, deaf
   * assistant — worse than not offering it.
   */
  voiceCalls: boolean;
  /**
   * Speech synthesis (TTS — Cartesia/ElevenLabs). Gates anything that produces
   * assistant audio on its own: the voice picker and TTS previews. Distinct from
   * `voiceCalls`, which additionally needs LiveKit + STT.
   */
  voiceSynthesis: boolean;
  /** Audio transcription / speech-to-text (Deepgram — Console-owned). */
  transcription: boolean;

  /**
   * In-app support tickets. Hosted deployments deliver through a Discord webhook.
   * Local development keeps the entry point visible because the sender logs the
   * ticket locally when no webhook is configured.
   */
  support: boolean;

  // ── Cross-service capabilities (NOT Console-owned) ──────────────────────
  // The credentials live in Orchestra, not Console, so Console cannot resolve
  // them from its own env (they would read `false` in cloud). They are sourced
  // from Orchestra's capability authority (see `FeatureAuthority` /
  // `getServerFeatures()`) and AND-merged with a local env fallback for the
  // contexts that never consult the authority (e.g. login pages, which never
  // show workspace UI anyway).

  /** Workspace connect via Google OAuth (BYOD — Orchestra-owned). */
  workspaceGoogle: boolean;
  /** Workspace connect via Microsoft OAuth (BYOD — Orchestra-owned). */
  workspaceMicrosoft: boolean;

  /**
   * Contact channels the assistant can be reached on. The provider credentials
   * (Twilio, Discord) live in the communication layer, not Console, so these
   * are sourced from Orchestra's authority (which probes comms) — Console can't
   * resolve them from its own env. Used to gate the corresponding tabs/CTAs in
   * the contact manager and the user profile verification flows.
   */
  contactPhone: boolean;
  contactWhatsapp: boolean;
  contactDiscord: boolean;

  /** Login providers offered in the auth UI. */
  loginGoogle: boolean;
  loginMicrosoft: boolean;
  loginGithub: boolean;

  /**
   * Cloudflare Turnstile captcha on auth forms. Unlike the boolean capabilities
   * above, captcha needs a *public* value in the browser (the site key) to
   * render — and that key is exactly the credential the feature is derived from.
   * So the feature carries it directly: the public site key when enabled, or
   * `null` when no key is configured. Gate on truthiness (`if (features.captcha)`)
   * and pass the value straight to the widget.
   */
  captcha: string | null;
}

/** True when at least one of the given env vars holds a non-empty value. */
const has = (env: FeatureEnv, ...keys: string[]): boolean =>
  keys.some((key) => (env[key] ?? '').trim() !== '');

/**
 * Resolve the active feature set from the environment.
 *
 * MUST be called server-side (e.g. in a layout/Server Component or API route)
 * where non-`NEXT_PUBLIC_` env vars are available, then passed to the client
 * via `EnvironmentProvider`. For cross-service features (billing) prefer
 * `getServerFeatures()`, which folds in Orchestra's authoritative signals via
 * the `authority` argument.
 *
 * `environment` is threaded in for the rare feature whose availability is gated
 * by a deployment *policy* rather than a credential (billing is off on
 * self-host). Everything else is a pure credential check.
 */
export function resolveFeatures(
  env: FeatureEnv = process.env,
  environment: Environment = resolveEnvironment(env),
  authority: FeatureAuthority = {}
): Features {
  const orchestraUrl = (env.ORCHESTRA_URL ?? '').toLowerCase();
  const localOrchestra = orchestraUrl.includes('localhost') || orchestraUrl.includes('127.0.0.1');
  const stripeConfigured = has(env, 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
  const devCallsEnabled = has(env, 'CONSOLE_DEV_CALLS');
  const livekitConfigured =
    has(env, 'LIVEKIT_URL') && has(env, 'LIVEKIT_API_KEY') && has(env, 'LIVEKIT_API_SECRET');
  // TTS: the runtime accepts Cartesia or ElevenLabs (env name varies by repo).
  const ttsConfigured = has(env, 'CARTESIA_API_KEY', 'ELEVEN_API_KEY', 'ELEVENLABS_API_KEY');
  // STT: Deepgram (same key that powers the `transcription` feature).
  const sttConfigured = has(env, 'DEEPGRAM_API_KEY');
  // Mock simulation has no provider credentials, but the design/QA build must
  // still surface the credential-driven affordances (mic dictation, TTS
  // playback, call entry point). The flag is build-time inlined and the whole
  // simulation is gated on it, so enabling these capabilities here is reachable
  // only under mock mode.
  const mockSim = env.NEXT_PUBLIC_MOCK_SIM === 'true';
  const manualTopup = localOrchestra || mockSim || (authority.manualTopup ?? false);

  return {
    // Billing requires the consumer-side Stripe publishable key *and* Orchestra
    // (the credential authority) confirming checkout is operational. Self-host
    // is a deliberate policy exception (no payment processor) — Orchestra also
    // bypasses credit enforcement there. When Orchestra's signal is absent
    // (login pages, transient unreachability) we fall back to local resolution
    // so behaviour degrades gracefully. Manual-top-up deployments (staging)
    // enforce billing without Stripe, so the key requirement is waived there.
    billing:
      mockSim ||
      ((stripeConfigured || manualTopup) && !environment.isSelfHost && (authority.billing ?? true)),
    manualTopup,
    // Staging-only internal tool: only surfaced when Orchestra (the owner of
    // the staging/override policy) reports it on. No local env fallback — it
    // must never appear by accident in a non-staging deployment.
    accountReset: authority.accountReset ?? false,
    voiceCalls:
      mockSim ||
      localOrchestra ||
      devCallsEnabled ||
      (livekitConfigured && ttsConfigured && sttConfigured),
    voiceSynthesis: mockSim || ttsConfigured,
    transcription: mockSim || sttConfigured,
    support: mockSim || localOrchestra || has(env, 'DISCORD_SUPPORT_WEBHOOK_URL'),
    // Workspace BYOD connect: Orchestra owns the OAuth client IDs, so its
    // authority signal is the source of truth. The local env read is only a
    // fallback for when Orchestra hasn't been consulted (e.g. login pages,
    // which never show workspace UI anyway). Mock simulation has no Orchestra
    // and no client IDs, and a workflow's `workspace` requirement routes to
    // this manager — with the flags off it would open on nothing to connect.
    workspaceGoogle: mockSim || (authority.workspaceGoogle ?? has(env, 'GOOGLE_OAUTH_CLIENT_ID')),
    workspaceMicrosoft:
      mockSim ||
      (authority.workspaceMicrosoft ??
        has(env, 'MS365_BYOD_CLIENT_ID', 'MICROSOFT_BYOD_CLIENT_ID')),
    // Channel credentials live in the comms layer (not Console), so there is no
    // local env to read. When the authority hasn't been consulted (e.g. login
    // pages, which never render contact UI) default to enabled so we don't
    // spuriously hide anything outside the app shell.
    contactPhone: authority.contactPhone ?? true,
    contactWhatsapp: authority.contactWhatsapp ?? true,
    contactDiscord: authority.contactDiscord ?? true,
    loginGoogle: has(env, 'GOOGLE_ID', 'GOOGLE_OAUTH_CLIENT_ID'),
    loginMicrosoft: has(
      env,
      'AZURE_AD_CLIENT_ID',
      'MICROSOFT_BYOD_CLIENT_ID',
      'MS365_BYOD_CLIENT_ID'
    ),
    loginGithub: has(env, 'GITHUB_ID'),
    // Credential-driven and value-carrying: captcha is enabled wherever a
    // Turnstile site key is configured, and the value *is* that public key (the
    // widget needs it client-side). `null` when unset.
    captcha: (env.TURNSTILE_SITE_KEY ?? '').trim() || null,
  };
}
