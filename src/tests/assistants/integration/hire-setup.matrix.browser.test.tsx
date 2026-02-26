/**
 * Hire Setup Configuration Matrix Tests
 *
 * Combinatorial testing for remote desktop setup configuration.
 * Tests all meaningful combinations of:
 * - Setup: Remote × Local
 * - OS (if local): Ubuntu × Windows × macOS
 *
 * Uses defineMatrixTests for chunking support in CI.
 *
 * @group matrix
 * @group integration
 */

import React from 'react';
import { vi, beforeEach } from 'vitest';
import { render, screen } from '@/tests/render';
import { defineMatrixTests } from '@/tests/utils/matrixTestRunnerBrowser';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type SetupType = 'remote' | 'local';
type OperatingSystem = 'ubuntu' | 'windows' | 'macos';

interface SetupScenario {
  id: string;
  description: string;
  setup: SetupType;
  os: OperatingSystem | null; // null when setup is remote
  expected: {
    showsOsSelector: boolean;
    showsLocalInstructions: boolean;
    showsRemoteInfo: boolean;
    osFieldValue: OperatingSystem | null;
    submitPayloadFields: string[];
  };
}

// =============================================================================
// SETUP CONFIGURATION MATRIX DEFINITION
// =============================================================================

const SETUP_MATRIX: SetupScenario[] = [
  // Remote setup
  {
    id: 'remote',
    description: 'Remote setup',
    setup: 'remote',
    os: null,
    expected: {
      showsOsSelector: false,
      showsLocalInstructions: false,
      showsRemoteInfo: true,
      osFieldValue: null,
      submitPayloadFields: ['setup'],
    },
  },

  // Local setup - Ubuntu
  {
    id: 'local-ubuntu',
    description: 'Local setup, Ubuntu',
    setup: 'local',
    os: 'ubuntu',
    expected: {
      showsOsSelector: true,
      showsLocalInstructions: true,
      showsRemoteInfo: false,
      osFieldValue: 'ubuntu',
      submitPayloadFields: ['setup', 'operatingSystem'],
    },
  },

  // Local setup - Windows
  {
    id: 'local-windows',
    description: 'Local setup, Windows',
    setup: 'local',
    os: 'windows',
    expected: {
      showsOsSelector: true,
      showsLocalInstructions: true,
      showsRemoteInfo: false,
      osFieldValue: 'windows',
      submitPayloadFields: ['setup', 'operatingSystem'],
    },
  },

  // Local setup - macOS
  {
    id: 'local-macos',
    description: 'Local setup, macOS',
    setup: 'local',
    os: 'macos',
    expected: {
      showsOsSelector: true,
      showsLocalInstructions: true,
      showsRemoteInfo: false,
      osFieldValue: 'macos',
      submitPayloadFields: ['setup', 'operatingSystem'],
    },
  },
];

// =============================================================================
// MOCK COMPONENT FOR TESTING SETUP CONFIGURATION
// =============================================================================

interface SetupConfigTestProps {
  setupType: SetupType;
  operatingSystem: OperatingSystem;
  onSetupChange: (type: SetupType) => void;
  onOsChange: (os: OperatingSystem) => void;
}

const SetupConfigTest: React.FC<SetupConfigTestProps> = ({
  setupType,
  operatingSystem,
  onSetupChange,
  onOsChange,
}) => {
  const isLocal = setupType === 'local';
  const isRemote = setupType === 'remote';

  // Build payload fields
  const payloadFields = ['setup'];
  if (isLocal) {
    payloadFields.push('operatingSystem');
  }

  return (
    <div data-testid="setup-config">
      {/* Setup type selector */}
      <div data-testid="setup-selector">
        <button
          data-testid="setup-remote-btn"
          onClick={() => onSetupChange('remote')}
          aria-pressed={isRemote}
        >
          Remote
        </button>
        <button
          data-testid="setup-local-btn"
          onClick={() => onSetupChange('local')}
          aria-pressed={isLocal}
        >
          Local
        </button>
      </div>

      {/* Remote info */}
      {isRemote && (
        <div data-testid="remote-info">
          <p>Your assistant will run on our secure cloud infrastructure.</p>
          <ul>
            <li>No local installation required</li>
            <li>Accessible from anywhere</li>
            <li>Automatic updates</li>
          </ul>
        </div>
      )}

      {/* OS selector (only for local) */}
      {isLocal && (
        <div data-testid="os-selector">
          <label>Operating System</label>
          <div data-testid="os-options">
            <button
              data-testid="os-ubuntu-btn"
              onClick={() => onOsChange('ubuntu')}
              aria-pressed={operatingSystem === 'ubuntu'}
            >
              Ubuntu
            </button>
            <button
              data-testid="os-windows-btn"
              onClick={() => onOsChange('windows')}
              aria-pressed={operatingSystem === 'windows'}
            >
              Windows
            </button>
            <button
              data-testid="os-macos-btn"
              onClick={() => onOsChange('macos')}
              aria-pressed={operatingSystem === 'macos'}
            >
              macOS
            </button>
          </div>
          <input data-testid="os-value" type="hidden" value={operatingSystem} readOnly />
        </div>
      )}

      {/* Local instructions */}
      {isLocal && (
        <div data-testid="local-instructions">
          <h4>Installation Steps for {operatingSystem}</h4>
          {operatingSystem === 'ubuntu' && (
            <code data-testid="install-command">curl -fsSL https://get.assistant.ai | bash</code>
          )}
          {operatingSystem === 'windows' && (
            <code data-testid="install-command">winget install assistant</code>
          )}
          {operatingSystem === 'macos' && (
            <code data-testid="install-command">brew install assistant</code>
          )}
        </div>
      )}

      {/* State indicators */}
      <div data-testid="config-state">
        <span data-testid="shows-os-selector">{isLocal.toString()}</span>
        <span data-testid="shows-local-instructions">{isLocal.toString()}</span>
        <span data-testid="shows-remote-info">{isRemote.toString()}</span>
        <span data-testid="os-field-value">{isLocal ? operatingSystem : ''}</span>
        <span data-testid="payload-fields">{payloadFields.join(',')}</span>
      </div>
    </div>
  );
};

