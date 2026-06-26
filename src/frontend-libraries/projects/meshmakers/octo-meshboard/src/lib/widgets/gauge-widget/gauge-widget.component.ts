import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GaugeWidgetConfig, RuntimeEntityData, PersistentQueryDataSource, WidgetFilterConfig } from '../../models/meshboard.models';
import { DashboardDataService } from '../../services/meshboard-data.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { DashboardWidget } from '../widget.interface';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';
import { catchError, of, firstValueFrom } from 'rxjs';
import { QueryExecutionResult, QueryExecutorService, StreamDataExecutionArgs } from '../../services/query-executor.service';
import {CollectionChangesService, KENDO_GAUGES} from "@progress/kendo-angular-gauges";
import { FieldFilterDto } from '@meshmakers/octo-services';
import { matchesAttributePath } from '../../utils/widget-data-utils';

@Component({
  selector: 'mm-gauge-widget',
  standalone: true,
  imports: [
    CommonModule,
    KENDO_GAUGES,
    WidgetNotConfiguredComponent
  ],
  providers: [CollectionChangesService],
  template: `
    <div class="gauge-widget" [class.loading]="isLoading()" [class.error]="error()">
      @if (isNotConfigured()) {
        <mm-widget-not-configured></mm-widget-not-configured>
      } @else if (isLoading()) {
        <div class="loading-indicator">
          <span>...</span>
        </div>
      } @else if (error()) {
        <div class="error-message">
          <span>{{ error() }}</span>
        </div>
      } @else {
        <div class="gauge-container">
          @switch (config.gaugeType) {
            @case ('arc') {
              <kendo-arcgauge
                [value]="numericValue()"
                [transitions]="true">
                <kendo-arcgauge-scale
                  [min]="config.min ?? 0"
                  [max]="config.max ?? 100"
                  [reverse]="config.reverse ?? false">
                </kendo-arcgauge-scale>
                @if (config.ranges && config.ranges.length > 0) {
                  <kendo-arcgauge-colors>
                    @for (range of config.ranges; track range.from) {
                      <kendo-arcgauge-color
                        [from]="range.from"
                        [to]="range.to"
                        [color]="range.color">
                      </kendo-arcgauge-color>
                    }
                  </kendo-arcgauge-colors>
                }
                @if (config.showLabel !== false) {
                  <ng-template kendoArcGaugeCenterTemplate let-value="value">
                    <div class="gauge-center-label">
                      <span class="value-text">
                        {{ config.prefix ?? '' }}{{ formattedValue() }}{{ config.suffix ?? '' }}
                      </span>
                      @if (label()) {
                        <span class="label-text">{{ label() }}</span>
                      }
                    </div>
                  </ng-template>
                }
              </kendo-arcgauge>
            }
            @case ('circular') {
              <kendo-circulargauge
                [value]="numericValue()"
                [transitions]="true">
                <kendo-circulargauge-scale
                  [min]="config.min ?? 0"
                  [max]="config.max ?? 100"
                  [reverse]="config.reverse ?? false">
                </kendo-circulargauge-scale>
                @if (config.showLabel !== false) {
                  <ng-template kendoCircularGaugeCenterTemplate let-value="value">
                    <div class="gauge-center-label">
                      <span class="value-text">
                        {{ config.prefix ?? '' }}{{ formattedValue() }}{{ config.suffix ?? '' }}
                      </span>
                      @if (label()) {
                        <span class="label-text">{{ label() }}</span>
                      }
                    </div>
                  </ng-template>
                }
              </kendo-circulargauge>
            }
            @case ('radial') {
              <kendo-radialgauge [transitions]="true">
                <kendo-radialgauge-scale
                  [min]="config.min ?? 0"
                  [max]="config.max ?? 100"
                  [reverse]="config.reverse ?? false">
                  @if (config.ranges && config.ranges.length > 0) {
                    <kendo-radialgauge-scale-ranges>
                      @for (range of config.ranges; track range.from) {
                        <kendo-radialgauge-scale-range
                          [from]="range.from"
                          [to]="range.to"
                          [color]="range.color">
                        </kendo-radialgauge-scale-range>
                      }
                    </kendo-radialgauge-scale-ranges>
                  }
                </kendo-radialgauge-scale>
                <kendo-radialgauge-pointer [value]="numericValue()">
                </kendo-radialgauge-pointer>
              </kendo-radialgauge>
              @if (config.showLabel !== false) {
                <div class="gauge-value-label">
                  {{ config.prefix ?? '' }}{{ formattedValue() }}{{ config.suffix ?? '' }}
                  @if (label()) {
                    <span class="label-text">{{ label() }}</span>
                  }
                </div>
              }
            }
            @case ('linear') {
              <div class="linear-gauge-wrapper">
                @if (data()) {
                  <kendo-lineargauge [transitions]="true">
                    <kendo-lineargauge-scale
                      [min]="config.min ?? 0"
                      [max]="config.max ?? 100"
                      [reverse]="config.reverse ?? false"
                      [vertical]="true">
                      <kendo-lineargauge-scale-labels [visible]="true"></kendo-lineargauge-scale-labels>
                      @if (config.ranges && config.ranges.length > 0) {
                        <kendo-lineargauge-scale-ranges>
                          @for (range of config.ranges; track range.from) {
                            <kendo-lineargauge-scale-range
                              [from]="range.from"
                              [to]="range.to"
                              [color]="range.color">
                            </kendo-lineargauge-scale-range>
                          }
                        </kendo-lineargauge-scale-ranges>
                      }
                    </kendo-lineargauge-scale>
                    <kendo-lineargauge-pointers>
                      <kendo-lineargauge-pointer
                        [value]="numericValue()">
                      </kendo-lineargauge-pointer>
                    </kendo-lineargauge-pointers>
                  </kendo-lineargauge>
                }
                @if (config.showLabel !== false) {
                  <div class="gauge-value-label">
                    {{ config.prefix ?? '' }}{{ formattedValue() }}{{ config.suffix ?? '' }}
                    @if (label()) {
                      <span class="label-text">{{ label() }}</span>
                    }
                  </div>
                }
              </div>
            }
            @default {
              <!-- Fallback to arc gauge if gaugeType is unknown -->
              <kendo-arcgauge
                [value]="numericValue()"
                [transitions]="true">
                <kendo-arcgauge-scale
                  [min]="config.min ?? 0"
                  [max]="config.max ?? 100"
                  [reverse]="config.reverse ?? false">
                </kendo-arcgauge-scale>
                @if (config.showLabel !== false) {
                  <ng-template kendoArcGaugeCenterTemplate let-value="value">
                    <div class="gauge-center-label">
                      <span class="value-text">
                        {{ config.prefix ?? '' }}{{ formattedValue() }}{{ config.suffix ?? '' }}
                      </span>
                      @if (label()) {
                        <span class="label-text">{{ label() }}</span>
                      }
                    </div>
                  </ng-template>
                }
              </kendo-arcgauge>
            }
          }
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .gauge-widget {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 8px;
      box-sizing: border-box;
      overflow: hidden;
    }

    .gauge-widget.loading,
    .gauge-widget.error {
      opacity: 0.7;
    }

    .loading-indicator,
    .error-message {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      width: 100%;
    }

    .loading-indicator span {
      font-size: 1.5rem;
      color: var(--kendo-color-subtle, #6c757d);
    }

    .error-message span {
      color: var(--kendo-color-error, #dc3545);
      font-size: 0.875rem;
    }

    .gauge-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }

    .gauge-center-label {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    .gauge-center-label .value-text {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--kendo-color-on-surface, inherit);
    }

    .gauge-center-label .label-text {
      font-size: 0.75rem;
      color: var(--kendo-color-subtle, #6c757d);
      margin-top: 2px;
    }

    .gauge-value-label {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: 8px;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--kendo-color-on-surface, inherit);
    }

    .gauge-value-label .label-text {
      font-size: 0.75rem;
      font-weight: 400;
      color: var(--kendo-color-subtle, #6c757d);
      margin-top: 2px;
    }

    /* Kendo gauge sizing */
    kendo-arcgauge,
    kendo-circulargauge,
    kendo-radialgauge {
      width: 100%;
      max-width: 200px;
      height: auto;
    }

    .linear-gauge-wrapper {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      height: 100%;
      width: 100%;
      gap: 8px;
    }

    .linear-gauge-wrapper .gauge-value-label {
      margin-top: 0;
      writing-mode: horizontal-tb;
    }

    kendo-lineargauge {
      height: 100%;
      max-height: 180px;
      width: auto;
    }
  `]
})
export class GaugeWidgetComponent implements DashboardWidget<GaugeWidgetConfig, RuntimeEntityData>, OnInit, OnChanges {

