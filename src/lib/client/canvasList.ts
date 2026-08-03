import { rootContext, roots, type ContextRoot } from '@/lib/assistants/scope';
import { snakeToCamelObject } from '@/utils/casing';
import type { Assistant } from '@/types/assistants/assistant';

/**
 * Listing the canvases an assistant has published.
 *
 * Read as the signed-in viewer through the ordinary logs proxy, not through the
 * token plane: in this pane the viewer *is* the owner looking at their own
 * assistant, so there is no token to resolve and no admin key involved. The token
 * plane exists for the case where those differ.
 */

const PAGE_SIZE = 200;

/**
 * Fields a listing needs.
 *
 * Joined on `&` — a comma matches no field and returns zero rows, silently, which
 * looks exactly like an assistant that has never built a canvas. `bundle_code` and
 * `tsx_source` are excluded by omission: a list of twenty canvases would otherwise
 * transfer twenty compiled bundles to render twenty rows of text.
 */
const CANVAS_METADATA_FIELDS = [
  'token',
  'title',
  'description',
  'canvas_id',
  'status',
  'visibility',
  'binding_contexts',
  'kit_version',
  'created_at',
  'updated_at',
].join('&');

export interface CanvasListRecord {
  token: string;
  title: string;
  description?: string | null;
  canvasId?: number;
  status?: string;
  visibility?: string;
  bindingContexts?: string | null;
  kitVersion?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

async function fetchContext(context: string): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({
    projectName: 'Assistants',
    context,
    limit: String(PAGE_SIZE),
    fromFields: CANVAS_METADATA_FIELDS,
  });

  const response = await fetch(`/api/logs?${params.toString()}`, { cache: 'no-store' });
  if (!response.ok) return [];

  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) return [];

  const data = await response.json();
  const logs: Array<{ entries?: Record<string, unknown> }> = data?.logs ?? [];
  return logs.map((log) => snakeToCamelObject<Record<string, unknown>>(log.entries ?? {}));
}

/**
 * Every canvas readable in this assistant's scope.
 *
 * Reads the personal root and each team root the assistant belongs to, because a
 * canvas written to a team lives under `Teams/{id}/Canvas/Views` and would be
 * invisible to a personal-root-only read.
 */
export async function fetchCanvasList(
  assistant: Assistant,
  root: ContextRoot | null = null
): Promise<CanvasListRecord[]> {
  const readableRoots = root ? [root] : roots(assistant);
  const results = await Promise.all(
    readableRoots.map((entry) =>
      fetchContext(rootContext(entry, assistant.userId, assistant.agentId, 'Canvas/Views'))
    )
  );

  return results
    .flat()
    .filter((row) => typeof row.token === 'string' && row.token.length > 0)
    .map(
      (row): CanvasListRecord => ({
        token: row.token as string,
        title: typeof row.title === 'string' && row.title ? row.title : 'Untitled canvas',
        description: typeof row.description === 'string' ? row.description : null,
        canvasId: typeof row.canvasId === 'number' ? row.canvasId : undefined,
        status: typeof row.status === 'string' ? row.status : undefined,
        visibility: typeof row.visibility === 'string' ? row.visibility : undefined,
        bindingContexts: typeof row.bindingContexts === 'string' ? row.bindingContexts : null,
        kitVersion: typeof row.kitVersion === 'string' ? row.kitVersion : undefined,
        createdAt: typeof row.createdAt === 'string' ? row.createdAt : null,
        updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : null,
      })
    )
    .sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''));
}
