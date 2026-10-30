import { Component, OnInit, inject, signal, computed, Type, OnDestroy, effect, ViewChild, ChangeDetectionStrategy, ElementRef, NgZone, input, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule, NavigationEnd } from '@angular/router';
import { urlWithoutEditParam, wantsEditModeFromUrl } from '../../utils/edit-mode-url';
import { MESHBOARD_HEADER_MODE_ROUTE_DATA, MeshBoardHeaderMode, resolveMeshBoardHeaderMode } from '../../utils/meshboard-header';
import { MESHBOARD_CHROME_ROUTE_DATA, MeshBoardChrome, resolveMeshBoardChrome } from '../../utils/meshboard-chrome';
import { TileLayoutModule, TileLayoutComponent, TileLayoutReorderEvent, TileLayoutResizeEvent } from '@progress/kendo-angular-layout';
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
  gridLayoutIcon,
  undoIcon,
  infoCircleIcon,
  arrowUpIcon,
  arrowDownIcon
} from '@progress/kendo-svg-icons';

import { HostTimeRangeState, MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { EditModeStateService } from '../../services/edit-mode-state.service';
import { WidgetFactoryService } from '../../services/widget-factory.service';
import { WidgetRegistryService } from '../../services/widget-registry.service';
import { MeshBoardDataService } from '../../services/meshboard-data.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { AutoRefreshTimerService } from '../../services/auto-refresh-timer.service';
import { AnyWidgetConfig, WidgetType, MeshBoardConfig, TimeRangeSelection, EntitySelectorConfig, RuntimeEntityData } from '../../models/meshboard.models';
import { compactTierForWidth, columnsForTier, placeWidgetsForTier, collapseEmptyRows } from '../../utils/compact-layout';
import { buildUrlWithRtId, buildInitialUrlWithRtId } from '../../utils/url-sync';
import { applyTimeFilterParams, applyQueryParams } from '../../utils/time-filter-url';
import { injectMeshBoardMessages } from '../../utils/meshboard-messages';
import {
  MeshBoardHostTimeRange,
  MeshBoardTimeFilterControl,
  parseHostTimeRange,
  sameHostTimeRange
} from './host-time-range';
import { MeshBoardSettingsDialogComponent, MeshBoardSettingsResult } from '../../dialogs/meshboard-settings-dialog/meshboard-settings-dialog.component';
import {
  EntitySelectorToolbarComponent,
  EntitySelectorEvent,
  EntitySelectorClearEvent
} from '../../components/entity-selector-toolbar/entity-selector-toolbar.component';
import {
  effectiveSelector,
  followersOf,
  isFollowerSelector,
  resolveFollowLeader,
  showsInToolbar
} from '../../utils/entity-selector-follow';
import { resolveScopePath, scopePlan } from '../../utils/entity-selector-scope-path';
import { dependentsOf, resolveScopeSource } from '../../utils/entity-selector-scope-source';
import { AddWidgetDialogComponent } from '../../dialogs/add-widget-dialog/add-widget-dialog.component';
import { MeshBoardEmptyStateComponent } from '../../components/meshboard-empty-state/meshboard-empty-state.component';
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
  WindowStateService,
  MM_ACTION_ICONS
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
    EntitySelectorToolbarComponent,
    MeshBoardEmptyStateComponent
  ],
  hostDirectives: [UnsavedChangesDirective],
  providers: [
    { provide: HAS_UNSAVED_CHANGES, useExisting: MeshBoardViewComponent },
    AutoRefreshTimerService
  ],
  templateUrl: './meshboard-view.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
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
  private readonly autoRefreshTimer = inject(AutoRefreshTimerService);
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
  protected readonly trashIcon = MM_ACTION_ICONS.delete;
  protected readonly gridLayoutIcon = gridLayoutIcon;
  protected readonly undoIcon = undoIcon;
  /** Duplicate widget (canonical duplicate icon, AB#5580). */
  protected readonly copyIcon = MM_ACTION_ICONS.duplicate;
  protected readonly infoCircleIcon = infoCircleIcon;
  protected readonly arrowUpIcon = arrowUpIcon;
  protected readonly arrowDownIcon = arrowDownIcon;

  @ViewChild(TileLayoutComponent) private tileLayout?: TileLayoutComponent;

  // Edit widget dialog state
  protected showEditWidgetDialog = false;
  protected editingWidget: AnyWidgetConfig | null = null;

  // Config dialog state
  private configDialogSubscription: Subscription | null = null;
  private navigationSubscription: Subscription | null = null;

  // Auto-refresh polling — timer state lives in AutoRefreshTimerService so the
  // reconcile/restart/pause semantics are testable without a TestBed harness.
  private readonly visibilityListener = () => this.evaluateAutoRefresh();

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

  /**
   * How much of the header the host shows: `full` (default) with name and description,
   * `compact` (controls only, aligned right) or `none` (no header row). A host page that
   * already names the board (e.g. a tab under a greeting) embeds it compact. Overrides the
   * route data `meshBoardHeaderMode`, which routes loading the view directly use.
   */
  readonly headerMode = input<MeshBoardHeaderMode | undefined>(undefined);
  private readonly routeHeaderMode = signal<unknown>(undefined);
  protected readonly effectiveHeaderMode = computed(() =>
    resolveMeshBoardHeaderMode(this.headerMode(), this.routeHeaderMode()));

  /**
   * Whether the view draws its own outer frame: `framed` (default) paints the view background,
   * the header bar and the grid padding; `plain` leaves all three to the host page, so the
   * widgets sit on the host surface and align with its gutter (widget frames and the gap between
   * widgets unchanged). Overrides the route data `meshBoardChrome`.
   */
  readonly chrome = input<MeshBoardChrome | undefined>(undefined);
  private readonly routeChrome = signal<unknown>(undefined);
  protected readonly effectiveChrome = computed(() =>
    resolveMeshBoardChrome(this.chrome(), this.routeChrome()));

  /**
   * The period set by the host page (AB#7582): two exact instants, half-open `[from, to)`, as
   * `Date` objects or ISO 8601 strings with a zone designator. While set (and the board's time
   * filter is enabled) the view publishes exactly these instants as `$timeRangeFrom` /
   * `$timeRangeTo` and as the stream-data window - no day snapping, no zone conversion - and
   * ignores the `tf_*` query parameters and the stored/default selection. It writes no `tf_*`
   * parameters and causes no unsaved changes. A change reloads the widgets once; `undefined`
   * returns the board to its own selection. Day rules (e.g. a 06:00 gas day) belong to the host.
   * An invalid range (unparseable, or `from >= to`) sends no stream-data query and logs one
   * console error. A board with the time filter disabled ignores the input.
   */
  readonly timeRange = input<MeshBoardHostTimeRange | undefined>(undefined);

  /**
   * Who controls the period: `board` (default, unchanged behaviour) shows the board's time-range
   * picker; `host` hides the picker and its reset button - entity selectors and actions stay.
   * While `timeRange` is set the picker is hidden and its events are ignored either way.
   */
  readonly timeFilterControl = input<MeshBoardTimeFilterControl>('board');

  /** The parsed `timeRange` input; `undefined` = the host sets no period. */
  protected readonly parsedHostTimeRange = computed(() => parseHostTimeRange(this.timeRange()));
  /** True while the host owns the period (a valid or an invalid `timeRange` is set). */
  protected readonly isHostTimeRangeActive = computed(() => this.parsedHostTimeRange() !== undefined);
  /** Whether the board's own time-range picker (and its reset button) is rendered. */
  protected readonly showTimeRangePicker = computed(() =>
    this.isTimeFilterEnabled() && this.timeFilterControl() !== 'host' && !this.isHostTimeRangeActive());
  /** The host range last applied to the state service (to reload only on a real change). */
  private appliedHostTimeRange: HostTimeRangeState | undefined;
  /** The invalid host range already reported, so a board switch does not log it again. */
  private reportedInvalidHostTimeRange: HostTimeRangeState | undefined;
  /**
   * Set once the host has owned the period: the `tf_*` parameters of the URL this view was opened
   * with are stale from then on and are not applied again when `timeRange` goes back to undefined.
   */
  private hostHasOwnedPeriod = false;
  /** Set in ngOnDestroy; the async initial load stops touching shared state after it (AB#7582). */
  private destroyed = false;

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
  /** Widgets shown: outside edit mode those that reported "nothing for this viewer" are collapsed (AB#5558). */
  private readonly visibleWidgets = computed(() => {
    const widgets = this.config().widgets;
    const hidden = this.stateService.hiddenForViewer();
    return this.isEditMode() || hidden.size === 0 ? widgets : collapseEmptyRows(widgets.filter(w => !hidden.has(w.id)));
  });
  protected readonly bannerWidgets = computed(() => this.visibleWidgets().filter(w => w.zone === 'banner'));
  protected readonly gridWidgets = computed(() => this.visibleWidgets().filter(w => w.zone !== 'banner'));
  protected readonly hasGridWidgets = computed(() => this.gridWidgets().length > 0);
  protected readonly canSave = computed(() => this.isEditMode() && !this.isSaving());

  // Compact layout (AB#4353): the TileLayout renders its configured column
  // count at any width, so narrow containers get a presentation-side remap —
  // single column below 700px, at most 3 columns below 1100px, persisted
  // config untouched. Editing stays native-tier-only because drag/resize
  // against remapped positions would corrupt the stored anchors.
  private readonly hostElement = inject(ElementRef<HTMLElement>);
  private readonly ngZone = inject(NgZone);
  private resizeObserver?: ResizeObserver;
  private readonly containerWidth = signal<number | null>(null);
  protected readonly compactTier = computed(() => compactTierForWidth(this.containerWidth()));
  protected readonly displayColumns = computed(() => columnsForTier(this.compactTier(), this.config().columns));
  protected readonly displayAutoFlow = computed(() => this.compactTier() === 'none' ? 'column' as const : 'row' as const);
  protected readonly canEditLayout = computed(() => this.isEditMode() && this.compactTier() === 'none');
  protected readonly displayGridWidgets = computed(() => {
    const tier = this.compactTier();
    const config = this.config();
    // Phone tier (AB#5558): content-sized widgets grow their tile to fit. Native tier outside edit
    // mode (AB#5622): the attention list shrinks to its content, at most its stored rows — edit
    // mode keeps the stored spans so drag/resize never persists a content-fitted size.
    const contentSizing = tier === 'phone' || (tier === 'none' && !this.isEditMode())
      ? { heights: this.stateService.widgetContentHeights(), rowHeight: config.rowHeight, gap: config.gap }
      : undefined;
    return placeWidgetsForTier(this.gridWidgets(), tier, config.columns, contentSizing);
  });

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
  /** Picker scopes of dependent selectors (AB#7915). */
  protected readonly pickerScopes = computed(() => this.stateService.pickerScopes());
  /** Board variables substituted into the selectors' picker filters (AB#7724). */
  protected readonly boardVariables = computed(() => this.stateService.getVariables());
  protected readonly hasEntitySelectors = computed(() =>
    !this.hideEntitySelectors() && (this.entitySelectorsConfig()?.some(es => showsInToolbar(es)) ?? false)
  );
  protected readonly unselectedToolbarSelectors = computed(() => {
    if (this.hideEntitySelectors()) return [];
    const selectors = this.entitySelectorsConfig() ?? [];
    return selectors.filter(es => showsInToolbar(es) && !es.selectedRtId);
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
    this.messages = injectMeshBoardMessages();

    // Effect to sync URL when dashboard changes (after initial load)
    effect(() => {
      const currentRtId = this.stateService.persistedMeshBoardId();
      if (currentRtId && currentRtId !== this.lastNavigatedRtId) {
        this.lastNavigatedRtId = currentRtId;
        if (this.initialLoadComplete) {
          // Only update URL and time filter for post-init board switches (e.g.
          // manager dialog). Time filter first: updateUrlWithRtId serializes
          // the then-active selection into the SAME navigation as the rtId
          // path change — a second concurrent navigation (e.g. the picker's
          // writeTimeFilterToUrl) would supersede the path change and drop the
          // rtId from the URL.
          this.initializeTimeFilterVariables();
          this.updateUrlWithRtId(currentRtId);
        }
      }
    });

    // Host period (AB#7582): apply every change of the timeRange input after the initial load
    // (ngOnInit applies the initial value) and reload the widgets once.
    effect(() => {
      const parsed = this.parsedHostTimeRange();
      if (!this._isInitialized()) {
        return;
      }
      untracked(() => this.onHostTimeRangeChanged(parsed));
    });

    // Effect to re-evaluate the auto-refresh timer whenever the MeshBoard
    // config changes (e.g. user edits autoRefreshSeconds in settings, or a
    // different board is loaded). Re-reads on the same interval skip the
    // restart inside evaluateAutoRefresh().
    effect(() => {
      // Touch the signals we depend on so Angular re-fires the effect.
      const seconds = this.config().autoRefreshSeconds ?? 0;
      void seconds;
      this.evaluateAutoRefresh();
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
   * Updates the URL to include the current MeshBoard rtId, preserving query
   * parameters. Only rewrites the URL when the route can represent the rtId:
   * the route has an `:rtId` param, or the host app opted in with the
   * `meshBoardSyncUrl: true` route data flag (which requires a matching
   * `<path>/:rtId` sibling route). Embedded boards without either stay on
   * their URL — appending would fall through to the app's `'**'` wildcard or
   * fail with a NavigationError (AB#4457).
   */
  private updateUrlWithRtId(rtId: string): void {
    const targetUrl = buildUrlWithRtId({
      currentUrl: this.router.url,
      rtId,
      hasRtIdParam: this.route.snapshot.paramMap.has('rtId'),
      syncUrlOptIn: this.route.snapshot.data['meshBoardSyncUrl'] === true
    });
    if (targetUrl !== null) {
      // One navigation for path + tf_* params: a separate time-filter
      // navigation would supersede this one and drop the rtId path change.
      this.router.navigateByUrl(applyTimeFilterParams(targetUrl, this.activeTimeFilterSelection()), { replaceUrl: true });
    }
  }

  /**
   * The active time-filter selection to mirror into the URL, or null when the filter is off or
   * the host owns the period or controls the filter (AB#7582: the view then writes no tf_*
   * parameters; with `timeFilterControl='host'` and no `timeRange` the board selection still
   * applies, but the URL is the host's).
   */
  private activeTimeFilterSelection(): TimeRangeSelection | null {
    if (this.isHostTimeRangeActive() || this.timeFilterControl() === 'host') {
      return null;
    }
    const config = this.stateService.getTimeFilterConfig();
    return config?.enabled ? config.selection ?? null : null;
  }

  async ngOnInit(): Promise<void> {
    // Track the component's own width for the compact layout tiers. The callback
    // fires outside the Angular zone; re-enter it so the signal update schedules
    // change detection for this OnPush component.
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(entries => {
        const width = entries[entries.length - 1]?.contentRect.width;
        if (width === undefined) {
          return;
        }
        this.ngZone.run(() => this.containerWidth.set(width));
      });
      this.resizeObserver.observe(this.hostElement.nativeElement);
    }

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
      this.routeHeaderMode.set(this.route.snapshot.data[MESHBOARD_HEADER_MODE_ROUTE_DATA]);
      this.routeChrome.set(this.route.snapshot.data[MESHBOARD_CHROME_ROUTE_DATA]);
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
          this.primeEntitySelectorScopes();
          await this.preloadWidgetData(widgets);
        } else {
          // Show error if MeshBoard with well-known name not found
          this._notFoundError.set(`MeshBoard '${wellKnownName}' not found. Please create a MeshBoard with this Well-Known Name.`);
        }
      } else {
        // Load initial MeshBoard (first available)
        const widgets = await this.stateService.loadInitialMeshBoard();
        this.primeEntitySelectorScopes();
        await this.preloadWidgetData(widgets);
      }

      // The view may have been destroyed while the board loaded (e.g. a fast switch on the host
      // page): it must not publish its host period or selection into the root-provided state.
      if (this.destroyed) {
        return;
      }

      // Initialize time filter variables if enabled with stored selection
      this.initializeTimeFilterVariables();

      // Initialize entity selectors from URL params, route data, or defaults
      await this.initializeEntitySelectors();
      if (this.destroyed) {
        return;
      }

      // Mark initial load as complete so the effect can handle subsequent board switches
      this.initialLoadComplete = true;

      // `?edit=1` (e.g. "Edit" in a host's board list) opens the board in edit mode;
      // ignored on read-only routes.
      if (wantsEditModeFromUrl(this.route.snapshot.queryParamMap, this.isReadonly(), this.isEditMode())) {
        this.editModeService.enterEditMode(this.stateService.getConfig());
        // Consume the request: a reload or a copied link must not re-enter edit mode.
        const cleaned = urlWithoutEditParam(this.router.url);
        if (cleaned !== null) {
          void this.router.navigateByUrl(cleaned, { replaceUrl: true });
        }
      }

      // The constructor effect skipped the URL sync during the initial load
      // (and already consumed the rtId via lastNavigatedRtId), so sync once
      // here, after loading settled — the transient board from
      // loadInitialMeshBoard never reaches the URL. Stays a no-op without
      // meshBoardSyncUrl/:rtId (AB#4457) and preserves the query params.
      const initialUrl = buildInitialUrlWithRtId({
        currentUrl: this.router.url,
        loadedRtId: this.stateService.persistedMeshBoardId(),
        rtIdFromRoute,
        hasRtIdParam: this.route.snapshot.paramMap.has('rtId'),
        syncUrlOptIn: this.route.snapshot.data['meshBoardSyncUrl'] === true
      });
      if (initialUrl !== null) {
        this.router.navigateByUrl(applyTimeFilterParams(initialUrl, this.activeTimeFilterSelection()), { replaceUrl: true });
      }

      // Update breadcrumb with MeshBoard name
      this.updateBreadcrumb();

      // Wire visibility-aware auto-refresh. The config-watching effect already
      // re-evaluates on signal changes; this listener handles the tab going
      // background → foreground without a config change.
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', this.visibilityListener);
      }
      this.evaluateAutoRefresh();

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
      this.primeEntitySelectorScopes();
      await this.preloadWidgetData(switchedWidgets);
    } else {
      // MeshBoard not found - use whatever was loaded initially
      console.warn(`MeshBoard with rtId ${rtId} not found, using default`);
      this.primeEntitySelectorScopes();
      await this.preloadWidgetData(widgets);
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    // The state service is root-provided: a host period must not outlive the view that set it.
    // Owner-aware, so a period another view set in the meantime stays. Only a view that set a
    // period clears one (the default path never touches it); a view destroyed while its board was
    // still loading never set one (see the guards after the awaits in ngOnInit).
    if (this.hostHasOwnedPeriod) {
      this.stateService.clearHostTimeRange(this);
    }
    this.resizeObserver?.disconnect();
    this.closeConfigDialog();
    this.navigationSubscription?.unsubscribe();
    this.autoRefreshTimer.stop();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityListener);
    }
  }

  /**
   * Reconciles the auto-refresh timer to the current MeshBoard config and
   * document visibility. Called on init, whenever config changes (via the
   * constructor effect), and whenever tab visibility changes.
   *
   * Pause-on-hidden saves bandwidth and avoids Apollo cache thrashing when
   * the user has the tab in the background.
   */
  private evaluateAutoRefresh(): void {
    const seconds = this.config().autoRefreshSeconds ?? 0;
    const tabVisible = typeof document === 'undefined' || !document.hidden;
    this.autoRefreshTimer.update(seconds, tabVisible, () => void this.refresh());
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
   * A period set by the host (`timeRange`, AB#7582) takes precedence over both.
   */
  private initializeTimeFilterVariables(): void {
    if (this.applyHostTimeRange(this.parsedHostTimeRange())) {
      return;
    }
    const timeFilter = this.stateService.getTimeFilterConfig();
    if (!timeFilter?.enabled) {
      return;
    }

    // Check URL query params first (takes precedence over stored selection). Once the host has
    // owned the period, the tf_* of the opening URL are stale and are not applied again.
    const urlSelection = this.hostHasOwnedPeriod ? null : this.readTimeFilterFromUrl();

    if (urlSelection) {
      // Signal the URL selection so the picker picks it up
      this._urlTimeSelection.set(urlSelection);
      // Update state so widgets use the URL-derived time range
      const sharedSelection = this.toSharedSelection(urlSelection);
      const showTime = timeFilter.pickerConfig?.showTime ?? false;
      const range = TimeRangeUtils.getTimeRangeFromSelection(sharedSelection, showTime, this.stateService.timeZoneMode());
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
      const range = TimeRangeUtils.getTimeRangeFromSelection(sharedSelection, showTime, this.stateService.timeZoneMode());
      if (range) {
        const rangeISO = TimeRangeUtils.toISO(range);
        this.stateService.updateTimeFilterSelection(selection, rangeISO.from, rangeISO.to);
      }
      return;
    }

    const sharedSelection = this.toSharedSelection(selection);
    const showTime = timeFilter.pickerConfig?.showTime ?? false;
    const range = TimeRangeUtils.getTimeRangeFromSelection(sharedSelection, showTime, this.stateService.timeZoneMode());
    if (!range) {
      return;
    }

    const rangeISO = TimeRangeUtils.toISO(range);
    this.stateService.setTimeFilterVariables(rangeISO.from, rangeISO.to);
  }

  /**
   * Hands the host period to the state service and publishes `$timeRangeFrom` / `$timeRangeTo`
   * as exactly its instants (AB#7582). Returns true while the host owns the period, so the
   * caller skips the board's own selection. With the time filter disabled the period is only
   * stored (the state service ignores it then) and nothing is logged.
   */
  private applyHostTimeRange(parsed: HostTimeRangeState | undefined): boolean {
    if (this.destroyed) {
      return parsed !== undefined;
    }
    const previous = this.appliedHostTimeRange;
    this.appliedHostTimeRange = parsed;
    if (!parsed) {
      // Without a host period nothing changes for the board (default path untouched). When the
      // host drops its period, its variables go too; the board's own selection (if any) re-sets them.
      if (previous) {
        this.stateService.clearHostTimeRange(this);
        this.stateService.clearTimeFilterVariables();
      }
      return false;
    }
    this.hostHasOwnedPeriod = true;
    this.stateService.setHostTimeRange(parsed, this);
    if (!this.stateService.isTimeFilterEnabled()) {
      return true;
    }
    if (parsed.status === 'valid') {
      this.stateService.setTimeFilterVariables(parsed.from.toISOString(), parsed.to.toISOString());
    } else {
      this.stateService.clearTimeFilterVariables();
      if (this.reportedInvalidHostTimeRange !== parsed) {
        this.reportedInvalidHostTimeRange = parsed;
        console.error(`mm-meshboard-view: input "timeRange" is invalid (${parsed.reason}); `
          + 'the board sends no stream-data query until the host sets a valid range.');
      }
    }
    return true;
  }

  /**
   * Applies a change of the `timeRange` input after the initial load (AB#7582): the host period,
   * or the board's own selection again when the input went back to `undefined`. Reloads the
   * widgets once; an equal period (same instants) changes nothing.
   */
  private onHostTimeRangeChanged(parsed: HostTimeRangeState | undefined): void {
    if (sameHostTimeRange(parsed, this.appliedHostTimeRange)) {
      return;
    }
    this.initializeTimeFilterVariables();
    if (this.stateService.isTimeFilterEnabled()) {
      this.stateService.triggerRefresh();
    }
  }

  /**
   * Recomputes the active time-filter range from the current selection on the
   * board's (possibly just-changed) timezone mode and republishes the
   * `$timeRangeFrom`/`$timeRangeTo` variables. No-op when the filter is
   * disabled or no selection is active.
   */
  private reapplyTimeFilterRange(): void {
    // A host period (valid or invalid) takes the same path as on every other change.
    if (this.isHostTimeRangeActive()) {
      this.applyHostTimeRange(this.parsedHostTimeRange());
      return;
    }
    const range = this.stateService.resolveCurrentTimeRange();
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

        // The timezone mode and/or default selection may have changed — recompute
        // the active time-filter range on the new basis so $timeRangeFrom/To and
        // every widget's display stay consistent, then reload widget data.
        this.reapplyTimeFilterRange();
        await this.refresh();

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
      maxHeight: '80vh'
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
    if (isFollowerSelector(selector)) {
      // A follower's pick is derived from its leader (AB#7722).
      console.warn(`Entity selector '${selectorId}' follows '${selector.followsSelectorId}' and cannot be set directly`);
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
    const selector = this.stateService.getEntitySelector(selectorId);
    if (selector && isFollowerSelector(selector)) {
      console.warn(`Entity selector '${selectorId}' follows '${selector.followsSelectorId}' and cannot be cleared directly`);
      return;
    }
    this.clearSelectorPick(selectorId);
    // Followers fall back to their own defaultRtId, or to no scope (AB#7722).
    const followers = this.resetFollowersOf(selectorId);
    this.stateService.triggerRefresh();
    if (followers) {
      void followers.then(() => this.stateService.triggerRefresh());
    }
  }

  /**
   * Clears one selector's pick, variables and scope state. Without a pick bound
   * widgets fall back to the persisted scope (AB#7721).
   */
  private clearSelectorPick(selectorId: string): void {
    this.stateService.updateEntitySelectorSelection(selectorId, undefined);
    this.stateService.clearEntitySelectorVariables(selectorId);
    this.scopeRequestSeq.set(selectorId, (this.scopeRequestSeq.get(selectorId) ?? 0) + 1);
    this.stateService.clearEntitySelectorRtIds(selectorId);
    // Without a leader pick its dependents list unscoped again (AB#7915).
    for (const dependent of dependentsOf(this.stateService.getEntitySelectors(), selectorId)) {
      this.pickerScopeSeq.set(dependent.id, (this.pickerScopeSeq.get(dependent.id) ?? 0) + 1);
      this.stateService.clearPickerScope(dependent.id);
    }
  }

  /**
   * The leader `leaderId` has no pick any more: each of its followers resolves
   * its own `defaultRtId`, or — without one — has no pick and no scope
   * (AB#7722). Followers with a default are marked pending synchronously.
   * Returns a promise for the default resolutions, or `null` when there are none.
   */
  private resetFollowersOf(leaderId: string): Promise<void> | null {
    const followers = followersOf(this.stateService.getEntitySelectors(), leaderId);
    const resolutions: Promise<void>[] = [];
    for (const follower of followers) {
      if (follower.defaultRtId) {
        const rtId = follower.defaultRtId;
        const resolution = this.resolveEntitySelectorVariables(follower, rtId);
        // The resolution marked the follower pending synchronously; remember
        // its sequence so a leader pick made meanwhile keeps its selection.
        const seq = this.scopeRequestSeq.get(follower.id);
        resolutions.push(resolution.then(displayName => {
          if (this.scopeRequestSeq.get(follower.id) === seq) {
            this.stateService.updateEntitySelectorSelection(follower.id, rtId, displayName);
          }
        }));
      } else {
        this.clearSelectorPick(follower.id);
      }
    }
    return resolutions.length > 0 ? Promise.all(resolutions).then(() => undefined) : null;
  }

  /** Resolution errors for runtime entity variables */
  readonly variableResolutionErrors = this.stateService.variableResolutionErrors;

  // Assigned in the constructor: a field initialised from a relative import breaks under the
  // Vitest module runner (see the frontend-libraries CLAUDE.md).
  private readonly messages: ReturnType<typeof injectMeshBoardMessages>;

  /**
   * One notice per entity selector whose stream-data scope could not be
   * resolved (AB#7721), so "nothing in scope" (empty widgets, no notice) and
   * "lookup failed" (empty widgets plus this notice) are distinguishable.
   */
  protected readonly scopeResolutionErrors = computed(() => {
    const template = this.messages().scopeResolutionFailed;
    return this.stateService.failedEntitySelectorScopeIds().map(id => {
      const label = this.stateService.getEntitySelector(id)?.label || id;
      return { selectorId: id, message: template.split('{label}').join(label) };
    });
  });

  /**
   * Per-selector sequence number of the latest scope resolution, so a slower
   * resolution of an earlier pick never overwrites the scope of a newer pick.
   */
  private readonly scopeRequestSeq = new Map<string, number>();

  /**
   * Per-dependent sequence number of the latest picker-scope resolution
   * (AB#7915): a late resolution of an earlier leader pick is discarded.
   */
  private readonly pickerScopeSeq = new Map<string, number>();

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
    // The host owns the period (AB#7582): no selection, URL or refresh from the picker.
    if (this.isHostTimeRangeActive()) {
      return;
    }
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
    const range = TimeRangeUtils.getTimeRangeFromSelection(sharedSelection, showTime, this.stateService.timeZoneMode());
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
    if (this.isHostTimeRangeActive()) {
      return;
    }
    const config = this.timeFilterConfig();
    if (!config?.defaultSelection) return;

    const defaultSel = config.defaultSelection;
    const sharedSelection = this.toSharedSelection(defaultSel);
    const showTime = config.pickerConfig?.showTime ?? false;
    const range = TimeRangeUtils.getTimeRangeFromSelection(sharedSelection, showTime, this.stateService.timeZoneMode());
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
    // Serialize onto the current URL string instead of router.navigate([],
    // {relativeTo}): the relative form is computed from the pre-navigation
    // route and, when it supersedes an in-flight rtId navigation, restores the
    // stale path (old/no board rtId) into the URL.
    const targetUrl = applyTimeFilterParams(this.router.url, selection);
    if (targetUrl === this.router.url) {
      // No-op writes must not navigate: the router would still cancel an
      // in-flight rtId navigation before skipping the identical URL.
      return;
    }
    this.router.navigateByUrl(targetUrl, { replaceUrl: true });
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
    // Compare only the fields the selection type actually uses: the picker
    // pre-fills the unused fields with current-date defaults (e.g. year/month
    // on a relative selection) while stored selections omit them. A
    // field-by-field comparison then reports equal selections as changed and
    // triggers a spurious URL write that supersedes (and thereby drops) the
    // board-switch rtId navigation.
    if (a.type !== b.type) {
      return false;
    }
    const eq = (x: unknown, y: unknown): boolean => (x ?? null) === (y ?? null);
    switch (a.type) {
      case 'year':
        return eq(a.year, b.year);
      case 'quarter':
        return eq(a.year, b.year) && eq(a.quarter, b.quarter);
      case 'month':
        return eq(a.year, b.year) && eq(a.month, b.month);
      case 'day':
        return eq(a.year, b.year) && eq(a.month, b.month) && eq(a.day, b.day) &&
          eq(a.hourFrom, b.hourFrom) && eq(a.hourTo, b.hourTo);
      case 'relative':
        return eq(a.relativeValue, b.relativeValue) && eq(a.relativeUnit, b.relativeUnit);
      case 'custom':
        return eq(a.customFrom, b.customFrom) && eq(a.customTo, b.customTo);
      default:
        return false;
    }
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
   * Moves a banner widget up (earlier) in the widgets array.
   */
  moveBannerUp(widgetId: string): void {
    this.stateService.updateConfig(config => {
      const widgets = [...config.widgets];
      const index = widgets.findIndex(w => w.id === widgetId);
      if (index <= 0) return config;

      // Find previous banner widget
      for (let i = index - 1; i >= 0; i--) {
        if (widgets[i].zone === 'banner') {
          [widgets[i], widgets[index]] = [widgets[index], widgets[i]];
          return { ...config, widgets };
        }
      }
      return config;
    });

    if (!this.isEditMode()) {
      this.editModeService.enterEditMode(this.stateService.getConfig());
    }
  }

  /**
   * Moves a banner widget down (later) in the widgets array.
   */
  moveBannerDown(widgetId: string): void {
    this.stateService.updateConfig(config => {
      const widgets = [...config.widgets];
      const index = widgets.findIndex(w => w.id === widgetId);
      if (index === -1) return config;

      // Find next banner widget
      for (let i = index + 1; i < widgets.length; i++) {
        if (widgets[i].zone === 'banner') {
          [widgets[i], widgets[index]] = [widgets[index], widgets[i]];
          return { ...config, widgets };
        }
      }
      return config;
    });

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
  onReorder(event: TileLayoutReorderEvent): void {
    // The event provides the new position of the reordered item explicitly,
    // because the @Input() properties on TileLayoutItemComponent still reflect
    // the old Angular binding values at event time.
    // We use event.newCol/newRow for the moved item and read other items'
    // positions from the TileLayout after Angular has processed the change.
    this.syncWidgetPositionsFromEvent({
      movedItemIndex: event.oldIndex,
      newCol: event.newCol,
      newRow: event.newRow
    });

    // Enter edit mode if not already in it
    if (!this.isEditMode()) {
      this.editModeService.enterEditMode(this.stateService.getConfig());
    }
  }

  /**
   * Handles TileLayout resize events.
   */
  onResize(event: TileLayoutResizeEvent): void {
    // The event provides the new spans of the resized item explicitly.
    // We find the resized item by matching its old col/row position.
    const currentGridWidgets = this.gridWidgets();
    const resizedIndex = currentGridWidgets.findIndex(w =>
      w.col === event.item.col && w.row === event.item.row
    );

    this.syncWidgetPositionsFromEvent({
      movedItemIndex: resizedIndex,
      newCol: event.item.col,
      newRow: event.item.row,
      newColSpan: event.newColSpan,
      newRowSpan: event.newRowSpan
    });

    // Enter edit mode if not already in it
    if (!this.isEditMode()) {
      this.editModeService.enterEditMode(this.stateService.getConfig());
    }
  }

  /**
   * Syncs widget positions from a TileLayout reorder or resize event.
   *
   * At event time, the @Input() properties on TileLayoutItemComponent still
   * hold their old Angular binding values. The only reliable source for the
   * changed item's new position are the explicit event properties
   * (newCol/newRow for reorder, newColSpan/newRowSpan for resize).
   *
   * After updating the changed item, we schedule a deferred read of all
   * item positions from the TileLayout ViewChild (after Angular has processed
   * the change) to pick up any reflow of other widgets.
   */
  private syncWidgetPositionsFromEvent(change: {
    movedItemIndex: number;
    newCol?: number;
    newRow?: number;
    newColSpan?: number;
    newRowSpan?: number;
  }): void {
    const currentGridWidgets = this.gridWidgets();

    if (change.movedItemIndex < 0 || change.movedItemIndex >= currentGridWidgets.length) {
      console.warn('Could not find moved/resized widget at index', change.movedItemIndex);
      return;
    }

    const movedWidget = currentGridWidgets[change.movedItemIndex];

    // Update the moved/resized widget with the explicit event values
    this.stateService.updateWidget(movedWidget.id, w => ({
      ...w,
      col: change.newCol ?? w.col,
      row: change.newRow ?? w.row,
      colSpan: change.newColSpan ?? w.colSpan,
      rowSpan: change.newRowSpan ?? w.rowSpan
    }));

    // After Angular processes the change and Kendo re-renders,
    // read back all item positions to catch any reflow of other widgets.
    setTimeout(() => this.syncAllWidgetPositionsFromTileLayout(), 0);
  }

  /**
   * Reads the current col/row/colSpan/rowSpan from all TileLayout items
   * and updates the widget state accordingly.
   * Called after Angular change detection so @Input() values are current.
   */
  private syncAllWidgetPositionsFromTileLayout(): void {
    if (!this.tileLayout) return;

    const tileItems = this.tileLayout.items?.toArray();
    if (!tileItems) return;

    const currentGridWidgets = this.gridWidgets();
    if (tileItems.length !== currentGridWidgets.length) return;

    this.stateService.updateConfig(config => ({
      ...config,
      widgets: config.widgets.map(widget => {
        if (widget.zone === 'banner') return widget;

        const gridIndex = currentGridWidgets.findIndex(gw => gw.id === widget.id);
        if (gridIndex === -1 || gridIndex >= tileItems.length) return widget;

        const tileItem = tileItems[gridIndex];
        return {
          ...widget,
          col: tileItem.col,
          row: tileItem.row,
          colSpan: tileItem.colSpan,
          rowSpan: tileItem.rowSpan
        };
      })
    }));
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
      // An entity-selector binding (or a variable-bearing rtId/ckTypeId) counts
      // as configured — the entity is resolved live from a board-level selection.
      return !dataSource.entitySelectorId && !dataSource.rtId && !dataSource.ckTypeId;
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
      rowSpan: update.rowSpan,
      chromeless: update.chromeless,
      zone: update.zone
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
    // Followers render no picker; their pick is derived from the leader (AB#7722).
    if (!selector || isFollowerSelector(selector)) return;

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
    const selector = this.stateService.getEntitySelector(selectorId);
    if (selector && isFollowerSelector(selector)) return;

    // Clear selection, variables and the resolved stream-data scope: without a
    // pick bound widgets fall back to the persisted scope (AB#7721).
    this.clearSelectorPick(selectorId);

    // Followers fall back to their own defaultRtId, or to no scope (AB#7722).
    await this.resetFollowersOf(selectorId);

    // Sync to URL
    this.writeEntitySelectorsToUrl();

    // Refresh widgets
    this.stateService.triggerRefresh();
  }

  /**
   * Initializes entity selectors from URL params, route data, or defaults.
   */
  private async initializeEntitySelectors(): Promise<void> {
    const picks = this.initialEntitySelectorPicks(true);
    if (picks.length === 0) return;

    // Mark every picked scope pending before the first await, so no bound
    // widget queries the persisted scope while the picks resolve (AB#7721).
    this.primeEntitySelectorScopes();

    for (const { selector, rtId, viaLeader } of picks) {
      // A follower whose leader has a pick is resolved together with the
      // leader (one entity fetch, AB#7722).
      if (viaLeader) continue;
      const displayName = await this.resolveEntitySelectorVariables(selector, rtId);
      this.stateService.updateEntitySelectorSelection(selector.id, rtId, displayName);
    }

    // Widgets reload only when their config reference changes. Bound widgets
    // rendered while their scope was pending must now load with the resolved
    // scope (AB#7721).
    this.stateService.triggerRefresh();
  }

  /**
   * The initial pick of each entity selector. Priority: route data > URL
   * params > defaultRtId. Selectors without a pick are left out.
   *
   * Followers (AB#7722) never read route data or the URL: a follower takes its
   * leader's initial pick (`viaLeader: true`, resolved together with the
   * leader) and falls back to its own `defaultRtId` only when the leader has
   * none. An unknown or chained leader counts as "leader has no pick"; with
   * `warn` set this logs a console warning.
   */
  private initialEntitySelectorPicks(warn = false): { selector: EntitySelectorConfig; rtId: string; viaLeader: boolean }[] {
    const selectors = this.stateService.getEntitySelectors();
    if (selectors.length === 0) return [];

    const urlSelections = this.readEntitySelectorsFromUrl();
    const routeData = this.route.snapshot.data['entitySelectors'] as Record<string, string> | undefined;
    const ownPick = (selector: EntitySelectorConfig): string | undefined =>
      routeData?.[selector.id] ?? urlSelections.get(selector.id) ?? selector.defaultRtId;

    const picks: { selector: EntitySelectorConfig; rtId: string; viaLeader: boolean }[] = [];
    for (const selector of selectors) {
      const leader = resolveFollowLeader(selectors, selector);
      if (leader.kind === 'none') {
        const rtId = ownPick(selector);
        if (rtId) picks.push({ selector, rtId, viaLeader: false });
        continue;
      }
      if (leader.kind === 'invalid' && warn) {
        console.warn(
          `Entity selector '${selector.id}' follows '${leader.leaderId}', which ${leader.problem === 'unknown' ? 'does not exist' : leader.problem === 'self' ? 'is itself' : 'follows another selector'} — treated as "leader has no pick"`
        );
      }
      const leaderRtId = leader.kind === 'leader' ? ownPick(leader.leader) : undefined;
      if (leaderRtId) {
        picks.push({ selector, rtId: leaderRtId, viaLeader: true });
      } else if (selector.defaultRtId) {
        picks.push({ selector, rtId: selector.defaultRtId, viaLeader: false });
      }
    }
    return picks;
  }

  /**
   * Marks the scope of every selector that has an initial pick as pending
   * (AB#7721). Called synchronously right after a board is loaded, before
   * change detection renders its widgets, so a bound stream-data widget starts
   * in its loading state instead of querying the persisted (unscoped) scope.
   * Selectors without a pick stay without scope state (persisted scope).
   */
  private primeEntitySelectorScopes(): void {
    const picks = this.initialEntitySelectorPicks();
    for (const { selector } of picks) {
      if (!this.stateService.getEntitySelectorScopeState(selector.id)) {
        this.stateService.setEntitySelectorScopePending(selector.id);
      }
    }
    this.primePickerScopes(picks.filter(p => !p.viaLeader).map(p => p.selector.id));
  }

  /**
   * Picker scopes of dependent selectors right after a board loaded (AB#7915):
   * a dependent whose leader has an initial pick is pending (its picker lists
   * nothing until the scope resolved); an invalid scope source is failed and
   * logs one warning per board load (the state is cleared on board switch, so
   * the guard on an existing state makes this idempotent).
   */
  private primePickerScopes(pickedSelectorIds: string[]): void {
    const selectors = this.stateService.getEntitySelectors();
    for (const selector of selectors) {
      if (!selector.scopeSource || this.stateService.getPickerScopeState(selector.id)) continue;
      const resolution = resolveScopeSource(selectors, selector);
      if (resolution.kind === 'invalid') {
        console.warn(
          `Entity selector '${selector.id}' depends on '${resolution.leaderId}', but ${resolution.reason} — its picker lists nothing`
        );
        this.stateService.setPickerScopeFailed(selector.id);
      } else if (resolution.kind === 'source' && pickedSelectorIds.includes(resolution.leader.id)) {
        this.stateService.setPickerScopePending(selector.id);
      }
    }
  }

  /**
   * Resolves the picker scope of every dependent of `leader` from the leader's
   * pick `rtId` (AB#7915): marks each dependent pending synchronously, then
   * walks its `scopeSource.path` with `resolveScopePath` (one batched request
   * per hop) and stores the distinct rtIds of the last hop — `[]` when the pick
   * reaches nothing. A failing hop is a failed picker scope (logged once); a
   * resolution overtaken by a newer leader pick is discarded. Never rejects.
   */
  private resolvePickerScopesOf(leader: EntitySelectorConfig, rtId: string): Promise<void> {
    const selectors = this.stateService.getEntitySelectors();
    const resolutions = dependentsOf(selectors, leader.id).map(async dependent => {
      const resolution = resolveScopeSource(selectors, dependent);
      if (resolution.kind !== 'source') return;
      const seq = (this.pickerScopeSeq.get(dependent.id) ?? 0) + 1;
      this.pickerScopeSeq.set(dependent.id, seq);
      this.stateService.setPickerScopePending(dependent.id);
      const isCurrent = (): boolean => this.pickerScopeSeq.get(dependent.id) === seq;
      try {
        const rtIds = await resolveScopePath(
          rtId,
          resolution.leader.ckTypeId,
          resolution.hops,
          (sources, sourceCkTypeId, hop) => firstValueFrom(
            this.dataService.fetchAssociationTargetRtIds(sources, sourceCkTypeId, hop.targetCkTypeId, hop.roleId, hop.direction)
          ),
          isCurrent
        );
        if (rtIds !== null && isCurrent()) {
          this.stateService.setPickerScopeRtIds(dependent.id, rtIds);
        }
      } catch (error) {
        if (!isCurrent()) return;
        console.error(`Error resolving the picker scope of selector '${dependent.id}':`, error);
        this.stateService.setPickerScopeFailed(dependent.id);
      }
    });
    return Promise.all(resolutions).then(() => undefined);
  }

  /**
   * Resolves variables for an entity selector by fetching entity attributes,
   * then its stream-data scope.
   *
   * A leader's pick is also the pick of all its followers (AB#7722): they are
   * marked pending together with the leader, the picked entity is fetched
   * once, and each follower gets its own variables (its attribute mappings,
   * `<id>_rtId`, `<id>_rtCkTypeId`), its own scope (its `childScope`) and the
   * leader's selection. Returns the picked entity's display name.
   */
  private async resolveEntitySelectorVariables(selector: EntitySelectorConfig, rtId: string): Promise<string | undefined> {
    const selectors = this.stateService.getEntitySelectors();
    const resolved = effectiveSelector(selectors, selector);
    const followers = followersOf(selectors, selector.id).map(f => effectiveSelector(selectors, f));
    const targets = [resolved, ...followers];

    // The scope of the new pick is unknown until it resolves: bound widgets
    // must neither keep the previous pick's scope nor fall back to the
    // persisted one (AB#7721). Followers are pending while the leader is.
    const seqs = targets.map(t => this.beginScopeResolution(t.id));
    const failAll = (): void => targets.forEach((t, i) => this.failScopeResolution(t.id, seqs[i]));
    // Dependents (AB#7915) list only what this pick reaches; marked pending in
    // the same synchronous step, resolved in parallel with the entity fetch.
    const pickerScopes = this.resolvePickerScopesOf(resolved, rtId);
    try {
      const entity = await firstValueFrom(
        this.dataService.fetchRuntimeEntity({
          type: 'runtimeEntity',
          ckTypeId: resolved.ckTypeId,
          rtId
        })
      );

      if (!entity) {
        console.warn(`Entity not found for selector '${selector.id}': ${rtId}`);
        // The pick cannot be resolved: bound widgets show no data instead of
        // waiting forever or falling back to the persisted scope (AB#7721).
        failAll();
        return undefined;
      }

      // A newer pick (of the leader, or a follower's own default) may have
      // started meanwhile; never overwrite its variables or selection.
      const isCurrent = (i: number): boolean => this.scopeRequestSeq.get(targets[i].id) === seqs[i];
      targets.forEach((target, i) => {
        if (isCurrent(i)) {
          this.stateService.setEntitySelectorVariables(target.id, this.selectorVariables(target, entity, rtId));
        }
      });

      // Label the selection the way the pick dialog does: by the engine's
      // display name (the type's displayNameRule — "2026" for a fiscal year),
      // not the well-known name, which most entities do not carry. Without it
      // a board opened on its defaultRtId showed the raw rtId in the toolbar
      // until the user re-picked the very same entity.
      const displayName = entity.rtDisplayName || entity.rtWellKnownName || entity.rtId;
      followers.forEach((follower, i) => {
        if (isCurrent(i + 1)) {
          this.stateService.updateEntitySelectorSelection(follower.id, rtId, displayName);
        }
      });

      // Resolve the stream-data scope rtIds for this selection (childScope
      // hop or path, or the picked entity itself), per selector, so
      // widgets bound to the leader or any follower scope their stream-data
      // query by the resolved source rtIds.
      await Promise.all(targets.map((t, i) => this.resolveEntitySelectorScopeRtIds(t, rtId, seqs[i])));

      return displayName;
    } catch (error) {
      console.error(`Error resolving entity selector '${selector.id}':`, error);
      // Same as above: a failed pick is an empty scope, never the persisted one.
      failAll();
      return undefined;
    } finally {
      await pickerScopes;
    }
  }

  /**
   * The variables one selector derives from the picked entity: its attribute
   * mappings plus the auto-exposed `<id>_rtId` and `<id>_rtCkTypeId`.
   */
  private selectorVariables(
    selector: EntitySelectorConfig,
    entity: RuntimeEntityData,
    rtId: string
  ): { name: string; value: string; type?: string }[] {
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

    // Auto-expose the selected entity's rtId as `$<selectorId>_rtId` so SD/runtime
    // widgets can scope to the picked asset (parent-association filter) without the
    // designer adding a fake attribute mapping. An explicit mapping to the same
    // variable name wins (skip the synthetic one if already present).
    const rtIdVariableName = `${selector.id}_rtId`;
    if (!values.some(v => v.name === rtIdVariableName)) {
      values.push({ name: rtIdVariableName, value: rtId, type: 'string' });
    }

    // Auto-expose the selected entity's CK type as `$<selectorId>_rtCkTypeId`
    // so entity-display widgets (e.g. the entity card) can resolve both the
    // rtId and its type from a single board-level selection. Prefer the picked
    // entity's actual type (it may be a subtype of the selector's configured
    // `ckTypeId`); fall back to the selector's type. An explicit mapping to the
    // same variable name wins.
    const rtCkTypeIdVariableName = `${selector.id}_rtCkTypeId`;
    if (!values.some(v => v.name === rtCkTypeIdVariableName)) {
      values.push({ name: rtCkTypeIdVariableName, value: entity.ckTypeId ?? selector.ckTypeId, type: 'string' });
    }
    return values;
  }

  /**
   * Resolves the set of source rtIds that a stream-data widget bound to this
   * selector should be scoped to, and caches them on the state service.
   *
   * - No {@link EntitySelectorChildScope}: the picked entity's own rtId is the
   *   scope (direct keying).
   * - One-hop form (top-level fields): the picked entity's targets of
   *   `targetCkTypeId` reached via `roleId`/`direction` (e.g. MeteringPoint →
   *   its EnergyMeasurement rtIds) — exactly as before AB#7723.
   * - `path` (AB#7723): hop by hop, each hop one batched request over all
   *   entities the previous hop reached; the scope is the distinct rtIds of the
   *   last hop. An empty hop ends the resolution with an empty scope; a failed
   *   hop, or an invalid path (more than 5 hops, a hop without role or target
   *   type), is a failed scope (AB#7721).
   */
  private async resolveEntitySelectorScopeRtIds(selector: EntitySelectorConfig, rtId: string, seq: number): Promise<void> {
    const isCurrent = (): boolean => this.scopeRequestSeq.get(selector.id) === seq;
    if (!isCurrent()) return;

    const plan = scopePlan(selector.childScope);
    if (plan.kind === 'none') {
      this.stateService.setEntitySelectorRtIds(selector.id, [rtId]);
      return;
    }
    if (plan.kind === 'invalid') {
      console.error(`Invalid child scope path for selector '${selector.id}': ${plan.reason}`);
      this.stateService.setEntitySelectorScopeFailed(selector.id);
      return;
    }

    try {
      let scopeRtIds: string[] | null;
      if (plan.kind === 'single') {
        // The original one-hop request, unchanged (AB#7723 keeps old boards byte-identical).
        const targets = await firstValueFrom(
          this.dataService.fetchAssociationTargets(
            rtId,
            selector.ckTypeId,
            plan.hop.targetCkTypeId,
            plan.hop.roleId,
            // Parent → children via System/ParentChild is an INBOUND hop (the child
            // owns the association to its parent), so 'in' is the default.
            plan.hop.direction
          )
        );
        scopeRtIds = isCurrent()
          ? (targets ?? []).map(t => String(t.rtId)).filter(id => id.length > 0)
          : null;
      } else {
        scopeRtIds = await resolveScopePath(
          rtId,
          selector.ckTypeId,
          plan.hops,
          (sources, sourceCkTypeId, hop) => firstValueFrom(
            this.dataService.fetchAssociationTargetRtIds(sources, sourceCkTypeId, hop.targetCkTypeId, hop.roleId, hop.direction)
          ),
          isCurrent
        );
      }
      if (scopeRtIds === null || !isCurrent()) return;
      // An empty list is a resolved EMPTY scope: bound widgets show no data and
      // send no query — never the persisted scope, which would show rows of
      // other entities (AB#7721).
      this.stateService.setEntitySelectorRtIds(selector.id, scopeRtIds);
    } catch (error) {
      if (!isCurrent()) return;
      // Logged once per failed resolution; the view shows a notice and bound
      // widgets show no data (AB#7721).
      console.error(`Error resolving child scope for selector '${selector.id}':`, error);
      this.stateService.setEntitySelectorScopeFailed(selector.id);
    }
  }

  /**
   * Starts the scope resolution of a new pick: marks the scope pending and
   * returns the sequence number that identifies this resolution (AB#7721).
   */
  private beginScopeResolution(selectorId: string): number {
    const seq = (this.scopeRequestSeq.get(selectorId) ?? 0) + 1;
    this.scopeRequestSeq.set(selectorId, seq);
    this.stateService.setEntitySelectorScopePending(selectorId);
    return seq;
  }

  /** Marks the scope failed — unless a newer pick has started resolving meanwhile. */
  private failScopeResolution(selectorId: string, seq: number): void {
    if (this.scopeRequestSeq.get(selectorId) === seq) {
      this.stateService.setEntitySelectorScopeFailed(selectorId);
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
      // Followers are derived from their leader and never serialized (AB#7722).
      if (isFollowerSelector(selector)) continue;
      params[`es_${selector.id}`] = selector.selectedRtId ?? null;
    }

    // Same single-URL serialization as writeTimeFilterToUrl: no relative
    // navigation off a possibly stale route, and no no-op navigation that
    // would cancel an in-flight rtId navigation.
    const targetUrl = applyQueryParams(this.router.url, params);
    if (targetUrl !== this.router.url) {
      this.router.navigateByUrl(targetUrl, { replaceUrl: true });
    }
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
