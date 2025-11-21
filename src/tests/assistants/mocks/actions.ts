import { AssistantActions } from "@/types/assistants/assistant";
import { mockAssistants, mockStatuses } from "./data";
import { vi } from "vitest";
import { TaskActions } from "@/types/assistants/task";
import { ActivityLogActions } from "@/types/assistants/activity";

export const mockAssistantActions: AssistantActions = {
    assistant: {
        list: vi.fn(async () => mockAssistants),
        create: vi.fn(async () => ({ assistant: mockAssistants[0] })),
        update: vi.fn(async () => ({})), 
        delete: vi.fn(async () => ({})),
        status: vi.fn((id: string) => Promise.resolve(mockStatuses.get(id) || { running: false })),
    },
    photo: { 
        upload: vi.fn(async () => ({})), 
        uploadVideo: vi.fn(async () => ({})), 
        download: vi.fn(async () => ({})), 
        downloadPresetVideo: vi.fn(async () => ({})), 
        generate: vi.fn(async () => ({})), 
        edit: vi.fn(async () => ({})), 
        animate: vi.fn(async () => ({})), 
        getAnimation: vi.fn(async () => ({})), 
        cancelAnimation: vi.fn(async () => ({})) 
    },
    voice: { 
        list: vi.fn(async () => []), 
        register: vi.fn(async () => ({})), 
        delete: vi.fn(async () => ({})), 
        clone: vi.fn(async () => ({})), 
        generate: vi.fn(async () => ({})), 
        preview: vi.fn(async () => ({ previews: [], text: '' })), 
        design: vi.fn(async () => ({})) 
    },
    chat: { 
        getTranscripts: vi.fn(async (_context: string ) => []),
        updateTranscripts: vi.fn(async () => ({})), 
        message: vi.fn(async () => ({})) 
    },
    contact: { 
        delete: vi.fn(async () => ({})), 
        listAllAssistantEmails: vi.fn(async () => []), 
        listAvailablePhoneCountries: vi.fn(async () => []), 
        listAvailableSocialPlatforms: vi.fn(async () => []), 
        verifySocialAccount: vi.fn(async () => ({ verification_code: '123456', sent_at: new Date().toISOString() })) 
    },
    secret: { 
        get: vi.fn(async () => []), 
        create: vi.fn(async () => ({})), 
        delete: vi.fn(async () => ({})) 
    },
    approval: { 
        getProfile: vi.fn(() => Promise.resolve({ assistant_hiring_approval: "approved", has_claimed_approval_link: true })), 
        requestAccess: vi.fn(async () => ({message: "mocked"})), 
        claimToken: vi.fn(async () => ({message: "mocked"})) 
    },
    call: { 
        getConnectionDetails: vi.fn(async () => ({})), 
        dispatchToCall: vi.fn(async () => ({})) 
    },
    desktop: { 
        getLiveviewUrl: vi.fn(async () => ({})), 
        sendSystemEvent: vi.fn(async () => ({})) 
    }
};

export const mockTaskActions: TaskActions = {
    get: vi.fn(() => Promise.resolve({ logs: [], count: 0 })),
    update: vi.fn(),
};

export const mockActivityLogActions: ActivityLogActions = {
    get: vi.fn(() => Promise.resolve({ summary: '' })),
};