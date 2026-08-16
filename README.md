# Unify Console

A [Next.js](https://nextjs.org/) application built with React and TypeScript.

## System Architecture

Console is the web UI and observability dashboard in a multi-repository system:

```
         User (Console/Phone/SMS/Email)
                      │
    ┌─────────────────┴──────────────────┐
    │           Communication            │
    │    (Webhooks, Voice, SMS, Email)   │
    └────┬───────────────────────────────┘
         │
    ┌────┴────┐    ┌─────────┐    ┌─────────┐
    │  Unity  │    │  Unify  │    │Orchestra│
    │ (Brain) │───▶│  (SDK)  │───▶│  (API)  │
    │         │    │         │    │  (DB)   │
    └────┬────┘    └────┬────┘    └────┬────┘
         │              ▲              ▲
         │              │              │
         │    ┌─────────┴─┐       ┌────┴───────┐
         └───▶│  UniLLM   │       │  Console   │
              │ (LLM API) │       │(Interfaces)│
              └───────────┘       └────────────┘
```

**This repo (Console)** is the human interface to the platform. Users manage assistants, view logged data, configure interfaces, and monitor system health. Console reads from and writes to Orchestra's REST API.

Related repositories:

- [Orchestra](https://github.com/unifyai/orchestra) — Backend API that Console communicates with
- [Unity](https://github.com/unifyai/unity) — AI assistant brain (operations displayed in Console)
- [Unity Gateway](https://github.com/unifyai/unity/tree/staging/unity/gateway) — Local external communication gateway for self-hosted development
- [Unity Deploy](https://github.com/unifyai/unity-deploy) — Hosted deployment and communication infrastructure

---

## Security

### Authentication

Console uses NextAuth.js with Google and GitHub OAuth providers. Sessions use JWT with a 30-day max age. Cookies are configured with `httpOnly`, `sameSite: lax`, and `secure` (when served over HTTPS).

The NextAuth redirect callback validates that redirect URLs match the application's origin to prevent open redirect attacks.

### Middleware

The Next.js middleware (`src/middleware.ts`) enforces authentication on all routes except:

- `/plot/view/*` and `/table/view/*` — public shareable views
- Static assets and API routes (matched by the config regex)

The `/user` path requires a valid `ADMIN_KEY` header matching the `ADMIN_KEY` environment variable (value validation, not just presence check).

An `ON_PREM` environment variable bypasses authentication for self-hosted deployments. A safety guard prevents `ON_PREM` from being active when the app URL contains `unify.ai`.

### Security Headers

All routes receive the following headers via `next.config.js`:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (overridden to `ALLOWALL` for `/plot/view/*` embeds)
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-XSS-Protection: 1; mode=block`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy` restricting scripts, styles, fonts, connections, and frames

### API Routes

API routes that proxy to the Communication adapters (e.g., `/api/assistant/message`) authenticate the user via their API key and forward requests with the `ORCHESTRA_ADMIN_KEY` as a Bearer token.

### Required Environment Variables (Security)

| Variable                             | Purpose                                                                                                                                                                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JWT_SECRET`                         | NextAuth JWT signing secret                                                                                                                                                                                                                                                                             |
| `ADMIN_KEY`                          | Admin header validation for `/user` routes                                                                                                                                                                                                                                                              |
| `ORCHESTRA_ADMIN_KEY`                | Bearer token for adapter webhook calls                                                                                                                                                                                                                                                                  |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Stable AES key for server action closure encryption (base64, 32 bytes). Must be identical at build time and runtime — without it, each `next build` generates a random key and any redeployment breaks all open client sessions. Stored in Secret Manager and injected via `cloudbuild.yaml` build arg. |
| `SLACK_CLIENT_ID`                    | OAuth client id of the Unify-owned Slack app. Used by `/api/slack/oauth/start` to build the authorize URL.                                                                                                                                                                                              |
| `SLACK_CLIENT_SECRET`                | OAuth client secret of the Unify-owned Slack app. Used by `/oauth/slack/callback` to exchange the auth code for a bot token. Server-only; never reaches the browser.                                                                                                                                    |

### GCP Infrastructure (not tracked in code)

Console is deployed as the `saas-web-app` Cloud Run service in the `gcp-project-saas` GCP project:

- **Cloud Run ingress**: Currently `all` (default). Restricting to `internal-and-cloud-load-balancing` requires migrating from Cloud Run custom domain mappings to a proper Google Cloud Load Balancer with serverless NEGs first — custom domain mapping traffic is classified as external and gets rejected with 404.
- **Storage buckets**: `publicAccessPrevention` enforced on all buckets in the project. No `allUsers` or `allAuthenticatedUsers` bindings.

### GitHub Repository Settings (not tracked in code)

- **Branch protection** on `main`: Requires 1 approving pull request review. Force pushes and branch deletions are blocked.
- **Dependabot**: Vulnerability alerts and automated security fixes are enabled.

---

## Tech Stack

| Technology   | Version | Purpose                         |
| ------------ | ------- | ------------------------------- |
| Next.js      | 14.2.x  | React framework with App Router |
| React        | 18.x    | UI library                      |
| TypeScript   | 5.x     | Type safety                     |
| Tailwind CSS | 3.4.x   | Styling                         |
| Zustand      | 5.x     | State management                |
| React Query  | 5.x     | Server state & caching          |
| Vitest       | 4.x     | Testing framework               |
| Playwright   | 1.x     | Browser testing                 |

---

## Prerequisites

- **Node.js** 20.x or higher (LTS recommended)
- **npm** 10.x or higher
- **Docker** (for local PostgreSQL)
- **Poetry** (for Orchestra backend)
- [Orchestra repo](https://github.com/unifyai/orchestra) cloned as a sibling directory (`../orchestra`)

```bash
# Check your versions
node --version    # Should be v20.x.x or higher
npm --version     # Should be 10.x.x or higher
docker --version  # Any recent version
poetry --version  # Any recent version
```

---

## Quick Start

> **This is an internal dev/test harness, not the product run path.** To run
> the full local product end-to-end across all repos, use
> `unity-deploy/selfhost/stack.sh up` from the private deployment checkout. See
> `unity-deploy/docs/local-full-stack-inner-loop.md` for the internal workflow.
> The seeded modes below exist for Console development, QA, and E2E tests. To
> seed without starting the stack,
> run the scenario runner directly: `npx tsx src/tests/helpers/seeds/run.ts <scenario|all|--list>`.

The fastest way to get a fully working local (seeded dev) environment:

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local (if you don't have one)
cat > .env.local << 'EOF'
NEXTAUTH_URL=http://localhost:3000
ORCHESTRA_URL=http://localhost:8000
JWT_SECRET=local-sandbox-dev-secret
ORCHESTRA_ADMIN_KEY=local-dev-admin-key
EOF

# 3. Start everything (Orchestra + Console + seed data)
./scripts/local.sh

# 4. Open http://localhost:3000
#    Login: test@example.com / testpass123
```

This starts a local Orchestra backend (PostgreSQL + FastAPI), seeds a test user with an organization and sample assistant, and starts the Next.js dev server.

### What gets seeded

| Entity       | Details                                          |
| ------------ | ------------------------------------------------ |
| User         | `test@example.com` / `testpass123` (email login) |
| Organization | "Acme Corp" (user is Owner)                      |
| Assistant    | "Karen Myers" (assigned to the organization)     |
| API keys     | Personal key + org key (auto-created)            |

### Managing the local environment

```bash
./scripts/local.sh start    # Start everything (default)
./scripts/local.sh stop     # Stop Console and Orchestra
./scripts/local.sh restart  # Stop then start (wipes database)
./scripts/local.sh status   # Show service status
./scripts/local.sh start --chat --echo  # Add Pub/Sub emulator + local Unity gateway
./scripts/local.sh gateway-setup        # Run Unity gateway setup wizard
./scripts/local.sh gateway-doctor       # Validate local gateway config
./scripts/local.sh gateway-urls --public-url https://callbacks.example.com
```

Local chat routes Console adapter calls to `unity.gateway`, not the private
hosted `communication` repository. The wrapper commands above delegate to the
sibling Unity repo via `UNIFY_REPO_PATH` and use Console's `.env.local` by
default. Hosted deployments may still use managed Communication infrastructure.

### Configuration

| Variable              | Default        | Description             |
| --------------------- | -------------- | ----------------------- |
| `ORCHESTRA_REPO_PATH` | `../orchestra` | Path to Orchestra repo  |
| `CONSOLE_PORT`        | `3000`         | Next.js dev server port |
| `ORCHESTRA_PORT`      | `8000`         | Orchestra API port      |

---

## Available Scripts

### Development

| Script               | Description                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `./scripts/local.sh` | Internal dev/test harness (Orchestra + Console + seed data). For the full product, use `unity stack up`. |
| `npm run dev`        | Start Console dev server only (needs Orchestra separately)                                               |
| `npm run build`      | Build production bundle                                                                                  |
| `npm run start`      | Start production server (run after build)                                                                |

### Code Quality

| Script                 | Description                    |
| ---------------------- | ------------------------------ |
| `npm run lint`         | Run ESLint                     |
| `npm run lint:fix`     | Run ESLint with auto-fix       |
| `npm run format`       | Format all files with Prettier |
| `npm run format:check` | Check formatting (CI)          |
| `npm run typecheck`    | Run TypeScript type checking   |

### Testing

| Script                             | Description                               |
| ---------------------------------- | ----------------------------------------- |
| `npm run test:node`                | Run Node.js environment tests             |
| `npm run test:browser`             | Run browser environment tests             |
| `npm run test:browser:screenshots` | Run browser tests with screenshot capture |
| `npm run test:interfaces`          | Run interface-specific tests              |
| `npm run test:interfaces:browser`  | Run interface browser tests               |

### CI/CD

| Script       | Description                                                      |
| ------------ | ---------------------------------------------------------------- |
| `npm run ci` | Run full CI pipeline locally (typecheck + lint + format + build) |

---

## Code Quality & Formatting

### Pre-Commit Hooks

This project uses [Husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/lint-staged/lint-staged) to enforce code quality on every commit.

**What happens on commit:**

1. **Prettier** auto-formats staged JS/TS/JSON/MD/YAML/CSS files
2. **ESLint** auto-fixes issues in staged JS/TS files
3. If unfixable errors exist, the commit is **blocked**

### Manual Formatting

```bash
# Format entire codebase
npm run format

# Check if files are formatted (without changing them)
npm run format:check
```

### Prettier Configuration

Configuration is in `.prettierrc`:

- Single quotes
- 2-space tabs
- 100 character line width
- Trailing commas (ES5)
- Tailwind CSS class sorting

### ESLint Configuration

Configuration is in `.eslintrc.json`:

- Extends `next/core-web-vitals`
- Integrated with Prettier to avoid conflicts

---

## CI/CD Pipeline

### Running Tests in CI

**Tests are opt-in to reduce GitHub Actions costs.** Tests only run when explicitly requested:

- **Commit message**: Include `[run-tests]` in your commit message
- **PR title**: Include `[run-tests]` in your pull request title
- **Manual trigger**: Use the "Run workflow" button in GitHub Actions

Examples:

```bash
# Run tests on this commit
git commit -m "Fix interface rendering [run-tests]"

# No tests (default)
git commit -m "Update README"
```

Note: The `ci.yml` checks (lint, typecheck, format, build) always run on every push.

### Pipeline Jobs

```
┌──────────────┐   ┌────────┐   ┌──────────┐
│  typecheck   │   │  lint  │   │  format  │
└──────┬───────┘   └───┬────┘   └──────────┘
       │               │
       └───────┬───────┘
               ▼
         ┌───────────┐
         │   build   │
         └───────────┘

┌─────────────────┐   ┌────────────────────┐
│   test-node     │   │   test-browser     │
└─────────────────┘   └────────────────────┘
```

| Job              | What it checks                          |
| ---------------- | --------------------------------------- |
| **typecheck**    | TypeScript compilation (`tsc --noEmit`) |
| **lint**         | ESLint rules                            |
| **format**       | Prettier formatting                     |
| **build**        | Production build succeeds               |
| **test-node**    | Vitest Node.js tests pass               |
| **test-browser** | Vitest browser tests pass (Playwright)  |

---

## Production Build

### Test Production Locally

```bash
# Build the production bundle
npm run build

# Start the production server
npm run start

# Open http://localhost:3333
```

### Why Test Production Locally?

- Some bugs only appear in production builds
- Production is optimized and minified
- Tests static generation (SSG/ISR)
- Verifies environment variable handling

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (home)/            # Home route group
│   ├── api/               # API routes
│   └── layout.tsx         # Root layout
├── components/            # Reusable UI components
│   ├── Common/            # Shared components
│   ├── Layout/            # Layout components
│   ├── Pages/             # Page-specific components
│   ├── Shared/            # Cross-feature components
│   └── UI/                # Base UI components
├── contexts/              # React contexts and state
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and helpers
├── tests/                 # Test files
│   ├── assistants/        # Assistant feature tests
│   ├── interfaces/        # Interface feature tests
│   └── user/              # User feature tests
├── types/                 # TypeScript type definitions
└── constants/             # Application constants
```

### Directory Guidelines

| Directory     | Purpose                            |
| ------------- | ---------------------------------- |
| `components/` | Reusable UI components             |
| `app/`        | Next.js pages and API routes       |
| `lib/`        | Utility functions and helpers      |
| `hooks/`      | Custom React hooks                 |
| `contexts/`   | State management (Zustand slices)  |
| `types/`      | TypeScript interfaces and types    |
| `tests/`      | Test files (mirrors src structure) |

---

## Key Dependencies

### State Management

| Library                                   | Purpose                                          |
| ----------------------------------------- | ------------------------------------------------ |
| [Zustand](https://zustand-demo.pmnd.rs/)  | Global client state (UI state, user preferences) |
| [React Query](https://tanstack.com/query) | Server state, caching, and data fetching         |
| [Immer](https://immerjs.github.io/immer/) | Immutable state updates                          |

### UI Components

| Library                                                     | Purpose                         |
| ----------------------------------------------------------- | ------------------------------- |
| [Radix UI](https://www.radix-ui.com/)                       | Accessible, unstyled primitives |
| [Tailwind CSS](https://tailwindcss.com/)                    | Utility-first CSS               |
| [Framer Motion](https://www.framer.com/motion/)             | Animations                      |
| [Lucide React](https://lucide.dev/)                         | Icons                           |
| [Monaco Editor](https://microsoft.github.io/monaco-editor/) | Code editor                     |

### Data & Forms

| Library                                         | Purpose           |
| ----------------------------------------------- | ----------------- |
| [React Hook Form](https://react-hook-form.com/) | Form handling     |
| [Zod](https://zod.dev/)                         | Schema validation |
| [date-fns](https://date-fns.org/)               | Date manipulation |

### Real-Time & Communication

| Library                                 | Purpose               |
| --------------------------------------- | --------------------- |
| [LiveKit](https://livekit.io/)          | Real-time audio/video |
| [Vercel AI SDK](https://sdk.vercel.ai/) | AI/LLM integration    |

### Authentication & Payments

| Library                                  | Purpose             |
| ---------------------------------------- | ------------------- |
| [NextAuth.js](https://next-auth.js.org/) | Authentication (v4) |
| [Stripe](https://stripe.com/docs)        | Payment processing  |

---

## Architecture Overview

### State Management Pattern

```
┌─────────────────────────────────────────────────────────┐
│                     React Components                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   ┌─────────────┐              ┌──────────────────┐     │
│   │   Zustand   │              │   React Query    │     │
│   │   (Client)  │              │    (Server)      │     │
│   ├─────────────┤              ├──────────────────┤     │
│   │ • UI state  │              │ • API data       │     │
│   │ • Modals    │              │ • Caching        │     │
│   │ • Filters   │              │ • Mutations      │     │
│   │ • Selection │              │ • Optimistic     │     │
│   └─────────────┘              └──────────────────┘     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### File Organization for Features

When adding a new feature, follow this pattern:

```
src/
├── app/(home)/feature/         # Route/page
│   └── page.tsx
├── components/Pages/Feature/   # Feature components
│   ├── FeatureMain.tsx
│   └── FeatureCard.tsx
├── hooks/Feature/              # Feature hooks
│   └── useFeatureData.ts
├── contexts/slices/            # Zustand slices
│   └── featureSlice.ts
├── types/feature/              # TypeScript types
│   └── index.ts
└── tests/feature/              # Tests
    └── feature.test.tsx
```

---

## Debug Environment Variables

Enable detailed logging for development by adding these to `.env.local`:

### UI and State Management

| Variable                                    | Description                        |
| ------------------------------------------- | ---------------------------------- |
| `NEXT_PUBLIC_DEBUG_UI_INITIAL_STATE`        | Server-side state building logs    |
| `NEXT_PUBLIC_DEBUG_TILE_DEPENDENCIES`       | Tile dependency graph logs         |
| `NEXT_PUBLIC_DEBUG_TAB_PREFETCHING`         | Tab prefetching and streaming logs |
| `NEXT_PUBLIC_DEBUG_PERFORMANCE`             | Performance timing logs            |
| `NEXT_PUBLIC_DEBUG_STATE_SYNCING`           | State sync operation logs          |
| `NEXT_PUBLIC_DEBUG_COMMANDS`                | Command execution logs             |
| `NEXT_PUBLIC_DEBUG_INFINITE_QUERIES`        | Infinite query logs                |
| `NEXT_PUBLIC_DEBUG_QUERY_KEYS`              | Query key lifecycle logs           |
| `NEXT_PUBLIC_DEBUG_TABLE_ADVANCED_FEATURES` | Advanced table UI features         |

### Enable All Debug Features

```bash
# .env.local
NEXT_PUBLIC_DEBUG_UI_INITIAL_STATE=true
NEXT_PUBLIC_DEBUG_TILE_DEPENDENCIES=true
NEXT_PUBLIC_DEBUG_TAB_PREFETCHING=true
NEXT_PUBLIC_DEBUG_PERFORMANCE=true
NEXT_PUBLIC_DEBUG_STATE_SYNCING=true
NEXT_PUBLIC_DEBUG_COMMANDS=true
NEXT_PUBLIC_DEBUG_INFINITE_QUERIES=true
NEXT_PUBLIC_DEBUG_QUERY_KEYS=true
NEXT_PUBLIC_DEBUG_TABLE_ADVANCED_FEATURES=true
```

> **Note:** Disable debug features in production to avoid performance impact.

---

## Naming Conventions

### Files & Directories

| Type        | Convention                       | Example                            |
| ----------- | -------------------------------- | ---------------------------------- |
| Directories | lowercase/kebab-case             | `components/`, `user-profile/`     |
| Components  | PascalCase                       | `Header.tsx`, `UserProfile.tsx`    |
| Utilities   | camelCase                        | `apiClient.ts`, `dateFormatter.ts` |
| Hooks       | camelCase with `use` prefix      | `useFetchData.ts`                  |
| Types       | PascalCase                       | `UserTypes.ts`                     |
| Tests       | `*.test.ts(x)` or `*.spec.ts(x)` | `Button.test.tsx`                  |

### Component Structure

```
components/
└── Button/
    ├── Button.tsx          # Component
    ├── Button.test.tsx     # Tests
    └── index.ts            # Export
```

---

## Testing

### Test Structure

Tests are organized in `src/tests/` mirroring the feature structure:

```
src/tests/
├── assistants/           # Assistant feature tests
│   ├── chat.browser.test.tsx
│   └── hire.browser.test.tsx
├── interfaces/           # Interface feature tests
│   ├── behavior/         # Behavior tests
│   ├── e2e/             # End-to-end tests
│   ├── integration/     # Integration tests
│   ├── unit/            # Unit tests
│   └── mocks/           # Test fixtures and mocks
└── user/                # User feature tests
```

### Test Types

| Suffix                 | Environment               | Purpose                       |
| ---------------------- | ------------------------- | ----------------------------- |
| `*.node.test.tsx`      | Node.js (jsdom)           | Fast unit/integration tests   |
| `*.browser.test.tsx`   | Real browser (Playwright) | DOM interaction tests         |
| `*.real.node.test.tsx` | Node.js with real API     | Integration with real backend |

### Running Tests

```bash
# Run Node.js tests
npm run test:node

# Run in watch mode
npm run test:node -- --watch

# Run browser tests
npm run test:browser

# Run specific test file
npm run test:node -- src/tests/interfaces/unit/hooks/useTabSync.node.test.tsx

# Run with coverage
npm run test:node -- --coverage
```

---

## Troubleshooting

### npm Install Errors

If you encounter peer dependency conflicts:

```bash
# The project uses legacy-peer-deps by default via .npmrc
npm install
```

### Pre-Commit Hook Issues

If commits are being blocked:

```bash
# Check what lint-staged would run
npx lint-staged --verbose

# Skip hooks temporarily (not recommended)
git commit --no-verify -m "message"
```

### TypeScript Errors

```bash
# Check all TypeScript errors
npm run typecheck

# Check specific file
npx tsc --noEmit src/path/to/file.tsx
```

---

## Contributing

### Branch Strategy

```
main (production)
  ↑
staging (pre-production)
  ↑
feature/your-feature-name
```

### Workflow

1. **Create branch** from `staging`:

   ```bash
   git checkout staging
   git pull origin staging
   git checkout -b feature/your-feature-name
   ```

2. **Make changes** and commit often:

   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

   > Pre-commit hooks auto-format your code

3. **Run checks locally** before pushing:

   ```bash
   npm run ci
   ```

4. **Push and create PR** to `staging`:
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

| Type        | Description                         |
| ----------- | ----------------------------------- |
| `feat:`     | New feature                         |
| `fix:`      | Bug fix                             |
| `docs:`     | Documentation changes               |
| `style:`    | Code style (formatting, semicolons) |
| `refactor:` | Code refactoring                    |
| `test:`     | Adding/updating tests               |
| `chore:`    | Maintenance tasks                   |

Examples:

```bash
git commit -m "feat: add user profile page"
git commit -m "fix: resolve login redirect issue"
git commit -m "docs: update README with new scripts"
```

### Code Review Checklist

- [ ] TypeScript compiles without errors
- [ ] ESLint passes with no warnings
- [ ] Tests pass
- [ ] New features have tests
- [ ] No console.logs left in code
- [ ] Responsive design works on mobile

---

## Common Patterns

### Creating a New API Route

```typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Your logic here
  return NextResponse.json({ data: 'example' });
}
```

### Creating a Custom Hook with React Query

```typescript
// src/hooks/useExample.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useExample(id: string) {
  return useQuery({
    queryKey: ['example', id],
    queryFn: () => fetchExample(id),
  });
}

export function useUpdateExample() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateExample,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['example'] });
    },
  });
}
```

### Creating a Zustand Slice

```typescript
// src/contexts/slices/exampleSlice.ts
import { StateCreator } from 'zustand';

export interface ExampleSlice {
  count: number;
  increment: () => void;
  reset: () => void;
}

export const createExampleSlice: StateCreator<ExampleSlice> = (set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  reset: () => set({ count: 0 }),
});
```

---

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)
