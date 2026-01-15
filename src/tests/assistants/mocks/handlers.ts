import { http, HttpResponse } from 'msw';
import { mockAssistants, mockPhoneCountries, mockSocialPlatforms } from './data';

export const getAssistantsSuccess = http.get('/api/assistant', () => {
  return HttpResponse.json(mockAssistants);
});

export const getAssistantsError = http.get('/api/assistant', () => {
  return HttpResponse.json({ detail: 'Internal Server Error' }, { status: 500 });
});

export const getAssistantsEmpty = http.get('/api/assistant', () => {
  return HttpResponse.json([]);
});

export const getBalanceSuccess = http.get('/api/billing/balance', () => {
  return HttpResponse.json({ balance: '100.00', fullBalance: 100.0 });
});

export const getBalanceLow = http.get('/api/billing/balance', () => {
  return HttpResponse.json({ balance: '0.00', fullBalance: 0.0 });
});

// --- Contact Meta ---
export const getCountriesHandler = http.get('/api/contact/phone/available-countries', () => {
  return HttpResponse.json({ countries: mockPhoneCountries });
});

export const getSocialPlatformsHandler = http.get('/api/contact/social/available-platforms', () => {
  return HttpResponse.json({ platforms: mockSocialPlatforms });
});

export const listAssistantEmailsHandler = http.get('/api/contact/email', () => {
  return HttpResponse.json({ emails: ['taken@assistant.ai'] });
});

// --- Chat Handlers ---

export const getTranscriptsHandler = http.get('/api/logs', ({ request }) => {
  const url = new URL(request.url);
  const filterExpr = url.searchParams.get('filterExpr') || '';
  const context = url.searchParams.get('context');
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  if (context?.includes('FailPagination') && filterExpr.includes('message_id <')) {
    return HttpResponse.json({ detail: 'Simulated Network Error' }, { status: 500 });
  }
  const match = filterExpr.match(/message_id < (\d+)/);
  const beforeId = match ? parseInt(match[1], 10) : null;
  const TOTAL_MESSAGES = 75;
  const allLogs = Array.from({ length: TOTAL_MESSAGES }, (_, i) => {
    const id = i + 1;
    return {
      id: id,
      timestamp: new Date(Date.now() - (TOTAL_MESSAGES - id) * 1000 * 60).toISOString(),
      entries: {
        senderId: id % 2 === 0 ? 0 : 1,
        content: `Message ${id}`,
        medium: 'unify_message',
        messageId: id,
      },
    };
  }).reverse();
  let filteredLogs = allLogs;
  if (beforeId !== null) {
    filteredLogs = filteredLogs.filter((log) => log.entries.messageId < beforeId);
  }
  const page = filteredLogs.slice(0, limit);
  return HttpResponse.json({ logs: page });
});

export const postChatHandler = http.post('/api/assistant/chat', async ({ request }) => {
  let body: any = {};
  try {
    body = await request.clone().json();
  } catch (e) {
    /* noop */
  }
  if (body.type === 'post-hire-greeting') {
    return HttpResponse.json({ content: 'Hello! I am ready to work.' });
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode('data: {"choices": [{"delta": {"content": "Hello "}}]}\n\n')
      );
      controller.enqueue(
        encoder.encode('data: {"choices": [{"delta": {"content": "there!"}}]}\n\n')
      );
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new HttpResponse(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
});

export const postMessageHandler = http.post('/api/assistant/message', async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return HttpResponse.json({ info: 'Message sent to assistant for processing.' }, { status: 202 });
});

// --- Local Desktop Setup Handlers ---

const MOCK_README_UBUNTU = `# Unify Desktop Assistant - Ubuntu

## Installation

1. Download the .deb package
2. Run: sudo dpkg -i unify-desktop-assistant.deb
3. Follow the setup wizard
`;

const MOCK_README_WINDOWS = `# Unify Desktop Assistant - Windows

## Installation

1. Download the .nupkg package
2. Run the installer
3. Follow the setup wizard
`;

const MOCK_README_MACOS = `# Unify Desktop Assistant - macOS

## Installation

1. Download the .dmg file
2. Open and drag to Applications
3. Follow the setup wizard
`;

export const getLocalInstallHandler = http.get('/api/assistant/local/install', ({ request }) => {
  const url = new URL(request.url);
  const os = url.searchParams.get('os');

  if (!os || !['ubuntu', 'windows', 'macos'].includes(os)) {
    return HttpResponse.json(
      { detail: "Invalid or missing 'os' parameter. Must be one of: ubuntu, windows, macos" },
      { status: 400 }
    );
  }

  const readmeMap: Record<string, string> = {
    ubuntu: MOCK_README_UBUNTU,
    windows: MOCK_README_WINDOWS,
    macos: MOCK_README_MACOS,
  };

  return HttpResponse.json({ content: readmeMap[os] });
});

export const getLocalDownloadHandler = http.get('/api/assistant/local/download', ({ request }) => {
  const url = new URL(request.url);
  const os = url.searchParams.get('os');

  if (!os || !['ubuntu', 'windows', 'macos'].includes(os)) {
    return HttpResponse.json(
      { detail: "Invalid or missing 'os' parameter. Must be one of: ubuntu, windows, macos" },
      { status: 400 }
    );
  }

  const filenameMap: Record<string, string> = {
    ubuntu: 'unify-desktop-assistant.deb',
    windows: 'unify-desktop-assistant.nupkg',
    macos: 'unify-desktop-assistant.dmg',
  };

  // Return mock binary data
  const mockBinary = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
  return new HttpResponse(mockBinary, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filenameMap[os]}"`,
    },
  });
});

export const assistantHandlers = [
  getAssistantsSuccess,
  getTranscriptsHandler,
  postMessageHandler,
  postChatHandler,
  getBalanceSuccess,
  getCountriesHandler,
  getSocialPlatformsHandler,
  listAssistantEmailsHandler,
  getLocalInstallHandler,
  getLocalDownloadHandler,
];
