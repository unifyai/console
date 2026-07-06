export const PLATFORM_HOME_NAVIGATION_EVENT = 'console:platform-home-navigate';

/** Returns the user to the platform home: Chat with the workspace Coordinator and Assistant info open. */
export function requestPlatformHomeNavigation(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PLATFORM_HOME_NAVIGATION_EVENT));
}
