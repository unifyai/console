/**
 * Console orientation text for the assistant runtime.
 *
 * The runtime has no built-in picture of this app. It fetches this block at
 * session start and drops it into the system prompt, so the assistant describes
 * the console the user is actually looking at rather than a remembered one.
 *
 * The surface list is derived from the same registries that render the app —
 * `ALL_SECTIONS` drives the left rail, `UNIFIED_SHELL_ROUTE_DEFINITIONS` drives
 * routing — so a renamed or removed surface cannot go stale here without also
 * breaking navigation. Only the posture prose below is hand-written, and it
 * deliberately describes intent rather than click paths: geometry is the part
 * that rots, and an assistant confidently naming a menu that no longer exists is
 * worse than one that offers to look together.
 */

import { createHash } from 'node:crypto';
import { ALL_SECTIONS, type SectionDef } from '@/components/Pages/Assistants/Rail/sectionConfig';
import { SHELL_SECTIONS } from '@/components/Layout/Shell/shellSections';
import { SETTINGS_ACCOUNT_TABS } from '@/lib/navigation/settingsAccountTab';
import {
  ORGANIZATION_ADMIN_TABS,
  ORGANIZATION_MEMBER_TABS,
} from '@/lib/navigation/organizationTabs';
import { UNIFIED_SHELL_ROUTE_DEFINITIONS, type ShellSurface } from '@/lib/navigation/shellRoutes';
import type { ConsoleGuidance } from '@/types/agentGuidance';

/**
 * The section descriptor describing a workspace surface, or null for surfaces
 * documented elsewhere in the block. Written as an exhaustive switch so adding
 * a shell surface fails the build here rather than silently going undescribed.
 */
function surfaceSection(surface: ShellSurface): SectionDef | null {
  switch (surface) {
    case 'account':
      return SHELL_SECTIONS.settings;
    case 'billing':
      return SHELL_SECTIONS.billing;
    case 'usage':
      return SHELL_SECTIONS.usage;
    case 'organizations':
      return SHELL_SECTIONS.organizations;
    case 'admin':
      return SHELL_SECTIONS.admin;
    case 'favourites':
      return SHELL_SECTIONS.favourites;
    // The teammate rail and the interfaces library are described separately.
    case 'assistants':
    case 'interfaces':
      return null;
  }
}

/** Availability caveats a route carries, phrased for the reader of the prompt. */
function routeCaveats(route: (typeof UNIFIED_SHELL_ROUTE_DEFINITIONS)[number]): string {
  const notes: string[] = [];
  if (route.requiresUnifyAdmin) notes.push('Unify staff only — never send a customer here');
  if (route.requiresBilling) notes.push('hidden when billing is disabled');
  if (route.requiresNonSelfHost) notes.push('hidden on self-host');
  return notes.length > 0 ? ` (${notes.join('; ')})` : '';
}

function sectionLines(section: SectionDef, includeSteps: boolean): string[] {
  const lines = [`- **${section.label}** — ${section.desc}`];
  if (includeSteps) {
    for (const [title, body] of section.steps) {
      lines.push(`    · ${title}: ${body}`);
    }
  }
  return lines;
}

/**
 * Account and workspace surfaces, one line each. `admin` contributes several
 * routes that share a section descriptor, so it is collapsed to its root.
 */
function workspaceSurfaceLines(includeSteps: boolean): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const route of UNIFIED_SHELL_ROUTE_DEFINITIONS) {
    if (seen.has(route.surface)) continue;
    const section = surfaceSection(route.surface);
    if (!section) continue;
    seen.add(route.surface);

    lines.push(
      `- **${section.label}** (\`${route.path}\`)${routeCaveats(route)} — ${section.desc}`
    );
    if (route.surface === 'account') {
      const tabs = SETTINGS_ACCOUNT_TABS.map((tab) => tab.label).join(', ');
      lines.push(`    · Sub-pages: ${tabs}.`);
    }
    if (includeSteps) {
      for (const [title, body] of section.steps) {
        lines.push(`    · ${title}: ${body}`);
      }
    }
  }

  return lines;
}

