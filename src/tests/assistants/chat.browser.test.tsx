import * as React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@/tests/render';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';
import { AssistantProfilePanel } from '@/components/Pages/Assistants/Assistants/Profile/AssistantProfile';
import { createMockAssistant } from './mocks/data';
import { mockAssistantActions } from './mocks/actions';
import { AssistantActions, Assistant } from '@/types/assistants/assistant';
import { ChatMessage } from '@/types/assistants/chat';

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
        
        // Setup Fresh Spy
        fetchSpy = vi.spyOn(window, 'fetch');
        fetchSpy.mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
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
                scenario: '50 messages arrive in a single batch update',
                behavior: 'All 50 messages are rendered in order'
            } 
        }, async () => {
            render(<ChatTestWrapper initialHistory={[]} />);
            act(() => mockEventSourceInstance!.simulateOpen());

            const messageCount = 50;
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

        it('does NOT ack messages if they are filtered out as duplicates', { 
            meta: { 
                alias: 'ACK-Skip-Dedupe',
                scenario: 'Server resends existing message with ACK token',
                behavior: 'Message is deduplicated and ACK is ignored'
            } 
        }, async () => {
            const history = [{ id: 'existing-id', role: 'assistant', content: 'Original', timestamp: new Date() } as ChatMessage];
            render(<ChatTestWrapper initialHistory={history} />);
            act(() => mockEventSourceInstance!.simulateOpen());

            const duplicateMsg = {
                thread: 'unify_message_outbound',
                id: 'existing-id',
                __ackId: 'ack-token-ignored',
                event: { content: 'Original' }
            };

            act(() => {
                mockEventSourceInstance!.simulateMessage(duplicateMsg);
            });

            await new Promise(r => setTimeout(r, 100));
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it('handles ACK API failure gracefully without crashing UI', { 
            meta: { 
                alias: 'ACK-Fail-Resilience',
                scenario: 'ACK API returns 500 error',
                behavior: 'UI remains stable and rendered'
            } 
        }, async () => {
            fetchSpy.mockRejectedValueOnce(new Error('Network Error'));

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
        
        it('silently acknowledges and drops PubSub messages received before history load to prevent duplication', {
            meta: {
                alias: 'ACK-PreLoad-Race',
                scenario: 'PubSub message arrives before getTranscripts resolves',
                behavior: 'Message is ACKed immediately but NOT added to state (assumed covered by incoming transcript)'
            }
        }, async () => {
            let resolveTranscripts: (val: any) => void;
            const transcriptPromise = new Promise(r => { resolveTranscripts = r; });
            const getTranscriptsMock = vi.fn(() => transcriptPromise);

            const actionsOverride = {
                chat: {
                    getTranscripts: getTranscriptsMock,
                    message: vi.fn(),
                    updateTranscripts: vi.fn()
                }
            };

            const msgFromPubSub = {
                thread: 'unify_message_outbound',
                id: 'duplicate-msg-id',
                __ackId: 'early-ack-id',
                event: { content: 'Potential Duplicate' }
            };

            const msgFromTranscript = {
                id: 'duplicate-msg-id',
                role: 'assistant',
                content: 'Potential Duplicate',
                timestamp: new Date()
            };

            render(
                <ChatTestWrapper 
                    initialHistory={undefined} 
                    assistantActionsOverride={actionsOverride} 
                />
            );

            // 1. Simulate Connection Open
            act(() => {
                mockEventSourceInstance!.simulateOpen();
            });

            // 2. Simulate Incoming Message BEFORE history resolves
            act(() => {
                mockEventSourceInstance!.simulateMessage(msgFromPubSub);
            });

            // 3. Verify early ACK was sent
            await waitFor(() => {
                expect(fetchSpy).toHaveBeenCalledWith(
                    expect.stringContaining('/events/ack'),
                    expect.objectContaining({
                        body: JSON.stringify({ ackId: 'early-ack-id' })
                    })
                );
            });

            // 4. Verify message is NOT yet in the document (it was dropped to prevent dupes)
            expect(screen.queryByText('Potential Duplicate')).not.toBeInTheDocument();

            // 5. Now resolve the transcript (which contains the same message)
            await act(async () => {
                // @ts-ignore
                resolveTranscripts([msgFromTranscript]);
            });

            // 6. Verify message NOW appears (from history source)
            await waitFor(() => {
                expect(screen.getByText('Potential Duplicate')).toBeInTheDocument();
            });

            // 7. Ensure absolutely no duplication visually
            expect(screen.getAllByText('Potential Duplicate')).toHaveLength(1);
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

    });

});