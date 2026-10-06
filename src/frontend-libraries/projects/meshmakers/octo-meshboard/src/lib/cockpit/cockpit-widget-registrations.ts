import { EnvironmentProviders, Type, inject, makeEnvironmentProviders, provideAppInitializer } from '@angular/core';
import {
  AdapterStatusWidgetConfig,
  AttentionListWidgetConfig,
  CkModelStateWidgetConfig,
  CockpitKpiWidgetConfig,
  PipelineExecutionsWidgetConfig,
  RecentItemsWidgetConfig
} from '../models/meshboard.models';
import { BaseWidgetConfig, PersistedWidgetData, WidgetPersistenceData, WidgetRegistryService } from '../services/widget-registry.service';
import { AttentionProvider, COCKPIT_ATTENTION_PROVIDERS } from './attention/attention.models';
import { AdaptersAttentionProvider } from './attention/providers/adapters.provider';
import { CkModelsResolveFailedAttentionProvider } from './attention/providers/ck-models-resolve-failed.provider';
import { FeaturesNotInstalledAttentionProvider } from './attention/providers/features-not-installed.provider';
import { UnregisteredPoolsAttentionProvider } from './attention/providers/unregistered-pools.provider';
import { AttentionListConfigDialogComponent, AttentionListConfigResult } from './widgets/attention-list-config-dialog.component';
import { AttentionListWidgetComponent } from './widgets/attention-list-widget.component';
import { CockpitKpiConfigDialogComponent, CockpitKpiConfigResult } from './widgets/cockpit-kpi-config-dialog.component';
import { CockpitKpiWidgetComponent } from './widgets/cockpit-kpi-widget.component';
import { RecentItemsConfigDialogComponent, RecentItemsConfigResult } from './widgets/recent-items-config-dialog.component';
import { MAX_RECENT_ITEMS, RecentItemsWidgetComponent } from './widgets/recent-items-widget.component';

/** The library's attention providers, in display order (errors of the platform first). */
export const BUILT_IN_ATTENTION_PROVIDERS: readonly Type<AttentionProvider>[] = [
  CkModelsResolveFailedAttentionProvider,
  AdaptersAttentionProvider,
  UnregisteredPoolsAttentionProvider,
  FeaturesNotInstalledAttentionProvider
];

