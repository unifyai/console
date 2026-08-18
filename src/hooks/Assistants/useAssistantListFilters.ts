'use client';

import * as React from 'react';

/** The roster kinds the list's filter menu can hide. Org workspaces only. */
export type AssistantListFilterId = 'real' | 'virtual' | 'teams' | 'groups';

export const ASSISTANT_LIST_FILTERS_STORAGE_KEY = 'console:assistants:listFilters';

const FILTER_IDS: readonly AssistantListFilterId[] = ['real', 'virtual', 'teams', 'groups'];

/**
 * What is stored: the hidden set, never a flag per filter.
 *
 * A stored positive map would freeze the filter set at the moment it was
 * written, so a filter shipped afterwards would be absent from every stored
 * preference and therefore read as hidden — for everyone who had ever touched
 * the control. Same reasoning as `RailConfig.unpinned`.
 */
interface StoredAssistantListFilters {
  v: 1;
  hidden: AssistantListFilterId[];
}

function isFilterId(value: unknown): value is AssistantListFilterId {
  return FILTER_IDS.includes(value as AssistantListFilterId);
}

/**
 * The hidden set from storage, or nothing hidden when there is nothing usable
 * to read. A preference written by a different version is discarded rather than
 * migrated: four checkboxes cost less to set again than a migration path nobody
 * exercises.
 */
function readHiddenFilters(): AssistantListFilterId[] {
  if (typeof window === 'undefined') return [];
  // Hand-edited or half-written storage is an expected, recoverable input.
  try {
    const raw = window.localStorage.getItem(ASSISTANT_LIST_FILTERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredAssistantListFilters> | null;
    if (parsed?.v !== 1 || !Array.isArray(parsed.hidden)) return [];
    return parsed.hidden.filter(isFilterId);
  } catch {
    return [];
  }
}

function writeHiddenFilters(hidden: AssistantListFilterId[]): void {
  try {
    const stored: StoredAssistantListFilters = { v: 1, hidden };
    window.localStorage.setItem(ASSISTANT_LIST_FILTERS_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* ignore */
  }
}

export interface AssistantListFilters {
  isVisible: (id: AssistantListFilterId) => boolean;
  setVisible: (id: AssistantListFilterId, visible: boolean) => void;
  /** Anything hidden, so a closed menu can still report that the list is cut. */
  hasHidden: boolean;
  showAll: () => void;
}

/**
 * Filter visibility for the assistant list, persisted per browser.
 *
 * Seeded during the first render rather than from an effect: the list mounts
 * inside the switcher popover, which exists only after a click, so there is no
 * server-rendered markup to disagree with — and an effect would show the rows a
 * filter hides for a frame every time the popover opens.
 *
 * One preference per browser, not per workspace. Only an org workspace offers
 * the menu, and which kinds of row someone wants to look at is a viewing habit
 * that travels with them between orgs.
 */
export function useAssistantListFilters(): AssistantListFilters {
  const [hidden, setHidden] = React.useState<AssistantListFilterId[]>(readHiddenFilters);

  const setVisible = React.useCallback((id: AssistantListFilterId, visible: boolean) => {
    setHidden((current) => {
      if (visible === !current.includes(id)) return current;
      const next = visible ? current.filter((entry) => entry !== id) : [...current, id];
      writeHiddenFilters(next);
      return next;
    });
  }, []);

  const showAll = React.useCallback(() => {
    setHidden((current) => {
      if (current.length === 0) return current;
      writeHiddenFilters([]);
      return [];
    });
  }, []);

  const isVisible = React.useCallback(
    (id: AssistantListFilterId) => !hidden.includes(id),
    [hidden]
  );

  return { isVisible, setVisible, hasHidden: hidden.length > 0, showAll };
}
