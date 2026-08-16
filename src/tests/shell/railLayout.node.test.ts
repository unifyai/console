import { describe, expect, it } from 'vitest';
import { SECTION_GROUPS } from '@/components/Pages/Assistants/Rail/sectionConfig';
import { computeRailLayout, SURFACED_CAP } from '@/utils/shell/railLayout';
import { DEFAULT_RAIL_CONFIG } from '@/hooks/Shell/useRailConfig';
import type { RailConfig, SectionActivityMap } from '@/types/shell/rail';

/**
 * The rail's three zones are pure computation over the stored config and the
 * live activity map, so they are pinned here as data. The failure modes this
 * file exists to catch are silent: a hidden section that stops surfacing when
 * it goes live, a More dot that double-counts something already visible, and a
 * newly-shipped section that a stale config hides from everyone who ever
 * touched the control.
 */
const config = (overrides: Partial<RailConfig> = {}): RailConfig => ({
  ...DEFAULT_RAIL_CONFIG,
  ...overrides,
});

const layoutFor = (args: {
  config?: RailConfig;
  activity?: SectionActivityMap;
  activeSectionId?: string | null;
  entityKind?: 'assistant' | 'human' | 'team' | 'group';
}) =>
  computeRailLayout({
    groups: SECTION_GROUPS,
    entityKind: args.entityKind ?? 'assistant',
    config: args.config ?? DEFAULT_RAIL_CONFIG,
    activity: args.activity,
    activeSectionId: args.activeSectionId ?? 'chat',
  });

const ids = (sections: { id: string }[]) => sections.map((s) => s.id);
const active = (...sectionIds: string[]): SectionActivityMap =>
  Object.fromEntries(sectionIds.map((id) => [id, { active: true }]));

describe('computeRailLayout — default config', () => {
  it('pins every section that applies, so an upgrade changes nobody’s rail', () => {
    const layout = layoutFor({});
    // `members` is team-only, so an assistant selection never shows it.
    expect(ids(layout.groups.flatMap((g) => g.sections))).toEqual(
      SECTION_GROUPS.flatMap((g) =>
        g.sections.filter((s) => (s.appliesTo ?? ['assistant']).includes('assistant'))
      ).map((s) => s.id)
    );
    expect(layout.surfaced).toEqual([]);
    expect(layout.hidden).toEqual([]);
    expect(layout.moreActivity).toBe(false);
  });

  it('drops sections that do not apply to the selected entity kind', () => {
    const layout = layoutFor({ entityKind: 'human' });
    expect(layout.groups).toEqual([]);
    expect(layout.hidden).toEqual([]);
  });
});

describe('computeRailLayout — pinning', () => {
  it('moves unpinned sections out of their group and into the overflow', () => {
    const layout = layoutFor({ config: config({ unpinned: ['desktop', 'data'] }) });
    const workspace = layout.groups.find((g) => g.id === 'workspace');
    expect(ids(workspace!.sections)).not.toContain('desktop');
    expect(ids(layout.hidden)).toEqual(['desktop', 'data']);
  });

  it('drops a heading once its group has nothing pinned', () => {
    const storage = SECTION_GROUPS.find((g) => g.id === 'storage')!;
    const layout = layoutFor({
      config: config({ unpinned: storage.sections.map((s) => s.id) }),
    });
    expect(ids(layout.groups)).toEqual(['workspace']);
  });

  it('leaves a section absent from a stale config pinned', () => {
    // The stored set is negative on purpose: a positive `pinned` list written
    // before a section shipped would hide it from that user permanently.
    const layout = layoutFor({ config: config({ unpinned: ['desktop'] }) });
    expect(ids(layout.groups.flatMap((g) => g.sections))).toContain('workflows');
  });

  it('sorts stored ids first and keeps unknown ids in default order behind them', () => {
    const layout = layoutFor({ config: config({ order: { workspace: ['tasks', 'actions'] } }) });
    const workspace = layout.groups.find((g) => g.id === 'workspace')!;
    expect(ids(workspace.sections).slice(0, 2)).toEqual(['tasks', 'actions']);
    expect(ids(workspace.sections).slice(2)).toEqual([
      'canvas',
      'desktop',
      'workflows',
      'integrations',
    ]);
  });
});

describe('computeRailLayout — surfacing', () => {
  it('promotes a hidden section under its own name and leaves More quiet', () => {
    const layout = layoutFor({
      config: config({ unpinned: ['workflows', 'data'] }),
      activity: active('workflows'),
    });
    expect(ids(layout.surfaced)).toEqual(['workflows']);
    expect(ids(layout.hidden)).toEqual(['data']);
    expect(layout.moreActivity).toBe(false);
  });

  it('caps promotion and reports the remainder on More', () => {
    const layout = layoutFor({
      config: config({ unpinned: ['desktop', 'workflows', 'integrations', 'data'] }),
      activity: active('workflows', 'integrations', 'data'),
    });
    expect(layout.surfaced).toHaveLength(SURFACED_CAP);
    expect(ids(layout.surfaced)).toEqual(['workflows', 'integrations']);
    expect(ids(layout.hidden)).toEqual(['desktop', 'data']);
    expect(layout.moreActivity).toBe(true);
    expect(layout.hiddenActivityCount).toBe(1);
  });

  it('surfaces the open section even when it is unpinned and quiet', () => {
    const layout = layoutFor({
      config: config({ unpinned: ['data'] }),
      activeSectionId: 'data',
    });
    expect(ids(layout.surfaced)).toEqual(['data']);
    expect(layout.hidden).toEqual([]);
  });

  it('does not surface the open section twice when it is also active', () => {
    const layout = layoutFor({
      config: config({ unpinned: ['workflows', 'data'] }),
      activity: active('workflows'),
      activeSectionId: 'workflows',
    });
    expect(ids(layout.surfaced)).toEqual(['workflows']);
  });

  it('keeps the open section visible on top of a full surfaced zone', () => {
    const layout = layoutFor({
      config: config({ unpinned: ['workflows', 'integrations', 'data'] }),
      activity: active('workflows', 'integrations'),
      activeSectionId: 'data',
    });
    expect(ids(layout.surfaced)).toEqual(['data', 'workflows', 'integrations']);
    expect(layout.hidden).toEqual([]);
  });

  it('ignores activity on a section that is still pinned', () => {
    const layout = layoutFor({ activity: active('tasks') });
    expect(layout.surfaced).toEqual([]);
    expect(layout.moreActivity).toBe(false);
  });
});
