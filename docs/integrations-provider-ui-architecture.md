# Provider-Backed Integrations UI Architecture

## Purpose

This is the source-of-truth Console design brief for the revamped Integrations experience. The UI must replace the current stale secret-centric pane with a sleek, expressive app gallery that supports provider-backed OAuth, provider-managed API-key auth, static `unity-deploy` packages, and custom secrets without splitting users across multiple disconnected galleries.

## Hard Product Requirements

- Render one unified Integrations experience that merges static `INTEGRATION_PROVIDERS`, dynamic provider-backed apps from Orchestra, and Unify overlay metadata.
- Make one-click OAuth connect the primary happy path: app card -> permission review -> provider authorization -> connected state.
- Support API-key/manual auth through schema-driven forms with clear copy, validation, masked values, rotation, and reconnect flows.
- Show permission/scopes before authorization. Users should understand what data the app grants and which actor capabilities become available.
- Show connection state on every card: connected, pending, missing scope, expired, revoked, disconnected, error.
- Keep Google/Microsoft BYOD and Slack workspace installs visually compatible but architecturally separate unless product intentionally unifies them.
- Preserve static secret-backed integrations and custom secret fallback. Do not break current HubSpot/Salesforce/Webex/Employment Hero flows.
- Make the design beautiful enough to feel like a professional app marketplace, not a settings table.

## Cross-Repo Boundary And Catalog Ownership

The Console agent must not treat this UI as a reason to put every Composio/Pipedream-supported app into Console constants or `unity-deploy` folders. The provider-backed architecture intentionally splits responsibilities:

- `orchestra` is the dynamic integration control plane. It owns provider backends, provider app catalog/cache, connection registry, OAuth/API-key connection state, activation metadata, tool schemas, tool search, provider execution dispatch, and audit rows.
- `unity` is the actor-facing runtime surface. It exposes provider tools to the actor as FunctionManager-searchable virtual primitive rows named `primitives.integrations.<app>.<tool>` and provides `primitives.integrations.*` helpers for targeted lookup/schema/execution.
- `console` owns the user-facing marketplace/connect/manage experience. It renders a unified catalog but should read dynamic provider-backed apps from Orchestra instead of hardcoding them.
- `unity-deploy` remains for Level 3 full integration packages only: custom Python code, DataManager sync, bespoke guidance, browser fallback, client-specific workflow logic, unsupported-provider integrations, or integrations requiring strict local package control.
- `unify` only provides thin SDK helpers over Orchestra integration endpoints. It must not import Composio/Pipedream SDKs or perform local provider search/ranking.

Use this three-level rule when deciding where an integration belongs:

- Level 1 dynamic provider pass-through: provider-supported app, generic provider actions are good enough, no Console constant expansion and no `unity-deploy` package.
- Level 2 Unify overlay: provider-supported app needs curated display text, recommended scopes, capability groups, policy labels, rank boosts, or actor guidance. Store this as Orchestra overlay metadata, still no per-app Console constant and no `unity-deploy` package.
- Level 3 full package: Unify needs custom runtime code, local sync, deterministic tests, client workflow logic, browser fallback, unsupported-provider support, or high-control auth/runtime behavior. This remains a static package in `unity-deploy` and can continue to appear through Console's static registry.

Priority rule: if Composio, Pipedream, or another registered provider backend supports the app well enough, prefer the provider-backed Level 1/2 path first. Do not create or expand a Level 3 package just because the app exists in the gallery. Level 3 is the escape hatch for custom runtime behavior, deterministic local code, provider gaps, or stricter control requirements.

`unity-deploy`'s `IntegrationManifest` remains the contract for Level 3 full packages only. `Integrations/Manifests` is deploy-time telemetry; runtime provider-backed connection state lives in Orchestra's integration connection registry.

## Information Architecture

The main Integrations pane should have:

- Hero/search area: global search, category filters, connected-only toggle, auth-mode filter, and "Add custom" fallback.
- App gallery: responsive cards with icon, display name, provider/source badge, category, auth mode, status, short description, scope preview, and primary CTA.
- Connected accounts section: shows account label, owner scope, health, last checked, enabled capabilities, reconnect/disconnect/test actions.
- App detail drawer: richer scope review, capability groups, tool previews, policy warnings, auth method, docs link, and connection history.
- Admin/debug affordances: provider backend, provider app ID, provider connection ID, raw action preview, and audit links only for users with permission.

## Visual Design Requirements

