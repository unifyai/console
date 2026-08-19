export const ASSISTANT_INFO_PANEL_VISIBILITY_EVENT = 'console:assistant-info-panel-visibility';
export const ASSISTANT_INFO_PANEL_TOGGLE_REQUEST_EVENT =
  'console:assistant-info-panel-toggle-request';
export const ASSISTANT_INFO_PANEL_OPEN_REQUEST_EVENT = 'console:assistant-info-panel-open-request';
export const COORDINATOR_ONBOARDING_PANEL_REQUEST_EVENT =
  'console:coordinator-onboarding-panel-request';

export interface AssistantInfoPanelVisibilityDetail {
  assistantId: string;
  isOpen: boolean;
  isCoordinatorOnboarding: boolean;
  showOnboardingDot: boolean;
}

export interface AssistantInfoPanelToggleRequestDetail {
  assistantId: string;
}

export interface AssistantInfoPanelOpenRequestDetail {
  assistantId: string;
}

export type CoordinatorOnboardingPanelAction = 'open' | 'close';

export interface CoordinatorOnboardingPanelRequestDetail {
  assistantId: string;
  action: CoordinatorOnboardingPanelAction;
}

let pendingInfoPanelOpenAssistantId: string | null = null;

/** Opens the info panel for the requested assistant, including when it is already selected. */
export function requestAssistantInfoPanelOpen(assistantId: string): void {
  pendingInfoPanelOpenAssistantId = assistantId;
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(ASSISTANT_INFO_PANEL_OPEN_REQUEST_EVENT, {
      detail: { assistantId },
    })
  );
}

export function consumePendingInfoPanelOpen(assistantId: string): boolean {
  if (pendingInfoPanelOpenAssistantId !== assistantId) return false;
  pendingInfoPanelOpenAssistantId = null;
  return true;
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

/** Opens or closes the Coordinator onboarding panel without leaving the current route. */
export function requestCoordinatorOnboardingPanel(
  action: CoordinatorOnboardingPanelAction,
  assistantId: string
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(COORDINATOR_ONBOARDING_PANEL_REQUEST_EVENT, {
      detail: { assistantId, action },
    })
  );
}
