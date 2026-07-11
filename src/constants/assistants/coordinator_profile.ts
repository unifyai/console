export const COORDINATOR_DEFAULT_JOB_TITLE = 'Your digital twin';
export const COORDINATOR_DEFAULT_ABOUT = '';

/** Prior default / provisioned job titles that should resolve to the current default. */
const LEGACY_COORDINATOR_JOB_TITLES = new Set([
  'Coordinator',
  'Coordinator droid',
  'Personal helper',
  'Marty',
  'Unity',
]);

export function resolveCoordinatorJobTitle(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed || LEGACY_COORDINATOR_JOB_TITLES.has(trimmed)) {
    return COORDINATOR_DEFAULT_JOB_TITLE;
  }
  return trimmed;
}

export function resolveCoordinatorAbout(value: string | null | undefined): string {
  return value?.trim() ?? '';
}
