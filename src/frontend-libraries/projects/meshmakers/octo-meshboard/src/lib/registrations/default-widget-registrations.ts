import { EnvironmentProviders, makeEnvironmentProviders, inject, provideAppInitializer } from '@angular/core';
import { WidgetRegistryService, WidgetConfigResult, BaseWidgetConfig, PersistedWidgetData, WidgetPersistenceData } from '../services/widget-registry.service';
import {
  AnyWidgetConfig,
  RuntimeEntityDataSource,
  PersistentQueryDataSource,
  AggregationDataSource,
  ServiceCallDataSource,
  ConstructionKitQueryDataSource,
  RepeaterQueryDataSource,
  EntityCardWidgetConfig,
  KpiWidgetConfig,
  EntityWithAssociationsWidgetConfig,
  TableWidgetConfig,
  GaugeWidgetConfig,
  PieChartWidgetConfig,
  BarChartWidgetConfig,
  StatsGridWidgetConfig,
  StatusIndicatorWidgetConfig,
  ServiceHealthWidgetConfig,
  WidgetGroupConfig,
  MarkdownWidgetConfig,
  DataSource,
  WidgetFilterConfig
} from '../models/meshboard.models';

// Widget Components
import { EntityCardWidgetComponent } from '../widgets/entity-card-widget/entity-card-widget.component';
import { KpiWidgetComponent } from '../widgets/kpi-widget/kpi-widget.component';
import { EntityAssociationsWidgetComponent } from '../widgets/entity-associations-widget/entity-associations-widget.component';
import { TableWidgetComponent } from '../widgets/table-widget/table-widget.component';
import { GaugeWidgetComponent } from '../widgets/gauge-widget/gauge-widget.component';
import { PieChartWidgetComponent } from '../widgets/pie-chart-widget/pie-chart-widget.component';
import { BarChartWidgetComponent } from '../widgets/bar-chart-widget/bar-chart-widget.component';
import { StatsGridWidgetComponent } from '../widgets/stats-grid-widget/stats-grid-widget.component';
import { StatusIndicatorWidgetComponent } from '../widgets/status-indicator-widget/status-indicator-widget.component';
import { ServiceHealthWidgetComponent } from '../widgets/service-health-widget/service-health-widget.component';
import { WidgetGroupComponent } from '../widgets/widget-group/widget-group.component';
import { MarkdownWidgetComponent } from '../widgets/markdown-widget/markdown-widget.component';
// Note: ProcessWidget registration moved to process-widget-registration.ts for lazy loading
// Use provideProcessWidget() or registerProcessWidget() to enable Process Diagram widgets

// Config Dialog Components
import { EntityCardConfigDialogComponent, EntityCardConfigResult } from '../widgets/entity-card-widget/entity-card-config-dialog.component';
import { KpiConfigDialogComponent, KpiConfigResult } from '../widgets/kpi-widget/kpi-config-dialog.component';
import { AssociationsConfigDialogComponent, AssociationsConfigResult } from '../widgets/entity-associations-widget/associations-config-dialog.component';
import { TableConfigDialogComponent, TableConfigResult } from '../widgets/table-widget/table-config-dialog.component';
import { GaugeConfigDialogComponent, GaugeConfigResult } from '../widgets/gauge-widget/gauge-config-dialog.component';
import { PieChartConfigDialogComponent, PieChartConfigResult } from '../widgets/pie-chart-widget/pie-chart-config-dialog.component';
import { BarChartConfigDialogComponent, BarChartConfigResult } from '../widgets/bar-chart-widget/bar-chart-config-dialog.component';
import { StatsGridConfigDialogComponent, StatsGridConfigResult } from '../widgets/stats-grid-widget/stats-grid-config-dialog.component';
import { StatusIndicatorConfigDialogComponent, StatusIndicatorConfigResult } from '../widgets/status-indicator-widget/status-indicator-config-dialog.component';
import { ServiceHealthConfigDialogComponent, ServiceHealthConfigResult } from '../widgets/service-health-widget/service-health-config-dialog.component';
import { WidgetGroupConfigDialogComponent, WidgetGroupConfigResult } from '../widgets/widget-group/widget-group-config-dialog.component';
import { MarkdownConfigDialogComponent, MarkdownConfigResult } from '../widgets/markdown-widget/markdown-config-dialog.component';

/**
 * Helper to extract data source info from widget config
 */
function getDataSourceInfo(widget: AnyWidgetConfig): { ckTypeId?: string; rtId?: string } {
  if (widget.dataSource.type === 'runtimeEntity') {
    return {
      ckTypeId: widget.dataSource.ckTypeId,
      rtId: widget.dataSource.rtId
    };
  }
  return {};
}

/**
 * Helper to create a RuntimeEntityDataSource
 */
function createDataSource(result: WidgetConfigResult, includeAssociations = false): RuntimeEntityDataSource {
  return {
    type: 'runtimeEntity',
    ckTypeId: result.ckTypeId,
    rtId: result.rtId,
    includeAssociations
  };
}

// ========== SOLID: Persistence Helpers ==========

/**
 * Parses the JSON config string from persisted data.
 */
function parseConfig(data: PersistedWidgetData): Record<string, unknown> {
  return data.config ? JSON.parse(data.config) : {};
}

/**
 * Builds a DataSource from persisted data.
 * Maps 'systemQuery' from backend to 'persistentQuery' for frontend.
 */
function buildDataSourceFromPersisted(data: PersistedWidgetData, config: Record<string, unknown>): DataSource {
  if (data.dataSourceType === 'systemQuery' || data.dataSourceType === 'persistentQuery') {
    return {
      type: 'persistentQuery',
      queryRtId: data.dataSourceRtId ?? (config['queryRtId'] as string) ?? '',
      queryName: config['queryName'] as string | undefined
    };
  }

  return {
    type: 'runtimeEntity',
    ckTypeId: data.dataSourceCkTypeId ?? undefined,
    rtId: data.dataSourceRtId ?? undefined
  };
}

/**
 * Creates a base RuntimeEntityDataSource from base config.
 */
function createDefaultRuntimeDataSource(ckTypeId?: string): RuntimeEntityDataSource {
  return {
    type: 'runtimeEntity',
    ckTypeId
  };
}

/**
 * Creates a default PersistentQueryDataSource.
 */
function createDefaultPersistentQueryDataSource(): PersistentQueryDataSource {
  return {
    type: 'persistentQuery',
    queryRtId: ''
  };
}

/**
 * Registers all built-in widget types with the registry.
 * Called during app initialization.
 */
