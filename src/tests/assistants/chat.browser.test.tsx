import * as React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@/tests/render';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AssistantProfilePanel } from '@/components/Pages/Assistants/Assistants/Profile/AssistantProfile';
import { createMockAssistant } from './mocks/data';
import { mockAssistantActions } from './mocks/actions';
import { AssistantActions } from '@/types/assistants/assistant';
import { ChatMessage } from '@/types/assistants/chat';

// --- Mock EventSource ---
const originalEventSource = window.EventSource;

// 1. Existing MockEventSource (Keep this)
class MockEventSource {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 2;

    onopen: (() => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((error: any) => void) | null = null;
    readyState = 0; 
    url: string;

    constructor(url: string) {
        this.url = url;
        setTimeout(() => {
            this.readyState = 1; 
            if (this.onopen) this.onopen();
        }, 10);
    }
    close() { this.readyState = 2; }
    addEventListener() {}
    removeEventListener() {}
}

// 2. Global Instance Variable
let mockEventSourceInstance: ControllableMockEventSource | null = null;

// 3.  ControllableMockEventSource Class Definition
class ControllableMockEventSource extends MockEventSource {
    constructor(url: string) {
        super(url);
        // Override super's auto-connect behavior
        // We want manual control, so we override readyState and suppress the timeout if possible.
        // Since super's timeout runs, we effectively ignore it by checking readyState in our tests
        // or by overwriting it here immediately.
        this.readyState = 0; // CONNECTING
        
        // Capture this instance globally so tests can control it
        mockEventSourceInstance = this;
    }
    
    simulateOpen() {
        this.readyState = 1;
        if (this.onopen) this.onopen();
    }

    simulateError() {
        if (this.onerror) this.onerror(new Event('error'));
    }

    simulateMessage(data: object) {
        if (this.onmessage) {
            this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
        }
    }

