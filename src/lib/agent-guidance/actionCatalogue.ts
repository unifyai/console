/**
 * The places the assistant may take the user, derived from the registries that
 * render them.
 *
 * A target is a shell-router call, not a selector. `ALL_SECTIONS` drives the
 * rail and `UNIFIED_SHELL_ROUTE_DEFINITIONS` drives routing, so a surface that
 * disappears from the console disappears from here in the same commit, and a
 * target the runtime names either resolves through the router or is rejected —
 * it can never land on the wrong control.
 *
 * Admin is excluded on purpose: it is staff-only, and an assistant taking a
 * customer there is the one navigation mistake with real consequences.
 */

import { ALL_SECTIONS } from '@/components/Pages/Assistants/Rail/sectionConfig';
import { SHELL_SECTIONS } from '@/components/Layout/Shell/shellSections';
import { SETTINGS_ACCOUNT_TABS } from '@/lib/navigation/settingsAccountTab';
import { UNIFIED_SHELL_ROUTE_DEFINITIONS } from '@/lib/navigation/shellRoutes';
import { renderLeafTargets, resolveLeafTestId } from '@/lib/agent-guidance/leafTargets';
import type { ConsoleActionTarget } from '@/types/agentActions';

export const SECTION_TARGET_PREFIX = 'section:';
export const ROUTE_TARGET_PREFIX = 'route:';
export const ACCOUNT_TAB_TARGET_PREFIX = 'account:';

/** Rail sections, scoped to whichever teammate is selected. */
function sectionTargets(): ConsoleActionTarget[] {
  return ALL_SECTIONS.map((section) => ({
    id: `${SECTION_TARGET_PREFIX}${section.id}`,
    label: section.label,
    description: section.desc,
  }));
}

/** Account and workspace surfaces, minus the staff-only ones. */
function routeTargets(): ConsoleActionTarget[] {
  const seen = new Set<string>();
  const targets: ConsoleActionTarget[] = [];

  for (const route of UNIFIED_SHELL_ROUTE_DEFINITIONS) {
    if (route.surface === 'assistants' || route.requiresUnifyAdmin) continue;
    if (seen.has(route.surface)) continue;
    seen.add(route.surface);

    const section =
      route.surface === 'account'
        ? SHELL_SECTIONS.settings
        : SHELL_SECTIONS[route.surface as keyof typeof SHELL_SECTIONS];
    if (!section) continue;

    targets.push({
      id: `${ROUTE_TARGET_PREFIX}${route.path}`,
      label: section.label,
      description: section.desc,
    });
  }

  return targets;
}

/** Sub-pages of the account surface, reached by query rather than by path. */
function accountTabTargets(): ConsoleActionTarget[] {
  return SETTINGS_ACCOUNT_TABS.map((tab) => ({
    id: `${ACCOUNT_TAB_TARGET_PREFIX}${tab.id}`,
    label: `Settings → ${tab.label}`,
    description: `The ${tab.label} page of the user's own account settings.`,
  }));
}

export function buildActionCatalogue(): ConsoleActionTarget[] {
  return [...sectionTargets(), ...routeTargets(), ...accountTabTargets()];
}

/** Whether an id names something this console can actually navigate to. */
export function isKnownTarget(id: string): boolean {
  return buildActionCatalogue().some((target) => target.id === id);
}

/** Whether an id names any move this console will make, including a click. */
export function isOfferedTarget(id: string): boolean {
  return isKnownTarget(id) || resolveLeafTestId(id) !== null;
}

/**
 * The catalogue as prompt lines. Kept terse: this rides in every prompt built
 * while the user is on the console, and the prose guidance already explains
 * what each surface is for.
 */
export function renderActionCatalogue(): string {
  const lines = buildActionCatalogue().map((target) => `- \`${target.id}\` — ${target.label}`);
  return [
    'Places I can take my boss (console navigation targets)',
    '------------------------------------------------------',
    ...lines,
    '',
    'Controls I can press for them. Anything that submits, confirms, pays,',
    'disconnects or deletes is deliberately absent -- I open the thing and let',
    'them decide.',
    ...renderLeafTargets(),
  ].join('\n');
}
