import { Component, Input, OnChanges, SimpleChanges, ViewChild, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableWidgetConfig, PersistentQueryDataSource } from '../../models/meshboard.models';
import { DashboardWidget } from '../widget.interface';
import { ListViewComponent, TableColumn as ListViewTableColumn } from '@meshmakers/shared-ui';
import { TableWidgetDataSourceDirective, QueryColumn } from './table-widget-data-source.directive';

@Component({
  selector: 'mm-table-widget',
  standalone: true,
  imports: [
    CommonModule,
    ListViewComponent,
    TableWidgetDataSourceDirective
  ],
  template: `
    <div class="table-widget">
      @if (hasValidConfig()) {
        <mm-list-view
          mmTableWidgetDataSource
          #dataSource="mmTableWidgetDataSource"
          [config]="config"
          [columns]="listViewColumns()"
          [pageSize]="config.pageSize ?? 10"
          [sortable]="config.sortable ?? false"
          [rowFilterEnabled]="false"
          [searchTextBoxEnabled]="false"
          [selectable]="{ enabled: false }"
          [showRowCheckBoxes]="false"
          [showRowSelectAllCheckBox]="false"
          [rowIsClickable]="false"
          (queryColumnsLoaded)="onQueryColumnsLoaded($event)">
        </mm-list-view>
      } @else {
        <div class="no-config-overlay">
          <span>Table not configured</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .table-widget {
      height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column;
    }

    .no-config-overlay {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--kendo-color-subtle, #6c757d);
      font-style: italic;
    }

    :host ::ng-deep mm-list-view {
      height: 100%;
    }

    :host ::ng-deep .k-grid {
      height: 100%;
    }
  `]
})
export class TableWidgetComponent implements DashboardWidget<TableWidgetConfig, Record<string, unknown>[]>, OnChanges {
  @Input() config!: TableWidgetConfig;

  @ViewChild('dataSource') dataSource?: TableWidgetDataSourceDirective;

  // Widget state signals
  private readonly _isLoading = signal(false);
  private readonly _data = signal<Record<string, unknown>[]>([]);
  private readonly _error = signal<string | null>(null);

  readonly isLoading = this._isLoading.asReadonly();
  readonly data = this._data.asReadonly();
  readonly error = this._error.asReadonly();

  /** Signal to track query columns from data source (for persistent queries) */
  private readonly _queryColumnsForView = signal<ListViewTableColumn[]>([]);

  /**
   * Called when the data source emits queryColumnsLoaded event.
   * Updates the view columns directly from the emitted columns.
   */
  onQueryColumnsLoaded(columns: QueryColumn[]): void {
    if (columns.length > 0) {
      this._queryColumnsForView.set(columns.map(col => ({
        field: col.attributePath,
        displayName: this.formatColumnTitle(col.attributePath),
        dataType: 'text' as const
      })));
    }
  }

  /**
   * Converts TableWidgetConfig columns to ListViewComponent TableColumn format.
   * For persistent queries, uses dynamically derived columns from the query response.
   */
  readonly listViewColumns = computed((): ListViewTableColumn[] => {
    // For persistent query, use derived columns
    if (this.config?.dataSource?.type === 'persistentQuery') {
      // Return query-derived columns if available
      const queryColumns = this._queryColumnsForView();
      if (queryColumns.length > 0) {
        return queryColumns;
      }
      // Return empty array while waiting for first data load
      return [];
    }

    // For runtime entity, use configured columns
    if (!this.config?.columns) return [];

    return this.config.columns.map(col => ({
      field: col.field,
      displayName: col.title,
      dataType: 'text' as const,
      width: col.width
    }));
  });

  /**
   * Checks if the widget has a valid configuration.
   * Supports both runtimeEntity and persistentQuery data sources.
   */
  hasValidConfig(): boolean {
    if (!this.config?.dataSource) return false;

    const dataSource = this.config.dataSource;

    if (dataSource.type === 'runtimeEntity') {
      return !!(dataSource.ckTypeId && this.config.columns?.length > 0);
    }

    if (dataSource.type === 'persistentQuery') {
      return !!(dataSource as PersistentQueryDataSource).queryRtId;
    }

    return false;
  }

  /**
   * Checks if columns are ready to be displayed.
   * For persistent queries, columns are derived from the query response.
   * Returns true once columns are available.
   */
  readonly columnsReady = computed((): boolean => {
    if (!this.config?.dataSource) return false;

    if (this.config.dataSource.type === 'persistentQuery') {
      // For persistent query, wait until columns are loaded from query response
      return this._queryColumnsForView().length > 0;
    }

    // For runtime entity, columns come from config
    return (this.config.columns?.length ?? 0) > 0;
  });

  private formatColumnTitle(field: string): string {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && !changes['config'].firstChange) {
      // Clear cached query columns when config changes (for persistent queries)
      if (this.config?.dataSource?.type === 'persistentQuery') {
        this._queryColumnsForView.set([]);
      }
      // Defer refresh to next microtask to allow Angular to propagate config to directive
      Promise.resolve().then(() => this.refresh());
    }
  }

  refresh(): void {
    if (this.dataSource) {
      // Clear query columns in directive before fetching new data
      this.dataSource.clearQueryColumns();
      this.dataSource.fetchAgain();
    }
  }
}
