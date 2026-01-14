# Assistants Test Suite - TO-DO

This document tracks pending improvements and additions to the assistants test suite.

---

## 📊 Summary

| Category                     | Pending | Completed |
| ---------------------------- | ------- | --------- |
| Unit Tests (lib)             | 0       | 8         |
| Real Tests (lib)             | 0       | 7         |
| Unit Tests (hooks)           | 0       | 4         |
| API Route Tests              | 0       | 8         |
| Integration Tests (behavior) | 4       | 13        |
| Matrix Tests                 | 2       | 8         |
| Infrastructure               | 2       | 8         |
| Test Quality & Maintenance   | 1       | 3         |
| **Total**                    | **9**   | **59**    |

---

## 🔴 High Priority

### Unit Tests for Core Libraries ✅

All 8 unit test files for `src/lib/assistants/` have been implemented (120 tests total).

### Real Tests for Core Libraries (Orchestra Integration)

Real tests have been split from the monolithic `integration/actions.real.node.test.ts` into per-module files co-located with their mocked counterparts. Third-party service tests (ElevenLabs, Replicate, Cartesia) have been removed.

- [x] **`unit/lib/assistant.real.node.test.ts`** ✅ - CRUD operations against real Orchestra
- [x] **`unit/lib/chat.real.node.test.ts`** ✅ - Transcripts, messaging against real Orchestra
- [x] **`unit/lib/call.real.node.test.ts`** ✅ - Connection, dispatch against real Orchestra
- [x] **`unit/lib/contact.real.node.test.ts`** ✅ - Countries, platforms, emails against real Orchestra
- [x] **`unit/lib/voice.real.node.test.ts`** ✅ - Voice list against real Orchestra (TTS/clone excluded)
- [x] **`unit/lib/secret.real.node.test.ts`** ✅ - Secrets CRUD using /api/logs endpoint (6 tests)
- [x] **`unit/lib/task.real.node.test.ts`** ✅ - Tasks list, filtering, update using /api/logs endpoint (8 tests)

### Unit Tests for Hooks ✅

All 4 hooks unit test files have been implemented (64 tests total).

### API Route Tests ✅

All 6 API route test files have been implemented (56 tests total):

- [x] **`api/contact.api.node.test.ts`** ✅ - Contact endpoint tests (10 tests)
- [x] **`api/events.api.node.test.ts`** ✅ - Event/SSE endpoint tests (5 tests)
- [x] **`api/media.api.node.test.ts`** ✅ - Media upload tests (12 tests)
- [x] **`api/voice-extended.api.node.test.ts`** ✅ - Extended voice tests (11 tests)
- [x] **`api/desktop.api.node.test.ts`** ✅ - Desktop proxy tests (9 tests)
- [x] **`api/livekit.api.node.test.ts`** ✅ - LiveKit integration tests (9 tests)

---

## 🟡 Medium Priority

### Integration Tests - Missing Scenarios

- [x] **Cross-user chat isolation** ✅ - Org owner creates assistant, member chats with it. Verify:
  - Only that user's chat history is loaded
  - Messages are only received/acked for the active chat session
  - Other users don't receive assistant responses meant for different users

- [x] **Chat error recovery** ✅ - Test SSE reconnection, message retry on failure
- [x] **Chat pagination** ✅ - Test loading older messages, infinite scroll (already existed)
- [x] **Call reconnection** ✅ - Test handling of dropped connections, rejoin flow
- [x] **Assistant profile editing** ✅ - Full edit form behavior tests

### Secrets Management Tests ✅

- [x] **`integration/secrets.browser.test.tsx`** ✅ - Full coverage:
  - Secret creation with validation
  - Secret masking in UI
  - Secret deletion confirmation
  - Error handling for invalid secrets
  - Permission checks (only owner can manage secrets)

### Task System Tests ✅

- [x] **`integration/tasks.browser.test.tsx`** ✅ - Comprehensive coverage:
  - Task display and status representation
  - Task description editing
  - Task priority/status styling
  - Error handling and retries
  - Permission checks

---

## 🟢 Lower Priority

