/**
 * Shared Pub/Sub subscription helpers.
 *
 * Two subscription strategies:
 * - **Ephemeral** (actions): per-connection, deleted on disconnect, 1-day expiry
 *   safety net. Used for the action pane where backlog loss on reconnect is
 *   acceptable (Orchestra covers historical data).
 * - **Persistent** (chat): per-user+assistant, survives across reconnects so
 *   messages published during connection gaps are preserved. 31-day expiry
 *   cleans up abandoned subscriptions.
 */

import { GoogleAuth } from 'google-auth-library';
import { PubSub } from '@google-cloud/pubsub';
import fs from 'fs';
import path from 'path';
import { topicSuffix } from '@/lib/environment/comms-env';

/** Ephemeral subscriptions auto-delete after this much inactivity. */
export const EPHEMERAL_EXPIRATION_TTL = '86400s'; // 1 day

/** Persistent subscriptions auto-delete after prolonged inactivity. */
export const PERSISTENT_EXPIRATION_TTL = '2678400s'; // 31 days

/** Only retain recent messages — older history is loaded from Orchestra. */
export const MESSAGE_RETENTION_DURATION = '600s'; // 10 minutes

interface PubSubEmulatorConfig {
  grpcEndpoint: string;
  restBaseUrl: string;
}

const LOCAL_PUBSUB_EMULATOR: PubSubEmulatorConfig = {
  grpcEndpoint: 'localhost:8085',
  restBaseUrl: 'http://localhost:8085/v1',
};

function usesLocalOrchestra(): boolean {
  const orchestraUrl = process.env.ORCHESTRA_URL || '';
  return orchestraUrl.includes('localhost') || orchestraUrl.includes('127.0.0.1');
}

function resolveCredentialsPath(raw: string): string {
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function parseCommsCredentials(raw: string): {
  credentials: Record<string, unknown>;
  projectId: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('COMMS_SERVICE_ACCOUNT_CREDENTIALS is empty.');
  }

  let credentials: Record<string, unknown>;
  if (trimmed.startsWith('{')) {
    try {
      credentials = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      throw new Error('COMMS_SERVICE_ACCOUNT_CREDENTIALS contains invalid JSON.');
    }
  } else {
    const credentialsPath = resolveCredentialsPath(trimmed);
    if (!fs.existsSync(credentialsPath)) {
      throw new Error(
        `COMMS_SERVICE_ACCOUNT_CREDENTIALS file not found: ${trimmed} (looked at ${credentialsPath})`
      );
    }
    try {
      const credentialsFile = fs.readFileSync(credentialsPath, 'utf8');
      credentials = JSON.parse(credentialsFile) as Record<string, unknown>;
    } catch {
      throw new Error(
        `COMMS_SERVICE_ACCOUNT_CREDENTIALS file is unreadable or not valid JSON: ${trimmed}`
      );
    }
  }

  const projectId = credentials.project_id;
  if (typeof projectId !== 'string' || !projectId) {
    throw new Error('Invalid Pub/Sub credentials format: missing project_id.');
  }

  return { credentials, projectId };
}

/** True only when cloud comms credentials are present and parse successfully. */
export function commsCredentialsConfigured(): boolean {
  const raw = process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS;
  if (!raw?.trim()) return false;
  try {
    parseCommsCredentials(raw);
    return true;
  } catch {
    return false;
  }
}

function resolvePubSubEmulatorConfig(): PubSubEmulatorConfig | null {
  const explicitHost = process.env.PUBSUB_EMULATOR_HOST?.trim();
  if (explicitHost) {
    const normalizedHost = explicitHost.replace(/\/+$/, '');
    const grpcEndpoint = normalizedHost.replace(/^https?:\/\//, '');
    const restBaseUrl = /^https?:\/\//i.test(normalizedHost)
      ? `${normalizedHost}/v1`
      : `http://${grpcEndpoint}/v1`;
    return { grpcEndpoint, restBaseUrl };
  }

  // Valid GCP comms credentials always win. Console often runs on localhost
  // while subscribing to staging/prod Pub/Sub topics.
  if (commsCredentialsConfigured()) {
    return null;
  }

  // Full local stack (local Orchestra) uses the Pub/Sub emulator when cloud
  // credentials are absent — matches local.sh / ci-test-setup behaviour.
  if (usesLocalOrchestra()) {
    return LOCAL_PUBSUB_EMULATOR;
  }

  return null;
}

/**
 * When the emulator host resolves, REST-based operations (ACK) should hit
 * local Pub/Sub instead of the production Google API endpoint.
 */
export function getPubSubApiBase(): string {
  const emulatorConfig = resolvePubSubEmulatorConfig();
  if (emulatorConfig) {
    return emulatorConfig.restBaseUrl;
  }
  return 'https://pubsub.googleapis.com/v1';
}

/** @deprecated Use getPubSubApiBase() for emulator support */
export const PUBSUB_API_BASE = 'https://pubsub.googleapis.com/v1';

function getCredentials(): { credentials: any; projectId: string } {
  const credentialsValue = process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS;
  if (!credentialsValue?.trim()) {
    throw new Error('COMMS_SERVICE_ACCOUNT_CREDENTIALS environment variable not set.');
  }

  const { credentials, projectId } = parseCommsCredentials(credentialsValue);
  return { credentials, projectId };
}

/**
 * Returns an authenticated HTTP client for REST-based Pub/Sub operations.
 *
 * In emulator mode, returns a plain fetch wrapper with no auth (the emulator
 * doesn't require credentials). The returned client exposes a `.request()`
 * method matching the GoogleAuth client interface.
 */
export async function getAuthClient(): Promise<{ client: any; projectId: string }> {
  const emulatorConfig = resolvePubSubEmulatorConfig();
  if (emulatorConfig) {
    const projectId = process.env.GCP_PROJECT_ID || 'local-test-project';
    const client = {
      async request(opts: { url: string; method: string; data?: any }) {
        const res = await fetch(opts.url, {
          method: opts.method,
          headers: { 'Content-Type': 'application/json' },
          body: opts.data ? JSON.stringify(opts.data) : undefined,
        });
        if (!res.ok) {
          const err: any = new Error(`Emulator request failed: ${res.status}`);
          err.response = { status: res.status };
          throw err;
        }
        return { data: await res.json().catch(() => ({})) };
      },
    };
    return { client, projectId };
  }

  const { credentials, projectId } = getCredentials();

  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/pubsub'],
    projectId,
  });

  return { client: await auth.getClient(), projectId };
}

