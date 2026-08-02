import { describe, expect, it } from 'vitest';
import {
  DESTRUCTIVE_PATTERNS,
  LEAF_TARGETS,
  isDestructiveTestId,
  leafSection,
  renderLeafTargets,
  resolveLeafTestId,
} from '@/lib/agent-guidance/leafTargets';
import { isOfferedTarget } from '@/lib/agent-guidance/actionCatalogue';

/**
 * Clicking is the half of this feature that can cost something. The assistant
 * reads email, so a prompt-injected instruction reaching a Disconnect button is
 * the failure worth writing tests against — not the happy path.
 */
describe('what the assistant may click', () => {
  it('registers nothing that commits, confirms, or destroys', () => {
    for (const leaf of LEAF_TARGETS) {
      expect(
        isDestructiveTestId(leaf.testId),
        `${leaf.id} resolves to a committing control: ${leaf.testId}`
      ).toBe(false);
    }
  });

  it('refuses a destructive id even if one were registered', () => {
    // The rule is enforced at resolve time too, so the allowlist and the rule
    // cannot drift apart if someone adds an entry carelessly.
    for (const word of DESTRUCTIVE_PATTERNS) {
      expect(isDestructiveTestId(`integration-${word}-github`)).toBe(true);
    }
  });

  it('resolves a registered fixed control', () => {
    expect(resolveLeafTestId('leaf:add-integration')).toBe('integrations-add-new-trigger');
  });

  it('resolves a parameterized control', () => {
    expect(resolveLeafTestId('leaf:integration:github')).toBe('integration-card-github');
  });

  it.each([
    ['an unregistered id', 'leaf:disconnect'],
    ['a missing parameter', 'leaf:integration'],
    ['a parameter on a fixed target', 'leaf:add-integration:github'],
    ['extra segments', 'leaf:integration:github:extra'],
    ['a non-leaf id', 'section:integrations'],
  ])('refuses %s', (_label, target) => {
    expect(resolveLeafTestId(target)).toBeNull();
  });

  it.each([
    ['a selector escape', 'leaf:integration:github"] , [data-testid="integrations-delete-confirm'],
    ['a path traversal', 'leaf:integration:../../admin'],
    ['whitespace', 'leaf:integration:git hub'],
    ['uppercase and symbols', 'leaf:integration:GitHub!'],
    ['an empty parameter', 'leaf:integration:'],
  ])('refuses %s in the parameter', (_label, target) => {
    // The parameter only ever fills a fixed template, so a rejected slug can
    // never widen the selector to a control outside the allowlist.
    expect(resolveLeafTestId(target)).toBeNull();
  });

  it('produces a test id that can only name an allowlisted control shape', () => {
    const resolved = resolveLeafTestId('leaf:integration:notion');
    expect(resolved).toMatch(/^integration-card-[a-z0-9_-]+$/);
  });

  it('names the section a control lives in, so a script can go there first', () => {
    expect(leafSection('leaf:integration:github')).toBe('integrations');
    expect(leafSection('section:integrations')).toBeNull();
  });

  it('offers leaves alongside navigation targets', () => {
    expect(isOfferedTarget('leaf:integration:github')).toBe(true);
    expect(isOfferedTarget('section:integrations')).toBe(true);
    expect(isOfferedTarget('leaf:integration-disconnect:github')).toBe(false);
  });

  it('tells the model in the catalogue that committing controls are absent', () => {
    const lines = renderLeafTargets().join('\n');
    expect(lines).toContain('leaf:integration:<name>');
    expect(lines).toContain('leaf:add-integration');
  });
});
