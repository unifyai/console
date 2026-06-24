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
  'A steady systems-minded unity that turns loose plans into finished work. Loves a tidy checklist, clean handoffs, and closing the small follow-ups before they drift.',
  'A practical operator that finds the next useful step quickly, keeps threads moving, and has a soft spot for suspiciously well-labeled notes.',
  'Built for momentum: collects scattered context, turns it into a plan, and keeps nudging until the thing is done.',
  'A calm workflow unity that makes messy work feel simple. Good at chasing details, closing loops, and remembering the tiny thing everyone else forgot after lunch.',
  'Part researcher, part operator, part mission control. This unity likes crisp priorities, fast summaries, and quietly making progress while everyone else is still naming the project.',
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
