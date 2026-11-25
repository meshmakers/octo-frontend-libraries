import { InjectionToken, Signal, computed, inject, isSignal } from '@angular/core';
import { ListViewMessages } from '@meshmakers/shared-ui';

/**
 * Host translations of the MeshBoard widget texts (AB#5622). Every member is optional; a missing
 * member keeps the English default, so an app sets only what it translates.
 */
export interface MeshBoardMessages {
  /**
   * Texts of the list inside the table widget (`mm-list-view`): "No records available.", the
   * pager texts, the toolbar labels and the row action names. Merged over the list's English
   * defaults (`DEFAULT_LIST_VIEW_MESSAGES`).
   */
  tableList?: Partial<ListViewMessages>;
  /** Placeholder of a table widget without data source / columns. Default: "Table not configured" */
  tableNotConfigured?: string;
  /**
   * Board notice when an entity selector's stream-data scope could not be resolved (AB#7721);
   * `{label}` is replaced by the selector label. Default:
   * 'Could not resolve the scope of "{label}" - widgets bound to it show no data.'
   */
  scopeResolutionFailed?: string;
  /**
   * Board notice for a dependent entity selector without pick while its leader has one (AB#7916):
   * widgets bound to it show no data until a pick is made. `{label}` is replaced by the selector
   * label. Default: 'Pick a {label} to see this data.'
   */
  scopePickRequired?: string;
  /** Word under the numbers of the KPI change line for a good change (AB#9245). Default: 'Favourable' */
  kpiChangeFavourable?: string;
  /** Word under the numbers of the KPI change line for a bad change (AB#9245). Default: 'Unfavourable' */
  kpiChangeUnfavourable?: string;
  /** Accessible text of the widget loading spinner (AB#9743). Default: 'Loading' */
  loading?: string;
  /** Accessible text of the board loading mask (AB#9743). Default: 'Loading MeshBoard...' */
  loadingMeshBoard?: string;
  /** Text of a widget group without items when the board sets no `emptyMessage` (AB#9743). Default: 'No data available' */
  noDataAvailable?: string;
  /** Tooltip of the board's refresh button (AB#9743). Default: 'Refresh All Widgets' */
  refreshAllWidgets?: string;
  /** Tooltip of the button that resets the board period to its default (AB#9743). Default: 'Reset to default time filter' */
  resetTimeFilter?: string;
  /** Name of a time shift one period back, in the tooltip of a shifted widget (AB#9743). Default: 'Previous period' */
  timeShiftPreviousPeriod?: string;
  /** Name of a time shift one year back (AB#9743). Default: 'Same period last year' */
  timeShiftSamePeriodLastYear?: string;
  /** Name of a time shift several periods back; `{count}` = the number of periods (AB#9743). Default: '{count} periods back' */
  timeShiftPeriodsBack?: string;
  /** Name of a time shift several years back; `{count}` = the number of years (AB#9743). Default: '{count} years back' */
  timeShiftYearsBack?: string;
  /** Data badge of a line chart; `{rows}`, `{points}` (AB#9743). Default: '{rows} rows · {points} pts' */
  dataBadge?: string;
  /** Tooltip of the line chart data badge; `{total}` = total count (AB#9743). Default: 'rows = data rows fetched (points × series) · pts = distinct time points plotted (totalCount {total})' */
  dataBadgeLegend?: string;
  /** Line under a resolution hint in the data badge tooltip (AB#9743). Default: 'Click for details.' */
  dataBadgeClickForDetails?: string;
  /** Hint of a line or bar chart series source without data; `{source}` = its label (AB#9743). Default: 'No data for {source}' */
  noDataForSource?: string;
}

/** Default texts of {@link MeshBoardMessages} (the list texts default inside `mm-list-view`). */
export const DEFAULT_MESHBOARD_MESSAGES: Required<Omit<MeshBoardMessages, 'tableList'>> = {
  tableNotConfigured: 'Table not configured',
  scopeResolutionFailed: 'Could not resolve the scope of "{label}" - widgets bound to it show no data.',
  scopePickRequired: 'Pick a {label} to see this data.',
  kpiChangeFavourable: 'Favourable',
  kpiChangeUnfavourable: 'Unfavourable',
  loading: 'Loading',
  loadingMeshBoard: 'Loading MeshBoard...',
  noDataAvailable: 'No data available',
  refreshAllWidgets: 'Refresh All Widgets',
  resetTimeFilter: 'Reset to default time filter',
  timeShiftPreviousPeriod: 'Previous period',
  timeShiftSamePeriodLastYear: 'Same period last year',
  timeShiftPeriodsBack: '{count} periods back',
  timeShiftYearsBack: '{count} years back',
  dataBadge: '{rows} rows · {points} pts',
  dataBadgeLegend: 'rows = data rows fetched (points × series) · pts = distinct time points plotted (totalCount {total})',
  dataBadgeClickForDetails: 'Click for details.',
  noDataForSource: 'No data for {source}',
};

