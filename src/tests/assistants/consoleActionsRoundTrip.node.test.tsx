import { describe, expect, it, vi, afterEach } from 'vitest';
import { parseConsoleScript, dueSteps } from '@/lib/agent-guidance/consoleActionScript';
import { executeTarget, type TargetNavigator } from '@/lib/agent-guidance/consoleTargets';

/**
 * A script exactly as the runtime emits it, replayed against the real
 * scheduler and executor. This is the seam where an off-by-one would move the
 * page on the wrong word, and where a nav step and a click step have to hand
 * over to each other correctly.
 */
const RUNTIME_SCRIPT = {
  type: 'console_script',
  scriptId: 'g2',
  spokenText: "Sure — Integrations is here, and that's the GitHub one.",
  steps: [
    { target: 'section:integrations', afterChars: 27 },
    { target: 'leaf:integration:github', afterChars: 54 },
  ],
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('a runtime script, replayed', () => {
  it('lands each move on the words it belongs to', async () => {
    const script = parseConsoleScript(RUNTIME_SCRIPT);
    expect(script).not.toBeNull();

    const card = document.createElement('button');
    card.setAttribute('data-testid', 'integration-card-github');
    document.body.appendChild(card);
    const cardClick = vi.fn();
    card.addEventListener('click', cardClick);

    const moves: string[] = [];
    const nav: TargetNavigator = {
      navigateTo: (href) => moves.push(`route ${href}`),
      navigateToAssistants: (o) => moves.push(`section ${o?.sectionId}`),
    };

    const fired = new Set<number>();
    const saidWhenFired: string[] = [];
    for (let n = 1; n <= script!.spokenText.length; n++) {
      for (const { index, step } of dueSteps(script!.steps, n, fired)) {
        fired.add(index);
        saidWhenFired.push(script!.spokenText.slice(0, n));
        await executeTarget(step.target, nav, {});
      }
    }

    expect(saidWhenFired[0].endsWith('Integrations is here')).toBe(true);
    expect(saidWhenFired[1].endsWith("that's the GitHub one")).toBe(true);
    expect(moves).toEqual(['section integrations']);
    expect(cardClick).toHaveBeenCalledTimes(1);
  });

  it('leaves the click undone when the user cuts in before it', async () => {
    const script = parseConsoleScript(RUNTIME_SCRIPT)!;
    const card = document.createElement('button');
    card.setAttribute('data-testid', 'integration-card-github');
    document.body.appendChild(card);
    const cardClick = vi.fn();
    card.addEventListener('click', cardClick);

    const nav: TargetNavigator = { navigateTo: vi.fn(), navigateToAssistants: vi.fn() };
    // Interrupted just after the first move's words.
    for (const { step } of dueSteps(script.steps, 30, new Set())) {
      await executeTarget(step.target, nav, {});
    }

    expect(nav.navigateToAssistants).toHaveBeenCalledTimes(1);
    expect(cardClick).not.toHaveBeenCalled();
  });
});

/**
 * The model named a control and never mentioned its pane — which is the normal
 * way someone talks. Before the hop this waited three seconds and gave up.
 */
describe('a script that names a control without its pane', () => {
  const SCRIPT = {
    type: 'console_script',
    scriptId: 'g3',
    spokenText: "Let me pull up Dana's record for you.",
    steps: [{ target: 'leaf:contact:42', afterChars: 36 }],
  };

  it('opens the pane, then the record, from one step', async () => {
    const script = parseConsoleScript(SCRIPT)!;
    const moves: string[] = [];
    const nav: TargetNavigator = {
      navigateTo: (h) => moves.push(`route ${h}`),
      navigateToAssistants: (o) => {
        moves.push(`section ${o?.sectionId}`);
        // The pane renders its rows once opened.
        const card = document.createElement('button');
        card.setAttribute('data-testid', 'contact-card-42');
        document.body.appendChild(card);
      },
    };

    const outcome = await executeTarget(script.steps[0].target, nav, {});

    expect(moves).toEqual(['section contacts']);
    expect(outcome).toBe('clicked');
  });
});
