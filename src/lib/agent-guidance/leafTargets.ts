/**
 * Controls the assistant may click, and the line it may not cross.
 *
 * Navigation targets are safe by construction: they call the shell router, and
 * an unknown id does nothing. Clicking is different — a click commits, and the
 * assistant reads email, so a prompt-injected instruction reaching a Disconnect
 * button is the failure that actually costs something.
 *
 * So the allowlist is central rather than scattered across components: this file
 * is the whole set of controls the assistant can press, reviewable in one sitting.
 * Anything that submits, confirms, disconnects, deletes, revokes, or pays stays
 * out, and a test enforces that against the ids below rather than trusting the
 * next person to remember. What is left over is the useful half: opening a thing
 * so the user can look at it and decide for themselves.
 */

export const LEAF_TARGET_PREFIX = 'leaf:';

/** Slug accepted for a parameterized target, e.g. the provider in a card id. */
const PARAM_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/**
 * Words that mark a control as committing something. Checked against the
 * resolved test id, so a target cannot slip past by being added carelessly.
 */
export const DESTRUCTIVE_PATTERNS = [
  'submit',
  'confirm',
  'delete',
  'remove',
  'disconnect',
  'revoke',
  'pay',
  'purchase',
  'cancel',
  'destroy',
  'reset',
  'sign-out',
] as const;

export interface LeafTarget {
  /** Stable id named in a script, without the `leaf:` prefix. */
  id: string;
  /** Test id of the control, `{param}` filled from the target when present. */
  testId: string;
  /** Whether the id takes a trailing `:slug`. */
  parameterized?: boolean;
  /** Rail section the control lives in, so a script can be told to go there. */
  section?: string;
  label: string;
  description: string;
}

export const LEAF_TARGETS: readonly LeafTarget[] = [
  {
    id: 'integration',
    testId: 'integration-card-{param}',
    parameterized: true,
    section: 'integrations',
    label: 'an integration card',
    description: "Opens one app's card so the user can see what it does and connect it themselves.",
  },
  {
    id: 'add-integration',
    testId: 'integrations-add-new-trigger',
    section: 'integrations',
    label: 'Add new integration',
    description: 'Opens the list of apps that can be added.',
  },
] as const;

/** Whether a resolved test id names a control that commits something. */
export function isDestructiveTestId(testId: string): boolean {
  const normalized = testId.toLowerCase();
  return DESTRUCTIVE_PATTERNS.some((word) => normalized.includes(word));
}

/**
 * Resolve a `leaf:` target to the test id to click, or null when it names
 * nothing this console offers. Refuses a destructive id even if one were
 * somehow registered, so the allowlist and the rule cannot disagree at runtime.
 */
export function resolveLeafTestId(target: string): string | null {
  if (!target.startsWith(LEAF_TARGET_PREFIX)) return null;
  const [id, param, ...rest] = target.slice(LEAF_TARGET_PREFIX.length).split(':');
  if (rest.length > 0) return null;

  const leaf = LEAF_TARGETS.find((candidate) => candidate.id === id);
  if (!leaf) return null;

  let testId = leaf.testId;
  if (leaf.parameterized) {
    if (!param || !PARAM_PATTERN.test(param)) return null;
    testId = testId.replace('{param}', param);
  } else if (param !== undefined) {
    return null;
  }

  return isDestructiveTestId(testId) ? null : testId;
}

/** The rail section a leaf lives in, so a script can be routed there first. */
export function leafSection(target: string): string | null {
  if (!target.startsWith(LEAF_TARGET_PREFIX)) return null;
  const id = target.slice(LEAF_TARGET_PREFIX.length).split(':')[0];
  return LEAF_TARGETS.find((candidate) => candidate.id === id)?.section ?? null;
}

/** Catalogue lines for the prompt, describing how to name each control. */
export function renderLeafTargets(): string[] {
  return LEAF_TARGETS.map((leaf) => {
    const id = leaf.parameterized
      ? `${LEAF_TARGET_PREFIX}${leaf.id}:<name>`
      : `${LEAF_TARGET_PREFIX}${leaf.id}`;
    return `- \`${id}\` — ${leaf.label}. ${leaf.description}`;
  });
}