/**
 * What a host provides on {@link MESHBOARD_MESSAGES}: a fixed object, or a signal for apps that
 * switch the language at runtime (the widgets follow it).
 */
export type MeshBoardMessagesSource = MeshBoardMessages | Signal<MeshBoardMessages | null | undefined>;

/**
 * Optional: the host's translations of the MeshBoard widget texts (English without it). Set it
 * once app-wide, either directly or via `provideMeshBoard({ messages })` /
 * `provideMeshBoardMessages(messages)`.
 *
 * ```ts
 * providers: [provideMeshBoardMessages({ tableList: { noRecords: 'Keine Einträge vorhanden.', pagerItemsPerPage: 'Einträge pro Seite' } })]
 * ```
 */
export const MESHBOARD_MESSAGES = new InjectionToken<MeshBoardMessagesSource>('MESHBOARD_MESSAGES');

/** Reads a {@link MeshBoardMessagesSource} (fixed or signal) as the current host layer. */
export function readMeshBoardMessagesSource(source: MeshBoardMessagesSource | null | undefined): MeshBoardMessages | null {
  if (!source) {
    return null;
  }
  return isSignal(source) ? source() ?? null : source;
}

/** The resolved MeshBoard texts: defaults with the host layer on top (missing / null members keep the default). */
export function resolveMeshBoardMessages(messages: MeshBoardMessages | null | undefined): MeshBoardMessages & typeof DEFAULT_MESHBOARD_MESSAGES {
  return {
    ...DEFAULT_MESHBOARD_MESSAGES,
    ...(messages?.tableList ? { tableList: messages.tableList } : {}),
    ...(messages?.tableNotConfigured ? { tableNotConfigured: messages.tableNotConfigured } : {}),
    ...(messages?.scopeResolutionFailed ? { scopeResolutionFailed: messages.scopeResolutionFailed } : {}),
    ...(messages?.scopePickRequired ? { scopePickRequired: messages.scopePickRequired } : {}),
    ...(messages?.kpiChangeFavourable ? { kpiChangeFavourable: messages.kpiChangeFavourable } : {}),
    ...(messages?.kpiChangeUnfavourable ? { kpiChangeUnfavourable: messages.kpiChangeUnfavourable } : {}),
    ...(messages?.loading ? { loading: messages.loading } : {}),
    ...(messages?.loadingMeshBoard ? { loadingMeshBoard: messages.loadingMeshBoard } : {}),
    ...(messages?.noDataAvailable ? { noDataAvailable: messages.noDataAvailable } : {}),
    ...(messages?.refreshAllWidgets ? { refreshAllWidgets: messages.refreshAllWidgets } : {}),
    ...(messages?.resetTimeFilter ? { resetTimeFilter: messages.resetTimeFilter } : {}),
    ...(messages?.timeShiftPreviousPeriod ? { timeShiftPreviousPeriod: messages.timeShiftPreviousPeriod } : {}),
    ...(messages?.timeShiftSamePeriodLastYear ? { timeShiftSamePeriodLastYear: messages.timeShiftSamePeriodLastYear } : {}),
    ...(messages?.timeShiftPeriodsBack ? { timeShiftPeriodsBack: messages.timeShiftPeriodsBack } : {}),
    ...(messages?.timeShiftYearsBack ? { timeShiftYearsBack: messages.timeShiftYearsBack } : {}),
    ...(messages?.dataBadge ? { dataBadge: messages.dataBadge } : {}),
    ...(messages?.dataBadgeLegend ? { dataBadgeLegend: messages.dataBadgeLegend } : {}),
    ...(messages?.dataBadgeClickForDetails ? { dataBadgeClickForDetails: messages.dataBadgeClickForDetails } : {}),
    ...(messages?.noDataForSource ? { noDataForSource: messages.noDataForSource } : {}),
  };
}

/** The resolved MeshBoard messages of {@link MESHBOARD_MESSAGES} as a signal. Call in an injection context. */
export function injectMeshBoardMessages(): Signal<MeshBoardMessages & typeof DEFAULT_MESHBOARD_MESSAGES> {
  const source = inject(MESHBOARD_MESSAGES, { optional: true });
  return computed(() => resolveMeshBoardMessages(readMeshBoardMessagesSource(source)));
}