let _pubsubClient: PubSub | null = null;

/**
 * Returns a singleton PubSub client for gRPC streaming operations.
 * Reuses the same client across connections to share gRPC channels.
 *
 * In emulator mode (@google-cloud/pubsub honors PUBSUB_EMULATOR_HOST
 * automatically), no real credentials are needed.
 */
export function getPubSubClient(): { pubsub: PubSub; projectId: string } {
  const emulatorConfig = resolvePubSubEmulatorConfig();
  if (emulatorConfig) {
    const projectId = process.env.GCP_PROJECT_ID || 'local-test-project';
    if (!_pubsubClient) {
      const pubsubOptions: { projectId: string; apiEndpoint?: string } = { projectId };
      // Keep the SDK and helper logic aligned on the same emulator endpoint.
      process.env.PUBSUB_EMULATOR_HOST = emulatorConfig.grpcEndpoint;
      pubsubOptions.apiEndpoint = emulatorConfig.grpcEndpoint;
      _pubsubClient = new PubSub(pubsubOptions);
    }
    return { pubsub: _pubsubClient, projectId };
  }

  const { credentials, projectId } = getCredentials();
  if (!_pubsubClient) {
    _pubsubClient = new PubSub({ projectId, credentials });
  }
  return { pubsub: _pubsubClient, projectId };
}

/**
 * Creates an ephemeral Pub/Sub subscription attached to an existing topic.
 * Returns the full subscription URL for use in pull/ack/delete calls.
 *
 * @param filter - Optional Pub/Sub filter expression (e.g.
 *   `attributes.thread = "unify_message_outbound"`) to restrict which
 *   messages the subscription receives from the shared topic.
 */
export async function createEphemeralSubscription(
  authClient: any,
  projectId: string,
  topicName: string,
  subscriptionName: string,
  filter?: string
): Promise<string> {
  const apiBase = getPubSubApiBase();
  const subscriptionUrl = `${apiBase}/projects/${projectId}/subscriptions/${subscriptionName}`;
  const topicPath = `projects/${projectId}/topics/${topicName}`;

  const data: Record<string, unknown> = {
    topic: topicPath,
    expirationPolicy: { ttl: EPHEMERAL_EXPIRATION_TTL },
    messageRetentionDuration: MESSAGE_RETENTION_DURATION,
  };
  if (filter) {
    data.filter = filter;
  }

  await authClient.request({
    url: subscriptionUrl,
    method: 'PUT',
    data,
  });

  return subscriptionUrl;
}

/**
 * Best-effort deletion of an ephemeral subscription.
 * Swallows errors — the expirationPolicy is the safety net.
 */
export async function deleteSubscription(authClient: any, subscriptionUrl: string): Promise<void> {
  try {
    await authClient.request({ url: subscriptionUrl, method: 'DELETE' });
  } catch {
    // Best-effort cleanup; the expirationPolicy is the safety net.
  }
}

/**
 * Gets or creates a persistent Pub/Sub subscription. If the subscription
 * already exists (HTTP 409), returns its URL without error. Used for
 * per-user+assistant chat subscriptions that survive across SSE reconnects.
 */
export async function getOrCreateSubscription(
  authClient: any,
  projectId: string,
  topicName: string,
  subscriptionName: string,
  filter?: string
): Promise<string> {
  const apiBase = getPubSubApiBase();
  const subscriptionUrl = `${apiBase}/projects/${projectId}/subscriptions/${subscriptionName}`;
  const topicPath = `projects/${projectId}/topics/${topicName}`;

  const data: Record<string, unknown> = {
    topic: topicPath,
    expirationPolicy: { ttl: PERSISTENT_EXPIRATION_TTL },
    messageRetentionDuration: MESSAGE_RETENTION_DURATION,
  };
  if (filter) {
    data.filter = filter;
  }

  try {
    await authClient.request({
      url: subscriptionUrl,
      method: 'PUT',
      data,
    });
  } catch (err: any) {
    const status = err?.response?.status ?? err?.status;
    if (status !== 409) throw err;
    // 409 = ALREADY_EXISTS — subscription is already provisioned, reuse it.
  }

  return subscriptionUrl;
}

/** Derives the Pub/Sub topic name for an assistant. */
export function getTopicName(assistantId: string): string {
  return `unity-${assistantId}${topicSuffix()}`;
}
