/**
 * Page-level chat SSE endpoint.
 *
 * Why this exists
 * ---------------
 * The assistants page needs to show unread-message badges across ALL
 * assistants in the workspace and drive the currently-open chat panel. Opening
 * one SSE per assistant at page load would hit the browser's per-origin
 * connection cap and fan-out server load linearly with workspace size.
 *
 * Instead, this route accepts a list of `(assistantId, contactId)` pairs and
 * multiplexes every subscription into a single SSE stream. Each outbound
 * frame is tagged with its `assistantId` so the client can demux before
 * feeding it into the shared `profileChatHistories` state consumed by both
 * the list (unread counts) and the chat panel.
 *
 * Subscription naming
 * -------------------
 * Subscriptions use the persistent name `{topicName}-chat-{contactId}` — one
 * subscriber per (user, assistant, contact) tuple across the whole app, which
 * makes ack semantics straightforward (every message is acknowledged exactly
 * once by this route at enqueue time).
 *
 * Ack strategy
 * ------------
 * Messages are NOT acked on enqueue. The streaming-pull client holds the
 * lease (auto-extending the ack deadline) until the browser confirms receipt
 * via `POST /api/assistant/events/chat-stream/ack`. This prevents the "SSE
 * frame written but never arrives at the client" class of silent drops
 * (Vercel function timeout, dropped TCP, zombified stream): if the client
 * never acks, the message returns to the Pub/Sub backlog on disconnect and
 * is redelivered to the next subscriber session.
 *
 * Each outbound frame carries `__ackId` so the client knows which token to
 * send back. If `controller.enqueue` fails mid-flight we nack immediately so
 * the backlog state matches the client state. On stream abort we let the
 * Node Pub/Sub client's own `close()` release any still-leased messages.
 *
 * Bounds
 * ------
 * - At most `MAX_PAIRS` pairs per stream; the client shards above that in
 *   `useAssistantChatStream` so there's no global cap on workspace size.
 * - `maxDuration = 300s` (Vercel ceiling); the client reconnects on `error`.
 *
 * Control frames
 * --------------
 * Three out-of-band frames are interleaved with the regular message frames
 * and identified by `__mux_control`:
 * - `subscription_status`  — emitted once on connect when one or more pairs
 *   were skipped at provisioning time (e.g. topic not yet provisioned). Lists
 *   `connected` and `skipped` so the client can schedule a retry just for the
 *   skipped pairs.
 * - `subscription_error`   — emitted when an attached subscription's
 *   `on('error', ...)` handler fires for the first time after a healthy state.
 *   Carries `assistantId` + `reason` so the client can scope the chat panel's
 *   disconnected indicator to that one assistant rather than the whole shard.
 * - `subscription_ok`      — emitted when a subscription successfully delivers
 *   a message after having been in the `error` state. Lets the client clear
 *   the per-assistant override and fall back to the shard-level transport
 *   status.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Message, Subscription } from '@google-cloud/pubsub';
import {
  getPubSubClient,
  getTopicName,
  PERSISTENT_EXPIRATION_TTL,
  MESSAGE_RETENTION_DURATION,
} from '@/lib/pubsub/ephemeral-subscription';
import { mockSimulationEnabled } from '@/lib/simulation/config';
import { createSseLifecycle } from '@/lib/pubsub/sse-lifecycle';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const encoder = new TextEncoder();

/**
 * Benign keep-alive-only SSE stream for mock simulation mode. There is no
 * Pub/Sub backend, so we hold the connection open with periodic comments and
 * never emit chat frames (history is served read-only from the logs seam).
 */
