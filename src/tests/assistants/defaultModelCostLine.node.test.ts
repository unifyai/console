import { describe, expect, it } from 'vitest';
import {
  formatCostLine,
  formatTokenRates,
} from '@/components/Pages/Assistants/Profile/DefaultModelPicker';
import type { DefaultModelOption } from '@/types/assistants/assistant';

function option(overrides: Partial<DefaultModelOption>): DefaultModelOption {
  return {
    model: 'vendor/model@openrouter',
    reasoningEffort: null,
    label: 'Vendor Model',
    approxCreditsPerTask: null,
    approxCreditsPerMessage: null,
    artificialAnalysisUrl: null,
    ...overrides,
  } as DefaultModelOption;
}

describe('formatTokenRates', () => {
  it('renders per-million rates from per-token prices', () => {
    expect(
      formatTokenRates(
        option({ inputCostPerToken: 5 / 1_000_000, outputCostPerToken: 25 / 1_000_000 })
      )
    ).toBe('$5.00 in / $25.00 out per M tokens');
  });

  it('returns null when either side of the price is unknown', () => {
    expect(formatTokenRates(option({ inputCostPerToken: 0.000005 }))).toBeNull();
    expect(formatTokenRates(option({}))).toBeNull();
  });
});

describe('formatCostLine', () => {
  it('prefers the credit estimate for the unit on display', () => {
    const curated = option({ approxCreditsPerTask: 396, approxCreditsPerMessage: 30 });
    expect(formatCostLine(curated, 'task', 'typical task')).toBe('~396 credits / typical task');
    expect(formatCostLine(curated, 'message', 'typical message')).toBe(
      '~30 credits / typical message'
    );
  });

  it('falls back to token rates when that unit has no estimate', () => {
    // Catalog models are priced per token but have no per-task benchmark anchor.
    const catalog = option({
      approxCreditsPerMessage: 30,
      inputCostPerToken: 5 / 1_000_000,
      outputCostPerToken: 25 / 1_000_000,
    });
    expect(formatCostLine(catalog, 'task', 'typical task')).toBe(
      '$5.00 in / $25.00 out per M tokens'
    );
    expect(formatCostLine(catalog, 'message', 'typical message')).toBe(
      '~30 credits / typical message'
    );
  });

  it('reports varying credits only when nothing is known', () => {
    expect(formatCostLine(option({}), 'task', 'typical task')).toBe('Credits vary');
  });
});
