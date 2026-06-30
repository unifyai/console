export const COORDINATOR_DEFAULT_JOB_TITLE = '';
export const COORDINATOR_DEFAULT_ABOUT = '';

export function resolveCoordinatorJobTitle(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return COORDINATOR_DEFAULT_JOB_TITLE;
  }
  return trimmed;
}

export function resolveCoordinatorAbout(value: string | null | undefined): string {
  return value?.trim() ?? '';
}
