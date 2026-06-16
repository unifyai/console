/**
 * Types for the workspace file-access allowlist (Drive / SharePoint / OneDrive).
 *
 * Mirrors the Orchestra schemas in `orchestra/web/api/assistant/schema.py`
 * (`WorkspaceFileNode`, `WorkspaceFileDecision`, `WorkspaceFilePolicy`). The
 * `/api/assistant/[id]/workspace-files/*` routes use `getOrchestraUserClient`,
 * so payloads cross the boundary in camelCase.
 */

import type { OAuthProvider } from '@/types/assistants/contact';

export type WorkspaceFileKind = 'drive' | 'folder' | 'file';

/** A single Drive/SharePoint/OneDrive node in a browse listing. */
export interface WorkspaceFileNode {
  driveId: string;
  itemId: string;
  name: string;
  kind: WorkspaceFileKind;
  mimeType?: string | null;
  webUrl?: string | null;
  parentId?: string | null;
}

/** An explicit allow/deny decision for one item, keyed by (driveId, itemId). */
export interface WorkspaceFileDecision {
  driveId: string;
  itemId: string;
  allow: boolean;
  kind: WorkspaceFileKind;
  name: string;
  path: string;
}

/** The full allowlist for one provider. */
export interface WorkspaceFilePolicy {
  provider: OAuthProvider;
  /**
   * Access for items without an explicit decision. Governs newly-added files
   * at undecided locations — i.e. the "new files default to accessible" toggle.
   */
  defaultAllow: boolean;
  decisions: WorkspaceFileDecision[];
}