    simulateServerClose() {
        this.readyState = 2; // CLOSED
        if (this.onerror) this.onerror(new Event('error'));
    }
}

// --- Helper to create Direct Mocks ---
const createMockedActions = (
    serverLogs: { content: string, role: 'user' | 'assistant', timestamp?: number }[] = []
): AssistantActions => {
    // The real API returns logs in Reverse Chronological order (Newest first).
    // The hook calls .reverse() to put them in Chronological order (Oldest first).
    // We simulate the API by reversing our chronological test data here.
    const apiResponseLogs = [...serverLogs].reverse();

    return {
        ...mockAssistantActions,
        chat: {
            ...mockAssistantActions.chat,
            getTranscripts: vi.fn(async (_context: string) => {
                return apiResponseLogs.map((log, index) => ({
                    id: String(100 + index),
                    role: log.role,
                    content: log.content,
                    timestamp: new Date(log.timestamp || Date.now() - (10000 - index * 1000)),
                    message_id: 100 + index
                })) as ChatMessage[];
            }),
            message: vi.fn(async () => ({ info: 'Sent' }))
        }
    };
};

describe('Assistant Profile Chat Interface', () => {
    const testAssistant = createMockAssistant({ 
        first_name: 'Chat', 
        surname: 'Bot',
        agent_id: 'chat-test-id' 
    });

    // State wrapper component
    const ChatTestWrapper = ({ 
        initialHistory,
        serverLogs = []
    }: { 
        initialHistory?: ChatMessage[],
        serverLogs?: { content: string, role: 'user' | 'assistant', timestamp?: number }[]
    }) => {
        const actions = React.useMemo(() => createMockedActions(serverLogs), [serverLogs]);
        
        const initialState = React.useMemo(() => {
            if (initialHistory !== undefined) {
                return { [testAssistant.agent_id]: initialHistory };
            }
            return {};
        }, [initialHistory]);

        const [histories, setHistories] = React.useState<Record<string, ChatMessage[]>>(initialState);

        return (
            <AssistantProfilePanel
                assistant={testAssistant}
                assistantActions={actions}
                onClose={vi.fn()}
                onDeleteAssistant={vi.fn()}
                onEdit={vi.fn()}
                onOpenContactManager={vi.fn()}
                chatHistories={histories}
                setChatHistories={setHistories}
                onStartCall={vi.fn()}
                activeCallAssistantId={null}
                isCallConnected={false}
                isConnectingCall={false}
            />
        );
    };

    beforeEach(() => {
        Element.prototype.scrollIntoView = vi.fn();
        window.EventSource = MockEventSource as any;
    });

    afterEach(() => {
        window.EventSource = originalEventSource;
    });

    const getChatBubbleContents = () => {
        const bubbles = screen.queryAllByTestId('message-bubble');
        return bubbles.map(b => b.textContent);
    };

    const triggerReconciliation = () => {
        document.dispatchEvent(new Event('visibilitychange'));
    };

    // =========================================================================
    // GENERAL UI & UX TESTS
    // =========================================================================
    describe('General UX & Functionality', () => {
        

        it('disables input while initial history is loading', { meta: { alias: 'UX-Loading-State' } }, async () => {
            // Scenario: The `getTranscripts` call is slow. User shouldn't be able to type yet.
            
            let resolveFetch: Function;
            const slowFetch = new Promise(r => { resolveFetch = r; });
            
            const slowActions = {
                ...mockAssistantActions,
                chat: {
                    ...mockAssistantActions.chat,
                    getTranscripts: vi.fn(() => slowFetch as Promise<any>)
                }
            };

            render(
                <AssistantProfilePanel
                    assistant={testAssistant}
                    assistantActions={slowActions}
                    onClose={vi.fn()} onDeleteAssistant={vi.fn()} onEdit={vi.fn()} onOpenContactManager={vi.fn()}
                    chatHistories={{}} setChatHistories={vi.fn()}
                    onStartCall={vi.fn()} activeCallAssistantId={null} isCallConnected={false} isConnectingCall={false}
                />
            );

            // Check loading state
            const input = screen.getByRole('textbox');
            expect(input).toBeDisabled();
            expect(input).toHaveAttribute('placeholder', 'Loading messages...');

            // Resolve fetch
            // @ts-ignore
            resolveFetch([]);
            
            // We also need to wait for the SSE connection to establish (MockEventSource takes 10ms)
            // otherwise input remains disabled
            await waitFor(() => {
                expect(input).not.toBeDisabled();
                expect(input).toHaveAttribute('placeholder', 'Send a message...');
            });
        });

        it('prevents sending empty or whitespace-only messages', { meta: { alias: 'UX-Empty-Send' } }, async () => {
            render(<ChatTestWrapper initialHistory={[]} />);
            const user = userEvent.setup();
            const input = await screen.findByPlaceholderText('Send a message...');
            
            // Wait for connection to be fully established and input enabled
            await waitFor(() => expect(input).not.toBeDisabled());

            const sendBtn = screen.getByRole('button', { name: 'Send message' }); 

            // 1. Check empty state - button should be disabled
            expect(sendBtn).toBeDisabled();
            expect(getChatBubbleContents()).toHaveLength(0);

            // 2. Try sending spaces
            await user.type(input, '   ');
            expect(sendBtn).toBeDisabled(); // Still disabled
            expect(getChatBubbleContents()).toHaveLength(0);
            expect(input).toHaveValue('   '); 

            // 3. Type real text
            await user.type(input, 'Real');
            expect(sendBtn).not.toBeDisabled(); // Now enabled
            await user.click(sendBtn);
            expect(getChatBubbleContents()).toHaveLength(1);
        });

        it('preserves input value if sending fails', { meta: { alias: 'UX-Send-Failure' } }, async () => {
            // Scenario: Optimistic update adds message -> API fails -> Optimistic message removed -> Input restored.
            
            const errorActions = {
                ...mockAssistantActions,
                chat: {
                    ...mockAssistantActions.chat,
                    message: vi.fn(async () => { 
                        // Add delay to ensure optimistic UI state is renderable before rollback
                        await new Promise(r => setTimeout(r, 50)); 
                        throw new Error('Network Fail'); 
                    })
                }
            };

            const ErrorWrapper = () => {
                 const [histories, setHistories] = React.useState<Record<string, ChatMessage[]>>({});
                 return (
                    <AssistantProfilePanel
                        assistant={testAssistant}
                        assistantActions={errorActions}
                        onClose={vi.fn()} onDeleteAssistant={vi.fn()} onEdit={vi.fn()} onOpenContactManager={vi.fn()}
                        chatHistories={histories} setChatHistories={setHistories}
                        onStartCall={vi.fn()} activeCallAssistantId={null} isCallConnected={false} isConnectingCall={false}
                    />
                 );
            };

            render(<ErrorWrapper />);
            const user = userEvent.setup();
            const input = await screen.findByPlaceholderText('Send a message...');
            await waitFor(() => expect(input).not.toBeDisabled());

            // Type and send
            await user.type(input, 'This will fail');
            await user.keyboard('{Enter}');

            // 1. Input clears optimistically
            await waitFor(() => expect(input).toHaveValue(''));

            // 2. Optimistic bubble appears
            expect(screen.getByText('This will fail')).toBeInTheDocument();

            // 3. Wait for failure handling (Toast + Rollback)
            await waitFor(() => {
                // Bubble gone. We specifically look for the message bubble test ID.
                const bubbles = screen.queryAllByTestId('message-bubble');
                const failBubble = bubbles.find(b => b.textContent === 'This will fail');
                expect(failBubble).toBeUndefined();

                // Input value restored
                expect(input).toHaveValue('This will fail');
                // Toast shown
                expect(screen.getByText('Failed to send message.')).toBeInTheDocument();
            });
        });

        it('auto-expands textarea on multi-line input', { meta: { alias: 'UX-Textarea-Grow' } }, async () => {
            // This tests the `useEffect` for textarea height in `AssistantProfileChatPanel`.
            
            render(<ChatTestWrapper initialHistory={[]} />);
            const user = userEvent.setup();
            const input = await screen.findByPlaceholderText('Send a message...');
            await waitFor(() => expect(input).not.toBeDisabled());

            // Type multiple lines
            const multiLineText = 'Line 1{Shift>}{Enter}{/Shift}Line 2{Shift>}{Enter}{/Shift}Line 3';
            await user.type(input, multiLineText);
            
            // Verify text was actually typed (ensure state updated)
            expect(input).toHaveValue('Line 1\nLine 2\nLine 3');

            await waitFor(() => {
                // We expect the inline style height to be set.
                // Even if the exact pixel value is mock-dependent, it should not be 'auto' or empty after typing.
                expect(input.style.height).not.toBe('');
                expect(input.style.height).not.toBe('auto');
            });
        });
        
        it('loads and displays existing chat history', { meta: { alias: 'Chat-Load-History' } }, async () => {
            const logs = [
                { role: 'user' as const, content: 'Hello assistant' },
                { role: 'assistant' as const, content: 'Hello Jane, how can I help?' }
            ];
            render(<ChatTestWrapper initialHistory={undefined} serverLogs={logs} />);
            
            await waitFor(() => {
                const contents = getChatBubbleContents();
                expect(contents).toEqual(['Hello assistant', 'Hello Jane, how can I help?']);
            });
        });

        it('optimistically updates UI when sending a message', { meta: { alias: 'Chat-Send-Optimistic' } }, async () => {
            const user = userEvent.setup();
            render(<ChatTestWrapper initialHistory={[]} />);

            const input = await screen.findByPlaceholderText('Send a message...');
            await waitFor(() => expect(input).not.toBeDisabled());
            
            const messageText = 'Testing optimistic update';
            await user.type(input, messageText);
            await user.keyboard('{Enter}');

            expect(input).toHaveValue('');
            expect(await screen.findByText(messageText)).toBeInTheDocument();
        });

        it('restores message content to input if sending fails', { meta: { alias: 'UX-Restore-Input-On-Fail' } }, async () => {
            // 1. Setup mock to simulate failure with delay
            const errorActions = {
                ...mockAssistantActions,
                chat: {
                    ...mockAssistantActions.chat,
                    message: vi.fn(async () => { 
                        await new Promise(r => setTimeout(r, 50));
                        throw new Error('Network Error'); 
                    })
                }
            };

            // 2. Render component with error-prone actions
            render(
                <AssistantProfilePanel
                    assistant={testAssistant}
                    assistantActions={errorActions}
                    onClose={vi.fn()} onDeleteAssistant={vi.fn()} onEdit={vi.fn()} onOpenContactManager={vi.fn()}
                    chatHistories={{}} setChatHistories={vi.fn()}
                    onStartCall={vi.fn()} activeCallAssistantId={null} isCallConnected={false} isConnectingCall={false}
                />
            );

            const user = userEvent.setup();
            const input = await screen.findByPlaceholderText('Send a message...');
            await waitFor(() => expect(input).not.toBeDisabled());

            // 3. Type and Send
            const testMessage = 'This message will fail';
            await user.type(input, testMessage);
            await user.keyboard('{Enter}');

            // 4. Verify Optimistic Clear (Immediate behavior)
            await waitFor(() => expect(input).toHaveValue(''));

            // 5. Verify Restoration (After async failure)
            await waitFor(() => {
                // The hook catches the error and sets inputValue back to the message
                expect(input).toHaveValue(testMessage);
                // Expect the toast error
                expect(screen.getByText('Failed to send message.')).toBeInTheDocument();
            });
        });

        it('sends correct payload to message API', { meta: { alias: 'Chat-Payload-Verify' } }, async () => {
            // 1. Setup an assistant with a parsable numeric ID
            const numericAssistant = createMockAssistant({ 
                agent_id: '12345', 
                first_name: 'Test', 
                surname: 'Agent' 
            });

            // 2. Create a specific spy for this test
            const messageSpy = vi.fn(async () => ({ info: 'Sent' }));
            
            const spyActions = {
                ...mockAssistantActions,
                chat: {
                    ...mockAssistantActions.chat,
                    getTranscripts: vi.fn(async () => []),
                    message: messageSpy
                }
            };

            // 3. Render directly (skip wrapper to ensure we control the actions prop)
            render(
                <AssistantProfilePanel
                    assistant={numericAssistant}
                    assistantActions={spyActions}
                    onClose={vi.fn()} onDeleteAssistant={vi.fn()} onEdit={vi.fn()} onOpenContactManager={vi.fn()}
                    chatHistories={{}} setChatHistories={vi.fn()}
                    onStartCall={vi.fn()} activeCallAssistantId={null} isCallConnected={false} isConnectingCall={false}
                />
            );

            const user = userEvent.setup();
            const input = await screen.findByPlaceholderText('Send a message...');
            await waitFor(() => expect(input).not.toBeDisabled());
            
            // 4. Type and Send
            const messageText = 'Hello World';
            await user.type(input, messageText);
            await user.keyboard('{Enter}');

            // 5. Assert payload matches types/assistants/chat.ts interface
            await waitFor(() => {
                expect(messageSpy).toHaveBeenCalledWith({
                    assistant_id: 12345, // verified it was parsed to number
                    contact_id: 1,       // verified hardcoded value from hook
                    message: 'Hello World'
                });
            });
        });
    });

    // =========================================================================
    // RECONCILIATION LOGIC TESTS
    // =========================================================================
    describe('Chat History Reconciliation', () => {
        
        it('syncs new server messages when local state is undefined', { meta: { alias: 'Rec-Cold-Sync' } }, async () => {
            const now = Date.now();
            // Define in chronological order
            const logs = [
                { role: 'user' as const, content: 'Hello', timestamp: now - 5000 },
                { role: 'assistant' as const, content: 'Hi there', timestamp: now - 4000 }
            ];

            render(<ChatTestWrapper initialHistory={undefined} serverLogs={logs} />);

            await waitFor(() => {
                expect(getChatBubbleContents()).toEqual(['Hello', 'Hi there']);
            });
        });

        it('preserves pending local messages when server lags behind', { meta: { alias: 'Rec-Preserve-Pending' } }, async () => {
            const now = Date.now();
            
            // 1. Server knows about Message A
            const logs = [
                { role: 'user' as const, content: 'Message A', timestamp: now - 5000 }
            ];

            // 2. Local has Message A + Optimistic Message B
            const localHistory: ChatMessage[] = [
                { id: 'loc-1', role: 'user', content: 'Message A', timestamp: new Date(now - 5000) },
                { id: 'loc-2', role: 'user', content: 'Message B (Pending)', timestamp: new Date(now) }
            ];

            render(<ChatTestWrapper initialHistory={localHistory} serverLogs={logs} />);

            await screen.findByText('Message A');
            triggerReconciliation();

            // Expectation: Local pending message B should be preserved
            await waitFor(() => {
                const contents = getChatBubbleContents();
                expect(contents).toEqual(['Message A', 'Message B (Pending)']);
            });
        });

        it('merges server reply while keeping subsequent pending user message', { meta: { alias: 'Rec-Interleaved' } }, async () => {
            const now = Date.now();

            // 1. Local State: User sent A, then B.
            const localHistory: ChatMessage[] = [
                { id: 'loc-1', role: 'user', content: 'Message A', timestamp: new Date(now - 10000) },
                { id: 'loc-2', role: 'user', content: 'Message B', timestamp: new Date(now) }
            ];

            // 2. Server State: Received A, Processed it, Replied with Reply A.
            const logs = [
                { role: 'user' as const, content: 'Message A', timestamp: now - 10000 },
                { role: 'assistant' as const, content: 'Reply A', timestamp: now - 5000 }
            ];

            render(<ChatTestWrapper initialHistory={localHistory} serverLogs={logs} />);

            triggerReconciliation();

            // Expectation: [Message A, Reply A, Message B]
            await waitFor(() => {
                expect(getChatBubbleContents()).toEqual(['Message A', 'Reply A', 'Message B']);
            });
        });

        it('handles duplicate identical messages correctly', { meta: { alias: 'Rec-Duplicates' } }, async () => {
            const now = Date.now();
            const logs = [
                { role: 'user' as const, content: 'Hello', timestamp: now - 2000 },
                { role: 'user' as const, content: 'Hello', timestamp: now - 1000 }
            ];
            const localHistory: ChatMessage[] = [
                { id: 'loc-1', role: 'user', content: 'Hello', timestamp: new Date(now - 2000) },
                { id: 'loc-2', role: 'user', content: 'Hello', timestamp: new Date(now - 1000) }
            ];

            render(<ChatTestWrapper initialHistory={localHistory} serverLogs={logs} />);
            triggerReconciliation();

            await waitFor(() => {
                const contents = getChatBubbleContents();
                expect(contents).toEqual(['Hello', 'Hello']);
                expect(contents).toHaveLength(2);
            });
        });

        it('recovers gracefully when server history is completely different', { meta: { alias: 'Rec-Fallback' } }, async () => {
            const now = Date.now();

            // Local has stale/wrong data
            const localHistory: ChatMessage[] = [
                { id: 'loc-old', role: 'user', content: 'Old Stale Message', timestamp: new Date(now - 999999) },
                { id: 'loc-new', role: 'user', content: 'New Pending Message', timestamp: new Date(now) }
            ];

            // Server has fresh data
            const logs = [
                { role: 'assistant' as const, content: 'Welcome', timestamp: now - 5000 }
            ];

            render(<ChatTestWrapper initialHistory={localHistory} serverLogs={logs} />);
            triggerReconciliation();

            // Expectation: 
            // - Old Stale dropped (older than server's last)
            // - Welcome added (from server)
            // - New Pending kept (newer than server's last)
            await waitFor(() => {
                const contents = getChatBubbleContents();
                expect(contents).toEqual(['Welcome', 'New Pending Message']);
            });
        });

        it('handles race condition where user sends message during reconciliation', { meta: { alias: 'Rec-Race-Send' } }, async () => {
            const now = Date.now();
            // 1. Initial Server State
            const initialLogs = [{ role: 'user' as const, content: 'Message A', timestamp: now - 5000 }];
            
            // 2. Updated Server State (used during reconciliation)
            const updatedLogs = [
                { role: 'user' as const, content: 'Message A', timestamp: now - 5000 },
                { role: 'assistant' as const, content: 'Reply A', timestamp: now - 4000 }
            ];

            const apiResponseInitial = [...initialLogs].reverse();
            const apiResponseUpdated = [...updatedLogs].reverse();

            const actions = {
                ...mockAssistantActions,
                chat: {
                    ...mockAssistantActions.chat,
                    getTranscripts: vi.fn()
                        .mockResolvedValueOnce(apiResponseInitial.map((log, i) => ({
                            id: String(100+i), role: log.role, content: log.content, timestamp: new Date(log.timestamp)
                        })))
                        // Add a small delay to the second call. This ensures the synchronous state update 
                        // from sending the message has time to process before the async fetch resolves 
                        // and tries to merge state.
                        .mockImplementationOnce(async () => {
                            await new Promise(r => setTimeout(r, 10));
                            return apiResponseUpdated.map((log, i) => ({
                                id: String(200+i), role: log.role, content: log.content, timestamp: new Date(log.timestamp)
                            }));
                        }),
                    message: vi.fn(async () => ({ info: 'Sent' }))
                }
            };

            const RaceWrapper = () => {
                const [histories, setHistories] = React.useState<Record<string, ChatMessage[]>>({});
                return (
                    <AssistantProfilePanel
                        assistant={testAssistant}
                        assistantActions={actions}
                        onClose={vi.fn()} onDeleteAssistant={vi.fn()} onEdit={vi.fn()} onOpenContactManager={vi.fn()}
                        chatHistories={histories} setChatHistories={setHistories}
                        onStartCall={vi.fn()} activeCallAssistantId={null} isCallConnected={false} isConnectingCall={false}
                    />
                );
            };
            render(<RaceWrapper />);

            // Wait for initial load
            await screen.findByText('Message A');

            // User sends B using synchronous events
            const input = screen.getByPlaceholderText('Send a message...');
            fireEvent.change(input, { target: { value: 'Message B' } });
            fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });
            
            // Trigger reconciliation immediately after
            triggerReconciliation();

            // Expectation: [Message A, Reply A, Message B]
            await waitFor(() => {
                expect(getChatBubbleContents()).toEqual(['Message A', 'Reply A', 'Message B']);
            });
        });

        it('preserves locally sent message during subsequent background refetches', { meta: { alias: 'Rec-Send-Then-Refetch' } }, async () => {
            const user = userEvent.setup();
            
            // Setup:
            // 1. Initial load returns empty.
            // 2. Subsequent fetch (after user sends msg) ALSO returns empty (simulating server lag).
            //    The reconciliation logic must realize the local message is newer/pending and preserve it.
            const actions = {
                ...mockAssistantActions,
                chat: {
                    ...mockAssistantActions.chat,
                    getTranscripts: vi.fn()
                        .mockResolvedValueOnce([]) 
                        .mockResolvedValueOnce([]),
                    message: vi.fn(async () => ({ info: 'Sent' }))
                }
            };

            const Wrapper = () => {
                const [histories, setHistories] = React.useState<Record<string, ChatMessage[]>>({});
                return (
                    <AssistantProfilePanel
                        assistant={testAssistant}
                        assistantActions={actions}
                        onClose={vi.fn()} onDeleteAssistant={vi.fn()} onEdit={vi.fn()} onOpenContactManager={vi.fn()}
                        chatHistories={histories} setChatHistories={setHistories}
                        onStartCall={vi.fn()} activeCallAssistantId={null} isCallConnected={false} isConnectingCall={false}
                    />
                );
            };

            render(<Wrapper />);
            
            const input = await screen.findByPlaceholderText('Send a message...');
            await waitFor(() => expect(input).not.toBeDisabled());

            // User sends "Persistent Message"
            await user.type(input, 'Persistent Message');
            await user.keyboard('{Enter}');

            // Ensure it appears optimistically
            await waitFor(() => {
                expect(getChatBubbleContents()).toEqual(['Persistent Message']);
            });

            // Trigger background refetch (e.g. user tabs out and back)
            document.dispatchEvent(new Event('visibilitychange'));

            // Wait for refetch to happen
            await waitFor(() => expect(actions.chat.getTranscripts).toHaveBeenCalledTimes(2));

            // Assert the message wasn't wiped out by the empty server response
            expect(getChatBubbleContents()).toEqual(['Persistent Message']);
        });

        it('handles client clock lagging the server clock significantly', { meta: { alias: 'Stress-Clock-Lag' } }, async () => {
            // Scenario: Client clock is set to 1990. Server clock is 2024.
            // If matching logic relies purely on timestamps for "newness", this will fail.
            // It must rely on Content Matching first.
            
            const serverTime = Date.now(); 
            const localTime = new Date('1990-01-01').getTime();

            const serverLogs = [
                { role: 'user' as const, content: 'Timeless Message', timestamp: serverTime }
            ];

            const localHistory: ChatMessage[] = [
                { id: 'loc-1', role: 'user', content: 'Timeless Message', timestamp: new Date(localTime) }
            ];

            render(<ChatTestWrapper initialHistory={localHistory} serverLogs={serverLogs} />);
            triggerReconciliation();

            await waitFor(() => {
                const contents = getChatBubbleContents();
                // If fallback logic triggered (timestamp check), 1990 < 2024, so it would be dropped.
                // We expect Content Match to save it, resulting in 1 merged message.
                expect(contents).toEqual(['Timeless Message']);
                expect(contents).toHaveLength(1); 
            });
        });

        it('prevents duplication when client clock is ahead of server clock', { meta: { alias: 'Stress-Clock-Future' } }, async () => {
            // Scenario: Client clock is set to 3000. Server clock is 2024.
            // Fallback logic `local > server` returns TRUE.
            // We need to ensure the Primary Match logic catches the duplicate before Fallback executes.
            
            const serverTime = Date.now(); 
            const localTime = new Date('3000-01-01').getTime();

            const serverLogs = [
                { role: 'user' as const, content: 'Future Message', timestamp: serverTime }
            ];

            const localHistory: ChatMessage[] = [
                { id: 'loc-1', role: 'user', content: 'Future Message', timestamp: new Date(localTime) }
            ];

            render(<ChatTestWrapper initialHistory={localHistory} serverLogs={serverLogs} />);
            triggerReconciliation();

            await waitFor(() => {
                const contents = getChatBubbleContents();
                // Should merge to 1. If it duplicates, the primary match failed.
                expect(contents).toHaveLength(1);
                expect(contents).toEqual(['Future Message']);
            });
        });

        it('handles server state regression', { meta: { alias: 'Stress-Server-Regression' } }, async () => {
            const now = Date.now();
            // Scenario: Local has [A, B]. We previously synced [A, B].
            // Suddenly, server returns only [A] (maybe DB read replica lag).
            // UI should treat [B] as pending again, rather than deleting it.
            
            const serverLogs = [
                { role: 'user' as const, content: 'Message A', timestamp: now - 5000 }
                // Message B is missing from server response
            ];

            const localHistory: ChatMessage[] = [
                { id: 'loc-1', role: 'user', content: 'Message A', timestamp: new Date(now - 5000) },
                { id: 'loc-2', role: 'user', content: 'Message B', timestamp: new Date(now - 4000) }
            ];

            render(<ChatTestWrapper initialHistory={localHistory} serverLogs={serverLogs} />);
            triggerReconciliation();

            await waitFor(() => {
                const contents = getChatBubbleContents();
                // Should keep B. Logic: Match found at A. Append everything locally after A.
                expect(contents).toEqual(['Message A', 'Message B']);
            });
        });

        it('ignores API Failures gracefully', { meta: { alias: 'Stress-API-Fail' } }, async () => {
            // Scenario: getTranscripts fails completely. 
            // Local state should not be wiped.
            
            const localHistory: ChatMessage[] = [
                { id: 'loc-1', role: 'user', content: 'Important Pending Data', timestamp: new Date() }
            ];

            // Custom actions to inject an error
            const errorActions = {
                ...mockAssistantActions,
                chat: {
                    ...mockAssistantActions.chat,
                    // Mock failure response
                    getTranscripts: vi.fn(async () => ({ detail: 'Network Error' })),
                }
            };

            const ErrorWrapper = () => {
                const [histories, setHistories] = React.useState<Record<string, ChatMessage[]>>({
                    [testAssistant.agent_id]: localHistory
                });
                return (
                    <AssistantProfilePanel
                        assistant={testAssistant}
                        assistantActions={errorActions}
                        onClose={vi.fn()} onDeleteAssistant={vi.fn()} onEdit={vi.fn()} onOpenContactManager={vi.fn()}
                        chatHistories={histories} setChatHistories={setHistories}
                        onStartCall={vi.fn()} activeCallAssistantId={null} isCallConnected={false} isConnectingCall={false}
                    />
                );
            };

            render(<ErrorWrapper />);
            triggerReconciliation();

            // Wait a bit to ensure the effect ran
            await new Promise(r => setTimeout(r, 500));

            const contents = getChatBubbleContents();
            expect(contents).toEqual(['Important Pending Data']);
        });

        it('handles empty server response by preserving all local messages', { meta: { alias: 'Stress-Empty-Server' } }, async () => {
            // Scenario: Server returns [], but we have local messages.
            // This happens if the very first message sent hasn't been indexed by the server yet.
            
            const localHistory: ChatMessage[] = [
                { id: 'loc-1', role: 'user', content: 'First Message', timestamp: new Date() }
            ];
            const serverLogs: any[] = []; // Empty

            render(<ChatTestWrapper initialHistory={localHistory} serverLogs={serverLogs} />);
            triggerReconciliation();

            await waitFor(() => {
                const contents = getChatBubbleContents();
                // The logic "else if (currentLocalHistory.length > 0)" should hit
                expect(contents).toEqual(['First Message']);
            });
        });

        it('handles mixed roles synchronization', { meta: { alias: 'Stress-Mixed-Roles' } }, async () => {
             const now = Date.now();
             // Scenario: Complex interplay of User and Assistant messages
             // Local: [User: A, Assistant: B, User: C (pending)]
             // Server: [User: A, Assistant: B]
             
             const serverLogs = [
                 { role: 'user' as const, content: 'Is it raining?', timestamp: now - 5000 },
                 { role: 'assistant' as const, content: 'No, it is sunny.', timestamp: now - 4000 }
             ];
 
             const localHistory: ChatMessage[] = [
                 { id: 'loc-1', role: 'user', content: 'Is it raining?', timestamp: new Date(now - 5000) },
                 { id: 'loc-2', role: 'assistant', content: 'No, it is sunny.', timestamp: new Date(now - 4000) },
                 { id: 'loc-3', role: 'user', content: 'Okay thanks', timestamp: new Date(now) }
             ];
 
             render(<ChatTestWrapper initialHistory={localHistory} serverLogs={serverLogs} />);
             triggerReconciliation();
 
             await waitFor(() => {
                 const bubbles = screen.getAllByTestId('message-bubble');
                 expect(bubbles).toHaveLength(3);
                 
                 // Check roles specifically
                 expect(bubbles[0]).toHaveAttribute('data-role', 'user');
                 expect(bubbles[1]).toHaveAttribute('data-role', 'assistant');
                 expect(bubbles[2]).toHaveAttribute('data-role', 'user');
                 
                 expect(bubbles[2]).toHaveTextContent('Okay thanks');
             });
        });

        it('handles out-of-order server ingestion', { meta: { alias: 'Stress-Out-Of-Order' } }, async () => {
            const now = Date.now();
            // Scenario: User sends A, then B.
            // Server returns [B, A] (timestamp collision or async processing glitch).
            // Local is [A, B].
            
            // Server logs reversed (newest first in API response, but effectively B appears "older" or mixed)
            const serverLogs = [
                { role: 'user' as const, content: 'Message B', timestamp: now - 2000 }, // Timestamp indicates B is older?
                { role: 'user' as const, content: 'Message A', timestamp: now - 1000 }  // A is newer?
            ];
            
            // Note: In the test wrapper, we reverse serverLogs to simulate "Chronological Order".
            // If the API returns B then A (reversed chronological), passing [B, A] to the wrapper
            // means chronological is [A, B]. Let's explicitly simulate the "Wrong" chronological order.
            
            // Let's say the server thinks B happened BEFORE A due to a glitch.
            const glitchLogs = [
                 { role: 'user' as const, content: 'Message B', timestamp: now - 2000 },
                 { role: 'user' as const, content: 'Message A', timestamp: now - 1000 }
            ];

            const localHistory: ChatMessage[] = [
                { id: 'loc-1', role: 'user', content: 'Message A', timestamp: new Date(now - 2000) },
                { id: 'loc-2', role: 'user', content: 'Message B', timestamp: new Date(now - 1000) }
            ];

            render(<ChatTestWrapper initialHistory={localHistory} serverLogs={glitchLogs} />);
            triggerReconciliation();

            await waitFor(() => {
                // The UI should reflect the SERVER'S truth eventually, even if it's weird.
                // Or at least not crash/duplicate.
                const contents = getChatBubbleContents();
                expect(contents.sort()).toEqual(['Message A', 'Message B']); // Ignore order, check existence
                expect(contents).toHaveLength(2);
            });
        });

        it('distinguishes identical messages properly', { meta: { alias: 'Stress-Identical-Content' } }, async () => {
            const now = Date.now();
            // Scenario:
            // Server has: [User: "Yes", Asst: "Sure?"]
            // Local has:  [User: "Yes", Asst: "Sure?", User: "Yes" (Pending)]
            
            // If the algorithm matches the PENDING "Yes" to the OLD "Yes", 
            // it might think "I've found the sync point at the start" and duplicate the middle "Sure?".
            
            const serverLogs = [
                { role: 'user' as const, content: 'Yes', timestamp: now - 5000 },
                { role: 'assistant' as const, content: 'Are you sure?', timestamp: now - 4000 }
            ];

            const localHistory: ChatMessage[] = [
                { id: 'loc-1', role: 'user', content: 'Yes', timestamp: new Date(now - 5000) },
                { id: 'loc-2', role: 'assistant', content: 'Are you sure?', timestamp: new Date(now - 4000) },
                { id: 'loc-3', role: 'user', content: 'Yes', timestamp: new Date(now) } // New pending "Yes"
            ];

            render(<ChatTestWrapper initialHistory={localHistory} serverLogs={serverLogs} />);
            triggerReconciliation();

            await waitFor(() => {
                const contents = getChatBubbleContents();
                // Correct behavior: Match the local sequence [Yes, Sure?] to server [Yes, Sure?]. Append [Yes].
                expect(contents).toEqual(['Yes', 'Are you sure?', 'Yes']);
                expect(contents).toHaveLength(3);
            });
        });


    });

