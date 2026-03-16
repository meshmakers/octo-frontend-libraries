import { Component, OnInit, inject, signal, computed, Type, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule, NavigationEnd } from '@angular/router';
import { TileLayoutModule, TileLayoutResizeEvent } from '@progress/kendo-angular-layout';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { DialogService, DialogModule, WindowService, WindowCloseResult } from '@progress/kendo-angular-dialog';
import { filter, firstValueFrom, Subscription } from 'rxjs';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import {
  gearIcon,
  plusIcon,
  saveIcon,
  arrowRotateCwIcon,
  pencilIcon,
  xIcon,
  linkIcon,
  trashIcon,
  gridLayoutIcon,
  undoIcon,
  copyIcon,
  infoCircleIcon
} from '@progress/kendo-svg-icons';

import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { EditModeStateService } from '../../services/edit-mode-state.service';
import { WidgetFactoryService } from '../../services/widget-factory.service';
import { WidgetRegistryService } from '../../services/widget-registry.service';
import { MeshBoardDataService } from '../../services/meshboard-data.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { AnyWidgetConfig, WidgetType, MeshBoardConfig, TimeRangeSelection, EntitySelectorConfig } from '../../models/meshboard.models';
import { MeshBoardSettingsDialogComponent, MeshBoardSettingsResult } from '../../dialogs/meshboard-settings-dialog/meshboard-settings-dialog.component';
import {
  EntitySelectorToolbarComponent,
  EntitySelectorEvent,
  EntitySelectorClearEvent
} from '../../components/entity-selector-toolbar/entity-selector-toolbar.component';
import { AddWidgetDialogComponent } from '../../dialogs/add-widget-dialog/add-widget-dialog.component';
import { MeshBoardManagerDialogComponent } from '../../dialogs/meshboard-manager-dialog/meshboard-manager-dialog.component';
import { EditWidgetDialogComponent, WidgetPositionUpdate } from '../../dialogs/edit-widget-dialog/edit-widget-dialog.component';
import { TENANT_ID_PROVIDER } from '@meshmakers/octo-services';
import { BreadCrumbService } from '@meshmakers/shared-services';
import {
  HasUnsavedChanges,
  HAS_UNSAVED_CHANGES,
  UnsavedChangesDirective,
  TimeRangePickerComponent,
  TimeRange,
  TimeRangeUtils,
  TimeRangeSelection as SharedTimeRangeSelection,
  TimeRangePickerLabels,
  WindowStateService
} from '@meshmakers/shared-ui';

/**
 * Main container component that displays a MeshBoard with widgets in a grid layout.
 * Provides toolbar for settings, adding widgets, saving, and refreshing.
 */
