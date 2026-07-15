/**
 * Org chat SSE endpoint.
 *
 * Streams realtime team-chat and DM frames for one organization from the
 * per-org Pub/Sub topic (`unity-org-{orgId}` + environment suffix) to the
 * browser. A single connection covers every team and DM thread the user can
 * see, so the client opens exactly one EventSource per org.
 *
 * Authorization is derived server-side: after session auth we fetch the org
 * roster with the user's own API key (a 403/404 from Orchestra means the user
 * is not a member → 403 here) and the user's id from `/user/basic-info`.
 * Team frames are forwarded only for teams the user belongs to; DM frames
 * only when the user is one of the two participants. Everything else is
 * dropped (and acked) server-side so no cross-team/DM data reaches the
 * browser.
 *
 * Subscription naming: `{topicName}-console-{userId}` — one persistent
 * subscription per (org, user). Messages are acked immediately on enqueue;
 * history is reloaded from Orchestra on reconnect, so backlog redelivery is
 * not needed.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Message } from '@google-cloud/pubsub';
import {
  getPubSubClient,
  PERSISTENT_EXPIRATION_TTL,
  MESSAGE_RETENTION_DURATION,
} from '@/lib/pubsub/ephemeral-subscription';
import { topicSuffix } from '@/lib/environment/comms-env';
import { mockSimulationEnabled } from '@/lib/simulation/config';
import { createSseLifecycle } from '@/lib/pubsub/sse-lifecycle';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

const encoder = new TextEncoder();

/**
 * Benign keep-alive-only SSE stream for mock simulation mode. There is no
 * Pub/Sub backend, so we hold the connection open with periodic comments and
 * never emit chat frames.
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

export async function GET(request: NextRequest) {
  if (mockSimulationEnabled()) {
    return createBenignStream(request);
  }

  const orgId = request.nextUrl.searchParams.get('orgId');
  const organizationId = orgId ? parseInt(orgId, 10) : NaN;
  if (isNaN(organizationId)) {
    return new NextResponse('orgId query parameter required (integer)', { status: 400 });
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const authHeaders = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  // Derive what this user is allowed to see. The roster fetch doubles as the
  // membership check: Orchestra rejects non-members.
  let userId: string;
  let allowedTeamIds: Set<number>;
  try {
    const [basicInfoResponse, rosterResponse] = await Promise.all([
      fetch(`${ORCHESTRA_URL}/v0/user/basic-info`, { headers: authHeaders, cache: 'no-store' }),
      fetch(`${ORCHESTRA_URL}/v0/organizations/${organizationId}/roster`, {
        headers: authHeaders,
        cache: 'no-store',
      }),
    ]);

    if (!basicInfoResponse.ok) {
      return NextResponse.json({ detail: 'Failed to resolve user.' }, { status: 403 });
    }
    if (!rosterResponse.ok) {
      return NextResponse.json({ detail: 'Not a member of this organization.' }, { status: 403 });
    }

    const basicInfo = await basicInfoResponse.json();
    userId = String(basicInfo?.user_id ?? basicInfo?.id ?? '');
    if (!userId) {
      return NextResponse.json({ detail: 'Failed to resolve user.' }, { status: 403 });
    }

    const roster = await rosterResponse.json();
    const teams: Array<{ team_id: number; member_user_ids?: string[] }> = Array.isArray(
      roster?.teams
    )
      ? roster.teams
      : [];
    allowedTeamIds = new Set(
      teams
        .filter((team) => (team.member_user_ids ?? []).map(String).includes(userId))
        .map((team) => Number(team.team_id))
    );
  } catch (error: any) {
    console.error('[Org Chat SSE] AUTHZ_ERROR', error?.message);
    return NextResponse.json({ detail: 'Failed to resolve org membership.' }, { status: 500 });
  }

  const topicName = `unity-org-${organizationId}${topicSuffix()}`;
  const subscriptionName = `${topicName}-console-${userId}`;

  const connId = `org-chat:${organizationId}:${Date.now()}`;
  const log = (msg: string, data?: Record<string, unknown>) =>
    console.log(`[Org Chat SSE ${connId}] ${msg}`, data ? JSON.stringify(data) : '');

  let pubsub: ReturnType<typeof getPubSubClient>['pubsub'];
  try {
    ({ pubsub } = getPubSubClient());
  } catch (error: any) {
    console.error(`[Org Chat SSE ${connId}] CLIENT_INIT_ERROR`, error.message, error.stack);
    return new NextResponse(JSON.stringify({ detail: 'Server configuration error.' }), {
      status: 500,
    });
  }

  try {
    await pubsub.topic(topicName).createSubscription(subscriptionName, {
      expirationPolicy: { ttl: { seconds: parseInt(PERSISTENT_EXPIRATION_TTL) } },
      messageRetentionDuration: { seconds: parseInt(MESSAGE_RETENTION_DURATION) },
    });
  } catch (err: any) {
    // 6 = ALREADY_EXISTS — subscription is already provisioned, reuse it.
    if (err.code !== 6) {
      // 5 = NOT_FOUND — the per-org topic hasn't been provisioned yet.
      if (err.code === 5) {
        log('TOPIC_NOT_FOUND', { topicName });
        return new NextResponse(JSON.stringify({ detail: 'org chat topic not ready' }), {
          status: 503,
        });
      }
      log('SUB_CREATE_ERROR', { subscriptionName, code: err.code, error: err.message });
      return new NextResponse(JSON.stringify({ detail: 'Failed to subscribe to org chat.' }), {
        status: 500,
      });
    }
  }

  log('CONNECT', { topicName, subscriptionName, allowedTeamIds: [...allowedTeamIds] });

  const { lifecycle, cancel } = createSseLifecycle(request);

  const stream = new ReadableStream({
    start(controller) {
      const startTime = Date.now();
      let messageCount = 0;
      let droppedCount = 0;

      try {
        controller.enqueue(encoder.encode(': connected\n\n'));
      } catch {
        /* stream already closed */
      }

      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          log('KEEPALIVE_WRITE_FAIL', { elapsed: Date.now() - startTime });
          lifecycle.close();
        }
      }, 15000);
      lifecycle.add(() => clearInterval(keepAliveInterval));

      const subscription = pubsub.subscription(subscriptionName);

      const messageHandler = (message: Message) => {
        // Acked immediately: history is served by Orchestra on reconnect, so
        // there's no redelivery contract to honor for dropped SSE frames.
        message.ack();
        if (request.signal.aborted) return;

        let payload: any;
        try {
          payload = JSON.parse(message.data.toString('utf-8'));
        } catch {
          log('MSG_PARSE_FAIL', { msgId: message.id });
          return;
        }

        const thread = payload?.thread ?? message.attributes?.thread;
        const event = payload?.event;

        let allowed = false;
        if (thread === 'team_message') {
          const teamIdRaw = message.attributes?.team_id ?? event?.team_id;
          const teamId = Number(teamIdRaw);
          allowed = !isNaN(teamId) && allowedTeamIds.has(teamId);
        } else if (
          thread === 'dm_message' ||
          thread === 'dm_call_incoming' ||
          thread === 'dm_call_answered' ||
          thread === 'dm_call_ended' ||
          thread === 'dm_call_declined'
        ) {
          const participants: string[] = Array.isArray(event?.user_ids)
            ? event.user_ids.map(String)
            : [message.attributes?.dm_user_a, message.attributes?.dm_user_b].filter(
                (id): id is string => typeof id === 'string'
              );
          // Call frames may only carry caller/callee ids.
          if (participants.length === 0) {
            if (event?.caller_user_id) participants.push(String(event.caller_user_id));
            if (event?.callee_user_id) participants.push(String(event.callee_user_id));
          }
          allowed = participants.includes(userId);
        }

        if (!allowed) {
          droppedCount++;
          return;
        }

        messageCount++;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ thread, event })}\n\n`));
        } catch {
          log('MSG_WRITE_FAIL', { msgId: message.id });
          lifecycle.close();
        }
      };

      const errorHandler = (err: Error) => {
        if (!request.signal.aborted) {
          log('SUBSCRIBER_ERROR', {
            error: err.message,
            messageCount,
            elapsed: Date.now() - startTime,
          });
        }
      };

      subscription.on('message', messageHandler);
      subscription.on('error', errorHandler);

      lifecycle.add(() => {
        log('STREAM_END', {
          elapsed: Date.now() - startTime,
          messageCount,
          droppedCount,
        });
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
