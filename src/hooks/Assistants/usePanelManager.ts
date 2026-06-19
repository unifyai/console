import * as React from 'react';

export function usePanelManager(initialProfileId: string | null = null) {
  // Selection state is authoritative locally. The `?profile=` URL param is a
  // write-only mirror of this state (kept in sync one-way by the caller for
  // deep-link/shareability). It is read here only to seed the initial value.
  //
  // We deliberately do NOT re-apply `initialProfileId` after mount. Doing so
  // creates a feedback loop: a click updates state and fires an async
  // `router.replace`, whose `useSearchParams` update lags and, under rapid
  // input, resolves out of order. Mirroring that laggy value back into state
  // would clobber the user's latest click — making selection feel unreliable
  // (responding and then undoing itself). Cross-route deep links re-mount this
  // hook, so seeding once is sufficient.
  const [profileAssistantId, setProfileAssistantId] = React.useState<string | null>(
    initialProfileId
  );

  const handleShowProfile = React.useCallback((id: string) => {
    setProfileAssistantId(id);
  }, []);

  const handleProfileClose = React.useCallback(() => {
    setProfileAssistantId(null);
  }, []);

  return {
    profileAssistantId,
    handleShowProfile,
    handleProfileClose,
  };
}
