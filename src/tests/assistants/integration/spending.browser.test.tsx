/**
 * Integration tests for the Assistant Spending feature.
 *
 * Tests cover:
 * - AssistantProfileInfoPanel with spending section
 * - Data fetching via the useAssistantSpending hook
 * - Spending limit updates
 * - Error handling
 *
 * Uses browser environment for full provider context and Radix UI compatibility.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@/tests/render';
import userEvent from '@testing-library/user-event';
import { AssistantProfileInfoPanel } from '@/components/Pages/Assistants/Profile/AssistantProfileInfoPanel';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { AssistantSpend, SpendingLimitResponse } from '@/types/assistants/spending';

const mockFetchAssistantSpend = vi.fn();
const mockFetchAssistantSpendingLimit = vi.fn();
vi.mock('@/lib/client/spending', () => ({
  fetchAssistantSpend: (...args: any[]) => mockFetchAssistantSpend(...args),
  fetchAssistantSpendingLimit: (...args: any[]) => mockFetchAssistantSpendingLimit(...args),
}));

describe('AssistantSpendingIntegration', () => {
  // Mock assistant data
  const mockAssistant: Assistant = {
    agentId: 'test-agent-123',
    firstName: 'Test',
    surname: 'Assistant',
    age: 25,
    nationality: 'American',
    about: 'A test assistant',
    timezone: 'America/New_York',
    profilePhoto: null,
    profileVideo: null,
    signedProfilePhotoUrl: undefined,
    signedProfileVideoUrl: undefined,
    userId: 'user-123',
    organizationId: null,
    voiceId: null,
    voiceProvider: null,
    email: null,
    phone: null,
    assistantWhatsappNumber: null,
    userPhone: null,
    phoneCountry: null,
    userWhatsappNumber: null,
    isUserDesktop: false,
    desktopMode: null,
    weeklyLimit: null,
    maxParallel: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  // Mock spending data
  const mockSpendData: AssistantSpend = {
    agentId: 'test-agent-123',
    month: '2026-01',
    cumulativeSpend: 50.0,
    limit: 100.0,
    percentUsed: 50.0,
  };

  const mockLimitData: SpendingLimitResponse = {
    agentId: 'test-agent-123',
    monthlySpendingCap: 100.0,
    effectiveLimit: 100.0,
  };

  let mockSetLimit: ReturnType<typeof vi.fn>;
  let mockSpendingActions: AssistantActions['spending'];

  beforeEach(() => {
    vi.clearAllMocks();

    mockFetchAssistantSpend.mockResolvedValue(mockSpendData);
    mockFetchAssistantSpendingLimit.mockResolvedValue(mockLimitData);
    mockSetLimit = vi.fn().mockResolvedValue({
      agentId: 'test-agent-123',
      monthlySpendingCap: 200.0,
      effectiveLimit: 200.0,
      info: 'Updated',
    });

    mockSpendingActions = {
      setLimit: mockSetLimit as unknown as AssistantActions['spending']['setLimit'],
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Spending Section Visibility
  // ===========================================================================

  describe('A. Spending Section Visibility', () => {
    it(
      'shows spending section when spendingActions are provided',
      {
        meta: {
          alias: 'Spending-Show',
          behavior: 'Displays spending section with actions',
          scenario: 'Viewing assistant profile with spending enabled',
        },
      },
      async () => {
        render(
          <AssistantProfileInfoPanel
            assistant={mockAssistant}
            onEdit={vi.fn()}
            spendingActions={mockSpendingActions}
          />
        );

        await waitFor(() => {
          expect(screen.getByText('Monthly Spending')).toBeInTheDocument();
        });
      }
    );

    it(
      'hides spending section when spendingActions are not provided',
      {
        meta: {
          alias: 'Spending-Hide',
          behavior: 'Hides spending section without actions',
          scenario: 'Viewing assistant profile without spending enabled',
        },
      },
      async () => {
        render(<AssistantProfileInfoPanel assistant={mockAssistant} onEdit={vi.fn()} />);

        expect(screen.queryByText('Monthly Spending')).not.toBeInTheDocument();
      }
    );
  });

  // ===========================================================================
  // Data Fetching
  // ===========================================================================

  describe('B. Data Fetching', () => {
    it(
      'fetches spend and limit data on mount',
      {
        meta: {
          alias: 'Spending-Fetch',
          behavior: 'Fetches data when component mounts',
          scenario: 'Initial load of spending section',
        },
      },
      async () => {
        render(
          <AssistantProfileInfoPanel
            assistant={mockAssistant}
            onEdit={vi.fn()}
            spendingActions={mockSpendingActions}
          />
        );

        await waitFor(() => {
          expect(mockFetchAssistantSpend).toHaveBeenCalledWith(
            'test-agent-123',
            expect.any(String)
          );
          expect(mockFetchAssistantSpendingLimit).toHaveBeenCalledWith('test-agent-123');
        });
      }
    );

    it(
      'displays fetched spend amount',
      {
        meta: {
          alias: 'Spending-Display',
          behavior: 'Shows spend amount after fetch',
          scenario: 'Data loaded successfully',
        },
      },
      async () => {
        render(
          <AssistantProfileInfoPanel
            assistant={mockAssistant}
            onEdit={vi.fn()}
            spendingActions={mockSpendingActions}
          />
        );

        await waitFor(() => {
          expect(screen.getByText('$50.00')).toBeInTheDocument();
        });
      }
    );

    it(
      'displays progress bar',
      {
        meta: {
          alias: 'Spending-Progress',
          behavior: 'Shows progress bar visualization',
          scenario: 'Data loaded successfully',
        },
      },
      async () => {
        render(
          <AssistantProfileInfoPanel
            assistant={mockAssistant}
            onEdit={vi.fn()}
            spendingActions={mockSpendingActions}
          />
        );

        await waitFor(() => {
          expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });
      }
    );
  });

  // ===========================================================================
  // Loading States
  // ===========================================================================

  describe('C. Loading States', () => {
    it(
      'shows loading state while fetching data',
      {
        meta: {
          alias: 'Spending-Loading',
          behavior: 'Shows loading indicators during fetch',
          scenario: 'Initial data loading',
        },
      },
      async () => {
        mockFetchAssistantSpend.mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve(mockSpendData), 500))
        );

        render(
          <AssistantProfileInfoPanel
            assistant={mockAssistant}
            onEdit={vi.fn()}
            spendingActions={mockSpendingActions}
          />
        );

        // Should show loading initially (skeleton elements)
        expect(screen.getByText('Monthly Spending')).toBeInTheDocument();
        // Progress bar shouldn't be visible while loading
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

        // Wait for data to load
        await waitFor(
          () => {
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
          },
          { timeout: 1000 }
        );
      }
    );
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('D. Error Handling', () => {
    it(
      'displays error message when fetch fails',
      {
        meta: {
          alias: 'Spending-Error',
          behavior: 'Shows error message on failure',
          scenario: 'API returns error',
        },
      },
      async () => {
        mockFetchAssistantSpend.mockResolvedValue({ detail: 'Network error' });

        render(
          <AssistantProfileInfoPanel
            assistant={mockAssistant}
            onEdit={vi.fn()}
            spendingActions={mockSpendingActions}
          />
        );

        await waitFor(() => {
          expect(screen.getByText(/Failed to load spending data/)).toBeInTheDocument();
        });
      }
    );

    it(
      'shows retry button on error',
      {
        meta: {
          alias: 'Spending-Retry-Button',
          behavior: 'Shows retry option on error',
          scenario: 'Error state',
        },
      },
      async () => {
        mockFetchAssistantSpend.mockResolvedValue({ detail: 'Network error' });

        render(
          <AssistantProfileInfoPanel
            assistant={mockAssistant}
            onEdit={vi.fn()}
            spendingActions={mockSpendingActions}
          />
        );

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
        });
      }
    );

    it(
      'retries fetching on retry button click',
      {
        meta: {
          alias: 'Spending-Retry-Action',
          behavior: 'Refetches data when retry is clicked',
          scenario: 'User clicks retry after error',
        },
      },
      async () => {
        const user = userEvent.setup();

        mockFetchAssistantSpend
          .mockResolvedValueOnce({ detail: 'Network error' })
          .mockResolvedValueOnce(mockSpendData);

        render(
          <AssistantProfileInfoPanel
            assistant={mockAssistant}
            onEdit={vi.fn()}
            spendingActions={mockSpendingActions}
          />
        );

        // Wait for error state
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
        });

        // Click retry
        await user.click(screen.getByRole('button', { name: /retry/i }));

        // Wait for successful data load
        await waitFor(() => {
          expect(screen.getByText('$50.00')).toBeInTheDocument();
        });
      }
    );
  });

  // ===========================================================================
  // Edit Limit Dialog
  // ===========================================================================

  describe('E. Edit Limit Dialog', () => {
    it(
      'opens edit dialog when Edit Limit button is clicked',
      {
        meta: {
          alias: 'Spending-Edit-Open',
          behavior: 'Opens limit edit dialog',
          scenario: 'User clicks Edit Limit',
        },
      },
      async () => {
        const user = userEvent.setup();

        render(
          <AssistantProfileInfoPanel
            assistant={mockAssistant}
            onEdit={vi.fn()}
            spendingActions={mockSpendingActions}
            canWrite={true}
          />
        );

        // Wait for data to load
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /edit limit/i })).toBeInTheDocument();
        });

        // Click Edit Limit
        await user.click(screen.getByRole('button', { name: /edit limit/i }));

        // Dialog should open
        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
          expect(screen.getByText('Set Spending Limit')).toBeInTheDocument();
        });
      }
    );

    it(
      'hides Edit Limit button when canWrite is false',
      {
        meta: {
          alias: 'Spending-Edit-Hidden',
          behavior: 'Hides edit button for read-only users',
          scenario: 'User without write permission',
        },
      },
      async () => {
        render(
          <AssistantProfileInfoPanel
            assistant={mockAssistant}
            onEdit={vi.fn()}
            spendingActions={mockSpendingActions}
            canWrite={false}
          />
        );

        // Wait for data to load
        await waitFor(() => {
          expect(screen.getByText('$50.00')).toBeInTheDocument();
        });

        // Edit button should not be present
        expect(screen.queryByRole('button', { name: /edit limit/i })).not.toBeInTheDocument();
      }
    );

    it(
      'updates limit when form is submitted',
      {
        meta: {
          alias: 'Spending-Edit-Submit',
          behavior: 'Saves new limit when submitted',
          scenario: 'User changes limit and saves',
        },
      },
      async () => {
        const user = userEvent.setup();

        render(
          <AssistantProfileInfoPanel
            assistant={mockAssistant}
            onEdit={vi.fn()}
            spendingActions={mockSpendingActions}
            canWrite={true}
          />
        );

        // Wait for data to load
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /edit limit/i })).toBeInTheDocument();
        });

        // Click Edit Limit
        await user.click(screen.getByRole('button', { name: /edit limit/i }));

        // Wait for dialog
        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Clear and type new limit
        const input = screen.getByLabelText(/monthly limit/i);
        await user.clear(input);
        await user.type(input, '200');

        // Submit
        await user.click(screen.getByRole('button', { name: /save limit/i }));

        // Verify setLimit was called
        await waitFor(() => {
          expect(mockSetLimit).toHaveBeenCalledWith('test-agent-123', { monthlySpendingCap: 200 });
        });
      }
    );
  });

  // ===========================================================================
  // Spending States
  // ===========================================================================

  describe('F. Spending States', () => {
    it(
      'shows unlimited state when no limit is set',
      {
        meta: {
          alias: 'Spending-Unlimited',
          behavior: 'Shows unlimited indicator',
          scenario: 'No spending limit configured',
        },
      },
      async () => {
        mockFetchAssistantSpend.mockResolvedValue({
          ...mockSpendData,
          limit: null,
          percentUsed: 0,
        });
        mockFetchAssistantSpendingLimit.mockResolvedValue({ monthlySpendingCap: null });

        render(
          <AssistantProfileInfoPanel
            assistant={mockAssistant}
            onEdit={vi.fn()}
            spendingActions={mockSpendingActions}
          />
        );

        await waitFor(() => {
          expect(screen.getByText('No limit')).toBeInTheDocument();
        });
      }
    );

    it(
      'shows over limit state when spend exceeds limit',
      {
        meta: {
          alias: 'Spending-Over',
          behavior: 'Shows over limit warning',
          scenario: 'Spend exceeds configured limit',
        },
      },
      async () => {
        mockFetchAssistantSpend.mockResolvedValue({
          ...mockSpendData,
          cumulativeSpend: 150.0,
          limit: 100.0,
          percentUsed: 150.0,
        });

        render(
          <AssistantProfileInfoPanel
            assistant={mockAssistant}
            onEdit={vi.fn()}
            spendingActions={mockSpendingActions}
          />
        );

        await waitFor(() => {
          expect(screen.getByText(/Over limit by/)).toBeInTheDocument();
        });
      }
    );
  });

  // ===========================================================================
  // Profile Info (sanity check)
  // ===========================================================================

  describe('G. Profile Info Integration', () => {
    it(
      'renders profile info and spending section together',
      {
        meta: {
          alias: 'Spending-Profile',
          behavior: 'Shows both profile and spending',
          scenario: 'Full profile panel view',
        },
      },
      async () => {
        render(
          <AssistantProfileInfoPanel
            assistant={mockAssistant}
            onEdit={vi.fn()}
            spendingActions={mockSpendingActions}
          />
        );

        // Profile info
        expect(screen.getByText('Test')).toBeInTheDocument(); // firstName
        expect(screen.getByText('Assistant')).toBeInTheDocument(); // surname

        // Spending section
        await waitFor(() => {
          expect(screen.getByText('Monthly Spending')).toBeInTheDocument();
        });
      }
    );
  });
});
