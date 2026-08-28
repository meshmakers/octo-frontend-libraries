import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostBinding, Input, NgZone, Output, ViewChild, inject, OnDestroy, AfterViewInit, signal } from '@angular/core';
import {
  BooleanFilterCellComponent,
  CellClickEvent,
  CellTemplateDirective, CheckboxColumnComponent,
  ColumnComponent, CommandColumnComponent, CustomMessagesComponent,
  DateFilterCellComponent,
  ExcelModule,
  FilterCellTemplateDirective,
  GridComponent,
  GridSpacerComponent,
  NumericFilterCellComponent,
  PageChangeEvent,
  PagerSettings, PDFModule, SelectableSettings, SelectionEvent,
  StringFilterCellComponent,
  ToolbarTemplateDirective
} from '@progress/kendo-angular-grid';
import {DropDownListComponent, ItemTemplateDirective, ValueTemplateDirective} from '@progress/kendo-angular-dropdowns';
import {CompositeFilterDescriptor, FilterDescriptor} from '@progress/kendo-data-query';
import {BadgeMapping, ColumnDefinition, ContextMenuType, DEFAULT_LIST_VIEW_MESSAGES, ListViewMessages, RowClassFn, StatusFieldConfig, StatusIconMapping, TableColumn} from './list-view.model';
import {DatePipe, DecimalPipe, NgComponentOutlet, NgTemplateOutlet} from '@angular/common';
import {PascalCasePipe} from '../pipes/pascal-case.pipe';
import {SeparatorComponent, CheckBoxComponent, NumericTextBoxComponent} from '@progress/kendo-angular-inputs';
import {fileExcelIcon, filePdfIcon, filterIcon, filterClearIcon, moreVerticalIcon, arrowRotateCwIcon} from '@progress/kendo-svg-icons';
import {MmListViewDataBindingDirective} from '../directives/mm-list-view-data-binding.directive';
import {SVGIcon} from '@progress/kendo-svg-icons/dist/svg-icon.interface';
import {ButtonComponent, DropDownButtonComponent, SplitButtonComponent} from '@progress/kendo-angular-buttons';
import {SVGIconModule} from '@progress/kendo-angular-icons';
import {
  ContextMenuComponent, ContextMenuPopupEvent,
  ContextMenuSelectEvent,
  HierarchyBindingDirective,
  MenuItem
} from '@progress/kendo-angular-menu';
import {CommandBaseService, CommandItem, CommandSettingsService} from '@meshmakers/shared-services';
import {Router} from '@angular/router';
import {BytesToSizePipe} from '../pipes/bytes-to-size.pipe';
import {asyncScheduler, Subject} from 'rxjs';
import {debounceTime, distinctUntilChanged, observeOn, takeUntil} from 'rxjs/operators';
import {CronHumanizerService} from '../cron-builder/services/cron-humanizer.service';

