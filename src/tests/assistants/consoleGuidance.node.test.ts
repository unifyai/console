import { describe, expect, it } from 'vitest';
import { buildConsoleGuidance } from '@/lib/agent-guidance/consoleGuidance';
import { ALL_SECTIONS } from '@/components/Pages/Assistants/Rail/sectionConfig';
import { UNIFIED_SHELL_ROUTE_DEFINITIONS } from '@/lib/navigation/shellRoutes';
import { SETTINGS_ACCOUNT_TABS } from '@/lib/navigation/settingsAccountTab';
import {
  ORGANIZATION_ADMIN_TABS,
  ORGANIZATION_MEMBER_TABS,
} from '@/lib/navigation/organizationTabs';

/**
 * The guidance is the assistant's only picture of this app, so these assert the
 * property that keeps it honest: every surface the console renders is described,
 * derived from the same registries that render it. A section added to the rail
 * without appearing here would leave the assistant unable to mention it.
 */
describe('console guidance', () => {
  const guidance = buildConsoleGuidance();

  it('describes every rail section', () => {
    for (const section of ALL_SECTIONS) {
      expect(guidance.brief).toContain(section.label);
      expect(guidance.brief).toContain(section.desc);
    }
  });

  it('describes every customer-facing shell surface by path', () => {
    // `assistants` is the rail itself, covered above. Admin is deliberately
    // collapsed to its root: it is staff-only, and the guidance tells the
    // assistant never to send a customer there, so its sub-routes are bloat.
    const customerFacing = UNIFIED_SHELL_ROUTE_DEFINITIONS.filter(
      (route) => route.surface !== 'assistants' && !route.requiresUnifyAdmin
    );
    expect(customerFacing.length).toBeGreaterThan(0);
    for (const route of customerFacing) {
      expect(guidance.brief).toContain(route.path);
    }
  });

  it('mentions admin once, at its root', () => {
    const adminMentions = guidance.brief.match(/\/admin/g) ?? [];
    expect(adminMentions).toHaveLength(1);
    expect(guidance.brief).not.toContain('/admin/');
  });

  it('flags surfaces that are not universally available', () => {
    // Sending a customer to an internal tool is the costly mistake here.
    expect(guidance.brief).toContain('Unify staff only');
    expect(guidance.brief).toContain('hidden when billing is disabled');
    expect(guidance.brief).toContain('hidden on self-host');
  });

  it('names the account sub-pages', () => {
    for (const tab of SETTINGS_ACCOUNT_TABS) {
      expect(guidance.brief).toContain(tab.label);
    }
  });

  it('names the organization tabs and marks the admin-only ones', () => {
    for (const tab of ORGANIZATION_MEMBER_TABS) {
      expect(guidance.brief).toContain(tab.label);
    }
    for (const tab of ORGANIZATION_ADMIN_TABS) {
      expect(guidance.brief).toContain(tab.label);
    }
    expect(guidance.brief).toContain('only for members who can update the organization');
  });

  it('states credential scope before it can be got wrong', () => {
    // Whoever else can use a shared credential is the fact worth being loud
    // about: it is the difference between one teammate and a whole workspace.
    expect(guidance.brief).toContain('every current member of that workspace');
    expect(guidance.brief).toContain('never read one aloud');
  });

  it('tells the assistant to admit ignorance rather than invent a route', () => {
    expect(guidance.brief).toContain('I do not describe menus, icons, buttons, or positions');
    expect(guidance.brief).toContain('not in the catalogue');
  });

  it('adds per-surface usage hints only in the full variant', () => {
    const [firstStepTitle, firstStepBody] = ALL_SECTIONS[0].steps[0];
    expect(guidance.full).toContain(firstStepTitle);
    expect(guidance.full).toContain(firstStepBody);
    expect(guidance.brief).not.toContain(firstStepBody);
    expect(guidance.full.length).toBeGreaterThan(guidance.brief.length);
  });

  it('versions by content so the runtime can tell deploys apart', () => {
    expect(guidance.version).toMatch(/^[0-9a-f]{12}$/);
    expect(buildConsoleGuidance().version).toBe(guidance.version);
  });
});