export function registerDefaultWidgets(registry: WidgetRegistryService): void {
  // Entity Card Widget
  registry.registerWidget<EntityCardWidgetConfig, EntityCardConfigResult>({
    type: 'entityCard',
    label: 'Entity Card',
    component: EntityCardWidgetComponent,
    configDialogComponent: EntityCardConfigDialogComponent,
    configDialogSize: { width: 600, height: 450, minWidth: 500, minHeight: 350 },
    configDialogTitle: 'Entity Configuration',
    defaultSize: { colSpan: 2, rowSpan: 2 },
    supportedDataSources: ['runtimeEntity'],
    getInitialConfig: (widget) => ({
      initialCkTypeId: getDataSourceInfo(widget).ckTypeId,
      initialRtId: getDataSourceInfo(widget).rtId
    }),
    applyConfigResult: (widget, result) => ({
      ...widget,
      dataSource: createDataSource(result, true)
    }),

    // SOLID: Factory function
    createDefaultConfig: (base: BaseWidgetConfig): EntityCardWidgetConfig => ({
      ...base,
      type: 'entityCard',
      rowSpan: 2,
      dataSource: createDefaultRuntimeDataSource(),
      showHeader: true,
      showAttributes: true
    }),

    // SOLID: Serialization for persistence
    toPersistedConfig: (widget: EntityCardWidgetConfig): WidgetPersistenceData => ({
      dataSourceType: 'runtimeEntity',
      dataSourceCkTypeId: widget.dataSource.type === 'runtimeEntity' ? widget.dataSource.ckTypeId : undefined,
      dataSourceRtId: widget.dataSource.type === 'runtimeEntity' ? widget.dataSource.rtId : undefined,
      config: {
        showHeader: widget.showHeader,
        showAttributes: widget.showAttributes,
        attributeFilter: widget.attributeFilter
      }
    }),

    // SOLID: Deserialization from persistence
    fromPersistedConfig: (data: PersistedWidgetData, base: BaseWidgetConfig): EntityCardWidgetConfig => {
      const config = parseConfig(data);
      return {
        ...base,
        rtId: data.rtId,
        type: 'entityCard',
        dataSource: {
          type: 'runtimeEntity',
          ckTypeId: data.dataSourceCkTypeId ?? undefined,
          rtId: data.dataSourceRtId ?? undefined
        },
        showHeader: (config['showHeader'] as boolean) ?? true,
        showAttributes: (config['showAttributes'] as boolean) ?? true,
        attributeFilter: config['attributeFilter'] as string[] | undefined
      };
    }
  });

  // KPI Widget
  registry.registerWidget<KpiWidgetConfig, KpiConfigResult>({
    type: 'kpi',
    label: 'KPI',
    component: KpiWidgetComponent,
    configDialogComponent: KpiConfigDialogComponent,
    configDialogSize: { width: 650, height: 600, minWidth: 500, minHeight: 450 },
    configDialogTitle: 'KPI Configuration',
    defaultSize: { colSpan: 1, rowSpan: 1 },
    supportedDataSources: ['runtimeEntity', 'persistentQuery'],
    getInitialConfig: (widget) => {
      const kpiWidget = widget as KpiWidgetConfig;
      const isPersistentQuery = kpiWidget.dataSource.type === 'persistentQuery';

      return {
        // Runtime entity fields
        initialCkTypeId: getDataSourceInfo(widget).ckTypeId,
        initialRtId: getDataSourceInfo(widget).rtId,
        initialValueAttribute: kpiWidget.valueAttribute,
        initialLabelAttribute: kpiWidget.labelAttribute,
        // Persistent query fields
        initialDataSourceType: isPersistentQuery ? 'persistentQuery' : 'runtimeEntity',
        initialQueryRtId: isPersistentQuery ? (kpiWidget.dataSource as PersistentQueryDataSource).queryRtId : undefined,
        initialQueryName: isPersistentQuery ? (kpiWidget.dataSource as PersistentQueryDataSource).queryName : undefined,
        initialQueryMode: kpiWidget.queryMode,
        initialQueryValueField: kpiWidget.queryValueField,
        initialQueryCategoryField: kpiWidget.queryCategoryField,
        initialQueryCategoryValue: kpiWidget.queryCategoryValue,
        // Display options
        initialPrefix: kpiWidget.prefix,
        initialSuffix: kpiWidget.suffix,
        initialTrend: kpiWidget.trend,
        // Filters
        initialFilters: kpiWidget.filters
      };
    },
    applyConfigResult: (widget, result) => {
      // Convert filters from DTO to widget format
      const filters: WidgetFilterConfig[] | undefined = result.filters?.map(f => ({
        attributePath: f.attributePath,
        operator: String(f.operator),
        comparisonValue: f.comparisonValue
      }));

      if (result.dataSourceType === 'persistentQuery' && result.queryRtId) {
        // Create PersistentQueryDataSource
        const dataSource: PersistentQueryDataSource = {
          type: 'persistentQuery',
          queryRtId: result.queryRtId,
          queryName: result.queryName
        };

        return {
          ...widget,
          dataSource,
          valueAttribute: '', // Not used for persistent queries
          queryMode: result.queryMode,
          queryValueField: result.queryValueField,
          queryCategoryField: result.queryCategoryField,
          queryCategoryValue: result.queryCategoryValue,
          prefix: result.prefix,
          suffix: result.suffix,
          trend: result.trend,
          filters
        };
      } else {
        // Create RuntimeEntityDataSource (default behavior)
        return {
          ...widget,
          dataSource: createDataSource(result, false),
          valueAttribute: result.valueAttribute,
          labelAttribute: result.labelAttribute,
          queryMode: undefined,
          queryValueField: undefined,
          queryCategoryField: undefined,
          queryCategoryValue: undefined,
          prefix: result.prefix,
          suffix: result.suffix,
          trend: result.trend,
          filters
        };
      }
    },

    // SOLID: Factory function
    createDefaultConfig: (base: BaseWidgetConfig): KpiWidgetConfig => ({
      ...base,
      type: 'kpi',
      colSpan: 1,
      dataSource: createDefaultRuntimeDataSource(),
      valueAttribute: '_count',
      icon: 'chart'
    }),

    // SOLID: Serialization for persistence
    toPersistedConfig: (widget: KpiWidgetConfig): WidgetPersistenceData => {
      const isPersistentQuery = widget.dataSource.type === 'persistentQuery';
      return {
        dataSourceType: isPersistentQuery ? 'persistentQuery' : 'runtimeEntity',
        dataSourceCkTypeId: widget.dataSource.type === 'runtimeEntity' ? widget.dataSource.ckTypeId : undefined,
        dataSourceRtId: isPersistentQuery
          ? (widget.dataSource as PersistentQueryDataSource).queryRtId
          : (widget.dataSource.type === 'runtimeEntity' ? widget.dataSource.rtId : undefined),
        config: {
          valueAttribute: widget.valueAttribute,
          labelAttribute: widget.labelAttribute,
          prefix: widget.prefix,
          suffix: widget.suffix,
          icon: widget.icon,
          trend: widget.trend,
          queryMode: widget.queryMode,
          queryValueField: widget.queryValueField,
          queryCategoryField: widget.queryCategoryField,
          queryCategoryValue: widget.queryCategoryValue,
          filters: widget.filters,
          ...(isPersistentQuery && {
            queryName: (widget.dataSource as PersistentQueryDataSource).queryName,
            queryRtId: (widget.dataSource as PersistentQueryDataSource).queryRtId
          })
        }
      };
    },

    // SOLID: Deserialization from persistence
    fromPersistedConfig: (data: PersistedWidgetData, base: BaseWidgetConfig): KpiWidgetConfig => {
      const config = parseConfig(data);
      const dataSource = buildDataSourceFromPersisted(data, config);

      if (dataSource.type === 'persistentQuery') {
        return {
          ...base,
          rtId: data.rtId,
          type: 'kpi',
          dataSource,
          valueAttribute: (config['valueAttribute'] as string) ?? '',
          queryMode: config['queryMode'] as KpiWidgetConfig['queryMode'],
          queryValueField: config['queryValueField'] as string | undefined,
          queryCategoryField: config['queryCategoryField'] as string | undefined,
          queryCategoryValue: config['queryCategoryValue'] as string | undefined,
          prefix: config['prefix'] as string | undefined,
          suffix: config['suffix'] as string | undefined,
          icon: config['icon'] as string | undefined,
          trend: config['trend'] as KpiWidgetConfig['trend'],
          filters: config['filters'] as WidgetFilterConfig[] | undefined
        };
      }

      return {
        ...base,
        rtId: data.rtId,
        type: 'kpi',
        dataSource: dataSource as RuntimeEntityDataSource,
        valueAttribute: (config['valueAttribute'] as string) ?? '_count',
        labelAttribute: config['labelAttribute'] as string | undefined,
        prefix: config['prefix'] as string | undefined,
        suffix: config['suffix'] as string | undefined,
        icon: config['icon'] as string | undefined,
        trend: config['trend'] as KpiWidgetConfig['trend'],
        filters: config['filters'] as WidgetFilterConfig[] | undefined
      };
    }
  });

  // Entity with Associations Widget
  registry.registerWidget<EntityWithAssociationsWidgetConfig, AssociationsConfigResult>({
    type: 'entityWithAssociations',
    label: 'Entity with Associations',
    component: EntityAssociationsWidgetComponent,
    configDialogComponent: AssociationsConfigDialogComponent,
    configDialogSize: { width: 650, height: 550, minWidth: 550, minHeight: 400 },
    configDialogTitle: 'Associations Configuration',
    defaultSize: { colSpan: 2, rowSpan: 1 },
    supportedDataSources: ['runtimeEntity'],
    getInitialConfig: (widget) => {
      const assocWidget = widget as EntityWithAssociationsWidgetConfig;
      return {
        initialCkTypeId: getDataSourceInfo(widget).ckTypeId,
        initialRtId: getDataSourceInfo(widget).rtId,
        initialShowIncoming: assocWidget.showIncoming,
        initialShowOutgoing: assocWidget.showOutgoing,
        initialRoleFilter: assocWidget.roleFilter,
        initialDisplayMode: assocWidget.displayMode
      };
    },
    applyConfigResult: (widget, result) => ({
      ...widget,
      dataSource: createDataSource(result, true),
      showIncoming: result.showIncoming,
      showOutgoing: result.showOutgoing,
      roleFilter: result.roleFilter,
      displayMode: result.displayMode
    }),

    // SOLID: Factory function
    createDefaultConfig: (base: BaseWidgetConfig): EntityWithAssociationsWidgetConfig => ({
      ...base,
      type: 'entityWithAssociations',
      dataSource: createDefaultRuntimeDataSource(),
      showIncoming: true,
      showOutgoing: true,
      maxAssociations: 5,
      roleFilter: [],
      displayMode: 'expandable'
    }),

    // SOLID: Serialization for persistence
    toPersistedConfig: (widget: EntityWithAssociationsWidgetConfig): WidgetPersistenceData => ({
      dataSourceType: 'runtimeEntity',
      dataSourceCkTypeId: widget.dataSource.type === 'runtimeEntity' ? widget.dataSource.ckTypeId : undefined,
      dataSourceRtId: widget.dataSource.type === 'runtimeEntity' ? widget.dataSource.rtId : undefined,
      config: {
        showIncoming: widget.showIncoming,
        showOutgoing: widget.showOutgoing,
        maxAssociations: widget.maxAssociations,
        roleFilter: widget.roleFilter,
        displayMode: widget.displayMode
      }
    }),

    // SOLID: Deserialization from persistence
    fromPersistedConfig: (data: PersistedWidgetData, base: BaseWidgetConfig): EntityWithAssociationsWidgetConfig => {
      const config = parseConfig(data);
      return {
        ...base,
        rtId: data.rtId,
        type: 'entityWithAssociations',
        dataSource: {
          type: 'runtimeEntity',
          ckTypeId: data.dataSourceCkTypeId ?? undefined,
          rtId: data.dataSourceRtId ?? undefined
        },
        showIncoming: (config['showIncoming'] as boolean) ?? true,
        showOutgoing: (config['showOutgoing'] as boolean) ?? true,
        maxAssociations: (config['maxAssociations'] as number) ?? 5,
        roleFilter: config['roleFilter'] as string[] | undefined,
        displayMode: config['displayMode'] as EntityWithAssociationsWidgetConfig['displayMode']
      };
    }
  });

  // Table Widget
  registry.registerWidget<TableWidgetConfig, TableConfigResult>({
    type: 'table',
    label: 'Table',
    component: TableWidgetComponent,
    configDialogComponent: TableConfigDialogComponent,
    configDialogSize: { width: 700, height: 600, minWidth: 550, minHeight: 450 },
    configDialogTitle: 'Table Configuration',
    defaultSize: { colSpan: 4, rowSpan: 1 },
    supportedDataSources: ['runtimeEntity', 'persistentQuery'],
    getInitialConfig: (widget) => {
      const tableWidget = widget as TableWidgetConfig;
      const dataSource = tableWidget.dataSource;

      // Determine data source type
      const isPersistentQuery = dataSource.type === 'persistentQuery';

      return {
        initialDataSourceType: isPersistentQuery ? 'persistentQuery' : 'runtimeEntity',
        initialCkTypeId: dataSource.type === 'runtimeEntity' ? dataSource.ckTypeId : undefined,
        initialColumns: tableWidget.columns,
        initialSorting: tableWidget.sorting,
        initialFilters: tableWidget.filters,
        initialPageSize: tableWidget.pageSize,
        initialSortable: tableWidget.sortable,
        initialQueryRtId: isPersistentQuery ? (dataSource as PersistentQueryDataSource).queryRtId : undefined,
        initialQueryName: isPersistentQuery ? (dataSource as PersistentQueryDataSource).queryName : undefined
      };
    },
    applyConfigResult: (widget, result) => {
      if (result.dataSourceType === 'persistentQuery' && result.queryRtId) {
        // Create PersistentQueryDataSource
        const dataSource: PersistentQueryDataSource = {
          type: 'persistentQuery',
          queryRtId: result.queryRtId,
          queryName: result.queryName
        };

        // Convert filters from DTO to widget format
        const filters = result.filters?.map(f => ({
          attributePath: f.attributePath,
          operator: String(f.operator),
          comparisonValue: f.comparisonValue
        }));

        return {
          ...widget,
          dataSource,
          columns: [], // Will be derived from query at runtime
          sorting: [],
          filters,
          pageSize: result.pageSize,
          sortable: result.sortable
        };
      } else {
        // Create RuntimeEntityDataSource (default behavior)
        // Convert sorting to our model format (simple JSON-compatible types)
        const sorting = result.sorting.map(s => ({
          attributePath: s.attributePath,
          sortOrder: String(s.sortOrder)
        }));

        // Convert filters to our model format (simple JSON-compatible types)
        const filters = result.filters.map(f => ({
          attributePath: f.attributePath,
          operator: String(f.operator),
          comparisonValue: f.comparisonValue
        }));

        return {
          ...widget,
          dataSource: createDataSource(result, false),
          columns: result.columns,
          sorting,
          filters,
          pageSize: result.pageSize,
          sortable: result.sortable
        };
      }
    },

    // SOLID: Factory function
    createDefaultConfig: (base: BaseWidgetConfig): TableWidgetConfig => ({
      ...base,
      type: 'table',
      colSpan: 4,
      dataSource: createDefaultRuntimeDataSource(),
      columns: [],
      sortable: true
    }),

    // SOLID: Serialization for persistence
    toPersistedConfig: (widget: TableWidgetConfig): WidgetPersistenceData => {
      const isPersistentQuery = widget.dataSource.type === 'persistentQuery';
      return {
        dataSourceType: isPersistentQuery ? 'persistentQuery' : 'runtimeEntity',
        dataSourceCkTypeId: widget.dataSource.type === 'runtimeEntity' ? widget.dataSource.ckTypeId : undefined,
        dataSourceRtId: isPersistentQuery
          ? (widget.dataSource as PersistentQueryDataSource).queryRtId
          : (widget.dataSource.type === 'runtimeEntity' ? widget.dataSource.rtId : undefined),
        config: {
          columns: widget.columns,
          sorting: widget.sorting,
          filters: widget.filters,
          pageSize: widget.pageSize,
          sortable: widget.sortable,
          ...(isPersistentQuery && {
            queryName: (widget.dataSource as PersistentQueryDataSource).queryName,
            queryRtId: (widget.dataSource as PersistentQueryDataSource).queryRtId
          })
        }
      };
    },

    // SOLID: Deserialization from persistence
    fromPersistedConfig: (data: PersistedWidgetData, base: BaseWidgetConfig): TableWidgetConfig => {
      const config = parseConfig(data);
      const dataSource = buildDataSourceFromPersisted(data, config);

      return {
        ...base,
        rtId: data.rtId,
        type: 'table',
        dataSource,
        columns: (config['columns'] as TableWidgetConfig['columns']) ?? [],
        sorting: config['sorting'] as TableWidgetConfig['sorting'],
        filters: config['filters'] as TableWidgetConfig['filters'],
        pageSize: config['pageSize'] as number | undefined,
        sortable: (config['sortable'] as boolean) ?? true
      };
    }
  });

  // Gauge Widget
  registry.registerWidget<GaugeWidgetConfig, GaugeConfigResult>({
    type: 'gauge',
    label: 'Gauge',
    component: GaugeWidgetComponent,
    configDialogComponent: GaugeConfigDialogComponent,
    configDialogSize: { width: 650, height: 600, minWidth: 500, minHeight: 450 },
    configDialogTitle: 'Gauge Configuration',
    defaultSize: { colSpan: 1, rowSpan: 1 },
    supportedDataSources: ['runtimeEntity', 'persistentQuery'],
    getInitialConfig: (widget) => {
      const gaugeWidget = widget as GaugeWidgetConfig;
      const isPersistentQuery = gaugeWidget.dataSource.type === 'persistentQuery';

      return {
        // Runtime entity fields
        initialCkTypeId: getDataSourceInfo(widget).ckTypeId,
        initialRtId: getDataSourceInfo(widget).rtId,
        initialValueAttribute: gaugeWidget.valueAttribute,
        initialLabelAttribute: gaugeWidget.labelAttribute,
        // Persistent query fields
        initialDataSourceType: isPersistentQuery ? 'persistentQuery' : 'runtimeEntity',
        initialQueryRtId: isPersistentQuery ? (gaugeWidget.dataSource as PersistentQueryDataSource).queryRtId : undefined,
        initialQueryName: isPersistentQuery ? (gaugeWidget.dataSource as PersistentQueryDataSource).queryName : undefined,
        initialQueryMode: gaugeWidget.queryMode,
        initialQueryValueField: gaugeWidget.queryValueField,
        initialQueryCategoryField: gaugeWidget.queryCategoryField,
        initialQueryCategoryValue: gaugeWidget.queryCategoryValue,
        // Gauge options
        initialGaugeType: gaugeWidget.gaugeType,
        initialMin: gaugeWidget.min,
        initialMax: gaugeWidget.max,
        initialRanges: gaugeWidget.ranges,
        initialShowLabel: gaugeWidget.showLabel,
        initialPrefix: gaugeWidget.prefix,
        initialSuffix: gaugeWidget.suffix,
        initialReverse: gaugeWidget.reverse,
        // Filters
        initialFilters: gaugeWidget.filters
      };
    },
    applyConfigResult: (widget, result) => {
      // Convert filters from DTO to widget format
      const filters: WidgetFilterConfig[] | undefined = result.filters?.map(f => ({
        attributePath: f.attributePath,
        operator: String(f.operator),
        comparisonValue: f.comparisonValue
      }));

      if (result.dataSourceType === 'persistentQuery' && result.queryRtId) {
        // Create PersistentQueryDataSource
        const dataSource: PersistentQueryDataSource = {
          type: 'persistentQuery',
          queryRtId: result.queryRtId,
          queryName: result.queryName
        };

        return {
          ...widget,
          dataSource,
          valueAttribute: '', // Not used for persistent queries
          queryMode: result.queryMode,
          queryValueField: result.queryValueField,
          queryCategoryField: result.queryCategoryField,
          queryCategoryValue: result.queryCategoryValue,
          gaugeType: result.gaugeType,
          min: result.min,
          max: result.max,
          ranges: result.ranges,
          showLabel: result.showLabel,
          prefix: result.prefix,
          suffix: result.suffix,
          reverse: result.reverse,
          filters
        };
      } else {
        // Create RuntimeEntityDataSource (default behavior)
        return {
          ...widget,
          dataSource: createDataSource(result, false),
          gaugeType: result.gaugeType,
          valueAttribute: result.valueAttribute,
          labelAttribute: result.labelAttribute,
          queryMode: undefined,
          queryValueField: undefined,
          queryCategoryField: undefined,
          queryCategoryValue: undefined,
          min: result.min,
          max: result.max,
          ranges: result.ranges,
          showLabel: result.showLabel,
          prefix: result.prefix,
          suffix: result.suffix,
          reverse: result.reverse,
          filters
        };
      }
    },

    // SOLID: Factory function
    createDefaultConfig: (base: BaseWidgetConfig): GaugeWidgetConfig => ({
      ...base,
      type: 'gauge',
      dataSource: createDefaultRuntimeDataSource(),
      gaugeType: 'arc',
      valueAttribute: '',
      min: 0,
      max: 100,
      showLabel: true
    }),

    // SOLID: Serialization for persistence
    toPersistedConfig: (widget: GaugeWidgetConfig): WidgetPersistenceData => {
      const isPersistentQuery = widget.dataSource.type === 'persistentQuery';
      return {
        dataSourceType: isPersistentQuery ? 'persistentQuery' : 'runtimeEntity',
        dataSourceCkTypeId: widget.dataSource.type === 'runtimeEntity' ? widget.dataSource.ckTypeId : undefined,
        dataSourceRtId: isPersistentQuery
          ? (widget.dataSource as PersistentQueryDataSource).queryRtId
          : (widget.dataSource.type === 'runtimeEntity' ? widget.dataSource.rtId : undefined),
        config: {
          gaugeType: widget.gaugeType,
          valueAttribute: widget.valueAttribute,
          labelAttribute: widget.labelAttribute,
          min: widget.min,
          max: widget.max,
          ranges: widget.ranges,
          showLabel: widget.showLabel,
          prefix: widget.prefix,
          suffix: widget.suffix,
          reverse: widget.reverse,
          queryMode: widget.queryMode,
          queryValueField: widget.queryValueField,
          queryCategoryField: widget.queryCategoryField,
          queryCategoryValue: widget.queryCategoryValue,
          filters: widget.filters,
          ...(isPersistentQuery && {
            queryName: (widget.dataSource as PersistentQueryDataSource).queryName,
            queryRtId: (widget.dataSource as PersistentQueryDataSource).queryRtId
          })
        }
      };
    },

    // SOLID: Deserialization from persistence
    fromPersistedConfig: (data: PersistedWidgetData, base: BaseWidgetConfig): GaugeWidgetConfig => {
      const config = parseConfig(data);
      const dataSource = buildDataSourceFromPersisted(data, config);

      if (dataSource.type === 'persistentQuery') {
        return {
          ...base,
          rtId: data.rtId,
          type: 'gauge',
          dataSource,
          gaugeType: (config['gaugeType'] as GaugeWidgetConfig['gaugeType']) ?? 'arc',
          valueAttribute: (config['valueAttribute'] as string) ?? '',
          queryMode: config['queryMode'] as GaugeWidgetConfig['queryMode'],
          queryValueField: config['queryValueField'] as string | undefined,
          queryCategoryField: config['queryCategoryField'] as string | undefined,
          queryCategoryValue: config['queryCategoryValue'] as string | undefined,
          min: (config['min'] as number) ?? 0,
          max: (config['max'] as number) ?? 100,
          ranges: config['ranges'] as GaugeWidgetConfig['ranges'],
          showLabel: (config['showLabel'] as boolean) ?? true,
          prefix: config['prefix'] as string | undefined,
          suffix: config['suffix'] as string | undefined,
          reverse: config['reverse'] as boolean | undefined,
          filters: config['filters'] as WidgetFilterConfig[] | undefined
        };
      }

      return {
        ...base,
        rtId: data.rtId,
        type: 'gauge',
        dataSource: dataSource as RuntimeEntityDataSource,
        gaugeType: (config['gaugeType'] as GaugeWidgetConfig['gaugeType']) ?? 'arc',
        valueAttribute: (config['valueAttribute'] as string) ?? '',
        labelAttribute: config['labelAttribute'] as string | undefined,
        min: (config['min'] as number) ?? 0,
        max: (config['max'] as number) ?? 100,
        ranges: config['ranges'] as GaugeWidgetConfig['ranges'],
        showLabel: (config['showLabel'] as boolean) ?? true,
        prefix: config['prefix'] as string | undefined,
        suffix: config['suffix'] as string | undefined,
        reverse: config['reverse'] as boolean | undefined,
        filters: config['filters'] as WidgetFilterConfig[] | undefined
      };
    }
  });

  // Pie Chart Widget
  registry.registerWidget<PieChartWidgetConfig, PieChartConfigResult>({
    type: 'pieChart',
    label: 'Pie Chart',
    component: PieChartWidgetComponent,
    configDialogComponent: PieChartConfigDialogComponent,
    configDialogSize: { width: 600, height: 550, minWidth: 500, minHeight: 400 },
    configDialogTitle: 'Pie Chart Configuration',
    defaultSize: { colSpan: 2, rowSpan: 2 },
    supportedDataSources: ['persistentQuery', 'constructionKitQuery'],
    getInitialConfig: (widget) => {
      const pieWidget = widget as PieChartWidgetConfig;
      const dataSource = pieWidget.dataSource;
      const isPersistentQuery = dataSource.type === 'persistentQuery';
      const isCkQuery = dataSource.type === 'constructionKitQuery';

      return {
        initialDataSourceType: dataSource.type,
        initialQueryRtId: isPersistentQuery ? (dataSource as PersistentQueryDataSource).queryRtId : undefined,
        initialQueryName: isPersistentQuery ? (dataSource as PersistentQueryDataSource).queryName : undefined,
        initialCkQueryTarget: isCkQuery ? (dataSource as ConstructionKitQueryDataSource).queryTarget : undefined,
        initialCkGroupBy: isCkQuery ? (dataSource as ConstructionKitQueryDataSource).groupBy : undefined,
        initialChartType: pieWidget.chartType,
        initialCategoryField: pieWidget.categoryField,
        initialValueField: pieWidget.valueField,
        initialShowLabels: pieWidget.showLabels,
        initialShowLegend: pieWidget.showLegend,
        initialLegendPosition: pieWidget.legendPosition,
        initialFilters: pieWidget.filters
      };
    },
    applyConfigResult: (widget, result) => {
      let dataSource: DataSource;

      // Convert filters from DTO to widget format
      const filters: WidgetFilterConfig[] | undefined = result.filters?.map(f => ({
        attributePath: f.attributePath,
        operator: String(f.operator),
        comparisonValue: f.comparisonValue
      }));

      if (result.dataSourceType === 'constructionKitQuery') {
        dataSource = {
          type: 'constructionKitQuery',
          queryTarget: result.ckQueryTarget ?? 'models',
          groupBy: result.ckGroupBy,
          categoryField: result.categoryField,
          valueField: result.valueField
        } as ConstructionKitQueryDataSource;
      } else {
        dataSource = {
          type: 'persistentQuery',
          queryRtId: result.queryRtId ?? '',
          queryName: result.queryName
        } as PersistentQueryDataSource;
      }

      return {
        ...widget,
        dataSource,
        chartType: result.chartType,
        categoryField: result.categoryField,
        valueField: result.valueField,
        showLabels: result.showLabels,
        showLegend: result.showLegend,
        legendPosition: result.legendPosition,
        filters
      };
    },

    // SOLID: Factory function
    createDefaultConfig: (base: BaseWidgetConfig): PieChartWidgetConfig => ({
      ...base,
      type: 'pieChart',
      colSpan: 2,
      rowSpan: 2,
      dataSource: createDefaultPersistentQueryDataSource(),
      chartType: 'pie',
      categoryField: '',
      valueField: '',
      showLabels: true,
      showLegend: true,
      legendPosition: 'right'
    }),

    // SOLID: Serialization for persistence
    toPersistedConfig: (widget: PieChartWidgetConfig): WidgetPersistenceData => {
      const dataSource = widget.dataSource;

      if (dataSource.type === 'constructionKitQuery') {
        const ckDataSource = dataSource as ConstructionKitQueryDataSource;
        return {
          dataSourceType: 'constructionKitQuery',
          config: {
            chartType: widget.chartType,
            categoryField: widget.categoryField,
            valueField: widget.valueField,
            showLabels: widget.showLabels,
            showLegend: widget.showLegend,
            legendPosition: widget.legendPosition,
            ckQueryTarget: ckDataSource.queryTarget,
            ckGroupBy: ckDataSource.groupBy,
            filters: widget.filters
          }
        };
      }

      // Default: persistentQuery
      return {
        dataSourceType: 'persistentQuery',
        dataSourceRtId: (dataSource as PersistentQueryDataSource).queryRtId,
        config: {
          chartType: widget.chartType,
          categoryField: widget.categoryField,
          valueField: widget.valueField,
          showLabels: widget.showLabels,
          showLegend: widget.showLegend,
          legendPosition: widget.legendPosition,
          queryName: (dataSource as PersistentQueryDataSource).queryName,
          queryRtId: (dataSource as PersistentQueryDataSource).queryRtId,
          filters: widget.filters
        }
      };
    },

    // SOLID: Deserialization from persistence
    fromPersistedConfig: (data: PersistedWidgetData, base: BaseWidgetConfig): PieChartWidgetConfig => {
      const config = parseConfig(data);

      // Handle constructionKitQuery data source
      if (data.dataSourceType === 'constructionKitQuery') {
        return {
          ...base,
          rtId: data.rtId,
          type: 'pieChart',
          dataSource: {
            type: 'constructionKitQuery',
            queryTarget: (config['ckQueryTarget'] as ConstructionKitQueryDataSource['queryTarget']) ?? 'models',
            groupBy: config['ckGroupBy'] as string | undefined
          },
          chartType: (config['chartType'] as PieChartWidgetConfig['chartType']) ?? 'pie',
          categoryField: (config['categoryField'] as string) ?? '',
          valueField: (config['valueField'] as string) ?? '',
          showLabels: (config['showLabels'] as boolean) ?? true,
          showLegend: (config['showLegend'] as boolean) ?? true,
          legendPosition: (config['legendPosition'] as PieChartWidgetConfig['legendPosition']) ?? 'right',
          filters: config['filters'] as WidgetFilterConfig[] | undefined
        };
      }

      // Default: persistentQuery
      const dataSource = buildDataSourceFromPersisted(data, config) as PersistentQueryDataSource;

      return {
        ...base,
        rtId: data.rtId,
        type: 'pieChart',
        dataSource,
        chartType: (config['chartType'] as PieChartWidgetConfig['chartType']) ?? 'pie',
        categoryField: (config['categoryField'] as string) ?? '',
        valueField: (config['valueField'] as string) ?? '',
        showLabels: (config['showLabels'] as boolean) ?? true,
        showLegend: (config['showLegend'] as boolean) ?? true,
        legendPosition: (config['legendPosition'] as PieChartWidgetConfig['legendPosition']) ?? 'right',
        filters: config['filters'] as WidgetFilterConfig[] | undefined
      };
    }
  });

  // Bar Chart Widget
  registry.registerWidget<BarChartWidgetConfig, BarChartConfigResult>({
    type: 'barChart',
    label: 'Bar Chart',
    component: BarChartWidgetComponent,
    configDialogComponent: BarChartConfigDialogComponent,
    configDialogSize: { width: 650, height: 550, minWidth: 500, minHeight: 400 },
    configDialogTitle: 'Bar Chart Configuration',
    defaultSize: { colSpan: 2, rowSpan: 2 },
    supportedDataSources: ['persistentQuery'],
    getInitialConfig: (widget) => {
      const barWidget = widget as BarChartWidgetConfig;
      const dataSource = barWidget.dataSource;
      const isPersistentQuery = dataSource.type === 'persistentQuery';

      return {
        initialQueryRtId: isPersistentQuery ? (dataSource as PersistentQueryDataSource).queryRtId : undefined,
        initialQueryName: isPersistentQuery ? (dataSource as PersistentQueryDataSource).queryName : undefined,
        initialChartType: barWidget.chartType,
        initialCategoryField: barWidget.categoryField,
        initialSeries: barWidget.series,
        initialSeriesGroupField: barWidget.seriesGroupField,
        initialValueField: barWidget.valueField,
        initialShowLegend: barWidget.showLegend,
        initialLegendPosition: barWidget.legendPosition,
        initialShowDataLabels: barWidget.showDataLabels,
        initialFilters: barWidget.filters
      };
    },
    applyConfigResult: (widget, result) => {
      const dataSource: PersistentQueryDataSource = {
        type: 'persistentQuery',
        queryRtId: result.queryRtId,
        queryName: result.queryName
      };

      // Convert filters from DTO to widget format
      const filters: WidgetFilterConfig[] | undefined = result.filters?.map(f => ({
        attributePath: f.attributePath,
        operator: String(f.operator),
        comparisonValue: f.comparisonValue
      }));

      return {
        ...widget,
        dataSource,
        chartType: result.chartType,
        categoryField: result.categoryField,
        series: result.series,
        seriesGroupField: result.seriesGroupField,
        valueField: result.valueField,
        showLegend: result.showLegend,
        legendPosition: result.legendPosition,
        showDataLabels: result.showDataLabels,
        filters
      } as BarChartWidgetConfig;
    },

    // SOLID: Factory function
    createDefaultConfig: (base: BaseWidgetConfig): BarChartWidgetConfig => ({
      ...base,
      type: 'barChart',
      colSpan: 2,
      rowSpan: 2,
      dataSource: createDefaultPersistentQueryDataSource(),
      chartType: 'column',
      categoryField: '',
      series: [],
      showLegend: true,
      legendPosition: 'right',
      showDataLabels: false
    }),

    // SOLID: Serialization for persistence
    toPersistedConfig: (widget: BarChartWidgetConfig): WidgetPersistenceData => ({
      dataSourceType: 'persistentQuery',
      dataSourceRtId: (widget.dataSource as PersistentQueryDataSource).queryRtId,
      config: {
        chartType: widget.chartType,
        categoryField: widget.categoryField,
        series: widget.series,
        seriesGroupField: widget.seriesGroupField,
        valueField: widget.valueField,
        showLegend: widget.showLegend,
        legendPosition: widget.legendPosition,
        showDataLabels: widget.showDataLabels,
        queryName: (widget.dataSource as PersistentQueryDataSource).queryName,
        queryRtId: (widget.dataSource as PersistentQueryDataSource).queryRtId,
        filters: widget.filters
      }
    }),

    // SOLID: Deserialization from persistence
    fromPersistedConfig: (data: PersistedWidgetData, base: BaseWidgetConfig): BarChartWidgetConfig => {
      const config = parseConfig(data);
      const dataSource = buildDataSourceFromPersisted(data, config) as PersistentQueryDataSource;

      return {
        ...base,
        rtId: data.rtId,
        type: 'barChart',
        dataSource,
        chartType: (config['chartType'] as BarChartWidgetConfig['chartType']) ?? 'column',
        categoryField: (config['categoryField'] as string) ?? '',
        series: (config['series'] as BarChartWidgetConfig['series']) ?? [],
        seriesGroupField: config['seriesGroupField'] as string | undefined,
        valueField: config['valueField'] as string | undefined,
        showLegend: (config['showLegend'] as boolean) ?? true,
        legendPosition: (config['legendPosition'] as BarChartWidgetConfig['legendPosition']) ?? 'right',
        showDataLabels: (config['showDataLabels'] as boolean) ?? false,
        filters: config['filters'] as WidgetFilterConfig[] | undefined
      };
    }
  });

  // Stats Grid Widget
  registry.registerWidget<StatsGridWidgetConfig, StatsGridConfigResult>({
    type: 'statsGrid',
    label: 'Stats Grid',
    component: StatsGridWidgetComponent,
    configDialogComponent: StatsGridConfigDialogComponent,
    configDialogSize: { width: 700, height: 600, minWidth: 600, minHeight: 450 },
    configDialogTitle: 'Stats Grid Configuration',
    defaultSize: { colSpan: 3, rowSpan: 1 },
    supportedDataSources: ['aggregation'],
    getInitialConfig: (widget) => {
      const statsWidget = widget as StatsGridWidgetConfig;
      const dataSource = statsWidget.dataSource as AggregationDataSource;
      return {
        initialStats: statsWidget.stats,
        initialQueries: dataSource?.queries ?? [],
        initialColumns: statsWidget.columns
      };
    },
    applyConfigResult: (widget, result) => ({
      ...widget,
      stats: result.stats,
      columns: result.columns,
      dataSource: {
        type: 'aggregation',
        queries: result.queries
      }
    }),

    // SOLID: Factory function
    createDefaultConfig: (base: BaseWidgetConfig): StatsGridWidgetConfig => ({
      ...base,
      type: 'statsGrid',
      colSpan: 3,
      dataSource: {
        type: 'aggregation',
        queries: []
      },
      stats: [],
      columns: 3
    }),

    // SOLID: Serialization for persistence
    toPersistedConfig: (widget: StatsGridWidgetConfig): WidgetPersistenceData => ({
      dataSourceType: 'aggregation',
      config: {
        stats: widget.stats,
        columns: widget.columns,
        queries: widget.dataSource.type === 'aggregation'
          ? (widget.dataSource as AggregationDataSource).queries
          : []
      }
    }),

    // SOLID: Deserialization from persistence
    fromPersistedConfig: (data: PersistedWidgetData, base: BaseWidgetConfig): StatsGridWidgetConfig => {
      const config = parseConfig(data);
      return {
        ...base,
        rtId: data.rtId,
        type: 'statsGrid',
        dataSource: {
          type: 'aggregation',
          queries: (config['queries'] as AggregationDataSource['queries']) ?? []
        },
        stats: (config['stats'] as StatsGridWidgetConfig['stats']) ?? [],
        columns: (config['columns'] as number) ?? 3
      };
    }
  });

  // Status Indicator Widget
  registry.registerWidget<StatusIndicatorWidgetConfig, StatusIndicatorConfigResult>({
    type: 'statusIndicator',
    label: 'Status Indicator',
    component: StatusIndicatorWidgetComponent,
    configDialogComponent: StatusIndicatorConfigDialogComponent,
    configDialogSize: { width: 500, height: 500, minWidth: 450, minHeight: 400 },
    configDialogTitle: 'Status Indicator Configuration',
    defaultSize: { colSpan: 1, rowSpan: 1 },
    supportedDataSources: ['serviceCall'],
    getInitialConfig: (widget) => {
      const statusWidget = widget as StatusIndicatorWidgetConfig;
      const dataSource = statusWidget.dataSource as ServiceCallDataSource;
      return {
        initialCallType: dataSource?.callType,
        initialModelName: dataSource?.modelName,
        initialServiceType: dataSource?.serviceType,
        initialTrueLabel: statusWidget.trueLabel,
        initialFalseLabel: statusWidget.falseLabel,
        initialTrueColor: statusWidget.trueColor,
        initialFalseColor: statusWidget.falseColor
      };
    },
    applyConfigResult: (widget, result) => ({
      ...widget,
      dataSource: {
        type: 'serviceCall',
        callType: result.callType,
        modelName: result.modelName,
        serviceType: result.serviceType
      },
      trueLabel: result.trueLabel,
      falseLabel: result.falseLabel,
      trueColor: result.trueColor,
      falseColor: result.falseColor
    }),

    // SOLID: Factory function
    createDefaultConfig: (base: BaseWidgetConfig): StatusIndicatorWidgetConfig => ({
      ...base,
      type: 'statusIndicator',
      colSpan: 1,
      dataSource: {
        type: 'serviceCall',
        callType: 'modelAvailable'
      },
      trueLabel: 'ENABLED',
      falseLabel: 'DISABLED'
    }),

    // SOLID: Serialization for persistence
    toPersistedConfig: (widget: StatusIndicatorWidgetConfig): WidgetPersistenceData => {
      const dataSource = widget.dataSource as ServiceCallDataSource;
      return {
        dataSourceType: 'serviceCall',
        config: {
          callType: dataSource.callType,
          modelName: dataSource.modelName,
          serviceType: dataSource.serviceType,
          customEndpoint: dataSource.customEndpoint,
          trueLabel: widget.trueLabel,
          falseLabel: widget.falseLabel,
          trueColor: widget.trueColor,
          falseColor: widget.falseColor
        }
      };
    },

    // SOLID: Deserialization from persistence
    fromPersistedConfig: (data: PersistedWidgetData, base: BaseWidgetConfig): StatusIndicatorWidgetConfig => {
      const config = parseConfig(data);
      return {
        ...base,
        rtId: data.rtId,
        type: 'statusIndicator',
        dataSource: {
          type: 'serviceCall',
          callType: (config['callType'] as ServiceCallDataSource['callType']) ?? 'modelAvailable',
          modelName: config['modelName'] as string | undefined,
          serviceType: config['serviceType'] as ServiceCallDataSource['serviceType'],
          customEndpoint: config['customEndpoint'] as string | undefined
        },
        trueLabel: config['trueLabel'] as string | undefined,
        falseLabel: config['falseLabel'] as string | undefined,
        trueColor: config['trueColor'] as string | undefined,
        falseColor: config['falseColor'] as string | undefined
      };
    }
  });

  // Service Health Widget
  registry.registerWidget<ServiceHealthWidgetConfig, ServiceHealthConfigResult>({
    type: 'serviceHealth',
    label: 'Service Health',
    component: ServiceHealthWidgetComponent,
    configDialogComponent: ServiceHealthConfigDialogComponent,
    configDialogSize: { width: 500, height: 450, minWidth: 450, minHeight: 350 },
    configDialogTitle: 'Service Health Configuration',
    defaultSize: { colSpan: 2, rowSpan: 1 },
    supportedDataSources: ['serviceCall'],
    getInitialConfig: (widget) => {
      const healthWidget = widget as ServiceHealthWidgetConfig;
      const dataSource = healthWidget.dataSource as ServiceCallDataSource;
      return {
        initialServiceType: dataSource?.serviceType,
        initialCustomEndpoint: dataSource?.customEndpoint,
        initialShowPulse: healthWidget.showPulse,
        initialNavigateOnClick: healthWidget.navigateOnClick,
        initialDetailRoute: healthWidget.detailRoute
      };
    },
    applyConfigResult: (widget, result) => ({
      ...widget,
      dataSource: {
        type: 'serviceCall',
        callType: 'healthCheck',
        serviceType: result.serviceType,
        customEndpoint: result.customEndpoint
      },
      showPulse: result.showPulse,
      navigateOnClick: result.navigateOnClick,
      detailRoute: result.detailRoute
    }),

    // SOLID: Factory function
    createDefaultConfig: (base: BaseWidgetConfig): ServiceHealthWidgetConfig => ({
      ...base,
      type: 'serviceHealth',
      colSpan: 2,
      dataSource: {
        type: 'serviceCall',
        callType: 'healthCheck',
        serviceType: 'identity'
      },
      showPulse: true,
      navigateOnClick: false
    }),

    // SOLID: Serialization for persistence
    toPersistedConfig: (widget: ServiceHealthWidgetConfig): WidgetPersistenceData => {
      const dataSource = widget.dataSource as ServiceCallDataSource;
      return {
        dataSourceType: 'serviceCall',
        config: {
          callType: dataSource.callType,
          serviceType: dataSource.serviceType,
          customEndpoint: dataSource.customEndpoint,
          navigateOnClick: widget.navigateOnClick,
          detailRoute: widget.detailRoute,
          showPulse: widget.showPulse
        }
      };
    },

    // SOLID: Deserialization from persistence
    fromPersistedConfig: (data: PersistedWidgetData, base: BaseWidgetConfig): ServiceHealthWidgetConfig => {
      const config = parseConfig(data);
      return {
        ...base,
        rtId: data.rtId,
        type: 'serviceHealth',
        dataSource: {
          type: 'serviceCall',
          callType: 'healthCheck',
          serviceType: (config['serviceType'] as ServiceCallDataSource['serviceType']) ?? 'identity',
          customEndpoint: config['customEndpoint'] as string | undefined
        },
        navigateOnClick: config['navigateOnClick'] as boolean | undefined,
        detailRoute: config['detailRoute'] as string | undefined,
        showPulse: (config['showPulse'] as boolean) ?? true
      };
    }
  });

  // Widget Group Widget
  registry.registerWidget<WidgetGroupConfig, WidgetGroupConfigResult>({
    type: 'widgetGroup',
    label: 'Widget Group',
    component: WidgetGroupComponent,
    configDialogComponent: WidgetGroupConfigDialogComponent,
    configDialogSize: { width: 700, height: 600, minWidth: 550, minHeight: 450 },
    configDialogTitle: 'Widget Group Configuration',
    defaultSize: { colSpan: 4, rowSpan: 2 },
    supportedDataSources: ['repeaterQuery'],
    getInitialConfig: (widget) => {
      const groupWidget = widget as WidgetGroupConfig;
      const dataSource = groupWidget.dataSource;
      const hasQuery = dataSource.type === 'repeaterQuery' && dataSource.queryRtId;
      const hasCkType = dataSource.type === 'repeaterQuery' && dataSource.ckTypeId;

      return {
        initialDataSourceMode: hasQuery ? 'persistentQuery' : (hasCkType ? 'ckType' : 'persistentQuery'),
        initialQueryRtId: hasQuery ? dataSource.queryRtId : undefined,
        initialQueryName: hasQuery ? dataSource.queryName : undefined,
        initialCkTypeId: hasCkType ? dataSource.ckTypeId : undefined,
        initialFilters: hasCkType ? dataSource.filters : undefined,
        initialMaxItems: dataSource.type === 'repeaterQuery' ? dataSource.maxItems : undefined,
        initialChildTemplate: groupWidget.childTemplate,
        initialLayout: groupWidget.layout,
        initialGridColumns: groupWidget.gridColumns,
        initialMinChildWidth: groupWidget.minChildWidth,
        initialGap: groupWidget.gap,
        initialEmptyMessage: groupWidget.emptyMessage
      };
    },
    applyConfigResult: (widget, result) => {
      // Build the repeater data source
      const useCkType = result.dataSourceMode === 'ckType' && result.ckTypeId;
      const dataSource: RepeaterQueryDataSource = {
        type: 'repeaterQuery',
        queryRtId: result.dataSourceMode === 'persistentQuery' ? result.queryRtId : undefined,
        queryName: result.dataSourceMode === 'persistentQuery' ? result.queryName : undefined,
        ckTypeId: useCkType ? result.ckTypeId : undefined,
        filters: useCkType && result.filters ? result.filters.map(f => ({
          attributePath: f.attributePath,
          operator: String(f.operator),
          comparisonValue: f.comparisonValue
        })) : undefined,
        maxItems: result.maxItems
      };

      return {
        ...widget,
        dataSource,
        childTemplate: result.childTemplate,
        layout: result.layout,
        gridColumns: result.gridColumns,
        minChildWidth: result.minChildWidth,
        gap: result.gap,
        emptyMessage: result.emptyMessage
      };
    },

    // SOLID: Factory function
    createDefaultConfig: (base: BaseWidgetConfig): WidgetGroupConfig => ({
      ...base,
      type: 'widgetGroup',
      colSpan: 4,
      rowSpan: 2,
      dataSource: {
        type: 'repeaterQuery',
        maxItems: 20
      },
      childTemplate: {
        widgetType: 'kpi',
        titleTemplate: '$rtWellKnownName',
        attributeMappings: {
          valueAttribute: 'value'
        }
      },
      layout: 'grid',
      gridColumns: 4,
      gap: 8
    }),

    // SOLID: Serialization for persistence
    toPersistedConfig: (widget: WidgetGroupConfig): WidgetPersistenceData => {
      const dataSource = widget.dataSource as RepeaterQueryDataSource;
      const hasQuery = !!dataSource.queryRtId;

      return {
        dataSourceType: 'repeaterQuery',
        dataSourceRtId: hasQuery ? dataSource.queryRtId : undefined,
        dataSourceCkTypeId: !hasQuery ? dataSource.ckTypeId : undefined,
        config: {
          queryName: dataSource.queryName,
          maxItems: dataSource.maxItems,
          filters: dataSource.filters,
          childTemplate: widget.childTemplate,
          layout: widget.layout,
          gridColumns: widget.gridColumns,
          minChildWidth: widget.minChildWidth,
          gap: widget.gap,
          emptyMessage: widget.emptyMessage
        }
      };
    },

    // SOLID: Deserialization from persistence
    fromPersistedConfig: (data: PersistedWidgetData, base: BaseWidgetConfig): WidgetGroupConfig => {
      const config = parseConfig(data);
      const hasQuery = !!data.dataSourceRtId;

      const dataSource: RepeaterQueryDataSource = {
        type: 'repeaterQuery',
        queryRtId: hasQuery ? data.dataSourceRtId ?? undefined : undefined,
        queryName: hasQuery ? config['queryName'] as string | undefined : undefined,
        ckTypeId: !hasQuery ? data.dataSourceCkTypeId ?? undefined : undefined,
        filters: !hasQuery ? config['filters'] as WidgetFilterConfig[] | undefined : undefined,
        maxItems: config['maxItems'] as number | undefined
      };

      const childTemplate = config['childTemplate'] as WidgetGroupConfig['childTemplate'] ?? {
        widgetType: 'kpi',
        titleTemplate: '$rtWellKnownName',
        attributeMappings: { valueAttribute: 'value' }
      };

      return {
        ...base,
        rtId: data.rtId,
        type: 'widgetGroup',
        dataSource,
        childTemplate,
        layout: (config['layout'] as WidgetGroupConfig['layout']) ?? 'grid',
        gridColumns: config['gridColumns'] as number | undefined,
        minChildWidth: config['minChildWidth'] as number | undefined,
        gap: config['gap'] as number | undefined,
        emptyMessage: config['emptyMessage'] as string | undefined
      };
    }
  });

  // Markdown Widget
  registry.registerWidget<MarkdownWidgetConfig, MarkdownConfigResult>({
    type: 'markdown',
    label: 'Markdown',
    component: MarkdownWidgetComponent,
    configDialogComponent: MarkdownConfigDialogComponent,
    configDialogSize: { width: 800, height: 600, minWidth: 600, minHeight: 450 },
    configDialogTitle: 'Markdown Widget Configuration',
    defaultSize: { colSpan: 2, rowSpan: 2 },
    supportedDataSources: ['static'],
    getInitialConfig: (widget) => {
      const mdWidget = widget as MarkdownWidgetConfig;
      return {
        initialContent: mdWidget.content,
        initialResolveVariables: mdWidget.resolveVariables,
        initialPadding: mdWidget.padding,
        initialTextAlign: mdWidget.textAlign
      };
    },
    applyConfigResult: (widget, result) => ({
      ...widget,
      content: result.content,
      resolveVariables: result.resolveVariables,
      padding: result.padding,
      textAlign: result.textAlign,
      dataSource: { type: 'static', data: result.content }
    }),

    // SOLID: Factory function
    createDefaultConfig: (base: BaseWidgetConfig): MarkdownWidgetConfig => ({
      ...base,
      type: 'markdown',
      colSpan: 2,
      rowSpan: 2,
      dataSource: { type: 'static', data: null },
      content: '',
      resolveVariables: true
    }),

    // SOLID: Serialization for persistence
    toPersistedConfig: (widget: MarkdownWidgetConfig): WidgetPersistenceData => ({
      dataSourceType: 'static',
      config: {
        content: widget.content,
        resolveVariables: widget.resolveVariables,
        padding: widget.padding,
        textAlign: widget.textAlign
      }
    }),

    // SOLID: Deserialization from persistence
    fromPersistedConfig: (data: PersistedWidgetData, base: BaseWidgetConfig): MarkdownWidgetConfig => {
      const config = parseConfig(data);
      return {
        ...base,
        rtId: data.rtId,
        type: 'markdown',
        dataSource: { type: 'static', data: config['content'] ?? '' },
        content: (config['content'] as string) ?? '',
        resolveVariables: (config['resolveVariables'] as boolean) ?? true,
        padding: config['padding'] as string | undefined,
        textAlign: config['textAlign'] as MarkdownWidgetConfig['textAlign']
      };
    }
  });

  // Note: Process Widget registration moved to process-widget-registration.ts
  // Use provideProcessWidget() or registerProcessWidget() to enable it
}