### Matrix Tests - Integration

Matrix tests live alongside regular integration tests in `integration/` with a `.matrix.` suffix.

- [x] **`integration/voice.matrix.browser.test.tsx`** ✅ - Combinatorial voice testing (42 tests):
  - Uses `defineMatrixTests` for chunking support
  - Providers: ElevenLabs × Cartesia × OpenAI
  - Settings: Gender × Language filtering
  - Combined filter combinations
  - Voice selection and property display
  - Matrix invariants (coverage checks)

- [x] **`integration/hire-media.matrix.browser.test.tsx`** ✅ - Media pipeline combinations (80 tests):
  - Uses `defineMatrixTests` for chunking support
  - Photo: Upload × Generate × Skip
  - Video: Upload × Animate × Skip (animate depends on photo)
  - Voice: Select × Clone × Design × Skip
  - Tests media state, animate button enabling, submission payload

- [x] **`integration/hire-setup.matrix.browser.test.tsx`** ✅ - Setup configuration combinations (48 tests):
  - Uses `defineMatrixTests` for chunking support
  - Setup: Remote × Local
  - OS (if local): Ubuntu × Windows × macOS
  - Fast Mode: On × Off
  - Tests OS selector visibility, instructions, payload fields

- [x] **`integration/permissions.matrix.node.test.tsx`** ✅ - Permission combinations (38 tests):
  - Uses `defineNodeMatrixTests` for sharding support
  - Workspace type: Personal × Organization
  - User role: Owner × Admin × Member
  - Assistant ownership: Own × Other's
  - Actions: Hire × Write × Delete
  - Edge cases: null workspace, undefined user, empty role
  - Invariant tests for permission consistency

- [x] **`integration/chat-states.matrix.browser.test.tsx`** ✅ - Chat state combinations (40 tests):
  - Uses `defineMatrixTests` for chunking support
  - Connection: Connected × Reconnecting × Disconnected × Error
  - History: Empty × Loaded × Paginated × Loading × Error
  - Message: Idle × Sending × Error
  - SSE: Open × Closed × Error
  - State transitions and invariants

- [x] **`integration/call-configs.matrix.browser.test.tsx`** ✅ - Call UI combinations (60 tests):
  - Uses `defineMatrixTests` for chunking support
  - Audio: On × Off × Muted
  - Video: On × Off
  - Screen share: On × Off
  - View mode: Normal × Minimized × Fullscreen
  - Connection states and control interactions
  - Call type invariants (audio vs video)

- [x] **`integration/contact-channels.matrix.browser.test.tsx`** ✅ - Contact channel combinations (56 tests):
  - Uses `defineMatrixTests` for chunking support
  - Channel: Email × Phone × WhatsApp
  - Status: Unset × Pending × Verified × Error
  - Validation: Valid × Invalid × Empty
  - Permissions: canWrite true × false
  - Input interactions and invariants

- [x] **`integration/media-pipeline.matrix.browser.test.tsx`** ✅ - Media state combinations (65 tests):
  - Uses `defineMatrixTests` for chunking support
  - Source: Upload × Generate
  - Media type: Photo × Video
  - Animation state: None × Pending × Processing × Complete × Failed × Canceled
  - Processing state: Idle × Uploading × Generating × Editing × Animating
  - Animation lifecycle and media type invariants

### Matrix Tests - API

API matrix tests live in `api/` with a `.matrix.` suffix.

- [x] **`api/errors.matrix.node.test.ts`** ✅ - API error handling (108 tests):
  - Uses `defineNodeMatrixTests` for sharding support
  - Status codes: 400 × 401 × 403 × 404 × 409 × 422 × 429 × 500 × 502 × 503
  - Error types: Validation × Auth × Permission × Rate limit × Server
  - Endpoints: Sampling of critical endpoints
  - Verify consistent error categorization and retry logic
  - REST convention invariants

### Assertion Improvements

