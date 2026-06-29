/**
 * SSE Endpoint for Billing Event Streaming
 *
 * Streams billing lifecycle events (credits_exhausted, credits_restored)
 * from the billing account's Pub/Sub topic to the browser via Server-Sent
 * Events. These account-level signals allow the console to react instantly
 * when credits run out or are replenished — without polling.
 *
 * Architecture:
 * - Each SSE connection creates its own ephemeral Pub/Sub subscription
 *   filtered for `attributes.thread = "billing_event"`.
 * - Subscriptions are deleted on disconnect with a 1-day expiry safety net.
 * - Every tab / org member gets an independent subscription (fan-out).
 * - In local dev (no COMMS_SERVICE_ACCOUNT_CREDENTIALS), falls back to the
 *   in-memory event bus keyed by billing account ID.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import type { Message } from '@google-cloud/pubsub';
import { getApiKeyFromRequest } from '@/app/api/_utils/auth';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';
import {
  getPubSubClient,
  EPHEMERAL_EXPIRATION_TTL,
  MESSAGE_RETENTION_DURATION,
} from '@/lib/pubsub/ephemeral-subscription';
import { hasCredentials, subscribe } from '@/lib/pubsub/local-event-bus';
import { createSseLifecycle } from '@/lib/pubsub/sse-lifecycle';
import { topicSuffix } from '@/lib/environment/comms-env';

export const dynamic = 'force-dynamic';

const __DEV__ = process.env.NODE_ENV === 'development';
const encoder = new TextEncoder();

const BILLING_EVENT_FILTER = 'attributes.thread = "billing_event"';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
  'Content-Encoding': 'none',
};

function getBillingTopicName(billingAccountId: number): string {
  return `billing-account-${billingAccountId}${topicSuffix()}`;
}

async function fetchBillingAccountId(apiKey: string): Promise<number | null> {
  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.get('/billing/account-info');
    return response.data?.billingAccountId ?? null;
  } catch {
    return null;
  }
}

// =============================================================================
// Local Development Mode
// =============================================================================

function createLocalStream(request: NextRequest, billingAccountId: number): Response {
  if (__DEV__)
    console.log(`[BillingEvents SSE] Local mode for billing_account=${billingAccountId}`);

  const busKey = `billing-${billingAccountId}`;
  const { lifecycle, cancel } = createSseLifecycle(request);

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(': connected\n\n'));

      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          lifecycle.close();
        }
      }, 15000);
      lifecycle.add(() => clearInterval(keepAliveInterval));

      const unsubscribe = subscribe(busKey, (rawEvent) => {
        if (lifecycle.closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(rawEvent)}\n\n`));
        } catch {
          /* stream closed */
        }
      });
      lifecycle.add(unsubscribe);
      lifecycle.add(() => {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      cancel();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

// =============================================================================
// Production Mode (GCP Pub/Sub)
// =============================================================================

function createPubSubStream(
  request: NextRequest,
  billingAccountId: number,
  subscriptionName: string,
  deleteOnClose: () => void
): Response {
  const { lifecycle, cancel } = createSseLifecycle(request);

  const stream = new ReadableStream({
    start(controller) {
      if (__DEV__)
        console.log(`[BillingEvents SSE] Stream started for billing_account=${billingAccountId}`);

      controller.enqueue(encoder.encode(': connected\n\n'));

      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          lifecycle.close();
        }
      }, 15000);
      lifecycle.add(() => clearInterval(keepAliveInterval));

      const { pubsub } = getPubSubClient();
      const subscription = pubsub.subscription(subscriptionName);

      const messageHandler = (message: Message) => {
        if (request.signal.aborted) {
          message.nack();
          return;
        }

        try {
          const rawData = message.data.toString('utf-8');
          let payload: Record<string, unknown> = {};
          try {
            payload = JSON.parse(rawData);
          } catch {
            payload = { rawContent: rawData };
          }

          payload.id = message.id;
          payload.publishTime = message.publishTime?.toISOString();

          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          } catch {
            message.nack();
            return;
          }

          message.ack();
        } catch (err) {
          console.error('[BillingEvents SSE] Error processing message:', err);
          message.ack();
        }
      };

      const errorHandler = (err: Error) => {
        if (!request.signal.aborted) {
          console.error('[BillingEvents SSE] Subscriber error:', err.message);
        }
      };

      subscription.on('message', messageHandler);
      subscription.on('error', errorHandler);

      lifecycle.add(() => {
        subscription.removeListener('message', messageHandler);
        subscription.removeListener('error', errorHandler);
        subscription.close();
        deleteOnClose();
        if (__DEV__)
          console.log(`[BillingEvents SSE] Stream ended for billing_account=${billingAccountId}`);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      cancel();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

// =============================================================================
// Route Handler
// =============================================================================

export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const billingAccountId = await fetchBillingAccountId(apiKey);
  if (!billingAccountId) {
    return new NextResponse(JSON.stringify({ detail: 'Billing account not found.' }), {
      status: 404,
    });
  }

  if (!hasCredentials()) {
    return createLocalStream(request, billingAccountId);
  }

  let subscriptionName: string;

  try {
    const { pubsub } = getPubSubClient();
    const connectionId = crypto.randomUUID().slice(0, 8);
    const topicName = getBillingTopicName(billingAccountId);
    subscriptionName = `${topicName}-sse-${connectionId}`;

    const topic = pubsub.topic(topicName);
    await topic.createSubscription(subscriptionName, {
      filter: BILLING_EVENT_FILTER,
      expirationPolicy: {
        ttl: { seconds: parseInt(EPHEMERAL_EXPIRATION_TTL) },
      },
      messageRetentionDuration: {
        seconds: parseInt(MESSAGE_RETENTION_DURATION),
      },
    });

    if (__DEV__)
      console.log(
        `[BillingEvents SSE] Ephemeral subscription: ${subscriptionName} on topic: ${topicName}`
      );
  } catch (error: any) {
    if (error.code === 5) {
      if (__DEV__)
        console.log(
          `[BillingEvents SSE] Topic not found for billing_account=${billingAccountId} — skipping`
        );
      return new NextResponse(JSON.stringify({ detail: 'Billing topic not found.' }), {
        status: 404,
      });
    }
    console.error('[BillingEvents SSE] Setup error:', error.message);
    return new NextResponse(JSON.stringify({ detail: 'Server configuration error.' }), {
      status: 500,
    });
  }

  const deleteOnClose = () => {
    const { pubsub } = getPubSubClient();
    pubsub
      .subscription(subscriptionName)
      .delete()
      .catch(() => {});
  };

  return createPubSubStream(request, billingAccountId, subscriptionName, deleteOnClose);
}
