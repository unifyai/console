/**
 * Contact Channels Matrix Tests
 *
 * Combinatorial testing for contact channel configuration.
 * Tests all meaningful combinations of:
 * - Channel type: email × phone × whatsapp
 * - Status: unset × pending × verified × error
 * - Validation: valid × invalid × empty
 * - Permissions: canWrite true × false
 *
 * Uses defineMatrixTests for chunking/sharding support in CI.
 *
 * @group matrix
 * @group integration
 */

import React from 'react';
import { vi, beforeEach } from 'vitest';
import { render, screen } from '@/tests/render';
import userEvent from '@testing-library/user-event';
import { defineMatrixTests } from '@/tests/utils/matrixTestRunnerBrowser';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type ChannelType = 'email' | 'phone' | 'whatsapp';
type ChannelStatus = 'unset' | 'pending' | 'verified' | 'error';
type ValidationState = 'valid' | 'invalid' | 'empty';

interface ContactChannelScenario {
  id: string;
  description: string;
  channel: ChannelType;
  status: ChannelStatus;
  validation: ValidationState;
  canWrite: boolean;
  expected: {
    showsValue: boolean;
    showsInput: boolean;
    showsVerify: boolean;
    showsError: boolean;
  };
}

// =============================================================================
// CONTACT CHANNEL MATRIX DEFINITION
// =============================================================================