- [x] **Strengthen API test assertions** ✅ - Replaced generic `toHaveBeenCalled()` with specific argument checks:
  - `hire.browser.test.tsx`: photo.edit (FormData + prompt), cancelAnimation (prediction ID), voice.generate/clone/design (payloads), assistant.update (ID + payload), approval.requestAccess (call count), voice.register (voice ID verification), photo.downloadPresetVideo (preset ID)
  - `call.browser.test.tsx`: getConnectionDetails (assistant ID in multiple tests), setMicrophoneEnabled (boolean value), window.open (URL pattern validation)
  - `secrets.browser.test.tsx`: get (agent ID), create (agent ID, name, value), delete (agent ID, secret ID)
  - `chat.browser.test.tsx`: getTranscripts (call count verification)
- [ ] **Add error message validation** - Verify correct error messages are displayed
- [ ] **Add state transition verification** - Assert loading → success/error transitions
- [x] **Validate call arguments comprehensively** ✅ - Systematic audit completed (2026-01-14):
  - Identified 44 weak `toHaveBeenCalled()` across 8 files
  - Most cases in `call.browser.test.tsx` are for `disconnect()` (no params) - acceptable
  - Most cases in `chat.browser.test.tsx` already have follow-up parameter checks
  - Remaining negative test cases (`.not.toHaveBeenCalled()`) are acceptable as-is

### Mock Improvements

- [ ] **Add response delays** - Simulate realistic network latency in mocks
- [ ] **Add error simulation** - Mock various error states (network, validation, auth)
- [ ] **Enhance EventSource mock** - Better simulate real SSE behavior (reconnection, errors)
- [ ] **Enhance LiveKit mock** - More realistic call state transitions

---

## 📁 Infrastructure

### Test Harnesses ✅

All 5 test harness files have been implemented in `integration/fixtures/`:

- [x] **`fixtures/chatTestHarness.tsx`** ✅ - EventSource/BroadcastChannel mocks, chat actions factory, wrapper component
- [x] **`fixtures/callTestHarness.tsx`** ✅ - LiveKit Room/LocalParticipant mocks, track state helpers, wrapper component
- [x] **`fixtures/profileTestHarness.tsx`** ✅ - Profile actions factory, validation helpers, form interaction helpers
- [x] **`fixtures/secretsTestHarness.tsx`** ✅ - Secret factories, actions factory, visibility toggle helpers
- [x] **`fixtures/tasksTestHarness.tsx`** ✅ - Task factories, status/priority styling verification, edit helpers
- [x] **`fixtures/index.ts`** ✅ - Re-exports all harnesses for convenient imports

### Documentation

- [ ] **`BEHAVIORS.md`** - Create behavior catalog similar to interfaces:
  - Document all testable user behaviors
  - Categorize by priority (P0, P1, P2)
  - Link to implementing test files
  - Track coverage status

### Mock Data Expansion

- [ ] Add more edge case fixtures to `mocks/data.ts`:
  - Assistants with long names (boundary testing)
  - Empty/null fields
  - Special characters in content
  - Large message histories
  - Various error response shapes

---

## 🚫 Explicitly Out of Scope

These items were discussed and decided against:

- ❌ **Real external service calls** - All external services (ElevenLabs, Replicate, Cartesia, LiveKit) should be mocked due to cost and reliability concerns
- ❌ **Real API tests in local development** - Real API tests only run in CI where Orchestra is available
- ❌ **Visual regression testing** - Not needed for current phase
- ❌ **Shared test utilities across feature domains** - Assistants tests should remain self-contained

---

## 📝 Notes

### Test Isolation Principle

Each test must be independent:

- Create required resources in test setup
- Clean up resources in `afterEach`
- No shared mutable state between tests

### Flaky Test Policy

1. **Quarantine** - Add `.skip` with tracking comment and GitHub issue
2. **Track** - Create issue for each quarantined test
3. **Review** - Weekly review to fix or remove
4. **Block** - PRs with new flaky tests should not merge

### CI Configuration

- Browser matrix tests use 8 shards (consistent with plots)
- Real API tests only run in CI with local Orchestra
- Coverage reports generated but thresholds not enforced (yet)

---

## 🔧 Test Quality & Maintenance

### Strengthen Test Assertions