function createBenignStream(request: NextRequest): Response {
  const stream = new ReadableStream({
    start(controller) {
      try {
        controller.enqueue(encoder.encode(': connected\n\n'));
      } catch {
        /* already closed */
      }
      const keepAlive = setInterval(() => {
        if (request.signal.aborted) {
          clearInterval(keepAlive);
          return;
        }
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          clearInterval(keepAlive);
        }
      }, 15000);
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
        try {
          controller.close();
        } catch {
          /* already closed */
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

const CHAT_FILTER =
  'attributes.thread = "unify_message_outbound" OR attributes.thread = "assistant_desktop_ready" OR attributes.thread = "unify_meet_incoming"';

const MAX_PAIRS = 50;

interface Pair {
  assistantId: string;
  contactId: string;
  rootKey: string;
}

function subscriptionNameForPair(topicName: string, contactId: string, rootKey: string): string {
  return `${topicName}-chat-${rootKey}-${contactId}`;
}

function parsePairs(raw: string | null): Pair[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const pairs: Pair[] = [];
  for (const chunk of raw.split(',')) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const [assistantId = '', contactId = '', rootKey = 'personal'] = trimmed
      .split(':')
      .map((part) => part.trim());
    if (!assistantId || !/^\d+$/.test(contactId) || !/^[a-z0-9-]+$/.test(rootKey)) continue;
    // Dedup in case the client accidentally repeats a pair; subscribing twice
    // to the same Pub/Sub subscription from one process would load-balance
    // messages across the two subscribers.
    const key = `${assistantId}:${contactId}:${rootKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ assistantId, contactId, rootKey });
  }
  return pairs;
}

export async function GET(request: NextRequest) {
  if (mockSimulationEnabled()) {
    return createBenignStream(request);
  }

  const rawPairs = request.nextUrl.searchParams.get('pairs');
  const pairs = parsePairs(rawPairs);

  if (!pairs.length) {
    return new NextResponse(
      'pairs query parameter required (format: assistantId:contactId,assistantId:contactId,...)',
      { status: 400 }
    );
  }
  if (pairs.length > MAX_PAIRS) {
    return new NextResponse(`Too many pairs: ${pairs.length} > ${MAX_PAIRS}`, { status: 400 });
  }

  const clientSessionId = request.nextUrl.searchParams.get('sid') || 'none';
  const connId = `chat:${pairs.length}:${Date.now()}`;
  const log = (msg: string, data?: Record<string, unknown>) =>
    console.log(`[Chat Stream SSE ${connId}] ${msg}`, data ? JSON.stringify(data) : '');

  interface SubConfig {
    assistantId: string;
    contactId: string;
    rootKey: string;
    subscriptionName: string;
  }
  const subConfigs: SubConfig[] = [];
  const skippedPairs: {
    assistantId: string;
    contactId: number;
    rootKey: string;
    reason: string;
  }[] = [];

  // Provision subscriptions per pair, but treat per-pair failures as soft.
  // A missing topic for one assistant (e.g., a transient hire-time race, or
  // dev-data left behind without Pub/Sub topics) must not break the stream
  // for the remaining assistants. We log + skip and the client schedules
  // backoff retries for still-relevant skipped pairs via the control frame
  // emitted below.
  let pubsub: ReturnType<typeof getPubSubClient>['pubsub'];
  try {
    ({ pubsub } = getPubSubClient());
  } catch (error: any) {
    console.error(`[Chat Stream SSE ${connId}] CLIENT_INIT_ERROR`, error.message, error.stack);
    return new NextResponse(JSON.stringify({ detail: 'Server configuration error.' }), {
      status: 500,
    });
  }

  for (const { assistantId, contactId, rootKey } of pairs) {
    const topicName = getTopicName(assistantId);
    const subscriptionName = subscriptionNameForPair(topicName, contactId, rootKey);
    const topic = pubsub.topic(topicName);
    try {
      await topic.createSubscription(subscriptionName, {
        filter: CHAT_FILTER,
        expirationPolicy: { ttl: { seconds: parseInt(PERSISTENT_EXPIRATION_TTL) } },
        messageRetentionDuration: { seconds: parseInt(MESSAGE_RETENTION_DURATION) },
      });
    } catch (err: any) {
      // 6 = ALREADY_EXISTS — subscription is already provisioned, reuse it.
      if (err.code === 6) {
        subConfigs.push({ assistantId, contactId, rootKey, subscriptionName });
        continue;
      }
      // 5 = NOT_FOUND — topic doesn't exist for this assistant. This can
      // happen for assistants whose Communication-side provisioning hasn't
      // completed yet, or for dev/test data. Skip gracefully.
      const reason = err.code === 5 ? 'topic_not_found' : `code_${err.code ?? 'unknown'}`;
      skippedPairs.push({ assistantId, contactId: Number(contactId), rootKey, reason });
      log('SUB_SKIP', { assistantId, subscriptionName, reason, error: err.message });
      continue;
    }
    subConfigs.push({ assistantId, contactId, rootKey, subscriptionName });
  }

  if (subConfigs.length === 0) {
    // Nothing usable. Surface a 503 so the client can back off & retry; this
    // is distinct from "server misconfigured" (500) and from "bad request"
    // (400) — it's a transient state where no requested topic is ready.
    log('NO_VALID_PAIRS', { skipped: skippedPairs.length });
    return new NextResponse(
      JSON.stringify({ detail: 'No chat subscriptions available.', skippedPairs }),
      { status: 503 }
    );
  }

  log('CONNECT', {
    count: subConfigs.length,
    skipped: skippedPairs.length,
    clientSessionId,
    filter: CHAT_FILTER,
    retentionSec: MESSAGE_RETENTION_DURATION,
  });

  const { lifecycle, cancel } = createSseLifecycle(request);

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

      // Emit a control frame listing the pairs we successfully attached and
      // the ones we had to skip (topic not found, etc.). The client uses
      // this to schedule a backoff retry for skipped pairs so a transient
      // provisioning race doesn't leave an assistant blind to messages
      // until the next full reconnect.
      if (skippedPairs.length > 0) {
        const controlFrame = {
          __mux_control: 'subscription_status',
          connected: subConfigs.map((s) => ({
            assistantId: s.assistantId,
            contactId: Number(s.contactId),
            rootKey: s.rootKey,
          })),
          skipped: skippedPairs,
        };
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(controlFrame)}\n\n`));
        } catch {
          /* stream already closed */
        }
      }

      const keepAliveInterval = setInterval(() => {
        keepAliveCount++;
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          log('KEEPALIVE_WRITE_FAIL', { keepAliveCount, elapsed: Date.now() - startTime });
          lifecycle.close();
        }
      }, 15000);
      lifecycle.add(() => clearInterval(keepAliveInterval));

      const { pubsub } = getPubSubClient();

      interface AttachedSub {
        assistantId: string;
        subscription: Subscription;
        messageHandler: (m: Message) => void;
        errorHandler: (err: Error) => void;
      }
      const attached: AttachedSub[] = [];

      // Per-subscription health, used to emit `subscription_error` /
      // `subscription_ok` control frames so the client can scope the
      // chat panel's connection-status indicator to the affected assistant
      // only, instead of marking every chat in the shard as unhealthy.
      // We only emit when the state CHANGES, so a flapping subscription
      // doesn't spam the SSE pipe.
      const subHealth: Record<string, 'ok' | 'error'> = {};
      const emitSubscriptionStatus = (
        assistantId: string,
        kind: 'ok' | 'error',
        reason?: string
      ) => {
        if (subHealth[assistantId] === kind) return;
        subHealth[assistantId] = kind;
        const frame: Record<string, unknown> = {
          __mux_control: kind === 'error' ? 'subscription_error' : 'subscription_ok',
          assistantId,
        };
        if (reason) frame.reason = reason;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
        } catch {
          /* stream already closed */
        }
      };

      for (const { assistantId, contactId, rootKey, subscriptionName } of subConfigs) {
        const subscription = pubsub.subscription(subscriptionName);

        const messageHandler = (message: Message) => {
          if (request.signal.aborted) {
            log('MSG_NACK_ABORTED', { msgId: message.id, assistantId });
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

            // Pub/Sub emulator subscriptions may deliver non-outbound frames despite
            // the filter. Drop them here so inbound unify_message payloads are not
            // rendered as assistant chat bubbles on the client.
            if (
              thread !== 'unify_message_outbound' &&
              thread !== 'assistant_desktop_ready' &&
              thread !== 'unify_meet_incoming'
            ) {
              log('MSG_SKIP', { msgId: message.id, assistantId, thread });
              message.ack();
              return;
            }

            const eventContactId = payload.event?.contact_id ?? payload.contact_id;
            const content = payload.event?.content ?? payload.event?.body ?? payload.content ?? '';
            const contentPreview =
              typeof content === 'string' ? content.slice(0, 80) : String(content).slice(0, 80);
            const publishTime = message.publishTime?.toISOString();
            const deliveryAttempt = message.deliveryAttempt;
            const ageMs = message.publishTime ? Date.now() - message.publishTime.getTime() : null;

            log('MSG_RECV', {
              msgId: message.id,
              assistantId,
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
            payload.subscriptionContactId = contactId;
            payload.subscriptionRootKey = rootKey;
            // Tag with the assistant so the client can demux the multiplexed
            // stream.
            payload.assistantId = assistantId;
            if (payload.event && typeof payload.event === 'object') {
              payload.event.id = message.id;
              payload.event.publishTime = publishTime;
            }

            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
              // Intentionally do NOT ack here. The browser will POST an ack
              // to `/api/assistant/events/chat-stream/ack` once the message
              // is actually rendered, so any in-flight drop lands back in
              // the Pub/Sub backlog on stream close and is redelivered.
              log('MSG_SENT', { msgId: message.id, assistantId, ackId: message.ackId });
              // Successful delivery == subscription is healthy. Emits a
              // recovery frame iff the previous state was 'error'.
              emitSubscriptionStatus(assistantId, 'ok');
            } catch {
              log('MSG_WRITE_FAIL', { msgId: message.id, assistantId });
              message.nack();
              return;
            }
          } catch (err) {
            log('MSG_PROCESS_ERROR', {
              msgId: message.id,
              assistantId,
              error: String(err),
            });
            message.nack();
          }
        };

        const errorHandler = (err: Error) => {
          errorCount++;
          if (!request.signal.aborted) {
            log('SUBSCRIBER_ERROR', {
              assistantId,
              error: err.message,
              stack: err.stack?.split('\n').slice(0, 3).join(' | '),
              errorCount,
              messageCount,
              elapsed: Date.now() - startTime,
            });
            // Surface the error to the client so just THIS assistant's
            // chat panel shows the disconnected indicator. Other pairs in
            // the same shard keep their own state.
            emitSubscriptionStatus(assistantId, 'error', err.message);
          }
        };

        subscription.on('message', messageHandler);
        subscription.on('error', errorHandler);
        attached.push({ assistantId, subscription, messageHandler, errorHandler });
      }

      lifecycle.add(() => {
        const elapsed = Date.now() - startTime;
        log('STREAM_END', { elapsed, messageCount, keepAliveCount, errorCount });

        for (const { subscription, messageHandler, errorHandler } of attached) {
          subscription.removeListener('message', messageHandler);
          subscription.removeListener('error', errorHandler);
          subscription.close();
        }
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
    cancel() {
      cancel();
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
