/**
 * Shared helpers for ephemeral per-connection Pub/Sub subscriptions.
 *
 * Both the actions stream and chat SSE routes create a unique subscription
 * per SSE connection, attached to the assistant's shared topic. This gives
 * true fan-out: every viewer independently receives all messages.
 * Subscriptions auto-expire after inactivity so leaked ones don't accumulate.
 */

import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';

/** Ephemeral subscriptions auto-delete after this much inactivity. */
export const SUBSCRIPTION_EXPIRATION_TTL = '86400s'; // 1 day

/** Only retain recent messages — older history is loaded from Orchestra. */
export const MESSAGE_RETENTION_DURATION = '600s'; // 10 minutes

export const PUBSUB_API_BASE = 'https://pubsub.googleapis.com/v1';

export async function getAuthClient(): Promise<{ client: any; projectId: string }> {
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

  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/pubsub'],
    projectId: credentials.project_id,
  });

  return { client: await auth.getClient(), projectId: credentials.project_id };
}

/**
 * Creates an ephemeral Pub/Sub subscription attached to an existing topic.
 * Returns the full subscription URL for use in pull/ack/delete calls.
 */
export async function createEphemeralSubscription(
  authClient: any,
  projectId: string,
  topicName: string,
  subscriptionName: string
): Promise<string> {
  const subscriptionUrl = `${PUBSUB_API_BASE}/projects/${projectId}/subscriptions/${subscriptionName}`;
  const topicPath = `projects/${projectId}/topics/${topicName}`;

  await authClient.request({
    url: subscriptionUrl,
    method: 'PUT',
    data: {
      topic: topicPath,
      expirationPolicy: { ttl: SUBSCRIPTION_EXPIRATION_TTL },
      messageRetentionDuration: MESSAGE_RETENTION_DURATION,
    },
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
 * Derives the Pub/Sub topic name for an assistant based on the assistant ID
 * and whether the environment is staging.
 */
export function getTopicName(assistantId: string): string {
  const orchestraUrl = process.env.ORCHESTRA_URL || '';
  const isStaging = orchestraUrl.includes('staging');
  return `unity-${assistantId}${isStaging ? '-staging' : ''}`;
}
