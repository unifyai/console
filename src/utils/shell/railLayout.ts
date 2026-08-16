import {
  sectionAppliesTo,
  type SectionDef,
  type SectionGroupDef,
  type SelectorEntityKind,
} from '@/components/Pages/Assistants/Rail/sectionConfig';
import type { RailConfig, RailGroupId, SectionActivityMap } from '@/types/shell/rail';

/**
 * How many unpinned sections activity alone may pull back into the rail. The
 * point of pinning is that the rail stops moving, so the overflow beyond this
 * is what the More row's dot reports.
 */
export const SURFACED_CAP = 2;

export interface RailLayoutGroup {
  id: RailGroupId;
  label: string;
  sections: SectionDef[];
}

export interface RailLayout {
  /** Pinned sections by group; groups with nothing pinned are dropped. */
  groups: RailLayoutGroup[];
  /** Unpinned sections the rail shows anyway — live activity, or where you are. */
  surfaced: SectionDef[];
  /** Unpinned sections reachable only through the More menu. */
  hidden: SectionDef[];
  /** Whether any hidden section has activity — the More row's dot. */
  moreActivity: boolean;
  /** Hidden sections with activity, for the More row's accessible name. */
  hiddenActivityCount: number;
}

interface ComputeRailLayoutArgs {
  groups: ReadonlyArray<SectionGroupDef>;
  entityKind: SelectorEntityKind;
  config: RailConfig;
  activity?: SectionActivityMap;
  /** The active section id, or null on surfaces whose nav lives elsewhere. */
  activeSectionId: string | null;
}

/** Stored ids sort first in their stored order; unknown ids follow in default order. */
function applyOrder(sections: SectionDef[], order: string[] | undefined): SectionDef[] {
  if (!order || order.length === 0) return sections;
  const rank = new Map(order.map((id, index) => [id, index]));
  const ordered = sections.filter((s) => rank.has(s.id));
  ordered.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  return [...ordered, ...sections.filter((s) => !rank.has(s.id))];
}

/**
 * Split the rail into its three zones.
 *
 * Pinned sections render as they always did. An unpinned section with activity
 * is promoted into Surfaced under its own name rather than contributing an
 * anonymous dot to the overflow, and the section you are currently on is
 * surfaced whether or not it is pinned so you can never lose your place. More
 * then lights only for what none of that already showed you, which is what
 * keeps its dot meaning "something you cannot see".
 */
export function computeRailLayout({
  groups,
  entityKind,
  config,
  activity,
  activeSectionId,
}: ComputeRailLayoutArgs): RailLayout {
  const unpinned = new Set(config.unpinned);
  const isActive = (id: string) => activity?.[id]?.active === true;

  const applicable = groups.map((group) => ({
    id: group.id,
    label: group.label,
    sections: applyOrder(
      group.sections.filter((s) => sectionAppliesTo(s, entityKind)),
      config.order[group.id]
    ),
  }));

  const layoutGroups = applicable
    .map((group) => ({ ...group, sections: group.sections.filter((s) => !unpinned.has(s.id)) }))
    .filter((group) => group.sections.length > 0);

  const unpinnedSections = applicable.flatMap((group) =>
    group.sections.filter((s) => unpinned.has(s.id))
  );

  const surfaced = unpinnedSections.filter((s) => isActive(s.id)).slice(0, SURFACED_CAP);
  const activeUnpinned = unpinnedSections.find((s) => s.id === activeSectionId);
  if (activeUnpinned && !surfaced.includes(activeUnpinned)) surfaced.unshift(activeUnpinned);

  const hidden = unpinnedSections.filter((s) => !surfaced.includes(s));
  const hiddenActivityCount = hidden.filter((s) => isActive(s.id)).length;

  return {
    groups: layoutGroups,
    surfaced,
    hidden,
    moreActivity: hiddenActivityCount > 0,
    hiddenActivityCount,
  };
}
