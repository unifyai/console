import * as React from 'react';
import { toast } from 'sonner';
import { AssistantActions } from '@/types/assistants/assistant';

interface UseAssistantDesktopProps {
    desktopActions: AssistantActions['desktop'];
}

export function useAssistantDesktop({ desktopActions }: UseAssistantDesktopProps) {
    const [isRemoteControlActive, setIsRemoteControlActive] = React.useState(false);
    const [liveviewUrl, setLiveviewUrl] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const startRemoteControl = async (assistantId: string) => {
        setIsLoading(true);
        setError(null);
        const toastId = toast.loading("Starting remote control session...");

        try {
            const result = await desktopActions.getLiveviewUrl(assistantId);
            if (result.liveviewUrl) {
                setLiveviewUrl(result.liveviewUrl);
                setIsRemoteControlActive(true);
                toast.success("Remote control session started.", { id: toastId });
            } else {
                 throw new Error("Could not retrieve session URL.");
            }
        } catch (e: any) {
            setError(e.message);
            toast.error(e.message, { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    const stopRemoteControl = () => {
        setIsRemoteControlActive(false);
        setLiveviewUrl(null);
        setError(null);
    };
    
    const toggleRemoteControl = (assistantId: string) => {
        if (isRemoteControlActive) {
            stopRemoteControl();
        } else {
            startRemoteControl(assistantId);
        }
    };

    return {
        isRemoteControlActive,
        liveviewUrl,
        isLoading,
        error,
        toggleRemoteControl,
        stopRemoteControl,
    };
}