  public pointers = [
    {
      value: 10,
      color: "#ffd246",
    },
    {
      value: 20,
      color: "#28b4c8",
    },
    {
      value: 30,
      color: "#78d237",
    },
  ];

  private readonly dataService = inject(DashboardDataService);
  private readonly queryExecutor = inject(QueryExecutorService);

  private static readonly SUPPORTED_ROW_TYPES: ReadonlySet<string> = new Set([
    'RtAggregationQueryRow',
    'RtGroupingAggregationQueryRow',
    'StreamDataQueryRow'
  ]);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly variableService = inject(MeshBoardVariableService);

  @Input() config!: GaugeWidgetConfig;

  // Widget state signals
  private readonly _isLoading = signal(false);
  private readonly _data = signal<RuntimeEntityData | null>(null);
  private readonly _error = signal<string | null>(null);

  readonly isLoading = this._isLoading.asReadonly();
  readonly data = this._data.asReadonly();
  readonly error = this._error.asReadonly();

  /**
   * Check if widget is not configured (needs data source setup).
   * This is a method (not computed) to ensure it re-evaluates when config changes via @Input.
   */
  isNotConfigured(): boolean {
    const dataSource = this.config?.dataSource;
    if (!dataSource) return true;
    if (dataSource.type === 'runtimeEntity') {
      return !dataSource.rtId && !dataSource.ckTypeId;
    }
    if (dataSource.type === 'persistentQuery') {
      return !dataSource.queryRtId;
    }
    if (dataSource.type === 'static') {
      return false; // Static data is always "configured"
    }
    return false;
  }

