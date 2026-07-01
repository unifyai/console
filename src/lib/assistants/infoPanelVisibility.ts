export const ASSISTANT_INFO_PANEL_VISIBILITY_EVENT = 'console:assistant-info-panel-visibility';
export const ASSISTANT_INFO_PANEL_TOGGLE_REQUEST_EVENT =
  'console:assistant-info-panel-toggle-request';

export interface AssistantInfoPanelVisibilityDetail {
  assistantId: string;
  isOpen: boolean;
  isCoordinatorOnboarding: boolean;
}

export interface AssistantInfoPanelToggleRequestDetail {
  assistantId: string;
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

export function requestAssistantInfoPanelToggle(
  detail: AssistantInfoPanelToggleRequestDetail
): boolean {
  if (typeof window === 'undefined') return false;
  const event = new CustomEvent(ASSISTANT_INFO_PANEL_TOGGLE_REQUEST_EVENT, {
    detail,
    cancelable: true,
  });
  return !window.dispatchEvent(event);
}
