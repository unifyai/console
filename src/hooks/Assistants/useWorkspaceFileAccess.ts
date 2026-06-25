import * as React from 'react';
import { toast } from 'sonner';
import { AssistantActions } from '@/types/assistants/assistant';
import { OAuthProvider } from '@/types/assistants/contact';
import { WorkspaceFileNode, WorkspaceFileDecision } from '@/types/assistants/workspace-files';
import { ResponseProps } from '@/types/common';

export type NodeCheckState = 'checked' | 'unchecked' | 'indeterminate';

interface UseWorkspaceFileAccessArgs {
  assistantId: string;
  provider: OAuthProvider | null;
  assistantActions: AssistantActions;
  /** Only fetch once the surface is actually open. */
  isOpen: boolean;
}

const keyOf = (driveId: string, itemId: string) => `${driveId}::${itemId}`;

function errorDetail(value: unknown): string {
  if (value && typeof value === 'object' && 'detail' in value) {
    const detail = (value as ResponseProps).detail;
    if (typeof detail === 'string') return detail;
  }
  return 'Unknown error';
}

/**
 * State + selection math for the workspace file-access picker.
 *
 * Holds a lazily-loaded tree plus the allowlist as a `defaultAllow` flag and a
 * map of explicit per-item decisions. Access for any node is resolved by
 * walking its loaded ancestry: the nearest explicit decision wins, else
 * `defaultAllow`. This mirrors the enforcement semantics in Orchestra/Unity.
 */
