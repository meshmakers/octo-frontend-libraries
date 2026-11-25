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
  /**
   * Resolution flags of the line chart data badge, their tooltips and the click-through explanation
   * (AB#9743); defaults in {@link DEFAULT_MESHBOARD_MESSAGES}. Placeholders: `{requested}`, `{date}`,
   * `{delivered}`, `{ofRequested}`, `{from}`.
   */
  resolutionFlagNoHistory?: string;
  resolutionFlagLimited?: string;
  resolutionFlagOfRequested?: string;
  resolutionFlagNoRollup?: string;
  resolutionFlagRaw?: string;
  resolutionFlagNoArchive?: string;
  resolutionTitleNoHistoryFrom?: string;
  resolutionTitleNoHistory?: string;
  resolutionTitleLimited?: string;
  resolutionTitleNoRollup?: string;
  resolutionTitleRaw?: string;
  resolutionTitleNoArchive?: string;
  resolutionInfoHeading?: string;
  resolutionInfoClose?: string;
  resolutionInfoOfRequested?: string;
  resolutionInfoNoHistoryFrom?: string;
  resolutionInfoNoHistory?: string;
  resolutionInfoLimited?: string;
  resolutionInfoNoRollup?: string;
  resolutionInfoRaw?: string;
  resolutionInfoNoArchive?: string;
}

/** The resolution texts of the line chart (AB#9743), resolved like every other member. */
const RESOLUTION_MESSAGE_KEYS = [
  'resolutionFlagNoHistory', 'resolutionFlagLimited', 'resolutionFlagOfRequested', 'resolutionFlagNoRollup',
  'resolutionFlagRaw', 'resolutionFlagNoArchive', 'resolutionTitleNoHistoryFrom', 'resolutionTitleNoHistory',
  'resolutionTitleLimited', 'resolutionTitleNoRollup', 'resolutionTitleRaw', 'resolutionTitleNoArchive',
  'resolutionInfoHeading', 'resolutionInfoClose', 'resolutionInfoOfRequested', 'resolutionInfoNoHistoryFrom',
  'resolutionInfoNoHistory', 'resolutionInfoLimited', 'resolutionInfoNoRollup', 'resolutionInfoRaw',
  'resolutionInfoNoArchive'
] as const;

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
  resolutionFlagNoHistory: '⚠ no history',
  resolutionFlagLimited: '⚠ limited',
  resolutionFlagOfRequested: ' (of {requested})',
  resolutionFlagNoRollup: '⚠ no rollup',
  resolutionFlagRaw: '⚠ raw',
  resolutionFlagNoArchive: '⚠ no archive',
  resolutionTitleNoHistoryFrom: 'History at this resolution is available from {date}',
  resolutionTitleNoHistory: 'A finer resolution exists but holds no data for this time range.',
  resolutionTitleLimited: 'Resolution limited: the coarsest available rollup delivers fewer points than requested for this range.',
  resolutionTitleNoRollup: 'No compatible rollup for this aggregation — the raw archive was returned unreduced.',
  resolutionTitleRaw: 'Base archive grain unknown — returned unreduced.',
  resolutionTitleNoArchive: 'No resolvable archive for this series.',
  resolutionInfoHeading: 'Resolution-aware',
  resolutionInfoClose: 'Close',
  resolutionInfoOfRequested: ' (the chart could show ~{requested})',
  resolutionInfoNoHistoryFrom: ' That resolution only has history from {date} onwards.',
  resolutionInfoNoHistory: 'A finer resolution exists for this series, but it holds no data for the selected time range, '
    + 'so the chart fell back to a coarser one ({delivered} point(s){ofRequested}).{from} '
    + 'The values are correct — narrow the range to a covered period to see finer detail.',
  resolutionInfoLimited: 'This chart auto-selects the coarsest stored resolution that still fits the view. '
    + 'For this time range the finest matching rollup only provides {delivered} point(s){ofRequested}, '
    + 'so the line is drawn at a coarser resolution than the screen could show. The values are correct — '
    + 'to see finer detail, narrow the time range or provision a finer rollup for this series.',
  resolutionInfoNoRollup: 'No rollup matches this series\' aggregation, so the raw archive was returned unreduced '
    + '({delivered} points). Add a matching rollup to enable server-side reduction, or narrow the time range.',
  resolutionInfoRaw: 'The base archive\'s native resolution is undeclared, so the data was returned unreduced. '
    + 'Set the archive\'s period/grain to enable resolution-aware selection.',
  resolutionInfoNoArchive: 'No queryable archive was found for this series, so nothing could be plotted.',
};

/** Replaces `{name}` placeholders of a MeshBoard message; unknown placeholders stay. */
export function formatMeshBoardMessage(message: string, values: Record<string, string | number>): string {
  return message.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match);
}

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
    ...Object.fromEntries(RESOLUTION_MESSAGE_KEYS.filter(key => messages?.[key]).map(key => [key, messages?.[key]])),
  };
}

/** The resolved MeshBoard messages of {@link MESHBOARD_MESSAGES} as a signal. Call in an injection context. */
export function injectMeshBoardMessages(): Signal<MeshBoardMessages & typeof DEFAULT_MESHBOARD_MESSAGES> {
  const source = inject(MESHBOARD_MESSAGES, { optional: true });
  return computed(() => resolveMeshBoardMessages(readMeshBoardMessagesSource(source)));
}
