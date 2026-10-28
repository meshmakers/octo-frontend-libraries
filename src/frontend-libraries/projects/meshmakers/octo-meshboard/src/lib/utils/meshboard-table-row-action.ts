import { InjectionToken } from '@angular/core';

/** What the host receives when a user triggers a table widget's row action (AB#7728). */
export interface MeshBoardTableRowActionEvent {
  /** Persisted id of the widget (`rtId`), or its local id for a widget that was never saved. */
  widgetId: string;
  /** Title of the widget as configured on the board. */
  widgetTitle: string;
  /** rtId of the MeshBoard the widget belongs to; null when the board is not persisted. */
  meshBoardRtId: string | null;
  /** Label of the action as configured on the widget. */
  actionLabel: string;
  /** The row's values, keyed by column field (attribute path / query column). */
  row: Readonly<Record<string, unknown>>;
}

/**
 * Host handler of table row actions (AB#7728). Same pattern as `MESHBOARD_LABEL_RESOLVER`: a
 * table widget offers its configured row action only when a handler is provided; the handler
 * decides by `widgetId` / `widgetTitle` what to open. Provide it app-wide or on the component that
 * embeds `<mm-meshboard-view>`. Errors thrown by the handler are logged and do not break the table.
 *
 * ```ts
 * { provide: MESHBOARD_TABLE_ROW_ACTION_HANDLER, useValue: (e) => dailyDetails.open(e.row) }
 * ```
 */
export type MeshBoardTableRowActionHandler = (event: MeshBoardTableRowActionEvent) => void | Promise<void>;

/** App-wide {@link MeshBoardTableRowActionHandler}. Not provided = tables offer no row action. */
export const MESHBOARD_TABLE_ROW_ACTION_HANDLER = new InjectionToken<MeshBoardTableRowActionHandler>('MESHBOARD_TABLE_ROW_ACTION_HANDLER');

/** Marker rule (AB#7728): a number, or a numeric string, above zero. Booleans and blanks never mark. */
export function isPositiveMarkerValue(value: unknown): boolean {
  if (typeof value === 'number') {
    return value > 0;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0;
  }
  return false;
}
