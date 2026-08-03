'use client';

import * as React from 'react';
import type { AssistantList } from '@/components/Pages/Assistants/List/AssistantList';
import type { Assistant } from '@/types/assistants/assistant';
import type { ActiveEntityFace } from '@/components/Layout/Shell/AssistantSwitcher';
import { useAssistantSwitcherBridgePublisher } from '@/components/Layout/Shell/AssistantSwitcherBridgeContext';

export function AssistantSwitcherBridgeSync({
  activeUnity,
  activeEntityFace = null,
  listProps,
  nestedOverlayOpen = false,
  activeCallAssistantId = null,
}: {
  activeUnity: Assistant | null;
  activeEntityFace?: ActiveEntityFace | null;
  listProps: React.ComponentProps<typeof AssistantList>;
  nestedOverlayOpen?: boolean;
  activeCallAssistantId?: string | null;
}) {
  const setBridge = useAssistantSwitcherBridgePublisher();

  React.useEffect(() => {
    setBridge({
      activeUnity,
      activeEntityFace,
      listProps,
      nestedOverlayOpen,
      activeCallAssistantId,
    });
    return () => setBridge(null);
  }, [
    activeUnity,
    activeEntityFace,
    listProps,
    nestedOverlayOpen,
    activeCallAssistantId,
    setBridge,
  ]);

  return null;
}
