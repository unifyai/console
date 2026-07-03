const COORDINATOR_ONBOARDING_FOLD_STATE_KEY = 'console:assistants:coordinator-onboarding-fold';

export interface CoordinatorOnboardingFoldState {
  sectionIds: readonly string[];
  subgroupIds: readonly string[];
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

export function readCoordinatorOnboardingFoldState(): CoordinatorOnboardingFoldState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(COORDINATOR_ONBOARDING_FOLD_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const sectionIds = parseStringArray((parsed as { sectionIds?: unknown }).sectionIds);
    const subgroupIds = parseStringArray((parsed as { subgroupIds?: unknown }).subgroupIds);
    if (sectionIds.length === 0 && subgroupIds.length === 0) return null;
    return { sectionIds, subgroupIds };
  } catch {
    return null;
  }
}

export function writeCoordinatorOnboardingFoldState(state: CoordinatorOnboardingFoldState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      COORDINATOR_ONBOARDING_FOLD_STATE_KEY,
      JSON.stringify({
        sectionIds: [...state.sectionIds],
        subgroupIds: [...state.subgroupIds],
      })
    );
  } catch {
    /* best-effort persistence */
  }
}
