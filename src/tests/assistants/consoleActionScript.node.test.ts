import { describe, expect, it } from 'vitest';
import {
  dueSteps,
  parseConsoleScript,
  CONSOLE_ACTIONS_TOPIC,
  TRANSCRIPTION_TOPIC,
} from '@/lib/agent-guidance/consoleActionScript';
import {
  executeConsoleTarget,
  targetTestId,
  type TargetNavigator,
} from '@/lib/agent-guidance/consoleTargets';
import { buildActionCatalogue, isKnownTarget } from '@/lib/agent-guidance/actionCatalogue';
import type { ConsoleActionStep } from '@/types/agentActions';

function navSpy() {
  const calls: Array<[string, unknown]> = [];
  const nav: TargetNavigator = {
    navigateTo: (href) => calls.push(['navigateTo', href]),
    navigateToAssistants: (options) => calls.push(['navigateToAssistants', options]),
  };
  return { nav, calls };
}

describe('console action catalogue', () => {
  it('offers only ids that resolve to a real move', () => {
    const { nav, calls } = navSpy();
    for (const target of buildActionCatalogue()) {
      expect(executeConsoleTarget(target.id, nav)).toBe(true);
    }
    expect(calls).toHaveLength(buildActionCatalogue().length);
  });

  it('never offers the staff-only admin surface', () => {
    // An assistant taking a customer into internal tooling is the one
    // navigation mistake with real consequences.
    const ids = buildActionCatalogue().map((t) => t.id);
    expect(ids.some((id) => id.includes('admin'))).toBe(false);
  });

  it('refuses an id that is not in the catalogue', () => {
    const { nav, calls } = navSpy();
    expect(executeConsoleTarget('section:nonexistent', nav)).toBe(false);
    expect(executeConsoleTarget('route:/admin', nav)).toBe(false);
    expect(executeConsoleTarget('javascript:alert(1)', nav)).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('routes each target kind through the shell router', () => {
    const { nav, calls } = navSpy();
    executeConsoleTarget('section:integrations', nav);
    executeConsoleTarget('route:/billing', nav);
    executeConsoleTarget('account:security', nav);

    expect(calls).toEqual([
      ['navigateToAssistants', { sectionId: 'integrations' }],
      ['navigateTo', '/billing'],
      ['navigateTo', '/account?tab=security'],
    ]);
  });

  it('points a section highlight at the rail button that renders it', () => {
    expect(targetTestId('section:integrations')).toBe('rail-section-integrations');
    expect(targetTestId('route:/billing')).toBeNull();
  });

  it('agrees with isKnownTarget', () => {
    expect(isKnownTarget('section:chat')).toBe(true);
    expect(isKnownTarget('section:made-up')).toBe(false);
  });
});

describe('script parsing', () => {
  const valid = {
    type: 'console_script',
    scriptId: 'guid-1',
    spokenText: 'Open Integrations, then billing.',
    steps: [
      { target: 'section:integrations', afterChars: 17 },
      { target: 'route:/billing', afterChars: 31 },
    ],
  };

  it('reads a well-formed script', () => {
    const parsed = parseConsoleScript(valid);
    expect(parsed?.scriptId).toBe('guid-1');
    expect(parsed?.steps).toHaveLength(2);
  });

  it.each([
    ['a foreign message', { type: 'ready_to_speak' }],
    ['a non-object', 'nonsense'],
    ['a script with no usable steps', { ...valid, steps: [] }],
    ['steps missing an offset', { ...valid, steps: [{ target: 'section:chat' }] }],
    ['steps missing a target', { ...valid, steps: [{ afterChars: 4 }] }],
  ])('rejects %s', (_label, payload) => {
    expect(parseConsoleScript(payload)).toBeNull();
  });

  it('drops malformed steps but keeps the good ones', () => {
    const parsed = parseConsoleScript({
      ...valid,
      steps: [{ target: 'section:chat', afterChars: 3 }, { target: 42 }],
    });
    expect(parsed?.steps).toEqual([{ target: 'section:chat', afterChars: 3 }]);
  });
});

describe('step scheduling', () => {
  const steps: ConsoleActionStep[] = [
    { target: 'section:integrations', afterChars: 10 },
    { target: 'route:/billing', afterChars: 30 },
  ];

  it('holds a step until playout reaches its words', () => {
    expect(dueSteps(steps, 0, new Set())).toHaveLength(0);
    expect(dueSteps(steps, 9, new Set())).toHaveLength(0);
    expect(dueSteps(steps, 10, new Set())).toHaveLength(1);
  });

  it('fires each step once', () => {
    const fired = new Set<number>([0]);
    const due = dueSteps(steps, 30, fired);
    expect(due.map((d) => d.index)).toEqual([1]);
  });

  it('releases a backlog in order when a chunk jumps past several', () => {
    const due = dueSteps(steps, 100, new Set());
    expect(due.map((d) => d.step.target)).toEqual(['section:integrations', 'route:/billing']);
  });

  it('never fires a step the speech did not reach', () => {
    // A barge-in stops the transcript. The later move must not happen:
    // interrupting "and then your billing page" should not open billing.
    const interruptedAt = 12;
    const due = dueSteps(steps, interruptedAt, new Set());
    expect(due.map((d) => d.step.target)).toEqual(['section:integrations']);
  });
});

describe('wire contract', () => {
  it('matches the topics the runtime publishes on', () => {
    expect(CONSOLE_ACTIONS_TOPIC).toBe('console_actions');
    expect(TRANSCRIPTION_TOPIC).toBe('lk.transcription');
  });
});
