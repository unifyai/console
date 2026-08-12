/**
 * Controls the assistant may click, and the line it may not cross.
 *
 * Navigation targets are safe by construction: they call the shell router, and
 * an unknown id does nothing. Clicking is different — a click commits, and the
 * assistant reads email, so a prompt-injected instruction reaching a Disconnect
 * button is the failure that actually costs something.
 *
 * The rule this file applies, control by control, is **open but do not commit**.
 * Opening a record, expanding a row, switching a tab, changing a filter, asking
 * for a refresh: all reversible, all things the user could undo by looking away.
 * Sending, saving, deleting, disconnecting, paying, provisioning, answering a
 * call, or touching security settings: not offered at all, at any depth.
 *
 * Two layers enforce that, because one is not enough at this size:
 *
 *   1. A control must match an entry below. Default is refusal.
 *   2. It must then survive DESTRUCTIVE_PATTERNS, which always wins — so a
 *      control added later inside an allowed family cannot inherit permission
 *      just by living there.
 *
 * `agentPress.node.test.tsx` materializes the whole allowed set against the live
 * source tree and fails the build if anything destructive is reachable, so this
 * cannot rot quietly as the frontend grows.
 */

export const LEAF_TARGET_PREFIX = 'leaf:';

/** Slug accepted for a parameterized target, e.g. the provider in a card id. */
const PARAM_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/**
 * Words marking a control as committing something. Checked against the resolved
 * test id and always decisive, so no entry below can grant permission to one.
 *
 * Deliberately broad. A false refusal costs a click the user makes themselves;
 * a false allowance costs whatever the button did.
 */
