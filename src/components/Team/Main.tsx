'use client';

import * as React from 'react';
import { AssistantList } from "@/components/Team/AssistantList";
import { TaskList } from "@/components/Team/TaskList";
import { cn } from '@/lib/utils';
import { Assistant } from "@/types/team/assistant";
import { Task, TaskStatus } from '@/types/team/task';
import { faker } from '@faker-js/faker';
import { AssistantProfilePanel } from './AssistantProfilePanel'; // Import Profile Panel
import { AnimatePresence, motion } from 'framer-motion'; // Import motion

/* --- Placeholder Data Generation --- */
const TASK_STATUSES: TaskStatus[] = ["Queued", "Recurring", "In Progress", "Completed", "Review"];

export function createRandomTask(allAssistantIds: string[]): Task {
    const assignedCount = faker.number.int({ min: 0, max: 3 });
    const assignedAssistantIds = assignedCount > 0 ? faker.helpers.arrayElements(allAssistantIds, assignedCount) : [];
    return {
        id: faker.string.uuid(),
        title: faker.lorem.words({ min: 2, max: 5 }),
        description: faker.lorem.paragraphs(2),
        status: faker.helpers.arrayElement(TASK_STATUSES),
        assignedAssistantIds: assignedAssistantIds,
        dueDate: faker.datatype.boolean(0.7) ? faker.date.future({ years: 1 }) : null,
    };
}

export function createRandomAssistant(): Assistant {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    return {
        id: faker.string.uuid(),
        firstName: firstName,
        lastName: lastName,
        email: faker.internet.email({ firstName, lastName }),
        phone: faker.phone.number(),
        avatarUrl: faker.image.avatarGitHub(),
        age: faker.number.int({ min: 22, max: 55 }),
        region: faker.location.countryCode('alpha-2'),
        about: faker.lorem.paragraph(),
        skills: faker.lorem.sentences(faker.number.int({min: 2, max: 4})),
        linkedinUrl: faker.datatype.boolean(0.6) ? `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}` : undefined,
    };
}

export function generateAssistants(count: number = 8): Assistant[] {
    return faker.helpers.multiple(createRandomAssistant, { count });
}

export function generateTasks(count: number = 25, assistants: Assistant[]): Task[] {
    const assistantIds = assistants.map(a => a.id);
    if (assistantIds.length === 0) return []; // Avoid errors if no assistants
    return faker.helpers.multiple(() => createRandomTask(assistantIds), { count });
}
/* --- End of Placeholder Data --- */

export default function Main() {
    const [assistants, setAssistants] = React.useState<Assistant[]>([]);
    const [tasks, setTasks] = React.useState<Task[]>([]);

    const [chatTargetAssistantId, setChatTargetAssistantId] = React.useState<string | null>(null);
    const [isChatOpen, setIsChatOpen] = React.useState(false);

    const [profileAssistantId, setProfileAssistantId] = React.useState<string | null>(null);
    const [isProfileOpen, setIsProfileOpen] = React.useState(false); // Keep state to control animation


    // Generate fake data on mount
    React.useEffect(() => {
        const generatedAssistants = generateAssistants(15);
        const generatedTasks = generateTasks(50, generatedAssistants); // Generate 50 tasks
        setAssistants(generatedAssistants);
        setTasks(generatedTasks);
    }, []);

    // Derived state: get the assistant for the chat window
    const chatAssistant = React.useMemo(() => {
        return assistants.find(a => a.id === chatTargetAssistantId) || null;
    }, [assistants, chatTargetAssistantId]);

    // Derived state: get the assistant for the profile panel
    const profileAssistant = React.useMemo(() => {
        return assistants.find(a => a.id === profileAssistantId) || null;
    }, [assistants, profileAssistantId]);

    // Handler for initiating chat
    const handleChat = (id: string) => {
        setChatTargetAssistantId(id);
        setIsChatOpen(true);
        // Close profile panel if opening chat for someone else
        if (isProfileOpen && profileAssistantId !== id) {
             setIsProfileOpen(false);
             setProfileAssistantId(null);
        }
    };

    // Handler for closing chat
    const handleChatClose = () => {
        setIsChatOpen(false);
    };

     // Handler for showing profile panel
     const handleShowProfile = (id: string) => {
        // If clicking the same profile button again, close it
        if (isProfileOpen && profileAssistantId === id) {
             setIsProfileOpen(false);
             setProfileAssistantId(null);
        } else {
             setProfileAssistantId(id);
             setIsProfileOpen(true);
             // Close chat if opening profile for someone else
             if (isChatOpen && chatTargetAssistantId !== id) {
                 setIsChatOpen(false);
                 setChatTargetAssistantId(null);
             }
        }
     };

     // Renamed handler to reflect it's closing the panel
     const handleProfileClose = () => {
        setIsProfileOpen(false);
        // No need to delay clearing the ID if animation targets width/opacity
        // The component will receive null `assistant` prop during exit anim.
        setProfileAssistantId(null);
    };

     return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Assistant List Panel - Wider */}
            <div className={cn(
                "h-full transition-all duration-300 ease-in-out relative border-r",
                 // Set desired width (e.g., 1/3), ensure it doesn't shrink
                "w-1/3 lg:w-[400px] xl:w-[450px] flex-shrink-0" // Example widths, adjust as needed
            )}
            >
                 <AssistantList
                    assistants={assistants}
                    profileAssistantId={profileAssistantId}
                    chatTargetAssistantId={chatTargetAssistantId}
                    onShowProfile={handleShowProfile}
                    onChat={handleChat}
                    isChatOpen={isChatOpen}
                    chatAssistant={chatAssistant}
                    onChatClose={handleChatClose}
                />
            </div>

            {/* Assistant Profile Panel (Animated Div) */}
            <AnimatePresence initial={false}>
                {isProfileOpen && profileAssistant && (
                    <motion.div
                        key="assistant-profile"
                        // Animate width from 0% to the desired fraction
                        initial={{ width: "0%", opacity: 0, x: "-1%" }} // Start slightly offset for slide illusion
                        animate={{ width: "25%", opacity: 1, x: "0%" }}
                        // Animate back to 0% width
                        exit={{ width: "0%", opacity: 0, x: "-1%" }}
                        transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }}
                        // Use flex-shrink-0 so it doesn't get squashed, width animation handles size
                        className="h-full flex-shrink-0 border-r overflow-hidden bg-background"
                     >
                        <AssistantProfilePanel
                            assistant={profileAssistant}
                            onClose={handleProfileClose}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Task List Panel - Takes remaining space */}
            {/* flex-1 handles taking up the rest of the space correctly */}
            <div className="flex-1 h-full min-w-0 overflow-hidden">
                <TaskList allTasks={tasks} allAssistants={assistants} />
            </div>

        </div>
    );
}