export function useWorkspaceFileAccess({
  assistantId,
  provider,
  assistantActions,
  isOpen,
}: UseWorkspaceFileAccessArgs) {
  const [roots, setRoots] = React.useState<WorkspaceFileNode[]>([]);
  const [childrenByKey, setChildrenByKey] = React.useState<Record<string, WorkspaceFileNode[]>>({});
  const [parentByKey, setParentByKey] = React.useState<Record<string, string | null>>({});
  const [nodeByKey, setNodeByKey] = React.useState<Record<string, WorkspaceFileNode>>({});

  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [loadingKeys, setLoadingKeys] = React.useState<Set<string>>(new Set());

  const [defaultAllow, setDefaultAllowState] = React.useState(false);
  const [decisions, setDecisions] = React.useState<Record<string, WorkspaceFileDecision>>({});
  const [savedSnapshot, setSavedSnapshot] = React.useState<string>('');

  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // ── Initial load: policy + roots ────────────────────────────────────────
  React.useEffect(() => {
    if (!isOpen || !provider) return;
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const [policy, rootList] = await Promise.all([
          assistantActions.workspaceFiles.getPolicy(assistantId, provider!),
          assistantActions.workspaceFiles.listRoots(assistantId, provider!),
        ]);
        if (cancelled) return;

        if (policy && 'defaultAllow' in policy) {
          setDefaultAllowState(policy.defaultAllow);
          const map: Record<string, WorkspaceFileDecision> = {};
          for (const d of policy.decisions) map[keyOf(d.driveId, d.itemId)] = d;
          setDecisions(map);
          setSavedSnapshot(JSON.stringify({ defaultAllow: policy.defaultAllow, map }));
        }

        if (Array.isArray(rootList)) {
          setRoots(rootList);
          const idx: Record<string, WorkspaceFileNode> = {};
          const parents: Record<string, string | null> = {};
          for (const r of rootList) {
            const k = keyOf(r.driveId, r.itemId);
            idx[k] = r;
            parents[k] = null;
          }
          setNodeByKey(idx);
          setParentByKey(parents);
        } else {
          toast.error('Could not load your drives. Please try again.');
        }
      } catch (error) {
        console.error('[useWorkspaceFileAccess] load failed', error);
        if (!cancelled) toast.error('Could not load file access. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, provider, assistantId, assistantActions.workspaceFiles]);

  // ── Reset when closed ────────────────────────────────────────────────────
  React.useEffect(() => {
    if (isOpen) return;
    setRoots([]);
    setChildrenByKey({});
    setParentByKey({});
    setNodeByKey({});
    setExpanded(new Set());
    setLoadingKeys(new Set());
    setDecisions({});
    setDefaultAllowState(false);
    setSavedSnapshot('');
  }, [isOpen]);

  // ── Lazy children load ────────────────────────────────────────────────────
  const loadChildren = React.useCallback(
    async (node: WorkspaceFileNode) => {
      if (!provider) return;
      const k = keyOf(node.driveId, node.itemId);
      if (childrenByKey[k]) return;

      setLoadingKeys((prev) => new Set(prev).add(k));
      try {
        const result = await assistantActions.workspaceFiles.listChildren(
          assistantId,
          provider,
          node.driveId,
          node.itemId
        );
        if (!Array.isArray(result)) {
          toast.error('Could not open that folder. Please try again.');
          return;
        }
        setChildrenByKey((prev) => ({ ...prev, [k]: result }));
        setNodeByKey((prev) => {
          const next = { ...prev };
          for (const c of result) next[keyOf(c.driveId, c.itemId)] = c;
          return next;
        });
        setParentByKey((prev) => {
          const next = { ...prev };
          for (const c of result) next[keyOf(c.driveId, c.itemId)] = k;
          return next;
        });
      } catch (error) {
        console.error('[useWorkspaceFileAccess] loadChildren failed', error);
        toast.error('Could not open that folder. Please try again.');
      } finally {
        setLoadingKeys((prev) => {
          const next = new Set(prev);
          next.delete(k);
          return next;
        });
      }
    },
    [provider, assistantId, assistantActions.workspaceFiles, childrenByKey]
  );

  const toggleExpand = React.useCallback(
    (node: WorkspaceFileNode) => {
      const k = keyOf(node.driveId, node.itemId);
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(k)) {
          next.delete(k);
        } else {
          next.add(k);
          void loadChildren(node);
        }
        return next;
      });
    },
    [loadChildren]
  );

  // ── Effective allow resolution ───────────────────────────────────────────
  const effectiveAllow = React.useCallback(
    (key: string): boolean => {
      let current: string | null = key;
      const guard = new Set<string>();
      while (current && !guard.has(current)) {
        guard.add(current);
        const decision = decisions[current];
        if (decision) return decision.allow;
        current = parentByKey[current] ?? null;
      }
      return defaultAllow;
    },
    [decisions, parentByKey, defaultAllow]
  );

  const nodeState = React.useCallback(
    (node: WorkspaceFileNode): NodeCheckState => {
      const k = keyOf(node.driveId, node.itemId);
      const allowed = effectiveAllow(k);
      // Indeterminate if any loaded descendant resolves differently.
      for (const [candidate, parent] of Object.entries(parentByKey)) {
        if (candidate === k) continue;
        // Walk up from candidate to see if k is an ancestor.
        let cur: string | null = parent;
        const guard = new Set<string>();
        let isDescendant = false;
        while (cur && !guard.has(cur)) {
          guard.add(cur);
          if (cur === k) {
            isDescendant = true;
            break;
          }
          cur = parentByKey[cur] ?? null;
        }
        if (isDescendant && effectiveAllow(candidate) !== allowed) {
          return 'indeterminate';
        }
      }
      return allowed ? 'checked' : 'unchecked';
    },
    [effectiveAllow, parentByKey]
  );

  const toggleNode = React.useCallback(
    (node: WorkspaceFileNode) => {
      const k = keyOf(node.driveId, node.itemId);
      const parentKey = parentByKey[k] ?? null;
      const parentAllow = parentKey ? effectiveAllow(parentKey) : defaultAllow;
      const newAllow = !effectiveAllow(k);

      setDecisions((prev) => {
        const next = { ...prev };
        // Drop now-redundant explicit decisions on descendants of this node so
        // a folder toggle cleanly re-establishes inheritance.
        for (const candidate of Object.keys(next)) {
          if (candidate === k) continue;
          let cur: string | null = parentByKey[candidate] ?? null;
          const guard = new Set<string>();
          while (cur && !guard.has(cur)) {
            guard.add(cur);
            if (cur === k) {
              delete next[candidate];
              break;
            }
            cur = parentByKey[cur] ?? null;
          }
        }
        if (newAllow === parentAllow) {
          delete next[k];
        } else {
          next[k] = {
            driveId: node.driveId,
            itemId: node.itemId,
            allow: newAllow,
            kind: node.kind,
            name: node.name,
            path: node.name,
          };
        }
        return next;
      });
    },
    [parentByKey, effectiveAllow, defaultAllow]
  );

  const selectAll = React.useCallback(() => {
    setDefaultAllowState(true);
    setDecisions({});
  }, []);

  const deselectAll = React.useCallback(() => {
    setDefaultAllowState(false);
    setDecisions({});
  }, []);

  const setDefaultAllow = React.useCallback((value: boolean) => {
    setDefaultAllowState(value);
  }, []);

  const isDirty = React.useMemo(() => {
    return JSON.stringify({ defaultAllow, map: decisions }) !== savedSnapshot;
  }, [defaultAllow, decisions, savedSnapshot]);

  const save = React.useCallback(async () => {
    if (!provider || isSaving) return;
    setIsSaving(true);
    const toastId = toast.loading('Saving file access...');
    try {
      const result = await assistantActions.workspaceFiles.updatePolicy(
        assistantId,
        provider,
        defaultAllow,
        Object.values(decisions)
      );
      if (!result || !('decisions' in result)) {
        throw new Error(errorDetail(result));
      }
      const map: Record<string, WorkspaceFileDecision> = {};
      for (const d of result.decisions) map[keyOf(d.driveId, d.itemId)] = d;
      setDecisions(map);
      setDefaultAllowState(result.defaultAllow);
      setSavedSnapshot(JSON.stringify({ defaultAllow: result.defaultAllow, map }));
      toast.success('File access saved.', { id: toastId });
    } catch (error) {
      console.error('[useWorkspaceFileAccess] save failed', error);
      toast.error('Could not save file access. Please try again.', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  }, [provider, isSaving, assistantId, assistantActions.workspaceFiles, defaultAllow, decisions]);

  return {
    roots,
    childrenByKey,
    expanded,
    loadingKeys,
    isLoading,
    isSaving,
    defaultAllow,
    setDefaultAllow,
    toggleExpand,
    nodeState,
    toggleNode,
    selectAll,
    deselectAll,
    isDirty,
    save,
    keyOf,
  };
}
