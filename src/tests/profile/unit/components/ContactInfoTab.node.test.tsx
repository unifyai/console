/**
 * Tests for ContactInfoTab component.
 *
 * Validates:
 *   - Phone format validation (E.164 pattern)
 *   - Cross-field verification (phone verified → whatsapp auto-verified)
 *   - Edit flow for already-verified numbers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@mui/icons-material', () => ({
  WhatsApp: ({ className }: { className?: string }) => (
    <span data-testid="whatsapp-icon" className={className}>
      WA
    </span>
  ),
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import ContactInfoTab from '@/components/Pages/Profile/ContactInfoTab';
import { User } from '@/types/user';

// ─── Test data ──────────────────────────────────────────────────────────────

const baseUser: User = {
  id: 'user-1',
  name: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  jobTitle: '',
  bio: '',
  image: '',
  apiKey: '',
  timezone: 'UTC',
  phoneNumber: null,
  whatsappNumber: null,
  createdAt: '2026-01-01T00:00:00Z',
  stripeCustomerId: '',
  organization: { name: '', roleId: 0, roleName: '' },
  organizations: [],
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ContactInfoTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Phone Format Validation', () => {
    it('shows format error for invalid phone input', () => {
      render(<ContactInfoTab user={baseUser} />);

      const phoneInput = screen.getAllByPlaceholderText('e.g., +15551234567')[0];
      fireEvent.change(phoneInput, { target: { value: '12345' } });

      expect(
        screen.getByText(/Enter a valid international number starting with \+/)
      ).toBeInTheDocument();
    });

    it('does not show format error for valid E.164 number', () => {
      render(<ContactInfoTab user={baseUser} />);

      const phoneInput = screen.getAllByPlaceholderText('e.g., +15551234567')[0];
      fireEvent.change(phoneInput, { target: { value: '+15551234567' } });

      expect(
        screen.queryByText(/Enter a valid international number starting with \+/)
      ).not.toBeInTheDocument();
    });

    it('disables Verify button for invalid format', () => {
      render(<ContactInfoTab user={baseUser} />);

      const phoneInput = screen.getAllByPlaceholderText('e.g., +15551234567')[0];
      fireEvent.change(phoneInput, { target: { value: 'abc' } });

      const verifyButtons = screen.getAllByRole('button', { name: /Verify/ });
      expect(verifyButtons[0]).toBeDisabled();
    });

    it('enables Verify button for valid format', () => {
      render(<ContactInfoTab user={baseUser} />);

      const phoneInput = screen.getAllByPlaceholderText('e.g., +15551234567')[0];
      fireEvent.change(phoneInput, { target: { value: '+15551234567' } });

      const verifyButtons = screen.getAllByRole('button', { name: /Verify/ });
      expect(verifyButtons[0]).not.toBeDisabled();
    });
  });

  describe('Existing Verified Number', () => {
    it('shows Change button when number is already verified', () => {
      const userWithPhone = { ...baseUser, phoneNumber: '+15551234567' };
      render(<ContactInfoTab user={userWithPhone} />);

      expect(screen.getByRole('button', { name: /Change/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Verified/ })).toBeDisabled();
    });

    it('unlocks input after clicking Change', () => {
      const userWithPhone = { ...baseUser, phoneNumber: '+15551234567' };
      render(<ContactInfoTab user={userWithPhone} />);

      const phoneInput = screen.getAllByPlaceholderText('e.g., +15551234567')[0];
      expect(phoneInput).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: /Change/ }));

      expect(phoneInput).not.toBeDisabled();
    });
  });

  describe('Cross-Field Verification', () => {
    it('auto-marks whatsapp as verified when entering a number matching verified phone', () => {
      const userWithPhone = { ...baseUser, phoneNumber: '+15551234567' };
      render(<ContactInfoTab user={userWithPhone} />);

      // WhatsApp input is the second tel input
      const whatsappInput = screen.getAllByPlaceholderText('e.g., +15551234567')[1];
      fireEvent.change(whatsappInput, { target: { value: '+15551234567' } });

      // Should show two Verified buttons (phone + whatsapp)
      const verifiedButtons = screen.getAllByRole('button', { name: /Verified/ });
      expect(verifiedButtons).toHaveLength(2);
    });

    it('does not auto-verify whatsapp when entering a different number', () => {
      const userWithPhone = { ...baseUser, phoneNumber: '+15551234567' };
      render(<ContactInfoTab user={userWithPhone} />);

      const whatsappInput = screen.getAllByPlaceholderText('e.g., +15551234567')[1];
      fireEvent.change(whatsappInput, { target: { value: '+44207946095' } });

      // Should show one Verified button (phone) and one Verify button (whatsapp)
      expect(screen.getAllByRole('button', { name: /^Verified/ })).toHaveLength(1);
      // The Verify button should be disabled since +44207946095 is only 12 digits
    });
  });
});
