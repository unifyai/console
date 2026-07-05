'use client';

import * as React from 'react';
import type { AssistantList } from '@/components/Pages/Assistants/List/AssistantList';
import type { Assistant } from '@/types/assistants/assistant';
import { useAssistantSwitcherBridgePublisher } from '@/components/Layout/Shell/AssistantSwitcherBridgeContext';

export function AssistantSwitcherBridgeSync({
  activeUnity,
  listProps,
}: {
  activeUnity: Assistant | null;
  listProps: React.ComponentProps<typeof AssistantList>;
}) {
  const setBridge = useAssistantSwitcherBridgePublisher();

  React.useEffect(() => {
    setBridge({ activeUnity, listProps });
    return () => setBridge(null);
  }, [activeUnity, listProps, setBridge]);

  return null;
}
