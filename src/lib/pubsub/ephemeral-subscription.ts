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

/** Ephemeral subscriptions auto-delete after this much inactivity. */
export const EPHEMERAL_EXPIRATION_TTL = '86400s'; // 1 day

/** Persistent subscriptions auto-delete after prolonged inactivity. */
export const PERSISTENT_EXPIRATION_TTL = '2678400s'; // 31 days

/** Only retain recent messages — older history is loaded from Orchestra. */
export const MESSAGE_RETENTION_DURATION = '600s'; // 10 minutes

export const PUBSUB_API_BASE = 'https://pubsub.googleapis.com/v1';

function getCredentials(): { credentials: any; projectId: string } {
  const credentialsValue = process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS;
  if (!credentialsValue) {
    throw new Error('COMMS_SERVICE_ACCOUNT_CREDENTIALS environment variable not set.');
  }

  let credentials;
  try {
    credentials = JSON.parse(credentialsValue);
  } catch {
    try {
      const credentialsFile = fs.readFileSync(credentialsValue, 'utf8');
      credentials = JSON.parse(credentialsFile);
    } catch {
      throw new Error('Invalid Pub/Sub credentials.');
    }
  }

  if (!credentials?.project_id) {
    throw new Error('Invalid Pub/Sub credentials format.');
  }

  return { credentials, projectId: credentials.project_id };
}

export async function getAuthClient(): Promise<{ client: any; projectId: string }> {
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
 */
export function getPubSubClient(): { pubsub: PubSub; projectId: string } {
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
  const subscriptionUrl = `${PUBSUB_API_BASE}/projects/${projectId}/subscriptions/${subscriptionName}`;
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
  const subscriptionUrl = `${PUBSUB_API_BASE}/projects/${projectId}/subscriptions/${subscriptionName}`;
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

/**
 * Derives the Pub/Sub topic name for an assistant based on the assistant ID
 * and whether the environment is staging.
 */
export function getTopicName(assistantId: string): string {
  const orchestraUrl = process.env.ORCHESTRA_URL || '';
  const isStaging = orchestraUrl.includes('staging') || orchestraUrl.includes('localhost') || orchestraUrl.includes('127.0.0.1');
  return `unity-${assistantId}${isStaging ? '-staging' : ''}`;
}
