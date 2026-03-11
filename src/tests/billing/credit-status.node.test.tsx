/**
 * Credit Status flow tests.
 *
 * Covers the "Do I have credits?" user journey:
 *   - Gating billable actions when credits are missing (BillableActionGuard)
 *   - Displaying balance on the billing page (Main component)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, renderHook, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

import { BillableActionGuard } from '@/components/Billing/BillableActionGuard';
import Main from '@/components/Pages/Billing/Main';
import { useBillingStatus } from '@/hooks/Billing/useBillingStatus';

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

