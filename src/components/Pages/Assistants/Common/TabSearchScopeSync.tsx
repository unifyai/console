'use client';

import * as React from 'react';
import { useTabSearchScope } from './TabSearchContext';

/** Keeps the global search icon targeting the active assistant tab's search field. */
export function TabSearchScopeSync({ scopeId }: { scopeId: string }) {
  useTabSearchScope(scopeId);
  return null;
}