  readonly numericValue = computed(() => {
    const data = this._data();
    if (!data?.attributes) return 0;

    // For persistent queries, look for _queryValue; otherwise use configured valueAttribute
    const attributeName = this.config?.dataSource?.type === 'persistentQuery'
      ? '_queryValue'
      : this.config?.valueAttribute;

    const attr = data.attributes.find(a => a.attributeName === attributeName);
    if (!attr) return 0;

    const numValue = typeof attr.value === 'number' ? attr.value : parseFloat(String(attr.value));
    return isNaN(numValue) ? 0 : numValue;
  });

  readonly formattedValue = computed(() => {
    const value = this.numericValue();
    return value.toLocaleString('de-AT', {
      minimumFractionDigits: value % 1 !== 0 ? 1 : 0,
      maximumFractionDigits: 2
    });
  });

  readonly label = computed(() => {
    const data = this._data();
    if (this.config?.labelAttribute && data?.attributes) {
      const attr = data.attributes.find(a => a.attributeName === this.config.labelAttribute);
      if (attr && attr.value !== null && attr.value !== undefined && attr.value !== 'null') {
        return String(attr.value);
      }
    }
    return '';
  });

  ngOnInit(): void {
    this.loadData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && !changes['config'].firstChange) {
      this.loadData();
    }
  }

  refresh(): void {
    this.loadData();
  }

  private loadData(): void {
    // Skip loading if widget is not configured - isNotConfigured() handles the display
    if (this.isNotConfigured()) {
      return;
    }

    const dataSource = this.config?.dataSource;

    if (dataSource.type === 'static') {
      const staticData = dataSource.data as RuntimeEntityData;
      this._data.set(staticData);
      this._error.set(null);
      return;
    }

    if (dataSource.type === 'persistentQuery') {
      this.loadPersistentQueryData();
      return;
    }

    if (dataSource.type === 'runtimeEntity') {
      // Note: isNotConfigured() check at top ensures rtId and ckTypeId are set
      this._isLoading.set(true);
      this._error.set(null);

      this.dataService.fetchEntityWithAssociations(dataSource.rtId!, dataSource.ckTypeId!)
        .pipe(
          catchError(err => {
            console.error('Error loading Gauge data:', err);
            this._error.set('Failed to load data');
            return of(null);
          })
        )
        .subscribe(entityData => {
          this._data.set(entityData);
          this._isLoading.set(false);
        });
    }
  }

  private async loadPersistentQueryData(): Promise<void> {
    // Note: isNotConfigured() check in loadData() ensures queryRtId is set
    const dataSource = this.config.dataSource as PersistentQueryDataSource;

    this._isLoading.set(true);
    this._error.set(null);

    try {
      const fieldFilter = this.convertFiltersToDto(this.config.filters);
      // queryFamily may be undefined for legacy widget configs — the executor
      // falls back to a one-time lookup by rtId. streamDataArgs is sent
      // unconditionally because the runtime path ignores it.
      const streamDataArgs = this.buildStreamDataArgs();

      const result = await firstValueFrom(
        this.queryExecutor.execute(dataSource.queryFamily, dataSource.queryRtId, {
          fieldFilter: fieldFilter ?? undefined,
          streamDataArgs
        }).pipe(
          catchError(err => {
            console.error('Error loading Gauge query data:', err);
            throw err;
          })
        )
      );

      let value = 0;
      const queryMode = this.config.queryMode ?? 'simpleCount';

      switch (queryMode) {
        case 'simpleCount':
          value = result.totalCount;
          break;

        case 'aggregation':
          value = this.extractAggregationValue(result);
          break;

        case 'groupedAggregation':
          value = this.extractGroupedAggregationValue(result);
          break;
      }

      // Create a synthetic entity with the value
      const gaugeEntity: RuntimeEntityData = {
        rtId: 'query-entity',
        ckTypeId: 'system.query',
        attributes: [{ attributeName: '_queryValue', value }],
        associations: []
      };
      this._data.set(gaugeEntity);
      this._isLoading.set(false);

    } catch (err) {
      console.error('Error loading Gauge query data:', err);
      this._error.set('Failed to load data');
      this._isLoading.set(false);
    }
  }

  private buildStreamDataArgs(): StreamDataExecutionArgs | undefined {
    const ds = this.config.dataSource as PersistentQueryDataSource;
    const timeArgs = this.stateService.resolveStreamDataTimeArgs(ds.ignoreTimeFilter);
    const rtIds = this.stateService.resolveStreamDataRtIds(ds.entitySelectorId);
    if (!timeArgs && !rtIds) {
      return undefined;
    }
    return { ...timeArgs, rtIds };
  }

  private extractAggregationValue(queryResult: QueryExecutionResult): number {
    const firstRow = queryResult.rows.find(row =>
      GaugeWidgetComponent.SUPPORTED_ROW_TYPES.has(row.__typename ?? '')
    );
    if (!firstRow) return 0;

    const valueField = this.config.queryValueField;
    for (const cell of firstRow.cells) {
      if (valueField && matchesAttributePath(cell.attributePath, valueField)) {
        return this.parseNumericValue(cell.value);
      }
    }

    return firstRow.cells.length > 0 ? this.parseNumericValue(firstRow.cells[0].value) : 0;
  }

  private extractGroupedAggregationValue(queryResult: QueryExecutionResult): number {
    const categoryField = this.config.queryCategoryField;
    const categoryValue = this.config.queryCategoryValue;
    const valueField = this.config.queryValueField;

    if (!categoryField || !categoryValue || !valueField) {
      return 0;
    }

    for (const row of queryResult.rows) {
      if (!GaugeWidgetComponent.SUPPORTED_ROW_TYPES.has(row.__typename ?? '')) continue;

      let categoryMatch = false;
      let value = 0;

      for (const cell of row.cells) {
        if (matchesAttributePath(cell.attributePath, categoryField) && String(cell.value) === categoryValue) {
          categoryMatch = true;
        }
        if (matchesAttributePath(cell.attributePath, valueField)) {
          value = this.parseNumericValue(cell.value);
        }
      }

      if (categoryMatch) {
        return value;
      }
    }

    return 0;
  }

  private parseNumericValue(value: unknown): number {
    if (typeof value === 'number') return value;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Converts widget filter configuration to GraphQL FieldFilterDto format.
   * Resolves MeshBoard variables in filter values before conversion.
   */
  private convertFiltersToDto(filters?: WidgetFilterConfig[]): FieldFilterDto[] | undefined {
    const variables = this.stateService.getVariables();
    return this.variableService.convertToFieldFilterDto(filters, variables);
  }
}
