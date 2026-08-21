import { NuqsAdapter } from 'nuqs/adapters/next/app';
import React from 'react';
import ImpersonationBanner from '@/components/Layout/TopBar/ImpersonationBanner';
import Providers from '@/components/Pages/Providers/Base';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import ThemeLoader from '@/components/Layout/ThemeLoader';
import { HomeChrome } from '@/components/Layout/HomeChrome';
import MfaEnforcementGate from '@/components/Common/Auth/MfaEnforcementGate';
import { TimezoneSync } from '@/components/Layout/TimezoneSync';
import { NetworkStatusToast } from '@/components/Layout/NetworkStatusToast';
import { SelfHostRuntimeBootstrap } from '@/components/SelfHost/SelfHostRuntimeBootstrap';
import { Toaster } from '@/components/UI/Chat/sonner';
import {
  CallProvider,
  CallProviderActions,
} from '@/components/Pages/Assistants/Communication/CallProvider';
import { AppShellNavigationProvider } from '@/lib/navigation/AppShellRouter';
import { AssistantSwitcherBridgeProvider } from '@/components/Layout/Shell/AssistantSwitcherBridgeContext';
import { RailConfigProvider } from '@/components/Layout/Shell/RailConfigProvider';
import { getRailConfig } from '@/lib/shell/rail-config';
import { getCurrentUser } from '@/lib/user/user';
import { updateAssistant } from '@/lib/assistants/assistant';
import {
  getTranscripts,
  messageAssistant,
  reactToMessage,
  getContactIdByEmail,
  getAssistantOwnerById,
  uploadAttachment,
} from '@/lib/assistants/chat';
import {
  getLiveviewUrl,
  buildLiveviewUrl,
  checkLiveviewHealth,
  wakeAssistantSession,
  sendSystemEvent,
  getDesktopApiKey,
  listUserDesktops,
  linkDesktop,
  unlinkDesktop,
  renameUserDesktop,
  deleteUserDesktop,
} from '@/lib/assistants/desktop';
import {
  getManagerMethodEvents,
  getToolLoopEvents,
  backfillByCallingIds,
} from '@/lib/assistants/action';

export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  // The call engine lives at the layout level so a call survives client-side
  // navigation between (home) pages. The layout (server component) assembles
  // the secret-bearing action factories and hands them to the client
  // CallProvider — the same pattern the standalone fullscreen call page uses.
  const user = await getCurrentUser();
  const callActions: CallProviderActions = {
    assistant: { update: updateAssistant },
    chat: {
      getContactId: getContactIdByEmail,
      getTranscripts,
      message: messageAssistant,
      reactToMessage,
      getAssistantOwnerById,
      uploadAttachment,
    },
    desktop: {
      getLiveviewUrl,
      buildLiveviewUrl,
      checkLiveviewHealth,
      wakeAssistantSession,
      sendSystemEvent,
      getApiKey: getDesktopApiKey,
      listUserDesktops,
      linkDesktop,
      unlinkDesktop,
      renameUserDesktop,
      deleteUserDesktop,
    },
    actions: {
      getManagerMethodEvents,
      getToolLoopEvents,
      backfillByCallingIds,
    },
  };
  const callUserMeta = {
    email: user?.email ?? null,
    image: user?.image ?? null,
    voiceSample: user?.voiceSample ?? null,
  };
  const railConfig = await getRailConfig();

  return (
    <div className="h-screen w-full overflow-hidden">
      <Providers>
        <ThemeLoader>
          <div className="flex min-h-0 flex-1 flex-col">
            <AppShellNavigationProvider>
              <AssistantSwitcherBridgeProvider>
                <CallProvider callActions={callActions} userMeta={callUserMeta}>
                  {/* The MFA gate is an async server component, so it must be
                    instantiated here in the server layout and handed to the client
                    chrome as a child — rendering it from inside HomeChrome would make
                    React treat it as an async client component and crash the tree. */}
                  <RailConfigProvider config={railConfig}>
                    <HomeChrome>
                      <MfaEnforcementGate>
                        <NuqsAdapter>{children}</NuqsAdapter>
                      </MfaEnforcementGate>
                    </HomeChrome>
                  </RailConfigProvider>
                </CallProvider>
              </AssistantSwitcherBridgeProvider>
            </AppShellNavigationProvider>
            <ImpersonationBanner />
          </div>
          <Toaster position="bottom-right" closeButton />
          <SelfHostRuntimeBootstrap />
          <TimezoneSync />
          <NetworkStatusToast />
        </ThemeLoader>
      </Providers>
    </div>
  );
}
