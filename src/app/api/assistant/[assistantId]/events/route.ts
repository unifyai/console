/**
 * SSE Endpoint for Chat Event Streaming
 *
 * Streams chat events from the assistant's Pub/Sub topic to the browser
 * via Server-Sent Events, using gRPC streaming pull for sub-second delivery.
 *
 * Architecture:
 * - Each user+assistant pair gets a persistent Pub/Sub subscription
 *   (`{topicName}-chat-{contactId}`). The subscription survives across SSE
 *   reconnects, so messages published during connection gaps are preserved
 *   in the backlog and delivered when the next connection opens.
 * - gRPC streaming pull: the @google-cloud/pubsub library maintains a
 *   persistent bidirectional gRPC stream to Pub/Sub, delivering messages
 *   via event callbacks with sub-second latency. No polling.
 * - Client-side ACK: the SSE payload includes `__ackId` so the browser can
 *   acknowledge after display via POST /events/ack. The gRPC library
 *   auto-extends the ack deadline while the subscriber is open. If the
 *   connection drops before the browser ACKs, the deadline expires and
 *   Pub/Sub redelivers the message.
 * - Subscriptions auto-expire after 31 days of inactivity to clean up
 *   abandoned users.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Message } from '@google-cloud/pubsub';
import {
  getPubSubClient,
  getTopicName,
  PERSISTENT_EXPIRATION_TTL,
  MESSAGE_RETENTION_DURATION,
} from '@/lib/pubsub/ephemeral-subscription';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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

  let subscriptionName: string;

  try {
    const { pubsub } = getPubSubClient();
    const topicName = getTopicName(assistantId);
    subscriptionName = `${topicName}-chat-${contactId}`;

    const topic = pubsub.topic(topicName);
    try {
      await topic.createSubscription(subscriptionName, {
        filter: CHAT_FILTER,
        expirationPolicy: { ttl: { seconds: parseInt(PERSISTENT_EXPIRATION_TTL) } },
        messageRetentionDuration: { seconds: parseInt(MESSAGE_RETENTION_DURATION) },
      });
    } catch (err: any) {
      // 6 = ALREADY_EXISTS — subscription is already provisioned, reuse it.
      if (err.code !== 6) throw err;
    }

    if (__DEV__)
      console.log(`[Chat SSE] Persistent subscription: ${subscriptionName} on topic: ${topicName}`);
  } catch (error: any) {
    console.error('[Chat SSE] Setup error:', error.message);
    return new NextResponse(JSON.stringify({ detail: 'Server configuration error.' }), {
      status: 500,
    });
  }

  const stream = new ReadableStream({
    start(controller) {
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

      const { pubsub } = getPubSubClient();
      const subscription = pubsub.subscription(subscriptionName);

      const messageHandler = (message: Message) => {
        if (request.signal.aborted) {
          message.nack();
          return;
        }

        try {
          const rawData = message.data.toString('utf-8');
          let payload: any = {};
          try {
            payload = JSON.parse(rawData);
          } catch {
            payload = { rawContent: rawData };
          }

          payload.id = message.id;
          payload.publishTime = message.publishTime?.toISOString();
          payload.__ackId = message.ackId;
          if (payload.event && typeof payload.event === 'object') {
            payload.event.id = message.id;
            payload.event.publishTime = message.publishTime?.toISOString();
          }

          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          } catch {
            message.nack();
            return;
          }
          // Don't ack here — the browser ACKs via POST /events/ack after display.
          // The gRPC library auto-extends the ack deadline while this subscriber
          // is open. On disconnect, the deadline expires and Pub/Sub redelivers.
        } catch (err) {
          console.error('[Chat SSE] Error processing message:', err);
          message.nack();
        }
      };

      const errorHandler = (err: Error) => {
        if (!request.signal.aborted) {
          console.error('[Chat SSE] Subscriber error:', err.message);
        }
      };

      subscription.on('message', messageHandler);
      subscription.on('error', errorHandler);

      request.signal.addEventListener('abort', () => {
        clearInterval(keepAliveInterval);
        subscription.removeListener('message', messageHandler);
        subscription.removeListener('error', errorHandler);
        subscription.close();
        if (__DEV__) console.log(`[Chat SSE] Stream ended for assistant=${assistantId}`);
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