- [ ] **Audit tests for overly lenient assumptions** - Review tests that pass too easily:
  - Replace `toHaveBeenCalled()` with specific argument matchers
  - Ensure mock return values are actually used in assertions
  - Verify state changes, not just function calls
  - Add negative test cases where missing

### Fix Failing Tests

- [x] **Triage `call.browser.test.tsx`** ✅ - Fixed LiveKit mocks, assistant reconnection behavior (2026-01-14)
- [x] **Triage `chat.browser.test.tsx`** ✅ - Fixed SSE reconnection, timing issues, mock parameters (2026-01-14)
- [ ] **Triage `hire.browser.test.tsx`** - 21 failures, mostly timeouts - likely test setup issues with media/voice interactions
- [ ] **Triage `secrets.browser.test.tsx`** - 6 failures, UI selector issues (lucide icon class changes)
- [ ] **Triage `tasks.browser.test.tsx`** - 2 failures, assertion mismatches (toBeNull vs undefined)
- [ ] **Triage `permissions.browser.test.tsx`** - 2 failures, UI selector issues (lucide icon class changes)

### Matrix Tests - Pending Features

The following matrix tests are testing for UI hooks/features that haven't been fully implemented yet:

- [ ] **`hire-preset.matrix.browser.test.tsx`** - 40 tests pending (needs `usePresetState` hook implementation)
- [ ] **`media-pipeline.matrix.browser.test.tsx`** - 35 tests pending (needs media state machine hook implementation)

These tests serve as specifications for future feature work. They should either be `.skip`ped until features are implemented, or the features should be built to match the test expectations.

- [ ] **Review skipped/quarantined tests** - Ensure `.skip` tests have a tracking comment explaining why skipped

---

## ✅ Completed

_(Move items here as they are completed with date)_

