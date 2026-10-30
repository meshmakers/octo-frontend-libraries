import { Component, Input, OnChanges, SimpleChanges, ViewChild, inject, signal, computed, ChangeDetectionStrategy, Signal, LOCALE_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableWidgetConfig, PersistentQueryDataSource, RuntimeEntityDataSource, TableColumnStatusIconMapping, TableColumn } from '../../models/meshboard.models';
import { DashboardWidget } from '../widget.interface';
import { ListViewComponent, TableColumn as ListViewTableColumn, StatusMapping } from '@meshmakers/shared-ui';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { formatTableCellValue } from '../../utils/meshboard-datetime';
import { TableWidgetDataSourceDirective, QueryColumn } from './table-widget-data-source.directive';
import { injectMeshBoardMessages } from '../../utils/meshboard-messages';
import { MESHBOARD_LABEL_RESOLVER, resolveMeshBoardLabel } from '../../utils/meshboard-labels';
import { injectMeshBoardLanguage } from '../../utils/meshboard-language';
import {
  TableColumnLabelProblems,
  emptyLabelProblems,
  formatUnlabelledValue,
  hasLabelProblems,
  resolveColumnTitle,
  resolveValueLabels
} from './table-column-labels';
import { TableValueLabelCellComponent } from './table-value-label-cell.component';
import { SVGIcon, checkCircleIcon, xCircleIcon, exclamationCircleIcon, questionCircleIcon, minusCircleIcon, warningTriangleIcon, circleIcon } from '@progress/kendo-svg-icons';

const ICON_MAP: Record<string, SVGIcon> = {
  'check-circle': checkCircleIcon,
  'x-circle': xCircleIcon,
  'exclamation-circle': exclamationCircleIcon,
  'warning-triangle': warningTriangleIcon,
  'minus-circle': minusCircleIcon,
  'question-circle': questionCircleIcon,
  'circle': circleIcon,
};

function resolveStatusMapping(config: Record<string, TableColumnStatusIconMapping>): StatusMapping {
  return Object.fromEntries(
    Object.entries(config).map(([key, val]) => [
      key,
      { icon: ICON_MAP[val.icon] ?? questionCircleIcon, tooltip: val.tooltip, color: val.color }
    ])
  );
}

/** Per-instance fallback for the warning key of widgets without an id. */
let nextTableWidgetInstance = 0;

