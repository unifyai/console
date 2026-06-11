export const COORDINATOR_DEFAULT_JOB_TITLE = 'Coordinator droid';
export const COORDINATOR_DEFAULT_ABOUT =
  'A coordinator droid that learns your workflows, connects the right tools, and routes recurring work to the right specialist droids.';

export function resolveCoordinatorJobTitle(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return COORDINATOR_DEFAULT_JOB_TITLE;
  }
  return trimmed;
}

export function resolveCoordinatorAbout(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return COORDINATOR_DEFAULT_ABOUT;
  }
  return trimmed;
}