- Use high-quality card composition: rounded cards, strong spacing, soft gradients, brand/icon treatment, clear status badges, and subtle hover elevation.
- Use icons wherever possible. Prefer provider icon URLs from Orchestra; fall back to `react-icons/si` or a polished generic glyph.
- Scopes should be chips grouped by capability, not a raw text dump.
- Primary CTAs must be action-specific: `Connect`, `Review permissions`, `Reconnect`, `Manage`, `Add API key`, `Rotate key`.
- Dangerous or sensitive actions must use calm warning surfaces, not alarming red everywhere.
- Empty states should be helpful and aspirational: explain that connected apps become actor-searchable under `primitives.integrations`.

## API Contract

Console reads provider-backed catalog data through:

- `GET /api/integrations/provider/apps` with `limit` / `offset` pagination, `query`,
  `source_type`, `status_group`, `detail_level=summary`, and catalog `facets`
- `GET /api/integrations/provider/connections`
- `POST /api/integrations/provider/connect/start`
- `POST /api/integrations/provider/connections/{connection_id}/complete`
- `POST /api/integrations/provider/connections/{connection_id}/disconnect`
- `POST /api/integrations/provider/connections/{connection_id}/reconnect`
- `POST /api/integrations/provider/connections/{connection_id}/test`
- `GET /api/integrations/provider/tools/search`

The Next routes proxy to Orchestra `/v0/integrations/*` using the authenticated API key. The browser must never receive provider tokens or raw API key values.

Admin/dev setup uses a separate Console proxy namespace:

- `POST /api/integrations/provider-admin/backends`
- `POST /api/integrations/provider-admin/sync`

These routes proxy to Orchestra `/v0/admin/integrations/*` and are only for trusted admin/dev setup flows, such as upserting Composio/Pipedream backend configs and syncing a small live provider catalog. Do not call these from ordinary end-user gallery interactions.

Pipedream backend config should use OAuth client credentials, not a manually copied short-lived access token. Required server-side env vars are `PIPEDREAM_CLIENT_ID`, `PIPEDREAM_CLIENT_SECRET`, `PIPEDREAM_PROJECT_ID`, and `PIPEDREAM_ENVIRONMENT`. Orchestra mints the Pipedream OAuth access token and Connect link server-side.

## UX Flow Requirements

OAuth:

1. User clicks `Connect`.
2. Console opens app detail/permission review with recommended scopes and capability groups.
3. User confirms.
4. Console starts connect session via Orchestra.
5. Provider OAuth opens in a new tab/window.
6. Callback completes the connection registry row.
7. Console refreshes app cards and shows connected account + enabled capabilities.

API key:

1. User clicks `Add API key`.
2. Console renders schema-driven form from provider/overlay metadata.
3. User submits.
4. Server writes credentials to the selected credential lane.
5. Orchestra updates connection state and health.
6. Console shows configured/connected state with rotate/test/disconnect actions.

Reconnect/missing scope:

- Cards must explain the missing scope or expired credential.
- Reconnect should preserve existing safe metadata and request only the needed additional scopes when possible.

## Actor Visibility Copy

The UI should explain that connected apps become searchable/callable by the actor as:

```text
primitives.integrations.<app>.<tool>
```

Unavailable tools remain discoverable with activation metadata, so the actor can say "connect HubSpot first" instead of silently failing.

## Implementation Notes

- Keep `INTEGRATION_PROVIDERS` as the static Level 3/full-package registry for existing hand-authored/custom integrations. It should not become the source of truth for all provider-supported apps.
- Strongly consider renaming or wrapping the static constant conceptually as `STATIC_INTEGRATION_PROVIDERS` in new code to prevent future agents from mistaking it for the global catalog. Preserve compatibility with existing imports unless the refactor is explicitly covered by tests.
- Add dynamic provider-backed catalog state alongside the static registry; do not store provider app catalog or connection state in `console_config`.
- Build a merge layer that combines static providers, Orchestra dynamic apps, and overlay metadata into one UI view model. Dedupe by canonical app slug where needed, but keep the source explicit (`static_package`, `provider_backed`, `overlay_curated`, `custom_secret`).
- Use Orchestra overlays for display overrides, recommended scopes, capability grouping, and policy labels.
- Prefer a detail drawer over large modal stacks for app review and management.
- Add Storybook or isolated component fixtures for card states, permission review, API-key form, empty state, and error state before deep backend wiring.
- Do not add provider SDKs to Console. Console talks to its own Next API proxy; the proxy talks to Orchestra; Orchestra talks to providers.
- Do not send raw API keys, OAuth tokens, provider refresh tokens, or provider vault references to the browser. Show masked labels, health, scopes, and connection/account metadata only.
- API-key connection starts must send credential fields to Orchestra as `api_key_fields`. Older names such as `api_key_values` are Console-local only and must be normalized before hitting the proxy.

