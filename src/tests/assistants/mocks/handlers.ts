import { http, HttpResponse } from 'msw';
import { mockAssistants } from './data';

export const getAssistantsSuccess = http.get('/api/assistant', () => {
  return HttpResponse.json(mockAssistants);
});

export const getAssistantsError = http.get('/api/assistant', () => {
  return HttpResponse.json({ detail: 'Internal Server Error' }, { status: 500 });
});

export const getAssistantsEmpty = http.get('/api/assistant', () => {
  return HttpResponse.json([]);
});

// --- Chat Handlers ---

// Mock fetching transcripts (logs) - ONLY for assistant chat contexts
// This handler only intercepts /api/logs when context contains 'ChatBot' or 'JaneDoe'
// Otherwise it passes through to let interfaceHandlers handle it
export const getTranscriptsHandler = http.get('/api/logs', ({ request }) => {
    const url = new URL(request.url);
    const context = url.searchParams.get('context');

    // Only handle assistant-specific contexts, let other /api/logs calls pass through
    if (!context || (!context.includes('ChatBot') && !context.includes('JaneDoe'))) {
        // Return undefined to let MSW continue to the next matching handler
        return;
    }

    // Return chat logs for assistant contexts
    const logs = [
        {
            id: 1,
            timestamp: new Date(Date.now() - 10000).toISOString(),
            entries: { sender_id: 1, content: 'Hello assistant', medium: 'unify_message' }
        },
        {
            id: 2,
            timestamp: new Date(Date.now() - 8000).toISOString(),
            entries: { sender_id: 0, content: 'Hello Jane, how can I help?', medium: 'unify_message' }
        }
    ];

    return HttpResponse.json({ 
        params: {},
        logs,
        count: logs.length,
        groups: {}
    });
});

// Mock sending a message
export const postMessageHandler = http.post('/api/assistant/message', async () => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    return HttpResponse.json({ info: 'Message sent to assistant for processing.' }, { status: 202 });
});

export const assistantHandlers = [
  getAssistantsSuccess,
  getAssistantsError,
  getAssistantsEmpty,
  getTranscriptsHandler,
  postMessageHandler
];