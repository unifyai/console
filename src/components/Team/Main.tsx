'use client';

import * as React from 'react';
import { AssistantList } from "@/components/Team/AssistantList";
import { TaskList } from "@/components/Team/TaskList";
import { Separator } from "@/components/UI/separator";
import { cn } from '@/lib/utils';
import { Assistant } from "@/types/team/assistant";
import { Task, TaskStatus } from '@/types/team/task';
import { faker } from '@faker-js/faker';

/* Placeholder data */
const TASK_STATUSES: TaskStatus[] = ["Queued", "Recurring", "In Progress", "Completed"];
export function createRandomTask(): Task {
  return {
    id: faker.string.uuid(),
    title: faker.lorem.words({ min: 2, max: 5 }),
    description: faker.lorem.paragraphs(2),
    status: faker.helpers.arrayElement(TASK_STATUSES),
    createdAt: faker.date.recent({ days: 30 }),
  };
}
export function createRandomAssistant(taskCount: number = 10): Assistant {
  const tasks = faker.helpers.multiple(createRandomTask, {
    count: taskCount,
  });
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    phone: faker.phone.number(),
    avatarUrl: faker.image.avatarGitHub(),
    tasks: tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  };
}
export function generateAssistants(count: number = 8): Assistant[] {
  return faker.helpers.multiple(createRandomAssistant as any, {
    count,
  });
}
/* End of placholder data */

export default function Main() {
    const [assistants, setAssistants] = React.useState<Assistant[]>([]);
    const [selectedAssistantId, setSelectedAssistantId] = React.useState<string | null>(null);
    const [chatTargetAssistantId, setChatTargetAssistantId] = React.useState<string | null>(null);
    const [isChatOpen, setIsChatOpen] = React.useState(false);

    // Generate fake data on mount
    React.useEffect(() => {
        setAssistants(generateAssistants(15));
    }, []);

    // Derived state: get the currently selected assistant object
    const selectedAssistant = React.useMemo(() => {
        return assistants.find(a => a.id === selectedAssistantId) || null;
    }, [assistants, selectedAssistantId]);

    // Derived state: get the assistant for the chat window
    const chatAssistant = React.useMemo(() => {
        return assistants.find(a => a.id === chatTargetAssistantId) || null;
    }, [assistants, chatTargetAssistantId]);

    // Handler for selecting an assistant in the list
    const handleSelectAssistant = (id: string) => {
        // If clicking the already selected assistant, de-select it
        if (selectedAssistantId === id) {
            setSelectedAssistantId(null);
        } else {
            setSelectedAssistantId(id);
            // Close chat if switching assistants while chat is open for the previous one
            if (isChatOpen && chatTargetAssistantId !== id) {
                setIsChatOpen(false);
            }
        }
    };

    // Handler for initiating chat
    const handleChat = (id: string) => {
        setChatTargetAssistantId(id);
        setIsChatOpen(true);
        if (selectedAssistantId !== id) {
            setSelectedAssistantId(id);
        }
    };

    // Handler for closing chat
    const handleChatClose = () => {
        setIsChatOpen(false);
    };

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Assistant List Panel - Width changes conditionally */}
            <div
                className={cn(
                    "h-full transition-all duration-300 ease-in-out relative overflow-hidden",
                    selectedAssistantId
                        ? "w-[350px] md:w-[400px] lg:w-1/3 flex-shrink-0"
                        : "w-full"
                )}
            >
                <AssistantList
                    assistants={assistants}
                    selectedAssistantId={selectedAssistantId}
                    onSelectAssistant={handleSelectAssistant}
                    onChat={handleChat}
                    isChatOpen={isChatOpen && chatTargetAssistantId === selectedAssistantId}
                    chatAssistant={chatAssistant}
                    onChatClose={handleChatClose}
                />
            </div>

            {/* Separator - Only show when Task List is visible */}
            {selectedAssistantId && <Separator orientation="vertical" className="h-full" />}

            {/* Task List Panel - Renders conditionally and takes remaining space */}
            {selectedAssistantId && selectedAssistant && (
                <div className="flex-1 h-full border-l min-w-0">
                    <TaskList assistant={selectedAssistant} />
                </div>
            )}

        </div>
    );
}