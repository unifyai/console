/// <reference types="vite/client" />

import 'vitest';

interface ImportMetaEnv {
  readonly VITE_TAKE_SCREENSHOTS: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface CustomMeta {
  alias?: string;
  mock?: boolean;
  scenario?: string;
  behavior?: string;
}

declare module 'vitest' {
  interface TestOptions {
    meta?: CustomMeta;
  }
  
  interface TaskMeta extends CustomMeta {}
}