@Component({
  selector: 'mm-meshboard-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TileLayoutModule,
    ButtonModule,
    DialogModule,
    SVGIconModule,
    EditWidgetDialogComponent,
    TimeRangePickerComponent,
    EntitySelectorToolbarComponent
  ],
  hostDirectives: [UnsavedChangesDirective],
  providers: [{ provide: HAS_UNSAVED_CHANGES, useExisting: MeshBoardViewComponent }],
  templateUrl: './meshboard-view.component.html',
  styleUrl: './meshboard-view.component.scss'
})
export class MeshBoardViewComponent implements OnInit, OnDestroy, HasUnsavedChanges {
  private readonly stateService = inject(MeshBoardStateService);
  private readonly variableService = inject(MeshBoardVariableService);
  private readonly editModeService = inject(EditModeStateService);
  private readonly widgetFactory = inject(WidgetFactoryService);
  private readonly widgetRegistry = inject(WidgetRegistryService);
  private readonly dataService = inject(MeshBoardDataService);
  private readonly dialogService = inject(DialogService);
  private readonly windowService = inject(WindowService);
  private readonly windowStateService = inject(WindowStateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly gridService = inject(MeshBoardGridService);
  private readonly tenantIdProvider = inject(TENANT_ID_PROVIDER, { optional: true });
  private readonly breadCrumbService = inject(BreadCrumbService, { optional: true });

  // Track the last known rtId to avoid unnecessary navigation
  private lastNavigatedRtId: string | null = null;
  // Guard to prevent the effect from running during initial load
  private initialLoadComplete = false;

  // Icons
  protected readonly gearIcon = gearIcon;
  protected readonly plusIcon = plusIcon;
  protected readonly saveIcon = saveIcon;
  protected readonly arrowRotateCwIcon = arrowRotateCwIcon;
  protected readonly pencilIcon = pencilIcon;
  protected readonly xIcon = xIcon;
  protected readonly linkIcon = linkIcon;
  protected readonly trashIcon = trashIcon;
  protected readonly gridLayoutIcon = gridLayoutIcon;
  protected readonly undoIcon = undoIcon;
  protected readonly copyIcon = copyIcon;
  protected readonly infoCircleIcon = infoCircleIcon;

  // Edit widget dialog state
  protected showEditWidgetDialog = false;
  protected editingWidget: AnyWidgetConfig | null = null;

  // Config dialog state
  private configDialogSubscription: Subscription | null = null;
  private navigationSubscription: Subscription | null = null;

  // State signals
  protected readonly config = this.stateService.meshBoardConfig;
  protected readonly isEditMode = this.editModeService.isEditMode;
  protected readonly isSaving = this.editModeService.isSaving;
  protected readonly isLoading = this.stateService.isLoading;
  protected readonly isModelAvailable = this.stateService.isModelAvailable;

  // Local UI state
  private readonly _isInitialized = signal(false);
  protected readonly isInitialized = this._isInitialized.asReadonly();
  private readonly _notFoundError = signal<string | null>(null);
  protected readonly notFoundError = this._notFoundError.asReadonly();
  private readonly _isReadonly = signal(false);
  protected readonly isReadonly = this._isReadonly.asReadonly();
  private readonly _hideEntitySelectors = signal(false);
  protected readonly hideEntitySelectors = this._hideEntitySelectors.asReadonly();
  protected readonly timeRangeLabels = signal<TimeRangePickerLabels>({});

  // Computed link to MeshBoard page with tenant
  protected readonly meshBoardPageLink = computed(() => {
    // Get tenant from route parameters (synchronously from snapshot)
    const tenantId = this.route.snapshot.paramMap.get('tenantId')
      || this.route.parent?.snapshot.paramMap.get('tenantId')
      || this.route.root.firstChild?.snapshot.paramMap.get('tenantId');
    return tenantId ? `/${tenantId}/ui/meshboards` : '/ui/meshboards';
  });

  // Computed
  protected readonly hasWidgets = computed(() => this.config().widgets.length > 0);
  protected readonly canSave = computed(() => this.isEditMode() && !this.isSaving());

  // Time Filter computed signals
  protected readonly isTimeFilterEnabled = computed(() => this.stateService.isTimeFilterEnabled());
  protected readonly timeFilterConfig = computed(() => this.stateService.getTimeFilterConfig());
  private readonly _urlTimeSelection = signal<TimeRangeSelection | null>(null);
  protected readonly initialTimeSelection = computed(() => {
    // Priority: URL selection > stored selection > default selection
    const urlSelection = this._urlTimeSelection();
    const config = this.timeFilterConfig();
    const selection = urlSelection ?? config?.selection ?? config?.defaultSelection;
    if (!selection) return undefined;
    return {
      ...selection,
      customFrom: selection.customFrom ? new Date(selection.customFrom) : undefined,
      customTo: selection.customTo ? new Date(selection.customTo) : undefined
    } as SharedTimeRangeSelection;
  });

  // Entity Selector computed signals
  protected readonly entitySelectorsConfig = computed(() => this.stateService.getEntitySelectors());
  protected readonly hasEntitySelectors = computed(() =>
    !this.hideEntitySelectors() && (this.entitySelectorsConfig()?.some(es => es.showInToolbar !== false) ?? false)
  );
  protected readonly unselectedToolbarSelectors = computed(() => {
    if (this.hideEntitySelectors()) return [];
    const selectors = this.entitySelectorsConfig() ?? [];
    return selectors.filter(es => es.showInToolbar !== false && !es.selectedRtId);
  });

  /**
   * Whether the time filter can be reset to the default selection.
   * True when a default selection is configured and the stored selection differs from it.
   */
  protected readonly canResetTimeFilter = computed(() => {
    const config = this.timeFilterConfig();
    if (!config?.enabled || !config.defaultSelection) return false;
    if (!config.selection) return false;
    return !this.isSelectionEqual(config.selection, config.defaultSelection);
  });

  constructor() {
    // Effect to sync URL when dashboard changes (after initial load)
    effect(() => {
      const currentRtId = this.stateService.persistedMeshBoardId();
      if (currentRtId && currentRtId !== this.lastNavigatedRtId) {
        this.lastNavigatedRtId = currentRtId;
        if (this.initialLoadComplete) {
          // Only update URL and time filter for post-init board switches (e.g. manager dialog)
          this.updateUrlWithRtId(currentRtId);
          this.initializeTimeFilterVariables();
        }
      }
    });

    // Update breadcrumb after each navigation (BreadCrumbService recreates items on NavigationEnd)
    if (this.breadCrumbService) {
      this.navigationSubscription = this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe(() => {
          const name = this.config().name;
          if (name) {
            this.breadCrumbService!.updateBreadcrumbLabels({ name });
          }
        });
    }
  }

  /**
   * Updates the breadcrumb with the current MeshBoard name.
   */
  private updateBreadcrumb(): void {
    const name = this.config().name;
    if (name && this.breadCrumbService) {
      this.breadCrumbService.updateBreadcrumbLabels({ name });
    }
  }

  /**
   * Updates the URL to include the current MeshBoard rtId.
   * Preserves existing query parameters.
   */
  private updateUrlWithRtId(rtId: string): void {
    const currentUrl = this.router.url;
    const hasRtIdParam = this.route.snapshot.paramMap.has('rtId');

    // Split off query string to preserve it
    const [pathPart, queryPart] = currentUrl.split('?');
    const querySuffix = queryPart ? '?' + queryPart : '';

    if (hasRtIdParam) {
      // Replace the last URL segment (the old rtId) with the new one
      const lastSlashIndex = pathPart.lastIndexOf('/');
      const newPath = pathPart.substring(0, lastSlashIndex + 1) + rtId;
      this.router.navigateByUrl(newPath + querySuffix, { replaceUrl: true });
    } else {
      // Append the rtId to the current URL
      this.router.navigateByUrl(`${pathPart}/${rtId}${querySuffix}`, { replaceUrl: true });
    }
  }

  async ngOnInit(): Promise<void> {
    // Reset edit mode state when entering the page to clear any lingering state from previous sessions
    this.editModeService.reset();

    try {
      // Get rtId from route parameter
      const rtIdFromRoute = this.route.snapshot.paramMap.get('rtId');
      // Get meshBoardWellKnownName from route data (for pre-configured routes)
      const wellKnownName = this.route.snapshot.data['meshBoardWellKnownName'] as string | undefined;
      const readonly = this.route.snapshot.data['meshBoardReadonly'] as boolean | undefined;
      this._isReadonly.set(readonly === true);
      const hideEntitySelectors = this.route.snapshot.data['meshBoardHideEntitySelectors'] as boolean | undefined;
      this._hideEntitySelectors.set(hideEntitySelectors === true);
      const labels = this.route.snapshot.data['timeRangeLabels'] as TimeRangePickerLabels | undefined;
      if (labels) this.timeRangeLabels.set(labels);

      if (rtIdFromRoute) {
        // Load specific MeshBoard from URL parameter
        this.lastNavigatedRtId = rtIdFromRoute;
        await this.loadMeshBoardById(rtIdFromRoute);
      } else if (wellKnownName) {
        // Load MeshBoard by well-known name from route data
        const widgets = await this.stateService.switchToMeshBoardByWellKnownName(wellKnownName);
        if (widgets) {
          await this.preloadWidgetData(widgets);
        } else {
          // Show error if MeshBoard with well-known name not found
          this._notFoundError.set(`MeshBoard '${wellKnownName}' not found. Please create a MeshBoard with this Well-Known Name.`);
        }
      } else {
        // Load initial MeshBoard (first available)
        const widgets = await this.stateService.loadInitialMeshBoard();
        await this.preloadWidgetData(widgets);
      }

      // Initialize time filter variables if enabled with stored selection
      this.initializeTimeFilterVariables();

      // Initialize entity selectors from URL params, route data, or defaults
      await this.initializeEntitySelectors();

      // Mark initial load as complete so the effect can handle subsequent board switches
      this.initialLoadComplete = true;

      // Update breadcrumb with MeshBoard name
      this.updateBreadcrumb();

      this._isInitialized.set(true);
    } catch (err) {
      console.error('Error initializing MeshBoard view:', err);
      this._isInitialized.set(true);
    }
  }

  /**
   * Loads a specific MeshBoard by its rtId.
   */
  private async loadMeshBoardById(rtId: string): Promise<void> {
    // First ensure model is available and get list of meshboards
    const widgets = await this.stateService.loadInitialMeshBoard();

    // Check if the requested MeshBoard exists
    const meshBoards = this.stateService.availableMeshBoards();
    const exists = meshBoards.some(mb => mb.rtId === rtId);

    if (exists) {
      // Switch to the requested MeshBoard
      const switchedWidgets = await this.stateService.switchToMeshBoard(rtId);
      await this.preloadWidgetData(switchedWidgets);
    } else {
      // MeshBoard not found - use whatever was loaded initially
      console.warn(`MeshBoard with rtId ${rtId} not found, using default`);
      await this.preloadWidgetData(widgets);
    }
  }

  ngOnDestroy(): void {
    this.closeConfigDialog();
    this.navigationSubscription?.unsubscribe();
  }

  /**
   * Preloads data for all widgets to improve initial rendering performance.
   */
  private async preloadWidgetData(widgets: AnyWidgetConfig[]): Promise<void> {
    const promises = widgets.map(widget => {
      if (widget.dataSource.type === 'runtimeEntity') {
        return this.dataService.fetchData(widget.dataSource).toPromise();
      }
      if (widget.dataSource.type === 'aggregation') {
        return this.dataService.fetchAggregations(widget.dataSource.queries);
      }
      if (widget.dataSource.type === 'constructionKitQuery') {
        return this.dataService.fetchCkQueryData(widget.dataSource);
      }
      return Promise.resolve(null);
    });

    await Promise.all(promises);
  }

  /**
   * Initializes time filter variables based on URL query params or stored selection.
   * URL params take precedence over stored selection to support page reload.
   */
  private initializeTimeFilterVariables(): void {
    const timeFilter = this.stateService.getTimeFilterConfig();
    if (!timeFilter?.enabled) {
      return;
    }

    // Check URL query params first (takes precedence over stored selection)
    const urlSelection = this.readTimeFilterFromUrl();

    if (urlSelection) {
      // Signal the URL selection so the picker picks it up
      this._urlTimeSelection.set(urlSelection);
      // Update state so widgets use the URL-derived time range
      const sharedSelection = this.toSharedSelection(urlSelection);
      const showTime = timeFilter.pickerConfig?.showTime ?? false;
      const range = TimeRangeUtils.getTimeRangeFromSelection(sharedSelection, showTime);
      if (range) {
        const rangeISO = TimeRangeUtils.toISO(range);
        this.stateService.updateTimeFilterSelection(urlSelection, rangeISO.from, rangeISO.to);
      }
      return;
    }

    // Fall back to stored selection, then default selection
    const selection = timeFilter.selection ?? timeFilter.defaultSelection;
    if (!selection) {
      return;
    }

    // If using defaultSelection (no stored selection yet), apply it as the active selection
    if (!timeFilter.selection && timeFilter.defaultSelection) {
      this._urlTimeSelection.set(selection);
      const sharedSelection = this.toSharedSelection(selection);
      const showTime = timeFilter.pickerConfig?.showTime ?? false;
      const range = TimeRangeUtils.getTimeRangeFromSelection(sharedSelection, showTime);
      if (range) {
        const rangeISO = TimeRangeUtils.toISO(range);
        this.stateService.updateTimeFilterSelection(selection, rangeISO.from, rangeISO.to);
      }
      return;
    }

    const sharedSelection = this.toSharedSelection(selection);
    const showTime = timeFilter.pickerConfig?.showTime ?? false;
    const range = TimeRangeUtils.getTimeRangeFromSelection(sharedSelection, showTime);
    if (!range) {
      return;
    }

    const rangeISO = TimeRangeUtils.toISO(range);
    this.stateService.setTimeFilterVariables(rangeISO.from, rangeISO.to);
  }

  /**
   * Converts a TimeRangeSelection to a SharedTimeRangeSelection.
   */
  private toSharedSelection(selection: TimeRangeSelection): SharedTimeRangeSelection {
    return {
      ...selection,
      customFrom: selection.customFrom ? new Date(selection.customFrom) : undefined,
      customTo: selection.customTo ? new Date(selection.customTo) : undefined
    } as SharedTimeRangeSelection;
  }

  /**
   * Gets the component type for a widget based on its type.
   */
  getWidgetComponentType(type: WidgetType): Type<unknown> | undefined {
    return this.widgetRegistry.getWidgetComponent(type);
  }

  /**
   * Toggles edit mode.
   */
  toggleEditMode(): void {
    const currentConfig = this.stateService.getConfig();
    this.editModeService.toggleEditMode(currentConfig);
  }

  /**
   * Cancels edit mode and restores original state.
   */
  cancelEdit(): void {
    const restored = this.editModeService.cancelEdit<MeshBoardConfig>();
    if (restored) {
      this.stateService.setConfig(restored);
    }
  }

  /**
   * Opens the settings dialog.
   */
  async openSettings(): Promise<void> {
    const size = this.windowStateService.resolveWindowSize('meshboard-settings', { width: 1000, height: 750 });

    const windowRef = this.windowService.open({
      content: MeshBoardSettingsDialogComponent,
      title: 'MeshBoard Settings',
      width: size.width,
      height: size.height,
      minWidth: 850,
      minHeight: 550,
      resizable: true
    });

    this.windowStateService.applyModalBehavior('meshboard-settings', windowRef);

    const contentRef = windowRef.content as { instance?: MeshBoardSettingsDialogComponent } | undefined;
    if (contentRef?.instance) {
      const currentSettings = this.stateService.getCurrentSettings();
      contentRef.instance.setInitialValues(currentSettings);
    }

    try {
      const result = await firstValueFrom(windowRef.result);

      if (result instanceof WindowCloseResult) {
        return;
      }

      if (result && typeof result === 'object' && 'name' in result && 'columns' in result) {
        const settingsResult = result as MeshBoardSettingsResult;
        this.stateService.updateSettings({
          ...settingsResult,
          entitySelectors: settingsResult.entitySelectors
        });

        // Enter edit mode if not already in it
        if (!this.isEditMode()) {
          this.editModeService.enterEditMode(this.stateService.getConfig());
        }
      }
    } catch {
      // Window was closed without action
    }
  }

  /**
   * Opens the add widget dialog.
   */
  async openAddWidget(): Promise<void> {
    const dialogRef = this.dialogService.open({
      content: AddWidgetDialogComponent,
      title: 'Add Widget',
      width: 600
    });

    try {
      // Use firstValueFrom to properly await the Observable
      const result = await firstValueFrom(dialogRef.result);

      if (result && typeof result === 'object' && 'widgetType' in result) {
        const widgetType = result.widgetType as WidgetType;
        this.addWidget(widgetType);
      }
    } catch {
      // Dialog was closed without action
    }
  }

  /**
   * Opens the MeshBoard manager dialog.
   */
  async openManager(): Promise<void> {
    const dialogRef = this.dialogService.open({
      content: MeshBoardManagerDialogComponent,
      title: 'Manage MeshBoards',
      width: 700,
      height: 500
    });

    // Pass the tenantIdProvider to the dialog component instance
    const dialogInstance = dialogRef.content.instance as MeshBoardManagerDialogComponent;
    if (this.tenantIdProvider && dialogInstance) {
      dialogInstance.externalTenantIdProvider = this.tenantIdProvider;
    }
  }

  /**
   * Adds a widget to the MeshBoard.
   */
  private addWidget(type: WidgetType): void {
    const config = this.stateService.getConfig();
    const defaultSize = this.widgetRegistry.getDefaultSize(type);

    // Find a free position in the grid
    const position = this.findFreePosition(config.widgets, config.columns, defaultSize);

    const widget = this.widgetFactory.createWidget({
      type,
      title: `New ${type} Widget`,
      col: position.col,
      row: position.row,
      colSpan: defaultSize.colSpan,
      rowSpan: defaultSize.rowSpan
    });

    this.stateService.addWidget(widget);

    // Enter edit mode if not already in it
    if (!this.isEditMode()) {
      this.editModeService.enterEditMode(this.stateService.getConfig());
    }
  }

  /**
   * Finds a free position in the grid for a new widget.
   */
  private findFreePosition(
    widgets: AnyWidgetConfig[],
    columns: number,
    size: { colSpan: number; rowSpan: number }
  ): { col: number; row: number } {
    // Simple algorithm: find the first free slot
    let row = 1;
    let col = 1;

    while (this.isPositionOccupied(widgets, col, row, size.colSpan, size.rowSpan)) {
      col++;
      if (col + size.colSpan - 1 > columns) {
        col = 1;
        row++;
      }
    }

    return { col, row };
  }

  /**
   * Checks if a position is occupied by existing widgets.
   */
  private isPositionOccupied(
    widgets: AnyWidgetConfig[],
    col: number,
    row: number,
    colSpan: number,
    rowSpan: number
  ): boolean {
    return widgets.some(widget => {
      const widgetEndCol = widget.col + widget.colSpan - 1;
      const widgetEndRow = widget.row + widget.rowSpan - 1;
      const newEndCol = col + colSpan - 1;
      const newEndRow = row + rowSpan - 1;

      return (
        col <= widgetEndCol &&
        newEndCol >= widget.col &&
        row <= widgetEndRow &&
        newEndRow >= widget.row
      );
    });
  }

  /**
   * Saves the MeshBoard.
   */
  async save(): Promise<void> {
    this.editModeService.beginSave();

    try {
      await this.stateService.saveMeshBoard();
      this.editModeService.completeSave();
    } catch (err) {
      console.error('Error saving MeshBoard:', err);
      this.editModeService.failSave();
    }
  }

  /**
   * Refreshes all widget data.
   */
  async refresh(): Promise<void> {
    this.stateService.triggerRefresh();
  }

  /**
   * Programmatically sets an entity selector value from outside the component.
   * Use this when the host application controls entity selection (e.g., with meshBoardHideEntitySelectors).
   * Resolves entity attributes, sets variables, and refreshes widgets.
   */
  async setEntitySelector(selectorId: string, rtId: string, displayName?: string): Promise<void> {
    const selector = this.stateService.getEntitySelector(selectorId);
    if (!selector) {
      console.warn(`Entity selector '${selectorId}' not found`);
      return;
    }

    // Update selection state
    this.stateService.updateEntitySelectorSelection(selectorId, rtId, displayName);

    // Fetch entity and set variables from attribute mappings
    const resolvedName = await this.resolveEntitySelectorVariables(selector, rtId);
    if (resolvedName && !displayName) {
      this.stateService.updateEntitySelectorSelection(selectorId, rtId, resolvedName);
    }

    // Refresh widgets
    this.stateService.triggerRefresh();
  }

  /**
   * Programmatically clears an entity selector value from outside the component.
   */
  clearEntitySelector(selectorId: string): void {
    this.stateService.updateEntitySelectorSelection(selectorId, undefined);
    this.stateService.clearEntitySelectorVariables(selectorId);
    this.stateService.triggerRefresh();
  }

  /** Resolution errors for runtime entity variables */
  readonly variableResolutionErrors = this.stateService.variableResolutionErrors;

  // ============================================================================
  // Time Filter Event Handlers
  // ============================================================================

  /**
   * Handles time range change from the time range picker.
   * No-op: refresh is triggered by onTimeSelectionChange to ensure variables are updated first.
   */
  onTimeRangeChange(_range: TimeRange): void {
    // Intentionally empty — refresh is handled in onTimeSelectionChange
    // to avoid a race condition where widgets refresh before the new
    // time filter variables ($timeRangeFrom/$timeRangeTo) are set.
  }

  /**
   * Handles time selection change from the time range picker.
   * Updates the time filter variables, persists the selection, syncs to URL, and triggers refresh.
   */
  async onTimeSelectionChange(sharedSelection: SharedTimeRangeSelection): Promise<void> {
    // Convert shared-ui selection to our model
    const selection: TimeRangeSelection = {
      type: sharedSelection.type,
      year: sharedSelection.year,
      quarter: sharedSelection.quarter,
      month: sharedSelection.month,
      day: sharedSelection.day,
      hourFrom: sharedSelection.hourFrom,
      hourTo: sharedSelection.hourTo,
      relativeValue: sharedSelection.relativeValue,
      relativeUnit: sharedSelection.relativeUnit,
      customFrom: sharedSelection.customFrom?.toISOString(),
      customTo: sharedSelection.customTo?.toISOString()
    };

    // Check if the selection has actually changed to prevent infinite loop
    // (TimeRangePicker emits selectionChange on init and when initialSelection changes)
    const currentSelection = this.stateService.getTimeFilterConfig()?.selection;
    if (currentSelection && this.isSelectionEqual(currentSelection, selection)) {
      return;
    }

    // Calculate the time range from the selection
    const showTime = this.stateService.getTimeFilterConfig()?.pickerConfig?.showTime ?? false;
    const range = TimeRangeUtils.getTimeRangeFromSelection(sharedSelection, showTime);
    if (!range) return;

    // Convert to ISO strings
    const rangeISO = TimeRangeUtils.toISO(range);

    // Update state with new selection and time range values (sets variables first)
    this.stateService.updateTimeFilterSelection(selection, rangeISO.from, rangeISO.to);

    // Sync selection to URL query parameters and update the URL signal
    // so that the initialTimeSelection computed reflects the new state
    // (otherwise the stale URL selection keeps overriding the picker)
    this._urlTimeSelection.set(selection);
    this.writeTimeFilterToUrl(selection);

    // Refresh widgets now that variables are up to date
    await this.refresh();
  }

  /**
   * Resets the time filter to the configured default selection.
   * Clears the stored selection and applies the default.
   */
  resetTimeFilterToDefault(): void {
    const config = this.timeFilterConfig();
    if (!config?.defaultSelection) return;

    const defaultSel = config.defaultSelection;
    const sharedSelection = this.toSharedSelection(defaultSel);
    const showTime = config.pickerConfig?.showTime ?? false;
    const range = TimeRangeUtils.getTimeRangeFromSelection(sharedSelection, showTime);
    if (!range) return;

    const rangeISO = TimeRangeUtils.toISO(range);
    this.stateService.updateTimeFilterSelection(defaultSel, rangeISO.from, rangeISO.to);
    this._urlTimeSelection.set(defaultSel);
    this.writeTimeFilterToUrl(defaultSel);
  }

  /**
   * Writes the time filter selection to URL query parameters.
   * Only writes params relevant to the current type, clears all others.
   */
  private writeTimeFilterToUrl(selection: TimeRangeSelection): void {
    // Start with all params cleared
    const cleanParams: Record<string, string | null> = {
      tf_type: selection.type,
      tf_year: null,
      tf_quarter: null,
      tf_month: null,
      tf_day: null,
      tf_hf: null,
      tf_ht: null,
      tf_rv: null,
      tf_ru: null,
      tf_from: null,
      tf_to: null
    };

    // Set only the params relevant to the current type
    switch (selection.type) {
      case 'year':
        if (selection.year != null) cleanParams['tf_year'] = selection.year.toString();
        break;
      case 'quarter':
        if (selection.year != null) cleanParams['tf_year'] = selection.year.toString();
        if (selection.quarter != null) cleanParams['tf_quarter'] = selection.quarter.toString();
        break;
      case 'month':
        if (selection.year != null) cleanParams['tf_year'] = selection.year.toString();
        if (selection.month != null) cleanParams['tf_month'] = selection.month.toString();
        break;
      case 'day':
        if (selection.year != null) cleanParams['tf_year'] = selection.year.toString();
        if (selection.month != null) cleanParams['tf_month'] = selection.month.toString();
        if (selection.day != null) cleanParams['tf_day'] = selection.day.toString();
        if (selection.hourFrom != null) cleanParams['tf_hf'] = selection.hourFrom.toString();
        if (selection.hourTo != null) cleanParams['tf_ht'] = selection.hourTo.toString();
        break;
      case 'relative':
        if (selection.relativeValue != null) cleanParams['tf_rv'] = selection.relativeValue.toString();
        if (selection.relativeUnit) cleanParams['tf_ru'] = selection.relativeUnit;
        break;
      case 'custom':
        if (selection.customFrom) cleanParams['tf_from'] = selection.customFrom;
        if (selection.customTo) cleanParams['tf_to'] = selection.customTo;
        break;
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: cleanParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  /**
   * Reads the time filter selection from URL query parameters.
   * Returns null if no time filter params are present.
   */
  private readTimeFilterFromUrl(): TimeRangeSelection | null {
    const params = this.route.snapshot.queryParamMap;
    const type = params.get('tf_type');
    if (!type) return null;

    return {
      type: type as TimeRangeSelection['type'],
      year: params.has('tf_year') ? Number(params.get('tf_year')) : undefined,
      quarter: params.has('tf_quarter') ? Number(params.get('tf_quarter')) as TimeRangeSelection['quarter'] : undefined,
      month: params.has('tf_month') ? Number(params.get('tf_month')) : undefined,
      day: params.has('tf_day') ? Number(params.get('tf_day')) : undefined,
      hourFrom: params.has('tf_hf') ? Number(params.get('tf_hf')) : undefined,
      hourTo: params.has('tf_ht') ? Number(params.get('tf_ht')) : undefined,
      relativeValue: params.has('tf_rv') ? Number(params.get('tf_rv')) : undefined,
      relativeUnit: params.get('tf_ru') as TimeRangeSelection['relativeUnit'] ?? undefined,
      customFrom: params.get('tf_from') ?? undefined,
      customTo: params.get('tf_to') ?? undefined
    };
  }

  /**
   * Compares two TimeRangeSelection objects for equality.
   */
  private isSelectionEqual(a: TimeRangeSelection, b: TimeRangeSelection): boolean {
    return (
      a.type === b.type &&
      a.year === b.year &&
      a.quarter === b.quarter &&
      a.month === b.month &&
      a.day === b.day &&
      a.hourFrom === b.hourFrom &&
      a.hourTo === b.hourTo &&
      a.relativeValue === b.relativeValue &&
      a.relativeUnit === b.relativeUnit &&
      a.customFrom === b.customFrom &&
      a.customTo === b.customTo
    );
  }

  /**
   * Duplicates a widget with all its settings.
   * Creates a deep copy with a new ID and places it in the next free position.
   */
  duplicateWidget(widget: AnyWidgetConfig): void {
    const config = this.stateService.getConfig();
    const newId = this.widgetFactory.generateId();
    const position = this.findFreePosition(config.widgets, config.columns, {
      colSpan: widget.colSpan,
      rowSpan: widget.rowSpan
    });

    const duplicate: AnyWidgetConfig = JSON.parse(JSON.stringify(widget));
    duplicate.id = newId;
    duplicate.rtId = undefined;
    duplicate.col = position.col;
    duplicate.row = position.row;
    duplicate.title = `${widget.title} (Copy)`;

    this.stateService.addWidget(duplicate);

    // Enter edit mode if not already in it
    if (!this.isEditMode()) {
      this.editModeService.enterEditMode(this.stateService.getConfig());
    }
  }

  /**
   * Removes a widget from the MeshBoard.
   */
  removeWidget(widgetId: string): void {
    this.stateService.removeWidget(widgetId);

    // Enter edit mode if not already in it
    if (!this.isEditMode()) {
      this.editModeService.enterEditMode(this.stateService.getConfig());
    }
  }

  /**
   * Opens the configuration dialog for a widget.
   * Uses the WidgetRegistryService to open a resizable Kendo Window.
   */
  openWidgetConfig(widget: AnyWidgetConfig): void {
    const registration = this.widgetRegistry.getRegistration(widget.type);
    if (!registration?.configDialogComponent) {
      console.warn(`No config dialog for widget type: ${widget.type}`);
      return;
    }

    // Close any existing config dialog
    this.closeConfigDialog();

    this.configDialogSubscription = this.widgetRegistry.openConfigDialog(widget).subscribe(dialogResult => {
      if (dialogResult.saved && dialogResult.result && registration.applyConfigResult) {
        const updatedWidget = registration.applyConfigResult(widget, dialogResult.result);
        this.stateService.updateWidget(widget.id, () => updatedWidget);

        // Enter edit mode if not already in it
        if (!this.isEditMode()) {
          this.editModeService.enterEditMode(this.stateService.getConfig());
        }
      }
    });
  }

  /**
   * Closes the configuration dialog if open.
   */
  private closeConfigDialog(): void {
    if (this.configDialogSubscription) {
      this.configDialogSubscription.unsubscribe();
      this.configDialogSubscription = null;
    }
  }

  /**
   * Handles TileLayout reorder events.
   */
  onReorder(event: { newIndex: number; oldIndex: number }): void {
    // TileLayout handles the DOM reordering, we just need to update our state
    const config = this.stateService.getConfig();
    const widgets = [...config.widgets];
    const [movedWidget] = widgets.splice(event.oldIndex, 1);
    widgets.splice(event.newIndex, 0, movedWidget);

    this.stateService.updateConfig(c => ({ ...c, widgets }));

    // Enter edit mode if not already in it
    if (!this.isEditMode()) {
      this.editModeService.enterEditMode(this.stateService.getConfig());
    }
  }

  /**
   * Handles TileLayout resize events.
   */
  onResize(event: TileLayoutResizeEvent): void {
    // Extract the resized item from the event
    const item = event.item;

    // Find the widget in our config that matches this item
    const config = this.stateService.getConfig();
    const widgetIndex = config.widgets.findIndex(w =>
      w.col === item.col && w.row === item.row
    );

    if (widgetIndex !== -1) {
      const widget = config.widgets[widgetIndex];

      // Update the widget configuration with new size
      this.stateService.updateWidget(widget.id, w => ({
        ...w,
        col: item.col,
        row: item.row,
        colSpan: item.colSpan,
        rowSpan: item.rowSpan
      }));

      // Enter edit mode if not already in it
      if (!this.isEditMode()) {
        this.editModeService.enterEditMode(this.stateService.getConfig());
      }
    }
  }

  /**
   * Track by function for widget rendering.
   */
  trackByWidgetId(_index: number, widget: AnyWidgetConfig): string {
    return widget.id;
  }

  /**
   * Checks if a widget is unconfigured (needs data source setup).
   */
  isWidgetUnconfigured(widget: AnyWidgetConfig): boolean {
    const dataSource = widget.dataSource;

    if (dataSource.type === 'runtimeEntity') {
      return !dataSource.rtId && !dataSource.ckTypeId;
    }
    if (dataSource.type === 'persistentQuery') {
      return !dataSource.queryRtId;
    }
    if (dataSource.type === 'repeaterQuery') {
      // Widget Group needs either a query or a CK type
      return !dataSource.queryRtId && !dataSource.ckTypeId;
    }
    return false;
  }

  /**
   * Checks if a widget type supports configuration.
   */
  supportsConfiguration(widget: AnyWidgetConfig): boolean {
    const registration = this.widgetRegistry.getRegistration(widget.type);
    return !!registration?.configDialogComponent;
  }

  /**
   * Opens the edit widget dialog for position/size editing.
   */
  openEditWidgetDialog(widget: AnyWidgetConfig): void {
    this.editingWidget = widget;
    this.showEditWidgetDialog = true;
  }

  /**
   * Handles save from the edit widget dialog.
   */
  onEditWidgetSave(update: WidgetPositionUpdate): void {
    this.stateService.updateWidget(update.id, w => ({
      ...w,
      title: update.title,
      col: update.col,
      row: update.row,
      colSpan: update.colSpan,
      rowSpan: update.rowSpan
    }));

    this.closeEditWidgetDialog();

    // Enter edit mode if not already in it
    if (!this.isEditMode()) {
      this.editModeService.enterEditMode(this.stateService.getConfig());
    }
  }

  /**
   * Closes the edit widget dialog.
   */
  closeEditWidgetDialog(): void {
    this.showEditWidgetDialog = false;
    this.editingWidget = null;
  }

  // ============================================================================
  // Entity Selector Event Handlers
  // ============================================================================

  /**
   * Handles entity selection from the entity selector toolbar.
   * Fetches entity attributes, sets variables, syncs to URL, and refreshes widgets.
   */
  async onEntitySelectorSelected(event: EntitySelectorEvent): Promise<void> {
    const { selectorId, entity } = event;
    const selector = this.stateService.getEntitySelector(selectorId);
    if (!selector) return;

    // Update selector selection state
    this.stateService.updateEntitySelectorSelection(selectorId, entity.rtId, entity.displayName);

    // Fetch entity and set variables from attribute mappings
    await this.resolveEntitySelectorVariables(selector, entity.rtId);

    // Sync to URL
    this.writeEntitySelectorsToUrl();

    // Refresh widgets
    this.stateService.triggerRefresh();
  }

  /**
   * Handles entity cleared from the entity selector toolbar.
   * Clears variables, syncs URL, and refreshes widgets.
   */
  async onEntitySelectorCleared(event: EntitySelectorClearEvent): Promise<void> {
    const { selectorId } = event;

    // Clear selection state
    this.stateService.updateEntitySelectorSelection(selectorId, undefined);

    // Clear variables for this selector
    this.stateService.clearEntitySelectorVariables(selectorId);

    // Sync to URL
    this.writeEntitySelectorsToUrl();

    // Refresh widgets
    this.stateService.triggerRefresh();
  }

  /**
   * Initializes entity selectors from URL params, route data, or defaults.
   */
  private async initializeEntitySelectors(): Promise<void> {
    const selectors = this.stateService.getEntitySelectors();
    if (selectors.length === 0) return;

    // Read URL params
    const urlSelections = this.readEntitySelectorsFromUrl();
    // Read route data
    const routeData = this.route.snapshot.data['entitySelectors'] as Record<string, string> | undefined;

    for (const selector of selectors) {
      // Priority: route data > URL params > defaultRtId
      const rtId = routeData?.[selector.id]
        ?? urlSelections.get(selector.id)
        ?? selector.defaultRtId;

      if (rtId) {
        const displayName = await this.resolveEntitySelectorVariables(selector, rtId);
        this.stateService.updateEntitySelectorSelection(selector.id, rtId, displayName);
      }
    }
  }

  /**
   * Resolves variables for an entity selector by fetching entity attributes.
   */
  private async resolveEntitySelectorVariables(selector: EntitySelectorConfig, rtId: string): Promise<string | undefined> {
    try {
      const entity = await firstValueFrom(
        this.dataService.fetchRuntimeEntity({
          type: 'runtimeEntity',
          ckTypeId: selector.ckTypeId,
          rtId
        })
      );

      if (!entity) {
        console.warn(`Entity not found for selector '${selector.id}': ${rtId}`);
        return undefined;
      }

      const values = selector.attributeMappings.map(mapping => {
        const attr = entity.attributes.find(a => a.attributeName === mapping.attributePath);
        return {
          name: mapping.variableName,
          value: attr ? String(attr.value ?? '') : '',
          type: mapping.attributeValueType
            ? this.variableService.mapAttributeTypeToVariableType(mapping.attributeValueType)
            : 'string'
        };
      });

      this.stateService.setEntitySelectorVariables(selector.id, values);

      return entity.rtWellKnownName || entity.rtId;
    } catch (error) {
      console.error(`Error resolving entity selector '${selector.id}':`, error);
      return undefined;
    }
  }

  /**
   * Writes entity selector selections to URL query parameters.
   * Format: es_<selectorId>=<rtId>
   */
  private writeEntitySelectorsToUrl(): void {
    const selectors = this.stateService.getEntitySelectors();
    const params: Record<string, string | null> = {};

    for (const selector of selectors) {
      params[`es_${selector.id}`] = selector.selectedRtId ?? null;
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  /**
   * Reads entity selector selections from URL query parameters.
   * Returns a map of selectorId -> rtId.
   */
  private readEntitySelectorsFromUrl(): Map<string, string> {
    const params = this.route.snapshot.queryParamMap;
    const result = new Map<string, string>();

    for (const key of params.keys) {
      if (key.startsWith('es_')) {
        const selectorId = key.substring(3);
        const value = params.get(key);
        if (value) {
          result.set(selectorId, value);
        }
      }
    }

    return result;
  }

  // === HasUnsavedChanges interface implementation ===

  /**
   * Checks if there are unsaved changes in the MeshBoard.
   * Returns true if in edit mode with a snapshot (indicating changes).
   */
  hasUnsavedChanges(): boolean {
    return this.editModeService.hasUnsavedChanges();
  }

  /**
   * Saves the MeshBoard and returns true if successful.
   * This is called by the UnsavedChangesGuard when the user chooses to save.
   */
  async saveChanges(): Promise<boolean> {
    try {
      await this.save();
      return true;
    } catch {
      return false;
    }
  }
}
