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

// Mock fetching transcripts (logs)
export const getTranscriptsHandler = http.get('/api/logs', ({ request }) => {
    const url = new URL(request.url);
    const context = url.searchParams.get('context');

    // Default empty history
    let logs: any[] = [];

    // Check for ChatBot (test) or JaneDoe (example)
    // We accept if context param is present and matches, or just checks the string to be safe
    if (context && (context.includes('ChatBot') || context.includes('JaneDoe'))) {
        logs = [
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
    }

    return HttpResponse.json({ logs });
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