const LAYOUT = `**Layout.** A narrow icon-only rail runs down the left edge: the Unify mark at the top, then the teammate switcher, then the section icons — workspace sections first, a divider, then brain sections. Account, settings and the theme toggle sit at the foot of the rail. Icons show their name on hover. Whichever teammate is selected in the switcher scopes everything: every section shows that teammate's data and nothing else.`;

/**
 * Semantics the surface list cannot convey: what a thing *means*, who it
 * reaches, and what is irreversible. This is the part an assistant gets wrong
 * in ways that matter — telling someone to paste a key into chat, or putting a
 * credential somewhere the whole team can read it — so it stays close to the
 * UI it describes rather than in the runtime's prompts.
 */
function organizationSemantics(): string {
  const memberTabs = ORGANIZATION_MEMBER_TABS.map((t) => `**${t.label}**`).join(', ');
  const adminTabs = ORGANIZATION_ADMIN_TABS.map((t) => `**${t.label}**`).join(' and ');
  return `**Organizations.** The organization workspace has ${memberTabs}; ${adminTabs} appear only for members who can update the organization, so I do not promise them to everyone.
- Roles are per-organization and can be customised, so I never recite a fixed list — I ask, or look. What always holds: an invite cannot grant **Owner**, and **Member** is the default.
- Most org work has two routes: my boss can do it in the console, or I can do it myself when I hold the primitive and the authorisation. When both apply I say so and let them pick, rather than presenting the console as the only way.
- Org-scoped changes need the organization workspace to be the active one. From a personal workspace neither route runs.`;
}

function credentialSemantics(): string {
  return `**Credentials and sharing.** Apps are connected under **Integrations**, by OAuth or by an API key depending on the app. Values are never displayed back, and I never ask for one in chat or on a call, never read one aloud, and never store one as memory.
- **Scope is the decision that matters.** A credential held personally is usable by that one teammate. A credential placed in a shared workspace is usable at runtime by **every current member of that workspace** — not only the person who asked for it. I say which is happening before it happens.
- Removing someone from a workspace ends their access; what was shared stays for everyone else.
- I prefer the narrowest thing that works — read-only first, one teammate before a whole workspace.
- If an app is not in the catalogue, I say so plainly. I do not invent a path to connect something the console cannot connect.`;
}

function onboardingSemantics(): string {
  return `**Onboarding.** New workspaces get a setup checklist. The whole flow can be paused and resumed later, and individual steps can be skipped; a skipped step is passed over, not finished. My live progress context is authoritative for which steps exist and what state they are in — I read it there rather than working it out, and I never call a step done on my own say-so.`;
}

const POSTURE = `**How I talk about the console.**
- I name the surface and what it is *for* ("that lives under Integrations") rather than reciting a click path. I do not describe menus, icons, buttons, or positions that are not listed above — if I cannot see how they get somewhere, I say so and offer to look together rather than inventing a route.
- When someone is setting something up or is lost, my first instinct is to offer a screen share and walk them through it, not to read out a list of steps.
- Credentials are authorized on **Integrations** by connecting the app. They are never pasted into chat, never read aloud on a call, and never stored as memory.
- Distinctions worth keeping straight: **Actions** is work running now, **Tasks** is scheduled or triggered work, **Knowledge** is facts I have stored, and **Guidance** is playbooks that shape how I behave.
- Only my boss can click. I have no way to operate the console for them.`;

function compose(includeSteps: boolean): string {
  return [
    'Console knowledge',
    '-----------------',
    'The console is the web app my boss uses to work with me. This section is published by the running console itself, so it describes the version in front of them.',
    '',
    LAYOUT,
    '',
    "**Teammate sections** — the left rail, scoped to the selected teammate. Each description below is the console's own wording, written for my boss:",
    ...ALL_SECTIONS.flatMap((section) => sectionLines(section, includeSteps)),
    '',
    '**Account and workspace surfaces** (from the rail foot)',
    ...workspaceSurfaceLines(includeSteps),
    '',
    organizationSemantics(),
    '',
    credentialSemantics(),
    '',
    onboardingSemantics(),
    '',
    POSTURE,
  ].join('\n');
}

export function buildConsoleGuidance(): ConsoleGuidance {
  const brief = compose(false);
  const full = compose(true);
  const version = createHash('sha256').update(`${brief}\n${full}`).digest('hex').slice(0, 12);
  return { version, brief, full };
}
