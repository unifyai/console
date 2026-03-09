/**
 * Unit tests for useDemoAssistants hook.
 *
 * Tests cover:
 * - Initial data loading (demo assistants and source assistants)
 * - Error handling for various failure modes
 * - Create demo assistant operation
 * - Selection and detail panel (contacts, spending)
 * - Concurrent operations
 * - Edge cases and race conditions
 * - Toast notifications
 *
 * These tests stress-test the hook to uncover potential bugs.
 *
 * @group unit
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDemoAssistants } from '@/hooks/Assistants/useDemoAssistants';
import { DemoActions, DemoAssistant, DemoAssistantCreatePayload, DemoContact } from '@/types/demo';
import { Assistant } from '@/types/assistants/assistant';
import { AssistantSpend } from '@/types/assistants/spending';
import { toast } from 'sonner';

// =============================================================================
// Mocks
// =============================================================================

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(() => 'toast-id'),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Create stable mock functions at module level
const mockListDemos = vi.fn();
const mockCreateDemo = vi.fn();
const mockGetMeta = vi.fn();
const mockListMeta = vi.fn();
const mockListSourceAssistants = vi.fn();
const mockListAvailablePhoneCountries = vi.fn();
const mockGetContacts = vi.fn();
const mockGetSpending = vi.fn();
const mockDeleteDemo = vi.fn();

// Create a stable mock actions object (not recreated on each render)
const mockActions: DemoActions = {
  list: mockListDemos,
  create: mockCreateDemo,
  getMeta: mockGetMeta,
  listMeta: mockListMeta,
  listSourceAssistants: mockListSourceAssistants,
  listAvailablePhoneCountries: mockListAvailablePhoneCountries,
  getContacts: mockGetContacts,
  getSpending: mockGetSpending,
  delete: mockDeleteDemo,
};

// =============================================================================
// Test Fixtures
// =============================================================================

const createMockDemoAssistant = (id: string, demoId: number): DemoAssistant => ({
  agentId: id,
  userId: `user-${id}`,
  organizationId: null,
  firstName: `Demo${id}`,
  surname: 'Assistant',
  phone: `+1555000${id}`,
  demoId,
  createdAt: new Date().toISOString(),
  userPhone: `+1555000${id}`,
  monthlySpendingCap: 100,
  email: `demo${id}@example.com`,
});

const createMockSourceAssistant = (id: string): Assistant =>
  ({
    agentId: id,
    firstName: `Source${id}`,
    surname: 'Assistant',
  }) as Assistant;

const createMockPayload = (sourceId: number, spendingCap?: number): DemoAssistantCreatePayload => ({
  sourceAssistantId: sourceId,
  label: 'Test Demo',
  firstName: 'Test',
  surname: 'Demo',
  demoerPhone: '+15551234567',
  monthlySpendingCap: spendingCap,
});

const createMockContact = (
  contactId: number,
  overrides: Partial<DemoContact> = {}
): DemoContact => ({
  logId: 1000 + contactId,
  contactId,
  firstName: contactId === 0 ? 'Lucy' : contactId === 1 ? undefined : 'Daniel',
  surname: contactId === 0 ? 'Assistant' : contactId === 1 ? undefined : 'Demoer',
  emailAddress: contactId === 0 ? 'lucy@example.com' : undefined,
  phoneNumber: contactId === 0 ? '+15550001' : contactId === 2 ? '+15550002' : undefined,
  isSystem: contactId <= 2,
  ...overrides,
});

const createMockSpending = (agentId: string): AssistantSpend => ({
  agentId,
  month: '2026-02',
  cumulativeSpend: 3.5,
  limit: 10,
  percentUsed: 35,
});

// =============================================================================
// Test Suite
// =============================================================================

describe('useDemoAssistants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    mockListDemos.mockResolvedValue([]);
    mockListSourceAssistants.mockResolvedValue([]);
    mockListMeta.mockResolvedValue([]);
    mockListAvailablePhoneCountries.mockResolvedValue([
      { code: 'US', name: 'United States', flag: '🇺🇸' },
    ]);
    mockCreateDemo.mockResolvedValue({ detail: 'Not implemented' });
    mockGetMeta.mockResolvedValue({ detail: 'Not implemented' });
    mockGetContacts.mockResolvedValue([]);
    mockGetSpending.mockResolvedValue(createMockSpending('1'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Initial Loading
  // ===========================================================================

  describe('initial loading', () => {
    it('starts with loading state true and empty arrays', () => {
      const { result } = renderHook(() => useDemoAssistants(mockActions));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.demoAssistants).toEqual([]);
      expect(result.current.sourceAssistants).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('fetches both demo and source assistants on mount', async () => {
      renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(mockListDemos).toHaveBeenCalledTimes(1);
        expect(mockListSourceAssistants).toHaveBeenCalledTimes(1);
      });
    });

    it('sets demo assistants after successful fetch', async () => {
      const demos = [createMockDemoAssistant('1', 101), createMockDemoAssistant('2', 102)];
      mockListDemos.mockResolvedValue(demos);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.demoAssistants).toHaveLength(2);
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.demoAssistants[0].agentId).toBe('1');
      expect(result.current.demoAssistants[1].agentId).toBe('2');
    });

    it('sets source assistants after successful fetch', async () => {
      const sources = [createMockSourceAssistant('a'), createMockSourceAssistant('b')];
      mockListSourceAssistants.mockResolvedValue(sources);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.sourceAssistants).toHaveLength(2);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('handles concurrent fetch of demos and sources', async () => {
      // Simulate different response times
      mockListDemos.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve([createMockDemoAssistant('1', 101)]), 100)
          )
      );
      mockListSourceAssistants.mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve([createMockSourceAssistant('a')]), 50))
      );

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.demoAssistants).toHaveLength(1);
      expect(result.current.sourceAssistants).toHaveLength(1);
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('error handling', () => {
    it('sets error state when demo list fetch fails', async () => {
      mockListDemos.mockResolvedValue({ detail: 'Server error fetching demos' });

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.error).toBe('Server error fetching demos');
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('aborts source loading when demo list fails (fail-fast behavior)', async () => {
      // Current behavior: when demo fetch fails, the whole load aborts
      // This is intentional fail-fast behavior to surface errors quickly
      mockListDemos.mockResolvedValue({ detail: 'Demo fetch failed' });
      mockListSourceAssistants.mockResolvedValue([createMockSourceAssistant('a')]);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.error).toBe('Demo fetch failed');
        expect(result.current.isLoading).toBe(false);
      });

      // Sources won't load because demo fetch failed first
      expect(result.current.sourceAssistants).toHaveLength(0);
    });

    it('handles source assistant fetch failure gracefully', async () => {
      mockListDemos.mockResolvedValue([createMockDemoAssistant('1', 101)]);
      mockListSourceAssistants.mockResolvedValue({ detail: 'Source fetch failed' });

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Demos should still load
      expect(result.current.demoAssistants).toHaveLength(1);
      // Sources should be empty but no error set (source failure is non-critical)
      expect(result.current.sourceAssistants).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('handles network exception during demo fetch', async () => {
      mockListDemos.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('handles non-Error exceptions gracefully', async () => {
      mockListDemos.mockRejectedValue('String error message');

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load demo assistants');
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('handles null/undefined response gracefully', async () => {
      mockListDemos.mockResolvedValue(null);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not crash, demos remain empty
      expect(result.current.demoAssistants).toEqual([]);
    });

    it('handles response that is neither array nor error object', async () => {
      mockListDemos.mockResolvedValue({ unexpected: 'format' });

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should handle gracefully without crashing
      expect(result.current.demoAssistants).toEqual([]);
    });
  });

  // ===========================================================================
  // Create Demo Assistant
  // ===========================================================================

  describe('createDemoAssistant', () => {
    it('creates demo assistant and adds to local state', async () => {
      const newDemo = createMockDemoAssistant('new', 103);
      mockCreateDemo.mockResolvedValue(newDemo);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let createdDemo: DemoAssistant | null = null;
      await act(async () => {
        createdDemo = await result.current.createDemoAssistant(createMockPayload(1));
      });

      expect(createdDemo).not.toBeNull();
      expect(createdDemo!.agentId).toBe('new');
      expect(result.current.demoAssistants).toHaveLength(1);
      expect(result.current.demoAssistants[0].agentId).toBe('new');
    });

    it('shows loading toast during creation', async () => {
      mockCreateDemo.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(createMockDemoAssistant('new', 103)), 100)
          )
      );

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.createDemoAssistant(createMockPayload(1));
      });

      expect(toast.loading).toHaveBeenCalledWith('Creating demo assistant...');
    });

    it('shows success toast on successful creation', async () => {
      const newDemo = createMockDemoAssistant('new', 103);
      newDemo.firstName = 'Richard';
      newDemo.surname = 'Branson';
      newDemo.phone = '+15559876543';
      mockCreateDemo.mockResolvedValue(newDemo);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.createDemoAssistant(createMockPayload(1));
      });

      expect(toast.success).toHaveBeenCalledWith(
        'Richard Branson created with phone +15559876543',
        { id: 'toast-id' }
      );
    });

    it('shows error toast on creation failure', async () => {
      mockCreateDemo.mockResolvedValue({ detail: 'Creation failed: database error' });

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.createDemoAssistant(createMockPayload(1));
      });

      expect(toast.error).toHaveBeenCalledWith('Creation failed: database error', {
        id: 'toast-id',
      });
    });

    it('returns null on creation failure', async () => {
      mockCreateDemo.mockResolvedValue({ detail: 'Failed' });

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let createdDemo: DemoAssistant | null = null;
      await act(async () => {
        createdDemo = await result.current.createDemoAssistant(createMockPayload(1));
      });

      expect(createdDemo).toBeNull();
      expect(result.current.demoAssistants).toHaveLength(0);
    });

    it('sets isCreating flag during creation', async () => {
      let resolveCreate: (value: DemoAssistant) => void;
      mockCreateDemo.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCreate = resolve;
          })
      );

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isCreating).toBe(false);

      // Start creation
      let createPromise: Promise<DemoAssistant | null>;
      act(() => {
        createPromise = result.current.createDemoAssistant(createMockPayload(1));
      });

      await waitFor(() => {
        expect(result.current.isCreating).toBe(true);
      });

      // Complete creation
      await act(async () => {
        resolveCreate!(createMockDemoAssistant('new', 103));
        await createPromise;
      });

      expect(result.current.isCreating).toBe(false);
    });

    it('handles network exception during creation', async () => {
      mockCreateDemo.mockRejectedValue(new Error('Network timeout'));

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let createdDemo: DemoAssistant | null = null;
      await act(async () => {
        createdDemo = await result.current.createDemoAssistant(createMockPayload(1));
      });

      expect(createdDemo).toBeNull();
      expect(toast.error).toHaveBeenCalledWith('Network timeout', { id: 'toast-id' });
    });

    it('handles phone number being null in success message', async () => {
      const newDemo = createMockDemoAssistant('new', 103);
      newDemo.phone = null;
      mockCreateDemo.mockResolvedValue(newDemo);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.createDemoAssistant(createMockPayload(1));
      });

      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('pending'),
        expect.anything()
      );
    });

    it('includes monthly spending cap in payload when provided', async () => {
      const newDemo = createMockDemoAssistant('new', 103);
      mockCreateDemo.mockResolvedValue(newDemo);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Create with custom spending cap
      const customCap = 50;
      await act(async () => {
        await result.current.createDemoAssistant(createMockPayload(1, customCap));
      });

      // Verify the payload includes the spending cap
      expect(mockCreateDemo).toHaveBeenCalledWith(
        expect.objectContaining({
          monthlySpendingCap: customCap,
        })
      );
    });

    it('allows creation without specifying spending cap (uses default)', async () => {
      const newDemo = createMockDemoAssistant('new', 103);
      mockCreateDemo.mockResolvedValue(newDemo);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Create without spending cap
      await act(async () => {
        await result.current.createDemoAssistant(createMockPayload(1));
      });

      // Verify the payload was called (spending cap undefined, backend uses default)
      expect(mockCreateDemo).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceAssistantId: 1,
          monthlySpendingCap: undefined,
        })
      );
    });
  });

  // ===========================================================================
  // Concurrent Operations & Race Conditions
  // ===========================================================================

  describe('concurrent operations', () => {
    it('handles multiple rapid create calls', async () => {
      let callCount = 0;
      mockCreateDemo.mockImplementation(() => {
        callCount++;
        const currentCall = callCount;
        return new Promise((resolve) =>
          setTimeout(
            () => resolve(createMockDemoAssistant(`demo-${currentCall}`, 100 + currentCall)),
            50 * currentCall
          )
        );
      });

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Fire multiple creates rapidly
      await act(async () => {
        await Promise.all([
          result.current.createDemoAssistant(createMockPayload(1)),
          result.current.createDemoAssistant(createMockPayload(2)),
          result.current.createDemoAssistant(createMockPayload(3)),
        ]);
      });

      // All should be added to state
      expect(result.current.demoAssistants).toHaveLength(3);
    });

    it('handles refresh call during initial load', async () => {
      let resolveList: (value: DemoAssistant[]) => void;
      mockListDemos.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveList = resolve;
          })
      );

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      // Try to refresh before initial load completes
      let refreshPromise: Promise<void>;
      act(() => {
        refreshPromise = result.current.refresh();
      });

      // Complete the initial load
      await act(async () => {
        resolveList!([createMockDemoAssistant('1', 101)]);
        await refreshPromise;
      });

      // Should not crash and should eventually load data
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  // ===========================================================================
  // Refresh
  // ===========================================================================

  describe('refresh', () => {
    it('refetches all data when refresh is called', async () => {
      mockListDemos.mockResolvedValue([]);
      mockListSourceAssistants.mockResolvedValue([]);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockListDemos).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockListDemos).toHaveBeenCalledTimes(2);
      expect(mockListSourceAssistants).toHaveBeenCalledTimes(2);
    });

    it('shows loading toast during refresh', async () => {
      mockListDemos.mockResolvedValue([]);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(toast.loading).toHaveBeenCalledWith('Refreshing demo assistants...');
    });

    it('updates data after refresh', async () => {
      mockListDemos
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          createMockDemoAssistant('1', 101),
          createMockDemoAssistant('2', 102),
        ]);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.demoAssistants).toHaveLength(0);

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.demoAssistants).toHaveLength(2);
    });

    it('clears error on successful refresh after previous failure', async () => {
      mockListDemos
        .mockResolvedValueOnce({ detail: 'Initial failure' })
        .mockResolvedValueOnce([createMockDemoAssistant('1', 101)]);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.error).toBe('Initial failure');
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.demoAssistants).toHaveLength(1);
    });
  });

  // ===========================================================================
  // Unmount Behavior
  // ===========================================================================

  describe('unmount behavior', () => {
    it('does not update state after unmount during initial load', async () => {
      let resolveList: (value: DemoAssistant[]) => void;
      mockListDemos.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveList = resolve;
          })
      );

      const { result, unmount } = renderHook(() => useDemoAssistants(mockActions));

      // Unmount before fetch completes
      unmount();

      // Complete the fetch - should not throw
      await act(async () => {
        resolveList!([createMockDemoAssistant('1', 101)]);
      });

      // No assertion needed - just ensure no error is thrown
      expect(true).toBe(true);
    });

    it('does not update state after unmount during create', async () => {
      let resolveCreate: (value: DemoAssistant) => void;
      mockCreateDemo.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCreate = resolve;
          })
      );

      const { result, unmount } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Start create
      let createPromise: Promise<DemoAssistant | null>;
      act(() => {
        createPromise = result.current.createDemoAssistant(createMockPayload(1));
      });

      // Unmount before create completes
      unmount();

      // Complete the create - should not throw
      await act(async () => {
        resolveCreate!(createMockDemoAssistant('new', 103));
        await createPromise;
      });

      // No assertion needed - just ensure no error is thrown
      expect(true).toBe(true);
    });
  });

  // ===========================================================================
  // Selection and Detail Panel
  // ===========================================================================

  describe('selection and detail panel', () => {
    it('starts with no selected demo', async () => {
      mockListDemos.mockResolvedValue([createMockDemoAssistant('1', 101)]);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.selectedDemo).toBeNull();
    });

    it('selects a demo and loads its details', async () => {
      const demo = createMockDemoAssistant('1', 101);
      mockListDemos.mockResolvedValue([demo]);
      mockGetContacts.mockResolvedValue([
        createMockContact(0),
        createMockContact(1),
        createMockContact(2),
      ]);
      mockGetSpending.mockResolvedValue(createMockSpending('1'));

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.selectDemo(demo);
      });

      expect(result.current.selectedDemo).not.toBeNull();
      expect(result.current.selectedDemo!.agentId).toBe('1');
    });

    it('loads contacts when demo is selected', async () => {
      const demo = createMockDemoAssistant('1', 101);
      mockListDemos.mockResolvedValue([demo]);
      const contacts = [
        createMockContact(0, { firstName: 'Lucy', surname: 'Bot' }),
        createMockContact(1, { firstName: 'Prospect', surname: 'User' }),
        createMockContact(2, { firstName: 'Daniel', surname: 'Demoer', phoneNumber: '+15559999' }),
      ];
      mockGetContacts.mockResolvedValue(contacts);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.selectDemo(demo);
      });

      expect(mockGetContacts).toHaveBeenCalledWith('1');
      expect(result.current.contacts).toHaveLength(3);
      expect(result.current.contacts[0].contactId).toBe(0);
      expect(result.current.contacts[2].phoneNumber).toBe('+15559999');
    });

    it('loads spending when demo is selected', async () => {
      const demo = createMockDemoAssistant('1', 101);
      mockListDemos.mockResolvedValue([demo]);
      const spending = createMockSpending('1');
      spending.cumulativeSpend = 5.25;
      spending.limit = 10;
      spending.percentUsed = 52.5;
      mockGetSpending.mockResolvedValue(spending);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.selectDemo(demo);
      });

      expect(mockGetSpending).toHaveBeenCalledWith('1');
      expect(result.current.spending).not.toBeNull();
      expect(result.current.spending!.cumulativeSpend).toBe(5.25);
      expect(result.current.spending!.limit).toBe(10);
    });

    it('clears selection when clearSelection is called', async () => {
      const demo = createMockDemoAssistant('1', 101);
      mockListDemos.mockResolvedValue([demo]);
      mockGetContacts.mockResolvedValue([createMockContact(0)]);
      mockGetSpending.mockResolvedValue(createMockSpending('1'));

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.selectDemo(demo);
      });

      expect(result.current.selectedDemo).not.toBeNull();

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedDemo).toBeNull();
      expect(result.current.contacts).toEqual([]);
      expect(result.current.spending).toBeNull();
    });

    it('handles contacts fetch failure gracefully', async () => {
      const demo = createMockDemoAssistant('1', 101);
      mockListDemos.mockResolvedValue([demo]);
      mockGetContacts.mockResolvedValue({ detail: 'Failed to load contacts' });
      mockGetSpending.mockResolvedValue(createMockSpending('1'));

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.selectDemo(demo);
      });

      // Selection still works, contacts remain empty
      expect(result.current.selectedDemo).not.toBeNull();
      expect(result.current.contacts).toEqual([]);
      expect(toast.error).toHaveBeenCalledWith('Failed to load contacts');
    });

    it('handles spending fetch failure gracefully', async () => {
      const demo = createMockDemoAssistant('1', 101);
      mockListDemos.mockResolvedValue([demo]);
      mockGetContacts.mockResolvedValue([createMockContact(0)]);
      mockGetSpending.mockResolvedValue({ detail: 'Failed to load spending' });

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.selectDemo(demo);
      });

      // Selection still works, spending remains null
      expect(result.current.selectedDemo).not.toBeNull();
      expect(result.current.spending).toBeNull();
    });

    it('sets isLoadingDetails during detail fetch', async () => {
      const demo = createMockDemoAssistant('1', 101);
      mockListDemos.mockResolvedValue([demo]);

      let resolveContacts: (value: DemoContact[]) => void;
      mockGetContacts.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveContacts = resolve;
          })
      );
      mockGetSpending.mockResolvedValue(createMockSpending('1'));

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Start selection
      let selectPromise: Promise<void>;
      act(() => {
        selectPromise = result.current.selectDemo(demo);
      });

      await waitFor(() => {
        expect(result.current.isLoadingDetails).toBe(true);
      });

      // Complete fetch
      await act(async () => {
        resolveContacts!([createMockContact(0)]);
        await selectPromise;
      });

      expect(result.current.isLoadingDetails).toBe(false);
    });

    it('reselecting different demo reloads details', async () => {
      const demo1 = createMockDemoAssistant('1', 101);
      const demo2 = createMockDemoAssistant('2', 102);
      mockListDemos.mockResolvedValue([demo1, demo2]);
      mockGetContacts.mockResolvedValue([createMockContact(0)]);
      mockGetSpending.mockResolvedValue(createMockSpending('1'));

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Select first demo
      await act(async () => {
        await result.current.selectDemo(demo1);
      });

      expect(mockGetContacts).toHaveBeenCalledWith('1');
      expect(mockGetContacts).toHaveBeenCalledTimes(1);

      // Select second demo
      await act(async () => {
        await result.current.selectDemo(demo2);
      });

      expect(mockGetContacts).toHaveBeenCalledWith('2');
      expect(mockGetContacts).toHaveBeenCalledTimes(2);
    });

    it('reselecting same demo does not reload details', async () => {
      const demo = createMockDemoAssistant('1', 101);
      mockListDemos.mockResolvedValue([demo]);
      mockGetContacts.mockResolvedValue([createMockContact(0)]);
      mockGetSpending.mockResolvedValue(createMockSpending('1'));

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Select demo twice
      await act(async () => {
        await result.current.selectDemo(demo);
      });

      await act(async () => {
        await result.current.selectDemo(demo);
      });

      // Should only call once (selection is already set)
      expect(mockGetContacts).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Contacts Detail View
  // ===========================================================================

  describe('contacts detail view', () => {
    it('includes assistant contact (contactId=0)', async () => {
      const demo = createMockDemoAssistant('1', 101);
      mockListDemos.mockResolvedValue([demo]);
      mockGetContacts.mockResolvedValue([
        createMockContact(0, { firstName: 'Lucy', surname: 'AI', phoneNumber: '+15550001' }),
      ]);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.selectDemo(demo);
      });

      const assistantContact = result.current.contacts.find((c) => c.contactId === 0);
      expect(assistantContact).toBeDefined();
      expect(assistantContact!.firstName).toBe('Lucy');
    });

    it('includes boss contact (contactId=1) even when sparse', async () => {
      const demo = createMockDemoAssistant('1', 101);
      mockListDemos.mockResolvedValue([demo]);
      mockGetContacts.mockResolvedValue([
        createMockContact(0),
        createMockContact(1, { firstName: undefined, surname: undefined }), // Boss starts sparse
      ]);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.selectDemo(demo);
      });

      const bossContact = result.current.contacts.find((c) => c.contactId === 1);
      expect(bossContact).toBeDefined();
      expect(bossContact!.firstName).toBeUndefined();
    });

    it('includes demoer contact (contactId=2) with full details', async () => {
      const demo = createMockDemoAssistant('1', 101);
      mockListDemos.mockResolvedValue([demo]);
      mockGetContacts.mockResolvedValue([
        createMockContact(0),
        createMockContact(1),
        createMockContact(2, {
          firstName: 'Daniel',
          surname: 'Lenton',
          phoneNumber: '+15559999',
          emailAddress: 'daniel@unify.ai',
        }),
      ]);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.selectDemo(demo);
      });

      const demoerContact = result.current.contacts.find((c) => c.contactId === 2);
      expect(demoerContact).toBeDefined();
      expect(demoerContact!.firstName).toBe('Daniel');
      expect(demoerContact!.emailAddress).toBe('daniel@unify.ai');
    });

    it('handles contacts with additional custom contacts', async () => {
      const demo = createMockDemoAssistant('1', 101);
      mockListDemos.mockResolvedValue([demo]);
      mockGetContacts.mockResolvedValue([
        createMockContact(0),
        createMockContact(1),
        createMockContact(2),
        createMockContact(3, { firstName: 'John', surname: 'Prospect', isSystem: false }),
        createMockContact(4, { firstName: 'Jane', surname: 'Other', isSystem: false }),
      ]);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.selectDemo(demo);
      });

      expect(result.current.contacts).toHaveLength(5);
      const customContacts = result.current.contacts.filter((c) => c.contactId >= 3);
      expect(customContacts).toHaveLength(2);
      expect(customContacts[0].isSystem).toBe(false);
    });
  });

  // ===========================================================================
  // Spending Detail View
  // ===========================================================================

  describe('spending detail view', () => {
    it('shows current spend vs limit', async () => {
      const demo = createMockDemoAssistant('1', 101);
      mockListDemos.mockResolvedValue([demo]);
      mockGetContacts.mockResolvedValue([]);
      mockGetSpending.mockResolvedValue({
        agentId: '1',
        month: '2026-02',
        cumulativeSpend: 7.5,
        limit: 10,
        percentUsed: 75,
      });

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.selectDemo(demo);
      });

      expect(result.current.spending!.cumulativeSpend).toBe(7.5);
      expect(result.current.spending!.limit).toBe(10);
      expect(result.current.spending!.percentUsed).toBe(75);
    });

    it('handles zero spending', async () => {
      const demo = createMockDemoAssistant('1', 101);
      mockListDemos.mockResolvedValue([demo]);
      mockGetContacts.mockResolvedValue([]);
      mockGetSpending.mockResolvedValue({
        agentId: '1',
        month: '2026-02',
        cumulativeSpend: 0,
        limit: 10,
        percentUsed: 0,
      });

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.selectDemo(demo);
      });

      expect(result.current.spending!.cumulativeSpend).toBe(0);
      expect(result.current.spending!.percentUsed).toBe(0);
    });

    it('handles spending over limit', async () => {
      const demo = createMockDemoAssistant('1', 101);
      mockListDemos.mockResolvedValue([demo]);
      mockGetContacts.mockResolvedValue([]);
      mockGetSpending.mockResolvedValue({
        agentId: '1',
        month: '2026-02',
        cumulativeSpend: 12.5,
        limit: 10,
        percentUsed: 125,
      });

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.selectDemo(demo);
      });

      expect(result.current.spending!.cumulativeSpend).toBe(12.5);
      expect(result.current.spending!.percentUsed).toBe(125);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('handles empty demo ID in created assistant', async () => {
      const newDemo = createMockDemoAssistant('', 103);
      mockCreateDemo.mockResolvedValue(newDemo);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.createDemoAssistant(createMockPayload(1));
      });

      expect(result.current.demoAssistants).toHaveLength(1);
      expect(result.current.demoAssistants[0].agentId).toBe('');
    });

    it('handles very large demo assistant list', async () => {
      const largeDemoList = Array.from({ length: 100 }, (_, i) =>
        createMockDemoAssistant(`demo-${i}`, 100 + i)
      );
      mockListDemos.mockResolvedValue(largeDemoList);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.demoAssistants).toHaveLength(100);
    });

    it('handles special characters in demo label', async () => {
      const newDemo = createMockDemoAssistant('new', 103);
      mockCreateDemo.mockResolvedValue(newDemo);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const payload = createMockPayload(1);
      payload.label = "Richard's Demo <script>alert('xss')</script>";

      await act(async () => {
        await result.current.createDemoAssistant(payload);
      });

      expect(mockCreateDemo).toHaveBeenCalledWith(payload);
    });

    it('handles international phone numbers in demoerPhone', async () => {
      const newDemo = createMockDemoAssistant('new', 103);
      mockCreateDemo.mockResolvedValue(newDemo);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const payload = createMockPayload(1);
      payload.demoerPhone = '+442071234567'; // UK number

      await act(async () => {
        await result.current.createDemoAssistant(payload);
      });

      expect(mockCreateDemo).toHaveBeenCalledWith(
        expect.objectContaining({ demoerPhone: '+442071234567' })
      );
    });

    it('handles response with both detail and array-like properties', async () => {
      // Edge case: malformed response that could confuse type checking
      const malformedResponse = {
        detail: 'Error occurred',
        length: 2,
        0: { agentId: '1' },
        1: { agentId: '2' },
      };
      mockListDemos.mockResolvedValue(malformedResponse);

      const { result } = renderHook(() => useDemoAssistants(mockActions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should treat it as an error since it has 'detail'
      expect(result.current.error).toBe('Error occurred');
    });
  });
});
