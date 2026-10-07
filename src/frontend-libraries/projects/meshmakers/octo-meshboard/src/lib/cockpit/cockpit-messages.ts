import { InjectionToken, Signal, computed, inject, isSignal } from '@angular/core';

/**
 * Translatable texts of the cockpit widgets (AB#5622): "Attention list", the KPI tiles
 * ("Adapter status", "CK model state", "Pipeline executions 24 h") and "Recent items".
 *
 * The widgets are created by the MeshBoard, so a host translates them through
 * {@link COCKPIT_WIDGET_MESSAGES} (or `provideCockpitWidgetHost({ messages })`); a widget used on
 * its own also takes a `messages` input, which wins over the token. Both accept a
 * `Partial<CockpitWidgetMessages>`; members that are missing, `undefined` or `null` keep the
 * English default from {@link DEFAULT_COCKPIT_WIDGET_MESSAGES}. Members added later will be
 * optional, so a complete object written for this version keeps compiling.
 *
 * Placeholders in braces (`{count}`) are filled with {@link formatCockpitMessage}. Not covered:
 * the config dialogs (board editors) and the findings of the built-in OctoMesh attention
 * providers, except "Failed pipeline executions" (`attentionFailedExecutions*`) — a host's own
 * providers bring their own (translated) titles and texts.
 */
export interface CockpitWidgetMessages {
  /** BCP 47 locale for numbers on the tiles and the finding count badge. Default: "en-US" */
  numberLocale: string;

  // --- Shared ---
  /** Viewers without builder roles, instead of role requirements. Default: "Not available" */
  notAvailable: string;
  /** Default: "Loading…" */
  loading: string;
  /** Default: "No tenant selected." */
  noTenant: string;

  // --- Attention list ---
  /** Severity chip. Default: "Error" */
  severityError: string;
  /** Severity chip. Default: "Warning" */
  severityWarning: string;
  /** Severity chip. Default: "Info" */
  severityInfo: string;
  /** Default: "Checking…" */
  attentionChecking: string;
  /** Builders when no check is visible for them. Default: "No health checks are available for your role." */
  attentionNoChecksForRole: string;
  /** Chip of the empty state. Default: "All clear" */
  attentionAllClear: string;
  /** Text of the empty state. Default: "Nothing needs attention." */
  attentionNothingNeedsAttention: string;
  /** Accessible name of the finding list. Default: "Needs attention" */
  attentionListLabel: string;
  /** Explain button. Default: "✦ Explain" */
  attentionExplain: string;
  /** `{count}` = findings not shown. Default: "and {count} more" */
  attentionMore: string;
  /** Accessible name of a finding's count badge; `{count}` = formatted count. Default: "Count: {count}" */
  attentionCountLabel: string;
  /** Default: "The health checks could not be loaded." */
  attentionLoadFailed: string;

  // --- Attention finding "Failed pipeline executions" (optional members, added later) ---
  /** Title; the count is the finding's badge. Default: "Failed pipeline executions in the last 24 h" */
  attentionFailedExecutionsTitle?: string;
  /** `{failed}`, `{total}` formatted counts, `{ratio}` formatted percentage. Default: "{failed} of {total} executions failed ({ratio}). The Data Flows list shows which pipelines fail, their execution history the errors." */
  attentionFailedExecutionsText?: string;
  /** Appended to the text after a capped read. Default: "Counted over the first {read} of {total} data flows." */
  attentionFailedExecutionsTruncated?: string;
  /** Link chip. Default: "Open data flows" */
  attentionFailedExecutionsLink?: string;
  /** "✦ Explain" prefill; `{count}` = formatted failed count. Default: "Why did {count} pipeline executions fail in the last 24 hours?" */
  attentionFailedExecutionsExplain?: string;

  // --- KPI tiles (shared) ---
  /** A tile whose query failed. Default: "The figure could not be loaded." */
  kpiLoadFailed: string;
  /** Builders without the role / model of the adapter and execution tiles. */
  kpiNeedsCommunication: string;
  /** Builders without the role of the CK model tile. Default: "Needs the AdminPanelManagement role." */
  kpiNeedsAdminPanel: string;

