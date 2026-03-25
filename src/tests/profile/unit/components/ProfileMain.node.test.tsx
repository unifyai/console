/**
 * Tests for Profile page Main component.
 *
 * Validates that:
 *   1. The API Key section has been removed
 *   2. The Account section with ProfileForm is still rendered
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock SinglePaneBody to just render its body prop
vi.mock('@/components/Common/Body/SinglePaneBody', () => ({
  default: ({ body }: { body: React.ReactNode }) => <div data-testid="single-pane-body">{body}</div>,
}));

// Mock ProfileForm to render a simple identifiable element
vi.mock('@/components/Pages/Profile/Form', () => ({
  default: ({ user }: { user: any }) => (
    <div data-testid="profile-form">ProfileForm for {user.name}</div>
  ),
}));

// ─── Import after mocks ────────────────────────────────────────────────────

import Main from '@/components/Pages/Profile/Main';

// ─── Test data ──────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  apiKey: 'test-api-key-123',
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Profile Main component', () => {
  it('does NOT render the API Key section heading', async () => {
    const result = await Main({ user: mockUser as any, onPrem: undefined });
    render(result);

    expect(screen.queryByText('API Key')).toBeNull();
  });

  it('does NOT render the "Grab or update your API key" description', async () => {
    const result = await Main({ user: mockUser as any, onPrem: undefined });
    render(result);

    expect(screen.queryByText(/grab or update your api key/i)).toBeNull();
  });

  it('renders the Account section heading', async () => {
    const result = await Main({ user: mockUser as any, onPrem: undefined });
    render(result);

    expect(screen.getByText('Account')).toBeTruthy();
  });

  it('renders the ProfileForm component', async () => {
    const result = await Main({ user: mockUser as any, onPrem: undefined });
    render(result);

    const profileForm = screen.getByTestId('profile-form');
    expect(profileForm).toBeTruthy();
    expect(profileForm.textContent).toContain('Jane Doe');
  });
});

