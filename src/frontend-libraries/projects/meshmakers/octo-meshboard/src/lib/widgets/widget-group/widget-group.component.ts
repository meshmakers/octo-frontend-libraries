import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  WidgetGroupConfig,
  KpiWidgetConfig,
  GaugeWidgetConfig,
  EntityCardWidgetConfig,
  AnyWidgetConfig,
  StaticDataSource,
  RuntimeEntityData
} from '../../models/meshboard.models';
import { MeshBoardDataService, RepeaterDataItem } from '../../services/meshboard-data.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { DashboardWidget } from '../widget.interface';
import { KpiWidgetComponent } from '../kpi-widget/kpi-widget.component';
import { GaugeWidgetComponent } from '../gauge-widget/gauge-widget.component';
import { EntityCardWidgetComponent } from '../entity-card-widget/entity-card-widget.component';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';

/**
 * Widget Group Component
 *
 * Renders a collection of child widgets based on data from a repeater query.
 * Acts as a container that executes a query and dynamically creates child widgets
 * for each row/entity returned.
 *
 * Example use case: Query returns 5 machines → 5 KPI widgets show each machine's status.
 */
@Component({
  selector: 'mm-widget-group',
  standalone: true,
  imports: [
    CommonModule,
    KpiWidgetComponent,
    GaugeWidgetComponent,
    EntityCardWidgetComponent,
    WidgetNotConfiguredComponent
  ],
  templateUrl: './widget-group.component.html',
  styleUrl: './widget-group.component.scss'
})
export class WidgetGroupComponent implements DashboardWidget<WidgetGroupConfig, RepeaterDataItem[]>, OnInit, OnChanges {
  private readonly dataService = inject(MeshBoardDataService);
  private readonly variableService = inject(MeshBoardVariableService);
  private readonly stateService = inject(MeshBoardStateService);

  @Input() config!: WidgetGroupConfig;

  // Signal mirror of the config input so computed() signals can track changes.
  private readonly _config = signal<WidgetGroupConfig | undefined>(undefined);

  // Widget state signals
  private readonly _isLoading = signal(false);
  private readonly _data = signal<RepeaterDataItem[] | null>(null);
  private readonly _error = signal<string | null>(null);

  readonly isLoading = this._isLoading.asReadonly();
  readonly data = this._data.asReadonly();
  readonly error = this._error.asReadonly();

  /**
   * Computed: Check if widget is not configured (needs data source setup).
   */
  readonly isNotConfigured = computed(() => {
    const cfg = this._config();
    const dataSource = cfg?.dataSource;
    if (!dataSource) return true;
    if (dataSource.type !== 'repeaterQuery') return true;
    return !dataSource.queryRtId && !dataSource.ckTypeId;
  });

  /**
   * Computed: Generate child widget configs from data items
   */
  readonly childConfigs = computed(() => {
    const items = this._data();
    if (!items || items.length === 0) return [];

    return items.map((item, index) => this.createChildConfig(item, index));
  });

  /**
   * Computed: CSS grid template columns based on layout configuration
   */
  readonly gridTemplateColumns = computed(() => {
    const cfg = this._config();
    const layout = cfg?.layout ?? 'grid';
    const columns = cfg?.gridColumns ?? 4;
    const minWidth = cfg?.minChildWidth ?? 150;

    switch (layout) {
      case 'horizontal':
        return 'repeat(auto-fit, minmax(' + minWidth + 'px, 1fr))';
      case 'vertical':
        return '1fr';
      case 'grid':
      default:
        return `repeat(${columns}, 1fr)`;
    }
  });

  /**
   * Computed: Layout CSS class
   */
  readonly layoutClass = computed(() => {
    const cfg = this._config();
    return `layout-${cfg?.layout ?? 'grid'}`;
  });

  /**
   * Computed: Gap style
   */
  readonly gapStyle = computed(() => {
    const cfg = this._config();
    const gap = cfg?.gap ?? 8;
    return `${gap}px`;
  });