  // --- Adapter status ---
  /** Default: "Adapters online" */
  kpiAdaptersLabel: string;
  /** Default: "{count} hibernated" */
  kpiAdaptersHibernated: string;
  /** Default: "{count} edge / local" */
  kpiAdaptersEdgeLocal: string;
  /** Default: "{count} not deployed" */
  kpiAdaptersNotDeployed: string;
  /** Capped read. Default: "based on the first {read} of {total} adapters" */
  kpiAdaptersTruncated: string;
  /** Default: "No adapters" */
  kpiAdaptersNone: string;
  /** Default: "None deployed" */
  kpiAdaptersNoneDeployed: string;
  /** `{count}` may carry a "≥ " prefix. Default: "{count} offline" */
  kpiAdaptersOffline: string;
  /** Default: "All online" */
  kpiAdaptersAllOnline: string;

  // --- Pipeline executions 24 h ---
  /** Default: "Pipeline executions 24 h" */
  kpiExecutionsLabel: string;
  /** Default: "No executions in the last 24 hours" */
  kpiExecutionsNone: string;
  /** Default: "{count} succeeded" */
  kpiExecutionsSucceeded: string;
  /** Capped read. Default: "based on the first {read} of {total} data flows" */
  kpiExecutionsTruncated: string;
  /** Default: "Idle" */
  kpiExecutionsIdle: string;
  /** `{count}` may carry a "≥ " prefix. Default: "{count} failed" */
  kpiExecutionsFailed: string;
  /** Default: "No failures" */
  kpiExecutionsNoFailures: string;
  /** Accessible sparkline summary. Default: "Executions per hour over the last 24 hours, peak {peak}; {total} executions, {failed} failed" */
  kpiExecutionsSparkline: string;

  // --- CK model state ---
  /** Default: "CK models available" */
  kpiCkModelsLabel: string;
  /** Default: "{count} importing" */
  kpiCkModelsImporting: string;
  /** Names of failed models with a rest. Default: "{names} and {count} more" */
  kpiCkModelsMoreNames: string;
  /** Default: "No models" */
  kpiCkModelsNone: string;
  /** Default: "{count} ResolveFailed" */
  kpiCkModelsResolveFailed: string;
  /** Default: "Importing" */
  kpiCkModelsImportingStatus: string;
  /** Default: "All available" */
  kpiCkModelsAllAvailable: string;

  // --- Recent items ---
  /** Default: "Recently opened items could not be read." */
  recentLoadFailed: string;
  /** Accessible name of the list when the widget has no title. Default: "Recently opened" */
  recentListLabel: string;
  /** Default: "Nothing opened yet. Pages, entities and boards you open appear here." */
  recentEmpty: string;
  /** After the shortcut key. Default: "shows the same list" */
  recentPaletteHint: string;
  /** Tooltip of the palette hint. Default: "Open the command palette" */
  recentPaletteTitle: string;
  /** Shortcut label when the source names none. Default: "Ctrl K" */
  recentPaletteShortcut: string;
  /** Default: "just now" */
  recentJustNow: string;
  /** Default: "{count} min ago" */
  recentMinutesAgo: string;
  /** Default: "{count} h ago" */
  recentHoursAgo: string;
  /** Default: "yesterday" */
  recentYesterday: string;
  /** Default: "{count} days ago" */
  recentDaysAgo: string;
}

