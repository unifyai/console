import * as React from 'react';
import { Input } from "@/components/UI/input";
import { ScrollArea } from "@/components/UI/scroll-area";
import { Search, WifiOff } from "lucide-react";
import type { Assistant } from "@/types/assistants/assistant";
import { AssistantListItem } from "./AssistantListItem";
import { ChatOverlay } from "./ChatOverlay";
import { AssistantListItemSkeleton } from './AssistantListItemSkeleton';

interface AssistantListProps {
    assistants: Assistant[];
    isLoading: boolean;
    error: string | null;
    profileAssistantId: string | null;
    chatTargetAssistantId: string | null;
    onShowProfile: (id: string) => void;
    onChat: (id: string) => void;
    isChatOpen: boolean;
    chatAssistant: Assistant | null;
    onChatClose: () => void;
}

export function AssistantList({
    assistants,
    isLoading,
    error,
    profileAssistantId,
    chatTargetAssistantId,
    onShowProfile,
    onChat,
    isChatOpen,
    chatAssistant,
    onChatClose
}: AssistantListProps) {

    const [searchTerm, setSearchTerm] = React.useState('');

    const filteredAssistants = React.useMemo(() => {
         if (!searchTerm) return assistants;
        // Simple case-insensitive search on name and email
        const lowerSearchTerm = searchTerm.toLowerCase();
        return assistants.filter(a =>
            (a.first_name && a.surname && `${a.first_name} ${a.surname}`.toLowerCase().includes(lowerSearchTerm)) ||
            (a.email && a.email.toLowerCase().includes(lowerSearchTerm))
        );
    }, [assistants, searchTerm]);

    // Calculate height for scroll area based ONLY on chat overlay state
    // 65px is approx height of header search bar area
    const scrollAreaHeight = isChatOpen ? 'calc(100% - 45vh - 65px)' : 'calc(100% - 65px)';

    return (
        // Parent div in Main.tsx handles relative positioning
        <div className="flex flex-col h-full bg-background">
           
            {/* Header Search Bar */}
            <div className="p-3 border-b flex-shrink-0">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search assistants..."
                        className="pl-8 w-full h-8" // Reduced height
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={isLoading || !!error} // Disable search if loading or major error occurred
                    />
                </div>
            </div>

            {/* Content Area: Loading Skeletons, Error, or List */}
            <ScrollArea className="flex-1 p-2" style={{ height: scrollAreaHeight }}>
                <div className="space-y-1">
                    {isLoading ? (
                        // Loading State: Show Skeletons
                        <>
                            {[...Array(10)].map((_, i) => ( 
                                <AssistantListItemSkeleton key={`asst-skeleton-${i}`} />
                            ))}
                        </>
                    ) : error ? (
                        // Error State
                         <div className="flex flex-col items-center justify-center pt-10 text-center">
                             <WifiOff className="h-6 w-6 text-destructive mb-2" />
                            <p className="text-sm font-medium text-destructive">Failed to load assistants</p>
                            <p className="text-xs text-muted-foreground px-4">{error}</p>
                        </div>
                    ) : filteredAssistants.length > 0 ? (
                        // Success State: Render List
                        filteredAssistants.map((assistant) => (
                            <AssistantListItem
                                key={assistant.agent_id}
                                assistant={assistant}
                                isSelected={profileAssistantId === assistant.agent_id}
                                onShowProfile={onShowProfile}
                                onChat={onChat}
                            />
                        ))
                    ) : searchTerm ? (
                        // Empty State (due to filtering)
                         <p className="p-4 text-sm text-muted-foreground text-center">No assistants match filters.</p>
                    ) : (
                        // Empty State (no assistants returned from API)
                         <p className="p-4 text-sm text-muted-foreground text-center">No assistants found.</p>
                    )}
                </div>
            </ScrollArea>

            {/* Chat Overlay*/}
            <ChatOverlay
                // Ensure chat only renders when explicitly opened for a valid assistant
                isOpen={isChatOpen && !!chatAssistant && chatAssistant.agent_id === chatTargetAssistantId}
                assistant={chatAssistant}
                onClose={onChatClose}
            />
        </div>
    );
}