# **Testing with Vitest**

This project uses **Vitest** with a **multi-project setup**, allowing tests to run in two environments:

1. **Node.js (`jsdom`)** — Fast unit tests, utilities, API tests.
2. **Real Browser (`playwright` + Chromium)** — Component tests, UI interactions, Integration tests.

Vitest automatically chooses which environment to use based on the test file naming convention.

## 📁 **Configuration Overview**

- **1. `vitest.config.ts`**: A single unified config that defines configuration settings for both node and browser based projects.
- **2. `vitest.setup.node.ts`**: Setup file for node-based tests. Includes node testing utilities, and a server worker.
- **3. `vitest.setup.browser.ts`**: Setup file for browser-based tests. Includes browser testing utilities, and a browser worker.
- **4. `src/tests/handlers.ts`**: Central registry for all MSW request handlers. All handlers across subfolders should be imported here.
- **5. `src/tests/render.ts`** Replicates app rendering structure. Includes providers and context wrappers, global styling import, and a unified RTL `render()` used by both environments.

## ▶️ **Running Tests**

### **Node Tests**

For fast-running unit tests and API tests.

Before running:

1. Create `.env.test`
2. Add a Unify API Key for the test account:

   ```
   VITE_TEST_API_KEY=xxxxxxx
   ```

Run **`*.node.test.ts(x)`** files with:

```bash
npm run test:node
```

### **Browser Tests**

For visual-based tests using a real Chromium instance and DOM behavior.

Run **`*.browser.test.ts(x)`** files with:

```bash
npm run test:browser
```

You can run browser tests with automatic screenshots after each event with

```bash
npm run test:browser:screenshots
```

Screenshots appear in the **`./screenshots`** directory. Screenshot filnames are derived from:

- `meta.alias`, if provided in a test
- Otherwise the test name + describe block

## 🧪 **Writing Tests**

### **Testing Structure**

Test modules (e.g. `assistants`) contains:

```
src/tests/assistants/
  ├── mocks/
  │    ├── data.ts:           Defines mock data and utilities
  │    ├── actions.ts         Defines mock server actions
  │    ├── handlers.ts        Defines mock api routes
  ├── list.browser.test.tsx   Browser-based tests
  ├── list.node.test.ts       Node-based tests
```

### **Naming Convention**

| Purpose              | File Pattern                   | Runs In        |
| -------------------- | ------------------------------ | -------------- |
| Node-only tests      | `*.node.test.ts?(x)`           | Node (`jsdom`) |
| Node matrix tests    | `*.matrix.node.test.ts?(x)`    | Node (`jsdom`) |
| Browser UI tests     | `*.browser.test.ts?(x)`        | Real browser   |
| Browser matrix tests | `*.matrix.browser.test.ts?(x)` | Real browser   |

**Matrix tests** are test files that iterate over large configuration matrices. They support sharding for parallel CI execution. Use the `.matrix.` suffix to easily identify and target these files.

### **Test Blocks**

Tests should be wrapped in a block containing:

- `description`: Explaining the intended behavior that is tested
- `options`: A dict containing test settings including:
  - `meta`: A dict with test metadata used to control some testing parameters.
    - `alias` defines the name of screenshots in browser tests.
    - `mock` determines whether api calls should be mocked or not.
  - `...`: Other Vitest specific options like `timeout` for e.g.
- `function`: The test function used to run the test.

## 📘 **Test Examples**

### **Node Test**

```tsx
// src/tests/my_tests/Counter.node.test.tsx
import { render, screen } from '@/tests/render';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { Counter } from './Counter';

describe('Counter', () => {
  it('increments on click', async () => {
    const user = userEvent.setup();
    render(<Counter />);

    const btn = screen.getByRole('button', { name: /count is/i });
    expect(btn).toHaveTextContent('count is 0');

    await user.click(btn);
    expect(btn).toHaveTextContent('count is 1');
  });
});
```

### **Browser Test with Screenshots**

```tsx
// src/tests/my_tests/login-flow.browser.test.tsx
import { render, screen } from '@/tests/render';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { LoginForm } from '@/components/LoginForm';

describe('Login Flow', () => {
  it(
    'shows an error for invalid credentials',
    { meta: { alias: 'Login-Invalid-Credentials' } },
    async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await user.type(screen.getByLabelText('Email'), 'wrong@email.com');
      await user.type(screen.getByLabelText('Password'), 'password');
      await user.click(screen.getByRole('button', { name: 'Log In' }));

      expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    }
  );
});
```

## 🎭 **Mocking API Requests (MSW)**

```ts
// src/tests/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/user/:userId', ({ params }) => {
    return HttpResponse.json({
      id: params.userId,
      firstName: 'John',
      lastName: 'Maverick',
    });
  }),

  // Add your API mocks here...
];
```

`vitest.setup.browser.ts` automatically loads and starts the MSW worker.

## 🔢 **Matrix Testing**

Matrix tests run the same test logic across many configuration combinations (e.g., plot types × data types × scales). Two utilities support this pattern:

### **Browser Matrix Tests** (`matrixTestRunnerBrowser.ts`)

For browser-based integration tests with React components. Supports file chunking for CI parallelization.

```typescript
import { defineMatrixTests } from '@/tests/utils/matrixTestRunnerBrowser';

export const matrixTests = defineMatrixTests({
  name: 'Bar Chart - Matrix Tests',

  // Function returning all test configurations
  getMatrix: () => generateAllConfigs(),

  // Tests to run for each config
  defineTests: (config, { it, expect }) => {
    it('renders correctly', async () => {
      // Test logic using config
    });
  },

  // Configs per chunk file (for parallel CI)
  chunkSize: 25,

  // Generate readable test names
  getConfigAlias: (config, index) => `${config.type}-${config.scale}`,
});
```

**CI Parallelization:**

Browser matrix tests are expensive (each needs a Chromium instance). Use the unified command that handles generate → run → cleanup:

```bash
# Run with 8 parallel shards (auto-generates chunk files, runs, then cleans up)
npm run test:browser:matrix 8

# Via environment variable
SHARDS=8 npm run test:browser:matrix
```

The script automatically:

1. Generates chunk files for parallel execution
2. Runs tests across multiple shards
3. Cleans up generated files on success

### **Node Matrix Tests** (`matrixTestRunnerNode.ts`)

For Node.js API tests. Uses `describe.concurrent` for in-process parallelism. Same `getMatrix` API as browser tests.

```typescript
import { defineNodeMatrixTests } from '@/tests/utils/matrixTestRunnerNode';

defineNodeMatrixTests<MyConfig>({
  name: 'Plot API - Matrix Tests',
  concurrent: true, // Use describe.concurrent

  // Function returning all test configurations (same as browser)
  getMatrix: () => generateAllConfigs(),

  // Tests to run for each config
  defineTests: (config, { it, expect }) => {
    it('returns valid response', async () => {
      // Test logic using config
    });
  },

  // Generate readable test names
  getConfigAlias: (config) => `${config.type}-${config.scale}`,
});
```

**CI Parallelization for Node Matrix Tests:**

Node matrix tests support sharding via the `MATRIX_SHARD` environment variable:

```bash
# Run in parallel with custom shard count
npm run test:node:matrix 8

# Via environment variable
SHARDS=8 npm run test:node:matrix
```

The script launches multiple Node.js processes, each with a different `MATRIX_SHARD` value (e.g., `1/4`, `2/4`, etc.).
