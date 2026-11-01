import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  QueryList,
  SimpleChanges,
  ViewChildren,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { arrowDownIcon, arrowUpIcon, plusIcon } from '@progress/kendo-svg-icons';
import { MM_ACTION_ICONS } from '@meshmakers/shared-ui';
import { ExpressionEvaluatorService } from '@meshmakers/octo-process-diagrams';
import {
  EntitySelectorConfig,
  LineChartFormulaSeries,
  LineChartQuerySeries,
  LineChartSeriesDefinition,
  LineChartSeriesDisplayOptions,
  MeshBoardVariable,
  SeriesAggregationFunction
} from '../../models/meshboard.models';
import { QueryExecutorService } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { PersistentQueryItem, QueryColumnItem } from '../../utils/runtime-entity-data-sources';
import { columnProbeWindow } from '../../utils/column-probe-window';
import { QuerySelectorComponent } from '../../components/query-selector/query-selector.component';
import { SdTimeFilterToggleComponent } from '../../components/sd-time-filter-toggle/sd-time-filter-toggle.component';
import { EntitySelectorScopePickerComponent } from '../../components/entity-selector-scope-picker/entity-selector-scope-picker.component';
import { FormulaFieldComponent } from '../../components/formula-field/formula-field.component';
import { validateFormula } from '../../utils/meshboard-formula';
import { querySeriesErrors, SERIES_KEY_PATTERN } from './line-chart-multi-source';

const NUMERIC_TYPES = ['INTEGER', 'FLOAT', 'DOUBLE', 'DECIMAL', 'LONG'];

/** One editor row: the series plus the transient picker state. */
interface SeriesRow {
  uid: number;
  series: LineChartSeriesDefinition;
  query: PersistentQueryItem | null;
  numericColumns: QueryColumnItem[];
  loadingColumns: boolean;
}

/**
 * Series section of the line chart config dialog (AB#7951, wireframe linked in AB#7951): the
 * series that come after the primary query's series, in legend / stacking order.
 *
 * - Query rows: own stream-data query, value field, entity-selector scope, time-filter opt-out and
 *   resolution-aware routing (AB#7951).
 * - Formula rows (AB#7952): a formula over the other rows' keys in the shared formula field
 *   (series keys as available names, no preview).
 * - Every row and the primary row: Visible and Stacked (Stacked only in a stacked area chart;
 *   unchecked = drawn as a line over the stack).
 *
 * Rows can be added, removed and moved by keyboard; the focus stays on a moved row's button.
 */