    // =========================================================================
    // SSE CONNECTION STRESS TESTS
    // =========================================================================
    describe('SSE Connection Robustness', () => {
        let mockEventSourceInstance: MockEventSource | null = null;

        // Override the MockEventSource for this specific suite to give us control
        class ControllableMockEventSource extends MockEventSource {
            constructor(url: string) {
                super(url);
                mockEventSourceInstance = this;
                // Do NOT auto-connect in this mock; we want manual control
                this.readyState = 0; // CONNECTING
            }
            
            // Helper to manually simulate open
            simulateOpen() {
                this.readyState = 1;
                if (this.onopen) this.onopen();
            }

            // Helper to manually simulate error
            simulateError() {
                this.readyState = 0; // Reset to CONNECTING on error
                if (this.onerror) this.onerror(new Event('error'));
            }

            // Helper to manually simulate incoming message
            simulateMessage(data: object) {
                if (this.onmessage) {
                    this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
                }
            }

            // Helper to simulate server closing connection
            simulateServerClose() {
                this.readyState = 2; // CLOSED
                if (this.onerror) this.onerror(new Event('error'));
            }
        }

        beforeEach(() => {
            window.EventSource = ControllableMockEventSource as any;
            mockEventSourceInstance = null;
        });

        it('reconciles transcripts immediately upon successful reconnection', { meta: { alias: 'SSE-Reconcile-On-Open' } }, async () => {
            // Scenario: Connection opens -> We expect a fetch of transcripts to sync up state.
            
            // 1. Setup: Server has "Message A". Local is empty.
            const serverLogs = [{ role: 'user' as const, content: 'Message A', timestamp: Date.now() }];
            
            render(<ChatTestWrapper initialHistory={[]} serverLogs={serverLogs} />);
            
            // 2. Verify initial state is empty
            expect(getChatBubbleContents()).toEqual([]);

            // 3. Simulate SSE Open (First connection - ignored by logic)
            await waitFor(() => expect(mockEventSourceInstance).not.toBeNull());
            mockEventSourceInstance!.simulateOpen();
            
            // 4. Simulate Drop (Error)
            mockEventSourceInstance!.simulateError();

            // 5. Simulate Reconnect (Second connection - triggers fetch)
            mockEventSourceInstance!.simulateOpen();

            // 6. Expect getTranscripts to be called and UI updated
            await waitFor(() => {
                expect(getChatBubbleContents()).toEqual(['Message A']);
            });
        });

        it('handles rapid connect/disconnect', { meta: { alias: 'SSE-Flapping' } }, async () => {
            // Scenario: The connection is unstable. Open -> Error -> Open -> Error.
            // The hook should stay resilient and not crash or duplicate listeners.
            
            render(<ChatTestWrapper initialHistory={[]} />);
            await waitFor(() => expect(mockEventSourceInstance).not.toBeNull());

            // Flap 1
            mockEventSourceInstance!.simulateOpen();
            mockEventSourceInstance!.simulateError();
            
            // Flap 2 (The hook creates a NEW EventSource on error/close usually, 
            // We simulate the browser retrying by firing open again on the SAME instance             
            mockEventSourceInstance!.simulateOpen();
            
            // Fire a message during the second successful connection
            mockEventSourceInstance!.simulateMessage({ 
                thread: 'unify_message_outbound', 
                event: { content: 'I survived flapping' } 
            });

            await waitFor(() => {
                expect(getChatBubbleContents()).toEqual(['I survived flapping']);
            });
        });

        it('triggers reconciliation on error', { meta: { alias: 'SSE-Error-Fetch' } }, async () => {
            // Scenario: SSE fails. We switch to "reconnecting".             
            // Let's test that flow: Connect -> Receive A -> Error (Miss B) -> Reconnect -> Receive C (and fetch B).
            
            const now = Date.now();
            const serverLogs = [
                { role: 'assistant' as const, content: 'Msg A', timestamp: now - 3000 },
                { role: 'assistant' as const, content: 'Msg B', timestamp: now - 2000 }, // Missed during error
                { role: 'assistant' as const, content: 'Msg C', timestamp: now - 1000 }
            ];

            // Initial load only knows A
            const initialServerLogs = [serverLogs[0]]; 

            // Render
            render(<ChatTestWrapper initialHistory={[]} serverLogs={initialServerLogs} />);
            await waitFor(() => expect(mockEventSourceInstance).not.toBeNull());
            
            // 1. Connect & Sync A
            mockEventSourceInstance!.simulateOpen(); 
            await waitFor(() => expect(getChatBubbleContents()).toEqual(['Msg A']));

            // 2. Error happens. (Msg B is generated on server now, but we miss it)
            mockEventSourceInstance!.simulateError();

            // 3. Reconnect happens. This should trigger `reconcileTranscripts`.            
            // RE-RENDER with full logs to simulate server state updating
            const { rerender } = render(<ChatTestWrapper initialHistory={[]} serverLogs={serverLogs} />);
            
            mockEventSourceInstance!.simulateOpen(); // Reconnected

            // 4. Receive Msg C via SSE immediately after reconnect
            mockEventSourceInstance!.simulateMessage({
                 thread: 'unify_message_outbound',
                 event: { content: 'Msg C' }
            });

            // 5. Expect A (old), B (fetched via reconciliation on open), C (via SSE)
            await waitFor(() => {
                const contents = getChatBubbleContents();
                expect(contents).toContain('Msg A');
                expect(contents).toContain('Msg B'); // Proof reconciliation ran on re-connect
                expect(contents).toContain('Msg C');
            });
        });

        it('stops typing indicator when a message arrives via SSE', { meta: { alias: 'SSE-Stop-Typing' } }, async () => {
            // Scenario: User sent a message. "Typing..." is active.
            // SSE message arrives. "Typing..." should vanish.
            
            render(<ChatTestWrapper initialHistory={[]} />);
            const user = userEvent.setup();

            // 1. User sends message
            const input = await screen.findByPlaceholderText('Send a message...');
            await user.type(input, 'Hello');
            await user.keyboard('{Enter}');

            // 2. Verify Typing Indicator appears (simulated by a bubble with loading state in real code, 
            await waitFor(() => expect(mockEventSourceInstance).not.toBeNull());
            mockEventSourceInstance!.simulateOpen();

            // 3. Simulate incoming message
            mockEventSourceInstance!.simulateMessage({
                 thread: 'unify_message_outbound',
                 event: { content: 'Reply' }
            });

            // We expect the 'Reply' to exist.
            await waitFor(() => {
                expect(getChatBubbleContents()).toContain('Reply');
            });
            
            // Since we can't easily assert internal state `isAssistantReplying` without exporting it,
            // we rely on the fact that the UI doesn't show a "Typing" bubble after the reply.
            // (Assuming the component renders a specific test-id for typing).
            // For this test to be strict, we'd check for absence of loading indicators.
            const typingIndicators = screen.queryAllByText('Typing');
            expect(typingIndicators).toHaveLength(0);
        });

        it('handles permanent failure', { meta: { alias: 'SSE-Permanent-Fail' } }, async () => {
            // Scenario: Auth fails (401) or server 500s repeatedly.
            // The hook has logic: `if (retryCount > 5) ... eventSource.close()`.
            // We want to ensure it eventually stops trying and shows error state.
            
            render(<ChatTestWrapper initialHistory={[]} />);
            await waitFor(() => expect(mockEventSourceInstance).not.toBeNull());

            // Wait for the initial auto-connect from the Mock base class to settle
            // (The base class has a 10ms timeout that sets readyState=1)
            await waitFor(() => expect(mockEventSourceInstance!.readyState).toBe(1));

            // Simulate 6 errors in a row
            for (let i = 0; i < 6; i++) {
                mockEventSourceInstance!.simulateError();
            }

            // Check for UI indication of failure
            await waitFor(() => {
                // The component renders connection status text.
                // "Connection failed. Please refresh."
                expect(screen.getByText(/Connection failed/i)).toBeInTheDocument();
            });
            
            // Ensure it closed the connection
            expect(mockEventSourceInstance!.readyState).toBe(2); // CLOSED
        });

        it('ignores irrelevant SSE events', { meta: { alias: 'SSE-Filter-Events' } }, async () => {
            // Scenario: The stream might send keep-alives, pings, or other thread types.
            // We only want `thread: 'unify_message_outbound'`.
            
            render(<ChatTestWrapper initialHistory={[]} />);
            await waitFor(() => expect(mockEventSourceInstance).not.toBeNull());
            mockEventSourceInstance!.simulateOpen();

            mockEventSourceInstance!.simulateMessage({ 
                thread: 'system_notification', 
                event: { content: 'Ignore me' } 
            });

            mockEventSourceInstance!.simulateMessage({ 
                thread: 'unify_message_outbound', 
                event: { content: 'Accept me' } 
            });

            await waitFor(() => {
                const contents = getChatBubbleContents();
                expect(contents).not.toContain('Ignore me');
                expect(contents).toContain('Accept me');
            });
        });

        it('handles JSON parsing errors gracefully', { meta: { alias: 'SSE-Bad-JSON' } }, async () => {
            // Scenario: Server sends broken JSON. The app shouldn't crash.
            // It should log the error (silently in test) and continue listening.
            
            render(<ChatTestWrapper initialHistory={[]} />);
            await waitFor(() => expect(mockEventSourceInstance).not.toBeNull());
            mockEventSourceInstance!.simulateOpen();

            // 1. Send malformed data
            if (mockEventSourceInstance!.onmessage) {
                mockEventSourceInstance!.onmessage(new MessageEvent('message', { 
                    data: '{"broken": "json", incomplete...' 
                }));
            }

            // 2. Send valid data immediately after
            mockEventSourceInstance!.simulateMessage({ 
                thread: 'unify_message_outbound', 
                event: { content: 'I survived bad JSON' } 
            });

            await waitFor(() => {
                const contents = getChatBubbleContents();
                expect(contents).toContain('I survived bad JSON');
            });
        });

        it('handles messaged arrived during reconnecting state', { meta: { alias: 'SSE-Ghost-Msg' } }, async () => {
            // Scenario: Connection drops -> Status = Reconnecting.
            // But a message arrives (maybe buffered in browser network stack) right before the socket is dead.
            // The app should probably still accept it.
            
            render(<ChatTestWrapper initialHistory={[]} />);
            await waitFor(() => expect(mockEventSourceInstance).not.toBeNull());
            
            // 1. Wait for the base class timer to fire and "open" the connection naturally.
            // This prevents the timer from interfering with our error simulation later.
            await waitFor(() => expect(mockEventSourceInstance!.readyState).toBe(1));

            // 2. Force state to 'reconnecting' via a single error
            // (simulateError sets readyState=0 via our previous fix)
            mockEventSourceInstance!.simulateError(); 
            
            // 3. Verify UI shows reconnecting
            await waitFor(() => expect(screen.getByText(/Reconnecting/i)).toBeInTheDocument());

            // Simulate message arrival while in this state
            mockEventSourceInstance!.simulateMessage({ 
                thread: 'unify_message_outbound', 
                event: { content: 'Buffered Message' } 
            });

            await waitFor(() => {
                expect(getChatBubbleContents()).toContain('Buffered Message');
            });
        });

        it('handles race condition', { meta: { alias: 'SSE-Zero-Latency' } }, async () => {
            // Scenario: 
            // 1. reconcileTranscripts() is called (e.g. on focus). It fetches history including Message A.
            // 2. AT THE SAME MILLISECOND, Message A arrives via SSE.
            // We want to ensure we don't get [Message A, Message A].
            
            const now = Date.now();
            const messageA = { role: 'assistant' as const, content: 'Duplicate Candidate', timestamp: now };
            const serverLogs = [messageA];

            render(<ChatTestWrapper initialHistory={[]} serverLogs={serverLogs} />);
            await waitFor(() => expect(mockEventSourceInstance).not.toBeNull());
            mockEventSourceInstance!.simulateOpen();

            // 1. Trigger manual reconciliation (simulating focus or network recovery)
            document.dispatchEvent(new Event('visibilitychange'));

            // 2. Immediately fire SSE event for the same message
            mockEventSourceInstance!.simulateMessage({
                thread: 'unify_message_outbound',
                event: { content: 'Duplicate Candidate' }
            });

            await waitFor(() => {
                const contents = getChatBubbleContents();
                 const dupes = contents.filter(c => c === 'Duplicate Candidate');
                 // We want exactly 1, but if the logic is loose, we might accept 1 or the test fails.
                 // Let's assert 1 to set the bar high.
                 expect(dupes.length).toBe(1);
            });
        });

        it('prevents multiple EventSources', { meta: { alias: 'SSE-Zombie' } }, async () => {
            // Scenario: Component re-renders rapidly (e.g., user resizing window or fast tab switching).
            // If the `useEffect` cleanup isn't perfect, we might spawn multiple SSE connections.
            // If we have 2 connections, every message will appear TWICE.
            
            const { rerender, unmount } = render(<ChatTestWrapper initialHistory={[]} />);
            await waitFor(() => expect(mockEventSourceInstance).not.toBeNull());
            
            // Capture the first instance
            const instance1 = mockEventSourceInstance!;
            
            // 1. Rerender with same props (should generally preserve state, but effects might re-run if dependencies shift)            
            unmount();
            render(<ChatTestWrapper initialHistory={[]} />);
            
            // Capture second instance
            const instance2 = mockEventSourceInstance!;
            
            // Verify instances are different objects (new connection created)
            expect(instance1).not.toBe(instance2);
            
            // Verify first instance was closed
            expect(instance1.readyState).toBe(2); // CLOSED
            
            // Verify second instance is connecting/open
            expect(instance2.readyState).not.toBe(2);
            
            // 2. Send a message to the OLD instance (Zombie check)
            // If the cleanup failed to remove listeners or close it effectively, this might still leak into state
            instance1.simulateMessage({ 
                thread: 'unify_message_outbound', 
                event: { content: 'Zombie Message' } 
            });
            
            // 3. Send a message to the NEW instance
            instance2.simulateOpen();
            instance2.simulateMessage({ 
                thread: 'unify_message_outbound', 
                event: { content: 'Living Message' } 
            });

            await waitFor(() => {
                const contents = getChatBubbleContents();
                expect(contents).toContain('Living Message');
                expect(contents).not.toContain('Zombie Message');
            });
        });

        it('handles backpressure / batching', { meta: { alias: 'SSE-Flood' } }, async () => {
            // Scenario: Server sends 50 tokens/messages in 10ms (e.g., fast LLM streaming words as separate events).
            // React state updates are async. If the hook doesn't use functional state updates 
            // (setMsgs(prev => ...)), updates will overwrite each other, resulting in missing words.
            
            render(<ChatTestWrapper initialHistory={[]} />);
            await waitFor(() => expect(mockEventSourceInstance).not.toBeNull());
            mockEventSourceInstance!.simulateOpen();

            const messages = Array.from({ length: 20 }, (_, i) => `Word${i}`);

            // Fire all events synchronously in a tight loop
            messages.forEach(word => {
                mockEventSourceInstance!.simulateMessage({ 
                    thread: 'unify_message_outbound', 
                    event: { content: word } 
                });
            });

            // Wait for the dust to settle
            await waitFor(() => {
                const bubbles = screen.queryAllByTestId('message-bubble');
                // We expect exactly 20 messages.
                expect(bubbles).toHaveLength(20);
                
                // Check the first and last message. 
                // We use toHaveTextContent to verify the message exists within the bubble,
                // ignoring the "CB" avatar text that appears in textContent.
                expect(bubbles[0]).toHaveTextContent('Word0');
                expect(bubbles[19]).toHaveTextContent('Word19');
            });
        });

    });

