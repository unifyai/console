/**
 * Credit Status flow tests.
 *
 * Covers the "Do I have credits?" user journey:
 *   - Gating billable actions when credits are missing (BillableActionGuard)
 *   - Displaying balance on the billing page (Main component)
 *   - Post-checkout billing status polling
 *   - Real-time billing events via SSE (useBillingEvents hook)
 *   - Billing events SSE stream route (Pub/Sub + local fallback)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { EventEmitter } from 'events';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';
import { NextRequest } from 'next/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { BillableActionGuard } from '@/components/Billing/BillableActionGuard';
import Main from '@/components/Pages/Billing/Main';
import { useBillingStatus } from '@/hooks/Billing/useBillingStatus';
import { useBillingEvents } from '@/hooks/Billing/useBillingEvents';

import {
  createMockActions,
  createQueryWrapper,
  waitForMainLoaded,
  DEFAULT_BALANCE,
} from './mocks/actions';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/billing',
}));

// ─── SSE stream route mocks (Pub/Sub, auth, orchestra client) ────────────────

const createdSubscriptions: Array<{ name: string; opts: any }> = [];
const deletedSubscriptions: string[] = [];
const mockSubscriptionInstances = new Map<string, EventEmitter>();

const mockTopicCreateSubscription = vi.fn(async (name: string, opts: any) => {
  createdSubscriptions.push({ name, opts });
  return [{ name }];
});

const mockTopic = { createSubscription: mockTopicCreateSubscription };

const mockSubscription = vi.fn((name: string) => {
  let emitter = mockSubscriptionInstances.get(name);
  if (!emitter) {
    emitter = new EventEmitter();
    (emitter as any).close = vi.fn();
    (emitter as any).delete = vi.fn(async () => {
      deletedSubscriptions.push(name);
    });
    mockSubscriptionInstances.set(name, emitter);
  }
  return emitter;
});

vi.mock('@google-cloud/pubsub', () => ({
  PubSub: class MockPubSub {
    topic() {
      return mockTopic;
    }
    subscription(name: string) {
      return mockSubscription(name);
    }
  },
}));

vi.mock('google-auth-library', () => ({
  GoogleAuth: class MockGoogleAuth {
    async getClient() {
      return { request: vi.fn() };
    }
  },
}));

vi.mock('fs', () => ({
  default: { readFileSync: vi.fn() },
  readFileSync: vi.fn(),
}));

vi.mock('@/app/api/_utils/auth', () => ({
  getApiKeyFromRequest: vi.fn(async () => 'test-api-key'),
  unauthorized: vi.fn(() => new Response('Unauthorized', { status: 401 })),
}));

vi.mock('@/lib/orchestra/orchestra-client', () => ({
  getOrchestraUserClient: vi.fn(async () => ({
    get: vi.fn(async () => ({
      data: { billingAccountId: 42 },
    })),
  })),
}));

// ─── Mock EventSource for useBillingEvents hook tests ────────────────────────

type EventSourceListener = ((event: MessageEvent) => void) | null;

class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  onopen: (() => void) | null = null;
  onmessage: EventSourceListener = null;
  onerror: (() => void) | null = null;
  readyState = 0; // CONNECTING

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.onopen?.();
    }, 0);
  }

  close() {
    this.readyState = 2; // CLOSED
  }

  simulateMessage(data: Record<string, unknown>) {
    const event = new MessageEvent('message', {
      data: JSON.stringify(data),
    });
    this.onmessage?.(event);
  }

  simulateError() {
    this.onerror?.();
  }
}

afterEach(() => {
  vi.clearAllMocks();
  mockSearchParams.delete('sessionId');
});

// =============================================================================
// 1. Gating billable actions
// =============================================================================

describe('Gating billable actions', () => {
  describe('Guard component with live billing status', () => {
    it('lets user interact with button when they have credits', async () => {
      server.use(
        http.get('/api/billing/balance', () =>
          HttpResponse.json({ balance: '25.00', fullBalance: 25, lastRechargeAt: '2025-01-01' }),
        ),
      );

      const onClick = vi.fn();
      render(
        <BillableActionGuard>
          <button onClick={onClick}>Hire</button>
        </BillableActionGuard>,
        { wrapper: createQueryWrapper() },
      );

      // Wait for billing status to load — button should stay enabled
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Hire' })).not.toBeDisabled();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Hire' }));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('disables button and shows guard wrapper when no credits', async () => {
      server.use(
        http.get('/api/billing/balance', () =>
          HttpResponse.json({ balance: '0.00', fullBalance: 0, lastRechargeAt: null }),
        ),
      );

      render(
        <BillableActionGuard>
          <button>Hire</button>
        </BillableActionGuard>,
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Hire' })).toBeDisabled();
      });
      expect(screen.getByTestId('billable-action-guard')).toBeInTheDocument();
    });

    it('respects creditsRequired threshold', async () => {
      server.use(
        http.get('/api/billing/balance', () =>
          HttpResponse.json({ balance: '3.00', fullBalance: 3, lastRechargeAt: '2025-01-01' }),
        ),
      );

      render(
        <BillableActionGuard creditsRequired={5}>
          <button>Run Expensive Task</button>
        </BillableActionGuard>,
        { wrapper: createQueryWrapper() },
      );

      // User has $3 but needs $5 — should be blocked
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Run Expensive Task' })).toBeDisabled();
      });
    });
  });

  describe('Guard component with explicit props', () => {
    it('"purchase credits" link fires the onAddPaymentMethod callback', async () => {
      const onAdd = vi.fn();
      const user = userEvent.setup();

      render(
        <BillableActionGuard hasCredits={false} onAddPaymentMethod={onAdd}>
          <button>Hire</button>
        </BillableActionGuard>,
        { wrapper: createQueryWrapper() },
      );

      // Hover over guard to open tooltip
      await user.hover(screen.getByTestId('billable-action-guard'));

      const links = await screen.findAllByTestId('buy-credits-link');
      expect(links.length).toBeGreaterThanOrEqual(1);

      await user.click(links[0]);
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it('applies aria-disabled to non-button elements', () => {
      render(
        <BillableActionGuard hasCredits={false}>
          <div data-testid="custom-element">Custom Action</div>
        </BillableActionGuard>,
        { wrapper: createQueryWrapper() },
      );

      expect(screen.getByTestId('custom-element')).toHaveAttribute('aria-disabled', 'true');
    });
  });
});

// =============================================================================
// 3. Balance display on billing page
// =============================================================================

describe('Balance display on billing page', () => {
  it('shows formatted balance after data loads', async () => {
    const actions = createMockActions();
    render(<Main actions={actions} />);

    await waitForMainLoaded();

    expect(screen.getByText(`$${DEFAULT_BALANCE.balance}`)).toBeInTheDocument();
  });

  it('shows loading indicator before data arrives', () => {
    const actions = createMockActions({
      getBalance: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
      getAutoRecharge: vi.fn().mockReturnValue(new Promise(() => {})),
    });

    render(<Main actions={actions} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays zero when balance is null', async () => {
    const actions = createMockActions({
      getBalance: vi.fn().mockResolvedValue({
        ...DEFAULT_BALANCE,
        balance: null,
      }),
    });
    render(<Main actions={actions} />);

    await waitForMainLoaded();

    // Template literal: `$${balance ?? 0}` renders "$0" when balance is null
    expect(screen.getByText('$0')).toBeInTheDocument();
  });

  it('shows org-specific balance description when in org context', async () => {
    const actions = createMockActions();
    render(
      <Main
        actions={actions}
        orgContext={{ orgId: 1, orgName: 'Acme Corp', canEdit: true }}
      />,
    );

    await waitForMainLoaded();

    expect(
      screen.getByText('Credits and payment methods for Acme Corp'),
    ).toBeInTheDocument();
  });

  it('shows personal balance description when no org context', async () => {
    const actions = createMockActions();
    render(<Main actions={actions} />);

    await waitForMainLoaded();

    expect(
      screen.getByText('Manage your credits and payment methods'),
    ).toBeInTheDocument();
  });
});

// =============================================================================
// 4. Post-checkout billing status polling
// =============================================================================

describe('Post-checkout billing status polling', () => {
  it('detects credits when they land after startPolling is called', async () => {
    let balance = 0;
    server.use(
      http.get('/api/billing/balance', () =>
        HttpResponse.json({
          balance: balance.toFixed(2),
          fullBalance: balance,
          lastRechargeAt: balance > 0 ? '2025-01-01' : null,
          accountStatus: 'ACTIVE',
        }),
      ),
    );

    const { result } = renderHook(() => useBillingStatus(), {
      wrapper: createQueryWrapper(),
    });

    // Wait for initial fetch — no credits yet
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.hasCredits).toBe(false);
    expect(result.current.credits).toBe(0);

    // Simulate checkout completing → start polling
    act(() => {
      result.current.startPolling();
    });

    // Simulate webhook processing — credits added
    balance = 25;

    // Polling (every 2 s) should pick up the new balance
    await waitFor(
      () => {
        expect(result.current.hasCredits).toBe(true);
      },
      { timeout: 10_000 },
    );
    expect(result.current.credits).toBe(25);
  });

  it('guard lifts automatically once polling detects credits', async () => {
    let balance = 0;
    server.use(
      http.get('/api/billing/balance', () =>
        HttpResponse.json({
          balance: balance.toFixed(2),
          fullBalance: balance,
          lastRechargeAt: null,
          accountStatus: 'ACTIVE',
        }),
      ),
    );

    // Render both the guard and the hook so they share the same QueryClient
    const wrapper = createQueryWrapper();
    let hookResult: ReturnType<typeof useBillingStatus> | undefined;

    function StatusPoller() {
      hookResult = useBillingStatus();
      return null;
    }

    render(
      <>
        <StatusPoller />
        <BillableActionGuard>
          <button>Hire</button>
        </BillableActionGuard>
      </>,
      { wrapper },
    );

    // Guard blocks the button initially
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Hire' })).toBeDisabled();
    });

    // Simulate checkout success → start polling via the hook
    act(() => {
      hookResult!.startPolling();
    });

    // Simulate webhook processing — credits added
    balance = 25;

    // Guard should lift once polling detects credits
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: 'Hire' })).not.toBeDisabled();
      },
      { timeout: 10_000 },
    );
  });
});

// =============================================================================
// 5. Real-time billing events (useBillingEvents hook)
// =============================================================================

describe('Real-time billing events (useBillingEvents hook)', () => {
  let originalEventSource: typeof EventSource;

  function createHookWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const Wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
    return { Wrapper, queryClient, invalidateSpy };
  }

  beforeEach(() => {
    MockEventSource.instances = [];
    originalEventSource = globalThis.EventSource;
    (globalThis as any).EventSource = MockEventSource;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    (globalThis as any).EventSource = originalEventSource;
    vi.useRealTimers();
  });

  it('opens an EventSource to the billing events stream', async () => {
    const { Wrapper } = createHookWrapper();
    renderHook(() => useBillingEvents(), { wrapper: Wrapper });

    await vi.advanceTimersByTimeAsync(10);

    expect(MockEventSource.instances.length).toBe(1);
    expect(MockEventSource.instances[0].url).toBe('/api/billing/events/stream');
  });

  it('invalidates billing query on credits_exhausted', async () => {
    const { Wrapper, invalidateSpy } = createHookWrapper();
    renderHook(() => useBillingEvents(), { wrapper: Wrapper });

    await vi.advanceTimersByTimeAsync(10);
    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateMessage({ event_type: 'credits_exhausted', balance: -0.42 });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['billing', 'status'],
    });
  });

  it('invalidates billing query on credits_restored', async () => {
    const { Wrapper, invalidateSpy } = createHookWrapper();
    renderHook(() => useBillingEvents(), { wrapper: Wrapper });

    await vi.advanceTimersByTimeAsync(10);
    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateMessage({ event_type: 'credits_restored', balance: 25.0 });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['billing', 'status'],
    });
  });

  it('ignores unknown event types', async () => {
    const { Wrapper, invalidateSpy } = createHookWrapper();
    renderHook(() => useBillingEvents(), { wrapper: Wrapper });

    await vi.advanceTimersByTimeAsync(10);
    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateMessage({ event_type: 'unknown_event', balance: 10 });
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('deduplicates repeated events of the same type within the window', async () => {
    const { Wrapper, invalidateSpy } = createHookWrapper();
    renderHook(() => useBillingEvents(), { wrapper: Wrapper });

    await vi.advanceTimersByTimeAsync(10);
    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateMessage({ event_type: 'credits_exhausted', balance: -1 });
    });
    act(() => {
      es.simulateMessage({ event_type: 'credits_exhausted', balance: -2 });
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it('allows different event types in sequence', async () => {
    const { Wrapper, invalidateSpy } = createHookWrapper();
    renderHook(() => useBillingEvents(), { wrapper: Wrapper });

    await vi.advanceTimersByTimeAsync(10);
    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateMessage({ event_type: 'credits_exhausted', balance: -1 });
    });
    act(() => {
      es.simulateMessage({ event_type: 'credits_restored', balance: 25 });
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
  });

  it('closes EventSource on unmount', async () => {
    const { Wrapper } = createHookWrapper();
    const { unmount } = renderHook(() => useBillingEvents(), { wrapper: Wrapper });

    await vi.advanceTimersByTimeAsync(10);
    const es = MockEventSource.instances[0];

    unmount();

    expect(es.readyState).toBe(2); // CLOSED
  });
});

// =============================================================================
// 6. Billing events SSE stream route
// =============================================================================

describe('Billing events SSE stream route', () => {
  const TEST_PROJECT_ID = 'my-gcp-project';
  const MOCK_CREDENTIALS = JSON.stringify({ project_id: TEST_PROJECT_ID });

  function makeMockMessage(
    payload: Record<string, unknown>,
    opts: { id?: string } = {}
  ) {
    return {
      data: Buffer.from(JSON.stringify(payload)),
      id: opts.id || 'msg-1',
      publishTime: new Date(),
      ack: vi.fn(),
      nack: vi.fn(),
    };
  }

  async function drainStream(response: Response): Promise<string> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const parts: string[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(decoder.decode(value, { stream: true }));
    }

    reader.releaseLock();
    return parts.join('');
  }

  beforeEach(() => {
    vi.stubEnv('COMMS_SERVICE_ACCOUNT_CREDENTIALS', MOCK_CREDENTIALS);
    vi.stubEnv('ORCHESTRA_URL', 'http://orchestra-service');
    createdSubscriptions.length = 0;
    deletedSubscriptions.length = 0;
    mockSubscriptionInstances.clear();
    mockTopicCreateSubscription.mockClear();
    mockSubscription.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates a unique ephemeral subscription per connection', async () => {
    const ctrl1 = new AbortController();
    const ctrl2 = new AbortController();

    const { GET } = await import('@/app/api/billing/events/stream/route');

    const req1 = new NextRequest('http://localhost/api/billing/events/stream', {
      method: 'GET',
      signal: ctrl1.signal,
    });
    const req2 = new NextRequest('http://localhost/api/billing/events/stream', {
      method: 'GET',
      signal: ctrl2.signal,
    });

    const [res1, res2] = await Promise.all([GET(req1), GET(req2)]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(createdSubscriptions.length).toBe(2);
    expect(createdSubscriptions[0].name).not.toBe(createdSubscriptions[1].name);

    for (const sub of createdSubscriptions) {
      expect(sub.name).toContain('billing-account-42');
      expect(sub.name).toContain('-sse-');
    }

    ctrl1.abort();
    ctrl2.abort();
    await Promise.all([drainStream(res1), drainStream(res2)]);
  });

  it('creates subscription with billing_event filter', async () => {
    const controller = new AbortController();

    const { GET } = await import('@/app/api/billing/events/stream/route');

    const req = new NextRequest('http://localhost/api/billing/events/stream', {
      method: 'GET',
      signal: controller.signal,
    });
    const res = await GET(req);

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();
    await drainStream(res);

    expect(createdSubscriptions.length).toBe(1);
    const opts = createdSubscriptions[0].opts;
    expect(opts.filter).toBe('attributes.thread = "billing_event"');
    expect(opts.expirationPolicy.ttl.seconds).toBe(86400);
    expect(opts.messageRetentionDuration.seconds).toBe(600);
  });

  it('deletes the ephemeral subscription when the stream ends', async () => {
    const controller = new AbortController();

    const { GET } = await import('@/app/api/billing/events/stream/route');

    const req = new NextRequest('http://localhost/api/billing/events/stream', {
      method: 'GET',
      signal: controller.signal,
    });
    const res = await GET(req);

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();
    await drainStream(res);

    await new Promise((r) => setTimeout(r, 50));

    expect(deletedSubscriptions.length).toBeGreaterThanOrEqual(1);
    expect(deletedSubscriptions[0]).toContain('-sse-');
  });

  it('returns proper SSE headers', async () => {
    const controller = new AbortController();

    const { GET } = await import('@/app/api/billing/events/stream/route');

    const req = new NextRequest('http://localhost/api/billing/events/stream', {
      method: 'GET',
      signal: controller.signal,
    });
    const response = await GET(req);

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(response.headers.get('X-Accel-Buffering')).toBe('no');

    controller.abort();
    await drainStream(response);
  });

  it('streams billing events as SSE data lines', async () => {
    const controller = new AbortController();

    const { GET } = await import('@/app/api/billing/events/stream/route');

    const req = new NextRequest('http://localhost/api/billing/events/stream', {
      method: 'GET',
      signal: controller.signal,
    });
    const response = await GET(req);

    await new Promise((r) => setTimeout(r, 50));

    const msg = makeMockMessage(
      { event_type: 'credits_exhausted', billing_account_id: 42, balance: -0.42 },
      { id: 'billing-msg-1' }
    );

    const subEmitter = [...mockSubscriptionInstances.values()][0];
    subEmitter?.emit('message', msg);

    await new Promise((r) => setTimeout(r, 50));
    controller.abort();

    const allData = await drainStream(response);
    expect(allData).toContain(': connected');

    const dataLines = allData.split('\n').filter((l) => l.startsWith('data: '));
    expect(dataLines.length).toBe(1);

    const parsed = JSON.parse(dataLines[0].replace('data: ', ''));
    expect(parsed.event_type).toBe('credits_exhausted');
    expect(parsed.balance).toBe(-0.42);
    expect(parsed.id).toBe('billing-msg-1');
    expect(msg.ack).toHaveBeenCalled();
  });

  it('uses local event bus when no credentials are configured', async () => {
    vi.stubEnv('COMMS_SERVICE_ACCOUNT_CREDENTIALS', '');
    vi.stubEnv('PUBSUB_EMULATOR_HOST', '');

    const controller = new AbortController();

    const { GET } = await import('@/app/api/billing/events/stream/route');

    const req = new NextRequest('http://localhost/api/billing/events/stream', {
      method: 'GET',
      signal: controller.signal,
    });
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(createdSubscriptions.length).toBe(0);

    controller.abort();
    await drainStream(response);
  });
});