/**
 * Provides the widget registry with all built-in widgets registered.
 * Add this to your app's providers array.
 *
 * Usage:
 * ```typescript
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideDefaultWidgets()
 *   ]
 * });
 * ```
 */
export function provideDefaultWidgets(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() => {
      const registry = inject(WidgetRegistryService);
      registerDefaultWidgets(registry);
    })
  ]);
}

// ========== Main Provider Functions ==========

import { InjectionToken } from '@angular/core';
import { WidgetRegistration } from '../services/widget-registry.service';

/**
 * Configuration options for MeshBoard
 */
export interface MeshBoardOptions {
  /** Whether to include default widgets (default: true) */
  includeDefaultWidgets?: boolean;
  /** Default grid columns (default: 6) */
  defaultColumns?: number;
  /** Default row height in pixels (default: 200) */
  defaultRowHeight?: number;
  /** Default gap between widgets in pixels (default: 16) */
  defaultGap?: number;
}

/**
 * Injection token for MeshBoard options
 */
export const MESHBOARD_OPTIONS = new InjectionToken<MeshBoardOptions>('MESHBOARD_OPTIONS');

// Re-export from octo-services for convenience
export { TENANT_ID_PROVIDER } from '@meshmakers/octo-services';
export type { TenantIdProvider } from '@meshmakers/octo-services';

