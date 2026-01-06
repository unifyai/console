import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock next-auth/react
const mockUseSession = vi.fn();
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

// Mock next/navigation
const mockPush = vi.fn();
const mockPathname = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Import after mocks
import OnboardingGuard from '@/components/Pages/TaxClassification/OnboardingGuard';

describe('OnboardingGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockPathname.mockReturnValue('/interfaces');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should only call onboarding-status API once per session', async () => {
    // Setup: authenticated user, no cache
    mockUseSession.mockReturnValue({
      data: { user: { email: 'test@test.com' } },
      status: 'authenticated',
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ onboarded: true }),
    });

    // First render
    const { rerender } = render(
      <OnboardingGuard>
        <div>Content</div>
      </OnboardingGuard>
    );

    // Wait for API call
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Simulate session object reference change (NextAuth does this frequently)
    mockUseSession.mockReturnValue({
      data: { user: { email: 'test@test.com' } }, // Same data, new object
      status: 'authenticated',
    });

    // Re-render (simulates what happens when session refreshes)
    rerender(
      <OnboardingGuard>
        <div>Content</div>
      </OnboardingGuard>
    );

    // Should NOT have made another API call
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1, not 2
    });
  });

  it('should use cached data and not call API if cache is fresh', async () => {
    // Setup: cached onboarding status
    localStorageMock.setItem(
      'onboarding-status',
      JSON.stringify({
        data: { onboarded: true },
        timestamp: Date.now(), // Fresh cache
      })
    );

    mockUseSession.mockReturnValue({
      data: { user: { email: 'test@test.com' } },
      status: 'authenticated',
    });

    render(
      <OnboardingGuard>
        <div>Content</div>
      </OnboardingGuard>
    );

    // Wait a bit for any potential API calls
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should NOT have called API - used cache
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should call API if cache is expired', async () => {
    // Setup: expired cache (6 minutes old, cache duration is 5 minutes)
    localStorageMock.setItem(
      'onboarding-status',
      JSON.stringify({
        data: { onboarded: true },
        timestamp: Date.now() - (6 * 60 * 1000), // 6 minutes ago
      })
    );

    mockUseSession.mockReturnValue({
      data: { user: { email: 'test@test.com' } },
      status: 'authenticated',
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ onboarded: true }),
    });

    render(
      <OnboardingGuard>
        <div>Content</div>
      </OnboardingGuard>
    );

    // Should call API because cache expired
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  it('should skip API call for allowed paths', async () => {
    mockPathname.mockReturnValue('/login'); // Allowed path

    mockUseSession.mockReturnValue({
      data: { user: { email: 'test@test.com' } },
      status: 'authenticated',
    });

    render(
      <OnboardingGuard>
        <div>Content</div>
      </OnboardingGuard>
    );

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should NOT call API for allowed paths
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should not call API when unauthenticated', async () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    });

    render(
      <OnboardingGuard>
        <div>Content</div>
      </OnboardingGuard>
    );

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should NOT call API when not logged in
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

