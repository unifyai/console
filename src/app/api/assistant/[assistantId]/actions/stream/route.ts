/**
 * SSE Endpoint for Live Actions Streaming
 *
 * Streams ManagerMethod and ToolLoop events from the assistant's Pub/Sub topic
 * to the browser via Server-Sent Events.
 *
 * Architecture:
 * - Each SSE connection creates its own ephemeral Pub/Sub subscription on the
 *   shared topic. This gives true fan-out: every viewer (across tabs, browsers,
 *   and users) independently receives all events. Subscriptions auto-expire
 *   after inactivity so leaked ones don't accumulate.
 * - Per-connection pull loop inside `async start` (industry-standard SSE pattern)
 * - Server-side ACK (Orchestra is the durable store; client polls on catch-up)
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
import { snakeToCamelObject } from '@/utils/casing';
import {
  getAuthClient,
  createEphemeralSubscription,
  deleteSubscription,
  getTopicName,
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
// Production Mode (GCP Pub/Sub ephemeral subscriptions)
// =============================================================================

function createPubSubStream(
  request: NextRequest,
  assistantId: string,
  authClient: any,
  subscriptionUrl: string
): Response {
  const stream = new ReadableStream({
    async start(controller) {
      if (__DEV__) console.log(`[DEBUG][Actions SSE] Stream started for assistant=${assistantId}`);

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

      // --- MAIN PULL LOOP ---
      while (!request.signal.aborted) {
        try {
          const res = await authClient.request({
            url: `${subscriptionUrl}:pull`,
            method: 'POST',
            data: { maxMessages: 10, returnImmediately: true },
          });

          if (request.signal.aborted) break;

          if (res.status !== 200) {
            if (res.status === 404) {
              console.error(`[Actions SSE] Subscription not found: ${subscriptionUrl}`);
              break;
            }
            console.warn(`[Actions SSE] Pull returned status=${res.status}, retrying in 2s`);
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }

          const responseData = res.data as {
            receivedMessages?: Array<{
              ackId: string;
              message?: { data: string; messageId: string; publishTime: string };
            }>;
          };
          const receivedMessages = responseData.receivedMessages || [];

          if (receivedMessages.length === 0) {
            await new Promise((r) => setTimeout(r, 200));
            continue;
          }

          if (__DEV__)
            console.log(
              `[DEBUG][Actions SSE] Pulled ${receivedMessages.length} message(s) for assistant=${assistantId}`
            );

          const ackIds: string[] = [];

          const parsed: Array<{
            shaped: ReturnType<typeof reshapeToLogEntry>;
            ackId: string;
          }> = [];

          for (const item of receivedMessages) {
            const { ackId, message } = item;
            if (!message) continue;

            ackIds.push(ackId);

            try {
              const rawData = Buffer.from(message.data, 'base64').toString('utf-8');
              const payload = JSON.parse(rawData);
              const eventPayload = payload.event || payload;
              const camelEvent = snakeToCamelObject<Record<string, unknown>>(eventPayload);
              const shaped = reshapeToLogEntry(camelEvent);

              if (isManagerExcluded(shaped.data.entries.manager as string)) {
                if (__DEV__)
                  console.log(
                    `[DEBUG][Actions SSE] Dropping excluded manager=${shaped.data.entries.manager}`
                  );
                continue;
              }

              parsed.push({ shaped, ackId });
            } catch (err) {
              console.warn('[Actions SSE] Failed to process message:', err);
            }
          }

          parsed.sort((a, b) => a.shaped.data.id - b.shaped.data.id);

          for (const { shaped } of parsed) {
            if (__DEV__)
              console.log(
                `[DEBUG][Actions SSE] Event: type=${shaped.type}, id=${shaped.data.id}, callingId=${shaped.data.entries.callingId}, phase=${shaped.data.entries.phase}`
              );

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(shaped)}\n\n`));
          }

          if (ackIds.length > 0) {
            try {
              await authClient.request({
                url: `${subscriptionUrl}:acknowledge`,
                method: 'POST',
                data: { ackIds },
              });
            } catch (err) {
              console.warn('[Actions SSE] Failed to ACK messages:', err);
            }
          }
        } catch (error: any) {
          if (!request.signal.aborted) {
            console.error('[Actions SSE] Pull loop error:', error.message);
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }

      clearInterval(keepAliveInterval);
      deleteSubscription(authClient, subscriptionUrl);
      if (__DEV__) console.log(`[DEBUG][Actions SSE] Stream ended for assistant=${assistantId}`);
      try {
        controller.close();
      } catch {
        // Already closed
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

// =============================================================================
// Route Handler
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: { assistantId: string } }) {
  const { assistantId } = params;

  if (__DEV__) console.log(`[DEBUG][Actions SSE] GET request for assistantId=${assistantId}`);

  if (!assistantId) {
    return new NextResponse('Assistant ID is required.', { status: 400 });
  }

  // ── Local development: no Pub/Sub credentials → in-memory event bus ──
  if (!hasCredentials()) {
    return createLocalStream(request, assistantId);
  }

  // ── Production / staging: GCP Pub/Sub ephemeral subscriptions ──
  let authClient: any;
  let subscriptionUrl: string;

  try {
    const authData = await getAuthClient();
    authClient = authData.client;

    const connectionId = crypto.randomUUID().slice(0, 8);
    const topicName = getTopicName(assistantId);
    const subscriptionName = `${topicName}-actions-sse-${connectionId}`;

    subscriptionUrl = await createEphemeralSubscription(
      authClient,
      authData.projectId,
      topicName,
      subscriptionName
    );

    if (__DEV__)
      console.log(
        `[DEBUG][Actions SSE] Auth OK. Ephemeral subscription: ${subscriptionName} on topic: ${topicName}`
      );
  } catch (error: any) {
    console.error('[Actions SSE] Setup error:', error.message);
    return new NextResponse(JSON.stringify({ detail: 'Server configuration error.' }), {
      status: 500,
    });
  }

  request.signal.addEventListener('abort', () => {
    deleteSubscription(authClient, subscriptionUrl);
  });

  return createPubSubStream(request, assistantId, authClient, subscriptionUrl);
}
