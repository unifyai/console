# Assistants Test Suite - TO-DO

This document tracks pending improvements and additions to the assistants test suite.

---

## 📊 Summary

| Category                     | Pending | Completed |
| ---------------------------- | ------- | --------- |
| Unit Tests (lib)             | 0       | 8         |
| Real Tests (lib)             | 4       | 3         |
| Unit Tests (hooks)           | 0       | 4         |
| API Route Tests              | 0       | 8         |
| Integration Tests (behavior) | 1       | 12        |
| Matrix Tests                 | 8       | 0         |
| Infrastructure               | 8       | 2         |
| Test Quality & Maintenance   | 3       | 0         |
| **Total**                    | **24**  | **37**    |

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
- [ ] **`unit/lib/secret.real.node.test.ts`** - TODO stubs (routes not implemented)
- [ ] **`unit/lib/task.real.node.test.ts`** - TODO stubs (routes not implemented)
- [ ] **`unit/lib/photo.real.node.test.ts`** - Not created (all photo ops hit third-party services)
- [ ] **`unit/lib/desktop.real.node.test.ts`** - Not created (desktop ops hit external service)

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
- [ ] **Voice preview playback** - Test audio playback controls and states (deferred - requires audio mocking)

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

- [ ] **`matrix/voice.matrix.browser.test.tsx`** - Combinatorial voice testing:
  - Providers: ElevenLabs × Cartesia × OpenAI
  - Settings: Gender × Language × Speed
  - Modes: Fast mode on/off
  - States: Preview, selection, confirmation

- [ ] **`matrix/hire.matrix.browser.test.tsx`** - Hire form combinations:
  - Photo: Upload × Generate × Skip
  - Video: Upload × Animate × Skip
  - Voice: Select × Clone × Design × Skip
  - Presets: Various preset selections

- [ ] **`matrix/permissions.matrix.browser.test.tsx`** - Permission combinations:
  - Workspace type: Personal × Organization
  - User role: Owner × Admin × Member
  - Assistant ownership: Own × Other's
  - Actions: Hire × Edit × Delete × Chat
  - ~12 meaningful scenario combinations

- [ ] **`matrix/chat-states.matrix.browser.test.tsx`** - Chat state combinations:
  - Connection: Connected × Reconnecting × Disconnected
  - History: Empty × Loaded × Paginated × Error
  - Message type: Text × Error × System
  - Focus on state transitions and error recovery

- [ ] **`matrix/call-configs.matrix.browser.test.tsx`** - Call UI combinations:
  - Audio: On × Off × Muted
  - Video: On × Off
  - Screen share: On × Off
  - View mode: Normal × Minimized × Fullscreen
  - Verify UI reflects all toggle combinations

- [ ] **`matrix/contact-channels.matrix.browser.test.tsx`** - Contact channel combinations:
  - Channel: Phone × Email × WhatsApp × Social
  - Validation: Valid × Invalid × Missing
  - Link state: Linked × Unlinked × Pending
  - Cover all channel types with edge cases

- [ ] **`matrix/media-pipeline.matrix.browser.test.tsx`** - Media state combinations:
  - Source: Upload × Generate
  - Has animation: Yes × No
  - Animation state: Pending × Processing × Complete × Failed
  - Cover upload/generate paths and animation lifecycle

### Matrix Tests - API

- [ ] **`matrix/api-errors.matrix.node.test.ts`** - API error handling:
  - Status codes: 400 × 401 × 403 × 404 × 422 × 500 × 503
  - Error types: Validation × Auth × Rate limit × Server
  - Endpoints: Sampling of critical endpoints
  - Verify consistent error response format

### Assertion Improvements

- [ ] **Strengthen API test assertions** - Replace generic `toHaveBeenCalled()` with specific argument checks
- [ ] **Add error message validation** - Verify correct error messages are displayed
- [ ] **Add state transition verification** - Assert loading → success/error transitions
- [ ] **Validate call arguments comprehensively** - Check all relevant properties, not just existence

### Mock Improvements

- [ ] **Add response delays** - Simulate realistic network latency in mocks
- [ ] **Add error simulation** - Mock various error states (network, validation, auth)
- [ ] **Enhance EventSource mock** - Better simulate real SSE behavior (reconnection, errors)
- [ ] **Enhance LiveKit mock** - More realistic call state transitions

---

## 📁 Infrastructure

### Test Harnesses

- [ ] **`fixtures/assistantProfileTestHarness.tsx`** - Reusable harness for profile tests
- [ ] **`fixtures/chatTestHarness.tsx`** - Already exists, may need enhancement
- [ ] **`fixtures/callTestHarness.tsx`** - Reusable harness for call tests
- [ ] **`fixtures/secretsTestHarness.tsx`** - Reusable harness for secrets tests
- [ ] **`fixtures/tasksTestHarness.tsx`** - Reusable harness for task tests

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

- [ ] **Triage failing tests** - For each failing test:
  1. Determine if failure indicates a genuine bug in production code
  2. If bug: fix the underlying code first, then verify test passes
  3. If test issue: fix the test (wrong assumptions, stale mocks, race conditions)
  4. Document root cause in commit message

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
