export const COORDINATOR_DEFAULT_JOB_TITLE = 'Personal helper';
export const COORDINATOR_DEFAULT_ABOUT =
  'A proactive and collaborative team member focused on achieving shared objectives. I bring energy and a practical approach to problem-solving. Eager to apply my skills in a dynamic environment where I can continue to grow.';

const LEGACY_COORDINATOR_JOB_TITLES = new Set(['Marty', 'Unity']);
const LEGACY_COORDINATOR_ABOUT = 'Coordinates setup and shared assistant memory.';

export function resolveCoordinatorJobTitle(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed || LEGACY_COORDINATOR_JOB_TITLES.has(trimmed)) {
    return COORDINATOR_DEFAULT_JOB_TITLE;
  }
  return trimmed;
}

export function resolveCoordinatorAbout(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === LEGACY_COORDINATOR_ABOUT) {
    return COORDINATOR_DEFAULT_ABOUT;
  }
  return trimmed;
}
