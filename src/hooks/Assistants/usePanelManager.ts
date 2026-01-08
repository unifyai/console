import * as React from 'react';

export function usePanelManager(
  initialProfileId: string | null = null,
  initialChatId: string | null = null
) {
  const [profileAssistantId, setProfileAssistantId] = React.useState<string | null>(
    initialProfileId
  );
  const [isProfileOpen, setIsProfileOpen] = React.useState(!!initialProfileId);

  const handleShowProfile = React.useCallback(
    (id: string) => {
      if (isProfileOpen && profileAssistantId === id) {
        // Toggle off if same profile
        setIsProfileOpen(false);
        setProfileAssistantId(null);
      } else {
        // Open new or switch profile
        setProfileAssistantId(id);
        setIsProfileOpen(true);
      }
    },
    [isProfileOpen, profileAssistantId]
  );

  const handleProfileClose = React.useCallback(() => {
    setIsProfileOpen(false);
    setProfileAssistantId(null);
  }, []);

  return {
    profileAssistantId,
    isProfileOpen,
    handleShowProfile,
    handleProfileClose,
  };
}
