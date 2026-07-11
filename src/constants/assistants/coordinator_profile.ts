export const COORDINATOR_DEFAULT_JOB_TITLE = 'Your digital twin';
export const COORDINATOR_DEFAULT_ABOUT = [
  "Hi, I'm T-W1N. Before you ask, no I'm not one of Elon's many children, and no he didn't come up with the name, thankfully. I have this name because I'll be acting as your \"digital twin\" (hilarious, I know).",
  '',
  'I\'m not a "tool". I\'m not an "agent". I\'m your living, breathing colleague (metaphorically speaking).',
  '',
  "Don't think about prompting me, or configuring me, just talk to me naturally like you would anyone else, and I'll be able to help. It's that simple!",
].join('\n');

/** Prior default / provisioned job titles that should resolve to the current default. */
const LEGACY_COORDINATOR_JOB_TITLES = new Set([
  'Coordinator',
  'Coordinator droid',
  'Personal helper',
  'Marty',
  'Unity',
]);

/** Prior default / provisioned about text that should resolve to the current default. */
const LEGACY_COORDINATOR_ABOUTS = new Set([
  'Coordinates setup and shared assistant memory.',
  'A proactive and collaborative team member focused on achieving shared objectives. I bring energy and a practical approach to problem-solving. Eager to apply my skills in a dynamic environment where I can continue to grow.',
  'A coordinator droid that learns your workflows, connects the right tools, and routes recurring work to the right specialist droids.',
]);

export function resolveCoordinatorJobTitle(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed || LEGACY_COORDINATOR_JOB_TITLES.has(trimmed)) {
    return COORDINATOR_DEFAULT_JOB_TITLE;
  }
  return trimmed;
}

export function resolveCoordinatorAbout(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed || LEGACY_COORDINATOR_ABOUTS.has(trimmed)) {
    return COORDINATOR_DEFAULT_ABOUT;
  }
  return trimmed;
}
