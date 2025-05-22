import * as React from 'react';
import { Input } from "@/components/UI/input";
import { ScrollArea } from "@/components/UI/scroll-area";
import { Search, WifiOff, UserPlus } from "lucide-react";
import type { Assistant } from "@/types/team/assistant";
import { AssistantListItem } from "./AssistantListItem";
import { AssistantListItemSkeleton } from './AssistantListItemSkeleton';
import { Button } from '@/components/UI/button';

interface AssistantListProps {
    assistants: Assistant[];
    isLoading: boolean;
    error: string | null;
    profileAssistantId: string | null;
    onShowProfile: (id: string) => void;
    onOpenHireDialog: () => void;
}

export function AssistantList({
    assistants,
    isLoading,
    error,
    profileAssistantId,
    onShowProfile,
    onOpenHireDialog
}: AssistantListProps) {

    const [searchTerm, setSearchTerm] = React.useState('');

    const filteredAssistants = React.useMemo(() => {
         if (!searchTerm) return assistants;
        const lowerSearchTerm = searchTerm.toLowerCase();
        return assistants.filter(a =>
            (a.first_name && a.surname && `${a.first_name} ${a.surname}`.toLowerCase().includes(lowerSearchTerm)) ||
            (a.email && a.email.toLowerCase().includes(lowerSearchTerm))
        );
    }, [assistants, searchTerm]);

    // Approx height of header search bar area + button
    const headerHeight = 70; // Adjusted approx height
    const scrollAreaHeight = `calc(100% - ${headerHeight}px)`;

    return (
        <div className="flex flex-col h-full bg-background">

            {/* Header: Search Bar + New Assistant Button */}
            <div className="p-3 border-b flex-shrink-0 space-y-2">
                 <div className="flex items-center gap-2">
                    <div className="relative flex-grow">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search assistants..."
                            className="pl-8 w-full h-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            disabled={isLoading || !!error}
                        />
                    </div>
                    <Button
                        variant="outline"
                        size="sm" // Match size with input height
                        className="h-8 items-center" // Explicit height
                        onClick={onOpenHireDialog} // Call handler to open dialog
                        disabled={isLoading} // Disable if still loading assistants
                    >
                        <UserPlus className="h-4 w-4" />
                        New
                    </Button>
                 </div>
            </div>

            {/* Content Area: Loading Skeletons, Error, or List */}
            <ScrollArea className="flex-1 p-2" style={{ height: scrollAreaHeight }}>
                <div className="space-y-1">
                    {isLoading ? (
                        <>
                            {[...Array(10)].map((_, i) => (
                                <AssistantListItemSkeleton key={`asst-skeleton-${i}`} />
                            ))}
                        </>
                    ) : error ? (
                         <div className="flex flex-col items-center justify-center pt-10 text-center">
                             <WifiOff className="h-6 w-6 text-muted-foreground mb-2" />
                             <p className="text-sm text-muted-foreground">Could not load assistants.</p>
                         </div>
                    ) : filteredAssistants.length > 0 ? (
                        filteredAssistants.map((assistant) => (
                            <AssistantListItem
                                key={assistant.agent_id}
                                assistant={assistant}
                                isSelected={profileAssistantId === assistant.agent_id}
                                onShowProfile={onShowProfile}
                            />
                        ))
                    ) : searchTerm ? (
                         <p className="p-4 text-sm text-muted-foreground text-center">No assistants match filters.</p>
                    ) : (
                         <p className="p-4 text-sm text-muted-foreground text-center">No assistants found.</p>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}