@Component({
  selector: 'mm-list-view',
  imports: [
    GridComponent,
    MmListViewDataBindingDirective,
    ColumnComponent,
    PascalCasePipe,
    ToolbarTemplateDirective,
    GridSpacerComponent,
    ExcelModule,
    PDFModule,
    ButtonComponent,
    DropDownButtonComponent,
    SplitButtonComponent,
    CommandColumnComponent,
    CellTemplateDirective,
    ContextMenuComponent,
    HierarchyBindingDirective,
    CheckboxColumnComponent,
    CheckBoxComponent,
    SeparatorComponent,
    DatePipe,
    DecimalPipe,
    BytesToSizePipe,
    SVGIconModule,
    CustomMessagesComponent,
    FilterCellTemplateDirective,
    StringFilterCellComponent,
    NumericFilterCellComponent,
    BooleanFilterCellComponent,
    DateFilterCellComponent,
    DropDownListComponent,
    ValueTemplateDirective,
    ItemTemplateDirective,
    NumericTextBoxComponent,
    NgComponentOutlet,
    NgTemplateOutlet
  ],
  templateUrl: './list-view.component.html',
  styleUrl: './list-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ListViewComponent extends CommandBaseService implements OnDestroy, AfterViewInit {

  private readonly cronHumanizer = inject(CronHumanizerService);

  protected _columns: TableColumn[] = [];
  private _actionCommandItems: CommandItem[] = [];
  private _contextMenuCommandItems: CommandItem[] = [];
  private searchSubject = new Subject<string | null>();
  private destroy$ = new Subject<void>();
  protected searchValue = '';
  private _selectedRows: unknown[] = [];
  // action menu (button)
  private _actionMenuSelectedRow: unknown | null = null;

  // context menu (right click)
  private _contextMenuSelectedRow: unknown | null = null;

  protected _actionMenuItems: MenuItem[] = [];
  protected _contextMenuItems: MenuItem[] = [];
  protected _showRowFilter = false;

  /** Indicates if the data source is currently loading data */
  protected isLoading = signal(false);

  /**
   * The component's own width in pixels, kept current via ResizeObserver.
   * `null` until the first measurement (before that, all columns render visible
   * and auto-sized). Drives `hideBelow` column hiding and `minWidth` pinning.
   */
  protected readonly containerWidth = signal<number | null>(null);
  private readonly hostElement = inject(ElementRef<HTMLElement>);
  private readonly ngZone = inject(NgZone);
  private resizeObserver?: ResizeObserver;

  /** Never auto-page below this many rows, even in a tiny viewport. */
  private static readonly MIN_AUTO_PAGE_SIZE = 5;

  /**
   * Minimum change (in rows) before an already-measured `autoPageSize` is
   * re-applied. Rows can vary in height (component cells such as sparklines,
   * wrapping text) so the derived fit-to-height count jitters by ±1 as the user
   * pages through content. Without this dead-band every page change would
   * re-derive the page size and fire an extra fetch with a realigned `skip`,
   * overlapping the page the user actually navigated to. The very first
   * measurement always applies (it converts the initial default into the fitted
   * size); genuine resizes/density changes move by more than this threshold.
   */
  private static readonly AUTO_PAGE_SIZE_HYSTERESIS = 2;

  /** Measured fit-to-height page size (`autoPageSize`); null until the first measurement. */
  private readonly autoPageSizeValue = signal<number | null>(null);
  /** Last measured row height — reused while a page renders no rows (e.g. empty filter result). */
  private lastMeasuredRowHeight: number | null = null;
  private readonly autoPageSizeRecompute$ = new Subject<void>();

  @ViewChild(GridComponent) private gridComponent?: GridComponent;
  @ViewChild(MmListViewDataBindingDirective) private dataBindingDirective?: MmListViewDataBindingDirective;
  @ViewChild("gridmenu") public gridContextMenu?: ContextMenuComponent;

  @Output() rowClicked = new EventEmitter<unknown[]>();

  @Input() public pageSize = 20;
  @Input() public skip = 0;

  /**
   * Fit-to-height paging: when enabled, the page size is derived from the grid's
   * available content height and the measured row height, so a page always fills
   * the viewport instead of leaving a half-empty grid with a detached pager on
   * large screens. The pager's page-size dropdown is hidden (a manual choice
   * would be overridden on the next resize). `pageSize` serves as the initial
   * page size until the first measurement; the minimum auto page size is 5.
   */
  @Input() public autoPageSize = false;
  @Input() public rowIsClickable = true;
  @Input() public showRowCheckBoxes = true;
  @Input() public showRowSelectAllCheckBox = true;
  @Input() public contextMenuType: ContextMenuType = 'actionMenu';

  @Input() public leftToolbarActions: CommandItem[] = [];
  @Input() public rightToolbarActions: CommandItem[] = [];

  public get actionCommandItems(): CommandItem[] {
    return this._actionCommandItems;
  }

  @Input() public set actionCommandItems(commandItems: CommandItem[]) {
    console.debug('actionCommandItems setter called', commandItems);
    this._actionCommandItems = commandItems;
    this._actionMenuItems = this.buildMenuItems(commandItems);
    console.debug('_actionMenuItems built', this._actionMenuItems);
  }

  public get contextMenuCommandItems(): CommandItem[] {
    return this._contextMenuCommandItems;
  }

  @Input() public set contextMenuCommandItems(commandItems: CommandItem[]) {
    this._contextMenuCommandItems = commandItems;
    this._contextMenuItems = this.buildMenuItems(commandItems);
  }

  @Input() public excelExportFileName = "Export.xlsx";
  @Input() public pdfExportFileName = "Export.pdf";
  @Input() public pageable: PagerSettings = {
    buttonCount: 5,
    info: true,
    type: 'numeric',
    pageSizes: [5, 10, 20, 50, 100],
    previousNext: true
  };
  @Input() public sortable = false;
  @Input() public rowFilterEnabled = false;
  @Input() public searchTextBoxEnabled = false;

  /**
   * Persist the user's sort/row-filter/page across visits (localStorage) so they
   * are not re-applied every time. On by default. Set `false` to opt a list out
   * (e.g. a transient/embedded list where a remembered filter would confuse).
   */
  @Input() public persistListState = true;

  /**
   * Storage key for {@link persistListState}. Defaults to the current route path
   * (without query string), which is stable per list page. Set an explicit key
   * when two lists share a route, or to keep the stored state stable across a
   * route rename.
   */
  @Input() public listStateKey?: string;

  private readonly routerRef = inject(Router);

  /**
   * Resolves the effective storage key for this list, or `null` when
   * persistence is disabled. Used by {@link MmListViewDataBindingDirective}.
   */
  public resolveListStateKey(): string | null {
    if (!this.persistListState) {
      return null;
    }
    if (this.listStateKey) {
      return this.listStateKey;
    }
    const path = (this.routerRef.url ?? '').split('?')[0].split('#')[0];
    return path || null;
  }

  /** The page size the grid actually uses: the measured fit-to-height value in `autoPageSize` mode, `pageSize` otherwise. */
  protected effectivePageSize(): number {
    return (this.autoPageSize ? this.autoPageSizeValue() : null) ?? this.pageSize;
  }

  private _cachedAutoPageable?: { source: PagerSettings; result: PagerSettings };

  /** Pager settings the grid uses; in `autoPageSize` mode the page-size dropdown is stripped. Cached per source object to keep the input reference stable across change detection. */
  protected get effectivePageable(): PagerSettings {
    if (!this.autoPageSize) {
      return this.pageable;
    }
    if (this._cachedAutoPageable?.source !== this.pageable) {
      this._cachedAutoPageable = {
        source: this.pageable,
        result: {...this.pageable, pageSizes: false}
      };
    }
    return this._cachedAutoPageable.result;
  }

  /** Whether users can resize columns by dragging the header edges. */
  @Input() public resizable = true;

  /**
   * Width in pixels of the trailing actions command column. The default fits the
   * historical five-button layouts; lists with only an edit button plus the
   * context-menu trigger should pass something around 100.
   */
  @Input() public actionsColumnWidth = 220;

  /**
   * Hides the row-checkbox column while the list view is narrower than this many
   * pixels — on phone-sized layouts multi-select via checkboxes is impractical and
   * the 40px are better spent on the data columns. Pass `null` to always show them.
   */
  @Input() public hideCheckboxesBelow: number | null = 600;

  /**
   * Compact-toolbar breakpoint: below this component width the host gets the
   * `mm-list-view-narrow` class, which wraps the grid toolbar and stretches the
   * search input to a full row instead of stacking every control vertically.
   */
  @HostBinding('class.mm-list-view-narrow')
  protected get isNarrow(): boolean {
    const width = this.containerWidth();
    return width !== null && width < 600;
  }

  /**
   * Card mode (AB#4930): below this component width the rows render as
   * stacked cards instead of a horizontally scrolling table — the first
   * column becomes the card title, every other column a labeled line
   * (empty values are skipped, `hideBelow` is ignored because cards have
   * vertical room), and the actions-column buttons move into the card
   * header. Sorting headers and the row filter are unavailable while cards
   * are active; the toolbar search and quick-view bars keep working.
   * `null` (the default) keeps the table at every width.
   */
  @Input() public cardModeBelow: number | null = null;

  @HostBinding('class.mm-list-view-cards')
  protected get isCardMode(): boolean {
    const width = this.containerWidth();
    return this.cardModeBelow !== null && width !== null && width < this.cardModeBelow;
  }

  /** First column = the card's title/identity line (AB#4930). */
  protected get cardTitleColumn(): TableColumn | null {
    return this._columns.length > 0 ? this._columns[0] : null;
  }

  /** Every column after the title one — the card's labeled body lines. */
  protected get cardBodyColumns(): TableColumn[] {
    return this._columns.slice(1);
  }

  /** Empty values render no body line, so cards stay tight (AB#4930). */
  protected hasCardValue(element: Record<string, unknown>, column: TableColumn): boolean {
    if (column.dataType === 'statusIcons') {
      return this.getStatusFields(column).some(
        (fieldConfig) => !!this.getStatusIconMapping(element, fieldConfig)
      );
    }
    if (column.formatter) {
      return !!this.getFormattedValue(element, column);
    }
    const value = this.getValue(element, column);
    return value !== null && value !== undefined && value !== '';
  }

  /**
   * Callback for applying CSS classes to grid rows based on row data.
   * Passed through to Kendo Grid's [rowClass] input.
   */
  @Input() public rowClass: RowClassFn | undefined;

  protected readonly defaultRowClass: RowClassFn = () => ({});

  protected _messages: ListViewMessages = {...DEFAULT_LIST_VIEW_MESSAGES};

  @Input() public set messages(value: Partial<ListViewMessages>) {
    this._messages = {...DEFAULT_LIST_VIEW_MESSAGES, ...value};
  }

  public get messages(): ListViewMessages {
    return this._messages;
  }

  @Input() public selectable: SelectableSettings = {
    enabled: false
  };

  @Input() public set columns(cols: ColumnDefinition[]) {
    if (cols === null || cols === undefined || cols.length === 0) {
      this._columns = [];
      return;
    }

    this._columns = [];

    for (const column of cols) {
      if (typeof column === 'string') {
        this._columns.push({field: column, dataType: "text"});
      } else {
        this._columns.push(column);
      }
    }
  }

  public get columns(): TableColumn[] {
    return this._columns;
  }

  constructor() {
    const commandSettingsService = inject(CommandSettingsService);
    const router = inject(Router);

    super(commandSettingsService, router);

    // Setup debounce for search
    this.searchSubject.pipe(
      debounceTime(500), // Wait 500 ms after last input
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe((value) => {
      this.onExecuteFilter.emit(value);
    });

    // Debounced fit-to-height recomputation (resize bursts, load-completions)
    this.autoPageSizeRecompute$.pipe(
      debounceTime(150),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.recomputeAutoPageSize();
    });
  }

  ngAfterViewInit(): void {
    // Subscribe to loading state from the data binding directive.
    // Use asyncScheduler to defer each emission to a separate macrotask,
    // preventing the signal from changing during Angular's CD verify pass
    // (which causes NG0100 when Apollo returns cached data quickly).
    if (this.dataBindingDirective) {
      this.dataBindingDirective.isLoading$.pipe(
        observeOn(asyncScheduler),
        takeUntil(this.destroy$)
      ).subscribe(loading => {
        this.isLoading.set(loading);
        // Measure the fit-to-height page size only ONCE, when data first
        // renders (initial default → fitted). After that, page-size changes come
        // solely from the ResizeObserver (genuine viewport/density changes).
        // Re-measuring after every load would let per-page row-height
        // differences (wrapping descriptions, sparklines) re-derive the page
        // size mid-navigation, firing a second fetch that realigns `skip` and
        // overlaps the page the user just opened.
        if (!loading && this.autoPageSize && this.autoPageSizeValue() === null) {
          this.autoPageSizeRecompute$.next();
        }
      });
    }

    // Track the component's own width for hideBelow/minWidth column behavior.
    // The callback fires outside the Angular zone; re-enter it so the signal
    // update schedules change detection for this OnPush component.
    if (typeof ResizeObserver !== 'undefined') {
      const hostNative = this.hostElement.nativeElement;
      this.resizeObserver = new ResizeObserver(entries => {
        let hostWidth: number | undefined;
        let resized = false;
        for (const entry of entries) {
          resized = true;
          if (entry.target === hostNative) {
            hostWidth = entry.contentRect.width;
          }
        }
        this.ngZone.run(() => {
          if (hostWidth !== undefined) {
            this.containerWidth.set(hostWidth);
          }
          if (resized && this.autoPageSize) {
            this.autoPageSizeRecompute$.next();
          }
        });
      });
      this.resizeObserver.observe(hostNative);

      // The grid content viewport shrinks/grows independently of the host
      // (toolbar wrap, filter row toggle) — observe it too in auto mode.
      if (this.autoPageSize) {
        const content = hostNative.querySelector('.k-grid-content');
        if (content) {
          this.resizeObserver.observe(content);
        }
      }
    }
  }

  /**
   * Measures the grid's content viewport and the rendered row height, derives the
   * number of rows that fit and applies it as the new page size (grid + query state)
   * when it differs from the current one. No-op until a row has been rendered at
   * least once (there is nothing to measure on a fully empty grid).
   */
  private recomputeAutoPageSize(): void {
    if (!this.autoPageSize) {
      return;
    }
    const content = this.hostElement.nativeElement.querySelector('.k-grid-content');
    if (!content) {
      return;
    }
    // Measure the TALLEST rendered row, not just the first one. Rows in a list
    // can vary greatly in height (component cells such as sparklines / last-run,
    // wrapping descriptions), and the first row's height differs from page to
    // page. Measuring only the first row made the derived page size swing
    // between pages; keying off the tallest row keeps it stable and guarantees
    // a full page never overflows into a scrollbar.
    let measuredRowHeight = 0;
    content.querySelectorAll('tbody tr').forEach((row: HTMLElement) => {
      const height = row.getBoundingClientRect().height;
      if (height > measuredRowHeight) {
        measuredRowHeight = height;
      }
    });
    const rowHeight = measuredRowHeight || this.lastMeasuredRowHeight;
    if (!rowHeight || content.clientHeight <= 0) {
      return;
    }
    this.lastMeasuredRowHeight = rowHeight;
    const take = Math.max(ListViewComponent.MIN_AUTO_PAGE_SIZE, Math.floor(content.clientHeight / rowHeight));
    const current = this.effectivePageSize();
    if (take === current) {
      return;
    }
    // After the first measurement, ignore small (±1) changes: they come from
    // per-page row-height jitter, and applying them would fire an extra fetch
    // that realigns `skip` and overlaps the page the user just opened. Genuine
    // resizes/density changes exceed the hysteresis band and still apply.
    if (this.autoPageSizeValue() !== null &&
        Math.abs(take - current) < ListViewComponent.AUTO_PAGE_SIZE_HYSTERESIS) {
      return;
    }
    this.autoPageSizeValue.set(take);
    this.dataBindingDirective?.applyPageSize(take);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Whether the column is hidden at the current component width (`hideBelow`). */
  protected isColumnHidden(column: TableColumn): boolean {
    const width = this.containerWidth();
    return width !== null && column.hideBelow !== undefined && width < column.hideBelow;
  }

  /** Whether the row-checkbox column is rendered (selection enabled AND above `hideCheckboxesBelow`). */
  protected showCheckboxColumn(): boolean {
    if (!this.showRowCheckBoxes || !this.selectable.enabled) {
      return false;
    }
    if (this.isCardMode) {
      // Cards keep their checkbox: the compact layout leaves room for it and
      // the selection-dependent toolbar actions stay usable on phones.
      return true;
    }
    const width = this.containerWidth();
    return this.hideCheckboxesBelow === null || width === null || width >= this.hideCheckboxesBelow;
  }

  /**
   * Resolves the width passed to the Kendo column. Fixed-width columns keep their
   * configured width. Auto columns normally stay auto (undefined) so they stretch into
   * the remaining space — but once the space left over per auto column drops below the
   * column's `minWidth`, the column is pinned to `minWidth`. The grid's total width then
   * exceeds the container and Kendo shows a horizontal scrollbar instead of silently
   * collapsing the auto columns to zero.
   */
  protected getEffectiveWidth(column: TableColumn): number | undefined {
    if (column.width !== undefined) {
      return column.width;
    }
    if (column.minWidth === undefined) {
      return undefined;
    }
    const containerWidth = this.containerWidth();
    if (containerWidth === null) {
      return undefined;
    }

    const visibleColumns = this._columns.filter(c => !this.isColumnHidden(c));
    let fixedWidth = visibleColumns.reduce((sum, c) => sum + (c.width ?? 0), 0);
    if (this.showCheckboxColumn()) {
      fixedWidth += this.checkboxColumnWidth;
    }
    if (this._actionMenuItems.length > 0 || (this._contextMenuItems.length > 0 && this.contextMenuType == 'actionMenu')) {
      fixedWidth += this.actionsColumnWidth;
    }

    const autoColumns = visibleColumns.filter(c => c.width === undefined);
    const widthPerAutoColumn = (containerWidth - fixedWidth) / Math.max(autoColumns.length, 1);
    return widthPerAutoColumn < column.minWidth ? column.minWidth : undefined;
  }

  // Wide enough for the largest density tier: at an 18px root font the cell
  // carries 13.5px padding per side plus an 18px checkbox (= 45px). At 40px
  // the cell overflowed and Kendo's ellipsis rendered a stray "…" next to
  // every checkbox on xlarge density.
  protected readonly checkboxColumnWidth = 48;

  protected getDisplayName(column: TableColumn): string {
    return column.displayName ?? column.field;
  }

  protected getIsDisabled(commandItem: CommandItem, dataItem?: unknown): boolean {
    return CommandBaseService.getIsDisabled(commandItem, dataItem);
  }

  /**
   * Toolbar variant of {@link getIsDisabled}: an `isDisabled` callback receives
   * the current checkbox selection (always an array of row items, possibly
   * empty), so selection-dependent toolbar actions can disable themselves
   * until rows are selected — instead of answering an empty-selection click
   * with a hint message.
   */
  protected getToolbarItemDisabled(commandItem: CommandItem): boolean {
    return CommandBaseService.getIsDisabled(commandItem, this._selectedRows);
  }

  protected getValue(element: Record<string, unknown>, column: TableColumn): unknown {
    if(column.field.indexOf('.') === -1) {
      return element[column.field];
    }

    // First check if the field exists as a flat key (e.g., "contact.firstName" stored directly)
    if (element[column.field] !== undefined) {
      return element[column.field];
    }

    // Otherwise try nested object traversal (e.g., element.contact.firstName)
    const keys = column.field.split('.');
    let value: unknown = element;
    for(const key of keys) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = (value as Record<string, unknown>)[key];
    }
    return value;
  }

  /**
   * Produces the formatted cell content when a column defines a `formatter` callback.
   * Returns `null` when no formatter is configured so the template can fall back to
   * the dataType-driven rendering.
   */
  protected getFormattedValue(element: Record<string, unknown>, column: TableColumn): string | null {
    if (!column.formatter) return null;
    const value = this.getValue(element, column);
    return column.formatter(value, element);
  }

  /**
   * Plain-text representation of the cell value used as the `title` attribute on truncated
   * cells so the full string is reachable via the browser's native tooltip on hover.
   * Honours `formatter` first, then falls back to a stringified raw value.
   */
  protected getCellTitle(element: Record<string, unknown>, column: TableColumn): string | null {
    const formatted = this.getFormattedValue(element, column);
    if (formatted !== null && formatted !== undefined) {
      return formatted;
    }
    const value = this.getValue(element, column);
    if (value === null || value === undefined) return null;
    return String(value);
  }

  protected getFilterType(column: TableColumn): 'text' | 'numeric' | 'boolean' | 'date' {
    switch (column.dataType) {
      case 'text':
      case 'numeric':
      case 'boolean':
      case 'date':
        return column.dataType;
      case 'numericRange':
      case 'progressBar':
        return 'numeric';
      case 'iso8601':
        return 'date';
      default:
        return 'text';
    }
  }

  /**
   * Gets all status field configurations for a statusIcons column.
   * Returns an array of StatusFieldConfig, whether the column uses single or multi-field configuration.
   */
  protected getStatusFields(column: TableColumn): StatusFieldConfig[] {
    if (column.statusFields && column.statusFields.length > 0) {
      return column.statusFields;
    } else if (column.statusMapping) {
      return [{field: column.field, statusMapping: column.statusMapping}];
    } else {
      return [];
    }
  }

  /**
   * Gets the status icon mapping for a specific field value in a data item.
   */
  protected getStatusIconMapping(dataItem: Record<string, unknown>, fieldConfig: StatusFieldConfig): StatusIconMapping | null {
    const value = this.getFieldValue(dataItem, fieldConfig.field);
    if (value === null || value === undefined) {
      return null;
    }
    return fieldConfig.statusMapping[String(value)] ?? null;
  }

  /**
   * Resolves the badge appearance for a cell from the column's `badgeMapping`. Returns null when
   * no mapping is configured or no entry matches the cell's value — the template falls back to a
   * neutral default badge in that case so missing-mapping entries don't blank out the column.
   */
  protected getBadgeMapping(dataItem: Record<string, unknown>, column: TableColumn): BadgeMapping | null {
    if (!column.badgeMapping) {
      return null;
    }
    const value = this.getFieldValue(dataItem, column.field);
    if (value === null || value === undefined) {
      return null;
    }
    return column.badgeMapping[String(value)] ?? null;
  }

  /**
   * Helper to get a field value from a data item, supporting nested fields.
   */
  private getFieldValue(element: Record<string, unknown>, field: string): unknown {
    if (field.indexOf('.') === -1) {
      return element[field];
    }
    const keys = field.split('.');
    let value: unknown = element;
    for (const key of keys) {
      if (value === null || value === undefined) {
        return null;
      }
      value = (value as Record<string, unknown>)[key];
    }
    return value;
  }

  /**
   * Resolves the @Input bindings for a `dataType: 'component'` cell.
   * Returns an empty object when no `cellInputs` factory is configured so
   * `*ngComponentOutlet` still renders the component (with its default state).
   */
  protected getCellInputs(dataItem: Record<string, unknown>, column: TableColumn): Record<string, unknown> {
    return column.cellInputs ? column.cellInputs(dataItem) : {};
  }

  /**
   * Gets the human-readable description of a cron expression.
   */
  protected getCronHumanReadable(expression: unknown): string {
    if (!expression || typeof expression !== 'string') return '';
    return this.cronHumanizer.toHumanReadable(expression, 'en');
  }

  protected hasFilterOptions(column: TableColumn): boolean {
    return !!column.filterOptions && column.filterOptions.length > 0;
  }

  protected getSelectedFilterValue(column: TableColumn): string | null {
    const grid = this.gridComponent;
    if (!grid) return null;
    const filter = grid.filter as CompositeFilterDescriptor;
    if (!filter?.filters) return null;
    const fd = filter.filters.find(
      f => 'field' in f && (f as FilterDescriptor).field === column.field
    ) as FilterDescriptor | undefined;
    return fd?.value as string | null ?? null;
  }

  protected onDropdownFilter(value: string | null, column: TableColumn): void {
    const grid = this.gridComponent;
    if (!grid) return;

    const currentFilter: CompositeFilterDescriptor = grid.filter as CompositeFilterDescriptor ?? { logic: 'and', filters: [] };
    // Remove existing filter for this field
    const otherFilters = currentFilter.filters.filter(
      f => !('field' in f) || (f as FilterDescriptor).field !== column.field
    );

    if (value) {
      otherFilters.push({ field: column.field, operator: 'eq', value });
    }

    const newFilter: CompositeFilterDescriptor = { logic: 'and', filters: otherFilters };
    grid.filter = newFilter;
    // Sync filter into directive state and trigger rebind
    this.dataBindingDirective?.notifyFilterChange(newFilter);
  }

  protected getRangeFilterValue(column: TableColumn, operator: 'gte' | 'lte'): number | null {
    const grid = this.gridComponent;
    if (!grid?.filter) return null;
    const currentFilter = grid.filter as CompositeFilterDescriptor;
    const fd = currentFilter.filters.find(
      f => 'field' in f && (f as FilterDescriptor).field === column.field &&
           (f as FilterDescriptor).operator === operator
    ) as FilterDescriptor | undefined;
    return fd?.value as number | null ?? null;
  }

  protected onRangeFilterChange(value: number | null, column: TableColumn, operator: 'gte' | 'lte'): void {
    const grid = this.gridComponent;
    if (!grid) return;

    const currentFilter: CompositeFilterDescriptor = grid.filter as CompositeFilterDescriptor ?? { logic: 'and', filters: [] };
    // Remove existing filter for this field + operator
    const otherFilters = currentFilter.filters.filter(
      f => !('field' in f) || (f as FilterDescriptor).field !== column.field ||
           (f as FilterDescriptor).operator !== operator
    );

    if (value !== null && value !== undefined) {
      otherFilters.push({ field: column.field, operator, value });
    }

    const newFilter: CompositeFilterDescriptor = { logic: 'and', filters: otherFilters };
    grid.filter = newFilter;
    this.dataBindingDirective?.notifyFilterChange(newFilter);
  }

  protected onShowRowFilter() {
    if (this.rowFilterEnabled) {
      this._showRowFilter = !this._showRowFilter;
    }
  }

  protected onRefresh() {
    this.onRefreshData.emit();
  }

  /**
   * Resets all filtering back to the default view: clears the row filter,
   * column sort, free-text search and page offset, drops the persisted state,
   * and emits {@link onResetFilters} so the host can also reset its own
   * quick-view/bar filters.
   */
  protected onReset(): void {
    this.dataBindingDirective?.resetState();
    this.restoreSearchValue(null);
    this.resetFilters.emit();
  }

  public onExecuteFilter = new EventEmitter<string | null>();
  public onRefreshData = new EventEmitter<void>();
  /** Emitted when the toolbar "Reset Filters" button is clicked (host resets its bar filters). */
  @Output() public resetFilters = new EventEmitter<void>();

  protected async onFilter(value: string | null): Promise<void> {
    this.searchValue = value || '';
    this.searchSubject.next(value);
  }

  /**
   * Restores the search box's displayed text without re-triggering a fetch
   * (used by {@link MmListViewDataBindingDirective} when replaying a persisted
   * list state — the directive already carries the value into the initial fetch).
   */
  public restoreSearchValue(value: string | null): void {
    this.searchValue = value || '';
  }

  protected readonly filterIcon = filterIcon;
  protected readonly pdfSVG: SVGIcon = filePdfIcon;
  protected readonly excelSVG: SVGIcon = fileExcelIcon;
  protected readonly refreshIcon = arrowRotateCwIcon;
  protected readonly resetFilterIcon = filterClearIcon;

  protected onRowSelect(event: SelectionEvent) {
    // _selectedRows is an array of selected rows
    // here all dataItems of the selected Rows are pushed into _selectedRows
    this._selectedRows.push(...event.selectedRows?.map(r => r.dataItem) ?? []);
    // remove event.deselectedRows from _selectedRows
    this._selectedRows = this._selectedRows.filter(r => !event.deselectedRows?.map(r => r.dataItem)?.includes(r));

    if (this.rowIsClickable) {
      this.rowClicked.emit(this._selectedRows);  // Emit the clicked row data
    }
  }

  protected onPageChange(_event: PageChangeEvent) {
    this._selectedRows = [];
  }

  protected async onContextMenuSelect(_event: ContextMenuSelectEvent): Promise<void> {

    const commandItem = _event.item?.data?.data as CommandItem;
    if (!commandItem) {
      return;
    }

    if (this._actionMenuSelectedRow) {
      await this.navigateAsync(commandItem, this._actionMenuSelectedRow);
    } else if (this._selectedRows.length > 0) {
      if (this._selectedRows.length === 1) {
        await this.navigateAsync(commandItem, this._selectedRows[0]);
      } else {
        await this.navigateAsync(commandItem, this._selectedRows);
      }
    } else if (this._contextMenuSelectedRow) {
      await this.navigateAsync(commandItem, this._contextMenuSelectedRow);
    }
  }

  protected onCellClick(e: CellClickEvent): void {
    if (e.type === "contextmenu" && this.contextMenuType == 'contextMenu') {
      const originalEvent = e.originalEvent;
      originalEvent.preventDefault();

      this._contextMenuSelectedRow = e.dataItem;

      this.gridContextMenu?.show({
        left: originalEvent.pageX,
        top: originalEvent.pageY,
      });
    }
  }

  protected async onSelectOptionActionItem(event: Event, dataItem: unknown, menuItem: MenuItem): Promise<void> {
    // Stop propagation to prevent grid from handling the click (e.g., for selection)
    event.stopPropagation();
    event.preventDefault();

    console.debug('onSelectOptionActionItem', { dataItem, menuItem });

    const commandItem = menuItem.data as CommandItem;
    if (!commandItem) {
      console.warn('onSelectOptionActionItem: No commandItem found in menuItem.data');
      return;
    }

    await this.navigateAsync(commandItem, dataItem);
  }

  protected getMenuItemVisible(menuItem: MenuItem, dataItem: unknown): boolean {
    const commandItem = menuItem.data as CommandItem;
    if (commandItem) {
      return CommandBaseService.getIsVisibleSync(commandItem, dataItem);
    }
    return true;
  }

  protected getMenuItemDisabled(menuItem: MenuItem, dataItem: unknown): boolean {
    const commandItem = menuItem.data as CommandItem;
    if (commandItem) {
      return CommandBaseService.getIsDisabled(commandItem, dataItem);
    }
    return menuItem.disabled ?? false;
  }

  protected onContextMenu(dataItem: unknown, e: PointerEvent) {
    this._actionMenuSelectedRow = dataItem;
    // Rebuild context menu items with updated disabled state for the current row.
    // A new array reference is needed so Kendo's kendoMenuHierarchyBinding detects the change.
    this._contextMenuItems = this.buildContextMenuItemsWithDisabledState(this._contextMenuCommandItems, dataItem);
    this.gridContextMenu?.show({
      left: e.pageX,
      top: e.pageY,
    });
  }

  private buildContextMenuItemsWithDisabledState(commandItems: CommandItem[], dataItem: unknown): MenuItem[] {
    const items: MenuItem[] = [];
    for (const commandItem of commandItems) {
      if (commandItem.type === 'separator') {
        items.push({ separator: true });
      } else {
        let childMenuItems: MenuItem[] | undefined;
        if (commandItem.children) {
          childMenuItems = this.buildContextMenuItemsWithDisabledState(commandItem.children, dataItem);
        }
        items.push({
          text: commandItem.text,
          svgIcon: commandItem.svgIcon as SVGIcon,
          data: commandItem,
          items: childMenuItems,
          disabled: CommandBaseService.getIsDisabled(commandItem, dataItem),
        });
      }
    }
    return items;
  }

  protected onContextMenuClosed(_event: ContextMenuPopupEvent) {
    this._contextMenuSelectedRow = null;
    this._actionMenuSelectedRow = null;
  }


  protected async onToolbarCommand(commandItem: CommandItem): Promise<void> {
    if (this._selectedRows.length === 1) {
      await this.navigateAsync(commandItem, this._selectedRows[0]);
    } else {
      await this.navigateAsync(commandItem, this._selectedRows);
    }
  }

  protected async onToolbarDropdownItemClick(childItem: CommandItem): Promise<void> {
    if (this._selectedRows.length === 1) {
      await this.navigateAsync(childItem, this._selectedRows[0]);
    } else {
      await this.navigateAsync(childItem, this._selectedRows);
    }
  }

  private buildMenuItems(commandItems: CommandItem[]): MenuItem[] {

    const items = new Array<MenuItem>();

    for (const commandItem of commandItems) {

      if (commandItem.type === 'separator') {
        items.push({separator: true});
      } else {

        let childMenuItems: MenuItem[] | undefined = undefined;
        if (commandItem.children) {
          childMenuItems = this.buildMenuItems(commandItem.children)
        }

        items.push({
          text: commandItem.text,
          svgIcon: commandItem.svgIcon,
          data: commandItem,
          items: childMenuItems
        });
      }
    }

    return items;
  }

  protected getPdfPageText(pageNum: number, totalPages: number): string {
    return this._messages.pdfPageTemplate
      .replace('{pageNum}', String(pageNum))
      .replace('{totalPages}', String(totalPages));
  }

  protected readonly moreVerticalIcon = moreVerticalIcon;


}
