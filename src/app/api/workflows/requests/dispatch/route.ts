/**
 * Workflow request dispatch proxy.
 *
 * The caller has already written the durable `Workflows/Requests` row with its
 * own session key. This route only asks Orchestra to wake the assistant so the
 * change is applied now rather than on its next boot.
 *
 * Two things it deliberately does not do. It does not write the row — the
 * request belongs to the signed-in owner's own context, so the owner's key
 * writes it, which is also what makes the idempotency key theirs to mint. And it
 * does not treat an undelivered wake as a failure: the row is the mechanism and
 * the assistant's boot sweep drains the same queue, so reporting an error here
 * would tell the user nothing happened when something did.
 */

import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/user/user';
import { camelToSnakeObject } from '@/utils/casing';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'http://localhost:8000';

/** Kept in step with unify's WorkflowRequest ACTIONS. */
const ACTIONS = new Set(['install', 'uninstall', 'update', 'save_params']);

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const adminKey = process.env.ORCHESTRA_ADMIN_KEY;
  if (!adminKey) {
    return NextResponse.json({ detail: 'Server configuration error' }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as {
    assistantId?: number | string;
    requestId?: string;
    slug?: string;
    action?: string;
    destination?: string;
  } | null;

  const assistantId = Number(body?.assistantId);
  const requestId = String(body?.requestId ?? '');
  const slug = String(body?.slug ?? '');
  const action = String(body?.action ?? '');

  if (!Number.isFinite(assistantId) || !requestId || !slug || !ACTIONS.has(action)) {
    return NextResponse.json({ detail: 'Invalid dispatch request' }, { status: 400 });
  }

  try {
    const response = await fetch(`${ORCHESTRA_URL}/v0/admin/workflows/requests/dispatch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminKey}`,
        'Content-Type': 'application/json',
      },
      // Orchestra's wire casing, converted rather than hand-written.
      body: JSON.stringify(
        camelToSnakeObject({
          assistantId,
          requestId,
          slug,
          action,
          destination: body?.destination || 'personal',
        })
      ),
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ requestId, dispatched: false }, { status: 200 });
    }
    const data = (await response.json()) as { dispatched?: boolean };
    return NextResponse.json({ requestId, dispatched: data.dispatched === true }, { status: 200 });
  } catch {
    // Orchestra unreachable. The request is recorded; say so plainly.
    return NextResponse.json({ requestId, dispatched: false }, { status: 200 });
  }
}
