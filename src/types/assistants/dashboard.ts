/**
 * Dashboard and Tile types for the Dashboards pane.
 *
 * CamelCase mirrors of the Python Pydantic models in
 * droid/dashboard_manager/types/{dashboard,tile}.py.
 *
 * Orchestra stores these in:
 *   {userId}/{assistantId}/Dashboards/Layouts
 *   {userId}/{assistantId}/Dashboards/Tiles
 */

export interface DashboardTilePosition {
  tileToken: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardRecord {
  dashboardId?: number;
  token: string;
  title: string;
  description: string | null;
  layout: string;
  tileCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface TileRecord {
  tileId?: number;
  token: string;
  title: string;
  description: string | null;
  /** Full HTML — may be absent when only metadata was fetched */
  htmlContent?: string;
  hasDataBindings: boolean;
  dataBindingContexts: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface DashboardPaneData {
  dashboards: DashboardRecord[];
  tiles: TileRecord[];
}
