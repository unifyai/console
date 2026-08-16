import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { targetTestId } from '@/lib/agent-guidance/consoleTargets';
import { flashElement } from '@/lib/agent-guidance/flashElement';
import { buildActionCatalogue } from '@/lib/agent-guidance/actionCatalogue';
import { LEAF_TARGETS } from '@/lib/agent-guidance/leafTargets';

const PRESS_CLASS = 'agent-press';

function addButton(testId: string): HTMLElement {
  const button = document.createElement('button');
  button.setAttribute('data-testid', testId);
  document.body.appendChild(button);
  return button;
}

/** Every source file that might render a test id. */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === 'tests' || entry === 'agent-guidance') continue;
      sourceFiles(path, acc);
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      acc.push(path);
    }
  }
  return acc;
}

const SOURCE = sourceFiles('src')
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

/**
 * An assistant-driven move has to look like the assistant did it. Without a
 * press the page just changes, which is indistinguishable from the app acting
 * on its own — and someone watching their teammate work their console needs to
 * be able to tell the difference.
 */
describe('showing the press', () => {
  it('animates a press on a control that is already on screen', () => {
    const button = addButton('rail-section-integrations');

    flashElement('rail-section-integrations');

    expect(button.classList.contains(PRESS_CLASS)).toBe(true);
  });

  it('waits for a control that only renders after the move', async () => {
    // The billing sub-nav does not exist until billing is open, so a press
    // shown only for controls present up front would silently skip it.
    flashElement('settings-link-billing');
    await new Promise((resolve) => setTimeout(resolve, 20));
    const button = addButton('settings-link-billing');
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(button.classList.contains(PRESS_CLASS)).toBe(true);
  });

  it('replays when the same control is pressed twice in one script', () => {
    const button = addButton('rail-section-tasks');

    flashElement('rail-section-tasks');
    flashElement('rail-section-tasks');

    expect(button.classList.contains(PRESS_CLASS)).toBe(true);
  });

  it('does nothing when the control is absent', async () => {
    expect(() => flashElement('not-here')).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(document.querySelector(`.${PRESS_CLASS}`)).toBeNull();
  });
});

describe('what gets a press', () => {
  it('gives every navigation target one', () => {
    // A move with no press is a page that changed by itself.
    for (const target of buildActionCatalogue()) {
      expect(targetTestId(target.id), `${target.id} has no control to press`).not.toBeNull();
    }
  });

  it('maps each target kind to the control that leads there', () => {
    expect(targetTestId('section:integrations')).toBe('rail-section-integrations');
    expect(targetTestId('account:security')).toBe('settings-nav-security');
    expect(targetTestId('route:/billing')).toBe('settings-link-billing');
    expect(targetTestId('route:/account')).toBe('rail-nav-settings');
  });
});

/**
 * Test ids are the one part of this that is named rather than derived, so a
 * rename elsewhere would break a press at runtime with nothing but a console
 * warning. These fail the build instead.
 */
describe('the test ids this feature names still exist', () => {
  it('finds the control each navigation target presses', () => {
    for (const target of buildActionCatalogue()) {
      const testId = targetTestId(target.id);
      if (!testId) continue;
      // A fixed id appears verbatim. A templated one renders as
      // `settings-nav-${item.id}`, so the stem is the test id with the
      // target's own trailing name removed — which is what to look for.
      if (SOURCE.includes(testId)) continue;
      const suffix = target.id.split(/[:/]/).pop() ?? '';
      const stem = testId.slice(0, testId.length - suffix.length);
      expect(
        stem.length > 0 && SOURCE.includes(stem),
        `no component renders ${testId} (looked for stem "${stem}")`
      ).toBe(true);
    }
  });

  it('finds every clickable control in the allowlist', () => {
    for (const leaf of LEAF_TARGETS) {
      const stem = leaf.testId.replace('{param}', '');
      expect(SOURCE.includes(stem), `no component renders ${leaf.testId}`).toBe(true);
    }
  });
});
