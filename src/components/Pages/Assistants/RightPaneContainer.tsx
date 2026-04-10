'use client';

import React, { useState, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/UI/tabs';
import { LiveActionsViewer } from './LiveActions';
import { DashboardsPane } from './Dashboards';
import type { AssistantActionActions } from '@/types/assistants/action';
import type { Assistant } from '@/types/assistants/assistant';
import type { DashboardPaneData } from '@/types/assistants/dashboard';

const TAB_TRIGGER_CLASS = [
  'h-full rounded-none border-b-2 border-transparent bg-transparent',
  'px-1 text-xs font-medium text-muted-foreground',
  'shadow-none transition-colors hover:text-foreground',
  'data-[state=active]:border-primary data-[state=active]:bg-transparent',
  'data-[state=active]:text-foreground data-[state=active]:shadow-none',
].join(' ');

interface RightPaneContainerProps {
  assistant: Assistant | null;
  actions: AssistantActionActions | null;
  dashboardActions: {
    getMetadata: (ownerId: string, assistantId: string) => Promise<DashboardPaneData>;
    getTileContent: (
      ownerId: string,
      assistantId: string,
      tileToken: string
    ) => Promise<string | null>;
  } | null;
}

export function RightPaneContainer({
  assistant,
  actions,
  dashboardActions,
}: RightPaneContainerProps) {
  const [hasActiveAction, setHasActiveAction] = useState(false);

  const handleActiveActionChange = useCallback((active: boolean) => {
    setHasActiveAction(active);
  }, []);

  if (!assistant) {
    return (
      <LiveActionsViewer
        assistant={null}
        actions={null}
        className="h-full"
        onHasActiveActionChange={handleActiveActionChange}
      />
    );
  }

  return (
    <Tabs defaultValue="actions" className="flex h-full flex-col">
      <div className="flex shrink-0 items-end justify-center gap-6 border-b border-border px-4 py-2">
        <TabsList className="h-7 gap-6 rounded-none bg-transparent p-0">
          <TabsTrigger
            value="actions"
            className={TAB_TRIGGER_CLASS}
            data-testid="right-pane-tab-actions"
          >
            Actions
          </TabsTrigger>
          <TabsTrigger
            value="dashboards"
            className={TAB_TRIGGER_CLASS}
            data-testid="right-pane-tab-dashboards"
          >
            Dashboards
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent
        value="actions"
        className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
        forceMount
      >
        <LiveActionsViewer
          assistant={assistant}
          actions={actions}
          className="h-full"
          onHasActiveActionChange={handleActiveActionChange}
        />
      </TabsContent>

      <TabsContent
        value="dashboards"
        className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
        forceMount
      >
        {dashboardActions ? (
          <DashboardsPane
            ownerId={assistant.userId}
            assistantId={assistant.agentId}
            getMetadata={dashboardActions.getMetadata}
            getTileContent={dashboardActions.getTileContent}
            shouldPoll={hasActiveAction}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-body-muted">Select an assistant to view dashboards.</p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