const CONTACT_CHANNEL_MATRIX: ContactChannelScenario[] = [
  // Email channel
  {
    id: 'email-unset-canwrite',
    description: 'Email unset, can write',
    channel: 'email',
    status: 'unset',
    validation: 'empty',
    canWrite: true,
    expected: { showsValue: false, showsInput: true, showsVerify: false, showsError: false },
  },
  {
    id: 'email-verified-canwrite',
    description: 'Email verified, can write',
    channel: 'email',
    status: 'verified',
    validation: 'valid',
    canWrite: true,
    expected: { showsValue: true, showsInput: false, showsVerify: false, showsError: false },
  },
  {
    id: 'email-verified-readonly',
    description: 'Email verified, read only',
    channel: 'email',
    status: 'verified',
    validation: 'valid',
    canWrite: false,
    expected: { showsValue: true, showsInput: false, showsVerify: false, showsError: false },
  },
  {
    id: 'email-invalid',
    description: 'Email with invalid format',
    channel: 'email',
    status: 'unset',
    validation: 'invalid',
    canWrite: true,
    expected: { showsValue: false, showsInput: true, showsVerify: false, showsError: true },
  },

  // Phone channel
  {
    id: 'phone-unset-canwrite',
    description: 'Phone unset, can write',
    channel: 'phone',
    status: 'unset',
    validation: 'empty',
    canWrite: true,
    expected: { showsValue: false, showsInput: true, showsVerify: false, showsError: false },
  },
  {
    id: 'phone-pending',
    description: 'Phone pending verification',
    channel: 'phone',
    status: 'pending',
    validation: 'valid',
    canWrite: true,
    expected: { showsValue: false, showsInput: true, showsVerify: true, showsError: false },
  },
  {
    id: 'phone-verified',
    description: 'Phone verified',
    channel: 'phone',
    status: 'verified',
    validation: 'valid',
    canWrite: true,
    expected: { showsValue: true, showsInput: false, showsVerify: false, showsError: false },
  },
  {
    id: 'phone-error',
    description: 'Phone verification error',
    channel: 'phone',
    status: 'error',
    validation: 'valid',
    canWrite: true,
    expected: { showsValue: false, showsInput: true, showsVerify: false, showsError: true },
  },
  {
    id: 'phone-invalid',
    description: 'Phone with invalid format',
    channel: 'phone',
    status: 'unset',
    validation: 'invalid',
    canWrite: true,
    expected: { showsValue: false, showsInput: true, showsVerify: false, showsError: true },
  },

  // WhatsApp channel
  {
    id: 'whatsapp-unset',
    description: 'WhatsApp unset',
    channel: 'whatsapp',
    status: 'unset',
    validation: 'empty',
    canWrite: true,
    expected: { showsValue: false, showsInput: true, showsVerify: false, showsError: false },
  },
  {
    id: 'whatsapp-pending',
    description: 'WhatsApp pending verification',
    channel: 'whatsapp',
    status: 'pending',
    validation: 'valid',
    canWrite: true,
    expected: { showsValue: false, showsInput: true, showsVerify: true, showsError: false },
  },
  {
    id: 'whatsapp-verified',
    description: 'WhatsApp verified',
    channel: 'whatsapp',
    status: 'verified',
    validation: 'valid',
    canWrite: true,
    expected: { showsValue: true, showsInput: false, showsVerify: false, showsError: false },
  },

  // Read-only states
  {
    id: 'phone-readonly-unset',
    description: 'Phone unset, read only',
    channel: 'phone',
    status: 'unset',
    validation: 'empty',
    canWrite: false,
    expected: { showsValue: false, showsInput: false, showsVerify: false, showsError: false },
  },
  {
    id: 'whatsapp-readonly-verified',
    description: 'WhatsApp verified, read only',
    channel: 'whatsapp',
    status: 'verified',
    validation: 'valid',
    canWrite: false,
    expected: { showsValue: true, showsInput: false, showsVerify: false, showsError: false },
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getValueForScenario(scenario: ContactChannelScenario): string {
  if (scenario.validation === 'empty') return '';
  if (scenario.validation === 'invalid') {
    switch (scenario.channel) {
      case 'email':
        return 'not-an-email';
      case 'phone':
        return '123';
      case 'whatsapp':
        return 'abc';
    }
  }
  // Valid values
  switch (scenario.channel) {
    case 'email':
      return 'test@example.com';
    case 'phone':
      return '+1234567890';
    case 'whatsapp':
      return '+1234567890';
  }
}

function getValidationError(scenario: ContactChannelScenario): string | null {
  if (scenario.validation === 'invalid') {
    switch (scenario.channel) {
      case 'email':
        return 'Invalid email format';
      case 'phone':
        return 'Invalid phone number';
      case 'whatsapp':
        return 'Invalid WhatsApp number';
    }
  }
  if (scenario.status === 'error') {
    return 'Verification failed';
  }
  return null;
}

// =============================================================================
// MOCK COMPONENT FOR TESTING CONTACT CHANNEL LOGIC
// =============================================================================

interface ContactChannelTestProps {
  channelType: ChannelType;
  status: ChannelStatus;
  value: string;
  validationError: string | null;
  canWrite: boolean;
  onValueChange: (value: string) => void;
  onVerify: () => void;
  onSubmit: () => void;
}

const ContactChannelTest: React.FC<ContactChannelTestProps> = ({
  channelType,
  status,
  value,
  validationError,
  canWrite,
  onValueChange,
  onVerify,
  onSubmit,
}) => {
  const isVerified = status === 'verified';
  const isPending = status === 'pending';
  const hasError = status === 'error' || validationError !== null;
  const showsInput = canWrite && !isVerified;
  const showsValue = isVerified;
  const canSubmit = canWrite && value.length > 0 && !validationError && !isVerified && !isPending;

  const channelLabels: Record<ChannelType, string> = {
    email: 'Email Address',
    phone: 'Phone Number',
    whatsapp: 'WhatsApp Number',
  };

  const placeholders: Record<ChannelType, string> = {
    email: 'Enter email address',
    phone: 'Enter phone number',
    whatsapp: 'Enter WhatsApp number',
  };

  return (
    <div data-testid="contact-channel" data-channel={channelType}>
      <label data-testid="channel-label">{channelLabels[channelType]}</label>

      {/* Display verified value */}
      {showsValue && (
        <div data-testid="channel-value">
          {value}
          <span data-testid="verified-badge">✓ Verified</span>
        </div>
      )}

      {/* Input for editing */}
      {showsInput && (
        <div data-testid="channel-input-container">
          <input
            data-testid="channel-input"
            type={channelType === 'email' ? 'email' : 'tel'}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={placeholders[channelType]}
            disabled={isPending}
          />
        </div>
      )}

      {/* Read-only empty state */}
      {!canWrite && !isVerified && <div data-testid="empty-readonly">Not set</div>}

      {/* Verification pending */}
      {isPending && (
        <div data-testid="verification-pending">
          <span>Verification code sent</span>
          <input data-testid="verification-code-input" placeholder="Enter code" />
          <button data-testid="verify-button" onClick={onVerify}>
            Verify
          </button>
        </div>
      )}

      {/* Error message */}
      {hasError && <div data-testid="error-message">{validationError || 'An error occurred'}</div>}

      {/* Submit button */}
      {showsInput && !isPending && (
        <button data-testid="submit-button" onClick={onSubmit} disabled={!canSubmit}>
          {channelType === 'email' ? 'Set Email' : 'Send Verification'}
        </button>
      )}
    </div>
  );
};

// =============================================================================
// MATRIX TESTS (using defineMatrixTests)
// =============================================================================

defineMatrixTests<ContactChannelScenario>({
  name: 'Contact Channels Matrix',
  chunkSize: 5,

  getMatrix: () => CONTACT_CHANNEL_MATRIX,

  getConfigAlias: (scenario) => `[${scenario.id}] ${scenario.description}`,

  defineTests: (scenario, { it, expect }) => {
    const value = getValueForScenario(scenario);
    const validationError = getValidationError(scenario);

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it(`showsValue should be ${scenario.expected.showsValue}`, () => {
      render(
        <ContactChannelTest
          channelType={scenario.channel}
          status={scenario.status}
          value={value}
          validationError={validationError}
          canWrite={scenario.canWrite}
          onValueChange={vi.fn()}
          onVerify={vi.fn()}
          onSubmit={vi.fn()}
        />
      );

      const valueDisplay = screen.queryByTestId('channel-value');
      if (scenario.expected.showsValue) {
        expect(valueDisplay).toBeInTheDocument();
      } else {
        expect(valueDisplay).not.toBeInTheDocument();
      }
    });

    it(`showsInput should be ${scenario.expected.showsInput}`, () => {
      render(
        <ContactChannelTest
          channelType={scenario.channel}
          status={scenario.status}
          value={value}
          validationError={validationError}
          canWrite={scenario.canWrite}
          onValueChange={vi.fn()}
          onVerify={vi.fn()}
          onSubmit={vi.fn()}
        />
      );

      const input = screen.queryByTestId('channel-input');
      if (scenario.expected.showsInput) {
        expect(input).toBeInTheDocument();
      } else {
        expect(input).not.toBeInTheDocument();
      }
    });

    it(`showsVerify should be ${scenario.expected.showsVerify}`, () => {
      render(
        <ContactChannelTest
          channelType={scenario.channel}
          status={scenario.status}
          value={value}
          validationError={validationError}
          canWrite={scenario.canWrite}
          onValueChange={vi.fn()}
          onVerify={vi.fn()}
          onSubmit={vi.fn()}
        />
      );

      const verifySection = screen.queryByTestId('verification-pending');
      if (scenario.expected.showsVerify) {
        expect(verifySection).toBeInTheDocument();
      } else {
        expect(verifySection).not.toBeInTheDocument();
      }
    });

    it(`showsError should be ${scenario.expected.showsError}`, () => {
      render(
        <ContactChannelTest
          channelType={scenario.channel}
          status={scenario.status}
          value={value}
          validationError={validationError}
          canWrite={scenario.canWrite}
          onValueChange={vi.fn()}
          onVerify={vi.fn()}
          onSubmit={vi.fn()}
        />
      );

      const errorMessage = screen.queryByTestId('error-message');
      if (scenario.expected.showsError) {
        expect(errorMessage).toBeInTheDocument();
      } else {
        expect(errorMessage).not.toBeInTheDocument();
      }
    });
  },
});
