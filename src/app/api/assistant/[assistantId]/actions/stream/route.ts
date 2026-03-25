/**
 * SSE Endpoint for Live Actions Streaming
 *
 * Streams ManagerMethod and ToolLoop events from the assistant's Pub/Sub topic
 * to the browser via Server-Sent Events, using gRPC streaming pull.
 *
 * Architecture:
 * - Each SSE connection creates its own ephemeral Pub/Sub subscription on the
 *   shared topic. This gives true fan-out: every viewer (across tabs, browsers,
 *   and users) independently receives all events. Subscriptions auto-expire
 *   after inactivity so leaked ones don't accumulate.
 * - gRPC streaming pull delivers messages via event callbacks with sub-second
 *   latency. Server-side ACK (Orchestra is the durable store; client polls on
 *   catch-up).
 * - snake_case → camelCase transformation via shared casing utilities
 * - Reshapes flat Pub/Sub payload into { id, ts, entries } to match ManagerMethodLog
 *
 * Local development mode:
 * - When COMMS_SERVICE_ACCOUNT_CREDENTIALS is absent, falls back to an
 *   in-memory event bus. Events are pushed via the companion POST endpoint
 *   at /api/assistant/[assistantId]/actions/push (already pre-shaped).
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import type { Message } from '@google-cloud/pubsub';
import { snakeToCamelObject } from '@/utils/casing';
import {
  getPubSubClient,
  getTopicName,
  EPHEMERAL_EXPIRATION_TTL,
  MESSAGE_RETENTION_DURATION,
} from '@/lib/pubsub/ephemeral-subscription';
import { isManagerExcluded } from '@/lib/assistants/event-filters';
import { hasCredentials, subscribe } from '@/lib/pubsub/local-event-bus';

export const dynamic = 'force-dynamic';

const __DEV__ = process.env.NODE_ENV === 'development';

// =============================================================================
// Pub/Sub Payload → Frontend Log Shape
// =============================================================================

const encoder = new TextEncoder();

/**
 * Reshapes a camelCased Pub/Sub event payload into the { id, ts, entries }
 * shape that ManagerMethodLog / ToolLoopLog types expect, so the existing
 * buildActionTree / mergeNewEvents functions work unchanged.
 */
function reshapeToLogEntry(camelEvent: Record<string, unknown>): {
  type: string;
  data: { id: number; ts: string; entries: Record<string, unknown> };
} {
  const type = (camelEvent.type as string) || 'ManagerMethod';

  return {
    type,
    data: {
      id: (camelEvent.rowId as number) ?? 0,
      ts: (camelEvent.eventTimestamp as string) || new Date().toISOString(),
      entries: {
        callingId: camelEvent.callingId,
        eventId: camelEvent.eventId,
        manager: camelEvent.manager,
        method: camelEvent.method,
        phase: camelEvent.phase,
        hierarchy: camelEvent.hierarchy,
        hierarchyLabel: camelEvent.hierarchyLabel,
        displayLabel: camelEvent.displayLabel,
        status: camelEvent.status,
        question: camelEvent.question,
        instructions: camelEvent.instructions,
        request: camelEvent.request,
        answer: camelEvent.answer,
        action: camelEvent.action,
        error: camelEvent.error,
        errorType: camelEvent.errorType,
        traceback: camelEvent.traceback,
        kind: camelEvent.kind ?? null,
        message: camelEvent.message,
        toolAliases: camelEvent.toolAliases ?? null,
        persist: camelEvent.persist ?? null,
      },
    },
  };
}

// =============================================================================
// SSE Response Helpers
// =============================================================================

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

// =============================================================================
// Local Development Mode (in-memory event bus, no GCP dependency)
// =============================================================================

