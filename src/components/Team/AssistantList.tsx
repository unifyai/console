import * as React from 'react';
import { Input } from "@/components/UI/input";
import { ScrollArea } from "@/components/UI/scroll-area";
import { Search } from "lucide-react";
import type { Assistant } from "@/types/team/assistant";
import { AssistantListItem } from "./AssistantListItem";
import { ChatOverlay } from "./ChatOverlay";

interface AssistantListProps {
    assistants: Assistant[];
    selectedAssistantId: string | null;
    onSelectAssistant: (id: string) => void;
    onChat: (id: string) => void;
    isChatOpen: boolean;
    chatAssistant: Assistant | null;
    onChatClose: () => void;
}

export function AssistantList({
    assistants,
    selectedAssistantId,
    onSelectAssistant,
    onChat,
    isChatOpen,
    chatAssistant,
    onChatClose
}: AssistantListProps) {
    const [searchTerm, setSearchTerm] = React.useState('');

    const filteredAssistants = React.useMemo(() => {
        if (!searchTerm) return assistants;
        return assistants.filter(a =>
            a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [assistants, searchTerm]);

    return (
        <div className="flex flex-col h-full border-r bg-background">
            <div className="p-3 border-b flex-shrink-0">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search assistants..."
                        className="pl-8 w-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <ScrollArea className="flex-1 p-2" style={{ height: isChatOpen ? 'calc(100% - 45vh - 65px)' : 'calc(100% - 65px)' /* Adjust height based on chat and header */}}>
                 <div className="space-y-1">
                     {filteredAssistants.length > 0 ? (
                         filteredAssistants.map((assistant) => (
                            <AssistantListItem
                                key={assistant.id}
                                assistant={assistant}
                                isSelected={assistant.id === selectedAssistantId}
                                onSelect={onSelectAssistant}
                                onChat={onChat}
                            />
                        ))
                    ) : (
                        <p className="p-4 text-sm text-muted-foreground text-center">No assistants found.</p>
                    )}
                </div>
            </ScrollArea>

            <ChatOverlay
                isOpen={isChatOpen}
                assistant={chatAssistant}
                onClose={onChatClose}
            />
        </div>
    );
}