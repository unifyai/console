import { describe, expect, it } from 'vitest';
import {
  ACTION_PRESENTATION_BY_IDENTITY,
  LEGACY_LABEL_PRESENTATION,
  actionIdentityKeys,
  resolveActionNodePresentation,
} from '@/components/Pages/Assistants/LiveActions/actionNodePresentation';

/**
 * Action rows pick their icon from the manager/method identity unify emits,
 * not from `display_label` prose. These pin both halves: the identity keys
 * (which change under review) and the legacy prose fallback (which unify's
 * vocabulary sweeps reword freely). A silent fallthrough to the generic icon
 * is the failure mode this file exists to catch.
 */
describe('actionIdentityKeys', () => {
  it('orders candidates most specific first', () => {
    expect(actionIdentityKeys(['CodeActActor', 'act', 'execute_code'])).toEqual([
      'CodeActActor.act.execute_code',
      'CodeActActor.execute_code',
      'execute_code',
      'CodeActActor',
    ]);
  });

  it('normalises dotted segments so both emit shapes resolve alike', () => {
    expect(actionIdentityKeys(['SkillManager.store'])).toEqual([
      'SkillManager.store',
      'SkillManager.store',
      'store',
      'SkillManager',
    ]);
  });

  it('returns nothing for an absent or empty hierarchy', () => {
    expect(actionIdentityKeys(undefined)).toEqual([]);
    expect(actionIdentityKeys([])).toEqual([]);
  });
});

describe('resolveActionNodePresentation', () => {
  it('keys off the stable identity even when the label is reworded', () => {
    const reworded = resolveActionNodePresentation({
      hierarchy: ['SkillManager', 'store'],
      // Unify may call this anything; the identity is what decides.
      displayLabel: 'Filing something away for later',
    });
    expect(reworded.tooltip).toBe('storage');
    expect(reworded.kind).toBe('note');
  });

  it('prefers the deepest matching identity over the manager', () => {
    expect(
      resolveActionNodePresentation({ hierarchy: ['CodeActActor', 'act', 'execute_code'] }).tooltip
    ).toBe('code execution');
    expect(resolveActionNodePresentation({ hierarchy: ['CodeActActor', 'act'] }).tooltip).toBe(
      'action'
    );
  });

  it('routes workflow installs to the shelf icon', () => {
    const presentation = resolveActionNodePresentation({
      hierarchy: ['WorkflowManager', 'install_workflow'],
    });
    expect(presentation.tooltip).toBe('workflow install');
  });

  it('falls back to label prose only when the identity is unknown', () => {
    expect(
      resolveActionNodePresentation({
        hierarchy: ['SomeManagerConsoleHasNeverSeen', 'poke'],
        displayLabel: 'Reading File',
      }).tooltip
    ).toBe('file read');
  });

  it('degrades to the generic event for an unknown identity and unknown label', () => {
    const presentation = resolveActionNodePresentation({
      hierarchy: ['Mystery', 'thing'],
      displayLabel: 'Something entirely new',
    });
    expect(presentation.tooltip).toBe('event');
    expect(presentation.kind).toBe('default');
  });
});

describe('pinned vocabulary', () => {
  // Drift guard: unify renaming a manager or method must fail here rather
  // than silently degrading every affected row to the generic icon.
  it('pins the stable identities Console renders specially', () => {
    expect([...ACTION_PRESENTATION_BY_IDENTITY.keys()].sort()).toEqual(
      [
        'CodeActActor',
        'CodeActActor.act',
        'ContactManager',
        'FileManager',
        'FileManager.read',
        'FunctionManager',
        'GuidanceManager',
        'KnowledgeManager',
        'MemoryManager',
        'SecretManager',
        'SkillManager',
        'SkillManager.search',
        'SkillManager.store',
        'TaskScheduler',
        'TaskScheduler.create',
        'TaskScheduler.execute',
        'TaskScheduler.update',
        'TranscriptManager',
        'WorkflowManager',
        'answer_question',
        'execute_code',
        'execute_function',
        'lookup_contact',
        'search_skills',
        'search_web',
        'store_skills',
      ].sort()
    );
  });

  it('still resolves every display label unify emitted at the time of writing', () => {
    const pinned: Array<[string, string]> = [
      ['Session', 'persistent session'],
      ['Taking Action', 'action'],
      ['Handling request', 'action'],
      ['Running Code', 'code execution'],
      ['Running: build_report', 'function execution'],
      ['Storing Reusable Skills', 'storage'],
      ['Searching skills', 'storage'],
      ['Reading File', 'file read'],
      ['Processing memory chunk', 'memory processing'],
      ['Reorganizing notes', 'note reorganization'],
      ['Working on Task', 'task'],
      ['Searching the Web', 'web search'],
      ['Answering Question', 'question answering'],
      ['Checking Contact Book', 'contact lookup'],
      ['Searching Knowledge', 'knowledge base'],
    ];
    for (const [label, tooltip] of pinned) {
      expect(
        resolveActionNodePresentation({ displayLabel: label }).tooltip,
        `display label "${label}" no longer resolves`
      ).toBe(tooltip);
    }
  });

  it('keeps the prose fallback ordered so specific matches beat fuzzy ones', () => {
    // "storing reusable skills" contains "skills"; the storage entry must win
    // before any later substring rule can claim it.
    const storageIndex = LEGACY_LABEL_PRESENTATION.findIndex((entry) =>
      entry.match('storing reusable skills')
    );
    const taskIndex = LEGACY_LABEL_PRESENTATION.findIndex((entry) =>
      entry.match('working on task')
    );
    expect(storageIndex).toBeGreaterThanOrEqual(0);
    expect(taskIndex).toBeGreaterThanOrEqual(0);
    expect(LEGACY_LABEL_PRESENTATION[storageIndex].presentation.tooltip).toBe('storage');
    expect(LEGACY_LABEL_PRESENTATION[taskIndex].presentation.tooltip).toBe('task');
  });
});
