import * as React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@/tests/render';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';
import { AssistantProfilePanel } from '@/components/Pages/Assistants/Assistants/Profile/AssistantProfile';
import { createMockAssistant } from './mocks/data';
import { mockAssistantActions } from './mocks/actions';
import { AssistantActions, Assistant } from '@/types/assistants/assistant';
import { ChatMessage } from '@/types/assistants/chat';
import { ASSISTANT_CHAT_LOADED_MESSAGES_COUNT } from '@/constants/assistants/settings';

// --- Mock EventSource Infrastructure ---
const originalEventSource = window.EventSource;
let mockEventSourceInstance: ControllableMockEventSource | null = null;
let eventSourceInstances: ControllableMockEventSource[] = [];

class ControllableMockEventSource {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 2;

    onopen: (() => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((error: any) => void) | null = null;
    readyState = 0;
    url: string;
    closeSpy = vi.fn();

    constructor(url: string) {
        this.url = url;
        this.readyState = 0; // Start connecting
        mockEventSourceInstance = this;
        eventSourceInstances.push(this);
    }

    close() {
        this.readyState = 2;
        this.closeSpy();
    }

    // Test Helpers
    simulateOpen() {
        this.readyState = 1;
        if (this.onopen) this.onopen();
    }

    simulateError() {
        this.readyState = 0; 
        if (this.onerror) this.onerror(new Event('error'));
    }

    simulateMessage(data: object | string) {
        if (this.onmessage && this.readyState === 1) {
            const payload = typeof data === 'string' ? data : JSON.stringify(data);
            this.onmessage(new MessageEvent('message', { data: payload }));
        }
    }
}

// --- Helper: Real Fetch Implementation for Tests ---
// This mimics the server action src/lib/assistants/chat.ts to hit the MSW handlers
const fetchTranscriptsViaApi = async (assistantContext: string, beforeMessageId?: number): Promise<ChatMessage[] | any> => {
    const limit = ASSISTANT_CHAT_LOADED_MESSAGES_COUNT;
    let filter_expr = `medium == "unify_chat" and (sender_id == 1 or sender_id == 0)`;
    if (beforeMessageId !== undefined) {
        filter_expr += ` and message_id < ${beforeMessageId}`;
    }

    const params = new URLSearchParams({
        project: 'Assistants',
        context: `${assistantContext}/Transcripts`,
        limit: limit.toString(),
        filter_expr: filter_expr
    });

    try {
        const response = await fetch(`/api/logs?${params.toString()}`);
        if (!response.ok) {
             const err = await response.json().catch(() => ({ detail: 'Fetch Error' }));
             return { detail: err.detail || 'Error' };
        }
        const data = await response.json();
        
        // Map logs to ChatMessage (logic copied from src/lib/assistants/chat.ts)
        return (data.logs || []).map((log: any) => ({
            id: String(log.id),
            role: log.entries.sender_id === 1 ? 'user' : 'assistant',
            content: log.entries.content,
            timestamp: new Date(log.timestamp),
            message_id: log.entries.message_id
        }));
    } catch (e) {
        return { detail: 'Network Error' };
    }
};


// --- Test Wrapper ---
const ChatTestWrapper = ({ 
    initialHistory, 
    assistantActionsOverride = {},
    assistantOverride = null,
    panelKey
}: { 
    initialHistory?: ChatMessage[],
    assistantActionsOverride?: Partial<AssistantActions>,
    assistantOverride?: Assistant | null,
    panelKey?: string
}) => {
    const defaultAssistant = React.useMemo(() => createMockAssistant({ 
        first_name: 'Stress', 
        surname: 'Test', 
        agent_id: 'stress-test-id' 
    }), []);

    const activeAssistant = assistantOverride || defaultAssistant;

    const actions = React.useMemo(() => ({
        ...mockAssistantActions,
        ...assistantActionsOverride,
        chat: {
            ...mockAssistantActions.chat,
            ...(assistantActionsOverride.chat || {}),
        }
    }), [assistantActionsOverride]);

    const initialState = React.useMemo(() => {
        if (initialHistory === undefined) return {};
        return {
            [activeAssistant.agent_id]: initialHistory
        };
    }, [initialHistory, activeAssistant.agent_id]);

    const [histories, setHistories] = React.useState<Record<string, ChatMessage[]>>(initialState);

    return (
        <AssistantProfilePanel
            key={panelKey}
            assistant={activeAssistant}
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

describe('Assistant Profile Chat', () => {
    let fetchSpy: MockInstance;

    beforeEach(() => {
        window.EventSource = ControllableMockEventSource as any;
        mockEventSourceInstance = null;
        eventSourceInstances = [];
        
        // Setup Fresh Spy (but allow passthrough for our helper fetch)
        fetchSpy = vi.spyOn(window, 'fetch');
    });

    afterEach(() => {
        window.EventSource = originalEventSource;
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    const getChatBubbles = () => screen.queryAllByTestId('message-bubble').map(el => el.textContent);

    // =========================================================================
    // SECTION A: GENERAL FEATURES AND UX
    // =========================================================================
    describe('A - General Features and UX', () => {
        it('optimistically adds user message and removes it on failure', { 
            meta: { 
                alias: 'UX-Optimistic-Fail',
                scenario: 'User sends a message but the API call fails after a delay',
                behavior: 'Message appears immediately, then disappears, input is restored, and error toast shows'
            } 
        }, async () => {
            const failActions = {
                chat: {
                    getTranscripts: vi.fn(async () => []),
                    updateTranscripts: vi.fn(async () => ({})),
                    message: vi.fn(async () => {
                        await new Promise(r => setTimeout(r, 50));
                        throw new Error('Simulated Network Fail');
                    })
                }
            };

            render(<ChatTestWrapper initialHistory={[]} assistantActionsOverride={failActions} />);
            act(() => mockEventSourceInstance!.simulateOpen());

            const user = userEvent.setup();
            const input = await screen.findByPlaceholderText('Send a message...');
            await waitFor(() => expect(input).not.toBeDisabled());

            await user.type(input, 'This will fail');
            await user.keyboard('{Enter}');

            // Optimistic Update
            await waitFor(() => {
                expect(screen.getByText('This will fail')).toBeInTheDocument();
                expect(input).toHaveValue('');
            });

            // Rollback
            await waitFor(() => {
                const bubbles = screen.queryAllByTestId('message-bubble');
                const bubbleContents = bubbles.map(b => b.textContent);
                expect(bubbleContents).not.toContain('This will fail');
                expect(input).toHaveValue('This will fail');
                expect(screen.getByText('Failed to send message.')).toBeInTheDocument();
            });
        });

        it('shows typing indicator after send and clears it upon receiving reply', { 
            meta: { 
                alias: 'UX-Typing-Flow',
                scenario: 'User sends message, waits for reply',
                behavior: 'Typing indicator appears after delay, then vanishes when real reply arrives'
            } 
        }, async () => {
            vi.useFakeTimers();
            render(<ChatTestWrapper initialHistory={[]} />);
            act(() => mockEventSourceInstance!.simulateOpen());

            const input = screen.getByRole('textbox');
            
            // 1. Manually trigger send synchronously
            act(() => {
                fireEvent.change(input, { target: { value: 'Trigger Typing' } });
                fireEvent.submit(input.closest('form')!);
            });

            // 2. Advance time 5s to trigger typing indicator
            act(() => {
                vi.advanceTimersByTime(5000);
            });

            expect(screen.getByText('Typing')).toBeInTheDocument();

            // 3. Receive Reply
            act(() => {
                mockEventSourceInstance!.simulateMessage({
                    thread: 'unify_message_outbound',
                    id: 'msg-reply',
                    event: { content: 'Here is your reply' }
                });
            });

            expect(screen.queryByText('Typing')).not.toBeInTheDocument();
            expect(screen.getByText('Here is your reply')).toBeInTheDocument();
        });

        it('clears typing indicator automatically after timeout if no reply arrives', { 
            meta: { 
                alias: 'UX-Typing-Timeout',
                scenario: 'User sends message, server never replies',
                behavior: 'Typing indicator disappears automatically after timeout threshold'
            } 
        }, async () => {
            vi.useFakeTimers();
            render(<ChatTestWrapper initialHistory={[]} />);
            act(() => mockEventSourceInstance!.simulateOpen());

            const input = screen.getByRole('textbox');
            act(() => {
                fireEvent.change(input, { target: { value: 'Trigger Timeout' } });
                fireEvent.submit(input.closest('form')!);
            });

            // Advance 5s (Typing visible)
            act(() => {
                vi.advanceTimersByTime(5000);
            });
            expect(screen.getByText('Typing')).toBeInTheDocument();

            // Advance 20s (Timeout exceeded)
            act(() => {
                vi.advanceTimersByTime(20000);
            });
            expect(screen.queryByText('Typing')).not.toBeInTheDocument();
        });

        it('handles interleaving user send and server receive events', { 
            meta: { 
                alias: 'UX-Race-Concurrent',
                scenario: 'User hits enter at exact moment server message arrives',
                behavior: 'Both messages render correctly without crashing or overwriting'
            } 
        }, async () => {
            render(<ChatTestWrapper initialHistory={[]} />);
            act(() => mockEventSourceInstance!.simulateOpen());
            const user = userEvent.setup();
            
            const input = await screen.findByPlaceholderText('Send a message...');
            await user.type(input, 'User Concurrent');

            await act(async () => {
                const sendPromise = user.keyboard('{Enter}');
                mockEventSourceInstance!.simulateMessage({
                    thread: 'unify_message_outbound',
                    id: 'msg-concurrent',
                    publishTime: new Date().toISOString(),
                    event: { content: 'Server Concurrent' }
                });
                await sendPromise;
            });

            await waitFor(() => {
                const bubbles = getChatBubbles();
                expect(bubbles).toContain('User Concurrent');
                expect(bubbles).toContain('Server Concurrent');
                expect(bubbles).toHaveLength(2);
            });
        });
    });

    // =========================================================================
    // SECTION B: SSE CONNECTION
    // =========================================================================
    describe('B - SSE Connection', () => {
        it('waits for history to load before establishing SSE connection', { 
            meta: { 
                alias: 'SSE-Wait-History', 
                scenario: 'Component mounts and starts fetching history',
                behavior: 'SSE connection is deferred until history fetch completes'
            } 
        }, async () => {
            let resolveFetch: (value: ChatMessage[]) => void;
            const fetchPromise = new Promise<ChatMessage[]>((resolve) => {
                resolveFetch = resolve;
            });

            const slowFetchActions = {
                chat: {
                    getTranscripts: vi.fn(() => fetchPromise),
                    updateTranscripts: vi.fn(async () => ({})),
                    message: vi.fn(async () => ({}))
                }
            };

            render(<ChatTestWrapper initialHistory={undefined} assistantActionsOverride={slowFetchActions} />);

            // 1. Assert Loading State
            expect(screen.getByPlaceholderText('Loading messages...')).toBeInTheDocument();
            
            // 2. Assert No EventSource created yet
            expect(eventSourceInstances.length).toBe(0);

            // 3. Finish Loading
            await act(async () => {
                // @ts-ignore
                resolveFetch([]);
            });

            // 4. Assert Loaded State
            await waitFor(() => {
                expect(screen.getByPlaceholderText('Send a message...')).toBeInTheDocument();
            });

            // 5. Assert EventSource created
            await waitFor(() => {
                expect(eventSourceInstances.length).toBe(1);
            });
        });

        it('handles rapid connection flapping without duplicating visual state', { 
            meta: { 
                alias: 'SSE-Flapping',
                scenario: 'Connection opens, receives message, drops, and reconnects receiving same message',
                behavior: 'Message is rendered only once (stable state)'
            } 
        }, async () => {
            render(<ChatTestWrapper initialHistory={[]} />);
            act(() => mockEventSourceInstance!.simulateOpen());
            
            act(() => {
                mockEventSourceInstance!.simulateMessage({
                    thread: 'unify_message_outbound',
                    id: 'msg-stable',
                    publishTime: new Date().toISOString(),
                    event: { content: 'Stable' }
                });
            });

            // Drop and Reconnect
            act(() => mockEventSourceInstance!.simulateError());
            act(() => mockEventSourceInstance!.simulateOpen());

            // Replay message
            act(() => {
                mockEventSourceInstance!.simulateMessage({
                    thread: 'unify_message_outbound',
                    id: 'msg-stable',
                    publishTime: new Date().toISOString(),
                    event: { content: 'Stable' }
                });
            });

            await waitFor(() => {
                const bubbles = getChatBubbles();
                expect(bubbles).toHaveLength(1);
                expect(bubbles[0]).toBe('Stable');
            });
        });

        it('filters out irrelevant pubsub events', { 
            meta: { 
                alias: 'SSE-Filter-Events',
                scenario: 'Stream receives system logs or unrelated threads',
                behavior: 'Only messages with correct thread ID are rendered'
            } 
        }, async () => {
            render(<ChatTestWrapper initialHistory={[]} />);
            act(() => mockEventSourceInstance!.simulateOpen());

            act(() => {
                mockEventSourceInstance!.simulateMessage({
                    thread: 'system_logs',
                    data: { content: 'Ignore me' }
                });
            });

            act(() => {
                mockEventSourceInstance!.simulateMessage({
                    thread: 'unify_message_outbound',
                    id: 'msg-1',
                    publishTime: new Date().toISOString(),
                    event: { content: 'See me' }
                });
            });

            await waitFor(() => {
                const bubbles = getChatBubbles();
                expect(bubbles).toEqual(['See me']);
            });
        });

        it('processes high volume message burst without dropping frames', { 
            meta: { 
                alias: 'SSE-Flood',
                scenario: `${ASSISTANT_CHAT_LOADED_MESSAGES_COUNT} messages arrive in a single batch update`,
                behavior: `All ${ASSISTANT_CHAT_LOADED_MESSAGES_COUNT} messages are rendered in order`
            } 
        }, async () => {
            render(<ChatTestWrapper initialHistory={[]} />);
            act(() => mockEventSourceInstance!.simulateOpen());

            const messageCount = ASSISTANT_CHAT_LOADED_MESSAGES_COUNT;
            const messages = Array.from({ length: messageCount }, (_, i) => ({
                thread: 'unify_message_outbound',
                id: `msg-${i}`,
                publishTime: new Date(Date.now() + i * 100).toISOString(),
                event: { content: `Flood ${i}` }
            }));

            act(() => {
                messages.forEach(msg => mockEventSourceInstance!.simulateMessage(msg));
            });

            await waitFor(() => {
                const bubbles = getChatBubbles();
                expect(bubbles).toHaveLength(messageCount);
                expect(bubbles[0]).toBe('Flood 0');
                expect(bubbles[49]).toBe('Flood 49');
            });
        });

        it('closes previous SSE connection when switching assistants', { 
            meta: { 
                alias: 'SSE-Lifecycle-Switch',
                scenario: 'User navigates from Assistant A to Assistant B',
                behavior: 'Connection A is closed before Connection B is opened'
            } 
        }, async () => {
            const assistantA = createMockAssistant({ agent_id: 'assistant-a' });
            const assistantB = createMockAssistant({ agent_id: 'assistant-b' });

            const { rerender } = render(<ChatTestWrapper initialHistory={[]} assistantOverride={assistantA} />);
            
            await waitFor(() => expect(eventSourceInstances.length).toBe(1));
            const connectionA = eventSourceInstances[0];
            expect(connectionA.url).toContain('/assistant-a/events');
            expect(connectionA.readyState).not.toBe(2); 

            rerender(<ChatTestWrapper initialHistory={[]} assistantOverride={assistantB} />);

            await waitFor(() => expect(eventSourceInstances.length).toBe(2));
            const connectionB = eventSourceInstances[1];
            
            expect(connectionA.closeSpy).toHaveBeenCalled(); 
            expect(connectionB.url).toContain('/assistant-b/events');
        });

        it('closes connection on component unmount', { 
            meta: { 
                alias: 'SSE-Lifecycle-Unmount',
                scenario: 'Component unmounts from DOM',
                behavior: 'EventSource connection is closed'
            } 
        }, async () => {
            const { unmount } = render(<ChatTestWrapper initialHistory={[]} />);
            await waitFor(() => expect(eventSourceInstances.length).toBe(1));
            const connection = eventSourceInstances[0];
            unmount();
            expect(connection.closeSpy).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // SECTION C: ACKNOWLEDGMENT
    // =========================================================================
    describe('C - Acknowledgment', () => {
        it('sends ACK request when message contains __ackId and is rendered', { 
            meta: { 
                alias: 'ACK-Basic',
                scenario: 'Message arrives with ACK token',
                behavior: 'ACK API is called with the token'
            } 
        }, async () => {
            render(<ChatTestWrapper initialHistory={[]} />);
            act(() => mockEventSourceInstance!.simulateOpen());

            const ackId = 'ack-token-xyz';
            
            act(() => {
                mockEventSourceInstance!.simulateMessage({
                    thread: 'unify_message_outbound',
                    id: 'msg-ack-test',
                    publishTime: new Date().toISOString(),
                    __ackId: ackId,
                    event: { content: 'Ack Me' }
                });
            });

            await waitFor(() => {
                expect(screen.getByText('Ack Me')).toBeInTheDocument();
            });

            await waitFor(() => {
                expect(fetchSpy).toHaveBeenCalledWith(
                    expect.stringContaining('/events/ack'),
                    expect.objectContaining({
                        method: 'POST',
                        body: JSON.stringify({ ackId: ackId })
                    })
                );
            });
        });

        it('triggers individual ACKs for multiple messages arriving simultaneously', { 
            meta: { 
                alias: 'ACK-Burst',
                scenario: 'Multiple messages with ACK tokens arrive at once',
                behavior: 'API is called for each individual ACK token'
            } 
        }, async () => {
            render(<ChatTestWrapper initialHistory={[]} />);
            act(() => mockEventSourceInstance!.simulateOpen());

            const msg1 = {
                thread: 'unify_message_outbound',
                id: 'msg-1',
                __ackId: 'ack-1',
                event: { content: 'Message 1' }
            };

            const msg2 = {
                thread: 'unify_message_outbound',
                id: 'msg-2',
                __ackId: 'ack-2',
                event: { content: 'Message 2' }
            };

            act(() => {
                mockEventSourceInstance!.simulateMessage(msg1);
                mockEventSourceInstance!.simulateMessage(msg2);
            });

            await waitFor(() => {
                expect(fetchSpy).toHaveBeenCalledTimes(2);
                expect(fetchSpy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: JSON.stringify({ ackId: 'ack-1' }) }));
                expect(fetchSpy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: JSON.stringify({ ackId: 'ack-2' }) }));
            });
        });

        it('does not re-ACK messages that have already been processed locally', { 
            meta: { 
                alias: 'ACK-Idempotency',
                scenario: 'Component re-renders after message is processed',
                behavior: 'ACK API is not called again'
            } 
        }, async () => {
            render(<ChatTestWrapper initialHistory={[]} />);
            act(() => mockEventSourceInstance!.simulateOpen());

            act(() => {
                mockEventSourceInstance!.simulateMessage({
                    thread: 'unify_message_outbound',
                    id: 'msg-1',
                    publishTime: new Date().toISOString(),
                    __ackId: 'unique-ack-1',
                    event: { content: 'One Time Ack' }
                });
            });

            await waitFor(() => {
                expect(fetchSpy).toHaveBeenCalledTimes(1);
            });

            // Trigger re-render
            const user = userEvent.setup();
            const input = screen.getByRole('textbox');
            await user.type(input, 'Typing causes render...');
            await new Promise(r => setTimeout(r, 200));

            expect(fetchSpy).toHaveBeenCalledTimes(1);
        });

        it('acks messages if they are filtered out as duplicates to clear queue', { 
            meta: { 
                alias: 'ACK-Skip-Dedupe',
                scenario: 'Server resends existing message with ACK token',
                behavior: 'Message is deduplicated and ACK IS SENT to clear it from PubSub'
            } 
        }, async () => {
            const history = [{ id: 'existing-id', role: 'assistant', content: 'Original', timestamp: new Date() } as ChatMessage];
            render(<ChatTestWrapper initialHistory={history} />);
            act(() => mockEventSourceInstance!.simulateOpen());

            const duplicateMsg = {
                thread: 'unify_message_outbound',
                id: 'existing-id',
                __ackId: 'ack-token-deduped',
                event: { content: 'Original' }
            };

            act(() => {
                mockEventSourceInstance!.simulateMessage(duplicateMsg);
            });

            await waitFor(() => {
                expect(fetchSpy).toHaveBeenCalledWith(
                    expect.stringContaining('/events/ack'),
                    expect.objectContaining({
                        method: 'POST',
                        body: JSON.stringify({ ackId: 'ack-token-deduped' })
                    })
                );
            });
        });

        it('handles ACK API failure gracefully without crashing UI', { 
            meta: { 
                alias: 'ACK-Fail-Resilience',
                scenario: 'ACK API returns 500 error',
                behavior: 'UI remains stable and rendered'
            } 
        }, async () => {
            // Need to mock fetch to reject only for ACK requests, but pass through for transcripts if needed
            fetchSpy.mockImplementation((url) => {
                if (String(url).includes('/ack')) return Promise.reject(new Error('Network Error'));
                return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
            });

            render(<ChatTestWrapper initialHistory={[]} />);
            act(() => mockEventSourceInstance!.simulateOpen());

            act(() => {
                mockEventSourceInstance!.simulateMessage({
                    thread: 'unify_message_outbound',
                    id: 'msg-fail',
                    __ackId: 'ack-fail-token',
                    event: { content: 'Stable UI' }
                });
            });

            await waitFor(() => {
                expect(screen.getByText('Stable UI')).toBeInTheDocument();
            });
            expect(fetchSpy).toHaveBeenCalledTimes(1);
        });

        it('acknowledges backlog messages but prevents display pollution (deduplication)', { 
            meta: { 
                alias: 'ACK-Dedupe-Ack',
                scenario: 'Transcripts load [MsgA]. SSE sends [MsgA (unacked), MsgB (unacked)].',
                behavior: 'MsgA is displayed once. MsgB is displayed. MsgB is ACKed.'
            } 
        }, async () => {
            const assistantId = 'stress-test-id';
            const msgA = { id: 'msg-a', role: 'assistant', content: 'Message A', timestamp: new Date('2023-01-01T10:00:00Z') } as ChatMessage;
            
            // 1. Setup specific mock for getTranscripts to return MsgA
            const getTranscriptsMock = vi.fn(async () => [msgA]);
            const actionsOverride = {
                chat: {
                    getTranscripts: getTranscriptsMock,
                    message: vi.fn(async () => ({})),
                    updateTranscripts: vi.fn(async () => ({}))
                }
            };

            // 2. Render with undefined history to trigger fetch
            render(<ChatTestWrapper initialHistory={undefined} assistantActionsOverride={actionsOverride} />);
            
            // Wait for transcripts fetch to complete (input placeholder changes from 'Loading...' to 'Send a message...')
            await waitFor(() => {
                expect(screen.getByPlaceholderText('Send a message...')).toBeInTheDocument();
            });

            // Verify MsgA is present (loaded from history)
            await waitFor(() => {
                expect(screen.getByText('Message A')).toBeInTheDocument();
            });
            expect(getTranscriptsMock).toHaveBeenCalled();

            // 3. Open SSE and send backlog
            act(() => mockEventSourceInstance!.simulateOpen());

            act(() => {
                // Re-send MsgA (should be deduped)
                mockEventSourceInstance!.simulateMessage({
                    thread: 'unify_message_outbound',
                    id: 'msg-a', 
                    publishTime: '2023-01-01T10:00:00Z',
                    __ackId: 'ack-for-A', 
                    event: { content: 'Message A' } 
                });

                // Send MsgB (New/Backlog)
                mockEventSourceInstance!.simulateMessage({
                    thread: 'unify_message_outbound',
                    id: 'msg-b',
                    publishTime: '2023-01-01T10:00:05Z',
                    __ackId: 'ack-for-B',
                    event: { content: 'Message B' }
                });
            });

            // 4. Verification
            await waitFor(() => {
                const bubbles = getChatBubbles();
                // Ensure no duplicates
                expect(bubbles).toEqual(['Message A', 'Message B']);
            });

            // Verify ACK for Msg B (Msg A might be skipped depending on implementation, 
            // but checking Msg B ensures the mechanism works for new items)
            expect(fetchSpy).toHaveBeenCalledWith(
                expect.stringContaining('/events/ack'),
                expect.objectContaining({
                    body: JSON.stringify({ ackId: 'ack-for-B' })
                })
            );
        });
    });

    // =========================================================================
    // SECTION D: CHAT HISTORY
    // =========================================================================
    describe('D - Chat History', () => {
        it('sorts out-of-order SSE messages correctly by timestamp', { 
            meta: { 
                alias: 'History-Ordering',
                scenario: 'Older message arrives after Newer message',
                behavior: 'Messages are resorted chronologically'
            } 
        }, async () => {
            const now = Date.now();
            const timeA = new Date(now).toISOString();
            const timeB = new Date(now - 10000).toISOString(); 

            render(<ChatTestWrapper initialHistory={[]} />);
            act(() => mockEventSourceInstance!.simulateOpen());

            // Newer
            act(() => {
                mockEventSourceInstance!.simulateMessage({
                    thread: 'unify_message_outbound',
                    id: 'msg-a',
                    publishTime: timeA,
                    event: { content: 'Message A (New)' }
                });
            });

            // Older
            act(() => {
                mockEventSourceInstance!.simulateMessage({
                    thread: 'unify_message_outbound',
                    id: 'msg-b',
                    publishTime: timeB,
                    event: { content: 'Message B (Old)' }
                });
            });

            await waitFor(() => {
                const bubbles = getChatBubbles();
                expect(bubbles).toEqual(['Message B (Old)', 'Message A (New)']);
            });
        });

        it('merges new SSE message with existing history', { 
            meta: { 
                alias: 'History-Merge',
                scenario: 'Initial history is loaded, new message arrives',
                behavior: 'New message is appended correctly'
            } 
        }, async () => {
            const history: ChatMessage[] = [{
                id: 'hist-1',
                role: 'user',
                content: 'Initial History',
                timestamp: new Date(Date.now() - 5000)
            }];

            render(<ChatTestWrapper initialHistory={history} />);
            act(() => mockEventSourceInstance!.simulateOpen());

            act(() => {
                mockEventSourceInstance!.simulateMessage({
                    thread: 'unify_message_outbound',
                    id: 'sse-1',
                    publishTime: new Date().toISOString(),
                    event: { content: 'Live Update' }
                });
            });

            await waitFor(() => {
                const bubbles = getChatBubbles();
                expect(bubbles).toEqual(['Initial History', 'Live Update']);
            });
        });

        it('deduplicates consecutive messages with identical content but NO IDs (Echo Prevention)', { 
            meta: { 
                alias: 'History-Echo-Prevention',
                scenario: 'Two identical messages without IDs arrive sequentially',
                behavior: 'Second message is ignored as potential echo'
            } 
        }, async () => {
            render(<ChatTestWrapper initialHistory={[]} />);
            act(() => mockEventSourceInstance!.simulateOpen());

            // 1. First message (No ID)
            act(() => {
                mockEventSourceInstance!.simulateMessage({
                    thread: 'unify_message_outbound',
                    event: { content: 'Echo?' }
                });
            });

            await waitFor(() => expect(screen.getByText('Echo?')).toBeInTheDocument());

            // 2. Second exact message (No ID)
            act(() => {
                mockEventSourceInstance!.simulateMessage({
                    thread: 'unify_message_outbound',
                    event: { content: 'Echo?' }
                });
            });

            await waitFor(() => {
                const bubbles = getChatBubbles();
                expect(bubbles).toHaveLength(1);
            });
        });

        it('orders complex interleaved history, backlog, user messages, and new replies correctly', { 
            meta: { 
                alias: 'History-Complex-Order',
                scenario: 'History[10:00], SSE Backlog[10:05], User[Now], SSE Reply[Now+1s]',
                behavior: 'All displayed in strict chronological order.'
            } 
        }, async () => {
            const t0 = new Date('2023-01-01T10:00:00Z');
            const tBacklog = new Date('2023-01-01T10:05:00Z');
            // User message will use Date.now(), so we mock system time to be tBacklog + 1hr
            const tUser = new Date('2023-01-01T11:00:00Z');
            const tReply = new Date('2023-01-01T11:00:05Z');

            vi.setSystemTime(tUser);

            const initialHistory = [{
                id: 'hist-1',
                role: 'assistant',
                content: '1. History',
                timestamp: t0
            } as ChatMessage];

            render(<ChatTestWrapper initialHistory={initialHistory} />);
            act(() => mockEventSourceInstance!.simulateOpen());

            // 1. Verify History
            expect(screen.getByText('1. History')).toBeInTheDocument();

            // 2. SSE Backlog arrives (Timestamp is OLDER than current User time)
            act(() => {
                mockEventSourceInstance!.simulateMessage({
                    thread: 'unify_message_outbound',
                    id: 'backlog-1',
                    publishTime: tBacklog.toISOString(),
                    __ackId: 'ack-backlog',
                    event: { content: '2. Backlog' }
                });
            });

            // 3. User sends message (Timestamp = tUser)
            const user = userEvent.setup();
            const input = screen.getByRole('textbox');
            await user.type(input, '3. User Input');
            await user.keyboard('{Enter}');

            // 4. SSE Reply arrives (Timestamp > tUser)
            act(() => {
                mockEventSourceInstance!.simulateMessage({
                    thread: 'unify_message_outbound',
                    id: 'reply-1',
                    publishTime: tReply.toISOString(), // Future
                    __ackId: 'ack-reply',
                    event: { content: '4. Reply' }
                });
            });

            // 5. Verify Final Order
            await waitFor(() => {
                const bubbles = getChatBubbles();
                expect(bubbles).toEqual([
                    '1. History',
                    '2. Backlog',
                    '3. User Input',
                    '4. Reply'
                ]);
            });

            // Verify ACKs were attempted for the stream items
            expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/ack'), expect.objectContaining({ body: JSON.stringify({ ackId: 'ack-backlog' }) }));
            expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/ack'), expect.objectContaining({ body: JSON.stringify({ ackId: 'ack-reply' }) }));
        });

        it('filters zombie messages based on API transcript timestamp, not local cache (cached session restore)', {
            meta: {
                alias: 'History-Zombie-Cache',
                scenario: 'Load A -> Rx Live Msg (Newer) -> Switch B -> Switch A -> Rx Late Msg (Older than Live, Newer than Transcript)',
                behavior: 'Late Msg is ACCEPTED (not treated as zombie)'
            }
        }, async () => {
            const tTranscript = new Date('2023-01-01T10:00:00Z');
            const tLatePubSub = new Date('2023-01-01T10:02:00Z'); // The one to test
            const tLiveCached = new Date('2023-01-01T10:05:00Z'); // The one already in cache

            const assistantA = createMockAssistant({ agent_id: 'assistant-a', first_name: 'A' });
            const assistantB = createMockAssistant({ agent_id: 'assistant-b', first_name: 'B' });

            // Mock Transcripts for A
            const getTranscriptsMock = vi.fn(async (context) => {
                if (context.includes('A')) {
                    return [{
                        id: 'msg-transcript',
                        role: 'assistant',
                        content: 'Transcript Msg',
                        timestamp: tTranscript,
                        message_id: 1
                    }];
                }
                return [];
            });

            const actionsOverride = { chat: { getTranscripts: getTranscriptsMock, message: vi.fn(), updateTranscripts: vi.fn() } };

            const { rerender } = render(
                <ChatTestWrapper
                    initialHistory={undefined}
                    assistantOverride={assistantA}
                    assistantActionsOverride={actionsOverride}
                />
            );

            // 1. Wait for Transcript
            await waitFor(() => expect(screen.getByText('Transcript Msg')).toBeInTheDocument());

            // 2. Connect SSE and receive "Live Cached" message
            await act(async () => {
                 mockEventSourceInstance!.simulateOpen();
                 mockEventSourceInstance!.simulateMessage({
                    thread: 'unify_message_outbound',
                    id: 'msg-live',
                    publishTime: tLiveCached.toISOString(),
                    event: { content: 'Live Msg' }
                 });
            });
            await waitFor(() => expect(screen.getByText('Live Msg')).toBeInTheDocument());

            // 3. Switch to B (Unmounts A's connection, caches A's history)
            rerender(
                <ChatTestWrapper
                    initialHistory={undefined}
                    assistantOverride={assistantB}
                    assistantActionsOverride={actionsOverride}
                />
            );

            // Wait for B to load (empty transcripts)
            await waitFor(() => expect(eventSourceInstances[1]?.url).toContain('assistant-b'));

            // 4. Switch back to A
            rerender(
                <ChatTestWrapper
                    initialHistory={undefined}
                    assistantOverride={assistantA}
                    assistantActionsOverride={actionsOverride}
                />
            );

            // Wait for A to re-appear (from cache, no fetch)
            await waitFor(() => expect(screen.getByText('Live Msg')).toBeInTheDocument());
            // Expect 2 calls: 1 for A (initial), 1 for B (switch). A is not re-fetched on return.
            expect(getTranscriptsMock).toHaveBeenCalledTimes(2);

            // Wait for SSE A to reconnect
            await waitFor(() => expect(eventSourceInstances[2]?.url).toContain('assistant-a'));
            const connectionA = eventSourceInstances[2];
            await act(async () => connectionA.simulateOpen());

            // 5. Send "Late" message (Older than Live, Newer than Transcript)
            // If logic uses local cache max (10:05), 10:02 is rejected.
            // If logic uses transcript max (10:00), 10:02 is accepted.
            await act(async () => {
                 connectionA.simulateMessage({
                    thread: 'unify_message_outbound',
                    id: 'msg-late',
                    publishTime: tLatePubSub.toISOString(),
                    event: { content: 'Late Msg' }
                 });
            });

            // 6. Assert
            await waitFor(() => expect(screen.getByText('Late Msg')).toBeInTheDocument());
        });

        it('ensures getTranscripts is called exactly once per session, preventing double-fetches', {
            meta: {
                alias: 'History-Double-Fetch',
                scenario: 'Component mounts, potentially re-renders during loading',
                behavior: 'API is called only once'
            }
        }, async () => {
            // Mock a slow fetch to ensure we catch duplicate calls during the "loading" phase
            const getTranscriptsMock = vi.fn(async () => {
                await new Promise(resolve => setTimeout(resolve, 50));
                return [];
            });

            const actionsOverride = {
                chat: {
                    getTranscripts: getTranscriptsMock,
                    message: vi.fn(),
                    updateTranscripts: vi.fn()
                }
            };

            const { rerender } = render(
                <ChatTestWrapper 
                    initialHistory={undefined} // Force fetch
                    assistantActionsOverride={actionsOverride} 
                />
            );

            // Force a re-render during the "loading" state (simulating React StrictMode or prop updates)
            rerender(
                <ChatTestWrapper 
                    initialHistory={undefined}
                    assistantActionsOverride={actionsOverride} 
                />
            );

            // Wait for loading to finish (input becomes enabled)
            await waitFor(() => expect(screen.queryByText('Loading messages...')).not.toBeInTheDocument());

            // Assert that despite the re-render, the fetch was only initiated once
            expect(getTranscriptsMock).toHaveBeenCalledTimes(1);
        });

        it('loads older messages when scrolling to the top', {
            meta: {
                alias: 'History-Pagination-Load',
                scenario: `User scrolls to top of chat with ${ASSISTANT_CHAT_LOADED_MESSAGES_COUNT}+ messages`,
                behavior: 'Older messages are fetched and prepended'
            }
        }, async () => {
            const apiOverride = { chat: { getTranscripts: fetchTranscriptsViaApi } };
            
            // 1. Initial Render (loads first messages: IDs 75 -> 26)
            render(<ChatTestWrapper initialHistory={undefined} assistantActionsOverride={apiOverride} />);

            await waitFor(() => {
                expect(screen.getByText('Message 75')).toBeInTheDocument();
                expect(screen.getByText('Message 26')).toBeInTheDocument();
            });

            expect(screen.queryByText('Message 25')).not.toBeInTheDocument();

            // 2. Simulate Scroll to Top
            const scrollArea = screen.getByTestId('chat-scroll-area');
            const viewport = scrollArea.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
            fireEvent.scroll(viewport, { target: { scrollTop: 0 } });

            // 3. Verify older messages appear (IDs 25 -> 1)
            await waitFor(() => {
                expect(screen.getByText('Message 25')).toBeInTheDocument();
                expect(screen.getByText('Message 1')).toBeInTheDocument();
            });

            // Verify total order
            const bubbles = getChatBubbles();
            expect(bubbles[0]).toBe('Message 1');
            expect(bubbles[bubbles.length - 1]).toBe('Message 75');
            expect(bubbles.length).toBe(75);
        });

        it('displays "No more messages" when history is fully loaded', {
            meta: {
                alias: 'History-Pagination-End',
                scenario: 'User loads all available history',
                behavior: 'End of history indicator is shown'
            }
        }, async () => {
            const apiOverride = { chat: { getTranscripts: fetchTranscriptsViaApi } };
            render(<ChatTestWrapper initialHistory={undefined} assistantActionsOverride={apiOverride} />);

            // Wait for first batch
            await waitFor(() => {
                expect(screen.getByText('Message 26')).toBeInTheDocument();
            });

            // Scroll to top to load second batch (25-1)
            const scrollArea = screen.getByTestId('chat-scroll-area');
            const viewport = scrollArea.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
            fireEvent.scroll(viewport, { target: { scrollTop: 0 } });

            // Wait for second batch
            await waitFor(() => {
                expect(screen.getByText('Message 1')).toBeInTheDocument();
            });

            // Expect "No more messages" text
            await waitFor(() => {
                expect(screen.getByText('No more messages')).toBeInTheDocument();
            });
        });

        it('handles pagination failure gracefully', {
            meta: {
                alias: 'History-Pagination-Fail',
                scenario: 'Pagination API call fails',
                behavior: 'Error is logged, existing messages remain, no crash'
            }
        }, async () => {
            // Use specific assistant name to trigger handler error (logic inside handlers.ts)
            const failAssistant = createMockAssistant({ first_name: 'FailPagination', surname: 'Test' });
            const apiOverride = { chat: { getTranscripts: fetchTranscriptsViaApi } };
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            render(<ChatTestWrapper initialHistory={undefined} assistantOverride={failAssistant} assistantActionsOverride={apiOverride} />);

            // Wait for first batch (Handler logic: context includes "FailPagination", but only fails if filter includes 'message_id <')
            // Initial fetch does NOT have 'message_id <', so it should succeed.
            await waitFor(() => {
                expect(screen.getByText('Message 26')).toBeInTheDocument();
            });

            // Scroll to top
            const scrollArea = screen.getByTestId('chat-scroll-area');
            const viewport = scrollArea.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
            fireEvent.scroll(viewport, { target: { scrollTop: 0 } });

            // Handler should return 500
            // Component should log error to console (as per implementation) and stop loading state.
            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith("Failed to load more messages:", expect.anything());
            });

            // Verify state didn't crash / messages still there
            expect(screen.getByText('Message 26')).toBeInTheDocument();
            expect(screen.getByText('Message 75')).toBeInTheDocument();
            
            consoleSpy.mockRestore();
        });

        it('allows retrying after pagination failure', {
            meta: {
                alias: 'History-Pagination-Retry',
                scenario: 'Pagination fails, user clicks retry, pagination succeeds',
                behavior: 'Error message is replaced by new messages'
            }
        }, async () => {
            const successMessages = [
                { id: 'msg-retry-1', role: 'assistant', content: 'Retried Message 1', timestamp: new Date(), message_id: 10 },
                { id: 'msg-retry-2', role: 'assistant', content: 'Retried Message 2', timestamp: new Date(), message_id: 11 }
            ] as ChatMessage[];
            
            let paginationAttempt = 0;
            const getTranscriptsMock = vi.fn(async (context: string, beforeMessageId?: number) => {
                // Initial Load
                if (beforeMessageId === undefined) {
                     return Array.from({ length: 50 }, (_, i) => ({
                         id: `msg-initial-${i}`,
                         role: 'user',
                         content: `Initial ${i}`,
                         timestamp: new Date(),
                         message_id: 100 + i
                     })) as ChatMessage[];
                }
                
                // Pagination
                paginationAttempt++;
                if (paginationAttempt === 1) {
                    return { detail: 'Simulated Network Error' };
                }
                return successMessages;
            });

            const apiOverride = { chat: { getTranscripts: getTranscriptsMock } };

            render(<ChatTestWrapper initialHistory={undefined} assistantActionsOverride={apiOverride} />);

            // 1. Initial Load
            await waitFor(() => {
                expect(screen.getByText('Initial 0')).toBeInTheDocument();
            });

            // 2. Scroll to top to trigger pagination
            const scrollArea = screen.getByTestId('chat-scroll-area');
            const viewport = scrollArea.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
            fireEvent.scroll(viewport, { target: { scrollTop: 0 } });

            // 3. Verify Error State
            await waitFor(() => {
                // Use regex to be resilient against whitespace
                expect(screen.getByRole('button', { name: /failed to load more\. retry/i })).toBeInTheDocument();
            });

            // 4. Click Retry
            const user = userEvent.setup();
            const retryBtn = screen.getByRole('button', { name: /failed to load more\. retry/i });
            await user.click(retryBtn);

            // 5. Verify Success
            await waitFor(() => {
                expect(screen.queryByRole('button', { name: /failed to load more\. retry/i })).not.toBeInTheDocument();
                expect(screen.getByText('Retried Message 1')).toBeInTheDocument();
                expect(screen.getByText('Retried Message 2')).toBeInTheDocument();
            });
        });

        it('shows error UI and prevents SSE connection on initial history load failure, allowing retry', {
            meta: {
                alias: 'History-Initial-Fail-Retry',
                scenario: 'Initial getTranscripts fails -> User clicks Retry -> Success',
                behavior: 'Error UI shown, SSE blocked. After retry, UI loads, SSE connects.'
            }
        }, async () => {
            let callCount = 0;
            const getTranscriptsMock = vi.fn(async () => {
                callCount++;
                if (callCount === 1) {
                    return { detail: 'Simulated Initial Error' };
                }
                return [{
                    id: 'msg-1',
                    role: 'assistant',
                    content: 'Loaded after retry',
                    timestamp: new Date(),
                    message_id: 1
                }] as ChatMessage[];
            });

            const actionsOverride = {
                chat: {
                    getTranscripts: getTranscriptsMock,
                    message: vi.fn(),
                    updateTranscripts: vi.fn()
                }
            };

            render(<ChatTestWrapper initialHistory={undefined} assistantActionsOverride={actionsOverride} />);

            // 1. Wait for Error UI
            await waitFor(() => {
                expect(screen.getByText('Failed to load chat history')).toBeInTheDocument();
                expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
            });

            // 2. Assert NO SSE connection
            expect(eventSourceInstances.length).toBe(0);
            
            // 3. Assert Input Disabled/Placeholder
            const input = screen.getByRole('textbox');
            expect(input).toBeDisabled();
            expect(input).toHaveAttribute('placeholder', 'Connection failed');

            // 4. Click Retry
            await userEvent.click(screen.getByRole('button', { name: /retry/i }));

            // 5. Wait for Success UI
            await waitFor(() => {
                expect(screen.getByText('Loaded after retry')).toBeInTheDocument();
            });

            // 6. Assert SSE Connected
            await waitFor(() => {
                expect(eventSourceInstances.length).toBe(1);
            });
            
            // 7. Manually trigger OPEN to enable input (since we use a mock)
            act(() => mockEventSourceInstance!.simulateOpen());

            // 8. Assert Input Enabled
            await waitFor(() => {
                expect(input).not.toBeDisabled();
            });
            expect(input).toHaveAttribute('placeholder', 'Send a message...');
        });

    });

});