@Component({
  selector: 'mm-line-chart-series-editor',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    DropDownsModule,
    InputsModule,
    QuerySelectorComponent,
    SdTimeFilterToggleComponent,
    EntitySelectorScopePickerComponent,
    FormulaFieldComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="series-editor">
      <div class="series-row primary" role="group" aria-label="Series of the primary query">
        <span class="tag">primary</span>
        <span>Series of the primary query (one per series group value), edited above</span>
        <span class="display-options">
          <label class="checkbox">
            <input type="checkbox" kendoCheckBox data-series-primary="visible" [ngModel]="primary?.visible !== false"
                   (ngModelChange)="setPrimaryOption('visible', $event)" />
            Visible
          </label>
          <label class="checkbox" [title]="stackedChart ? '' : stackedDisabledHint">
            <input type="checkbox" kendoCheckBox data-series-primary="stacked" [disabled]="!stackedChart"
                   [ngModel]="primary?.stacked !== false" (ngModelChange)="setPrimaryOption('stacked', $event)" />
            Stacked
          </label>
        </span>
      </div>

      @for (row of rows; track row.uid; let i = $index; let first = $first; let last = $last) {
        <div class="series-row" #rowCard tabindex="-1" role="group" [attr.aria-label]="'Series ' + (row.series.key || (i + 1))">
          <div class="row-actions">
            <button kendoButton type="button" fillMode="flat" size="small" [svgIcon]="arrowUpIcon"
                    data-series-action="up" [disabled]="first"
                    [attr.aria-label]="'Move series ' + (row.series.key || (i + 1)) + ' up'" title="Move up"
                    (click)="move(i, -1)"></button>
            <button kendoButton type="button" fillMode="flat" size="small" [svgIcon]="arrowDownIcon"
                    data-series-action="down" [disabled]="last"
                    [attr.aria-label]="'Move series ' + (row.series.key || (i + 1)) + ' down'" title="Move down"
                    (click)="move(i, 1)"></button>
            <span class="tag">{{ row.series.kind }}</span>
          </div>

          <div class="field key">
            <label [for]="'series-key-' + row.uid">Key <span class="required">*</span></label>
            <kendo-textbox [id]="'series-key-' + row.uid" [attr.data-series-key]="i"
                           [(ngModel)]="row.series.key" (valueChange)="emit()" placeholder="e.g. pv"></kendo-textbox>
          </div>
          <div class="field label">
            <label [for]="'series-label-' + row.uid">Label</label>
            <kendo-textbox [id]="'series-label-' + row.uid" [(ngModel)]="row.series.label"
                           (valueChange)="emit()" placeholder="Legend label"></kendo-textbox>
          </div>
          @if (asQuery(row); as q) {
          <div class="field query">
            <label>Query (stream data) <span class="required">*</span></label>
            <mm-query-selector [ngModel]="row.query" [acceptFamilies]="streamDataOnly"
                               (querySelected)="onQuerySelected(row, $event)"
                               placeholder="Select a stream-data query..."></mm-query-selector>
          </div>
          <div class="field value">
            <label [for]="'series-value-' + row.uid">Value field <span class="required">*</span></label>
            <kendo-combobox [id]="'series-value-' + row.uid" [data]="row.numericColumns"
                            [textField]="'attributePath'" [valueField]="'attributePath'" [valuePrimitive]="true"
                            [loading]="row.loadingColumns" [allowCustom]="true"
                            [(ngModel)]="q.valueField" (valueChange)="emit()"
                            placeholder="Numeric column..."></kendo-combobox>
          </div>
          <div class="field scope">
            <mm-entity-selector-scope-picker [family]="'streamData'" [selectors]="selectors"
                                             [entitySelectorId]="q.dataSource.entitySelectorId"
                                             (entitySelectorIdChange)="q.dataSource.entitySelectorId = $event; emit()">
            </mm-entity-selector-scope-picker>
          </div>
          <div class="field toggles">
            <mm-sd-time-filter-toggle [family]="'streamData'"
                                      [ignoreTimeFilter]="!!q.dataSource.ignoreTimeFilter"
                                      (ignoreTimeFilterChange)="q.dataSource.ignoreTimeFilter = $event || undefined; emit()">
            </mm-sd-time-filter-toggle>
            <label class="checkbox">
              <input type="checkbox" kendoCheckBox [ngModel]="!!q.dataSource.resolutionAware"
                     (ngModelChange)="onResolutionAwareChange(row, $event)" />
              Resolution-aware
            </label>
            @if (q.dataSource.resolutionAware) {
              <kendo-dropdownlist [data]="aggregationOptions" [textField]="'label'" [valueField]="'value'"
                                  [valuePrimitive]="true" [attr.aria-label]="'Aggregation'"
                                  [(ngModel)]="q.dataSource.requiredAggregation" (valueChange)="emit()">
              </kendo-dropdownlist>
            }
          </div>
          } @else if (asFormula(row); as f) {
            <div class="field formula">
              <mm-meshboard-formula-field
                [formula]="f.formula"
                (formulaChange)="f.formula = $event; emit()"
                [variables]="operandsFor(row)"
                [showPreview]="false"
                label="Formula"
                variablesLabel="Available series"
                namesNoun="series"
                [syntaxHint]="keySyntaxHint"
                emptyVariablesText="No other series yet. Add query series first."
                [placeholder]="formulaPlaceholder">
              </mm-meshboard-formula-field>
            </div>
          }
          <div class="field display-options">
            <label class="checkbox">
              <input type="checkbox" kendoCheckBox [attr.data-series-visible]="i" [ngModel]="row.series.visible !== false"
                     (ngModelChange)="setOption(row, 'visible', $event)" />
              Visible
            </label>
            <label class="checkbox" [title]="stackedChart ? '' : stackedDisabledHint">
              <input type="checkbox" kendoCheckBox [attr.data-series-stacked]="i" [disabled]="!stackedChart"
                     [ngModel]="row.series.stacked !== false" (ngModelChange)="setOption(row, 'stacked', $event)" />
              Stacked
            </label>
          </div>
          <button kendoButton type="button" fillMode="flat" size="small" class="remove" [svgIcon]="trashIcon"
                  data-series-action="remove"
                  [attr.aria-label]="'Remove series ' + (row.series.key || (i + 1))" title="Remove series"
                  (click)="remove(i)"></button>
          @if (rowMessage(i); as message) {
            <p class="row-error" role="alert">{{ message }}</p>
          }
        </div>
      }

      <div class="add-actions">
        <button kendoButton type="button" fillMode="flat" [svgIcon]="plusIcon" data-series-action="add" (click)="add()">
          Add query series
        </button>
        <button kendoButton type="button" fillMode="flat" [svgIcon]="plusIcon" data-series-action="add-formula" (click)="addFormula()">
          Add formula series
        </button>
      </div>
    </div>
  `,
  styles: [`
    .series-editor { display: flex; flex-direction: column; gap: 8px; }
    .series-row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 8px 12px;
      padding: 8px;
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 4px;
      background: var(--kendo-color-surface, #fff);
    }
    .series-row.primary {
      align-items: center;
      font-size: 0.85rem;
      color: var(--kendo-color-subtle, #6c757d);
      background: var(--kendo-color-base-subtle, transparent);
    }
    .row-actions { display: flex; align-items: center; gap: 2px; }
    .tag {
      font-size: 0.7rem;
      padding: 0 6px;
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 8px;
      color: var(--kendo-color-subtle, #6c757d);
    }
    .field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .field label { font-size: 0.8rem; font-weight: 600; }
    .field.key { flex: 0 1 120px; }
    .field.label { flex: 1 1 140px; }
    .field.query { flex: 2 1 220px; }
    .field.value { flex: 1 1 160px; }
    .field.scope { flex: 1 1 200px; }
    .field.formula { flex: 1 1 100%; }
    .field.display-options, .display-options { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
    .add-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .field.toggles { flex: 1 1 100%; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
    .checkbox { display: flex; align-items: center; gap: 6px; font-weight: normal; font-size: 0.85rem; }
    .remove { margin-left: auto; }
    .required { color: var(--kendo-color-error, #dc3545); }
    .row-error { flex-basis: 100%; margin: 0; font-size: 0.8rem; color: var(--kendo-color-error, #dc3545); }
  `]
})
export class LineChartSeriesEditorComponent implements OnChanges {
  private readonly queryExecutor = inject(QueryExecutorService);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly evaluator = inject(ExpressionEvaluatorService);

  /** The series (query and formula rows), in order. */
  @Input() series: LineChartSeriesDefinition[] = [];
  /** Display options of the primary query's series (AB#7952). */
  @Input() primary: LineChartSeriesDisplayOptions | undefined;
  /** The chart stacks (area + stacked): enables the per-series Stacked checkboxes (AB#7952). */
  @Input() stackedChart = false;
  /** Emits the primary display options on change; `undefined` when both are default. */
  @Output() primaryChange = new EventEmitter<LineChartSeriesDisplayOptions | undefined>();
  /** Entity selectors of the board (scope picker). */
  @Input() selectors: EntitySelectorConfig[] = [];
  /** Emits a new array on every change. */
  @Output() seriesChange = new EventEmitter<LineChartSeriesDefinition[]>();

  @ViewChildren('rowCard') rowCards?: QueryList<ElementRef<HTMLElement>>;

  get arrowUpIcon(): typeof arrowUpIcon { return arrowUpIcon; }
  get arrowDownIcon(): typeof arrowDownIcon { return arrowDownIcon; }
  get plusIcon(): typeof plusIcon { return plusIcon; }
  get trashIcon(): typeof MM_ACTION_ICONS.delete { return MM_ACTION_ICONS.delete; }

  readonly streamDataOnly = ['streamData'] as const;
  readonly stackedDisabledHint = 'Only a stacked area chart stacks series.';
  readonly keySyntaxHint = '${key}';
  readonly formulaPlaceholder = 'e.g. min(${pv} - ${gridExport}, ${consumption})';

  readonly aggregationOptions: { value: SeriesAggregationFunction; label: string }[] = [
    { value: 'SUM', label: 'Sum' },
    { value: 'AVG', label: 'Average' },
    { value: 'MAX', label: 'Max' },
    { value: 'MIN', label: 'Min' },
    { value: 'COUNT', label: 'Count' },
    { value: 'TIME_WEIGHTED_AVG', label: 'Time-weighted average' }
  ];

  rows: SeriesRow[] = [];
  errors: (string | null)[] = [];
  private nextUid = 1;
  private readonly operandCache = new Map<number, { key: string; variables: MeshBoardVariable[] }>();
  /** The array last emitted, so an echo through `[series]` does not rebuild the rows. */
  private lastEmitted: LineChartSeriesDefinition[] | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['series'] && this.series !== this.lastEmitted) {
      this.rows = (this.series ?? []).map(s => this.createRow(structuredClone(s)));
      this.errors = querySeriesErrors(this.rows.map(r => r.series), this.evaluator);
      for (const row of this.rows) {
        if (row.series.kind === 'query' && row.series.dataSource.queryRtId) void this.loadColumns(row);
      }
    }
  }

  add(): void {
    this.rows = [...this.rows, this.createRow({
      kind: 'query',
      key: '',
      dataSource: { type: 'persistentQuery', queryRtId: '', queryFamily: 'streamData' },
      valueField: ''
    })];
    this.emit();
    this.focusAfterRender(this.rows.length - 1, 'key');
  }

  addFormula(): void {
    this.rows = [...this.rows, this.createRow({ kind: 'formula', key: '', formula: '' })];
    this.emit();
    this.focusAfterRender(this.rows.length - 1, 'key');
  }

  /** The row as query series (template narrowing). */
  asQuery(row: SeriesRow): LineChartQuerySeries | null {
    return row.series.kind === 'query' ? row.series : null;
  }

  /** The row as formula series (template narrowing). */
  asFormula(row: SeriesRow): LineChartFormulaSeries | null {
    return row.series.kind === 'formula' ? row.series : null;
  }

  /**
   * Names a formula row can insert: the keys of every other row (a self-reference would be a
   * circular reference). Cached per key set, so the formula field's inputs keep their reference.
   */
  operandsFor(row: SeriesRow): MeshBoardVariable[] {
    const names = this.rows
      .filter(r => r !== row && SERIES_KEY_PATTERN.test(r.series.key?.trim() ?? ''))
      .map(r => r.series.key.trim());
    const cacheKey = names.join('\u0000');
    const cached = this.operandCache.get(row.uid);
    if (cached && cached.key === cacheKey) return cached.variables;
    const variables: MeshBoardVariable[] = names.map(name => ({ name, type: 'number', source: 'static', value: '' }));
    this.operandCache.set(row.uid, { key: cacheKey, variables });
    return variables;
  }

  /**
   * Message under a row. For a formula row the shared formula field already shows syntax and
   * unknown-key messages; the row repeats only what the field cannot know (key, circular reference).
   */
  rowMessage(index: number): string | null {
    const message = this.errors[index] ?? null;
    const series = this.rows[index]?.series;
    if (!message || series?.kind !== 'formula' || !series.formula?.trim()) return message;
    const keys = this.rows.map(r => r.series.key?.trim() ?? '').filter(k => !!k);
    const fieldError = validateFormula(series.formula, keys, this.evaluator).error;
    return message === fieldError ? null : message;
  }

  setOption(row: SeriesRow, option: 'visible' | 'stacked', on: boolean): void {
    const next = { ...row.series } as LineChartSeriesDefinition;
    if (on) delete next[option];
    else next[option] = false;
    row.series = next;
    this.emit();
  }

  setPrimaryOption(option: 'visible' | 'stacked', on: boolean): void {
    const next: LineChartSeriesDisplayOptions = { ...(this.primary ?? {}) };
    if (on) delete next[option];
    else next[option] = false;
    this.primary = Object.keys(next).length > 0 ? next : undefined;
    this.primaryChange.emit(this.primary);
    this.cdr.markForCheck();
  }

  remove(index: number): void {
    this.rows = this.rows.filter((_, i) => i !== index);
    this.emit();
    if (this.rows.length > 0) this.focusAfterRender(Math.min(index, this.rows.length - 1), 'down');
    else this.focusAdd();
  }

  move(index: number, delta: -1 | 1): void {
    const target = index + delta;
    if (target < 0 || target >= this.rows.length) return;
    const rows = [...this.rows];
    [rows[index], rows[target]] = [rows[target], rows[index]];
    this.rows = rows;
    this.emit();
    // Keep the focus on the moved row: on its button in the same direction, or the other one at an end.
    const atEnd = delta < 0 ? target === 0 : target === rows.length - 1;
    this.focusAfterRender(target, atEnd ? (delta < 0 ? 'down' : 'up') : (delta < 0 ? 'up' : 'down'));
  }

  async onQuerySelected(row: SeriesRow, query: PersistentQueryItem | null): Promise<void> {
    if (row.series.kind !== 'query') return;
    row.query = query;
    row.series.dataSource = {
      ...row.series.dataSource,
      queryRtId: query?.rtId ?? '',
      queryName: query?.name || undefined,
      queryFamily: 'streamData'
    };
    row.series.valueField = '';
    row.numericColumns = [];
    this.emit();
    if (query) await this.loadColumns(row);
  }

  onResolutionAwareChange(row: SeriesRow, on: boolean): void {
    if (row.series.kind !== 'query') return;
    row.series.dataSource = {
      ...row.series.dataSource,
      resolutionAware: on || undefined,
      requiredAggregation: on ? (row.series.dataSource.requiredAggregation ?? 'AVG') : undefined
    };
    this.emit();
  }

  emit(): void {
    const series = this.rows.map(r => ({ ...r.series, key: r.series.key?.trim() ?? '', label: r.series.label?.trim() || undefined }));
    this.errors = querySeriesErrors(series, this.evaluator);
    this.lastEmitted = series;
    this.seriesChange.emit(series);
    this.cdr.markForCheck();
  }

  private createRow(series: LineChartSeriesDefinition): SeriesRow {
    const ds = series.kind === 'query' ? series.dataSource : undefined;
    return {
      uid: this.nextUid++,
      series,
      query: ds?.queryRtId ? { rtId: ds.queryRtId, name: ds.queryName || ds.queryRtId } : null,
      numericColumns: [],
      loadingColumns: false
    };
  }

  /** Numeric columns of the row's query, probed with the board window (AB#7975). */
  private async loadColumns(row: SeriesRow): Promise<void> {
    if (row.series.kind !== 'query') return;
    const queryRtId = row.series.dataSource.queryRtId;
    row.loadingColumns = true;
    this.cdr.markForCheck();
    try {
      const columns = await this.queryExecutor.fetchStreamDataColumns(
        queryRtId, columnProbeWindow(this.stateService.resolveStreamDataTimeArgs()));
      row.numericColumns = columns
        .filter(c => NUMERIC_TYPES.includes(c.attributeValueType ?? ''))
        .map(c => ({ attributePath: c.attributePath, attributeValueType: c.attributeValueType ?? '', aggregationType: c.aggregationType ?? null }));
    } catch (error) {
      console.warn('Could not load the columns of the series query:', error);
      row.numericColumns = [];
    } finally {
      row.loadingColumns = false;
      this.cdr.markForCheck();
    }
  }

  private focusAfterRender(index: number, target: 'up' | 'down' | 'key'): void {
    setTimeout(() => {
      const card = this.rowCards?.get(index)?.nativeElement;
      const selector = target === 'key' ? `[data-series-key="${index}"] input` : `[data-series-action="${target}"]`;
      const el = card?.querySelector<HTMLElement>(selector);
      (el && !(el as HTMLButtonElement).disabled ? el : card)?.focus();
    });
  }

  private focusAdd(): void {
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('[data-series-action="add"]')?.focus());
  }
}
