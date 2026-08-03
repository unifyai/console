/**
 * SSE Endpoint for System Error Streaming
 *
 * Streams system error events from the assistant's Pub/Sub topic to the
 * browser via Server-Sent Events. These are assistant-level health signals
 * (OOM, startup failure, unhandled exceptions) that should be shown to the
 * user regardless of which interaction surface (chat, call, screen share)
 * they're currently using.
 *
 * Architecture:
 * - Each SSE connection creates its own ephemeral Pub/Sub subscription
 *   filtered for `attributes.thread = "system_error"`.
 * - Subscriptions are deleted on disconnect with a 1-day expiry safety net.
 * - Server-side ACK: errors are best-effort, no client ACK needed.
 * - When neither COMMS_SERVICE_ACCOUNT_CREDENTIALS nor PUBSUB_EMULATOR_HOST
 *   is set, falls back to the
 *   in-memory event bus so the companion push endpoint can simulate errors.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import type { Message } from '@google-cloud/pubsub';
import {
  getPubSubClient,
  getTopicName,
  EPHEMERAL_EXPIRATION_TTL,
  MESSAGE_RETENTION_DURATION,
} from '@/lib/pubsub/ephemeral-subscription';
import { localEventBusEnabled, subscribe } from '@/lib/pubsub/local-event-bus';
import { createSseLifecycle } from '@/lib/pubsub/sse-lifecycle';
import { authorizeAssistantStream } from '@/lib/assistants/assistantStreamAccess';

export const dynamic = 'force-dynamic';

const __DEV__ = process.env.NODE_ENV === 'development';
const encoder = new TextEncoder();

const SYSTEM_ERROR_FILTER = 'attributes.thread = "system_error"';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
  'Content-Encoding': 'none',
};

// =============================================================================
// Local Development Mode
// =============================================================================

function createLocalStream(request: NextRequest, assistantId: string): Response {
  if (__DEV__)
    console.log(
      `[SystemErrors SSE] Local mode for assistant=${assistantId} (no Pub/Sub credentials)`
    );

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

      const unsubscribe = subscribe(assistantId, (rawEvent) => {
        if (lifecycle.closed) return;
        if ((rawEvent as Record<string, unknown>).thread !== 'system_error') return;
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
  assistantId: string,
  subscriptionName: string,
  deleteOnClose: () => void
): Response {
  const { lifecycle, cancel } = createSseLifecycle(request);

  const stream = new ReadableStream({
    start(controller) {
      if (__DEV__) console.log(`[SystemErrors SSE] Stream started for assistant=${assistantId}`);

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
          console.error('[SystemErrors SSE] Error processing message:', err);
          message.ack();
        }
      };

      const errorHandler = (err: Error) => {
        if (!request.signal.aborted) {
          console.error('[SystemErrors SSE] Subscriber error:', err.message);
        }
      };

      subscription.on('message', messageHandler);
      subscription.on('error', errorHandler);

      lifecycle.add(() => {
        subscription.removeListener('message', messageHandler);
        subscription.removeListener('error', errorHandler);
        subscription.close();
        deleteOnClose();
        if (__DEV__) console.log(`[SystemErrors SSE] Stream ended for assistant=${assistantId}`);
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assistantId: string }> }
) {
  const { assistantId } = await params;

  if (!assistantId) {
    return new NextResponse('Assistant ID is required.', { status: 400 });
  }

  // Before either backend. Health signals name the assistant and carry its failure
  // detail, and this route reads its Pub/Sub topic with the platform's own
  // credentials, so the caller's right to it has to be established here.
  const access = await authorizeAssistantStream(request, assistantId);
  if (!access.ok) {
    return access.response;
  }

  // In development, always use the local event bus so the push endpoint
  // and DevPanel triggers work regardless of whether credentials are present.
  if (localEventBusEnabled()) {
    return createLocalStream(request, assistantId);
  }

  let subscriptionName: string;

  try {
    const { pubsub } = getPubSubClient();
    const connectionId = crypto.randomUUID().slice(0, 8);
    const topicName = getTopicName(assistantId);
    subscriptionName = `${topicName}-syserr-${connectionId}`;

    const topic = pubsub.topic(topicName);
    await topic.createSubscription(subscriptionName, {
      filter: SYSTEM_ERROR_FILTER,
      expirationPolicy: { ttl: { seconds: parseInt(EPHEMERAL_EXPIRATION_TTL) } },
      messageRetentionDuration: { seconds: parseInt(MESSAGE_RETENTION_DURATION) },
    });

    if (__DEV__)
      console.log(
        `[SystemErrors SSE] Ephemeral subscription: ${subscriptionName} on topic: ${topicName}`
      );
  } catch (error: any) {
    // 5 = NOT_FOUND — the assistant's Pub/Sub topic doesn't exist yet.
    // This happens for assistants created before system error propagation
    // was set up. Return 404 so the hook stops retrying.
    if (error.code === 5) {
      if (__DEV__)
        console.log(`[SystemErrors SSE] Topic not found for assistant=${assistantId} — skipping`);
      return new NextResponse(JSON.stringify({ detail: 'Assistant topic not found.' }), {
        status: 404,
      });
    }
    console.error('[SystemErrors SSE] Setup error:', error.message);
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

  return createPubSubStream(request, assistantId, subscriptionName, deleteOnClose);
}
