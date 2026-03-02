/**
 * SSE Endpoint for Live Actions Streaming
 *
 * Streams ManagerMethod and ToolLoop events from the assistant's
 * `*-actions-sub` Pub/Sub subscription to the browser via Server-Sent Events.
 *
 * Architecture:
 * - Per-connection pull loop inside `async start` (industry-standard SSE pattern)
 * - Server-side ACK (Orchestra is the durable store; client polls on catch-up)
 * - snake_case → camelCase transformation via shared casing utilities
 * - Reshapes flat Pub/Sub payload into { id, ts, entries } to match ManagerMethodLog
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';
import { snakeToCamelObject } from '@/utils/casing';
import { isManagerExcluded } from '@/lib/assistants/excluded-managers';

export const dynamic = 'force-dynamic';

const __DEV__ = process.env.NODE_ENV === 'development';

// =============================================================================
// Auth
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
        message: camelEvent.message,
      },
    },
  };
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

  let authClient: any;
  let subscriptionUrl: string;

  try {
    const authData = await getAuthClient();
    authClient = authData.client;

    const orchestraUrl = process.env.ORCHESTRA_URL || '';
    const isStaging = orchestraUrl.includes('staging');
    const subscriptionName = `unity-${assistantId}${isStaging ? '-staging' : ''}-actions-sub`;

    subscriptionUrl = `https://pubsub.googleapis.com/v1/projects/${authData.projectId}/subscriptions/${subscriptionName}`;

    if (__DEV__) console.log(`[DEBUG][Actions SSE] Auth OK. Subscription: ${subscriptionName}`);
  } catch (error: any) {
    console.error('[Actions SSE] Setup error:', error.message);
    return new NextResponse(JSON.stringify({ detail: 'Server configuration error.' }), {
      status: 500,
    });
  }

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
            data: { maxMessages: 10, returnImmediately: false },
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
            if (__DEV__)
              console.log(
                `[DEBUG][Actions SSE] Empty pull for assistant=${assistantId} (subscription alive, waiting)`
              );
            continue;
          }

          if (__DEV__)
            console.log(
              `[DEBUG][Actions SSE] Pulled ${receivedMessages.length} message(s) for assistant=${assistantId}`
            );

          const ackIds: string[] = [];

          // Parse all messages first, then sort by rowId to restore publish order
          // (Pub/Sub synchronous pull does not guarantee ordering)
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

          // Server-side ACK — Orchestra is the durable store
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

      // Cleanup
      clearInterval(keepAliveInterval);
      if (__DEV__) console.log(`[DEBUG][Actions SSE] Stream ended for assistant=${assistantId}`);
      try {
        controller.close();
      } catch {
        // Already closed
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