## Test-Driven Development Requirements

The Console implementation agent must write failing tests before expanding UI behavior. This UI controls authorization and actor-visible tools, so behavior is not merge-ready until the focused tests exist and pass.

Required test layers:

- Node/unit component tests for the gallery, cards, status badges, scope chips, permission review, API-key form, and empty/error states.
- Hook tests for catalog loading, connection initiation, refresh behavior, error handling, and mock-mode branching.
- API proxy tests proving auth, query params, methods, path forwarding, and request bodies are passed to Orchestra correctly.
- One Playwright/local mock smoke path proving a user can open Integrations, see mock apps, open details, review permissions, and start a mocked connect flow.

Required test files should be explicit and easy to find:

- `src/tests/assistants/providerIntegrations.node.test.tsx`
- `src/tests/assistants/useProviderIntegrationCatalog.node.test.tsx`
- `src/tests/assistants/providerIntegrationProxy.node.test.ts`
- `src/tests/assistants/provider-integrations.e2e.ts`

Acceptance rules for tests:

- Tests must fail if provider-backed dynamic apps are removed from the gallery.
- Tests must fail if existing static integrations or custom secret flows disappear.
- Tests must fail if provider-backed apps are only sourced from hardcoded `INTEGRATION_PROVIDERS` rather than the Orchestra dynamic catalog.
- Tests must prove static Level 3 providers and dynamic provider-backed apps are merged into one user-facing gallery without losing their source/type metadata.
- Tests must verify the UI copy explains actor discovery primarily happens through FunctionManager-searchable `primitives.integrations.<app>.<tool>` records.
- Tests must verify provider-specific `primitives.integrations.search_tools(...)` is described only as a secondary helper backed by the same Orchestra provider-tool index.
- Tests must cover connected, pending, unconnected, missing-scope, expired, error, OAuth, API-key, and curated overlay states.

## Local Mock Mode Requirements

Add a dev-only mock mode so local visual testing does not require Orchestra, provider SDKs, OAuth apps, or real credentials.

Implementation requirements:

- Add a mock data module analogous to `src/utils/assistants/dashboard-mock-data.ts` and `src/utils/assistants/action-mock-data.ts`.
- Suggested module: `src/utils/assistants/provider-integration-mock-data.ts`.
- Suggested flag: `USE_MOCK_PROVIDER_INTEGRATIONS`, hardcoded `false` by default and only enabled locally/dev.
- Mock-mode code must never run in production builds.
- Mock views must not call Orchestra.
- Mock data must be quick to toggle for local design review.

Mock data must include:

- At least one existing static `unity-deploy`/`INTEGRATION_PROVIDERS` integration so the static path remains visible.
- Connected OAuth app, for example HubSpot with `connected_ready` contact/deal tools.
- API-key app, for example Clay or Webex with masked credential metadata.
- Pending OAuth app waiting for callback completion.
- Missing-scope app where the user must grant an additional scope.
- Expired/revoked app requiring reconnect.
- Error state with a recoverable provider health message.
- Curated overlay app with display overrides, recommended scopes, capability groups, and policy labels.
- Unconnected app whose tools remain actor-discoverable but blocked by `not_connected`.

Mock-mode UI must render the same surfaces as real data: gallery cards, detail drawer, permission review, connected accounts, status badges, scopes, auth modes, CTAs, and actor visibility copy.

## Console Agent Acceptance Criteria

- Tests are written before implementation and fail without the new UI/hook/proxy behavior.
- Mock mode renders the full gallery without backend dependencies.
- API proxy tests prove auth, query params, HTTP methods, path segments, and bodies are forwarded.
- UI tests prove scopes, icons, status badges, auth modes, CTAs, permission review, API-key entry, reconnect, disconnect, and test actions are rendered.
- E2E/local mock test proves the user can open Integrations, see mock apps, open app details, review permissions, and start a mocked connect flow.
- Existing static integrations and custom secret-backed flows keep passing.
- The dynamic provider-backed catalog is fetched from Orchestra/proxy APIs or mock-mode data, not expanded through hardcoded Console constants.
- `unity-deploy` remains a Level 3 package source only; the Console UI must not imply every dynamic provider app has or needs a `unity-deploy` manifest/package.
- The final UI feels like a professional app marketplace: polished cards, clear hierarchy, refined spacing, strong icon treatment, helpful empty states, and calm security copy.
