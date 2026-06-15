import * as React from 'react';

export function usePanelManager(initialProfileId: string | null = null) {
  const [profileAssistantId, setProfileAssistantId] = React.useState<string | null>(
    initialProfileId
  );

  React.useEffect(() => {
    setProfileAssistantId(initialProfileId);
  }, [initialProfileId]);

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
