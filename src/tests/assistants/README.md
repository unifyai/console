# Assistants Test Suite

This folder contains the comprehensive test suite for the Assistants feature, covering unit tests, integration tests, and API tests.

## Folder Structure

```
assistants/
├── api/                    # API route tests (server-side)
│   ├── fixtures/           # Shared API test utilities
│   └── *.node.test.ts      # Individual API endpoint tests
│
├── integration/            # Browser integration tests (UI + behavior)
│   ├── fixtures/           # Test harness components and helpers
│   └── *.browser.test.tsx  # Component integration tests
│
├── mocks/                  # Shared mock data and handlers
│   ├── actions.ts          # Mock assistant action implementations
│   ├── data.ts             # Mock data factories (assistants, voices, etc.)
│   └── handlers.ts         # MSW request handlers
│
└── unit/                   # Unit tests (isolated logic)
    ├── hooks/              # React hook tests
    └── lib/                # Server action/library function tests
```

## Test Types

### Unit Tests (`unit/`)

Isolated tests for individual functions and hooks using mocked dependencies.

| Subfolder | Description                                     |
| --------- | ----------------------------------------------- |
| `hooks/`  | React hook tests using `@testing-library/react` |
| `lib/`    | Server action factory function tests            |

**Naming Convention:**

- `*.node.test.ts` - Runs in Node.js environment
- `*.real.node.test.ts` - Tests against real backend (requires running server)

### Integration Tests (`integration/`)

Browser-based tests that render full component trees and simulate user interactions.

**Naming Convention:**

- `*.browser.test.tsx` - Browser environment tests (Playwright + Vitest)
- `*.matrix.browser.test.tsx` - Parameterized tests covering multiple scenarios
- `*.matrix.node.test.tsx` - Parameterized node tests (e.g., permissions)

### API Tests (`api/`)

Tests for Next.js API routes and backend integrations.

**Naming Convention:**

- `*.api.node.test.ts` - API route tests with mocked fetch
- `*.matrix.node.test.ts` - Parameterized error handling tests

---

## Main User Flows Tested

### 1. Assistant Hiring Flow (`hire.browser.test.tsx`)

The complete flow of creating a new AI assistant.

**Scenarios Covered:**

- Form validation (required fields, duplicate names)
- Balance checking and insufficient funds handling
- Voice selection (preset voices, custom cloning, voice design)
- Photo/video customization (upload, AI generation, animation)
- Local vs remote desktop setup
- Preset selection and randomization
- Pre-hire chat conversation
- Access request flow for unapproved users

### 2. Assistant Update Flow (`hire.browser.test.tsx` - Section F)

Editing an existing assistant's profile.

**Scenarios Covered:**

- Loading existing assistant data into form
- Field validation during edit
- Handling update failures
- Voice changes during edit
- Preserving unchanged fields

### 3. Voice Customization (`voice.matrix.browser.test.tsx`)

Voice selection and creation flows.

**Scenarios Covered:**

- Browsing preset voices
- Filtering by language/gender
- Voice preview playback
- Voice cloning from audio file
- Voice design (AI-generated voices)
- Deleting custom voices
- Fast mode voice restrictions

### 4. Photo & Media (`hire-media.matrix.browser.test.tsx`)

Profile photo and video management.

**Scenarios Covered:**

- Photo upload and preview
- AI photo generation from prompts
- Photo editing with prompts
- Video animation from photos
- Animation progress tracking and cancellation

### 5. Chat System (`chat.browser.test.tsx`, `chat-states.matrix.browser.test.tsx`)

Real-time messaging with assistants.

**Scenarios Covered:**

- Sending and receiving messages
- Message history loading
- Connection state handling (connecting, connected, error)
- Typing indicators
- Message rate limiting

### 6. Call System (`call.browser.test.tsx`, `call-configs.matrix.browser.test.tsx`)

Voice/video calling with assistants.

**Scenarios Covered:**

- Call initiation and connection
- Microphone/camera controls
- Screen sharing
- Call state management
- LiveKit integration

### 7. Task Management (`tasks.browser.test.tsx`)

Managing assistant tasks and to-dos.

**Scenarios Covered:**

- Task list display and filtering
- Task status updates
- Task description editing
- Save/discard changes
- Permission-based editing

### 8. Secrets Management (`secrets.browser.test.tsx`)

Managing encrypted secrets for assistants.

**Scenarios Covered:**

- Viewing secrets list
- Creating new secrets
- Deleting secrets
- Read-only mode
- Value visibility toggle

### 9. Permissions (`permissions.browser.test.tsx`, `permissions.matrix.node.test.tsx`)

Role-based access control.

**Scenarios Covered:**

- Owner vs member permissions
- Edit/delete button visibility
- Read-only component states
- Permission inheritance

### 10. Contact Channels (`contact-channels.matrix.browser.test.tsx`)

Managing assistant contact methods.

**Scenarios Covered:**

- Phone number configuration
- Email setup
- Social platform integration
- WhatsApp integration

---

## Running Tests

```bash
# Run all unit tests (Node environment)
npm run test:node -- --run src/tests/assistants/unit/

# Run all integration tests (Browser environment)
npm run test:browser -- --run src/tests/assistants/integration/

# Run all API tests
npm run test:node -- --run src/tests/assistants/api/

# Run a specific test file
npm run test:browser -- --run src/tests/assistants/integration/hire.browser.test.tsx

# Run tests matching a pattern
npm run test:browser -- --run -t "should validate required fields"
```

## Test Fixtures

### Integration Fixtures (`integration/fixtures/`)

Reusable test harness components that wrap the actual components with necessary providers:

| File                     | Purpose                      |
| ------------------------ | ---------------------------- |
| `callTestHarness.tsx`    | Call UI test wrapper         |
| `chatTestHarness.tsx`    | Chat component test wrapper  |
| `profileTestHarness.tsx` | Profile panel test wrapper   |
| `secretsTestHarness.tsx` | Secrets manager test wrapper |
| `tasksTestHarness.tsx`   | Task list test wrapper       |

### Mock Data (`mocks/`)

| File          | Exports                                                                   |
| ------------- | ------------------------------------------------------------------------- |
| `data.ts`     | `createMockAssistant()`, `mockAssistants`, `mockVoices`, `mockPresets`    |
| `actions.ts`  | `mockAssistantActions` - vi.fn() implementations of all assistant actions |
| `handlers.ts` | MSW handlers for common API endpoints                                     |

## Notes

- Tests with `.real.` in the filename require a running backend server
- Matrix tests use `defineMatrixTests` helper for parameterized testing
- Browser tests use MSW (Mock Service Worker) for API mocking
- The test suite uses Vitest as the test runner
