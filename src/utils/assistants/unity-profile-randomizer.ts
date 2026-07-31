export interface RandomUnityProfile {
  firstName: string;
  surname: string;
  jobTitle: string;
  about: string;
}

const firstNames = [
  'Astra',
  'Cato',
  'Kivo',
  'Luma',
  'Mira',
  'Nilo',
  'Orin',
  'Rilo',
  'Sera',
  'Solin',
  'Tavo',
  'Vexa',
  'Zeno',
] as const;

const surnames = [
  'Assembler',
  'Circuit',
  'Dockhand',
  'Gearwright',
  'Gridrunner',
  'Loopsmith',
  'Patchbay',
  'Signal',
  'Switchboard',
  'Wireframe',
] as const;

const roles = [
  'Inbox Pathfinder',
  'Ops Quartermaster',
  'Launch Partner',
  'Workflow Fixer',
  'Research Scout',
  'Calendar Wrangler',
  'Project Runner',
  'Signal Finder',
  'Task Pilot',
  'Execution Specialist',
] as const;

const abouts = [
  'A steady systems-minded teammate that turns loose plans into finished work. Loves a tidy checklist, clean handoffs, and closing the small follow-ups before they drift.',
  'A practical operator that finds the next useful step quickly, keeps threads moving, and has a soft spot for suspiciously well-labeled notes.',
  'Built for momentum: collects scattered context, turns it into a plan, and keeps nudging until the thing is done.',
  'A calm workflow teammate that makes messy work feel simple. Good at chasing details, closing loops, and remembering the tiny thing everyone else forgot after lunch.',
  'Part researcher, part operator, part mission control. This teammate likes crisp priorities, fast summaries, and quietly making progress while everyone else is still naming the project.',
  'Known for getting practical work over the line without drama. Brings a dry sense of humor, a good memory for context, and a habit of turning vague asks into concrete next actions.',
] as const;

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function createRandomUnityProfile(): RandomUnityProfile {
  return {
    firstName: pick(firstNames),
    surname: pick(surnames),
    jobTitle: pick(roles),
    about: pick(abouts),
  };
}

/**
 * Roll a profile whose name is still available in the workspace.
 *
 * Prefers a combination whose display name AND first name are both unused
 * (first-name distinctness keeps Slack routing tokens and spoken references
 * unambiguous), falls back to display-name-unique, then to a raw roll. The
 * server enforces uniqueness regardless; this only steers the suggestion.
 * Both inputs are lowercased names.
 */
export function createAvailableUnityProfile(
  takenDisplayNames: readonly string[],
  takenFirstNames: readonly string[]
): RandomUnityProfile {
  const displayTaken = new Set(takenDisplayNames);
  const firstTaken = new Set(takenFirstNames);
  let fallback: RandomUnityProfile | null = null;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const profile = createRandomUnityProfile();
    const display = `${profile.firstName} ${profile.surname}`.toLowerCase();
    if (displayTaken.has(display)) continue;
    if (!firstTaken.has(profile.firstName.toLowerCase())) return profile;
    fallback = fallback ?? profile;
  }
  return fallback ?? createRandomUnityProfile();
}
