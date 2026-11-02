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
  SeriesAggregationFunction,
  SeriesDashType,
  SeriesMissingValues
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

/** Default look-back of "Last value" in hours (= DEFAULT_CARRY_FORWARD_LOOKBACK_MINUTES / 60, AB#8046). */
const DEFAULT_CARRY_FORWARD_LOOKBACK_HOURS = 24;

/** Copy of `target` with `patch` applied; keys whose patch value is `undefined` are removed. */
function applyPatch<T extends object>(target: T, patch: Partial<LineChartSeriesDisplayOptions>): T {
  const next = { ...target } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return next as T;
}

/** One editor row: the series plus the transient picker state. */
interface SeriesRow {
  uid: number;
  series: LineChartSeriesDefinition;
  query: PersistentQueryItem | null;
  numericColumns: QueryColumnItem[];
  /** Every column of the query (category field picker of the bar chart, AB#7953). */
  allColumns: QueryColumnItem[];
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
 *
 * `alignment="category"` (bar chart, AB#7953): rows are matched per category value, so every query
 * row gets its own category field; Resolution-aware and Stacked are not shown (the chart type
 * stacks).
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
        <span>{{ categoryMode ? 'Series of the primary query, edited above' : 'Series of the primary query (one per series group value), edited above' }}</span>
        <span class="display-options">
          <label class="checkbox">
            <input type="checkbox" kendoCheckBox data-series-primary="visible" [ngModel]="primary?.visible !== false"
                   (ngModelChange)="setPrimaryOption('visible', $event)" />
            Visible
          </label>
          @if (!categoryMode) {
          <label class="checkbox" [title]="stackedChart ? '' : stackedDisabledHint">
            <input type="checkbox" kendoCheckBox data-series-primary="stacked" [disabled]="!stackedChart"
                   [ngModel]="primary?.stacked !== false" (ngModelChange)="setPrimaryOption('stacked', $event)" />
            Stacked
          </label>
          }
          <span class="field option-field">
            <label for="series-primary-missing">Missing values</label>
            <kendo-dropdownlist id="series-primary-missing" data-series-primary="missingValues" [data]="missingValueOptions"
                                [textField]="'label'" [valueField]="'value'" [valuePrimitive]="true"
                                [ngModel]="primary?.missingValues ?? 'gap'"
                                (ngModelChange)="patchPrimary({ missingValues: $event === 'gap' ? undefined : $event })">
            </kendo-dropdownlist>
          </span>
          @if (drawsAsLine(primary)) {
          <span class="field option-field">
            <label for="series-primary-dash">Line style</label>
            <kendo-dropdownlist id="series-primary-dash" data-series-primary="dashType" [data]="dashTypeOptions"
                                [textField]="'label'" [valueField]="'value'" [valuePrimitive]="true"
                                [ngModel]="primary?.dashType ?? 'solid'"
                                (ngModelChange)="patchPrimary({ dashType: $event === 'solid' ? undefined : $event })">
            </kendo-dropdownlist>
          </span>
          }
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
          @if (categoryMode) {
          <div class="field category">
            <label [for]="'series-category-' + row.uid">Category field <span class="required">*</span></label>
            <kendo-combobox [id]="'series-category-' + row.uid" [attr.data-series-category]="i" [data]="row.allColumns"
                            [textField]="'attributePath'" [valueField]="'attributePath'" [valuePrimitive]="true"
                            [loading]="row.loadingColumns" [allowCustom]="true"
                            [(ngModel)]="q.categoryField" (valueChange)="emit()"
                            placeholder="e.g. timestamp"></kendo-combobox>
          </div>
          }
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
            @if (!categoryMode) {
            <label class="checkbox">
              <input type="checkbox" kendoCheckBox [ngModel]="!!q.dataSource.resolutionAware"
                     (ngModelChange)="onResolutionAwareChange(row, $event)" />
              Resolution-aware
            </label>
            }
            @if (!categoryMode && q.dataSource.resolutionAware) {
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
          <div class="field display-options" role="group" [attr.aria-label]="'Display of series ' + (row.series.key || (i + 1))">
            <span class="display-label">Display</span>
            <label class="checkbox">
              <input type="checkbox" kendoCheckBox [attr.data-series-visible]="i" [ngModel]="row.series.visible !== false"
                     (ngModelChange)="setOption(row, 'visible', $event)" />
              Visible
            </label>
            @if (!categoryMode) {
            <label class="checkbox" [title]="stackedChart ? '' : stackedDisabledHint">
              <input type="checkbox" kendoCheckBox [attr.data-series-stacked]="i" [disabled]="!stackedChart"
                     [ngModel]="row.series.stacked !== false" (ngModelChange)="setOption(row, 'stacked', $event)" />
              Stacked
            </label>
            }
            @if (row.series.kind === 'query') {
            <span class="field option-field">
              <label [for]="'series-missing-' + row.uid">Missing values</label>
              <kendo-dropdownlist [id]="'series-missing-' + row.uid" [attr.data-series-missing]="i" [data]="missingValueOptions"
                                  [textField]="'label'" [valueField]="'value'" [valuePrimitive]="true"
                                  [ngModel]="row.series.missingValues ?? 'gap'"
                                  (ngModelChange)="setMissingValues(row, $event)">
              </kendo-dropdownlist>
            </span>
            @if (!categoryMode && row.series.missingValues === 'carryForward') {
            <span class="field option-field narrow">
              <label [for]="'series-lookback-' + row.uid">Look back (hours)</label>
              <kendo-numerictextbox [id]="'series-lookback-' + row.uid" [attr.data-series-lookback]="i"
                                    [min]="0" [max]="720" [decimals]="0" [format]="'n0'" [spinners]="false"
                                    [ngModel]="lookbackHours(row)" (ngModelChange)="setLookbackHours(row, $event)">
              </kendo-numerictextbox>
            </span>
            }
            }
            <span class="field option-field narrow">
              <label [for]="'series-color-' + row.uid">Colour</label>
              <kendo-colorpicker [id]="'series-color-' + row.uid" [attr.data-series-color]="i" format="hex" [clearButton]="true"
                                 [value]="$any(colorPickerValue(row))" (valueChange)="patchRow(row, { color: $event || undefined })">
              </kendo-colorpicker>
            </span>
            @if (categoryMode) {
            <label class="checkbox" [title]="linesAllowed ? '' : linesDisabledHint">
              <input type="checkbox" kendoCheckBox [attr.data-series-as-line]="i" [disabled]="!linesAllowed"
                     [ngModel]="row.series.asLine === true" (ngModelChange)="setAsLine(row, $event)" />
              Draw as line
            </label>
            @if (row.series.asLine) {
            <label class="checkbox">
              <input type="checkbox" kendoCheckBox [attr.data-series-secondary-axis]="i"
                     [ngModel]="row.series.secondaryAxis === true"
                     (ngModelChange)="patchRow(row, { secondaryAxis: $event ? true : undefined })" />
              Second axis
            </label>
            }
            }
            @if (drawsAsLine(row.series)) {
            <span class="field option-field">
              <label [for]="'series-dash-' + row.uid">Line style</label>
              <kendo-dropdownlist [id]="'series-dash-' + row.uid" [attr.data-series-dash]="i" [data]="dashTypeOptions"
                                  [textField]="'label'" [valueField]="'value'" [valuePrimitive]="true"
                                  [ngModel]="row.series.dashType ?? 'solid'"
                                  (ngModelChange)="patchRow(row, { dashType: $event === 'solid' ? undefined : $event })">
              </kendo-dropdownlist>
            </span>
            }
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
    .field.category { flex: 1 1 160px; }
    .field.scope { flex: 1 1 200px; }
    .field.formula { flex: 1 1 100%; }
    .field.display-options, .display-options { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
    .field.display-options {
      flex: 1 1 100%;
      align-items: flex-end;
      padding-top: 6px;
      border-top: 1px dotted var(--kendo-color-border, #dee2e6);
    }
    .display-label { align-self: center; font-size: 0.8rem; font-weight: 600; color: var(--kendo-color-subtle, #6c757d); }
    .field.option-field { flex: 0 1 170px; }
    .field.option-field.narrow { flex: 0 1 110px; }
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
  /**
   * How the chart matches series (AB#7953): `timeGrid` (line chart, default) or `category` (bar
   * chart: per-row category field, no Resolution-aware, no Stacked).
   */
  @Input() alignment: 'timeGrid' | 'category' = 'timeGrid';
  /** Time-grid mode (AB#8046): the chart draws areas, so only `stacked: false` series of a stacked area chart are lines. */
  @Input() areaChart = false;
  /** Category mode (AB#8046): the chart type can mix lines with bars (column types; not horizontal bars). */
  @Input() linesAllowed = true;
  /** Category field preset for a new query row in category mode (the primary query's category field). */
  @Input() defaultCategoryField: string | undefined;
  /** Emits a new array on every change. */
  @Output() seriesChange = new EventEmitter<LineChartSeriesDefinition[]>();

  @ViewChildren('rowCard') rowCards?: QueryList<ElementRef<HTMLElement>>;

  get arrowUpIcon(): typeof arrowUpIcon { return arrowUpIcon; }
  get arrowDownIcon(): typeof arrowDownIcon { return arrowDownIcon; }
  get plusIcon(): typeof plusIcon { return plusIcon; }
  get trashIcon(): typeof MM_ACTION_ICONS.delete { return MM_ACTION_ICONS.delete; }

  readonly streamDataOnly = ['streamData'] as const;
  readonly stackedDisabledHint = 'Only a stacked area chart stacks series.';
  readonly linesDisabledHint = 'A horizontal bar chart cannot draw lines; choose a column chart type.';

  /** Options of "Missing values" (AB#8046). */
  readonly missingValueOptions: { value: SeriesMissingValues; label: string }[] = [
    { value: 'gap', label: 'No value (gap)' },
    { value: 'zero', label: '0' },
    { value: 'carryForward', label: 'Last value' }
  ];

  /** Options of "Line style" (AB#8046). */
  readonly dashTypeOptions: { value: SeriesDashType; label: string }[] = [
    { value: 'solid', label: 'Solid' },
    { value: 'dash', label: 'Dashed' },
    { value: 'dot', label: 'Dotted' }
  ];
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

  /** Rows are matched per category value (bar chart, AB#7953). */
  get categoryMode(): boolean {
    return this.alignment === 'category';
  }

  rows: SeriesRow[] = [];
  errors: (string | null)[] = [];
  private nextUid = 1;
  private readonly operandCache = new Map<number, { key: string; variables: MeshBoardVariable[] }>();
  /** The array last emitted, so an echo through `[series]` does not rebuild the rows. */
  private lastEmitted: LineChartSeriesDefinition[] | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['series'] && this.series !== this.lastEmitted) {
      this.rows = (this.series ?? []).map(s => this.createRow(structuredClone(s)));
      this.errors = querySeriesErrors(this.rows.map(r => r.series), this.evaluator, this.validationOptions());
      for (const row of this.rows) {
        if (row.series.kind === 'query' && row.series.dataSource.queryRtId) void this.loadColumns(row);
      }
    } else if (changes['alignment']) {
      this.errors = querySeriesErrors(this.rows.map(r => r.series), this.evaluator, this.validationOptions());
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
    this.patchPrimary({ [option]: on ? undefined : false });
  }

  /**
   * Sets display options of a row (AB#8046); a key with value `undefined` is removed, so defaults
   * are never stored.
   */
  patchRow(row: SeriesRow, patch: Partial<LineChartSeriesDisplayOptions>): void {
    row.series = applyPatch(row.series, patch);
    this.emit();
  }

  /** Sets display options of the primary row (AB#8046); `undefined` removes a key. */
  patchPrimary(patch: Partial<LineChartSeriesDisplayOptions>): void {
    const next = applyPatch({ ...(this.primary ?? {}) }, patch);
    if (next.missingValues !== 'carryForward') delete next.carryForwardLookbackMinutes;
    this.primary = Object.keys(next).length > 0 ? next : undefined;
    this.primaryChange.emit(this.primary);
    this.cdr.markForCheck();
  }

  /** "Missing values" of a query row; leaving `carryForward` drops its look-back. */
  setMissingValues(row: SeriesRow, mode: SeriesMissingValues): void {
    this.patchRow(row, {
      missingValues: mode === 'gap' ? undefined : mode,
      ...(mode !== 'carryForward' && { carryForwardLookbackMinutes: undefined })
    });
  }

  /** Look-back of `carryForward` in hours (stored in minutes); empty = default. */
  lookbackHours(row: SeriesRow): number | null {
    const minutes = row.series.carryForwardLookbackMinutes;
    return minutes === undefined ? DEFAULT_CARRY_FORWARD_LOOKBACK_HOURS : minutes / 60;
  }

  setLookbackHours(row: SeriesRow, hours: number | null): void {
    const minutes = hours === null || hours === undefined ? undefined : Math.max(0, Math.round(hours * 60));
    this.patchRow(row, { carryForwardLookbackMinutes: minutes === DEFAULT_CARRY_FORWARD_LOOKBACK_HOURS * 60 ? undefined : minutes });
  }

  /** "Draw as line" of a bar chart row; off drops the line-only options. */
  setAsLine(row: SeriesRow, on: boolean): void {
    this.patchRow(row, on ? { asLine: true } : { asLine: undefined, secondaryAxis: undefined, dashType: undefined });
  }

  /**
   * Whether a series is drawn as a line, i.e. "Line style" applies (AB#8046): bar chart `asLine`; line
   * chart always; area chart only a non-stacked series of a stacked area chart (Kendo has no dash style
   * for areas).
   */
  drawsAsLine(options: LineChartSeriesDisplayOptions | undefined): boolean {
    if (this.categoryMode) return options?.asLine === true;
    return !this.areaChart || (this.stackedChart && options?.stacked === false);
  }

  /** The colour picker shows hex colours only; a custom property or status name (hand-edited JSON) shows as empty. */
  colorPickerValue(row: SeriesRow): string | null {
    const color = row.series.color?.trim() ?? '';
    return /^#[0-9a-f]{3,8}$/i.test(color) ? color : null;
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
    if (this.categoryMode) row.series.categoryField = '';
    row.numericColumns = [];
    row.allColumns = [];
    this.emit();
    if (query) {
      await this.loadColumns(row);
      this.presetCategoryField(row);
    }
  }

  /**
   * Category mode: a row without a category field gets the primary query's category field when
   * its query has that column, else `timestamp` when it has one (AB#7953).
   */
  private presetCategoryField(row: SeriesRow): void {
    if (!this.categoryMode || row.series.kind !== 'query' || row.series.categoryField) return;
    const paths = row.allColumns.map(c => c.attributePath);
    const preset = [this.defaultCategoryField, 'timestamp'].find(f => !!f && paths.includes(f));
    if (preset) {
      row.series.categoryField = preset;
      this.emit();
    }
  }

  private validationOptions(): { requireCategoryField: boolean } {
    return { requireCategoryField: this.categoryMode };
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
    this.errors = querySeriesErrors(series, this.evaluator, this.validationOptions());
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
      allColumns: [],
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
      row.allColumns = columns
        .map(c => ({ attributePath: c.attributePath, attributeValueType: c.attributeValueType ?? '', aggregationType: c.aggregationType ?? null }));
      row.numericColumns = row.allColumns.filter(c => NUMERIC_TYPES.includes(c.attributeValueType));
    } catch (error) {
      console.warn('Could not load the columns of the series query:', error);
      row.numericColumns = [];
      row.allColumns = [];
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
