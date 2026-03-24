/**
 * In-memory event bus for local development SSE streaming.
 *
 * When COMMS_SERVICE_ACCOUNT_CREDENTIALS is not configured (typical for local
 * dev), the actions SSE route falls back to this bus instead of GCP Pub/Sub.
 * The simulation script (or any HTTP client) pushes events via the companion
 * POST endpoint at /api/assistant/[assistantId]/actions/push, and all active
 * SSE connections for that assistant receive them in real time.
 *
 * Each SSE connection registers a listener via subscribe(). Events are
 * fan-out: every listener receives every event (same semantics as Pub/Sub
 * ephemeral subscriptions).
 *
 * The bus is stored on globalThis so that the push route and SSE stream route
 * share the same instance even when Next.js dev mode compiles them into
 * separate module contexts (HMR, route-level code splitting).
 */

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
  return !!process.env.COMMS_SERVICE_ACCOUNT_CREDENTIALS || !!process.env.PUBSUB_EMULATOR_HOST;
}