/** Short, stable hash of a text (FNV-1a, base 36) for warning keys. */
function shortHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** A row's value for a column field, read like `mm-list-view` does (flat key first, then nested path). */
function readCellValue(item: unknown, field: string): unknown {
  if (item === null || typeof item !== 'object') {
    return undefined;
  }
  const row = item as Record<string, unknown>;
  if (!field.includes('.') || row[field] !== undefined) {
    return row[field];
  }
  let value: unknown = row;
  for (const key of field.split('.')) {
    if (value === null || value === undefined || typeof value !== 'object') {
      return undefined;
    }
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

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
          [messages]="texts().tableList"
          (queryColumnsLoaded)="onQueryColumnsLoaded($event)">
        </mm-list-view>
      } @else {
        <div class="no-config-overlay">
          <span>{{ texts().tableNotConfigured }}</span>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
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

  private readonly stateService = inject(MeshBoardStateService);
  /** Host texts (`MESHBOARD_MESSAGES`, AB#5622): list texts (empty state, pager, toolbar) and the placeholder. */
  protected readonly texts = injectMeshBoardMessages();
  /** Host translation of enum cell values (`MESHBOARD_LABEL_RESOLVER`, AB#5622); absent = raw text. */
  private readonly labelResolver = inject(MESHBOARD_LABEL_RESOLVER, { optional: true });
  /** CK value type per derived column field (persistent queries), for the label resolver. */
  private readonly _queryColumnValueTypes = signal<ReadonlyMap<string, string>>(new Map());
  /** Host UI language (`MESHBOARD_LANGUAGE`, AB#7655) for column `titles` / `valueLabels`; `null` = `title` / raw texts. */
  private readonly language: Signal<string | null>;
  /**
   * Problems already warned about (`<widget id or instance>|<field>|<problem hash>`), so a bad config
   * logs once, not on every language change, while a new problem after a config edit is reported again.
   */
  private readonly warnedColumns = new Set<string>();
  /** Fallback warning key of a widget without an id. */
  private readonly instanceKey = `#${++nextTableWidgetInstance}`;
  /** App locale for the `number` / `date` rendering of unlabelled values in value-label columns. */
  private readonly locale = inject(LOCALE_ID);
  /**
   * Bumped on every `config` change: `config` is a plain `@Input`, so the computeds that read it
   * depend on this signal to pick up a new config on the same widget instance (AB#7655).
   */
  private readonly _configVersion = signal(0);

  constructor() {
    // Assigned here, not as a field initialiser: relative-import initialisers break under the Vitest runner (CLAUDE.md).
    this.language = injectMeshBoardLanguage();
  }

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
      this._queryColumnValueTypes.set(new Map(columns.map(col => [col.attributePath, col.attributeValueType])));
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
    // A new config on the same instance recomputes the columns (titles, valueLabels, columns).
    this._configVersion();
    // Read the board's timezone mode so datetime cells (e.g. archive
    // window_start/window_end, which arrive as raw ISO-8601 strings) render on
    // the same basis the time filter is computed on. Reading it here makes the
    // columns recompute when the mode changes.
    const mode = this.stateService.timeZoneMode();
    // Only plain-text columns get the datetime formatter — columns the user
    // explicitly typed ('date', 'numeric', 'iso8601', …) keep their own
    // rendering, and any value that is not an ISO-8601 date-time passes through
    // unchanged. Derived stream-data columns are all 'text', so they're covered.
    //
    // With a host label resolver (AB#5622) string cells of those columns are offered to it as
    // well (enum values such as `PAID` → "Bezahlt"); columns whose query value type is known and
    // not an enum are skipped. Without a resolver the formatter is unchanged.
    const resolver = this.labelResolver;
    const dataSource = this.config?.dataSource;
    const ckTypeId = dataSource?.type === 'runtimeEntity' ? (dataSource as RuntimeEntityDataSource).ckTypeId || undefined : undefined;
    const valueTypes = this._queryColumnValueTypes();
    const withDateFormatter = (column: ListViewTableColumn): ListViewTableColumn => {
      const isPlainText = !column.dataType || column.dataType === 'text';
      if (!isPlainText || column.formatter) {
        return column;
      }
      const valueType = valueTypes.get(column.field) || undefined;
      const translate = !!resolver && (!valueType || /ENUM/i.test(valueType));
      if (!translate) {
        return { ...column, formatter: (value: unknown) => formatTableCellValue(value, mode) };
      }
      return {
        ...column,
        formatter: (value: unknown) => {
          const text = formatTableCellValue(value, mode);
          // String cells as before; numeric cells only when the query reports an enum value
          // type (numeric enum codes, AB#7655) — the resolver gets the number as string.
          const isEnumNumber = typeof value === 'number' && Number.isFinite(value) && !!valueType && /ENUM/i.test(valueType);
          if (!isEnumNumber && (typeof value !== 'string' || value === '')) {
            return text;
          }
          return resolveMeshBoardLabel(resolver, {
            kind: 'tableCell',
            ...(ckTypeId ? { ckTypeId } : {}),
            attribute: column.field,
            value: String(value),
            ...(valueType ? { valueType } : {}),
            defaultText: text
          });
        }
      };
    };

    // If explicit columns are configured, use them (works for both data source types).
    // Header texts and value labels follow the host language (AB#7655); reading the
    // language signal here re-labels the columns without refetching data.
    if (this.config?.columns && this.config.columns.length > 0) {
      const language = this.language();
      const textFormatter = (value: unknown): string => formatTableCellValue(value, mode);
      return this.config.columns.map(col => {
        const problems: TableColumnLabelProblems = emptyLabelProblems();
        const base: ListViewTableColumn = {
          field: col.field,
          displayName: resolveColumnTitle(col, language, problems),
          dataType: (col.dataType ?? 'text') as ListViewTableColumn['dataType'],
          width: col.width,
          ...(col.format ? { format: col.format } : {}),
          ...(col.statusMapping ? { statusMapping: resolveStatusMapping(col.statusMapping) } : {})
        };
        const labels = resolveValueLabels(col, language, problems);
        if (labels && (col.statusMapping || col.dataType === 'statusIcons')) {
          // valueLabels together with statusMapping (status icons) is not supported: the labels win.
          problems.statusMappingIgnored = true;
        }
        this.warnOnce(col, problems);
        if (!labels) {
          return withDateFormatter(base);
        }
        // valueLabels win over the label resolver: a plain-text cell with the label (and its optional
        // colour); an unmapped value keeps the column's dataType / format rendering; empty for null.
        return {
          ...base,
          dataType: 'component',
          cellComponent: TableValueLabelCellComponent,
          cellInputs: (item: unknown) => {
            const value = readCellValue(item, col.field);
            if (value === null || value === undefined || value === '') {
              return { text: '' };
            }
            const label = labels.get(String(value));
            return label
              ? { text: label.text, color: label.color }
              : { text: formatUnlabelledValue(value, col, this.locale, textFormatter) };
          }
        };
      });
    }

    // For persistent query without explicit columns, use derived columns
    if (this.config?.dataSource?.type === 'persistentQuery') {
      const queryColumns = this._queryColumnsForView();
      if (queryColumns.length > 0) {
        return queryColumns.map(withDateFormatter);
      }
      return [];
    }

    return [];
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
    this._configVersion();
    if (!this.config?.dataSource) return false;

    if (this.config.dataSource.type === 'persistentQuery') {
      // For persistent query, wait until columns are loaded from query response
      return this._queryColumnsForView().length > 0;
    }

    // For runtime entity, columns come from config
    return (this.config.columns?.length ?? 0) > 0;
  });

  /**
   * Logs one console warning per widget, column and set of problems for ignored `titles` /
   * `valueLabels` entries (unknown culture keys, malformed titles or value labels, `valueLabels`
   * together with `statusMapping`, AB#7655). The table still renders. The key carries a hash of the
   * problem list, so a different problem after a config edit is reported again; widgets without an
   * id use a per-instance key.
   */
  private warnOnce(column: TableColumn, problems: TableColumnLabelProblems): void {
    if (!hasLabelProblems(problems)) {
      return;
    }
    const parts: string[] = [];
    const quoted = (keys: string[]): string => keys.map(k => `"${k}"`).join(', ');
    if (problems.unknownCultureKeys.length > 0) {
      parts.push(`unknown culture keys ${quoted(problems.unknownCultureKeys)}`);
    }
    if (problems.malformedTitleKeys && problems.malformedTitleKeys.length > 0) {
      parts.push(`malformed titles entries ${quoted(problems.malformedTitleKeys)}`);
    }
    if (problems.malformedValueKeys.length > 0) {
      parts.push(`malformed valueLabels entries ${quoted(problems.malformedValueKeys)}`);
    }
    if (problems.statusMappingIgnored) {
      parts.push('statusMapping (valueLabels together with status icons are not supported; the labels are shown)');
    }
    const key = `${this.config?.id || this.instanceKey}|${column.field}|${shortHash(parts.join(';'))}`;
    if (this.warnedColumns.has(key)) {
      return;
    }
    this.warnedColumns.add(key);
    console.warn(
      `octo-meshboard: table widget "${this.config?.title ?? ''}" (${this.config?.id ?? ''}), column "${column.field}": ignoring ${parts.join('; ')}`
    );
  }

  private formatColumnTitle(field: string): string {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config']) {
      this._configVersion.update(version => version + 1);
    }
    if (changes['config'] && !changes['config'].firstChange) {
      // Clear cached query columns when config changes (for persistent queries)
      if (this.config?.dataSource?.type === 'persistentQuery') {
        this._queryColumnsForView.set([]);
        this._queryColumnValueTypes.set(new Map());
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
