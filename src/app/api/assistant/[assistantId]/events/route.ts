/**
 * SSE Endpoint for Chat Event Streaming
 *
 * Streams chat events from the assistant's Pub/Sub topic to the browser
 * via Server-Sent Events.
 *
 * Architecture:
 * - Each SSE connection creates its own ephemeral Pub/Sub subscription on the
 *   shared topic. This gives true fan-out: every viewer independently receives
 *   all events. Client-side contact_id filtering ensures each user only sees
 *   their own messages.
 * - Server-side ACK: messages are acknowledged immediately after being sent to
 *   the client. Since each subscription is private to one connection, ACKing
 *   has no effect on other viewers.
 * - Subscriptions auto-expire after inactivity so leaked ones don't accumulate.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getAuthClient,
  createEphemeralSubscription,
  deleteSubscription,
  getTopicName,
} from '@/lib/pubsub/ephemeral-subscription';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const __DEV__ = process.env.NODE_ENV === 'development';
const encoder = new TextEncoder();

export async function GET(request: NextRequest, { params }: { params: { assistantId: string } }) {
  const { assistantId } = params;

  if (!assistantId) {
    return new NextResponse('Assistant ID is required.', { status: 400 });
  }

  let authClient: any;
  let subscriptionUrl: string;

  try {
    const authData = await getAuthClient();
    authClient = authData.client;

    const connectionId = crypto.randomUUID().slice(0, 8);
    const topicName = getTopicName(assistantId);
    const subscriptionName = `${topicName}-chat-sse-${connectionId}`;

    subscriptionUrl = await createEphemeralSubscription(
      authClient,
      authData.projectId,
      topicName,
      subscriptionName
    );

    if (__DEV__)
      console.log(`[Chat SSE] Ephemeral subscription: ${subscriptionName} on topic: ${topicName}`);
  } catch (error: any) {
    console.error('[Chat SSE] Setup error:', error.message);
    return new NextResponse(JSON.stringify({ detail: 'Server configuration error.' }), {
      status: 500,
    });
  }

  const cleanupSubscriptionUrl = subscriptionUrl;
  const cleanupAuthClient = authClient;
  request.signal.addEventListener('abort', () => {
    deleteSubscription(cleanupAuthClient, cleanupSubscriptionUrl);
  });

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
            data: { maxMessages: 1, returnImmediately: false },
          });

          if (request.signal.aborted) break;

          if (res.status !== 200) {
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

          for (const item of receivedMessages) {
            const { ackId, message } = item;
            if (!message) continue;

            if (request.signal.aborted) break;

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
              if (payload.event && typeof payload.event === 'object') {
                payload.event.id = message.messageId;
                payload.event.publishTime = message.publishTime;
              }

              controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

              // Server-side ACK — subscription is private to this connection
              try {
                await authClient.request({
                  url: `${subscriptionUrl}:acknowledge`,
                  method: 'POST',
                  data: { ackIds: [ackId] },
                });
              } catch {
                // Non-fatal — message may be redelivered
              }
            } catch (err) {
              console.error('[Chat SSE] Error processing message:', err);
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
      deleteSubscription(authClient, subscriptionUrl);
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
