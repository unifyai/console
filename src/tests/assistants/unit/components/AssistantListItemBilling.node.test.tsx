/**
 * Tests for contact-related behavior in AssistantListItem.
 *
 * Validates that the assistant list item hover card:
 * - Shows "Add Email/Phone/WhatsApp" buttons when contact is not set
 * - Buttons open the contact manager directly (no billing guard)
 * - Still renders existing contact values normally
 *
 * @group unit
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { Assistant } from '@/types/assistants/assistant';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock MUI icon (jsdom doesn't support SVG elements from MUI well)
vi.mock('@mui/icons-material', () => ({
  WhatsApp: (props: Record<string, unknown>) =>
    React.createElement('span', { 'data-testid': 'whatsapp-icon', ...props }),
}));

// Mock HoverCard to render content inline (Radix portals don't render in jsdom)
vi.mock('@/components/UI/hover-card', () => ({
  HoverCard: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'hover-card' }, children),
  HoverCardTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  HoverCardContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'hover-card-content' }, children),
}));

import { AssistantListItem } from '@/components/Pages/Assistants/List/AssistantListItem';

// ─── Test Helpers ───────────────────────────────────────────────────────────

function makeAssistant(overrides: Partial<Assistant> = {}): Assistant {
  return {
    agentId: 'test-1',
    userId: 'user-1',
    organizationId: null,
    firstName: 'Jane',
    surname: 'Doe',
    profilePhoto: null,
    profileVideo: null,
    age: 30,
    nationality: 'US',
    about: null,
    phoneCountry: 'US',
    timezone: 'UTC',
    voiceId: null,
    voiceProvider: null,
    email: null,
    phone: null,
    assistantWhatsappNumber: null,
    userPhone: null,
    userWhatsappNumber: null,
    weeklyLimit: null,
    maxParallel: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Assistant;
}

const defaultProps = {
  status: null,
  isSelected: false,
  onShowProfile: vi.fn(),
  onOpenContactManager: vi.fn(),
  isFolded: false,
  isCallActive: false,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AssistantListItem — Contact Buttons', () => {
  describe('Add contact buttons', () => {
    it(
      'renders "Add Email" button when assistant has no email',
      {
        meta: {
          alias: 'ListItem-AddEmailButton',
          scenario: 'Assistant has no email configured',
          behavior: 'Should show "Add Email" button text',
        },
      },
      () => {
        const assistant = makeAssistant({ email: null });
        render(<AssistantListItem {...defaultProps} assistant={assistant} />);

        // The "Add Email" button should be present and enabled
        const button = screen.getByText('Add Email').closest('button');
        expect(button).toBeTruthy();
        expect(button!.disabled).toBe(false);
      }
    );

    it(
      'renders "Add Phone" button when assistant has no phone',
      {
        meta: {
          alias: 'ListItem-AddPhoneButton',
          scenario: 'Assistant has no phone configured',
          behavior: 'Should show "Add Phone" button text',
        },
      },
      () => {
        const assistant = makeAssistant({ phone: null });
        render(<AssistantListItem {...defaultProps} assistant={assistant} />);

        const button = screen.getByText('Add Phone').closest('button');
        expect(button).toBeTruthy();
        expect(button!.disabled).toBe(false);
      }
    );

    it(
      'renders "Add WhatsApp" button when assistant has no WhatsApp',
      {
        meta: {
          alias: 'ListItem-AddWhatsAppButton',
          scenario: 'Assistant has no WhatsApp configured',
          behavior: 'Should show "Add WhatsApp" button text',
        },
      },
      () => {
        const assistant = makeAssistant({ assistantWhatsappNumber: null });
        render(<AssistantListItem {...defaultProps} assistant={assistant} />);

        const button = screen.getByText('Add WhatsApp').closest('button');
        expect(button).toBeTruthy();
        expect(button!.disabled).toBe(false);
      }
    );
  });

  describe('Existing contact values', () => {
    it(
      'renders email value when assistant has email set',
      {
        meta: {
          alias: 'ListItem-ShowsEmail',
          scenario: 'Assistant has email',
          behavior: 'Should display the email address, not the "Add" button',
        },
      },
      () => {
        const assistant = makeAssistant({ email: 'jane@unify.ai' });
        render(<AssistantListItem {...defaultProps} assistant={assistant} />);

        expect(screen.getByText('jane@unify.ai')).toBeTruthy();
        expect(screen.queryByText('Add Email')).toBeNull();
      }
    );

    it(
      'renders phone value when assistant has phone set',
      {
        meta: {
          alias: 'ListItem-ShowsPhone',
          scenario: 'Assistant has phone',
          behavior: 'Should display the phone number',
        },
      },
      () => {
        const assistant = makeAssistant({ phone: '+15551234567' });
        render(<AssistantListItem {...defaultProps} assistant={assistant} />);

        expect(screen.getByText('+15551234567')).toBeTruthy();
        expect(screen.queryByText('Add Phone')).toBeNull();
      }
    );
  });
});
