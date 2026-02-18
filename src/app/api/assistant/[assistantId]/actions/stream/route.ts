/**
 * SSE Endpoint for Live Actions Streaming
 *
 * Streams ManagerMethod and ToolLoop events from the assistant's
 * `*-actions-sub` Pub/Sub subscription to the browser via Server-Sent Events.
 *
 * Key design decisions:
 * - Server-side ACK (no client-side ack needed — Orchestra is the durable store)
 * - In-process BroadcastManager fans out a single Pub/Sub pull loop to N SSE clients
 * - snake_case → camelCase transformation via shared casing utilities
 * - Reshapes flat Pub/Sub payload into { id, ts, entries } to match ManagerMethodLog / ToolLoopLog
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';
import { snakeToCamelObject } from '@/utils/casing';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// =============================================================================
// Auth (same pattern as existing chat SSE)
// =============================================================================

async function getAuthClient() {
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

// =============================================================================
// Pub/Sub Payload → Frontend Log Shape
// =============================================================================

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
        answer: camelEvent.answer,
        error: camelEvent.error,
        errorType: camelEvent.errorType,
        traceback: camelEvent.traceback,
        // ToolLoop-specific fields
        message: camelEvent.message,
      },
    },
  };
}

// =============================================================================
// BroadcastManager — server-side fan-out singleton
// =============================================================================

interface BroadcastGroup {
  controllers: Set<ReadableStreamDefaultController>;
  pullAbort: AbortController;
  refCount: number;
}

const broadcastGroups = new Map<string, BroadcastGroup>();

/**
 * Starts a Pub/Sub pull loop for the given assistant. Pulled messages are
 * ACKed immediately server-side and broadcast to all registered SSE controllers.
 */