  ngOnInit(): void {
    this._config.set(this.config);
    this.loadData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config']) {
      this._config.set(this.config);
      if (!changes['config'].firstChange) {
        this.loadData();
      }
    }
  }

  refresh(): void {
    this.loadData();
  }

  private async loadData(): Promise<void> {
    const dataSource = this.config?.dataSource;

    // Validate configuration and set appropriate error messages
    if (!dataSource) {
      this._error.set('No data source configured');
      return;
    }

    if (dataSource.type !== 'repeaterQuery') {
      this._error.set('Invalid data source type for Widget Group');
      return;
    }

    if (!dataSource.queryRtId && !dataSource.ckTypeId) {
      this._error.set('No query or CK type configured');
      return;
    }

    this._isLoading.set(true);
    this._error.set(null);

    try {
      const items = await this.dataService.fetchRepeaterData(dataSource);
      this._data.set(items);

      if (items.length === 0) {
        // Not an error, just no data - will show empty message
      }
    } catch (err) {
      console.error('Error loading Widget Group data:', err);
      this._error.set('Failed to load data');
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Creates a child widget configuration from a data item.
   * Applies the template configuration and maps attributes.
   */
  private createChildConfig(item: RepeaterDataItem, index: number): AnyWidgetConfig {
    const template = this.config.childTemplate;
    const widgetType = template.widgetType;

    // Generate unique ID for the child widget
    const childId = `${this.config.id}-child-${index}`;

    // Resolve title template
    const title = this.resolveTemplate(template.titleTemplate, item) || `Item ${index + 1}`;

    // Base config shared by all widget types
    const baseConfig = {
      id: childId,
      title,
      col: 1,
      row: 1,
      colSpan: 1,
      rowSpan: 1,
      configurable: false
    };

    switch (widgetType) {
      case 'kpi':
        return this.createKpiChildConfig(baseConfig, item, template);
      case 'gauge':
        return this.createGaugeChildConfig(baseConfig, item, template);
      case 'entityCard':
        return this.createEntityCardChildConfig(baseConfig, item, template);
      default:
        // Fallback to KPI
        return this.createKpiChildConfig(baseConfig, item, template);
    }
  }

  /**
   * Creates a KPI widget config for a child widget.
   */
  private createKpiChildConfig(
    baseConfig: { id: string; title: string; col: number; row: number; colSpan: number; rowSpan: number; configurable: boolean },
    item: RepeaterDataItem,
    template: WidgetGroupConfig['childTemplate']
  ): KpiWidgetConfig {
    const staticConfig = template.staticConfig as Partial<KpiWidgetConfig> | undefined;
    const valueAttribute = template.attributeMappings.valueAttribute ?? 'value';

    // Create a static data source with the item's data as RuntimeEntityData
    const dataSource: StaticDataSource = {
      type: 'static',
      data: this.convertToRuntimeEntityData(item)
    };

    return {
      ...baseConfig,
      type: 'kpi',
      dataSource,
      valueAttribute,
      labelAttribute: template.attributeMappings.labelAttribute,
      prefix: staticConfig?.prefix,
      suffix: staticConfig?.suffix,
      trend: staticConfig?.trend,
      icon: staticConfig?.icon
    };
  }

  /**
   * Creates a Gauge widget config for a child widget.
   */
  private createGaugeChildConfig(
    baseConfig: { id: string; title: string; col: number; row: number; colSpan: number; rowSpan: number; configurable: boolean },
    item: RepeaterDataItem,
    template: WidgetGroupConfig['childTemplate']
  ): GaugeWidgetConfig {
    const staticConfig = template.staticConfig as Partial<GaugeWidgetConfig> | undefined;
    const valueAttribute = template.attributeMappings.valueAttribute ?? 'value';

    // Create a static data source with the item's data as RuntimeEntityData
    const dataSource: StaticDataSource = {
      type: 'static',
      data: this.convertToRuntimeEntityData(item)
    };

    return {
      ...baseConfig,
      type: 'gauge',
      dataSource,
      gaugeType: staticConfig?.gaugeType ?? 'arc',
      valueAttribute,
      labelAttribute: template.attributeMappings.labelAttribute,
      min: staticConfig?.min ?? 0,
      max: staticConfig?.max ?? 100,
      ranges: staticConfig?.ranges,
      showLabel: staticConfig?.showLabel ?? true,
      prefix: staticConfig?.prefix,
      suffix: staticConfig?.suffix,
      reverse: staticConfig?.reverse
    };
  }

  /**
   * Creates an Entity Card widget config for a child widget.
   */
  private createEntityCardChildConfig(
    baseConfig: { id: string; title: string; col: number; row: number; colSpan: number; rowSpan: number; configurable: boolean },
    item: RepeaterDataItem,
    template: WidgetGroupConfig['childTemplate']
  ): EntityCardWidgetConfig {
    const staticConfig = template.staticConfig as Partial<EntityCardWidgetConfig> | undefined;

    // For EntityCard, we can use a static data source with the entity data
    const dataSource: StaticDataSource = {
      type: 'static',
      data: this.convertToRuntimeEntityData(item)
    };

    return {
      ...baseConfig,
      type: 'entityCard',
      dataSource,
      showHeader: staticConfig?.showHeader ?? true,
      showAttributes: staticConfig?.showAttributes ?? true,
      attributeFilter: staticConfig?.attributeFilter,
      headerColor: staticConfig?.headerColor
    };
  }

  /**
   * Converts a RepeaterDataItem to RuntimeEntityData format.
   */
  private convertToRuntimeEntityData(item: RepeaterDataItem): RuntimeEntityData {
    const attributes = Array.from(item.attributes.entries()).map(([key, value]) => ({
      attributeName: key,
      value
    }));

    return {
      rtId: item.rtId,
      ckTypeId: item.ckTypeId,
      rtWellKnownName: item.rtWellKnownName,
      attributes,
      associations: []
    };
  }

  /**
   * Resolves a template string with variable substitution.
   * Supports $rtWellKnownName, $rtId, $ckTypeId, and $attributeName syntax.
   */
  private resolveTemplate(template: string | undefined, item: RepeaterDataItem): string {
    if (!template) return '';

    let resolved = template;

    // Replace built-in variables
    resolved = resolved.replace(/\$rtWellKnownName/g, item.rtWellKnownName ?? '');
    resolved = resolved.replace(/\$rtId/g, item.rtId);
    resolved = resolved.replace(/\$ckTypeId/g, item.ckTypeId);

    // Replace attribute references ($attributeName or ${attributeName})
    resolved = resolved.replace(/\$\{?([a-zA-Z_][a-zA-Z0-9_]*)\}?/g, (match, attrName) => {
      // Skip built-in variables already handled
      if (['rtWellKnownName', 'rtId', 'ckTypeId'].includes(attrName)) {
        return match.startsWith('${') ? '' : match;
      }

      const value = item.attributes.get(attrName);
      return value !== undefined ? String(value) : '';
    });

    return resolved.trim();
  }
}
