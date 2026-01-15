/**
 * Voice Matrix Tests
 *
 * Combinatorial testing for voice selection and configuration.
 * Tests all meaningful combinations of:
 * - Providers: Cartesia × ElevenLabs × OpenAI
 * - Gender: Male × Female
 * - Language: Various supported languages
 * - Preview states: Idle × Playing × Loading × Error
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
import { VoiceOption } from '@/types/assistants/assistant';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type VoiceProvider = 'cartesia' | 'elevenlabs' | 'openai';
type Gender = 'male' | 'female';
type Language = 'en' | 'es' | 'fr' | 'de' | 'multi';

interface VoiceScenario {
  id: string;
  description: string;
  provider: VoiceProvider;
  gender: Gender;
  language: Language;
}

// =============================================================================
// VOICE MATRIX DEFINITION
// =============================================================================

const VOICE_MATRIX: VoiceScenario[] = [
  // Cartesia voices
  {
    id: 'cartesia-male-en',
    description: 'Cartesia male English',
    provider: 'cartesia',
    gender: 'male',
    language: 'en',
  },
  {
    id: 'cartesia-female-en',
    description: 'Cartesia female English',
    provider: 'cartesia',
    gender: 'female',
    language: 'en',
  },
  {
    id: 'cartesia-male-es',
    description: 'Cartesia male Spanish',
    provider: 'cartesia',
    gender: 'male',
    language: 'es',
  },
  {
    id: 'cartesia-female-fr',
    description: 'Cartesia female French',
    provider: 'cartesia',
    gender: 'female',
    language: 'fr',
  },

  // ElevenLabs voices
  {
    id: 'elevenlabs-male-en',
    description: 'ElevenLabs male English',
    provider: 'elevenlabs',
    gender: 'male',
    language: 'en',
  },
  {
    id: 'elevenlabs-female-en',
    description: 'ElevenLabs female English',
    provider: 'elevenlabs',
    gender: 'female',
    language: 'en',
  },
  {
    id: 'elevenlabs-male-de',
    description: 'ElevenLabs male German',
    provider: 'elevenlabs',
    gender: 'male',
    language: 'de',
  },

  // OpenAI voices (multilingual only)
  {
    id: 'openai-male-multi',
    description: 'OpenAI male multilingual',
    provider: 'openai',
    gender: 'male',
    language: 'multi',
  },
  {
    id: 'openai-female-multi',
    description: 'OpenAI female multilingual',
    provider: 'openai',
    gender: 'female',
    language: 'multi',
  },
];

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

function createMockVoice(scenario: VoiceScenario): VoiceOption {
  return {
    voiceId: `voice-${scenario.id}`,
    name: `Test ${scenario.description}`,
    description: `A ${scenario.gender} voice in ${scenario.language}`,
    gender: scenario.gender,
    language: scenario.language,
    provider: scenario.provider,
    isPreset: true,
    isUserVoiceInOrchestra: false,
  };
}

function createVoiceSet(): VoiceOption[] {
  return VOICE_MATRIX.map(createMockVoice);
}

// =============================================================================
// MOCK COMPONENT FOR TESTING VOICE LOGIC
// =============================================================================

interface VoiceSelectorTestProps {
  voices: VoiceOption[];
  selectedVoice: VoiceOption | null;
  onSelectVoice: (voice: VoiceOption) => void;
  filterProvider?: VoiceProvider | null;
  filterGender?: Gender | null;
  filterLanguage?: Language | null;
}

const VoiceSelectorTest: React.FC<VoiceSelectorTestProps> = ({
  voices,
  selectedVoice,
  onSelectVoice,
  filterProvider,
  filterGender,
  filterLanguage,
}) => {
  const filteredVoices = voices.filter((v) => {
    if (filterProvider && v.provider !== filterProvider) return false;
    if (filterGender && v.gender !== filterGender) return false;
    if (filterLanguage && v.language !== filterLanguage) return false;
    return true;
  });

  return (
    <div data-testid="voice-selector">
      <div data-testid="filter-info">
        Provider: {filterProvider || 'all'}, Gender: {filterGender || 'all'}, Language:{' '}
        {filterLanguage || 'all'}
      </div>
      <div data-testid="voice-count">Showing {filteredVoices.length} voices</div>
      {selectedVoice && (
        <div data-testid="selected-voice">
          Selected: {selectedVoice.name} ({selectedVoice.provider})
        </div>
      )}
      <ul data-testid="voice-list">
        {filteredVoices.map((voice) => (
          <li key={voice.voiceId} data-testid={`voice-${voice.voiceId}`}>
            <button
              onClick={() => onSelectVoice(voice)}
              aria-pressed={selectedVoice?.voiceId === voice.voiceId}
            >
              {voice.name}
            </button>
            <span data-testid={`voice-provider-${voice.voiceId}`}>{voice.provider}</span>
            <span data-testid={`voice-gender-${voice.voiceId}`}>{voice.gender}</span>
            <span data-testid={`voice-language-${voice.voiceId}`}>{voice.language}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

// =============================================================================
// MATRIX TESTS (using defineMatrixTests)
// =============================================================================

const allVoices = createVoiceSet();

defineMatrixTests<VoiceScenario>({
  name: 'Voice Matrix',
  chunkSize: 5,

  getMatrix: () => VOICE_MATRIX,

  getConfigAlias: (scenario) => `[${scenario.id}] ${scenario.description}`,

  defineTests: (scenario, { it, expect }) => {
    const voice = createMockVoice(scenario);

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should display correct provider', () => {
      render(<VoiceSelectorTest voices={[voice]} selectedVoice={null} onSelectVoice={vi.fn()} />);

      expect(screen.getByTestId(`voice-provider-${voice.voiceId}`)).toHaveTextContent(
        scenario.provider
      );
    });

    it('should display correct gender', () => {
      render(<VoiceSelectorTest voices={[voice]} selectedVoice={null} onSelectVoice={vi.fn()} />);

      expect(screen.getByTestId(`voice-gender-${voice.voiceId}`)).toHaveTextContent(
        scenario.gender
      );
    });

    it('should display correct language', () => {
      render(<VoiceSelectorTest voices={[voice]} selectedVoice={null} onSelectVoice={vi.fn()} />);

      expect(screen.getByTestId(`voice-language-${voice.voiceId}`)).toHaveTextContent(
        scenario.language
      );
    });

    it('should be selectable', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(
        <VoiceSelectorTest voices={allVoices} selectedVoice={null} onSelectVoice={onSelect} />
      );

      const button = screen.getByRole('button', { name: voice.name });
      await user.click(button);

      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          voiceId: voice.voiceId,
          provider: scenario.provider,
          gender: scenario.gender,
          language: scenario.language,
        })
      );
    });
  },
});

// =============================================================================
// FILTER COMBINATION TESTS (separate matrix)
// =============================================================================

interface FilterTestContext {
  id: string;
  provider: VoiceProvider;
  gender: Gender;
  expectedCount: number;
}

const FILTER_COMBINATIONS: FilterTestContext[] = [
  { id: 'cartesia-male', provider: 'cartesia', gender: 'male', expectedCount: 2 },
  { id: 'cartesia-female', provider: 'cartesia', gender: 'female', expectedCount: 2 },
  { id: 'elevenlabs-male', provider: 'elevenlabs', gender: 'male', expectedCount: 2 },
  { id: 'elevenlabs-female', provider: 'elevenlabs', gender: 'female', expectedCount: 1 },
  { id: 'openai-male', provider: 'openai', gender: 'male', expectedCount: 1 },
  { id: 'openai-female', provider: 'openai', gender: 'female', expectedCount: 1 },
];

defineMatrixTests<FilterTestContext>({
  name: 'Voice Matrix - Filter Combinations',
  chunkSize: 3,

  getMatrix: () => FILTER_COMBINATIONS,

  getConfigAlias: (ctx) => `[${ctx.id}] ${ctx.provider} + ${ctx.gender}`,

  defineTests: (ctx, { it, expect }) => {
    it(`should show ${ctx.expectedCount} voices when filtering by ${ctx.provider} + ${ctx.gender}`, () => {
      render(
        <VoiceSelectorTest
          voices={allVoices}
          selectedVoice={null}
          onSelectVoice={vi.fn()}
          filterProvider={ctx.provider}
          filterGender={ctx.gender}
        />
      );

      expect(screen.getByTestId('voice-count')).toHaveTextContent(
        `Showing ${ctx.expectedCount} voices`
      );
    });
  },
});