function parseConfig(data: PersistedWidgetData): Record<string, unknown> {
  if (!data.config) {
    return {};
  }
  try {
    const parsed = typeof data.config === 'string' ? JSON.parse(data.config) : data.config;
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/** Persisted `providerIds`: an array of non-empty strings, anything else = all providers. */
function providerIdsOf(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const ids = value.filter((id): id is string => typeof id === 'string' && id.length > 0);
  return ids.length > 0 ? ids : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 ? Math.round(value) : undefined;
}

const KPI_DESCRIPTIONS: Record<CockpitKpiWidgetConfig['type'], string> = {
  adapterStatus: 'Adapters online of the adapters expected to run — the same rule as the Integration overview. Needs CommunicationManagement.',
  ckModelState: 'Construction Kit models available of all installed models; ResolveFailed is shown as an error. Needs AdminPanelManagement.',
  pipelineExecutions: 'Pipeline executions of all data flows in the last 24 hours with failures and an hourly sparkline — the same counting as the Data Flows list. Needs CommunicationManagement.'
};

/** Registration of one cockpit KPI widget type (one component and dialog for all three). */
function registerKpiWidget<T extends CockpitKpiWidgetConfig>(
  registry: WidgetRegistryService,
  type: T['type'],
  label: string,
  defaultSize: { colSpan: number; rowSpan: number }
): void {
  const supportsSparkline = type === 'pipelineExecutions';
  registry.registerWidget<T, CockpitKpiConfigResult>({
    type,
    label,
    component: CockpitKpiWidgetComponent,
    configDialogComponent: CockpitKpiConfigDialogComponent,
    configDialogSize: { width: 480, height: 320, minWidth: 380, minHeight: 260 },
    configDialogTitle: `${label} Configuration`,
    defaultSize,
    supportedDataSources: ['static'],
    getInitialConfig: (widget) => ({
      initialShowDetail: widget.showDetail,
      initialShowSparkline: (widget as Partial<PipelineExecutionsWidgetConfig>).showSparkline,
      supportsSparkline,
      description: KPI_DESCRIPTIONS[type]
    }),
    applyConfigResult: (widget, result) => ({
      ...widget,
      showDetail: result.showDetail,
      ...(supportsSparkline ? { showSparkline: result.showSparkline } : {}),
      dataSource: { type: 'static' }
    }),
    createDefaultConfig: (base: BaseWidgetConfig): T => ({
      ...base,
      type,
      colSpan: defaultSize.colSpan,
      rowSpan: defaultSize.rowSpan,
      dataSource: { type: 'static' }
    } as T),
    toPersistedConfig: (widget: T): WidgetPersistenceData => ({
      dataSourceType: 'static',
      config: {
        showDetail: widget.showDetail,
        ...(supportsSparkline ? { showSparkline: (widget as Partial<PipelineExecutionsWidgetConfig>).showSparkline } : {})
      }
    }),
    fromPersistedConfig: (data: PersistedWidgetData, base: BaseWidgetConfig): T => {
      const config = parseConfig(data);
      const widget: CockpitKpiWidgetConfig = {
        ...base,
        rtId: data.rtId,
        type,
        dataSource: { type: 'static' },
        showDetail: optionalBoolean(config['showDetail'])
      } as CockpitKpiWidgetConfig;
      if (supportsSparkline) {
        (widget as PipelineExecutionsWidgetConfig).showSparkline = optionalBoolean(config['showSparkline']);
      }
      return widget as T;
    }
  });
}

/**
 * Registers the cockpit widgets (AB#5558): "Attention list", "Adapter status", "CK model state",
 * "Pipeline executions 24 h" and "Recent items". Persisted with `dataSourceType: 'static'` and a small JSON
 * config (see the README widget catalogue for the exact keys).
 */
export function registerCockpitWidgets(registry: WidgetRegistryService): void {
  registry.registerWidget<AttentionListWidgetConfig, AttentionListConfigResult>({
    type: 'attentionList',
    label: 'Attention List',
    component: AttentionListWidgetComponent,
    configDialogComponent: AttentionListConfigDialogComponent,
    configDialogSize: { width: 620, height: 560, minWidth: 460, minHeight: 400 },
    configDialogTitle: 'Attention List Configuration',
    defaultSize: { colSpan: 6, rowSpan: 2 },
    supportedDataSources: ['static'],
    getInitialConfig: (widget) => ({
      initialProviderIds: widget.providerIds,
      initialMaxItems: widget.maxItems,
      initialShowExplain: widget.showExplain
    }),
    applyConfigResult: (widget, result) => ({
      ...widget,
      providerIds: result.providerIds.length > 0 ? [...result.providerIds] : undefined,
      maxItems: result.maxItems,
      showExplain: result.showExplain,
      dataSource: { type: 'static' }
    }),
    createDefaultConfig: (base: BaseWidgetConfig): AttentionListWidgetConfig => ({
      ...base,
      type: 'attentionList',
      // Two rows: one 200 px row cuts the finding cards' action links off (AB#5558).
      colSpan: 6,
      rowSpan: 2,
      dataSource: { type: 'static' }
    }),
    toPersistedConfig: (widget: AttentionListWidgetConfig): WidgetPersistenceData => ({
      dataSourceType: 'static',
      config: {
        providerIds: widget.providerIds && widget.providerIds.length > 0 ? [...widget.providerIds] : undefined,
        maxItems: widget.maxItems,
        showExplain: widget.showExplain
      }
    }),
    fromPersistedConfig: (data: PersistedWidgetData, base: BaseWidgetConfig): AttentionListWidgetConfig => {
      const config = parseConfig(data);
      return {
        ...base,
        rtId: data.rtId,
        type: 'attentionList',
        dataSource: { type: 'static' },
        providerIds: providerIdsOf(config['providerIds']),
        maxItems: positiveInteger(config['maxItems']),
        showExplain: optionalBoolean(config['showExplain'])
      };
    }
  });

  registerKpiWidget<AdapterStatusWidgetConfig>(registry, 'adapterStatus', 'Adapter Status', { colSpan: 2, rowSpan: 1 });
  registerKpiWidget<CkModelStateWidgetConfig>(registry, 'ckModelState', 'CK Model State', { colSpan: 2, rowSpan: 1 });
  registerKpiWidget<PipelineExecutionsWidgetConfig>(registry, 'pipelineExecutions', 'Pipeline Executions 24 h', { colSpan: 2, rowSpan: 1 });

  registry.registerWidget<RecentItemsWidgetConfig, RecentItemsConfigResult>({
    type: 'recentItems',
    label: 'Recent Items',
    component: RecentItemsWidgetComponent,
    configDialogComponent: RecentItemsConfigDialogComponent,
    configDialogSize: { width: 480, height: 300, minWidth: 380, minHeight: 260 },
    configDialogTitle: 'Recent Items Configuration',
    // Two 200 px rows hold the default eight entries.
    defaultSize: { colSpan: 3, rowSpan: 2 },
    supportedDataSources: ['static'],
    getInitialConfig: (widget) => ({ initialMaxItems: widget.maxItems }),
    applyConfigResult: (widget, result) => ({ ...widget, maxItems: result.maxItems, dataSource: { type: 'static' } }),
    createDefaultConfig: (base: BaseWidgetConfig): RecentItemsWidgetConfig => ({
      ...base,
      type: 'recentItems',
      colSpan: 3,
      rowSpan: 2,
      dataSource: { type: 'static' }
    }),
    toPersistedConfig: (widget: RecentItemsWidgetConfig): WidgetPersistenceData => ({
      dataSourceType: 'static',
      config: { maxItems: widget.maxItems }
    }),
    fromPersistedConfig: (data: PersistedWidgetData, base: BaseWidgetConfig): RecentItemsWidgetConfig => {
      const maxItems = positiveInteger(parseConfig(data)['maxItems']);
      return {
        ...base,
        rtId: data.rtId,
        type: 'recentItems',
        dataSource: { type: 'static' },
        maxItems: maxItems === undefined ? undefined : Math.min(MAX_RECENT_ITEMS, maxItems)
      };
    }
  });
}

/**
 * Registers the cockpit widgets and the library's attention providers. Call it next to
 * `provideMeshBoard()`; provide the host services with `provideCockpitWidgetHost()` and add host
 * checks as `{ provide: COCKPIT_ATTENTION_PROVIDERS, useClass: …, multi: true }`.
 */
export function provideCockpitWidgets(): EnvironmentProviders {
  return makeEnvironmentProviders([
    ...BUILT_IN_ATTENTION_PROVIDERS.map(useClass => ({ provide: COCKPIT_ATTENTION_PROVIDERS, useClass, multi: true })),
    provideAppInitializer(() => registerCockpitWidgets(inject(WidgetRegistryService)))
  ]);
}