export const DESTRUCTIVE_PATTERNS = [
  // Mutating a record. Phrased as verbs rather than topics: "card" would catch
  // an integration card as readily as a payment card, and refusing to open
  // things is not the goal.
  'submit',
  'confirm',
  'save',
  'delete',
  'destroy',
  'rename',
  'update',
  'remove',
  'edit-',
  '-edit',
  'create-',
  'import',
  'upload',
  'new-table',
  'new-column',
  'add-row',
  'add-column',
  'add-new-table',
  // Connections and credentials
  'disconnect',
  'revoke',
  'reconnect',
  'secrets-',
  'password',
  'api-key',
  'oauth',
  'policy',
  'tool-scope',
  'mfa',
  '2fa',
  'totp',
  'recovery-code',
  'codes-btn',
  'set-default',
  // Money
  'topup',
  'subscribe',
  'subscription',
  'switch-plan',
  'invoice',
  'add-card',
  'remove-card',
  'payment',
  'billing-interval',
  'upgrade-plan',
  'tier-option',
  // Communication — anything that reaches another person
  'send',
  'reply',
  'reaction',
  'invite',
  'attach',
  'approve',
  'reject',
  'answer',
  'decline',
  'voice-record',
  'contact-message',
  // Calls and sessions the user owns
  'call-end',
  'org-call',
  'incoming-',
  'leave',
  'hang-up',
  'action-stop',
  // Identity, security, lifecycle
  'sign-out',
  'signout',
  'logout',
  'login',
  'register',
  'impersonate',
  'view-as',
  'reset',
  'cancel',
  'enable-',
  'disable-',
  'hire',
  'onboard-',
  'coordinator-onboarding',
  'skip',
  'unskip',
  'pause',
  'flip',
  'dev-',
  'workspace-personal',
  'workspace-organization',
  'sharing',
  // Anything leaving the browser
  'download',
  'copy',
  'export',
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

/**
 * Every control offered, grouped by what it does. Each is here because opening
 * it shows the user something; none of them finishes anything.
 */
export const LEAF_TARGETS: readonly LeafTarget[] = [
  // ── Integrations ────────────────────────────────────────────────────────
  {
    id: 'integration',
    testId: 'integration-card-{param}',
    parameterized: true,
    section: 'integrations',
    label: 'an integration card',
    description: "Opens one app's card so the user can see what it does.",
  },
  {
    id: 'integration-details',
    testId: 'integration-card-details-{param}',
    parameterized: true,
    section: 'integrations',
    label: "an integration's details",
    description: 'Expands what an app can access, before anyone authorizes it.',
  },
  {
    id: 'integration-gallery',
    testId: 'integrations-add-new-trigger',
    section: 'integrations',
    label: 'the app gallery',
    description: 'Opens the list of apps that can be connected.',
  },

  // ── Records: open one to read it ────────────────────────────────────────
  {
    id: 'contact',
    testId: 'contact-card-{param}',
    parameterized: true,
    section: 'contacts',
    label: 'a contact',
    description: 'Opens one contact so its details can be read.',
  },
  {
    id: 'transcript',
    testId: 'transcripts-thread-{param}',
    parameterized: true,
    section: 'transcripts',
    label: 'a conversation thread',
    description: 'Opens one logged conversation.',
  },
  {
    id: 'knowledge',
    testId: 'knowledge-item-{param}',
    parameterized: true,
    section: 'knowledge',
    label: 'a stored fact',
    description: 'Opens one claim to read it and where it came from.',
  },
  {
    id: 'function',
    testId: 'function-card-{param}',
    parameterized: true,
    section: 'functions',
    label: 'a function',
    description: 'Opens one skill to read its signature and source.',
  },
  {
    id: 'document',
    testId: 'doc-item-{param}',
    parameterized: true,
    label: 'a document',
    description: 'Opens one document from the library.',
  },
  {
    id: 'task',
    testId: 'task-card-head',
    section: 'tasks',
    label: 'a task card',
    description: 'Expands a workflow to show its definition and run history.',
  },
  {
    id: 'task-run',
    testId: 'task-run-row',
    section: 'tasks',
    label: 'a task run',
    description: 'Expands one past run of a workflow.',
  },

  // ── Panels and pickers: reveal, commit nothing ──────────────────────────
  {
    id: 'teammate-info',
    testId: 'assistant-info-button',
    label: 'the teammate info panel',
    description: "Opens the side panel with the teammate's setup and details.",
  },
  {
    id: 'teammate-info-tab',
    testId: 'assistant-info-tab-{param}',
    parameterized: true,
    label: 'a tab of the teammate info panel',
    description: 'Switches that panel between its onboarding and profile views.',
  },
  {
    id: 'project-picker',
    testId: 'project-picker-trigger',
    label: 'the project picker',
    description: 'Opens the list of projects.',
  },
  {
    id: 'chat-search',
    testId: 'chat-search-trigger',
    section: 'chat',
    label: 'chat search',
    description: 'Opens search across the conversation.',
  },
  {
    id: 'brain-scope',
    testId: 'brain-scope-dropdown',
    label: 'the memory scope picker',
    description: 'Opens the chooser for whose memory is shown.',
  },

  // ── View state: reversible by looking away ──────────────────────────────
  {
    id: 'expand-actions',
    testId: 'live-actions-expand-collapse',
    section: 'actions',
    label: 'expand or collapse the action tree',
    description: 'Shows or hides the steps inside a request.',
  },
  {
    id: 'actions-window',
    testId: 'live-actions-time-window',
    section: 'actions',
    label: 'the action time window',
    description: 'Scopes history to a period.',
  },
  {
    id: 'data-folder',
    testId: 'data-folder-toggle',
    section: 'data',
    label: 'a data folder',
    description: 'Opens or folds a folder in the table tree.',
  },
  {
    id: 'jump-to-latest',
    testId: 'jump-to-present-button',
    label: 'jump to the newest entries',
    description: 'Scrolls a live view back to the present.',
  },
  {
    id: 'scroll-to-newest',
    testId: 'chat-scroll-to-bottom',
    section: 'chat',
    label: 'the newest message',
    description: 'Scrolls the conversation to the bottom.',
  },

  // ── Sorting and filtering: changes the view, not the data ───────────────
  {
    id: 'sort-ascending',
    testId: 'log-grid-sort-asc-{param}',
    parameterized: true,
    label: 'sort a column ascending',
    description: 'Reorders rows by one column.',
  },
  {
    id: 'sort-descending',
    testId: 'log-grid-sort-desc-{param}',
    parameterized: true,
    label: 'sort a column descending',
    description: 'Reorders rows by one column.',
  },
  {
    id: 'group-rows',
    testId: 'log-grid-group-by-{param}',
    parameterized: true,
    label: 'group rows by a column',
    description: 'Groups the table by one column.',
  },
  {
    id: 'expand-group',
    testId: 'log-grid-group-expand-{param}',
    parameterized: true,
    label: 'a row group',
    description: 'Opens a collapsed group of rows.',
  },
  {
    id: 'filter-tasks',
    testId: 'tasks-tags-dropdown',
    section: 'tasks',
    label: 'the task tag filter',
    description: 'Opens the tag filter for workflows.',
  },
  {
    id: 'filter-teammates',
    testId: 'assistant-list-filter-{param}',
    parameterized: true,
    label: 'the teammate list filter',
    description: 'Narrows the teammate list to people or AI teammates.',
  },

  // ── Closing things ──────────────────────────────────────────────────────
  {
    id: 'close-panel',
    testId: 'assistant-info-close',
    label: 'close the info panel',
    description: 'Closes the teammate side panel.',
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
