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
- [Communication](https://github.com/unifyai/communication) — External communication gateway

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

```bash
# Check your versions
node --version  # Should be v20.x.x or higher
npm --version   # Should be 10.x.x or higher
```

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Get environment variables from a team member
# Copy to .env.local

# 3. Start development server
npm run dev

# 4. Open http://localhost:3000
```

---

## Available Scripts

### Development

| Script          | Description                               |
| --------------- | ----------------------------------------- |
| `npm run dev`   | Start development server with hot reload  |
| `npm run build` | Build production bundle                   |
| `npm run start` | Start production server (run after build) |

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

# Open http://localhost:3000
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