/** English defaults — today's texts. Complete: every member (optional ones too) has a value. */
export const DEFAULT_COCKPIT_WIDGET_MESSAGES: Readonly<Required<CockpitWidgetMessages>> = {
  numberLocale: 'en-US',
  notAvailable: 'Not available',
  loading: 'Loading…',
  noTenant: 'No tenant selected.',
  severityError: 'Error',
  severityWarning: 'Warning',
  severityInfo: 'Info',
  attentionChecking: 'Checking…',
  attentionNoChecksForRole: 'No health checks are available for your role.',
  attentionAllClear: 'All clear',
  attentionNothingNeedsAttention: 'Nothing needs attention.',
  attentionListLabel: 'Needs attention',
  attentionExplain: '✦ Explain',
  attentionMore: 'and {count} more',
  attentionCountLabel: 'Count: {count}',
  attentionLoadFailed: 'The health checks could not be loaded.',
  attentionFailedExecutionsTitle: 'Failed pipeline executions in the last 24 h',
  attentionFailedExecutionsText: '{failed} of {total} executions failed ({ratio}). The Data Flows list shows which pipelines fail, their execution history the errors.',
  attentionFailedExecutionsTruncated: 'Counted over the first {read} of {total} data flows.',
  attentionFailedExecutionsLink: 'Open data flows',
  attentionFailedExecutionsExplain: 'Why did {count} pipeline executions fail in the last 24 hours?',
  kpiLoadFailed: 'The figure could not be loaded.',
  kpiNeedsCommunication: 'Needs the CommunicationManagement role and the System.Communication model.',
  kpiNeedsAdminPanel: 'Needs the AdminPanelManagement role.',
  kpiAdaptersLabel: 'Adapters online',
  kpiAdaptersHibernated: '{count} hibernated',
  kpiAdaptersEdgeLocal: '{count} edge / local',
  kpiAdaptersNotDeployed: '{count} not deployed',
  kpiAdaptersTruncated: 'based on the first {read} of {total} adapters',
  kpiAdaptersNone: 'No adapters',
  kpiAdaptersNoneDeployed: 'None deployed',
  kpiAdaptersOffline: '{count} offline',
  kpiAdaptersAllOnline: 'All online',
  kpiExecutionsLabel: 'Pipeline executions 24 h',
  kpiExecutionsNone: 'No executions in the last 24 hours',
  kpiExecutionsSucceeded: '{count} succeeded',
  kpiExecutionsTruncated: 'based on the first {read} of {total} data flows',
  kpiExecutionsIdle: 'Idle',
  kpiExecutionsFailed: '{count} failed',
  kpiExecutionsNoFailures: 'No failures',
  kpiExecutionsSparkline: 'Executions per hour over the last 24 hours, peak {peak}; {total} executions, {failed} failed',
  kpiCkModelsLabel: 'CK models available',
  kpiCkModelsImporting: '{count} importing',
  kpiCkModelsMoreNames: '{names} and {count} more',
  kpiCkModelsNone: 'No models',
  kpiCkModelsResolveFailed: '{count} ResolveFailed',
  kpiCkModelsImportingStatus: 'Importing',
  kpiCkModelsAllAvailable: 'All available',
  recentLoadFailed: 'Recently opened items could not be read.',
  recentListLabel: 'Recently opened',
  recentEmpty: 'Nothing opened yet. Pages, entities and boards you open appear here.',
  recentPaletteHint: 'shows the same list',
  recentPaletteTitle: 'Open the command palette',
  recentPaletteShortcut: 'Ctrl K',
  recentJustNow: 'just now',
  recentMinutesAgo: '{count} min ago',
  recentHoursAgo: '{count} h ago',
  recentYesterday: 'yesterday',
  recentDaysAgo: '{count} days ago'
};

/**
 * What a host provides on {@link COCKPIT_WIDGET_MESSAGES}: a fixed object, or a signal for apps
 * that switch the language at runtime (the widgets follow it).
 */
export type CockpitWidgetMessagesSource = Partial<CockpitWidgetMessages> | Signal<Partial<CockpitWidgetMessages> | null | undefined>;

/** Optional: the host's translations of the cockpit widget texts (English without it). */
export const COCKPIT_WIDGET_MESSAGES = new InjectionToken<CockpitWidgetMessagesSource>('COCKPIT_WIDGET_MESSAGES');

/**
 * Merges messages over {@link DEFAULT_COCKPIT_WIDGET_MESSAGES}; missing, `undefined` and `null`
 * members keep their default, so a widget never renders an empty label.
 */
export function resolveCockpitWidgetMessages(...layers: (Partial<CockpitWidgetMessages> | null | undefined)[]): Required<CockpitWidgetMessages> {
  const resolved: Required<CockpitWidgetMessages> = { ...DEFAULT_COCKPIT_WIDGET_MESSAGES };
  for (const layer of layers) {
    if (!layer) {
      continue;
    }
    for (const key of Object.keys(layer) as (keyof CockpitWidgetMessages)[]) {
      const value = layer[key];
      if (value !== undefined && value !== null) {
        resolved[key] = value;
      }
    }
  }
  return resolved;
}

/** Fills `{name}` placeholders; unknown placeholders stay as they are. */
export function formatCockpitMessage(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => name in params ? String(params[name]) : match);
}

/** Reads {@link COCKPIT_WIDGET_MESSAGES} (fixed or signal) as the current host layer. */
export function readCockpitMessagesSource(source: CockpitWidgetMessagesSource | null | undefined): Partial<CockpitWidgetMessages> | null {
  if (!source) {
    return null;
  }
  return isSignal(source) ? source() ?? null : source;
}

/**
 * The resolved messages of a widget: defaults, then the host token, then the widget's own
 * `messages` input. Call in an injection context.
 */
export function injectCockpitWidgetMessages(input?: () => Partial<CockpitWidgetMessages> | null | undefined): Signal<CockpitWidgetMessages> {
  const source = inject(COCKPIT_WIDGET_MESSAGES, { optional: true });
  return computed(() => resolveCockpitWidgetMessages(readCockpitMessagesSource(source), input?.()));
}