function createLocalStream(request: NextRequest, assistantId: string): Response {
  if (__DEV__)
    console.log(`[Actions SSE] Local mode for assistant=${assistantId} (no Pub/Sub credentials)`);

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(': connected\n\n'));

      const keepAliveInterval = setInterval(() => {
        if (request.signal.aborted) {
          clearInterval(keepAliveInterval);
          return;
        }
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          clearInterval(keepAliveInterval);
        }
      }, 15000);

      const unsubscribe = subscribe(assistantId, (rawEvent) => {
        if (request.signal.aborted) return;
        try {
          const event = snakeToCamelObject<Record<string, unknown>>(rawEvent);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream closed
        }
      });

      request.signal.addEventListener('abort', () => {
        clearInterval(keepAliveInterval);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

// =============================================================================
// Production Mode (GCP Pub/Sub gRPC streaming pull)
// =============================================================================

function createPubSubStream(
  request: NextRequest,
  assistantId: string,
  subscriptionName: string,
  deleteOnClose: () => void
): Response {
  const stream = new ReadableStream({
    start(controller) {
      if (__DEV__) console.log(`[Actions SSE] Stream started for assistant=${assistantId}`);

      controller.enqueue(encoder.encode(': connected\n\n'));

      const keepAliveInterval = setInterval(() => {
        if (request.signal.aborted) {
          clearInterval(keepAliveInterval);
          return;
        }
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          clearInterval(keepAliveInterval);
        }
      }, 15000);

      const { pubsub } = getPubSubClient();
      const subscription = pubsub.subscription(subscriptionName);

      const messageHandler = (message: Message) => {
        if (request.signal.aborted) {
          message.nack();
          return;
        }

        try {
          const rawData = message.data.toString('utf-8');
          const payload = JSON.parse(rawData);

          // System error messages are handled by the dedicated system-errors
          // SSE stream — skip them here to avoid ghost action tree nodes.
          if (payload.thread === 'system_error') {
            message.ack();
            return;
          }

          const eventPayload = payload.event || payload;
          const camelEvent = snakeToCamelObject<Record<string, unknown>>(eventPayload);
          const shaped = reshapeToLogEntry(camelEvent);

          if (isManagerExcluded(shaped.data.entries.manager as string)) {
            message.ack();
            return;
          }

          if (__DEV__)
            console.log(
              `[Actions SSE] Event: type=${shaped.type}, id=${shaped.data.id}, manager=${shaped.data.entries.manager}`
            );

          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(shaped)}\n\n`));
          } catch {
            message.nack();
            return;
          }

          message.ack();
        } catch (err) {
          console.warn('[Actions SSE] Failed to process message:', err);
          message.ack();
        }
      };

      const errorHandler = (err: Error) => {
        if (!request.signal.aborted) {
          console.error('[Actions SSE] Subscriber error:', err.message);
        }
      };

      subscription.on('message', messageHandler);
      subscription.on('error', errorHandler);

      request.signal.addEventListener('abort', () => {
        clearInterval(keepAliveInterval);
        subscription.removeListener('message', messageHandler);
        subscription.removeListener('error', errorHandler);
        subscription.close();
        deleteOnClose();
        if (__DEV__) console.log(`[Actions SSE] Stream ended for assistant=${assistantId}`);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

// =============================================================================
// Route Handler
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: { assistantId: string } }) {
  const { assistantId } = params;

  if (__DEV__) console.log(`[Actions SSE] GET request for assistantId=${assistantId}`);

  if (!assistantId) {
    return new NextResponse('Assistant ID is required.', { status: 400 });
  }

  // ── Local development: no Pub/Sub credentials → in-memory event bus ──
  if (!hasCredentials()) {
    return createLocalStream(request, assistantId);
  }

  // ── Production / staging: GCP Pub/Sub gRPC streaming pull ──
  let subscriptionName: string;

  try {
    const { pubsub } = getPubSubClient();
    const connectionId = crypto.randomUUID().slice(0, 8);
    const topicName = getTopicName(assistantId);
    subscriptionName = `${topicName}-actions-sse-${connectionId}`;

    const topic = pubsub.topic(topicName);
    await topic.createSubscription(subscriptionName, {
      expirationPolicy: { ttl: { seconds: parseInt(EPHEMERAL_EXPIRATION_TTL) } },
      messageRetentionDuration: { seconds: parseInt(MESSAGE_RETENTION_DURATION) },
    });

    if (__DEV__)
      console.log(
        `[Actions SSE] Ephemeral subscription: ${subscriptionName} on topic: ${topicName}`
      );
  } catch (error: any) {
    console.error('[Actions SSE] Setup error:', error.message);
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

  request.signal.addEventListener('abort', () => {
    deleteOnClose();
  });

  return createPubSubStream(request, assistantId, subscriptionName, deleteOnClose);
}
