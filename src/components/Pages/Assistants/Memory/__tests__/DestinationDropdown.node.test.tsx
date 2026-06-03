import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MemoryPane } from '@/components/Pages/Assistants/Memory';
import type { Assistant } from '@/types/assistants/assistant';

Object.defineProperties(HTMLElement.prototype, {
  hasPointerCapture: {
    configurable: true,
    value: () => false,
  },
  releasePointerCapture: {
    configurable: true,
    value: () => undefined,
  },
  setPointerCapture: {
    configurable: true,
    value: () => undefined,
  },
  scrollIntoView: {
    configurable: true,
    value: () => undefined,
  },
});

function assistantWithSpaces(spaceIds: number[]): Assistant {
  return {
    agentId: '42',
    userId: 'user-1',
    organizationId: null,
    firstName: 'Ava',
    surname: 'Repairs',
    jobTitle: null,
    profilePhoto: null,
    profileVideo: null,
    age: null,
    nationality: null,
    about: null,
    phoneCountry: null,
    timezone: null,
    voiceId: null,
    voiceProvider: null,
    email: null,
    phone: null,
    assistantWhatsappNumber: null,
    assistantDiscordBotId: null,
    userPhone: null,
    userWhatsappNumber: null,
    userDiscordId: null,
    weeklyLimit: null,
    maxParallel: null,
    spaceIds,
    selfContactId: 9,
    bossContactId: 10,
    contactIdentityRoots: [
      {
        targetScope: 'personal',
        targetSpaceId: null,
        selfContactId: 9,
        bossContactId: 10,
      },
    ],
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-01T10:00:00Z',
  };
}

function logsResponse(entries: Record<string, unknown>[]) {
  return new Response(
    JSON.stringify({
      logs: entries.map((entry) => ({ entries: entry })),
      count: entries.length,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

function installMemoryFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'https://console.test');

    if (url.pathname === '/api/assistant/42/spaces') {
      return new Response(
        JSON.stringify([
          {
            spaceId: 7,
            name: 'Patch Seven',
            description: 'Repair patch seven shared memory',
            organizationId: null,
            status: 'active',
          },
          {
            spaceId: 9,
            name: 'Patch Nine',
            description: 'Repair patch nine shared memory',
            organizationId: null,
            status: 'active',
          },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.pathname === '/api/context/Assistants') {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    const context = url.searchParams.get('context');
    if (context === 'user-1/42/Contacts') {
      return logsResponse([
        {
          contactId: 101,
          firstName: 'Personal',
          surname: 'Owner',
          emailAddress: 'personal@example.com',
        },
      ]);
    }
    if (context === 'Spaces/7/Contacts') {
      return logsResponse([
        {
          contactId: 201,
          firstName: 'Shared',
          surname: 'Seven',
          emailAddress: 'shared-seven@example.com',
        },
      ]);
    }
    if (context === 'Spaces/9/Contacts') {
      return logsResponse([
        {
          contactId: 301,
          firstName: 'Shared',
          surname: 'Nine',
          emailAddress: 'shared-nine@example.com',
        },
      ]);
    }

    return logsResponse([]);
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function installDelayedAllFetch() {
  const delayedPersonal = deferredResponse();
  const delayedNine = deferredResponse();
  let personalContactCalls = 0;
  let nineContactCalls = 0;

  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'https://console.test');

    if (url.pathname === '/api/assistant/42/spaces') {
      return new Response(JSON.stringify([{ spaceId: 7, name: 'Patch Seven' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.pathname === '/api/context/Assistants') {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    const context = url.searchParams.get('context');
    if (context === 'user-1/42/Contacts') {
      personalContactCalls += 1;
      if (personalContactCalls === 1) return delayedPersonal.promise;
      return logsResponse([{ contactId: 101, firstName: 'Personal' }]);
    }
    if (context === 'Spaces/7/Contacts') {
      return logsResponse([{ contactId: 201, firstName: 'Shared', surname: 'Seven' }]);
    }
    if (context === 'Spaces/9/Contacts') {
      nineContactCalls += 1;
      if (nineContactCalls === 1) return delayedNine.promise;
      return logsResponse([{ contactId: 301, firstName: 'Shared', surname: 'Nine' }]);
    }

    return logsResponse([]);
  });

  vi.stubGlobal('fetch', fetchMock);
  return { delayedPersonal, delayedNine };
}

function renderMemoryPane(assistant: Assistant) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryPane assistant={assistant} ownerId="user-1" assistantId="42" />
    </QueryClientProvider>
  );
}

describe('Memory destination dropdown', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('hides the destination dropdown for solo assistants', async () => {
    installMemoryFetch();

    renderMemoryPane(assistantWithSpaces([]));

    await waitFor(() => {
      expect(screen.queryByTestId('memory-destination-dropdown')).not.toBeInTheDocument();
    });
  });

  it('defaults to merged memory and drills into a selected space', async () => {
    const fetchMock = installMemoryFetch();
    const user = userEvent.setup();

    renderMemoryPane(assistantWithSpaces([7, 9]));

    const table = await screen.findByTestId('memory-table-contacts');
    await within(table).findByText('Personal');
    await within(table).findByText('Seven');
    await within(table).findByText('Nine');

    await user.click(screen.getByTestId('memory-destination-dropdown'));
    await user.click(await screen.findByText('Patch Seven'));

    await waitFor(() => {
      expect(within(table).queryByText('Personal')).not.toBeInTheDocument();
      expect(within(table).queryByText('Nine')).not.toBeInTheDocument();
      expect(within(table).getByText('Seven')).toBeInTheDocument();
    });

    await user.type(screen.getByTestId('memory-search'), 'seven');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      const searchedContexts = fetchMock.mock.calls
        .map(([input]) => new URL(String(input), 'https://console.test'))
        .filter((url) => url.searchParams.has('filterExpr'))
        .map((url) => url.searchParams.get('context'));

      expect(searchedContexts).toEqual(['Spaces/7/Contacts']);
    });
  });

  it('keeps the selected destination when an older merged request finishes later', async () => {
    const { delayedPersonal, delayedNine } = installDelayedAllFetch();
    const user = userEvent.setup();

    renderMemoryPane(assistantWithSpaces([7, 9]));

    await user.click(await screen.findByTestId('memory-destination-dropdown'));
    await user.click(await screen.findByText('Patch Seven'));

    const table = await screen.findByTestId('memory-table-contacts');
    await within(table).findByText('Seven');

    delayedPersonal.resolve(logsResponse([{ contactId: 101, firstName: 'Personal' }]));
    delayedNine.resolve(logsResponse([{ contactId: 301, firstName: 'Shared', surname: 'Nine' }]));

    await waitFor(() => {
      expect(within(table).queryByText('Personal')).not.toBeInTheDocument();
      expect(within(table).queryByText('Nine')).not.toBeInTheDocument();
      expect(within(table).getByText('Seven')).toBeInTheDocument();
    });
  });
});
