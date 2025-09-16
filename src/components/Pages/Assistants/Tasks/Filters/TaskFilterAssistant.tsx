import * as React from 'react';
import { Users } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/UI/select";
import { Assistant } from '@/types/assistants/assistant';

interface TaskAssistantFilterProps {
    assistants: Assistant[],
    assistantFilter: string; // e.g., 'all', '0', '1'
    setAssistantFilter: (assistantFilter: string) => void;
    disableFilters: boolean;
}


export function TaskAssistantFilter({
    assistants,
    assistantFilter,
    setAssistantFilter,
    disableFilters,
}: TaskAssistantFilterProps) {

    return (
        <Select value={assistantFilter} onValueChange={setAssistantFilter} disabled={disableFilters || assistants.length === 0}>
            <SelectTrigger className="w-[160px] flex-shrink-0 h-8">
                <Users className="h-4 w-4" />
                <SelectValue placeholder="Filter by assistant" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Assistants</SelectItem>
                {assistants.map(assistant => (
                    <SelectItem key={assistant.agent_id} value={assistant.agent_id}>
                        {`${assistant.first_name} ${assistant.surname}`}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}