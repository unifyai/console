import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeTarget, type TargetNavigator } from '@/lib/agent-guidance/consoleTargets';
import { LEAF_TARGETS } from '@/lib/agent-guidance/leafTargets';

function navSpy() {
  const sections: Array<string | null | undefined> = [];
  const routes: string[] = [];
  const nav: TargetNavigator = {
    navigateTo: (href) => routes.push(href),
    navigateToAssistants: (options) => sections.push(options?.sectionId),
  };
  return { nav, sections, routes };
}

function addControl(testId: string): HTMLElement {
  const el = document.createElement('button');
  el.setAttribute('data-testid', testId);
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

/**
 * A control only exists inside its pane, so naming one has to be enough on its
 * own — the model should not have to remember to open the pane first, and must
 * not be able to get that order wrong.
 */
describe('reaching a control in another pane', () => {
  it('goes to the pane when the control is not on screen', async () => {
    const { nav, sections } = navSpy();
    // The control appears once the pane renders, as it would after the hop.
    setTimeout(() => addControl('contact-card-42'), 15);

    const outcome = await executeTarget('leaf:contact:42', nav, {});

    expect(sections).toEqual(['contacts']);
    expect(outcome).toBe('clicked');
  });

  it('does not hop when the control is already on screen', async () => {
    // The assistant navigated in an earlier step; hopping again would flash a
    // pane change that did not happen and reset what the user was looking at.
    const { nav, sections } = navSpy();
    const control = addControl('contact-card-42');
    const onClick = vi.fn();
    control.addEventListener('click', onClick);

    const outcome = await executeTarget('leaf:contact:42', nav, {});

    expect(sections).toEqual([]);
    expect(outcome).toBe('clicked');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is unchanged when the script already contained the pane step', async () => {
    const { nav, sections } = navSpy();
    await executeTarget('section:contacts', nav, {});
    addControl('contact-card-42');
    await executeTarget('leaf:contact:42', nav, {});

    // One hop in total: the explicit one. The leaf added nothing.
    expect(sections).toEqual(['contacts']);
  });

  it('shows the hop as its own press before the click', async () => {
    const { nav } = navSpy();
    const highlight = vi.fn();
    setTimeout(() => addControl('contact-card-42'), 15);

    await executeTarget('leaf:contact:42', nav, { highlight });

    expect(highlight.mock.calls.map((c) => c[0])).toEqual([
      'rail-section-contacts',
      'contact-card-42',
    ]);
  });

  it('still reports a control that never appears', async () => {
    const { nav, sections } = navSpy();

    const outcome = await executeTarget('leaf:contact:99', nav, {});

    expect(sections).toEqual(['contacts']);
    expect(outcome).toBe('not-found');
  });

  it('does not hop for a control that belongs to no pane', async () => {
    // The teammate info panel is reachable from anywhere, so sending the user
    // to a pane to open it would move them for no reason.
    const { nav, sections } = navSpy();
    addControl('assistant-info-button');

    await executeTarget('leaf:teammate-info', nav, {});

    expect(sections).toEqual([]);
  });

  it('never hops for an id it would refuse anyway', async () => {
    const { nav, sections, routes } = navSpy();

    const outcome = await executeTarget('leaf:integration-disconnect:slack', nav, {});

    expect(outcome).toBe('unknown');
    expect(sections).toEqual([]);
    expect(routes).toEqual([]);
  });

  it('names a real rail section for every control that declares one', async () => {
    // The hop presses `rail-section-<id>`, so a section that is not a real rail
    // id would navigate nowhere and leave the click waiting on a pane that
    // never opens.
    const { ALL_SECTIONS } = await import('@/components/Pages/Assistants/Rail/sectionConfig');
    const railIds = new Set(ALL_SECTIONS.map((s) => s.id));
    for (const leaf of LEAF_TARGETS) {
      if (!leaf.section) continue;
      expect(railIds.has(leaf.section), `${leaf.id} declares unknown pane ${leaf.section}`).toBe(
        true
      );
    }
  });
});
