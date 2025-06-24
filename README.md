This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Test Production Build

In order to test the production build locally, run

```bash
npm run build
```

followed by

```bash
npm start
```

## Debug Environment Variables

This application includes several debug environment variables that enable detailed logging and visual indicators for development and troubleshooting purposes. Set these variables to `true` to enable their respective debug features:

### UI and State Management

- **`NEXT_PUBLIC_DEBUG_UI_INITIAL_STATE=true`**
  - Enables detailed console logging for initial state building on the server side
  - Shows comprehensive logs for project loading, interface setup, tab initialization, and store state construction
  - Useful for debugging server-side rendering and initial hydration issues

### Tile Dependencies

- **`NEXT_PUBLIC_DEBUG_TILE_DEPENDENCIES=true`**
  - Enables comprehensive logging for the tile dependency management system
  - Shows dependency graph building, external dependency checking, and tile render states
  - Displays visual indicators in the UI showing which dependencies tiles are waiting for
  - Includes emoji-based logging (🔍 🚀 ⏳ ✅ ❌) for easy identification of dependency states

### Tab Prefetching and Streaming

- **`NEXT_PUBLIC_DEBUG_TAB_PREFETCHING=true`**
  - Enables detailed logging for tab prefetching and streaming operations
  - Shows tab data building progress, prefetch queue management, and cache hit/miss information
  - Displays visual indicators in the UI showing prefetched tabs and streaming progress
  - Includes prefetch progress indicators and tab switch timing information

### Performance Monitoring

- **`NEXT_PUBLIC_DEBUG_PERFORMANCE=true`**
  - Enables detailed performance timing logs for critical data operations
  - Shows execution times for table data building, plot data fetching, and argument processing
  - Includes timing measurements for logs retrieval, field processing, and data transformation
  - Useful for identifying performance bottlenecks and optimizing data processing workflows

### State Synchronization

- **`NEXT_PUBLIC_DEBUG_STATE_SYNCING=true`**
  - Enables detailed logging for state synchronization between client and server
  - Shows optimistic updates, server sync operations, and mutation state changes
  - Includes logging for interface, tab, and tile synchronization operations
  - Useful for debugging state consistency issues and sync conflicts

### Usage Example

To enable all debug features during development, add these to your `.env.local` file:

```bash
NEXT_PUBLIC_DEBUG_UI_INITIAL_STATE=true
NEXT_PUBLIC_DEBUG_TILE_DEPENDENCIES=true
NEXT_PUBLIC_DEBUG_TAB_PREFETCHING=true
NEXT_PUBLIC_DEBUG_PERFORMANCE=true
NEXT_PUBLIC_DEBUG_STATE_SYNCING=true
```

**Note:** These debug features should be disabled in production environments to avoid performance impact and console noise.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.


## Project Structure Guide

This section outlines where different types of files, components, and scripts should reside within the project. Following these guidelines will help maintain a clean and organized codebase, making it easier for current and future contributors to navigate and collaborate effectively.

### Directory Placement

1. **Components**
   - **Location**: Place all reusable UI components in the `components` directory.
   - **Structure**: Each component should be housed in its own folder if it contains multiple files (e.g., styles, tests).
   - **Examples**:
     - `components/Header/Header.tsx`
     - `components/UserProfile/UserProfile.tsx`

2. **Pages & Routes**
   - **Location**: For Next.js routing, place all page components inside the `app` or `pages` directory.
   - **Examples**:
     - `app/(console)/profile/page.tsx`
     - `pages/api/user/[userId].ts`

3. **Utilities & Helpers**
   - **Location**: Put all standalone utility functions and helpers in the `lib` directory.
   - **Purpose**: Centralize code that can be reused across multiple components or features.
   - **Examples**:
     - `lib/apiClient.ts`
     - `lib/dateFormatter.ts`

4. **Custom Hooks**
   - **Location**: Store custom hooks in the `hooks` directory.
   - **Examples**:
     - `hooks/useFetchData.ts`

5. **Styles**
   - **Location**: Place global styles in the `styles` directory; component-specific styles should reside next to their respective components as `.module.css` files.
   - **Examples**:
     - Global: `styles/globals.css`
     - Component-specific: `components/Header/header.module.css`

6. **Public Assets**
   - **Location**: Store all static assets in the `public` directory.
   - **Purpose**: For images, icons, and other static files that need to be publicly accessible.
   - **Examples**:
     - `public/images/logo.png`
     - `public/icons/favicon.ico`

### Decision-Making System for Placement

- **Reusability Consideration**: If a component or utility is designed to be reusable across multiple parts of the application, place it in a shared directory (like `components` or `lib`).

- **Feature-Specific Placement**: If a file is exclusively related to one feature, keep it within that feature's directory for easier maintenance.

- **Consistency Check**: Regularly review and refactor the placement of files to ensure they adhere to these guidelines and reflect the current needs of the project.

By adhering to these guidelines, we ensure a modular, scalable, and easily navigable codebase. This approach allows developers to efficiently locate, enhance, and maintain code as the application evolves.



## Naming Conventions

To ensure a consistent and organized codebase, we follow these naming conventions for directories, files, components, and other parts of our project:

### Directories
- **Usage**: Lowercase and kebab-case.
- **Examples**:
  - `components`
  - `lib`
  - `styles`

### Components
- **Usage**: PascalCase for React component files and their directories.
- **Examples**:
  - `Header.tsx`
  - `UserProfile.tsx`
  - Directory: `components/UserProfile/UserProfile.tsx`

### Files
- **Utility/Helper Functions**: camelCase
- **General Files**: kebab-case
- **Configuration Files**: lowercase
- **Examples**:
  - `apiClient.ts` (utility)
  - `dataFormatter.ts` (utility)
  - `next.config.js` (configuration)
  - `README.md`, `LICENSE` (general)

### Hooks
- **Usage**: Prefix with `use`, use camelCase.
- **Examples**:
  - `useAuth.ts`
  - `useFetchData.ts`

### Styles
- **Usage**: kebab-case, associate with component where applicable.
- **Examples**:
  - `header.module.css`
  - `globals.css`
  - `user-profile.module.css`

### API Routes
- **Usage**: Lowercase and kebab-case.
- **Examples**:
  - `pages/api/user/login.ts`
  - `pages/api/products/[id].ts`

### Dynamic Routes
- **Usage**: Wrap dynamic segments in brackets, use camelCase inside brackets.
- **Examples**:
  - `[userId].tsx`
  - `[productSlug].tsx`

### Public Assets
- **Usage**: kebab-case
- **Examples**:
  - `logo.png`
  - `background-image.jpg`