// Import for alias
import { TENANT_ID_PROVIDER } from '@meshmakers/octo-services';

/**
 * @deprecated Use TENANT_ID_PROVIDER from @meshmakers/octo-services instead
 */
export const MESHBOARD_TENANT_ID_PROVIDER = TENANT_ID_PROVIDER;

/**
 * Main provider function for the MeshBoard library.
 * This is the recommended way to configure MeshBoard in your application.
 *
 * Usage:
 * ```typescript
 * // app.config.ts
 * import { provideMeshBoard } from '@meshmakers/octo-meshboard';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideMeshBoard(),
 *     // or with options:
 *     provideMeshBoard({ defaultColumns: 4 })
 *   ]
 * };
 * ```
 */
export function provideMeshBoard(options?: MeshBoardOptions): EnvironmentProviders {
  const opts = { includeDefaultWidgets: true, ...options };

  const providers = [
    { provide: MESHBOARD_OPTIONS, useValue: opts }
  ];

  // Include default widgets unless explicitly disabled
  if (opts.includeDefaultWidgets !== false) {
    providers.push(
      provideAppInitializer(() => {
        const registry = inject(WidgetRegistryService);
        registerDefaultWidgets(registry);
      }) as never
    );
  }

  return makeEnvironmentProviders(providers);
}

