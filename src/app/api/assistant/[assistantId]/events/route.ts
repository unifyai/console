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

  const connId = `${assistantId}:${contactId}:${Date.now()}`;
  const log = (msg: string, data?: Record<string, unknown>) =>
    console.log(`[Chat SSE ${connId}] ${msg}`, data ? JSON.stringify(data) : '');

  let subscriptionName: string;

  try {
    const { pubsub } = getPubSubClient();
    const topicName = getTopicName(assistantId);
    subscriptionName = `${topicName}-chat-${contactId}`;

    const topic = pubsub.topic(topicName);
    let subscriptionCreated = false;
    try {
      await topic.createSubscription(subscriptionName, {
        filter: CHAT_FILTER,
        expirationPolicy: { ttl: { seconds: parseInt(PERSISTENT_EXPIRATION_TTL) } },
        messageRetentionDuration: { seconds: parseInt(MESSAGE_RETENTION_DURATION) },
      });
      subscriptionCreated = true;
    } catch (err: any) {
      // 6 = ALREADY_EXISTS — subscription is already provisioned, reuse it.
      if (err.code !== 6) throw err;
    }

    log('CONNECT', {
      topicName,
      subscriptionName,
      subscriptionCreated,
      filter: CHAT_FILTER,
      retentionSec: MESSAGE_RETENTION_DURATION,
    });
  } catch (error: any) {
    console.error(`[Chat SSE ${connId}] SETUP_ERROR`, error.message, error.stack);
    return new NextResponse(JSON.stringify({ detail: 'Server configuration error.' }), {
      status: 500,
    });
  }

  const stream = new ReadableStream({
    start(controller) {
      const startTime = Date.now();
      let messageCount = 0;
      let keepAliveCount = 0;
      let errorCount = 0;

      log('STREAM_START');

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
        keepAliveCount++;
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          log('KEEPALIVE_WRITE_FAIL', { keepAliveCount, elapsed: Date.now() - startTime });
          clearInterval(keepAliveInterval);
        }
      }, 15000);

      const { pubsub } = getPubSubClient();
      const subscription = pubsub.subscription(subscriptionName);

      const messageHandler = (message: Message) => {
        if (request.signal.aborted) {
          log('MSG_NACK_ABORTED', { msgId: message.id });
          message.nack();
          return;
        }

        messageCount++;

        try {
          const rawData = message.data.toString('utf-8');
          let payload: any = {};
          try {
            payload = JSON.parse(rawData);
          } catch {
            payload = { rawContent: rawData };
          }

          const thread = payload.thread ?? message.attributes?.thread ?? 'unknown';
          const eventContactId = payload.event?.contact_id ?? payload.contact_id;
          const content = payload.event?.content ?? payload.event?.body ?? payload.content ?? '';
          const contentPreview = typeof content === 'string' ? content.slice(0, 80) : String(content).slice(0, 80);
          const publishTime = message.publishTime?.toISOString();
          const deliveryAttempt = message.deliveryAttempt;
          const ageMs = message.publishTime ? Date.now() - message.publishTime.getTime() : null;

          log('MSG_RECV', {
            msgId: message.id,
            publishTime,
            ageMs,
            thread,
            contactId: eventContactId,
            deliveryAttempt,
            contentPreview,
            messageCount,
            elapsed: Date.now() - startTime,
          });

          payload.id = message.id;
          payload.publishTime = publishTime;
          payload.__ackId = message.ackId;
          if (payload.event && typeof payload.event === 'object') {
            payload.event.id = message.id;
            payload.event.publishTime = publishTime;
          }

          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
            log('MSG_SENT', { msgId: message.id });
          } catch {
            log('MSG_WRITE_FAIL', { msgId: message.id });
            message.nack();
            return;
          }
        } catch (err) {
          log('MSG_PROCESS_ERROR', { msgId: message.id, error: String(err) });
          message.nack();
        }
      };

      const errorHandler = (err: Error) => {
        errorCount++;
        if (!request.signal.aborted) {
          log('SUBSCRIBER_ERROR', {
            error: err.message,
            stack: err.stack?.split('\n').slice(0, 3).join(' | '),
            errorCount,
            messageCount,
            elapsed: Date.now() - startTime,
          });
        }
      };

      subscription.on('message', messageHandler);
      subscription.on('error', errorHandler);

      request.signal.addEventListener('abort', () => {
        const elapsed = Date.now() - startTime;
        log('STREAM_END', { elapsed, messageCount, keepAliveCount, errorCount });

        clearInterval(keepAliveInterval);
        subscription.removeListener('message', messageHandler);
        subscription.removeListener('error', errorHandler);
        subscription.close();
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
