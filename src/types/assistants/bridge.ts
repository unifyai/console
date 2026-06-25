/**
 * Data Bridge types shared between TileViewer (iframe script) and the
 * Next.js proxy routes.
 *
 * Each operation type mirrors a Unity DataBinding variant:
 *   FilterBinding  -> filter  -> UnifyData.filter()
 *   ReduceBinding  -> reduce  -> UnifyData.reduce()
 *   JoinBinding    -> join    -> UnifyData.join()
 *   JoinReduceBinding -> join_reduce -> UnifyData.joinReduce()
 */

export type BridgeOperation = 'filter' | 'reduce' | 'join' | 'join_reduce';

// ---------------------------------------------------------------------------
// Per-operation request bodies (camelCase — Console-internal convention)
// ---------------------------------------------------------------------------

export interface FilterBridgeBody {
  operation?: 'filter';
  context: string;
  filter?: string;
  columns?: string[];
  excludeColumns?: string[];
  orderBy?: string;
  descending?: boolean;
  sorting?: Record<string, string>;
  limit?: number;
  offset?: number;
  groupBy?: string[];
  columnContext?: string;
  randomize?: boolean;
}

export interface ReduceBridgeBody {
  operation: 'reduce';
  context: string;
  metric: string;
  columns: string | string[];
  filter?: string;
  groupBy?: string[];
  resultWhere?: string;
}

export interface JoinBridgeBody {
  operation: 'join';
  tables: string[];
  joinExpr: string;
  select: Record<string, string>;
  mode?: string;
  leftWhere?: string;
  rightWhere?: string;
  resultWhere?: string;
  resultLimit?: number;
  resultOffset?: number;
}

export interface JoinReduceBridgeBody {
  operation: 'join_reduce';
  tables: string[];
  joinExpr: string;
  select: Record<string, string>;
  mode?: string;
  leftWhere?: string;
  rightWhere?: string;
  metric: string;
  columns: string | string[];
  groupBy?: string[];
  resultWhere?: string;
}

export type BridgeRequestBody =
  | FilterBridgeBody
  | ReduceBridgeBody
  | JoinBridgeBody
  | JoinReduceBridgeBody;

// ---------------------------------------------------------------------------
// postMessage protocol between iframe and parent TileViewer
// ---------------------------------------------------------------------------

export interface BridgeRequestMessage {
  type: 'unify-data-request';
  id: string;
  operation: BridgeOperation;
  [key: string]: unknown;
}

export interface BridgeResponseMessage {
  type: 'unify-data-response';
  id: string;
  data?: unknown;
  error?: string;
}
