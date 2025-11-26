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

// Mock fetching transcripts (logs) with pagination support
export const getTranscriptsHandler = http.get('/api/logs', ({ request }) => {
    const url = new URL(request.url);
    const filterExpr = url.searchParams.get('filter_expr') || '';
    const context = url.searchParams.get('context');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    // Scenario: Simulate Pagination Failure for specific context
    // We check if it's a pagination request (has message_id filter) and the context matches
    if (context?.includes('FailPagination') && filterExpr.includes('message_id <')) {
        return HttpResponse.json({ detail: 'Simulated Network Error' }, { status: 500 });
    }

    // Parse 'message_id < X' from filter expression
    const match = filterExpr.match(/message_id < (\d+)/);
    const beforeId = match ? parseInt(match[1], 10) : null;

    // Generate 75 messages to support 2 pages (50 + 25)
    // IDs: 1 (Oldest) -> 75 (Newest)
    const TOTAL_MESSAGES = 75;
    
    const allLogs = Array.from({ length: TOTAL_MESSAGES }, (_, i) => {
        const id = i + 1;
        return {
            id: id,
            // Timestamp: Spaced 1 minute apart
            timestamp: new Date(Date.now() - (TOTAL_MESSAGES - id) * 1000 * 60).toISOString(),
            entries: { 
                sender_id: id % 2 === 0 ? 0 : 1, // Alternate between Assistant (0) and User (1)
                content: `Message ${id}`, 
                medium: 'unify_chat',
                message_id: id 
            }
        };
    }).reverse(); // Sort Newest -> Oldest (API default)

    // Filter by pagination cursor
    let filteredLogs = allLogs;
    if (beforeId !== null) {
        filteredLogs = filteredLogs.filter(log => log.entries.message_id < beforeId);
    }

    // Apply limit
    const page = filteredLogs.slice(0, limit);

    return HttpResponse.json({ logs: page });
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