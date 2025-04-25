import * as React from 'react';
import { Input } from "@/components/UI/input";
import { ScrollArea } from "@/components/UI/scroll-area";
import { Search } from "lucide-react";
import type { Assistant } from "@/types/assistants/assistant";
import { AssistantListItem } from "./AssistantListItem";
import { ChatOverlay } from "./ChatOverlay";

interface AssistantListProps {
    assistants: Assistant[];
    profileAssistantId: string | null; // ID of assistant whose profile is open (for highlighting)
    chatTargetAssistantId: string | null; // ID of assistant being chatted with
    onShowProfile: (id: string) => void; // Function to open profile panel
    onChat: (id: string) => void;
    isChatOpen: boolean;
    chatAssistant: Assistant | null;
    onChatClose: () => void;
}

export function AssistantList({
    assistants,
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
        // ... search filter logic ...
         if (!searchTerm) return assistants;
         // Search by first name, last name, or email
        return assistants.filter(a =>
            `${a.firstName} ${a.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [assistants, searchTerm]);

    // Calculate height for scroll area based ONLY on chat overlay, profile panel is separate
    const scrollAreaHeight = isChatOpen ? 'calc(100% - 45vh - 65px)' : 'calc(100% - 65px)';

    return (
        // Parent div in Main.tsx is already relative
        <div className="flex flex-col h-full bg-background">
            <div className="p-3 border-b flex-shrink-0">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search assistants..."
                        className="pl-8 w-full h-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <ScrollArea className="flex-1 p-2" style={{ height: scrollAreaHeight }}>
                <div className="space-y-1">
                    {filteredAssistants.length > 0 ? (
                        filteredAssistants.map((assistant) => (
                            <AssistantListItem
                                key={assistant.id}
                                assistant={assistant}
                                // Highlight if profile is open for this assistant
                                isSelected={profileAssistantId === assistant.id}
                                onShowProfile={onShowProfile} // Pass handler down
                                onChat={onChat}
                            />
                        ))
                    ) : (
                        <p className="p-4 text-sm text-muted-foreground text-center">No assistants found.</p>
                    )}
                </div>
            </ScrollArea>

            <ChatOverlay
                // Only show chat if the target matches the assistant data passed
                isOpen={isChatOpen && !!chatAssistant && chatAssistant.id === chatTargetAssistantId}
                assistant={chatAssistant}
                onClose={onChatClose}
            />
        </div>
    );
}