// =============================================================================
// MATRIX TESTS (using defineMatrixTests)
// =============================================================================

defineMatrixTests<SetupScenario>({
  name: 'Hire Setup Configuration Matrix',
  chunkSize: 4,

  getMatrix: () => SETUP_MATRIX,

  getConfigAlias: (scenario) => `[${scenario.id}] ${scenario.description}`,

  defineTests: (scenario, { it, expect }) => {
    const setupType = scenario.setup;
    const operatingSystem = scenario.os ?? 'ubuntu';

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it(`showsOsSelector should be ${scenario.expected.showsOsSelector}`, () => {
      render(
        <SetupConfigTest
          setupType={setupType}
          operatingSystem={operatingSystem}
          onSetupChange={vi.fn()}
          onOsChange={vi.fn()}
        />
      );

      const osSelector = screen.queryByTestId('os-selector');
      if (scenario.expected.showsOsSelector) {
        expect(osSelector).toBeInTheDocument();
      } else {
        expect(osSelector).not.toBeInTheDocument();
      }
    });

    it(`showsLocalInstructions should be ${scenario.expected.showsLocalInstructions}`, () => {
      render(
        <SetupConfigTest
          setupType={setupType}
          operatingSystem={operatingSystem}
          onSetupChange={vi.fn()}
          onOsChange={vi.fn()}
        />
      );

      const instructions = screen.queryByTestId('local-instructions');
      if (scenario.expected.showsLocalInstructions) {
        expect(instructions).toBeInTheDocument();
      } else {
        expect(instructions).not.toBeInTheDocument();
      }
    });

    it(`showsRemoteInfo should be ${scenario.expected.showsRemoteInfo}`, () => {
      render(
        <SetupConfigTest
          setupType={setupType}
          operatingSystem={operatingSystem}
          onSetupChange={vi.fn()}
          onOsChange={vi.fn()}
        />
      );

      const remoteInfo = screen.queryByTestId('remote-info');
      if (scenario.expected.showsRemoteInfo) {
        expect(remoteInfo).toBeInTheDocument();
      } else {
        expect(remoteInfo).not.toBeInTheDocument();
      }
    });

    it(`osFieldValue should be ${scenario.expected.osFieldValue ?? 'empty'}`, () => {
      render(
        <SetupConfigTest
          setupType={setupType}
          operatingSystem={operatingSystem}
          onSetupChange={vi.fn()}
          onOsChange={vi.fn()}
        />
      );

      const osValue = screen.getByTestId('os-field-value').textContent;
      if (scenario.expected.osFieldValue) {
        expect(osValue).toBe(scenario.expected.osFieldValue);
      } else {
        expect(osValue).toBe('');
      }
    });

    it(`payload should include ${scenario.expected.submitPayloadFields.join(', ')}`, () => {
      render(
        <SetupConfigTest
          setupType={setupType}
          operatingSystem={operatingSystem}
          onSetupChange={vi.fn()}
          onOsChange={vi.fn()}
        />
      );

      const payloadFields = screen.getByTestId('payload-fields').textContent?.split(',') ?? [];
      scenario.expected.submitPayloadFields.forEach((field) => {
        expect(payloadFields).toContain(field);
      });
    });
  },
});
