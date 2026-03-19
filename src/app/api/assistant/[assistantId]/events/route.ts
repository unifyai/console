/**
 * SSE Endpoint for Chat Event Streaming
 *
 * Streams chat events from the assistant's Pub/Sub topic to the browser
 * via Server-Sent Events.
 *
 * Architecture:
 * - Each user+assistant pair gets a persistent Pub/Sub subscription
 *   (`{topicName}-chat-{contactId}`). The subscription survives across SSE
 *   reconnects, so messages published during connection gaps are preserved
 *   in the backlog and delivered when the next connection pulls.
 * - Client-side ACK: the SSE payload includes `__ackId` so the browser can
 *   acknowledge after display via POST /events/ack. The server extends the
 *   ACK deadline to give the browser time. If the connection drops before
 *   the browser ACKs, the message stays in Pub/Sub and is redelivered.
 * - Subscriptions auto-expire after 31 days of inactivity to clean up
 *   abandoned users.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthClient,
  getOrCreateSubscription,
  getTopicName,
} from '@/lib/pubsub/ephemeral-subscription';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const __DEV__ = process.env.NODE_ENV === 'development';
const encoder = new TextEncoder();

const CHAT_FILTER =
  'attributes.thread = "unify_message_outbound" OR attributes.thread = "assistant_desktop_ready"';

export async function GET(request: NextRequest, { params }: { params: { assistantId: string } }) {
  const { assistantId } = params;

  if (!assistantId) {
    return new NextResponse('Assistant ID is required.', { status: 400 });
  }

  const contactId = request.nextUrl.searchParams.get('contactId');
  if (!contactId) {
    return new NextResponse('contactId query parameter is required.', { status: 400 });
  }

  let authClient: any;
  let subscriptionUrl: string;

  try {
    const authData = await getAuthClient();
    authClient = authData.client;

    const topicName = getTopicName(assistantId);
    const subscriptionName = `${topicName}-chat-${contactId}`;

    subscriptionUrl = await getOrCreateSubscription(
      authClient,
      authData.projectId,
      topicName,
      subscriptionName,
      CHAT_FILTER
    );

    if (__DEV__)
      console.log(`[Chat SSE] Persistent subscription: ${subscriptionName} on topic: ${topicName}`);
  } catch (error: any) {
    console.error('[Chat SSE] Setup error:', error.message);
    return new NextResponse(JSON.stringify({ detail: 'Server configuration error.' }), {
      status: 500,
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      if (__DEV__) console.log(`[Chat SSE] Stream started for assistant=${assistantId}`);

      try {
        controller.enqueue(encoder.encode(': connected\n\n'));
      } catch {
        /* stream already closed */
      }

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

      while (!request.signal.aborted) {
        try {
          const res = await authClient.request({
            url: `${subscriptionUrl}:pull`,
            method: 'POST',
            data: { maxMessages: 1, returnImmediately: true },
          });

          if (res.status !== 200) {
            if (request.signal.aborted) break;
            if (res.status === 404) {
              console.error(`[Chat SSE] Subscription not found: ${subscriptionUrl}`);
              break;
            }
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

          if (request.signal.aborted) {
            const ackIds = receivedMessages.map((m) => m.ackId).filter(Boolean);
            if (ackIds.length > 0) {
              await authClient
                .request({
                  url: `${subscriptionUrl}:modifyAckDeadline`,
                  method: 'POST',
                  data: { ackIds, ackDeadlineSeconds: 0 },
                })
                .catch(() => {});
            }
            break;
          }

          for (const item of receivedMessages) {
            const { ackId, message } = item;
            if (!message) continue;

            if (request.signal.aborted) {
              await authClient
                .request({
                  url: `${subscriptionUrl}:modifyAckDeadline`,
                  method: 'POST',
                  data: { ackIds: [ackId], ackDeadlineSeconds: 0 },
                })
                .catch(() => {});
              break;
            }

            try {
              const rawData = Buffer.from(message.data, 'base64').toString('utf-8');
              let payload: any = {};
              try {
                payload = JSON.parse(rawData);
              } catch {
                payload = { rawContent: rawData };
              }

              payload.id = message.messageId;
              payload.publishTime = message.publishTime;
              payload.__ackId = ackId;
              if (payload.event && typeof payload.event === 'object') {
                payload.event.id = message.messageId;
                payload.event.publishTime = message.publishTime;
              }

              try {
                await authClient.request({
                  url: `${subscriptionUrl}:modifyAckDeadline`,
                  method: 'POST',
                  data: { ackIds: [ackId], ackDeadlineSeconds: 30 },
                });
              } catch {
                // Non-fatal — default deadline still applies
              }

              controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
            } catch (err) {
              console.error('[Chat SSE] Error processing message:', err);
              await authClient
                .request({
                  url: `${subscriptionUrl}:modifyAckDeadline`,
                  method: 'POST',
                  data: { ackIds: [ackId], ackDeadlineSeconds: 0 },
                })
                .catch(() => {});
            }
          }
        } catch (error: any) {
          if (!request.signal.aborted) {
            console.error('[Chat SSE] Pull loop error:', error.message);
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }

      clearInterval(keepAliveInterval);
      if (__DEV__) console.log(`[Chat SSE] Stream ended for assistant=${assistantId}`);
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
      'Content-Encoding': 'none',
    },
  });
}
