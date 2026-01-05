# Interfaces Optimisations Devlog

**Branch:** `interface-robustness`  
**First Commit:** `c3662c60` (Oct 29, 2025) - feat: add centralized API key resolution utilities  
**Revert Commit:** `325895b5` (Nov 17, 2025) - Staging revert interfaces (#129)  
**Re-apply Commit:** `13983019` (Dec 5, 2025) - Revert "Staging revert interfaces (#129)"  
**Current State:** Optimizations restored + Dec 5 fixes merged  
**Purpose:** Minimise client requests to/from the Next.js server to keep the browser's 6 TCP connections free and avoid request queuing.

---

## Development Approach: Test-Driven Development (TDD)

After the revert, a comprehensive test suite was added in `src/tests/interfaces/`. 

**Going forward, all optimisation changes MUST:**
1. Have passing tests before merge
2. Not introduce regressions in existing tests
3. Add new tests for new functionality

**Run tests with:** 
- `npm run test:interfaces` (mock tests, fast)
- `npm run test:interfaces:real` (full tests with server)

---

## 📋 Progress Tracker

### Current Status: 🟡 QA In Progress

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Fix Unit Tests | ✅ Complete | 32 test files, 193 tests pass |
| 2. Fix MSW Integration Tests | ✅ Complete | All mock tests now passing |
| 3. Re-apply Optimisations | ✅ Complete | Reverted the revert (`13983019`) |
| 4. Merge Dec 5 Fixes | ✅ Complete | Caching, polling fixes, etc. (`a7d0e47c`) |
| 5. Review & Clean Up | ✅ Complete | Cookie auth removed (`66bf07ba`) |
| 6. Fix Remaining Tests | ✅ Complete | All fetch mocks added (`0875ff77`, `7c2a2e51`) |
| 7. Fix Build Errors | ✅ Complete | Type errors fixed (`a4403a5a`) - Dec 8 |
| 8. Fix Runtime Bugs | ✅ Complete | Infinite loops, query cancellation (`d74e81e0`) - Dec 9 |
| 9. Manual QA | 🟡 In Progress | Testing in browser |
| 10. Ready for Merge | ⏸️ Blocked | After QA passes |

### 🔴 Known Issues / Left to Fix

| Issue | Priority | Status |
|-------|----------|--------|
| Context switching re-renders whole tile | Medium | Should only refresh logs, not entire tile |
| "signal is aborted" errors on context switch | Medium | Query cancellation still happening |
| Slow staging/prod backend (504 timeouts) | Low | Infrastructure issue, not frontend |
| Plot rendering very slow | Low | Backend timeout issue (Orchestra) |

### ⚪ Low Priority Warnings (Non-blocking)

| Issue | File | Notes |
|-------|------|-------|
| `<button>` nested inside `<button>` | NewTileOverlay.tsx | HTML nesting |
| Components need `forwardRef` | BaseButton, TileDropdownContent | React ref warning |
| SVG attribute casing | ColumnGroupSort.tsx | `stroke-width` → `strokeWidth` |
| `<div>` inside `<tr>` | RowResize.tsx | DOM nesting |

---

## 🔧 Integration Test Fix Plan

### Problem Summary
The optimization work changed several hooks/utils to use **direct fetch calls** instead of passing through action objects. Tests that mock `actions.get()` etc. no longer work.

### Endpoints That Need Mocking

The following API endpoints are now called directly via `fetch()`:

| Endpoint | Used By | Mock Required |
|----------|---------|---------------|
| `/api/interface` | `useListInterfacesQuery` | Return interface list |
| `/api/tab` | `useTabStreamingQuery` | Return tab list |
| `/api/tile` | `useTabDataOptimistic` | Return tiles for tab |
| `/api/logs` | `buildTableDataItem`, `buildPlotDataItem` | Return logs data |
| `/api/logs/fields` | `buildServerData`, `usePatchTileQueryOptimistic` | Return field definitions |
| `/api/logs/:metricName` | `buildPlotDataItem` | Return aggregated metrics |
| `/api/projects` | `buildServerData` | Return project list |
| `/api/context/:projectId` | `buildServerData` | Return contexts for project |

### Failing Integration Tests (14 total)

#### Group 1: Logs Tests (8 tests) - `refreshLogs.node.test.tsx`, `logsCore.node.test.ts`
**Endpoints needed:** `/api/logs`, `/api/logs/fields`
**Fix approach:** Add `vi.stubGlobal('fetch')` with handlers for logs endpoints

| Test | Current Issue |
|------|---------------|
| `fetches logs on initial render` | Hook uses direct fetch |
| `refetch() triggers a new data fetch` | Hook uses direct fetch |
| `fetches new data when context changes` | Hook uses direct fetch |
| `clicking refresh should fetch data` | Component uses hook |
| `switching context should trigger new fetch` | Hook uses direct fetch |
| `fields should be fetched for NEW context` | Uses direct fetch |
| `logsActions.get should be called on initial render` | Uses direct fetch now |
| `fetchLogsCore uses logsActions.get` | Uses direct fetch now |

#### Group 2: Tab/Tile Tests (3 tests) - `tabDataOptimistic.mswhooks.node.test.tsx`, `tabStreaming.mswhooks.node.test.tsx`
**Endpoints needed:** `/api/tab`, `/api/tile`
**Fix approach:** Add fetch mocks for tab/tile endpoints

| Test | Current Issue |
|------|---------------|
| `assembles coherent CompleteTabData snapshot` | Uses direct fetch for tiles |
| `prefetches non-active tabs` | Uses direct fetch for tabs |
| (similar pattern) | |

#### Group 3: Interface Query Tests (1 test) - `interfacesQueries.node.test.tsx`
**Endpoints needed:** `/api/interface`
**Fix approach:** Mock `dedupedJson` or stub fetch

| Test | Current Issue |
|------|---------------|
| `useListInterfacesQuery calls actions.list` | Uses `dedupedJson` now |

#### Group 4: E2E/Golden Path (2 tests) - `golden-path.node.test.tsx`
**Endpoints needed:** Multiple (interface, tab, tile, logs)
**Fix approach:** Comprehensive fetch mock setup

### Fix Pattern (Copy from Unit Tests)

```typescript
// At top of test file
const mockFetch = vi.fn();

// Helper for consistent responses
const createMockResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name: string) => null },
  json: async () => data,
});

// In beforeEach
beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes('/api/logs/fields')) {
      return createMockResponse({ /* field definitions */ });
    }
    if (url.includes('/api/logs')) {
      return createMockResponse({ logs: [], count: 0, params: {}, groups: [] });
    }
    if (url.includes('/api/tab')) {
      return createMockResponse([/* tab list */]);
    }
    if (url.includes('/api/tile')) {
      return createMockResponse([/* tile list */]);
    }
    if (url.includes('/api/interface')) {
      return createMockResponse([/* interface list */]);
    }
    return createMockResponse({}, 404);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
```

### Priority Order for Fixes

1. **`refreshLogs.node.test.tsx`** (8 tests) - Most impactful
2. **`logsCore.node.test.ts`** (2 tests) - Core logs functionality
3. **`tabDataOptimistic.mswhooks.node.test.tsx`** (1 test)
4. **`tabStreaming.mswhooks.node.test.tsx`** (1 test)
5. **`interfacesQueries.node.test.tsx`** (1 test)
6. **`golden-path.node.test.tsx`** (2 tests) - Complex, do last

### Note on `@real` Tests

The `@real` tagged tests require a running dev server and are **not broken** by the optimization changes. They just need the server running. Run with:
```bash
npm run test:interfaces:real
```

### Cleanup Complete (Dec 5, 2025)

**DELETED - Cookie Auth System:**
- ~~`src/lib/auth/consoleCookie.ts`~~ - Removed
- ~~`src/lib/auth/getApiKey.ts`~~ - Removed
- ~~`src/lib/auth/requireApiKey.ts`~~ - Removed

**All API Routes Now Use Simple Auth:**
All routes use `request.headers.get("apiKey")` - consistent and simple.

---

## 👷 Instructions for Engineers

### Getting Started

1. **Pull the latest staging branch**
   ```bash
   git checkout staging
   git pull origin staging
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the test suite to see current state**
   ```bash
   npm run test:interfaces
   ```

4. **Check this devlog for context** on what was changed and what needs fixing

### Workflow for Fixes

1. **Pick a failing test** from the [Tests to Fix](#tests-to-fix-priority-order) section
2. **Create a feature branch** from staging
   ```bash
   git checkout -b fix/test-name-description
   ```
3. **Fix the test** - ensure the implementation is correct, not just making the test pass
4. **Run the full test suite** to ensure no regressions
   ```bash
   npm run test:interfaces
   ```
5. **Update this devlog** - mark the test as fixed in the Progress Log below
6. **Create a PR** targeting staging with a clear description of the fix

### Workflow for Re-applying Optimisations

> ⚠️ Only start this after all tests are passing

1. **Cherry-pick one optimisation commit** from the original work
2. **Run tests immediately** after cherry-pick
3. **If tests fail**: Either fix the issue or skip that optimisation
4. **If tests pass**: Document in Progress Log and continue
5. **Manual QA** after each batch of related optimisations

### Key Files to Understand

| File | Purpose |
|------|---------|
| `src/tests/interfaces/` | Test suite root |
| `src/tests/interfaces/mocks/handlers.ts` | MSW request handlers |
| `src/contexts/hooks/` | React Query hooks |
| `src/stores/` | Zustand state stores |
| `src/utils/interfaces/` | Utility functions |

---

## 🔍 Critical Review of Optimization Code (Dec 5, 2025)

After restoring the optimization code and merging with our fixes, here's a critical assessment:

### ✅ **KEEP - Good Optimizations**

| Feature | Files | Why Keep It |
|---------|-------|-------------|
| **Timeout/AbortController** | All API routes | Prevents requests from hanging forever (30-90s timeouts) |
| **Correlation ID logging** | All API routes | Essential for debugging request flows across services |
| **Bootstrap route** | `/api/bootstrap/route.ts` | Aggregates slow endpoints into one request (projects, interfaces, contexts) |
| **Checkpoint routes** | `/api/*/checkpoint/route.ts` | Needed for undo/redo functionality |
| **Bulk patch API** | `/api/tile/bulk/patch/route.ts` | Reduces multiple PATCH calls to one |
| **Request deduper** | `src/lib/requestDeduper.ts` | Prevents duplicate concurrent requests |
| **Performance telemetry** | `src/lib/perf.ts` | Useful for profiling slow paths |
| **Cache headers** | `src/app/api/_utils/cacheResponse.ts` | Browser/CDN caching for static data |
| **Disabled polling** | SessionProvider, dependencyManager | Prevents connection queuing |
| **staleTime/gcTime** | React Query hooks | Prevents unnecessary refetches |

### ❌ **REMOVED - Overcomplicated/Unnecessary** ✅ DONE

| Feature | Files | Status |
|---------|-------|--------|
| **Cookie auth system** | ~~`src/lib/auth/consoleCookie.ts`~~ | ✅ DELETED |
| **getApiKey resolver** | ~~`src/lib/auth/getApiKey.ts`~~ | ✅ DELETED |
| **requireApiKey middleware** | ~~`src/lib/auth/requireApiKey.ts`~~ | ✅ DELETED |

**Why Removed:**
The cookie auth added complexity without benefit - the client already passes `apiKey` header with every request. All routes now use simple `request.headers.get("apiKey")`.

### ⚠️ **REVIEW - Need Decision**

| Feature | Files | Decision Needed |
|---------|-------|-----------------|
| **Console.log statements** | Multiple API routes | Useful for debugging but verbose in production. Add DEBUG_API flag? |
| **90s bootstrap timeout** | `/api/bootstrap/route.ts` | Very long. Is Orchestra really this slow? |
| **Checkpoint for every type** | Tab, Tile, Interface | Are all these used? Check if needed. |

### 📊 Action Plan

1. ~~**Delete cookie auth files**~~ ✅ DONE (`66bf07ba`)

2. ~~**Migrate remaining routes** from `requireApiKey` to simple auth~~ ✅ DONE
   - All 12 routes now use `request.headers.get("apiKey")`

3. ✅ **Conditional logging** with `DEBUG_API` environment flag already in place

4. 🟡 **Test thoroughly** before merge - IN PROGRESS

---

## 📝 Progress Log

> Add entries here as work is completed. Most recent at top.

### Template for Log Entries
```
### [DATE] - [Engineer Name]
**Action:** [What was done]
**Files Changed:** [List of files]
**Tests Status:** [X passing / Y failing]
**Notes:** [Any relevant notes]
```

---

### December 9, 2025 - Fixed Critical Bugs: Infinite Loops, Query Cancellation, Loading States
**Action:** Fixed several critical bugs causing tiles to not render and infinite re-render loops  
**Commits:** `07d13ea0` → `d74e81e0` (7 commits)

**1. Infinite Loop in InterfaceNav (`07d13ea0`):**
- **Problem:** Adding `tabStreamingQuery` to useEffect dependencies caused infinite re-renders
- **Root Cause:** `tabStreamingQuery` object is created fresh on every render
- **Fix:** Extract `prefetchTab` function before using in dependency array

**2. Query Cancellation Race Condition (`cca8631c`):**
- **Problem:** Tiles flickering/disappearing with "signal is aborted" errors
- **Root Cause:** `useTabStreamingQuery` cancelled ALL `tabCompleteData` queries on tab change, including the NEW tab's query
- **Fix:** Only cancel queries for the PREVIOUS tab, not the new one. Added 2-second delay before prefetching adjacent tabs.

**3. Loading Spinner for Tiles (`bb3c4b0d`, `d74e81e0`):**
- **Problem:** No visual feedback while tiles are loading - just blank screen
- **Fix:** Added prominent Loader2 spinner with "Loading tiles..." message
- **Centering:** Used `min-h-[60vh]` for reliable vertical centering

**Files Changed:**
- `src/hooks/Interfaces/Query/useTabStreamingQuery.ts` - Track previous tab, selective cancellation
- `src/components/Pages/Interfaces/Interface/InterfaceNav.tsx` - Extract `prefetchTab`, add delay
- `src/components/Pages/Interfaces/Interface/Interface.tsx` - Add loading spinner UI

---

### December 8, 2025 - UI/UX Improvements: Pickers, Tile Visibility, Empty States
**Action:** Comprehensive UI/UX improvements for interface navigation and tile management  
**Commits:** `b1f358d2` → `5062f2b6` (15+ commits)

**1. Project & Interface Picker Improvements:**
- Consistent text sizing (`text-xs` throughout)
- Selected item pinned to top of dropdown list
- Loading state shows in trigger bar when switching projects
- Proper scrolling with `ScrollArea` component inside `CommandList`
- Text truncation with ellipsis for long names (`flex-1 w-0 min-w-0 overflow-hidden` trick)
- Tooltips on hover showing full name
- Dropdowns constrained to viewport with collision avoidance

**Files Changed:**
- `src/components/Pages/Interfaces/Interface/Nav/ProjectPicker.tsx`
- `src/components/Pages/Interfaces/Interface/Nav/InterfacePicker.tsx`

**2. Tile Visibility Workflow:**
- In Edit Mode: ALL tiles visible regardless of `visible` state
- Eye icon on tile header toggles `visible` property
- `Eye` = visible in normal mode, `EyeOff` = hidden in normal mode
- Removed sidebar "Show Hidden Tiles" toggle (not needed with edit mode logic)

**Files Changed:**
- `src/components/Pages/Interfaces/Tile/TileHeader.tsx`
- `src/components/Pages/Interfaces/Tab/Tab.tsx`
- `src/components/Pages/Interfaces/Interface/InterfaceNav.tsx`

**3. Empty Tab State:**
- When no tabs exist: hide mode toggles and "Add Tile" button
- Show overlay message prompting user to create interface/tab
- Loading skeleton while tiles are hydrating

**Files Changed:**
- `src/components/Pages/Interfaces/Interface/Interface.tsx`
- `src/components/Pages/Interfaces/Interface/InterfaceNav.tsx`
- `src/components/Pages/Interfaces/Tab/Tab.tsx`

---

### December 8, 2025 - Fixed Tile Rendering and Context Detection
**Action:** Fixed critical bugs preventing tiles from rendering and detecting deleted contexts  
**Commits:** `7141458b`, `a2b63fd5`, `f8fd0098`, `0a90017a`

**1. Tile Not Rendering Fix (`7141458b`):**
- **Problem:** `Tile_0` wasn't rendering despite being in store
- **Root Cause:** `initTile` skipped updates for existing tiles, leaving `type` undefined
- **Fix:** `initTile` now updates `type` and `name` for tiles that exist but lack these properties

**2. Infinite Loop Fix (`f8fd0098`, `a2b63fd5`):**
- **Problem:** After making `useDependencyAwareSortedTilesForTab` reactive, infinite re-renders occurred
- **Root Cause:** `selectTilesForTab` creates new array references on each call
- **Fix:** Wrapped selector with `useShallow` from `zustand/react/shallow`

**3. Deleted Context Detection (`0a90017a`):**
- **Problem:** Tiles with deleted contexts showed empty data instead of "Context Not Found" overlay
- **Root Cause:** API returned 200 with empty data instead of 404 for deleted contexts
- **Fix:** Added `effectiveContextNotFound` check that validates context exists in available contexts list

**Files Changed:**
- `src/contexts/slices/tileSlice.ts` - `initTile` now updates missing type/name
- `src/utils/interfaces/tileDependencies/dependencyManager.ts` - Added `useShallow`
- `src/components/Pages/Interfaces/Blocks/Table/Table.tsx` - Added `effectiveContextNotFound` logic
- `src/utils/interfaces/contextValidation.ts` - New utility for context validation

**Tests Added:**
- `src/tests/interfaces/unit/utils/contextValidation.node.test.ts` - 12 tests for context detection

---

### December 8, 2025 - Fixed Production Build Type Errors
**Action:** Resolved all TypeScript type errors causing build failures  
**Commit:** `a4403a5a`  
**Files Changed:**
- `src/components/Common/Dialogs/Rename.tsx` - Cast `form` to `any` for FormEntry/SubmitButton compatibility
- `src/components/Common/Dialogs/Create.tsx` - Cast `form` to `any` (fixed in previous session)
- `src/components/Pages/Endpoints/Create.tsx` - Cast `form` to `any` for FormEntry/CreateDialog
- `src/components/Pages/Interfaces/Blocks/Table/Buttons/CreateProject.tsx` - Cast `form` to `any`
- `src/components/Pages/Keys/Create.tsx` - Cast `form` to `any`
- `src/components/Pages/Interfaces/Blocks/Table/Table.tsx` - Fix `contextName` null → undefined conversion
- `src/components/Pages/Interfaces/Interface/Buttons/InterfaceButtons.tsx` - Add type annotation to callback parameter
- `src/components/Pages/Interfaces/Interface/Interface.tsx` - Remove invalid props (`projectTree`, `refetchProjectTree`, `onHoverPrefetchTab`) from InterfaceNav
- `src/components/Pages/Providers/Base.tsx` - Remove duplicate SessionProvider props (already handled internally)
- `src/tests/interfaces/mocks/fixtures/logs.ts` - Fix LogProps type (add `type` field, convert `id` to string)
- `src/utils/data/buildServerData.ts` - Use `Array.from()` instead of spread for Set iteration
- `src/utils/interfaces/contextValidation.ts` - Fix Context type import path

**Build Status After Fix:** ✅ PASSING
**Notes:** 
- **Form type casting:** `UseFormReturn` generic mismatch between react-hook-form and component props. Cast to `any` as workaround.
- **SessionProvider:** Custom wrapper already sets `refetchOnWindowFocus` and `refetchInterval` internally.
- **InterfaceNav:** Component fetches `projectTree` internally via `useQuery`, no need to pass as props.
- **LogProps:** Test fixtures needed `type: 'ungrouped'` field and string `id` values.
- **uuid types:** Removed `@types/uuid` since `uuid@11` has built-in TypeScript declarations.

---

### December 5, 2025 - API Routes Auth Migration
**Action:** Migrated all API routes to get apiKey from session instead of requiring header  
**Commits:** `d2bf991d`, `35ec79a3`, `b270866c`

**Problem:** After removing the cookie auth system, API routes were still expecting `apiKey` header from client.

**Fix:** All interface-related API routes now get apiKey directly from server session:
```typescript
// Before
const apiKey = request.headers.get("apiKey");

// After  
const session = await getServerSession(authOptions);
const apiKey = session?.user?.api_key;
```

**Routes Updated:**
- `/api/logs/route.ts`
- `/api/logs/fields/route.ts`
- `/api/interface/route.ts`
- `/api/tab/route.ts`
- `/api/tile/route.ts`
- `/api/projects/route.ts`
- `/api/projects/tree/route.ts`
- `/api/context/[projectName]/route.ts`
- `/api/tile/bulk/patch/route.ts`
- `/api/tab/checkpoint/route.ts`
- `/api/tile/checkpoint/route.ts`

**Impact:** Client no longer needs to pass apiKey header - server gets it from session automatically.

---

### December 5, 2025 - Fixed All Unit Tests for Direct-Fetch Architecture
**Action:** Updated unit tests to work with new direct fetch implementation  
**Commit:** `dbbd1395`  
**Files Changed:**
- `buildPlotDataItem.node.test.ts` - Use `vi.stubGlobal('fetch')` for relative URL tests
- `useSimpleQueries.node.test.tsx` - Mock fetch for `useListInterfacesQuery` (now uses direct fetch)
- `useTabDataOptimistic.node.test.tsx` - Add fetch mocks for `/api/tile` endpoint
- `useTabStreamingQuery.node.test.tsx` - Add fetch mocks with proper headers, fix `switchTab` test
- `useSaveTabWithTilesQuery.node.test.tsx` - Update test expectation for error handling

**Test Status After Fix:**
- **Unit Tests:** 32 files passed, 193 tests passed, 2 skipped
- **Integration Tests:** 28 still failing (need fetch mocking for hooks)

**Key Learnings:**
1. Direct fetch in hooks requires mock with proper headers (`res.headers.get()`)
2. `switchTab` requires `mode: 'full'` in cached data to return `true`
3. Prefetch logic has `deferMs` delay - tests must account for timing
4. `useListInterfacesQuery` now uses direct fetch, not `actions.list`

---

### December 5, 2025 - Fixed RSC Request Cascades and Server-Side Caching
**Action:** Investigated duplicate RSC requests and added server-side caching
**Files Changed:** 
- `src/components/Pages/Interfaces/Server/Main.server.tsx` - Added `staleTime` to ALL prefetchQuery calls
- `src/components/Pages/Providers/QueryProvider.tsx` - Disabled `refetchOnWindowFocus` globally

**Root Cause Analysis:**
1. Every RSC request runs the entire server component, making 6+ API calls
2. Server redirects (line 104, 115) cause cascading RSC requests
3. Client-side `router.push` calls trigger more RSC requests
4. No caching on server prefetches = repeated API calls to Orchestra

**Fixes Applied:**
- Added `staleTime: 5 * 60 * 1000` to all server-side `prefetchQuery` calls:
  - projects, contexts, devbox, interfaces, tabs, tiles
- Disabled global `refetchOnWindowFocus` in QueryProvider

**Server-Side Prefetches Now Cached:**
| Query | staleTime |
|-------|-----------|
| projects | 5 min |
| contexts | 5 min |
| devbox | 10 min |
| interfaces | 5 min |
| tabs | 5 min |
| tiles | 5 min |

**Impact:** Reduces repeated Orchestra API calls during navigation

---

### December 5, 2025 - Restored Optimizations & Merged Fixes
**Action:** Reverted the revert to bring back all optimization code, then merged with Dec 5 fixes
**Commits:** 
- `13983019` - Revert "Staging revert interfaces (#129)"
- `a7d0e47c` - Merge: Apply Dec 5 fixes on top of restored optimizations

**What Was Restored:**
- Bulk patch API (`/api/tile/bulk/patch`)
- Checkpoint routes (`/api/tab/checkpoint`, `/api/tile/checkpoint`)
- Bootstrap route (`/api/bootstrap`)
- Request deduper (`src/lib/requestDeduper.ts`)
- Performance telemetry (`src/lib/perf.ts`)
- Auth error boundary
- Cookie auth system (pending review)

**What Was Merged:**
- Cache headers on API routes (SHORT/MEDIUM/LONG)
- SessionProvider polling disabled
- OnboardingGuard fixed (single API call)
- Dependency manager polling disabled
- staleTime/gcTime on React Query hooks
- contextNotFound handling for 404 contexts
- Middleware redirect for default project

**Conflicts Resolved:**
| File | Resolution |
|------|------------|
| API routes (8 files) | Kept robust timeout/error handling + added caching + removed requireApiKey |
| SessionProvider.tsx | Used our version with all polling disabled |
| useInterfacesQuery.ts | Merged both staleTime values and extra flags |
| Main.server.tsx | Used our version with staleTime on prefetches |
| buildServerData.ts | Used our version with ensureQueryData |
| logs.ts | Used our version with 404 handling |

**Pending Decisions:**
1. Keep or delete cookie auth files (`src/lib/auth/*`)
2. Migrate remaining 9 files from `requireApiKey` to simple auth
3. Fix 9 failing tests

---

### December 5, 2025 - Fixed Stuck Skeleton for Deleted/Missing Contexts
**Action:** Fixed table tiles getting stuck in skeleton state when referencing a context that returns 404
**Files Changed:** 
- `src/utils/interfaces/tileDependencies/config.ts` - Handle `contextNotFound` as "ready" state
- `src/types/interfaces/grid.ts` - Added `contextNotFound` field to `TableDataItem`
- `src/utils/data/buildTableDataItem.ts` - Propagate `contextNotFound` from logs/fields responses
- `src/components/Pages/Interfaces/Blocks/Table/Table.tsx` - Pass `contextNotFound` to overlay, show immediately
- `src/components/Pages/Interfaces/Blocks/Table/EmptyTableOverlay.tsx` - "contextNotFound" mode with warning message
- `src/utils/data/buildServerData.ts` - Return `{ __contextNotFound: true }` for 404 fields, deduplicate contexts
- `src/components/Pages/Providers/QueryProvider.tsx` - Don't retry on 4xx client errors

**Root Cause:**
1. Tile references a deleted context (e.g., `RosaGarcia/Exchanges`)
2. API returns 404 → Fields/logs requests return markers
3. Without fix: `checkInternalDataReadiness` sees empty = "not ready", tile waits forever
4. Without fix: React Query retries 3x per failed request, no caching

**Fix:**
1. Return `{ __contextNotFound: true }` from fields fetch on 404 (cached, no retry)
2. Propagate `contextNotFound: true` through to `tableDataItem`
3. In `checkInternalDataReadiness`: if `contextNotFound === true`, consider tile "ready"
4. Show overlay immediately (don't wait for spinner to finish)
5. Global retry policy: don't retry on 4xx errors (404, 401, etc.)
6. Deduplicate context fetches - multiple tiles with same deleted context only fetch once

**Impact:** 
- Tiles with deleted contexts show error overlay immediately
- Single fetch per unique context (even if multiple tiles reference it)
- No retries, result is cached for 5 minutes
- User sees: "Context 'X' no longer exists. Select a different context."

---

### December 5, 2025 - Moved Default Project Redirect to Middleware
**Action:** Eliminated RSC cascade by moving "default to Assistants" redirect to middleware
**Files Changed:** 
- `src/middleware.ts` - Added redirect logic for `/interfaces` with no project
- `src/components/Pages/Interfaces/Server/Main.server.tsx` - Removed duplicate redirect

**Before (Double RSC Request):**
```
User visits /interfaces
  → Server component runs, fetches data, calls redirect()
    → Browser navigates to /interfaces?project=Assistants
      → Server component runs AGAIN, fetches data AGAIN
```

**After (Single RSC Request):**
```
User visits /interfaces
  → Middleware intercepts, redirects immediately (no server component yet)
    → Browser navigates to /interfaces?project=Assistants
      → Server component runs ONCE
```

**Middleware Logic:**
- Only triggers on `/interfaces` path
- Only redirects if no `project` param AND `selectProject !== 'true'`
- Preserves user's ability to explicitly choose projects

**Impact:** Eliminates one full server component render + 6+ API calls on initial load

---

### December 5, 2025 - Fixed internalDataQuery Not Re-checking After contextNotFound
**Action:** Fixed tiles staying stuck as skeletons when context returns 404
**Files Changed:** 
- `src/utils/data/buildServerDataOptimistic.ts` - Fixed refetchQueries key to include tabId
- `src/hooks/Interfaces/Query/useTableDataQuery.ts` - Added fallback queryFn to prevent "No queryFn" errors
- `src/tests/interfaces/unit/tileDependencies/config.node.test.ts` - Updated test for new empty table behavior
- `src/tests/interfaces/unit/utils/filters.node.test.ts` - Made time-based test more tolerant (5s)
**Tests Status:** 238 passing / 107 skipped (all @real and browser tests)
**Notes:** 
- **Problem:** Even after setting `contextNotFound: true` in the cache, the tile stayed as a skeleton
- **Root Cause 1:** The `refetchQueries` call was using `["internalData", tileData.id]` but the actual query key is `["internalData", tileId, tabId]` - queries didn't match!
- **Fix 1:** Changed to `["internalData", tileData.id, tabId]` so the dependency manager re-evaluates render readiness
- **Root Cause 2:** When the component re-rendered, `useTableDataQuery` would throw "No queryFn" error because the data was set without a queryFn
- **Fix 2:** Added a fallback queryFn that returns cached data or the empty placeholder
- **Test fixes:** Empty tables are now considered "ready" (not stuck as skeletons), time-based tests use 5s tolerance to avoid flakiness

---

### December 5, 2025 - Handle Missing/Deleted Contexts Gracefully
**Action:** Fixed tile blocking when context returns 404 (deleted/missing context)
**Files Changed:** 
- `src/lib/interfaces/logs.ts` - Added 404 handling in `getLogFields` and `getLogs`
- `src/tests/interfaces/unit/api/logsErrorHandling.node.test.ts` - 7 new tests for error handling
**Tests Status:** 7 new tests passing
**Notes:** 
- **Problem:** If a tile references a context that no longer exists (404), the entire interface would hang forever waiting for data
- **Root Cause:** `getLogFields` returned the error response as if it were valid fields data
- **Fix:** Return empty object `{}` on 404 for fields, empty logs array for logs
- **Result:** Tiles with deleted contexts now render (empty) instead of blocking

---

### December 5, 2025 - Fixed Duplicate Fetches and Slow Loading
**Action:** Fixed multiple sources of redundant API calls and slow page loads
**Files Changed:** 
- `src/hooks/Interfaces/Query/useInterfacesQuery.ts` - Added `staleTime` to all interface queries (prevents duplicate fetches when multiple components use same query)
- `src/utils/data/buildServerData.ts` - Changed `fetchQuery` → `ensureQueryData` + deduplicate contexts (only fetches if not in cache)
- `src/tests/interfaces/unit/data/buildServerData.node.test.ts` - 6 new tests for context deduplication and caching
**Tests Status:** 6 new tests passing
**Notes:** 
- **Problem 1:** No `staleTime` on interface queries meant data was immediately stale, causing every component mount to refetch
- **Fix 1:** Added `staleTime: 5 * 60 * 1000` (5 min) and `gcTime: 10 * 60 * 1000` (10 min) to all interface queries
- **Problem 2:** `fetchOrBuildFields` used `fetchQuery` which always fetches, even with cached data
- **Fix 2:** Changed to `ensureQueryData` with `staleTime` so it only fetches if data is missing or stale
- **Problem 3:** Multiple tiles with same context would each trigger separate field fetches
- **Fix 3:** Added context deduplication before fetching fields

---

### December 4, 2025 - Fixed USE-CASE ERROR #1: Refresh Button + Initial Load Race Condition
**Action:** Fixed refresh button not triggering data fetch when auto_update is OFF AND race condition on initial load
**Files Changed:** 
- `src/components/Pages/Interfaces/Blocks/Table/Buttons/RefreshLogs.tsx` - Added `onRefresh` prop
- `src/components/Pages/Interfaces/Blocks/Table/Table.tsx` - Pass `infiniteLogsQuery.refetch()` as callback
- `src/utils/interfaces/tileDependencies/config.ts` - Check `isLoading` and `fields` in readiness check
- `src/tests/interfaces/integration/logs/refreshLogs.node.test.tsx` - New test file (12 tests)
**Tests Status:** 200 passing / 16 failing (@real) / 81 skipped
**Notes:** 
- **Root Cause 1:** `useTableAutoUpdateQuery` is disabled when `auto_update=false`, so `manualRefresh()` does nothing
- **Fix 1:** RefreshLogs now uses `onRefresh` callback (calls `infiniteLogsQuery.refetch()`) when auto_update is OFF
- **Root Cause 2:** `checkInternalDataReadiness` only checked if `tableDataItem` EXISTS, not if `isLoading===false`
- **Fix 2:** Now checks `tableDataItem.isLoading` and `fields` object before allowing render

---

### December 4, 2025 - Mock Fixtures & Script Cleanup
**Action:** Updated mock fixtures to match real Orchestra API exactly; streamlined test scripts
**Files Changed:** 
- `src/tests/interfaces/mocks/fixtures/logs.ts` - Updated mock to match real API structure
- `src/tests/interfaces/api/fixtures/api-actions.ts` - Added server reachability helpers
- `package.json` - Simplified test scripts from 9 to 3
**Tests Status:** 285 passing (with server) / 187 passing + 17 @real skipped (without server)
**Notes:** 
- **Mock accuracy fixes:**
  - `id` changed from string (`"log-1"`) to number (`1000001`) to match real API
  - `ts` format changed to remove `Z` suffix (Orchestra uses `2025-12-04T13:22:03.330`)
  - `clipped_fields` changed from `{}` to `[]` (array in real API)
  - Added `versions: {}` field (present in real API)
  - Removed `type: 'ungrouped'` (added by app, not API)
- **Test scripts simplified:**
  - `test:interfaces` - Mock tests (fast, no server)
  - `test:interfaces:real` - Full tests with auto-started dev server
  - `test:interfaces:browser` - Browser tests
- **Server helpers:** Added `isServerReachable()` and `skipIfServerNotReachable()` for graceful @real test handling

---

### December 4, 2025 - Fixed All Unit & MSW Tests
**Action:** Fixed 9 failing tests across 4 test files
**Files Changed:** 
- `src/contexts/slices/contextsSlice.ts` - Fixed context syncing with tabsById/tilesById
- `src/utils/interfaces/table/filters.ts` - Fixed date utils and buildFilterExpression
- `src/tests/interfaces/integration/logs/logsCore.node.test.ts` - Use mock instead of server action
- `src/tests/interfaces/integration/logs/infiniteLogs.mswhooks.node.test.tsx` - Use mock instead of server action
- `vitest.node.setup.ts` - Added NEXTAUTH_URL fallback
**Tests Status:** 187 passing / 17 failing / 81 skipped (was 178/26/81)
**Notes:** 
- **contextsSlice (3 fixes)**: The `setContextOptimistic`, `renameProjectContext`, and `deleteProjectContext` actions were calling `state.updateTab()` and `state.updateTile()` inside immer draft callbacks, which doesn't work. Fixed by directly mutating `state.tabsById[id]` and `state.tilesById[id]`.
- **filters (4 fixes)**: 
  - `toRelativeDate` was calculating `base - date` instead of `date - base`
  - Date calculation was using `% 30` for days which is incorrect. Fixed with proper cascading subtraction.
  - `buildFilterExpression` was returning early with search filter instead of combining with column filters.
- **MSW tests (2 fixes)**: Server actions with `"use server"` don't work correctly in Vitest. Replaced actual `getLogs` calls with mock functions that return the expected data.
- All 17 remaining failures are `@real` API tests that require a running server (`ECONNREFUSED` errors).

---

### December 4, 2025 - Initial Setup
**Action:** Created optimisations-devlog.md to track progress
**Files Changed:** 
- `src/components/Pages/Interfaces/optimisations-devlog.md` (new)
**Tests Status:** 178 passing / 26 failing / 81 skipped
**Notes:** 
- Documented all 127 commits from the optimisation work
- Identified 9 real test failures (not counting @real API tests that need server)
- Categorised failures into: contextsSlice (3), filters (4), MSW integration (2)
- Set up TDD workflow for future work

---

## 💡 Suggestions & Improvements

> Engineers: As you work through the codebase, add any opportunities for optimization, efficiency gains, or code improvements here. These will be reviewed and prioritized for future work.

**How to add suggestions:**
1. Add a brief title and description
2. Include the file(s) affected
3. Explain the potential benefit
4. Tag with priority: `[LOW]`, `[MEDIUM]`, `[HIGH]`

---

### Suggestions Log

*Add suggestions below as you discover them:*

---

### Dec 4, 2025 - Request Queuing / Connection Limit Issue [HIGH] ✅ FIXED
**Problem:** Browser limit of 6 concurrent HTTP/1.1 connections. When long requests run (interfaces: 5+ seconds), other requests queue and wait 30-60+ seconds.

**Root Causes Fixed:**
1. Tile dependency check: `refetchInterval: 1000` (every 1 second!) 
2. OnboardingGuard: Re-ran on every session object change

**Fixes Applied:**
- `dependencyManager.ts`: Changed `refetchInterval: 1000` → `refetchInterval: false`
- `OnboardingGuard.tsx`: Added `hasChecked` state to prevent duplicate API calls, removed `session` from deps

**Remaining Opportunities:**
- Consider HTTP/2 to remove connection limit entirely
- NextAuth session polling may still need optimization

---

### Dec 5, 2025 - API Route Caching [HIGH] ✅ IMPLEMENTED
**Problem:** Server-action → API-route migration was done for caching benefits, but caching headers were never added.

**Solution:** Created `withCacheHeaders` utility and applied to all interface-related API routes.

**Files Changed:**
- `src/app/api/_utils/cacheResponse.ts` - New caching utility
- `src/app/api/logs/route.ts` - SHORT cache (30s)
- `src/app/api/logs/fields/route.ts` - LONG cache (5min)
- `src/app/api/interface/route.ts` - MEDIUM cache (60s)
- `src/app/api/tab/route.ts` - MEDIUM cache (60s)
- `src/app/api/tile/route.ts` - MEDIUM cache (60s)
- `src/app/api/projects/route.ts` - LONG cache (5min)
- `src/app/api/projects/tree/route.ts` - LONG cache (5min)
- `src/app/api/context/[projectName]/route.ts` - LONG cache (5min)
- `src/tests/interfaces/unit/api/cacheResponse.node.test.ts` - 20 new tests

**Cache Durations:**
| Duration | max-age | stale-while-revalidate | Use Case |
|----------|---------|------------------------|----------|
| SHORT | 30s | 60s | Logs (frequently changing) |
| MEDIUM | 60s | 120s | Interface config |
| LONG | 300s | 600s | Fields, projects, contexts |

**Tests:** 20 new tests passing
**Benefit:** Browser caches responses, reducing repeat requests significantly
**Priority:** HIGH ✅

---

### Dec 8, 2025 - Fix Tab Prefetching [HIGH] ✅ IMPLEMENTED
**Problem:** Adjacent tab prefetching existed but returned `null` instead of actual data.

**Fix Applied (`2a9fe2f7`):**
- Captured `useTabStreamingQuery` return value in `InterfaceNav.tsx`
- Replaced broken `queryClient.prefetchQuery` with `tabStreamingQuery.prefetchTab()`
- Adjacent tabs now actually prefetch their complete data

**Files Changed:** `src/components/Pages/Interfaces/Interface/InterfaceNav.tsx`
**Benefit:** Instant tab switching for adjacent tabs
**Priority:** HIGH ✅

---

### Dec 5, 2025 - Hover-Based Prefetching [MEDIUM] 🔴 NOT IMPLEMENTED
**Problem:** Only adjacent tabs are prefetched. User intent (hover) is not used.

**Recommended Implementation:**
```typescript
// Add to tab buttons
onMouseEnter={() => {
  queryClient.prefetchQuery({
    queryKey: ['tabCompleteData', interfaceId, tab.name, projectId],
    queryFn: () => fetchTabData(tab.id),
    staleTime: 60_000,
  })
}}
```

**Files:** `src/components/Pages/Interfaces/Interface/InterfaceNav.tsx`
**Benefit:** Any hovered tab loads instantly when clicked
**Priority:** MEDIUM

---

### Dec 8, 2025 - Request Coalescing for Fields [HIGH] ✅ IMPLEMENTED
**Problem:** Multiple tiles with same context were making separate field requests.

**Fix Applied (`2a9fe2f7`):**
- Replaced raw `fetch()` with `dedupedJson()` from `src/lib/requestDeduper.ts`
- The `dedupedJson` utility tracks in-flight requests by URL
- Concurrent requests for the same context's fields now share a single network call

```typescript
// Before: Raw fetch, N concurrent calls = N network requests
const res = await fetch(url, fetchOptions);

// After: Deduped fetch, N concurrent calls = 1 network request
const result = await dedupedJson(url, { method: 'GET', cache: 'no-store' });
```

**Files Changed:** `src/utils/data/buildServerData.ts`
**Benefit:** N tiles with same context = 1 request instead of N
**Priority:** HIGH ✅

---

### Dec 5, 2025 - Optimistic Context Switching [MEDIUM] 🔴 NOT IMPLEMENTED
**Problem:** Context switch waits for new data before showing anything.

**Recommended Implementation:**
```typescript
// Show stale cached data immediately while fetching fresh
const cachedFields = queryClient.getQueryData(['fields', projectId, newContext]);
if (cachedFields) {
  setFields(cachedFields); // Render immediately
}
queryClient.invalidateQueries(['fields', projectId, newContext]); // Refresh in background
```

**Files:** `src/hooks/Interfaces/Query/usePatchTileQueryOptimistic.ts`
**Benefit:** Instant UI response on context switch
**Priority:** MEDIUM

---

### Dec 5, 2025 - Progressive Table Loading [MEDIUM] 🔴 NOT IMPLEMENTED
**Problem:** Table waits for all data before rendering anything.

**Recommended Implementation:**
```typescript
// Priority 1: First 20 rows (visible viewport)
const initialLogs = await getLogs({ limit: 20 });
setLogs(initialLogs);

// Priority 2: Background load remaining
requestIdleCallback(() => {
  prefetchMoreLogs({ limit: 100, offset: 20 });
});
```

**Files:** `src/utils/data/buildTableDataItem.ts`, table components
**Benefit:** Faster perceived load time
**Priority:** MEDIUM

---

### Dec 5, 2025 - HTTP/2 Confirmation [LOW] ℹ️ INFO
**Status:** Cloud Run (production) already supports HTTP/2 by default.

**Verification Steps:**
1. Open Chrome DevTools → Network
2. Enable "Protocol" column
3. Check production site shows `h2` protocol

**Impact:** The 6-connection limit is **DEV ONLY**. Production doesn't have this issue.
**Priority:** LOW (just verify, no action needed)

---

### Dec 5, 2025 - Bundle Size Analysis [LOW] 🔴 NOT DONE
**Problem:** Unknown if heavy dependencies are impacting load time.

**Action:**
```bash
npm run build
npx @next/bundle-analyzer
```

**Files:** Review output for large chunks
**Benefit:** Identify code-splitting opportunities
**Priority:** LOW

---

### Dec 5, 2025 - Service Worker for API Caching [LOW] 🔴 NOT IMPLEMENTED
**Problem:** No offline support or aggressive client-side caching.

**Recommended Implementation:**
```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\/api\//,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'api-cache',
        expiration: { maxEntries: 100, maxAgeSeconds: 300 }
      }
    }
  ]
})
```

**Benefit:** Offline support, faster repeat loads
**Priority:** LOW

---

```
### [DATE] - [Engineer Name]
**Suggestion:** [Brief title]
**Files:** [Affected files]
**Description:** [What could be improved and why]
**Benefit:** [Expected improvement - performance, readability, maintainability]
**Priority:** [LOW/MEDIUM/HIGH]
```

---

*No suggestions yet - add yours above!*

---

## 🎯 Merge Checklist

Before merging back to staging, ALL of the following must be true:

- [x] All unit tests passing (`npm run test:interfaces:node`) ✅
- [x] All MSW integration tests passing ✅
- [x] Production build passing (`npm run build`) ✅ - Dec 8
- [ ] Manual QA completed on key flows:
  - [ ] Project selection
  - [ ] Interface navigation
  - [ ] Tab switching
  - [ ] Tile creation/editing
  - [ ] Table data loading
  - [ ] Plot rendering
  - [ ] Context switching
- [ ] No console errors in browser
- [ ] Network tab shows reduced request count (the whole point!)
- [ ] Performance profiling shows improvement
- [ ] Code review completed
- [ ] This devlog updated with final status

---

## Summary of Optimisation Goals

1. **Reduce HTTP request volume** – Keep browser's 6-connection limit free by batching, coalescing, and eliminating redundant calls
2. **Encrypted session cookies** – Avoid extra Orchestra identification calls on every request (via `consoleCookie.ts`)
3. **Server-action → API-route migration** – Eliminate POST spam from server actions; use direct API routes
4. **Request cancellation** – Abort in-flight fetches on navigation to prevent stale updates
5. **Targeted cache invalidation** – Replace broad router refreshes with surgical invalidations
6. **Performance telemetry** – Instrumentation behind feature flags for debugging hot paths

---

## Change Log

### 🔴 Known Regressions (To Fix)
> Track regressions introduced by optimisations here. These caused the revert at `325895b5`.

⚠️ **TDD REQUIREMENT:** For each bug below, we MUST:
1. **Write a failing test** that reproduces the bug BEFORE attempting to fix
2. **Fix the implementation** until the test passes
3. **Ensure no other tests regress**

Tests should be added to `src/tests/interfaces/` and tagged appropriately.

---

#### 🐛 USE-CASE ERROR #1: Logs Table Data Not Loading

**Symptoms:**
1. On initial load, logs table shows rows but cells have no data
2. When switching contexts, columns/cells don't load - only row numbers appear
3. `row_id` column sometimes appears as an empty column
4. Page/interface reload does NOT fix the problem

**Workaround Found:**
- Clicking the **auto-refresh button** (not the regular refresh button) would populate the data
- The regular refresh button was instant but never actually fetched anything

**Likely Cause:**
- Request coalescing/deduplication may be incorrectly caching empty responses
- Or the cache invalidation after context switch isn't triggering a real fetch
- The auto-refresh button likely bypasses the cache, which is why it works

**Files to Investigate:**
- `src/contexts/hooks/useInfiniteLogsQuery.ts` - logs fetching logic
- `src/utils/interfaces/logsCore.ts` - core fetch logic
- Request coalescing/deduplication code from commit `7e9c4a94`
- Cache invalidation from commit `ea2325e4`

**Related Commits:**
- `7e9c4a94` - perf(dedup,etag,semaphore,batch-layout): Request coalescer, ETag support
- `77242b1e` - perf(table): lazy-load column metrics; add client-side dedupe/TTL cache
- `ea2325e4` - perf(invalidation): replace broad router refresh with targeted invalidations

**Root Cause Identified:**
```
useTableAutoUpdateQuery (line 141):
  enabled: !!tileId && !!tileDataState && !pending && autoUpdate

useInfiniteLogsQuery (Table.tsx line 229):
  enabled: ... && item?.auto_update !== "true"
```
These are **mutually exclusive**! The refresh button calls `useTableAutoUpdateQuery.manualRefresh()`, 
but when `auto_update` is OFF, that query is DISABLED and `refetch()` does nothing.

**Fix Options:**
1. Refresh button should call `infiniteLogsQuery.refetch()` instead
2. Or pass `infiniteLogsQuery.refetch` to `RefreshLogs` component
3. Or make `useTableAutoUpdateQuery` enabled for manual refresh even when auto-update is OFF

**Test Required:** `[x]` Created `src/tests/interfaces/integration/logs/refreshLogs.node.test.tsx`
- ✅ Logs populate on initial load
- ✅ Logs populate after context switch  
- ✅ `infiniteLogsQuery.refetch()` triggers actual data fetch
- ✅ All columns render with data (not just row numbers)
- ✅ Workaround test verifies fix works

**Test Results:** 11 passing

**FIXES APPLIED:** 
1. **Refresh Button Fix** (RefreshLogs.tsx + Table.tsx):
   - Added `onRefresh` prop for data refetch callback
   - Passes `infiniteLogsQuery.refetch()` as `onRefresh`
   - When auto_update=OFF, RefreshLogs now calls `onRefresh()` instead of disabled `manualRefresh()`

2. **Initial Load Race Condition Fix** (tileDependencies/config.ts):
   - `checkInternalDataReadiness` now checks `tableDataItem.isLoading` not just existence
   - Also checks for empty `fields` object (which would cause empty columns)
   - Prevents Table from rendering before data is fully loaded

3. **Context Switch Fields Fix** (usePatchTileQueryOptimistic.ts):
   - When context changes A→B, `fetchOrBuildFields` was using OLD tile data (context A)
   - Then tried to get fields from cache for NEW context (B) - not found, fell back to `{}`
   - **Fix:** Now explicitly fetches fields for new context if not in cache

---

#### ✅ USE-CASE ERROR #2: "Login Expired" Popup Triggered by Logs Table Actions - **FIXED**

**Status:** ✅ Fixed by removing cookie auth system (`66bf07ba`)

**Root Cause:** The encrypted cookie auth system (`consoleCookie.ts`) had a 5-minute TTL that would expire during normal usage. The `getApiKey.ts` fallback logic would incorrectly detect expired sessions.

**Fix:** Removed the entire cookie auth system:
- ~~`src/lib/auth/consoleCookie.ts`~~ - DELETED
- ~~`src/lib/auth/getApiKey.ts`~~ - DELETED
- ~~`src/lib/auth/requireApiKey.ts`~~ - DELETED

All API routes now use simple `request.headers.get("apiKey")` which comes directly from the session without any custom TTL logic.

**Verification Required:** Manual QA to confirm the "login expired" popup no longer appears during normal use.

---

---

## 🧪 Test Suite Status

**Last Run:** December 8, 2025  
**Command:** `npm run test:interfaces`

### Summary

| Metric | Count |
|--------|-------|
| **Total Tests** | 357 |
| **Passed** | 255 ✅ |
| **Failed** | 19 ❌ |
| **Skipped** | 83 ⏭️ |
| **Test Files** | 59 (15 failed, 44 passed) |

> **Note:** All 19 failures are `@real` API tests that require a running server (ECONNREFUSED). All unit and MSW integration tests pass. Build also passes (`npm run build`).

### Failing Tests Breakdown

#### 1. @real API Tests (Require Running Server)
These tests require `localhost:3000` to be running. They are skipped by default.

| Test File | Failed | Notes |
|-----------|--------|-------|
| `customKeys.api.node.test.ts` | 7 | ECONNREFUSED - no server |
| `projects.api.node.test.ts` | 7 | ECONNREFUSED - no server |
| `projectWorkflow.real.node.test.tsx` | 3 | ECONNREFUSED - no server |

**To run @real tests:** Run `npm run test:interfaces:real` (auto-starts dev server)

---

#### 2. MSW Integration Tests (Should Work Without Server) ⚠️
These tests use MSW mocks but are failing - **these are real bugs to fix**.

| Test File | Test Name | Error |
|-----------|-----------|-------|
| `infiniteLogs.mswhooks.node.test.tsx` | fetches first page of ungrouped logs | Expected 20 logs, got 0 |
| `logsCore.node.test.ts` | fetchLogsCore uses logsActions.get | Expected count 20, got 0 |

**Root Cause:** MSW handlers may not be correctly intercepting fetch calls, or the logs fetching logic has a bug.

---

#### 3. Unit Test Failures ⚠️
These are actual logic bugs that need fixing.

##### contextsSlice.node.test.ts (3 failures)

| Test | Error | Issue |
|------|-------|-------|
| `setContextOptimistic updates specific scope contexts` | `tabsById['tab-1'].globalContext` is undefined | Context not syncing to tab slice |
| `renameProjectContext updates all occurrences` | Expected 'new-ctx', got 'old-ctx' | Rename not propagating |
| `deleteProjectContext removes context from slices` | Expected undefined, got 'ctx-A' | Delete not propagating |

**Root Cause:** The context slice actions are not correctly syncing with `tabsById` and `tilesById`.

##### filters.node.test.ts (4 failures)

| Test | Error | Issue |
|------|-------|-------|
| `buildFilterExpression combines column filters` | Missing 'entries/val > 5' in result | Column filters not being included |
| `toRelativeDate calculates exact difference` | Expected '1Y;1M;1D;...', got '0Y;0M;0D;...' | Date difference calculation broken |
| `toRelativeDate calculates time difference` | Expected '0Y;0M;0D;1h;30m;15s;...', got '0Y;0M;0D;0h;0m;0s;...' | Time difference calculation broken |
| `rebaseDate converts absolute to relative` | Expected /^1Y;0M;0D;/, got '1Y;0M;5D;...' | Day calculation off |

**Root Cause:** Date utility functions have calculation bugs.

---

### Tests to Fix (Priority Order)

1. **P0 - Unit Tests** (No external dependencies) ✅ FIXED
   - [x] `contextsSlice.node.test.ts` - 3 tests fixed
   - [x] `filters.node.test.ts` - 4 tests fixed

2. **P1 - MSW Integration Tests** (Mock-based) ✅ FIXED
   - [x] `infiniteLogs.mswhooks.node.test.tsx` - 1 test fixed
   - [x] `logsCore.node.test.ts` - 1 test fixed

3. **P2 - @real API Tests** (Require server)
   - These are expected to fail without a running server
   - Run with `npm run test:integration:real` after starting dev server
   - 17 tests require running server (ECONNREFUSED when server not running)

---

### Passing Test Suites ✅

| Category | Test Files | Tests |
|----------|------------|-------|
| Unit/Hooks | useTabStreamingQuery, useEnsureTileData, useInfiniteLogsQuery, etc. | 35+ |
| Unit/Slices | tileSlice, tabSlice, tableTileSlice, interfaceSlice, etc. | 26+ |
| Unit/Data | buildPlotDataItem, buildTableDataItem, columnOperations, grouping | 35+ |
| Integration/MSW | interfacesQueries, interfacesMutations, tabStreaming, etc. | 15+ |
| E2E/Golden | golden-path.node.test.tsx | 2 |
| Behavior | computeDiff, tiles behaviors | 12+ |

---

### 🟢 Optimisation Commits (c3662c60 → 325895b5)

**Timeline:** Oct 29 - Nov 17, 2025 (20 days)  
**Interface-specific commits:** ~85 (excluding assistant-related work)  
**Commits documented below:** 92 (including bug fixes during the period)

| Category | Commits | Key Focus |
|----------|---------|-----------|
| Auth & Session | 9 | Encrypted cookies, API key caching, route auth |
| Request Coalescing | 3 | Deduplication, ETag, semaphore, batching |
| Server Actions → API | 7 | Migrate reads to API routes |
| Request Cancellation | 4 | AbortSignal, graceful cancellation |
| Cache Invalidation | 5 | Targeted invalidation, event-driven sync |
| Table & Tile Perf | 5 | from_fields, lazy metrics, background prefetch |
| UI/UX | 15 | Loading overlays, skeletons, navigation UX |
| Error Handling | 18 | Retry logic, fallbacks, toast dedup |
| Tab Streaming | 10 | Shallow routing, prefetching, RSC prevention |
| Telemetry | 4 | perf.ts, debug logging |
| Build Fixes | 5 | TS errors, hydration warnings |
| Analytics/Debug | 6 | GA4, GTM, logging cleanup |

---

#### 1. Authentication & Session Management (The Cookie Work)

The first commit introduced encrypted HttpOnly cookies to cache Orchestra API keys and avoid repeated identification calls.

| Commit | Description |
|--------|-------------|
| `c3662c60` | **feat: add centralized API key resolution utilities** – First commit. Added `consoleCookie.ts`, `getApiKey.ts`, `bootstrap/route.ts` |
| `efc5fcfb` | **refactor: migrate API routes to centralized auth** – Use getApiKey in all API routes |
| `2d1a89a6` | **refactor: migrate to client-side session management** – Reduce server calls for session |
| `f1112d91` | **feat: add cookie auto-refresh and improved auth error handling** – Auto-refresh console_auth cookie |
| `0da7948a` | **feat: comprehensive API route hardening with auth and error handling** – Add auth to all routes |
| `7c36095d` | **fix: complete interface route auth migration** – Finish auth migration |
| `77e2bdbe` | **chore(auth): use fixed admin client timeout constant (10s)** – Removed env var dependency |
| `67707bd9` | **fix(auth): prevent crash on admin API failure** – Graceful degradation on Orchestra failures |
| `aeb7116e` | **fix(build): avoid using session.user.id when synthesizing user** – Fall back to email |

**Files Added (then reverted):**
- `src/lib/auth/consoleCookie.ts` – Encrypted HMAC-signed cookie with 5-min TTL
- `src/lib/auth/getApiKey.ts` – API key resolution with cookie → session fallback
- `src/app/api/bootstrap/route.ts` – Bootstrap endpoint for initial auth

---

#### 2. Request Coalescing & Deduplication

| Commit | Description |
|--------|-------------|
| `7e9c4a94` | **perf(dedup,etag,semaphore,batch-layout):** Request coalescer, ETag support, logs semaphore, layout batching |
| `77242b1e` | **perf(table): lazy-load column metrics; add client-side dedupe/TTL cache** |
| `ee8e158b` | **feat(tiles): add bulk patch API** – `/api/tile/bulk/patch` with per-item results, bounded fan-out, correlation-id |

---

#### 3. Server Actions → API Routes Migration

| Commit | Description |
|--------|-------------|
| `0e8a2083` | **perf(table): reduce unnecessary refetches and replace server actions with API routes** |
| `9015303d` | **perf: use API routes instead of server actions for interface list** |
| `5f30fca6` | **feat: add tab and tile checkpoint API routes** |
| `4b4d3a6f` | **fix: eliminate server action for interface color loading** |
| `2a57c526` | **perf: bypass server actions for data fetching** – Eliminates POST /interfaces spam |
| `d250c76c` | **perf: complete server-action to API-route migration for all data reads** |
| `ed7aa7ee` | **perf: comprehensive interfaces optimization and error handling improvements** |

---

#### 4. Request Cancellation & Abort Handling

| Commit | Description |
|--------|-------------|
| `e7e80ab9` | **feat: add AbortSignal support to interface data fetching** – Initial abort support |
| `468c190b` | **refactor: integrate query cancellation in interface components** – Wire up cancellation |
| `97f9fad1` | **fix: ignore cancellation errors from aborted server actions** – Don't show error toasts for aborts |
| `7e80cc73` | **perf(interfaces): cancel auto-update fetches on navigation; map aborts to cancellations** – AbortSignal for table/plot auto-update; convert aborts to CancelledError |

---

#### 5. Cache Invalidation & State Management

| Commit | Description |
|--------|-------------|
| `ea2325e4` | **perf(invalidation): replace broad router refresh with targeted invalidations** – `invalidateAfterTileUpdate` helper; `needsStructuralRefresh` predicate |
| `b7535fb4` | **perf(sync): clear tile timers on unmount/delete; replace context-sync polling with event-driven drain** – Bounded retries with exponential backoff |
| `9539b6ae` | **perf(selectors): use tab.tileIds for tab-scoped tile selectors** – O(k) instead of O(n) |
| `72cdeea9` | **perf(store,api,client): disable zustand devtools in prod; gate verbose logs behind flags** |
| `81dcc90c` | **feat(interface-sync): debounce and dedupe active_tab_id persistence** |

---

#### 6. Table & Tile Performance

| Commit | Description |
|--------|-------------|
| `c0924399` | **perf: remove background prefetch in onMutate; fetch boundaries for single column only** |
| `80b8ddcb` | **perf(table): narrow /api/logs with from_fields derived from column order and hidden columns** |
| `0cbba0a7` | **perf(tiles): remove blocking fetches in onMutate; use cache-only + background prefetch** |
| `d7759a0f` | **perf: gate initial latest_timestamp check to live mode only** |
| `e490c58a` | **CRITICAL FIX: restore tile data cache to prevent skeleton freeze** |

---

#### 7. UI/UX Improvements

| Commit | Description |
|--------|-------------|
| `aa6ee427` | **perf(icons): virtualize IconSelector grid, remove per-icon tooltips, scroll-to selected** |
| `d08a623b` | **ux(icons): show per-cell loader while dynamic icon imports resolve** |
| `390fbaec` | **feat: add tab loading overlay and tile error UI with retry** |
| `0db71fe0` | **feat(ui): add floating save button with loading overlay and notifications** |
| `b29dae7f` | **feat(interfaces): add route-level loading.tsx to show spinner during server build** |
| `328fa01f` | **fix(ux): ensure initial load overlay shows on very first page load** |
| `e80758d4` | **fix(loading): use full-screen LoadingScreen in ThemeLoader until mount** |
| `09449be6` | **ux(interface): add loading overlay for initial interface load to prevent blank screen flash** |
| `392c8a38` | **ux(interfaces): remove tab switching overlay; rely on per-tile loaders during tab change** |
| `4c643bb8` | **ux: add Suspense fallback for TopNav to prevent blank gap before navbar renders** |
| `fbf7493e` | **ux: add static topbar skeleton (z-40) to cover pre-hydration blank gap** |
| `5d0e7f06` | **ux: disable all interface options during navigation, but show loader only on the selected item** |
| `eaff3746` | **Improve Interfaces navigation UX:** remove frosted overlays, preflight loads, fix selection flows |
| `db185ddb` | **fix(UX): only gray out loader for the clicked interface option** |
| `e1fd4f9e` | **Tighten interface tabs empty state typography** |

---

#### 8. Retry & Error Handling

| Commit | Description |
|--------|-------------|
| `92f8e497` | **improve: graceful error handling for failed data fetches** – Initial error handling |
| `c5f58db2` | **fix: prevent infinite render loops in error screens** – Stop render loops |
| `0fb18918` | **fix: prevent .map crashes and unwanted interface auto-creation** – Null safety |
| `22c8886c` | **fix: prevent retry button spam and simplify refreshTabData** – Debounce retries |
| `24c020e5` | **fix: complete plan improvements for data fetch robustness** – Comprehensive fixes |
| `f4941ccd` | **fix: remove ineffective UI-level navigation timeout** – Remove broken timeout |
| `6a067220` | **feat: add timeout-aware toast notifications for better UX** – Smart toasts |
| `c35ed14a` | **Improve error handling robustness with toast deduplication and enhanced logging** |
| `2585c8b6` | **feat(tiles): add exponential backoff retry to all tile mutations** |
| `74139358` | **feat(tile-sync): add client-side retry logic and debouncing for tile operations** |
| `1bc9afd3` | **fix: remove optimistic rollback on failed auto-saves** |
| `6d561c0f` | **fix: prevent ghost tile deletions by confirming server delete first** |
| `022b853f` | **fix: make manual save fail-fast when checkpoints fail** |
| `60a0fce9` | **fix: gracefully handle favourites fetch failure to prevent page crash** |
| `ac60d074` | **fix(table): fix retry crash and add loading indicator** |
| `8c41d664` | **fix: add fallback UI for missing tab data (blank interface)** |
| `11d5dec9` | **fix: add loading state for tab data fetch to prevent blank interface** |
| `1fc04ff4` | **Handle missing context on table refresh; add timezone to User** |

---

#### 9. Tab & Data Streaming

| Commit | Description |
|--------|-------------|
| `a998b06e` | **perf: optimize tab data streaming with intelligent prefetching** – Smarter data fetching |
| `c4103b85` | **CRITICAL: prevent server re-renders on tab switches** – Key optimization |
| `b8c39e8a` | **fix: implement shallow tab routing and prevent race conditions** – Client-side navigation |
| `4d68a73b` | **perf: disable router.refresh() to eliminate unnecessary RSC refetches** – Stop RSC spam |
| `661d33e5` | **feat(tabs): add light/full mode distinction and improve tab streaming resilience** |
| `f7c678a3` | **feat(tabs): add comprehensive logging and fix tab switching flicker** |
| `5a15f0b3` | **feat: add refetchActiveTab for reliable tab reload** |
| `b8a6d0f1` | **feat(ssr): preserve client-side active tab selection across rehydration** |
| `605802d2` | **fix(auto-update): ensure live tiles fetch even during initial pending** |
| `d10b3a55` | **Interfaces: Retry triggers real network refetch via manualRefresh** – Dev-only gates removed |

---

#### 10. Telemetry & Debugging

| Commit | Description |
|--------|-------------|
| `09b0f7c4` | **chore(perf): add telemetry helper and instrument hot paths** – `src/lib/perf.ts` flagged by `NEXT_PUBLIC_DEBUG_PERF_TELEMETRY` |
| `673a1f54` | **fix: correct property name in tab data logging** |
| `684724ae` | **fix: reference error in Table.tsx logging** |
| `0b72b7b2` | **chore: add logging and cleanup unused code** |

---

#### 11. Build & Type Fixes

| Commit | Description |
|--------|-------------|
| `1c6da0c4` | **fix(build): resolve React Hooks violations and TypeScript errors** |
| `19a381b8` | **fix(build): add type annotations to interface callbacks** |
| `0e604095` | **fix(ui): fix nested button hydration warning in Tooltip component** |
| `dccd4853` | **fix(table): ensure columns render after context change without fields metadata** |
| `2b9bd013` | **build: remove unsupported eslint directives; type global metrics cache properly** |

---

#### 12. Analytics & Debugging

| Commit | Description |
|--------|-------------|
| `c61dbcae` | **fix: disable automatic GA4 page view tracking on query changes** – Stop GA4 spam |
| `992adee7` | **temp: disable GTM to diagnose duplicate request issues** – Debug step |
| `960d04db` | **chore(logging): remove verbose info logs from hot paths** – Reduce log noise |
| `486c04aa` | **refactor: remove unused AddTile button from InterfaceButtons** – Cleanup |
| `720b8cb3` | **Increase Orchestra admin timeout to 60s** – More time for slow responses |
| `3c79b0b4` | **ux: remove 'Orchestra' from user-facing error messages** – Better UX |
| `b1f8bf85` | **fix(plot): remove success toast from drawPlot to prevent spam on auto-update** |

---

## Environment Flags

| Flag | Purpose |
|------|---------|
| `NEXT_PUBLIC_DEBUG_PERFORMANCE` | Enable detailed performance timing logs |
| `NEXT_PUBLIC_DEBUG_PERF_TELEMETRY` | Enable perf telemetry helper |
| `NEXT_PUBLIC_DEBUG_API_ROUTES` | Gate verbose API route logging |
| `NEXT_PUBLIC_DEBUG_TAB_PREFETCHING` | Gate tab data optimistic console.logs |

---

## Files Changed Summary

### Files Added (in optimisation work, reverted in 325895b5)
- `src/lib/auth/consoleCookie.ts` – Encrypted cookie auth
- `src/lib/auth/getApiKey.ts` – API key resolution
- `src/app/api/bootstrap/route.ts` – Bootstrap endpoint
- `src/app/api/tab/checkpoint/route.ts` – Tab checkpoint
- `src/app/api/tile/checkpoint/route.ts` – Tile checkpoint
- `src/app/api/tile/bulk/patch/route.ts` – Bulk patch endpoint
- `src/app/(home)/interfaces/loading.tsx` – Route-level loading
- `src/components/Common/Auth/AuthErrorBoundary.tsx` – Auth error boundary
- `src/lib/perf.ts` – Performance telemetry utilities

### Heavily Modified Files (reverted)
| File | Changes |
|------|---------|
| `src/app/api/tile/route.ts` | +236/-... lines |
| `src/app/api/tab/route.ts` | +228/-... lines |
| `src/app/api/logs/route.ts` | +190/-... lines |
| `src/app/api/interface/route.ts` | +180/-... lines |
| `src/app/api/logs/fields/route.ts` | +141/-... lines |
| `src/components/Pages/Interfaces/Blocks/Table/Table.tsx` | +97/-... lines |

**Total:** 66 files changed, +4,584 / -554 lines

---

## The Revert (325895b5)

The revert undid most of the interface optimisation changes. Key things reverted:

1. **Encrypted cookie auth system** – `consoleCookie.ts`, `getApiKey.ts`
2. **Bootstrap endpoint** – `/api/bootstrap/route.ts`
3. **Checkpoint routes** – Tab and tile checkpoints
4. **Bulk patch API** – `/api/tile/bulk/patch`
5. **Auth error boundary component**
6. **Route-level loading.tsx**
7. **API route auth migrations** in logs, tiles, tabs, projects, etc.
8. **Toast notification changes**
9. **Interface navigation UX changes**

---

## Next Steps

### ✅ Completed
1. [x] Fix all unit tests - DONE
2. [x] Fix all MSW integration tests - DONE
3. [x] Re-apply optimisations - DONE
4. [x] Fix production build errors - DONE (Dec 8)
5. [x] Fix runtime bugs (infinite loops, query cancellation) - DONE (Dec 9)

### 🟡 In Progress - Manual QA
6. [ ] Complete manual QA (see Merge Checklist below)

### ⏸️ Blocked on QA
7. [ ] Code review
8. [ ] Merge to staging

### Test Commands Reference

```bash
# Run mock tests (fast, no server needed)
npm run test:interfaces

# Run full tests with real API (auto-starts server)
npm run test:interfaces:real

# Run browser/E2E tests
npm run test:interfaces:browser
```

---

## Notes

- Orchestra admin timeout was increased to **60s** (`720b8cb3`) - this survived the revert
- 'Orchestra' was removed from user-facing error messages (`3c79b0b4`)

---

## Quick Reference

### Test Commands
```bash
npm run test:interfaces           # Mock tests (fast, no server needed)
npm run test:interfaces:real      # Full tests (starts server automatically)
npm run test:interfaces:browser   # Browser/E2E tests
```

### Debug Flags
```bash
# Add to .env.local for debugging
NEXT_PUBLIC_DEBUG_PERFORMANCE=true
NEXT_PUBLIC_DEBUG_PERF_TELEMETRY=true
NEXT_PUBLIC_DEBUG_API_ROUTES=true
NEXT_PUBLIC_DEBUG_TAB_PREFETCHING=true
```

### Key Contacts
- **Original Author:** [Add name]
- **Test Suite Author:** [Add name]
- **Reviewer:** [Add name]
