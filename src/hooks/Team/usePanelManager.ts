import * as React from 'react';

export function usePanelManager(initialProfileId: string | null = null, initialChatId: string | null = null) {
    const [chatTargetAssistantId, setChatTargetAssistantId] = React.useState<string | null>(initialChatId);
    const [isChatOpen, setIsChatOpen] = React.useState(!!initialChatId);
    const [profileAssistantId, setProfileAssistantId] = React.useState<string | null>(initialProfileId);
    const [isProfileOpen, setIsProfileOpen] = React.useState(!!initialProfileId);

    const handleChat = React.useCallback((id: string) => {
        setChatTargetAssistantId(id);
        setIsChatOpen(true);
        // If profile is open for a *different* assistant, close it
        if (isProfileOpen && profileAssistantId !== id) {
            setIsProfileOpen(false);
            setProfileAssistantId(null);
        }
    }, [isProfileOpen, profileAssistantId]);

    const handleChatClose = React.useCallback(() => {
        setIsChatOpen(false);
        // setChatTargetAssistantId(null); // Optional: clear target on close
    }, []);

    const handleShowProfile = React.useCallback((id: string) => {
        if (isProfileOpen && profileAssistantId === id) { // Toggle off if same profile
            setIsProfileOpen(false);
            setProfileAssistantId(null);
        } else { // Open new or switch profile
            setProfileAssistantId(id);
            setIsProfileOpen(true);
            // If chat is open for a *different* assistant, close it
            if (isChatOpen && chatTargetAssistantId !== id) {
                setIsChatOpen(false);
                // setChatTargetAssistantId(null); // Optional
            }
        }
    }, [isProfileOpen, profileAssistantId, isChatOpen, chatTargetAssistantId]);

    const handleProfileClose = React.useCallback(() => {
        setIsProfileOpen(false);
        setProfileAssistantId(null);
    }, []);

    return {
        chatTargetAssistantId,
        isChatOpen,
        profileAssistantId,
        isProfileOpen,
        handleChat,
        handleChatClose,
        handleShowProfile,
        handleProfileClose,
    };
}