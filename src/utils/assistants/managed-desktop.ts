import type { Assistant, DesktopMode, HireOperatingSystem } from '@/types/assistants/assistant';
import type { ResponseProps } from '@/types/common';

type ManagedDesktopActions = {
  enable: (
    assistantId: string | number,
    desktopMode: DesktopMode
  ) => Promise<ResponseProps & { assistant?: Assistant }>;
  disable: (assistantId: string | number) => Promise<ResponseProps & { assistant?: Assistant }>;
};

/** Effective managed Computer OS for edit-form comparison (null = none). */
export function resolveManagedDesktopMode(
  assistant: Pick<Assistant, 'desktopMode' | 'managedDesktopStatus'>
): DesktopMode | null {
  const status = assistant.managedDesktopStatus;
  const entitled = status === 'active' || status === 'grace_period';
  if (!entitled) return null;
  if (assistant.desktopMode === 'ubuntu' || assistant.desktopMode === 'windows') {
    return assistant.desktopMode;
  }
  return null;
}

export function hireOsToDesktopMode(os: HireOperatingSystem): DesktopMode | null {
  return os === 'none' ? null : os;
}

/**
 * Apply Computer mode changes via managed-desktop enable/disable APIs
 * (billing-aware). OS switches disable then enable.
 */
export async function syncManagedDesktopMode(
  assistantId: string | number,
  currentMode: DesktopMode | null,
  desiredOs: HireOperatingSystem,
  actions: ManagedDesktopActions
): Promise<boolean> {
  const desiredMode = hireOsToDesktopMode(desiredOs);
  if (desiredMode === currentMode) {
    return false;
  }

  if (currentMode && desiredMode && currentMode !== desiredMode) {
    const disableResult = await actions.disable(assistantId);
    if (disableResult.detail) {
      console.error('[syncManagedDesktopMode] disable failed:', disableResult.detail);
      throw new Error('Could not update Computer settings. Please try again.');
    }
    const enableResult = await actions.enable(assistantId, desiredMode);
    if (enableResult.detail) {
      console.error('[syncManagedDesktopMode] enable after switch failed:', enableResult.detail);
      throw new Error('Could not update Computer settings. Please try again.');
    }
    return true;
  }

  if (currentMode && !desiredMode) {
    const disableResult = await actions.disable(assistantId);
    if (disableResult.detail) {
      console.error('[syncManagedDesktopMode] disable failed:', disableResult.detail);
      throw new Error('Could not update Computer settings. Please try again.');
    }
    return true;
  }

  if (!currentMode && desiredMode) {
    const enableResult = await actions.enable(assistantId, desiredMode);
    if (enableResult.detail) {
      console.error('[syncManagedDesktopMode] enable failed:', enableResult.detail);
      throw new Error('Could not update Computer settings. Please try again.');
    }
    return true;
  }

  return false;
}