/**
 * Provider function for registering custom widgets.
 * Use this to add your own widget types to MeshBoard.
 *
 * Usage:
 * ```typescript
 * // app.config.ts
 * import { provideMeshBoard, provideWidgetRegistrations } from '@meshmakers/octo-meshboard';
 * import { MyCustomWidget, MyCustomConfigDialog } from './widgets/my-custom-widget';
 *
 * const customWidgets: WidgetRegistration<AnyWidgetConfig, WidgetConfigResult>[] = [
 *   {
 *     type: 'myCustom',
 *     label: 'My Custom Widget',
 *     component: MyCustomWidget,
 *     configDialogComponent: MyCustomConfigDialog,
 *     defaultSize: { colSpan: 2, rowSpan: 1 },
 *     supportedDataSources: ['runtimeEntity'],
 *     // ... other registration options
 *   }
 * ];
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideMeshBoard(),
 *     provideWidgetRegistrations(customWidgets)
 *   ]
 * };
 * ```
 */
export function provideWidgetRegistrations(
  registrations: WidgetRegistration<AnyWidgetConfig, WidgetConfigResult>[]
): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() => {
      const registry = inject(WidgetRegistryService);
      for (const registration of registrations) {
        registry.registerWidget(registration);
      }
    })
  ]);
}

/**
 * Re-export WidgetRegistration type for convenience
 */
export type { WidgetRegistration } from '../services/widget-registry.service';
