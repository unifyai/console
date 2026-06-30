import { NuqsAdapter } from 'nuqs/adapters/next/app';
import React from 'react';
import TopNav from '@/components/Layout/TopBar/TopNav';
import ImpersonationBanner from '@/components/Layout/TopBar/ImpersonationBanner';
import Providers from '@/components/Pages/Providers/Base';
import { Suspense } from 'react';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import ThemeLoader from '@/components/Layout/ThemeLoader';
import LoadingScreen from '@/components/Layout/LoadingScreen';
import MfaEnforcementGate from '@/components/Common/Auth/MfaEnforcementGate';
import { TimezoneSync } from '@/components/Layout/TimezoneSync';
import { NetworkStatusToast } from '@/components/Layout/NetworkStatusToast';
import { SelfHostRuntimeBootstrap } from '@/components/SelfHost/SelfHostRuntimeBootstrap';
import { Toaster } from '@/components/UI/Chat/sonner';
import { Loader2 } from 'lucide-react';
import {
  CallProvider,
  type CallProviderActions,
} from '@/components/Pages/Assistants/Communication/CallProvider';
import { getCurrentUser } from '@/lib/user/user';
import { updateAssistant } from '@/lib/assistants/assistant';
import {
  getTranscripts,
  messageAssistant,
  getContactIdByEmail,
  getAssistantOwnerById,
  uploadAttachment,
} from '@/lib/assistants/chat';
import {
  getCallConnectionDetails,
  dispatchAssistantToCall,
  deleteCallRoom,
} from '@/lib/assistants/call';
import {
  getLiveviewUrl,
  buildLiveviewUrl,
  checkLiveviewHealth,
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
      getAssistantOwnerById,
      uploadAttachment,
    },
    call: {
      getConnectionDetails: getCallConnectionDetails,
      dispatchToCall: dispatchAssistantToCall,
      deleteRoom: deleteCallRoom,
    },
    desktop: {
      getLiveviewUrl,
      buildLiveviewUrl,
      checkLiveviewHealth,
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
  const callUserMeta = { email: user?.email ?? null, image: user?.image ?? null };

  return (
    <div className="h-screen w-full overflow-hidden">
      <Providers>
        <ThemeLoader>
          {/* Static skeleton bar to avoid brief blank before navbar hydration */}
          <div
            className="fixed left-0 right-0 top-0 z-40 h-10 border-b border-border bg-card"
            aria-hidden="true"
          />
          <Suspense
            fallback={
              <div className="fixed left-0 right-0 top-0 z-50 flex h-10 items-center border-b border-border bg-card px-3.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-caption ml-2 text-muted-foreground">Loading…</span>
              </div>
            }
          >
            <TopNav />
          </Suspense>
          <CallProvider callActions={callActions} userMeta={callUserMeta}>
            <Suspense fallback={<LoadingScreen />}>
              <main className="brand-page-stencil-bg relative top-10 h-[calc(100vh-2.5rem)] overflow-hidden bg-background">
                <MfaEnforcementGate>
                  <NuqsAdapter>{children}</NuqsAdapter>
                </MfaEnforcementGate>
              </main>
            </Suspense>
          </CallProvider>
          <Toaster richColors position="bottom-right" closeButton />
          <ImpersonationBanner />
          <SelfHostRuntimeBootstrap />
          <TimezoneSync />
          <NetworkStatusToast />
        </ThemeLoader>
      </Providers>
    </div>
  );
}
