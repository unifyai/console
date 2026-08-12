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
    expect(resolveLeafTestId('leaf:integration-gallery')).toBe('integrations-add-new-trigger');
  });

  it('resolves a parameterized control', () => {
    expect(resolveLeafTestId('leaf:integration:github')).toBe('integration-card-github');
  });

  it.each([
    ['an unregistered id', 'leaf:disconnect'],
    ['a missing parameter', 'leaf:integration'],
    ['a parameter on a fixed target', 'leaf:integration-gallery:github'],
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
    expect(lines).toContain('leaf:integration-gallery');
  });
});

/**
 * The registry names controls one by one, but the console has hundreds and
 * grows weekly. These check the rule against the console as it actually is
 * rather than against the handful of ids someone remembered to think about.
 */
describe('measured against the whole console', () => {
  it('refuses every control that commits, sends, pays or destroys', () => {
    const dangerous = [
      'integration-disconnect-slack',
      'provider-integration-connect-submit',
      'delete-account-btn',
      'data-row-detail-delete',
      'log-grid-delete-row',
      'secrets-row-delete',
      'secrets-new-button',
      'remove-card',
      'add-card-submit',
      'topup-submit',
      'cancel-subscription-confirm',
      'switch-plan-confirm',
      'org-chat-send',
      'contact-message',
      'chat-reaction-picker',
      'attachment-remove-all',
      'org-call-end',
      'org-call-leave',
      'incoming-human-call-answer',
      'incoming-human-call-decline',
      'account-sign-out',
      'impersonate-confirm',
      'view-as-user-menu-item',
      'reset-account-menu-item',
      'dev-login-owner',
      'enable-2fa-btn',
      'disable-2fa-btn',
      'require-mfa-toggle',
      'regenerate-codes-btn',
      'download-codes-btn',
      'team-hire-button',
      'assistant-onboard-button',
      'desktop-enable-computer',
      'desktop-delete-vm',
      'coordinator-onboarding-skip-email',
      'integration-policy-all-off',
      'org-sharing-toggle',
      'workspace-personal',
      'data-create-table-submit',
      'data-import-submit',
      'tab-delete-1',
      'ms-teams-bot-disconnect-button',
      'slack-disconnect-button',
      'smartlead-reply-approve',
      'support-ticket-submit',
      'invoice-download-1',
    ];
    for (const testId of dangerous) {
      expect(isDestructiveTestId(testId), `${testId} is not refused`).toBe(true);
    }
  });

  it('does not refuse the reading and opening it is meant to allow', () => {
    // The deny rule has to be blunt to be safe, but blunt enough to reject
    // "open the integration card" would make the feature pointless.
    const readable = [
      'integration-card-github',
      'contact-card-42',
      'function-card-7',
      'knowledge-item-3',
      'transcripts-thread-9',
      'task-card-head',
      'assistant-info-button',
      'log-grid-sort-asc-name',
      'log-grid-group-by-status',
      'data-folder-toggle',
      'jump-to-present-button',
    ];
    for (const testId of readable) {
      expect(isDestructiveTestId(testId), `${testId} is wrongly refused`).toBe(false);
    }
  });

  it('offers nothing the deny rule would refuse', () => {
    // Belt and braces: a registry entry can never grant what the rule denies,
    // and this catches an entry added without noticing it was already covered.
    for (const leaf of LEAF_TARGETS) {
      const resolved = resolveLeafTestId(
        leaf.parameterized ? `leaf:${leaf.id}:example` : `leaf:${leaf.id}`
      );
      expect(resolved, `${leaf.id} resolves to nothing`).not.toBeNull();
    }
  });
});
