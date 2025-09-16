import * as React from 'react';

export function usePanelManager(initialProfileId: string | null = null, initialChatId: string | null = null) {
    const [profileAssistantId, setProfileAssistantId] = React.useState<string | null>(initialProfileId);
    const [isProfileOpen, setIsProfileOpen] = React.useState(!!initialProfileId);

    const [activityLogAssistantId, setActivityLogAssistantId] = React.useState<string | null>(null);
    const [isActivityLogOpen, setIsActivityLogOpen] = React.useState(false);

    const handleShowProfile = React.useCallback((id: string) => {
        if (isProfileOpen && profileAssistantId === id) { // Toggle off if same profile
            setIsProfileOpen(false);
            setProfileAssistantId(null);
        } else { // Open new or switch profile
            setProfileAssistantId(id);
            setIsProfileOpen(true);
            // Ensure other panels are closed if necessary (optional, depends on desired UX)
            setIsActivityLogOpen(false); 
            setActivityLogAssistantId(null);
        }
    }, [isProfileOpen, profileAssistantId]);

    const handleProfileClose = React.useCallback(() => {
        setIsProfileOpen(false);
        setProfileAssistantId(null);
    }, []);

    const handleShowActivityLog = React.useCallback((id: string) => {
        if (isActivityLogOpen && activityLogAssistantId === id) { // Toggle off if same assistant log
            setIsActivityLogOpen(false);
            setActivityLogAssistantId(null);
        } else { // Open new or switch assistant log
            setActivityLogAssistantId(id);
            setIsActivityLogOpen(true);
            // Ensure other panels are closed if necessary
            setIsProfileOpen(false);
            setProfileAssistantId(null);
        }
    }, [isActivityLogOpen, activityLogAssistantId]);

    const handleActivityLogClose = React.useCallback(() => {
        setIsActivityLogOpen(false);
        setActivityLogAssistantId(null);
    }, []);

    return {
        profileAssistantId,
        isProfileOpen,
        handleShowProfile,
        handleProfileClose,

        activityLogAssistantId,
        isActivityLogOpen,
        handleShowActivityLog,
        handleActivityLogClose,
    };
}