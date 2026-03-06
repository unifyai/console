import { NextResponse } from 'next/server';

/**
 * No-op ACK endpoint. Server-side ACK is now handled by the SSE route itself
 * (each connection owns its own ephemeral Pub/Sub subscription). This route
 * is kept alive so that browser sessions with cached JS don't get 404s.
 */
export async function POST() {
  return NextResponse.json({ ok: true });
}
