/** Rail section groups, in the order they appear in the rail. */
export type RailGroupId = 'workspace' | 'storage';

/**
 * What a section has to report while you are not looking at it.
 *
 * `kind` separates a running task from unread traffic so the rail and the
 * overflow menu can each render it honestly, and `count` is present only where
 * the source can actually produce one (chat unread) rather than being inferred
 * from the section id.
 */
export interface SectionActivity {
  active: boolean;
  count?: number;
  kind?: 'unread' | 'running';
}

export type SectionActivityMap = Partial<Record<string, SectionActivity>>;

/**
 * Stored rail configuration.
 *
 * `unpinned` is deliberately the negative set. A positive `pinned` list would
 * freeze a rail at the moment it was first configured, so every section shipped
 * afterwards would be absent from the stored list and therefore hidden — from
 * everyone who had ever touched the control.
 *
 * `order` is partial: ids present sort first in the stored order, and anything
 * unknown keeps its `sectionConfig` position behind them.
 */
export interface RailConfig {
  v: 1;
  unpinned: string[];
  order: Partial<Record<RailGroupId, string[]>>;
}