function startPullLoop(
  assistantId: string,
  subscriptionUrl: string,
  authClient: any,
  group: BroadcastGroup
) {
  const { signal } = group.pullAbort;

  const loop = async () => {
    // TODO: Remove debug logging
    console.log(
      `[DEBUG][Actions SSE] Pull loop STARTED for assistant=${assistantId}, refCount=${group.refCount}`
    );

    while (!signal.aborted && group.refCount > 0) {
      try {
        const res = await authClient.request({
          url: `${subscriptionUrl}:pull`,
          method: 'POST',
          data: { maxMessages: 10, returnImmediately: false },
        });

        if (signal.aborted) break;

        if (res.status !== 200) {
          if (res.status === 404) {
            console.error(`[Actions SSE] Subscription not found: ${subscriptionUrl}`);
            // TODO: Remove debug logging
            console.error(
              `[DEBUG][Actions SSE] 404 — subscription does not exist yet (needs Orchestra provisioning)`
            );
            break;
          }
          // TODO: Remove debug logging
          console.warn(`[DEBUG][Actions SSE] Pull returned status=${res.status}, retrying in 2s`);
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

        // TODO: Remove debug logging
        if (receivedMessages.length > 0) {
          console.log(
            `[DEBUG][Actions SSE] Pulled ${receivedMessages.length} message(s) for assistant=${assistantId}`
          );
        }

        if (receivedMessages.length === 0) continue;

        // Collect ackIds for batch ACK
        const ackIds: string[] = [];

        for (const item of receivedMessages) {
          const { ackId, message } = item;
          if (!message) continue;

          ackIds.push(ackId);

          try {
            const rawData = Buffer.from(message.data, 'base64').toString('utf-8');
            const payload = JSON.parse(rawData);

            // TODO: Remove debug logging
            console.log(
              `[DEBUG][Actions SSE] Raw Pub/Sub payload:`,
              JSON.stringify(payload).slice(0, 500)
            );

            // The Pub/Sub message has { thread, event: { ...snake_case fields } }
            const eventPayload = payload.event || payload;

            // Transform snake_case → camelCase using shared utility
            const camelEvent = snakeToCamelObject<Record<string, unknown>>(eventPayload);

            // TODO: Remove debug logging
            console.log(
              `[DEBUG][Actions SSE] camelCase event: type=${camelEvent.type}, manager=${camelEvent.manager}, method=${camelEvent.method}, phase=${camelEvent.phase}, callingId=${camelEvent.callingId}`
            );

            // Reshape into { type, data: { id, ts, entries } } for the frontend
            const shaped = reshapeToLogEntry(camelEvent);

            // TODO: Remove debug logging
            console.log(
              `[DEBUG][Actions SSE] Shaped frame: type=${shaped.type}, id=${shaped.data.id}, ts=${shaped.data.ts}, label=${shaped.data.entries.displayLabel || shaped.data.entries.manager}`
            );

            // Broadcast to all connected SSE controllers
            const frame = `data: ${JSON.stringify(shaped)}\n\n`;
            // TODO: Remove debug logging
            console.log(
              `[DEBUG][Actions SSE] Broadcasting to ${group.controllers.size} controller(s)`
            );
            for (const controller of Array.from(group.controllers)) {
              try {
                controller.enqueue(frame);
              } catch {
                // Controller may have been closed — clean up happens on disconnect
              }
            }
          } catch (err) {
            console.warn('[Actions SSE] Failed to process message:', err);
          }
        }

        // Server-side ACK — batch acknowledge all pulled messages
        if (ackIds.length > 0) {
          try {
            await authClient.request({
              url: `${subscriptionUrl}:acknowledge`,
              method: 'POST',
              data: { ackIds },
            });
            // TODO: Remove debug logging
            console.log(`[DEBUG][Actions SSE] ACKed ${ackIds.length} message(s)`);
          } catch (err) {
            console.warn('[Actions SSE] Failed to ACK messages:', err);
          }
        }
      } catch (error: any) {
        if (!signal.aborted) {
          console.error('[Actions SSE] Pull loop error:', error.message);
          // TODO: Remove debug logging
          console.error(`[DEBUG][Actions SSE] Pull loop error detail:`, error);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    // TODO: Remove debug logging
    console.log(`[DEBUG][Actions SSE] Pull loop ENDED for assistant=${assistantId}`);

    // Cleanup when loop ends
    broadcastGroups.delete(assistantId);
  };

  loop();
}

/**
 * Registers a new SSE controller for an assistant. Creates a BroadcastGroup
 * with a Pub/Sub pull loop on first connection, joins an existing group for
 * subsequent connections.
 */
function joinBroadcastGroup(
  assistantId: string,
  subscriptionUrl: string,
  authClient: any,
  controller: ReadableStreamDefaultController
) {
  let group = broadcastGroups.get(assistantId);

  const isNew = !group;

  if (!group) {
    // TODO: Remove debug logging
    console.log(`[DEBUG][Actions SSE] Creating NEW broadcast group for assistant=${assistantId}`);
    group = {
      controllers: new Set(),
      pullAbort: new AbortController(),
      refCount: 0,
    };
    broadcastGroups.set(assistantId, group);
  } else {
    // TODO: Remove debug logging
    console.log(
      `[DEBUG][Actions SSE] Joining EXISTING broadcast group for assistant=${assistantId}, current refCount=${group.refCount}`
    );
  }

  // Register controller and increment refCount BEFORE starting pull loop
  // so the loop's while(refCount > 0) condition is satisfied
  group.controllers.add(controller);
  group.refCount++;

  // TODO: Remove debug logging
  console.log(
    `[DEBUG][Actions SSE] Group refCount now=${group.refCount} for assistant=${assistantId}`
  );

  // Start pull loop after refCount is incremented (only for new groups)
  if (isNew) {
    startPullLoop(assistantId, subscriptionUrl, authClient, group);
  }

  return group;
}

/**
 * Deregisters an SSE controller. Cleans up the BroadcastGroup when the last
 * connection for an assistant closes.
 */
function leaveBroadcastGroup(assistantId: string, controller: ReadableStreamDefaultController) {
  const group = broadcastGroups.get(assistantId);
  if (!group) return;

  group.controllers.delete(controller);
  group.refCount--;

  // TODO: Remove debug logging
  console.log(
    `[DEBUG][Actions SSE] Client disconnected. refCount now=${group.refCount} for assistant=${assistantId}`
  );

  if (group.refCount <= 0) {
    // TODO: Remove debug logging
    console.log(
      `[DEBUG][Actions SSE] Last client left — aborting pull loop for assistant=${assistantId}`
    );
    group.pullAbort.abort();
    broadcastGroups.delete(assistantId);
  }
}

// =============================================================================
// Route Handler
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: { assistantId: string } }) {
  const { assistantId } = params;

  // TODO: Remove debug logging
  console.log(`[DEBUG][Actions SSE] GET request for assistantId=${assistantId}`);

  if (!assistantId) {
    return new NextResponse('Assistant ID is required.', { status: 400 });
  }

  let authClient: any;
  let subscriptionUrl: string;

  try {
    const authData = await getAuthClient();
    authClient = authData.client;

    const orchestraUrl = process.env.ORCHESTRA_URL || '';
    const isStaging = orchestraUrl.includes('staging');
    const subscriptionName = `unity-${assistantId}${isStaging ? '-staging' : ''}-actions-sub`;

    subscriptionUrl = `https://pubsub.googleapis.com/v1/projects/${authData.projectId}/subscriptions/${subscriptionName}`;

    // TODO: Remove debug logging
    console.log(`[DEBUG][Actions SSE] Auth OK. Subscription: ${subscriptionName}`);
    console.log(`[DEBUG][Actions SSE] Full URL: ${subscriptionUrl}`);
  } catch (error: any) {
    // TODO: Remove debug logging
    console.error(`[DEBUG][Actions SSE] Auth FAILED:`, error.message);
    console.error('[Actions SSE] Setup error:', error);
    return new NextResponse(JSON.stringify({ detail: 'Server configuration error.' }), {
      status: 500,
    });
  }

  const capturedAuthClient = authClient;
  const capturedSubscriptionUrl = subscriptionUrl;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection comment
      try {
        controller.enqueue(': connected\n\n');
      } catch {
        // Controller may already be closed
      }

      // Keep-alive to prevent load balancer timeouts
      const keepAliveInterval = setInterval(() => {
        if (request.signal.aborted) {
          clearInterval(keepAliveInterval);
          return;
        }
        try {
          controller.enqueue(': keep-alive\n\n');
        } catch {
          clearInterval(keepAliveInterval);
        }
      }, 15000);

      // Join the broadcast group (starts pull loop if first connection)
      joinBroadcastGroup(assistantId, capturedSubscriptionUrl, capturedAuthClient, controller);

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAliveInterval);
        leaveBroadcastGroup(assistantId, controller);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Content-Encoding': 'none',
    },
  });
}
