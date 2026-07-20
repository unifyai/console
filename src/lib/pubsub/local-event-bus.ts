/**
 * In-memory event bus for local development SSE streaming.
 *
 * Used only when neither cloud Pub/Sub credentials nor PUBSUB_EMULATOR_HOST
 * are available. The simulation script (or any HTTP client) pushes events via
 * the companion POST endpoint at /api/assistant/[assistantId]/actions/push,
 * and all active SSE connections for that assistant receive them in real time.
 *
 * When PUBSUB_EMULATOR_HOST is set (self-host, local.sh --chat/--pubsub, CI),
 * Actions/billing/system-errors SSE use the emulator — the same path Unity's
 * EventBus publishes to — not this bus.
 *
 * Each SSE connection registers a listener via subscribe(). Events are
 * fan-out: every listener receives every event (same semantics as Pub/Sub
 * ephemeral subscriptions).
 *
 * The bus is stored on globalThis so that the push route and SSE stream route
 * share the same instance even when Next.js dev mode compiles them into
 * separate module contexts (HMR, route-level code splitting).
 */

import { commsCredentialsConfigured } from './ephemeral-subscription';

export type LocalEventListener = (event: Record<string, unknown>) => void;

type AssistantBus = Set<LocalEventListener>;

const buses: Map<string, AssistantBus> = ((globalThis as any).__LOCAL_EVENT_BUSES__ ??= new Map<
  string,
  AssistantBus
>());

function getBus(assistantId: string): AssistantBus {
  let bus = buses.get(assistantId);
  if (!bus) {
    bus = new Set();
    buses.set(assistantId, bus);
  }
  return bus;
}

export function subscribe(assistantId: string, listener: LocalEventListener): () => void {
  const bus = getBus(assistantId);
  bus.add(listener);
  return () => {
    bus.delete(listener);
    if (bus.size === 0) buses.delete(assistantId);
  };
}

export function publish(assistantId: string, event: Record<string, unknown>): void {
  const bus = buses.get(assistantId);
  if (!bus) return;
  bus.forEach((listener) => listener(event));
}

/**
 * Returns true when we can connect to a real (or emulated) Pub/Sub backend.
 * Real credentials OR a running emulator both satisfy this check.
 */
export function hasCredentials(): boolean {
  return commsCredentialsConfigured() || !!process.env.PUBSUB_EMULATOR_HOST?.trim();
}

/**
 * Route live-action / billing / system-error SSE through the in-memory bus
 * (and allow companion /push endpoints) only when no Pub/Sub backend is
 * reachable. Prefer GCP credentials or the Pub/Sub emulator whenever either
 * is configured — that matches Unity EventBus → Console live delivery.
 */
export function localEventBusEnabled(): boolean {
  return !hasCredentials();
}