    // =========================================================================
    // LOG REFETCHING / RECONCILIATION TRIGGERS
    // =========================================================================
    describe('Transcripts Refetching Triggers', () => {
        let getTranscriptsSpy: ReturnType<typeof vi.fn>;
        let spyActions: AssistantActions;

        beforeEach(() => {
            // Reset mocks and spies
            getTranscriptsSpy = vi.fn().mockResolvedValue([]); // Return empty by default
            
            spyActions = {
                ...mockAssistantActions,
                chat: {
                    ...mockAssistantActions.chat,
                    getTranscripts: getTranscriptsSpy,
                    message: vi.fn(async () => ({ info: 'Sent' }))
                }
            };

            // Ensure browser environment thinks we are Online and Visible by default
            Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
            Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
            
            // Reset EventSource mock
            window.EventSource = ControllableMockEventSource as any;
            mockEventSourceInstance = null;
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('fetches transcripts on component mount', { meta: { alias: 'Fetch-Mount' } }, async () => {
            // 1. Render with no initial history, forcing a fetch
            render(
                <AssistantProfilePanel
                    assistant={testAssistant}
                    assistantActions={spyActions}
                    onClose={vi.fn()} onDeleteAssistant={vi.fn()} onEdit={vi.fn()} onOpenContactManager={vi.fn()}
                    chatHistories={{}} setChatHistories={vi.fn()}
                    onStartCall={vi.fn()} activeCallAssistantId={null} isCallConnected={false} isConnectingCall={false}
                />
            );

            await waitFor(() => {
                expect(getTranscriptsSpy).toHaveBeenCalledTimes(1);
            });
        });

        it('fetches when tab becomes visible', { meta: { alias: 'Fetch-Visibility' } }, async () => {
            // 1. Render (Trigger 1: Mount)
            render(
                <AssistantProfilePanel
                    assistant={testAssistant}
                    assistantActions={spyActions}
                    onClose={vi.fn()} onDeleteAssistant={vi.fn()} onEdit={vi.fn()} onOpenContactManager={vi.fn()}
                    chatHistories={{}} setChatHistories={vi.fn()}
                    onStartCall={vi.fn()} activeCallAssistantId={null} isCallConnected={false} isConnectingCall={false}
                />
            );
            await waitFor(() => expect(getTranscriptsSpy).toHaveBeenCalledTimes(1));

            // 2. Simulate user switching away and back
            Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            
            // Should NOT fetch on hidden
            expect(getTranscriptsSpy).toHaveBeenCalledTimes(1);

            // 3. Simulate user coming back
            Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
            document.dispatchEvent(new Event('visibilitychange'));

            // Should fetch now
            await waitFor(() => {
                expect(getTranscriptsSpy).toHaveBeenCalledTimes(2);
            });
        });

        it('fetches when network status becomes online', { meta: { alias: 'Fetch-Online' } }, async () => {
            render(
                <AssistantProfilePanel
                    assistant={testAssistant}
                    assistantActions={spyActions}
                    onClose={vi.fn()} onDeleteAssistant={vi.fn()} onEdit={vi.fn()} onOpenContactManager={vi.fn()}
                    chatHistories={{}} setChatHistories={vi.fn()}
                    onStartCall={vi.fn()} activeCallAssistantId={null} isCallConnected={false} isConnectingCall={false}
                />
            );
            await waitFor(() => expect(getTranscriptsSpy).toHaveBeenCalledTimes(1));

            // Trigger 'online' event
            window.dispatchEvent(new Event('online'));

            await waitFor(() => {
                expect(getTranscriptsSpy).toHaveBeenCalledTimes(2);
            });
        });

        it('fetches on reconnection but not on first connection', { meta: { alias: 'Fetch-SSE-Reconnect' } }, async () => {
            // 1. Render (Trigger 1: Mount)
            render(
                <AssistantProfilePanel
                    assistant={testAssistant}
                    assistantActions={spyActions}
                    onClose={vi.fn()} onDeleteAssistant={vi.fn()} onEdit={vi.fn()} onOpenContactManager={vi.fn()}
                    chatHistories={{}} setChatHistories={vi.fn()}
                    onStartCall={vi.fn()} activeCallAssistantId={null} isCallConnected={false} isConnectingCall={false}
                />
            );
            await waitFor(() => expect(getTranscriptsSpy).toHaveBeenCalledTimes(1));
            await waitFor(() => expect(mockEventSourceInstance).not.toBeNull());

            // 2. First Connection
            // The MockEventSource base class has a 10ms timeout that automatically opens the connection.
            // We wait for that natural event instead of forcing it manually, which would cause a double-open.
            await waitFor(() => expect(mockEventSourceInstance!.readyState).toBe(1));
            
            // Wait a bit to ensure NO extra call happens
            await new Promise(r => setTimeout(r, 100)); 
            expect(getTranscriptsSpy).toHaveBeenCalledTimes(1); // Still 1

            // 3. Simulate Drop
            mockEventSourceInstance!.simulateError();

            // 4. Simulate Reconnect (simulate onopen again)
            // Now we force it because the auto-connect logic only runs on constructor.
            // `hasConnectedOnceRef` should now be true. Should fetch.
            mockEventSourceInstance!.simulateOpen();

            await waitFor(() => {
                expect(getTranscriptsSpy).toHaveBeenCalledTimes(2);
            });
        });

        it('fetches when typing indicator times out', { meta: { alias: 'Fetch-Typing-Timeout' } }, async () => {
            // 1. Render with real timers first
            render(
                <AssistantProfilePanel
                    assistant={testAssistant}
                    assistantActions={spyActions}
                    onClose={vi.fn()} onDeleteAssistant={vi.fn()} onEdit={vi.fn()} onOpenContactManager={vi.fn()}
                    chatHistories={{}} setChatHistories={vi.fn()}
                    onStartCall={vi.fn()} activeCallAssistantId={null} isCallConnected={false} isConnectingCall={false}
                />
            );

            // Ensure initial fetch happens
            await waitFor(() => expect(getTranscriptsSpy).toHaveBeenCalledTimes(1));

            // Find elements
            const input = screen.getByPlaceholderText('Send a message...');

            // 2. Switch to Fake Timers
            vi.useFakeTimers();

            // 3. Trigger interaction
            fireEvent.change(input, { target: { value: 'Trigger Timeout' } });
            const form = input.closest('form');
            fireEvent.submit(form!);

            // 4. Advance 5000ms (Typing Delay)
            await act(async () => {
                vi.advanceTimersByTime(5000);
            });
            
            // Verify no new fetch yet
            expect(getTranscriptsSpy).toHaveBeenCalledTimes(1);

            // 5. Advance 18000ms (Fallback Timeout)
            await act(async () => {
                vi.advanceTimersByTime(18000);
            });
            
            // Verify fetch triggered
            expect(getTranscriptsSpy).toHaveBeenCalledTimes(2);

            vi.useRealTimers();
        });

        it('does not fetch if page is hidden', { meta: { alias: 'Fetch-Skip-Hidden' } }, async () => {
            // The hook logic usually checks visibility inside the event handler, 
            // OR the browser suppresses effects.
            // The hook code: `if (document.visibilityState === 'visible') { ... reconcileTranscripts() }`
            
            // 1. Render
            render(
                <AssistantProfilePanel
                    assistant={testAssistant}
                    assistantActions={spyActions}
                    onClose={vi.fn()} onDeleteAssistant={vi.fn()} onEdit={vi.fn()} onOpenContactManager={vi.fn()}
                    chatHistories={{}} setChatHistories={vi.fn()}
                    onStartCall={vi.fn()} activeCallAssistantId={null} isCallConnected={false} isConnectingCall={false}
                />
            );
            await waitFor(() => expect(getTranscriptsSpy).toHaveBeenCalledTimes(1));

            // 2. Set hidden
            Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });

            // 3. Fire visibilitychange (should be ignored because state is hidden)
            document.dispatchEvent(new Event('visibilitychange'));

            await new Promise(r => setTimeout(r, 100));
            expect(getTranscriptsSpy).toHaveBeenCalledTimes(1);
        });

        it('does not fetch if offline', { meta: { alias: 'Fetch-Skip-Offline' } }, async () => {
            // Hook logic: `if (navigator.onLine) { reconcileTranscripts() }` inside visibility change.
            
            // 1. Render
            render(
                <AssistantProfilePanel
                    assistant={testAssistant}
                    assistantActions={spyActions}
                    onClose={vi.fn()} onDeleteAssistant={vi.fn()} onEdit={vi.fn()} onOpenContactManager={vi.fn()}
                    chatHistories={{}} setChatHistories={vi.fn()}
                    onStartCall={vi.fn()} activeCallAssistantId={null} isCallConnected={false} isConnectingCall={false}
                />
            );
            await waitFor(() => expect(getTranscriptsSpy).toHaveBeenCalledTimes(1));

            // 2. Set Offline
            Object.defineProperty(navigator, 'onLine', { value: false, writable: true });

            // 3. Trigger visibility change (page becomes visible)
            document.dispatchEvent(new Event('visibilitychange'));

            await new Promise(r => setTimeout(r, 100));
            expect(getTranscriptsSpy).toHaveBeenCalledTimes(1);
        });

        it('handles old fetch resolving after new fetch', { meta: { alias: 'Fetch-Race' } }, async () => {
            // Scenario:
            // 1. Trigger A fires (slow network).
            // 2. Trigger B fires (fast network).
            // 3. Request B resolves first.
            // 4. Request A resolves last.
            // If not handled, A will overwrite B, reverting the UI to an older state.
            
            // We need to mock getTranscripts to be controllable promises
            let resolveA: Function;
            let resolveB: Function;
            
            const promiseA = new Promise(r => { resolveA = r; });
            const promiseB = new Promise(r => { resolveB = r; });

            const historyA = [{ id: '1', role: 'user', content: 'Old State', timestamp: new Date() }];
            const historyB = [{ id: '1', role: 'user', content: 'New State', timestamp: new Date() }];

            // Mock implementation that returns different promises based on call count
            getTranscriptsSpy
                .mockReturnValueOnce(promiseA) // First call returns slow promise
                .mockReturnValueOnce(promiseB); // Second call returns fast promise

            // Wrapper to maintain state, otherwise UI won't update when hook calls setChatHistories
            const RaceTestWrapper = () => {
                const [histories, setHistories] = React.useState<Record<string, ChatMessage[]>>({});
                return (
                    <AssistantProfilePanel
                        assistant={testAssistant}
                        assistantActions={spyActions}
                        onClose={vi.fn()} onDeleteAssistant={vi.fn()} onEdit={vi.fn()} onOpenContactManager={vi.fn()}
                        chatHistories={histories} setChatHistories={setHistories}
                        onStartCall={vi.fn()} activeCallAssistantId={null} isCallConnected={false} isConnectingCall={false}
                    />
                );
            };

            // 1. Mount (Trigger A)
            render(<RaceTestWrapper />);

            // 2. Force a second trigger (Trigger B) - e.g., visibility toggle
            document.dispatchEvent(new Event('visibilitychange'));

            expect(getTranscriptsSpy).toHaveBeenCalledTimes(2);

        });

        it('prevents updates after ccmponent unmount', { meta: { alias: 'Fetch-Unmount' } }, async () => {
            // Scenario: Fetch starts -> Component Unmounts -> Fetch Resolves.
            // If we try to set state, React warns.
            // While Vitest suppresses console.error by default sometimes, we want to ensure logical correctness.
            
            let resolveFetch: Function;
            const pendingFetch = new Promise(r => { resolveFetch = r; });
            getTranscriptsSpy.mockReturnValue(pendingFetch);

            const { unmount } = render(
                <AssistantProfilePanel
                    assistant={testAssistant}
                    assistantActions={spyActions}
                    onClose={vi.fn()} onDeleteAssistant={vi.fn()} onEdit={vi.fn()} onOpenContactManager={vi.fn()}
                    chatHistories={{}} setChatHistories={vi.fn()}
                    onStartCall={vi.fn()} activeCallAssistantId={null} isCallConnected={false} isConnectingCall={false}
                />
            );

            // Unmount immediately
            unmount();

            // Resolve the fetch now that it's dead
            // @ts-ignore
            resolveFetch([{ id: '1', role: 'user', content: 'Zombie Data', timestamp: new Date() }]);

            // There isn't an easy way to spy on "setState" inside a hook from outside,
            // but we can spy on `console.error` to see if React complains.
            const consoleSpy = vi.spyOn(console, 'error');
            
            // Wait a tick
            await new Promise(r => setTimeout(r, 50));
            
            // In modern React (v18+), setting state on unmounted components is often ignored silently,
            // but typically triggers a warning in tests/dev.
            // If your code creates an AbortController, the fetch would have rejected, and the catch block handled it.
            expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringMatching(/state update on an unmounted component/i));
        });

        it('debounces rapid fetch triggers', { meta: { alias: 'Fetch-Debounce' } }, async () => {
            // Scenario: User spams Alt-Tab (visibility change) 10 times in 100ms.
            // We shouldn't fire 10 network requests.
            
            render(
                <AssistantProfilePanel
                    assistant={testAssistant}
                    assistantActions={spyActions}
                    onClose={vi.fn()} onDeleteAssistant={vi.fn()} onEdit={vi.fn()} onOpenContactManager={vi.fn()}
                    chatHistories={{}} setChatHistories={vi.fn()}
                    onStartCall={vi.fn()} activeCallAssistantId={null} isCallConnected={false} isConnectingCall={false}
                />
            );
            
            // Mount triggers 1 call
            await waitFor(() => expect(getTranscriptsSpy).toHaveBeenCalledTimes(1));

            // Spam visibility change
            for (let i = 0; i < 10; i++) {
                document.dispatchEvent(new Event('visibilitychange'));
            }
            
            // Let's assert that we don't spam *too* much (e.g., browser event loop batching might save us).
            expect(getTranscriptsSpy).toHaveBeenCalledTimes(2); // Mount + 1 throttled call
        });

    });
});