- [x] **README.md** - Comprehensive test documentation (2026-01-13)
- [x] **`mocks/handlers.ts`** - MSW handlers for API mocking
- [x] **`mocks/data.ts`** - Mock data factories
- [x] **`integration/chat.browser.test.tsx`** - SSE, history, cross-tab sync
- [x] **`integration/call.browser.test.tsx`** - LiveKit, screen share, view states
- [x] **`integration/hire.browser.test.tsx`** - Hire flow, presets, media
- [x] **`integration/list.browser.test.tsx`** - List rendering, search
- [x] **`integration/permissions.browser.test.tsx`** - Permission-based UI
- [x] **`api/assistants.api.node.test.ts`** - API route tests
- [x] **Real tests refactored** - Split monolithic `integration/actions.real.node.test.ts` into per-module files, removed third-party service tests (2026-01-13)
- [x] **`@/tests/server.ts`** - Shared MSW server for unit tests (2026-01-13)
- [x] **`unit/lib/assistant.node.test.ts`** - Assistant CRUD, data transforms (2026-01-13)
- [x] **`unit/lib/chat.node.test.ts`** - Transcripts, messages, contact sync (2026-01-13)
- [x] **`unit/lib/call.node.test.ts`** - Call dispatch (2026-01-13)
- [x] **`unit/lib/voice.node.test.ts`** - Voice CRUD, TTS, cloning, design (2026-01-13)
- [x] **`unit/lib/contact.node.test.ts`** - Emails, countries, platforms, verify (2026-01-13)
- [x] **`unit/lib/photo.node.test.ts`** - Upload, generate, edit, animate (2026-01-13)
- [x] **`unit/lib/secret.node.test.ts`** - Secrets CRUD (2026-01-13)
- [x] **`unit/lib/task.node.test.ts`** - Tasks CRUD, filtering, batch update (2026-01-13)
- [x] **`unit/hooks/useAssistantPermissions.node.test.tsx`** - Permission logic for org/personal (2026-01-13)
- [x] **`unit/hooks/useAssistantChat.node.test.tsx`** - Pre-hire chat state management (2026-01-13)
- [x] **`unit/hooks/useAssistantCall.node.test.tsx`** - Call state machine, connection flow (2026-01-13)
- [x] **`unit/hooks/useAssistantHireForm.node.test.tsx`** - Form validation, media handling (2026-01-13)
- [x] **`api/contact.api.node.test.ts`** - Contact email, phone, social endpoints (2026-01-13)
- [x] **`api/events.api.node.test.ts`** - SSE stream and message ack (2026-01-13)
- [x] **`api/media.api.node.test.ts`** - Photo/video upload and generation (2026-01-13)
- [x] **`api/voice-extended.api.node.test.ts`** - TTS, cloning, voice design (2026-01-13)
- [x] **`api/desktop.api.node.test.ts`** - Desktop proxy and liveview (2026-01-13)
- [x] **`api/livekit.api.node.test.ts`** - Call dispatch and auth (2026-01-13)
- [x] **`integration/chat.browser.test.tsx`** - Cross-user isolation, error recovery (2026-01-13)
- [x] **`integration/call.browser.test.tsx`** - Call reconnection, participant handling (2026-01-13)
- [x] **`integration/hire.browser.test.tsx`** - Profile editing scenarios (2026-01-13)
- [x] **`integration/secrets.browser.test.tsx`** - Full CRUD, masking, permissions (2026-01-13)
- [x] **`integration/tasks.browser.test.tsx`** - Display, editing, status styling (2026-01-13)
- [x] **`integration/fixtures/chatTestHarness.tsx`** - Chat SSE/BroadcastChannel mocks, helpers (2026-01-14)
- [x] **`integration/fixtures/callTestHarness.tsx`** - LiveKit mocks, track state helpers (2026-01-14)
- [x] **`integration/fixtures/profileTestHarness.tsx`** - Profile actions factory, form helpers (2026-01-14)
- [x] **`integration/fixtures/secretsTestHarness.tsx`** - Secret factories, visibility helpers (2026-01-14)
- [x] **`integration/fixtures/tasksTestHarness.tsx`** - Task factories, status/priority styling (2026-01-14)
- [x] **`integration/fixtures/index.ts`** - Centralized harness exports (2026-01-14)
- [x] **`integration/permissions.matrix.node.test.tsx`** - Permission matrix, uses `defineNodeMatrixTests` (38 tests) (2026-01-14)
- [x] **`integration/voice.matrix.browser.test.tsx`** - Voice matrix, uses `defineMatrixTests` (42 tests) (2026-01-14)
- [x] **`integration/chat-states.matrix.browser.test.tsx`** - Chat state matrix, uses `defineMatrixTests` (40 tests) (2026-01-14)
- [x] **`integration/call-configs.matrix.browser.test.tsx`** - Call UI matrix, uses `defineMatrixTests` (60 tests) (2026-01-14)
- [x] **`integration/contact-channels.matrix.browser.test.tsx`** - Contact channels matrix, uses `defineMatrixTests` (56 tests) (2026-01-14)
- [x] **`integration/media-pipeline.matrix.browser.test.tsx`** - Media pipeline matrix, uses `defineMatrixTests` (65 tests) (2026-01-14)
- [x] **`api/errors.matrix.node.test.ts`** - API error handling matrix, uses `defineNodeMatrixTests` (108 tests) (2026-01-14)
- [x] **`integration/hire-media.matrix.browser.test.tsx`** - Hire media pipeline matrix, uses `defineMatrixTests` (80 tests) (2026-01-14)
- [x] **`integration/hire-preset.matrix.browser.test.tsx`** - Hire preset behavior matrix, uses `defineMatrixTests` (48 tests) (2026-01-14)
- [x] **`integration/hire-setup.matrix.browser.test.tsx`** - Hire setup config matrix, uses `defineMatrixTests` (48 tests) (2026-01-14)
- [x] **Assertion strengthening** - Replaced ~15 weak `toHaveBeenCalled()` with specific argument checks (2026-01-14)
- [x] **`unit/lib/secret.real.node.test.ts`** - Secrets CRUD via /api/logs endpoint (6 tests) (2026-01-14)
- [x] **`unit/lib/task.real.node.test.ts`** - Tasks list, filter, update via /api/logs endpoint (8 tests) (2026-01-14)
