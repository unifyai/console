'use client';

import * as React from 'react';
import {
  ASSISTANT_INFO_PANEL_VISIBILITY_EVENT,
  readAssistantInfoPanelVisibility,
  type AssistantInfoPanelVisibilityDetail,
} from '@/lib/assistants/infoPanelVisibility';

/**
 * Which info panel is mounted and whether it is open, for the controls that
 * open it. The panel publishes on an event rather than through context because
 * its openers sit in the top nav and the rail, outside its subtree.
 */
export function useAssistantInfoPanelVisibility(): AssistantInfoPanelVisibilityDetail | null {
  const [visibility, setVisibility] = React.useState<AssistantInfoPanelVisibilityDetail | null>(
    () => readAssistantInfoPanelVisibility()
  );

  React.useEffect(() => {
    const onVisibilityChange = (event: Event) => {
      setVisibility((event as CustomEvent<AssistantInfoPanelVisibilityDetail>).detail ?? null);
    };
    window.addEventListener(ASSISTANT_INFO_PANEL_VISIBILITY_EVENT, onVisibilityChange);
    // A panel that published before this mounted has no event left to send.
    setVisibility(readAssistantInfoPanelVisibility());
    return () => {
      window.removeEventListener(ASSISTANT_INFO_PANEL_VISIBILITY_EVENT, onVisibilityChange);
    };
  }, []);

  return visibility;
}
