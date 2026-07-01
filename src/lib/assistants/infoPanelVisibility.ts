export const ASSISTANT_INFO_PANEL_VISIBILITY_EVENT = 'console:assistant-info-panel-visibility';

export interface AssistantInfoPanelVisibilityDetail {
  assistantId: string;
  isOpen: boolean;
  isCoordinatorOnboarding: boolean;
}

declare global {
  interface Window {
    __consoleAssistantInfoPanelVisibility?: AssistantInfoPanelVisibilityDetail;
  }
}

export function publishAssistantInfoPanelVisibility(
  detail: AssistantInfoPanelVisibilityDetail
): void {
  if (typeof window === 'undefined') return;
  window.__consoleAssistantInfoPanelVisibility = detail;
  window.dispatchEvent(
    new CustomEvent(ASSISTANT_INFO_PANEL_VISIBILITY_EVENT, {
      detail,
    })
  );
}

export function readAssistantInfoPanelVisibility(): AssistantInfoPanelVisibilityDetail | null {
  if (typeof window === 'undefined') return null;
  return window.__consoleAssistantInfoPanelVisibility ?? null;
}
