import { Injectable, inject, signal, computed } from '@angular/core';
import { CkModelService, TENANT_ID_PROVIDER } from '@meshmakers/octo-services';
import { TimeRange, TimeRangeSelection as SharedTimeRangeSelection, TimeRangeUtils } from '@meshmakers/shared-ui';
import { MeshBoardPersistenceService, PersistedMeshBoard } from './meshboard-persistence.service';
import { MeshBoardGridService } from './meshboard-grid.service';
import {
  MeshBoardConfig,
  AnyWidgetConfig,
  MeshBoardVariable,
  MeshBoardVariableSource,
  MeshBoardTimeFilterConfig,
  MeshBoardTimeZoneMode,
  DEFAULT_TIME_ZONE_MODE,
  TimeRangeSelection,
  VariableResolutionError,
  EntitySelectorConfig
} from '../models/meshboard.models';
import { EntitySelectorScopeState, StreamDataScope } from '../utils/stream-data-scope';
import type { QueryFamily } from '../utils/query-family';

/** The CK model required for the MeshBoard feature */
const REQUIRED_CK_MODEL = 'System.UI';
const REQUIRED_CK_MODEL_MIN_VERSION = '1.0.1';

/**
 * The period an embedding host sets on the board (AB#7582): two exact instants
 * (half-open `[from, to)`), or `invalid` (with the reason) when the host passed an
 * unparseable or empty range. Produced by `parseHostTimeRange`, held transiently by
 * {@link MeshBoardStateService.setHostTimeRange}.
 */
export type HostTimeRangeState =
  | { status: 'valid'; from: Date; to: Date }
  | { status: 'invalid'; reason: string };

/**
 * Service that manages MeshBoard state and persistence.
 * Coordinates loading, saving, and switching between MeshBoards.
 */
@Injectable({
  providedIn: 'root'
})
export class MeshBoardStateService {
  private readonly ckModelService = inject(CkModelService);
  private readonly persistenceService = inject(MeshBoardPersistenceService);
  private readonly gridService = inject(MeshBoardGridService);
  private readonly tenantIdProvider = inject(TENANT_ID_PROVIDER, { optional: true });

  // Reactive state signals
  private readonly _meshBoardConfig = signal<MeshBoardConfig>(this.createDefaultConfig());
  private readonly _persistedMeshBoardId = signal<string | null>(null);
  /** Stores the rtIds of widgets that exist in the backend */
  private readonly _existingWidgetRtIds = signal<string[]>([]);
  private readonly _availableMeshBoards = signal<PersistedMeshBoard[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _isModelAvailable = signal<boolean | null>(null);
  private readonly _variableResolutionErrors = signal<VariableResolutionError[]>([]);
  /**
   * Transient scope state of each entity selector's current selection (keyed
   * by selector id): `pending` while the view resolves the pick, `resolved`
   * with the source rtIds (childScope hop or path, or the picked entity's
   * own rtId; possibly none), or `failed`. No entry = no active pick. Not
   * persisted — derived fresh from each selection, cleared on board switch
   * (AB#7721).
   */
  private readonly _entitySelectorScopes = signal<Record<string, EntitySelectorScopeState>>({});
  /**
   * Transient picker scope of each dependent selector (AB#7915, keyed by the
   * dependent's id): `pending` while the leader's pick resolves along
   * `scopeSource.path`, `resolved` with the rtIds the picker may list
   * (possibly none), or `failed`. No entry = the leader has no pick, the picker
   * lists unscoped. Not persisted, cleared on board switch.
   */
  private readonly _pickerScopes = signal<Record<string, EntitySelectorScopeState>>({});
  /** Picker scopes of the dependent selectors (AB#7915), for the toolbar. */
  readonly pickerScopes = this._pickerScopes.asReadonly();
  /**
   * Period set by the page that embeds the board (`MeshBoardViewComponent.timeRange`, AB#7582):
   * exact instants, or `invalid` when the host passed an unusable range. `null` = the board's own
   * selection applies. Transient — never persisted, never written into the board config.
   */
  private readonly _hostTimeRange = signal<HostTimeRangeState | null>(null);
  /**
   * Transient variables published by widgets (KPI output variables, AB#5364).
   * Kept apart from `_meshBoardConfig` so publishing triggers no persistence and
   * no dirty state. Cleared on every board switch.
   */
  private readonly _widgetVariables = signal<MeshBoardVariable[]>([]);
  /**
   * Widgets that reported "nothing for this viewer" (AB#5558, e.g. a cockpit KPI an end user may not
   * use). Transient, per board load; the view leaves them out outside edit mode.
   */
  private readonly _hiddenForViewer = signal<ReadonlySet<string>>(new Set());
  readonly hiddenForViewer = this._hiddenForViewer.asReadonly();
  /**
   * Natural content height (px) reported by content-sized widgets (AB#5558: the cockpit attention
   * and recent-items lists). On the phone tier the view grows their tiles to fit instead of
   * clipping; other tiers ignore it. Transient, cleared on board switch.
   */
  private readonly _widgetContentHeights = signal<ReadonlyMap<string, number>>(new Map());
  readonly widgetContentHeights = this._widgetContentHeights.asReadonly();
  /**
   * Tenant the loaded board belongs to (from `TENANT_ID_PROVIDER` at load time; `null` when the host
   * provides none). The service is a singleton across tenant switches, so a host comparing
   * well-known names (e.g. the Studio's `cockpit`) must also compare this (AB#5558).
   */
  private readonly _loadedTenantId = signal<string | null>(null);
  readonly loadedTenantId = this._loadedTenantId.asReadonly();

  // Public computed signals
  readonly meshBoardConfig = computed(() => this._meshBoardConfig());
  readonly persistedMeshBoardId = computed(() => this._persistedMeshBoardId());
  /** @deprecated Use existingWidgetRtIds instead */
  readonly existingWidgetIds = computed(() => this._existingWidgetRtIds());
  readonly existingWidgetRtIds = computed(() => this._existingWidgetRtIds());
  readonly availableMeshBoards = computed(() => this._availableMeshBoards());
  readonly isLoading = computed(() => this._isLoading());
  readonly widgets = computed(() => this._meshBoardConfig().widgets);
  readonly isModelAvailable = computed(() => this._isModelAvailable());
  readonly variableResolutionErrors = computed(() => this._variableResolutionErrors());
  /**
   * The board's effective timezone mode (defaults to `'local'`). Drives both the
   * time-filter boundary computation and datetime display across all widgets.
   * Widgets read this to format timestamps consistently with the active filter.
   */
  readonly timeZoneMode = computed<MeshBoardTimeZoneMode>(
    () => this._meshBoardConfig().timeZoneMode ?? DEFAULT_TIME_ZONE_MODE
  );

  // Deprecated aliases for backward compatibility
  /** @deprecated Use meshBoardConfig instead */
  readonly dashboardConfig = this.meshBoardConfig;
  /** @deprecated Use persistedMeshBoardId instead */
  readonly persistedDashboardId = this.persistedMeshBoardId;
  /** @deprecated Use availableMeshBoards instead */
  readonly availableDashboards = this.availableMeshBoards;

  /**
   * Creates the default MeshBoard configuration.
   */
  private createDefaultConfig(): MeshBoardConfig {
    return {
      id: 'demo-meshboard',
      name: 'Demo MeshBoard',
      description: 'A demonstration of the MeshBoard widget system',
      columns: 6,
      rowHeight: 200,
      gap: 16,
      widgets: []
    };
  }

  /**
   * Loads the initial MeshBoard from backend or starts with empty MeshBoard.
   * Only loads if the required CK model (System.UI) is available.
   */
  async loadInitialMeshBoard(): Promise<AnyWidgetConfig[]> {
    this._isLoading.set(true);

    try {
      // Check if the required CK model is available with minimum version
      const modelAvailable = await this.ckModelService.isModelAvailableWithMinVersion(
        REQUIRED_CK_MODEL,
        REQUIRED_CK_MODEL_MIN_VERSION
      );
      this._isModelAvailable.set(modelAvailable);

      if (!modelAvailable) {
        console.warn(
          `MeshBoard feature not available: CK model '${REQUIRED_CK_MODEL}' >= ${REQUIRED_CK_MODEL_MIN_VERSION} is not installed in this tenant.`
        );
        return [];
      }

      const meshBoards = await this.persistenceService.getMeshBoards();
      this._availableMeshBoards.set(meshBoards);

      if (meshBoards.length > 0) {
        return await this.switchToMeshBoard(meshBoards[0].rtId);
      } else {
        // No MeshBoards exist - start with empty MeshBoard
        this._persistedMeshBoardId.set(null);
        this._existingWidgetRtIds.set([]);
        return [];
      }
    } catch (err) {
      console.error('Error loading MeshBoard:', err);
      return [];
    } finally {
      this._isLoading.set(false);
    }
  }

  /** @deprecated Use loadInitialMeshBoard instead */
  async loadInitialDashboard(): Promise<AnyWidgetConfig[]> {
    return this.loadInitialMeshBoard();
  }

  /**
   * Switches to a different MeshBoard by rtId.
   * Returns the widgets for data loading.
   */
  async switchToMeshBoard(rtId: string): Promise<AnyWidgetConfig[]> {
    this._isLoading.set(true);

    try {
      const result = await this.persistenceService.getMeshBoardWithWidgets(rtId);

      if (result) {
        const config = this.persistenceService.toMeshBoardConfig(result.meshBoard, result.widgets);
        const tenantId = await this.currentTenantId();

        // Fix any overlapping widgets from backend data
        const movedWidgets = this.gridService.resolveOverlaps(config.widgets, config.columns);
        if (movedWidgets.length > 0) {
          console.warn(`Resolved ${movedWidgets.length} overlapping widget(s)`);
        }

        this._widgetVariables.set([]);
        this._entitySelectorScopes.set({});
        this._pickerScopes.set({});
        this._hiddenForViewer.set(new Set());
        this._widgetContentHeights.set(new Map());
        this._loadedTenantId.set(tenantId);
        this._meshBoardConfig.set(config);
        this._persistedMeshBoardId.set(result.meshBoard.rtId);
        this._existingWidgetRtIds.set(result.widgets.map(w => w.rtId));

        return config.widgets;
      } else {
        console.error('MeshBoard not found:', rtId);
        return this._meshBoardConfig().widgets;
      }
    } catch (err) {
      console.error('Error switching MeshBoard:', err);
      return this._meshBoardConfig().widgets;
    } finally {
      this._isLoading.set(false);
    }
  }

  /** @deprecated Use switchToMeshBoard instead */
  async switchToDashboard(rtId: string): Promise<AnyWidgetConfig[]> {
    return this.switchToMeshBoard(rtId);
  }

  /**
   * Switches to a MeshBoard identified by its rtWellKnownName.
   * Loads initial MeshBoards if not already loaded.
   * Returns the widgets for data loading, or null if not found.
   */
  async switchToMeshBoardByWellKnownName(wellKnownName: string): Promise<AnyWidgetConfig[] | null> {
    this._isLoading.set(true);

    try {
      // Ensure MeshBoards are loaded
      if (this._availableMeshBoards().length === 0) {
        await this.loadInitialMeshBoard();
      }

      // Find MeshBoard by well-known name
      const meshBoard = this._availableMeshBoards().find(
        mb => mb.rtWellKnownName === wellKnownName
      );

      if (meshBoard) {
        return await this.switchToMeshBoard(meshBoard.rtId);
      } else {
        console.warn(`MeshBoard with rtWellKnownName '${wellKnownName}' not found`);
        return null;
      }
    } catch (err) {
      console.error('Error switching to MeshBoard by well-known name:', err);
      return null;
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Saves the current MeshBoard configuration to the backend.
   */
  async saveMeshBoard(): Promise<void> {
    const config = this._meshBoardConfig();
    const persistedId = this._persistedMeshBoardId();
    const existingRtIds = this._existingWidgetRtIds();

    try {
      if (persistedId) {
        // Update existing MeshBoard
        const result = await this.persistenceService.updateMeshBoard(persistedId, config, existingRtIds);
        console.log('MeshBoard updated successfully');

        // Update rtIds for newly created widgets
        if (result.createdWidgets.length > 0) {
          this.updateConfig(c => ({
            ...c,
            widgets: c.widgets.map(w => {
              const created = result.createdWidgets.find(cw => cw.localId === w.id);
              if (created) {
                return { ...w, rtId: created.rtId };
              }
              return w;
            })
          }));
        }

        // Update existingWidgetRtIds with all current widget rtIds
        const updatedConfig = this._meshBoardConfig();
        this._existingWidgetRtIds.set(
          updatedConfig.widgets
            .map(w => w.rtId)
            .filter((rtId): rtId is string => rtId !== undefined)
        );
      } else {
        // Create new MeshBoard
        const meshBoardId = await this.persistenceService.createMeshBoard(config);
        console.log('MeshBoard created with ID:', meshBoardId);
        this._persistedMeshBoardId.set(meshBoardId);
        this.updateConfig(c => ({ ...c, id: meshBoardId }));

        // For new MeshBoards, reload to get the widget rtIds from backend
        await this.switchToMeshBoard(meshBoardId);
      }
    } catch (err) {
      console.error('Error saving MeshBoard:', err);
      throw err; // Re-throw so caller can handle
    }
  }

  /** @deprecated Use saveMeshBoard instead */
  async saveDashboard(): Promise<void> {
    return this.saveMeshBoard();
  }

  /**
   * Updates the MeshBoard configuration.
   */
  updateConfig(updater: (config: MeshBoardConfig) => MeshBoardConfig): void {
    this._meshBoardConfig.update(updater);
  }

  /**
   * Sets the MeshBoard configuration directly.
   */
  setConfig(config: MeshBoardConfig): void {
    this._meshBoardConfig.set(config);
  }

  /**
   * Gets the current MeshBoard configuration (non-reactive).
   */
  getConfig(): MeshBoardConfig {
    return this._meshBoardConfig();
  }

  /**
   * Adds a widget to the MeshBoard.
   */
  addWidget(widget: AnyWidgetConfig): void {
    this.updateConfig(config => ({
      ...config,
      widgets: [...config.widgets, widget]
    }));
  }

  /**
   * Removes a widget from the MeshBoard.
   */
  removeWidget(widgetId: string): void {
    this.updateConfig(config => ({
      ...config,
      widgets: config.widgets.filter(w => w.id !== widgetId)
    }));
  }

  /**
   * Updates a specific widget in the MeshBoard.
   */
  updateWidget(widgetId: string, updater: (widget: AnyWidgetConfig) => AnyWidgetConfig): void {
    this.updateConfig(config => ({
      ...config,
      widgets: config.widgets.map(w => w.id === widgetId ? updater(w) : w)
    }));
  }

  /**
   * Gets a widget by ID.
   */
  getWidget(widgetId: string): AnyWidgetConfig | undefined {
    return this._meshBoardConfig().widgets.find(w => w.id === widgetId);
  }

  /**
   * Updates MeshBoard settings (name, description, columns, variables, timeFilter, etc.).
   */
  updateSettings(settings: {
    name: string;
    description: string;
    rtWellKnownName?: string;
    columns: number;
    rowHeight: number;
    gap: number;
    variables?: MeshBoardVariable[];
    timeFilter?: MeshBoardTimeFilterConfig;
    timeZoneMode?: MeshBoardTimeZoneMode;
    entitySelectors?: EntitySelectorConfig[];
    autoRefreshSeconds?: number;
  }): void {
    this.updateConfig(config => ({
      ...config,
      name: settings.name,
      description: settings.description,
      rtWellKnownName: settings.rtWellKnownName || null,
      columns: settings.columns,
      rowHeight: settings.rowHeight,
      gap: settings.gap,
      timeZoneMode: settings.timeZoneMode ?? config.timeZoneMode,
      variables: settings.variables ?? config.variables,
      timeFilter: settings.timeFilter
        ? {
          ...config.timeFilter,
          ...settings.timeFilter,
          // When a new defaultSelection is set, reset the stored selection to match
          selection: settings.timeFilter.defaultSelection ?? config.timeFilter?.selection
        }
        : config.timeFilter,
      entitySelectors: settings.entitySelectors ?? config.entitySelectors,
      autoRefreshSeconds: settings.autoRefreshSeconds
    }));

    // If time filter is disabled, clear the time filter variables
    if (settings.timeFilter && !settings.timeFilter.enabled) {
      this.clearTimeFilterVariables();
    }
  }

  /**
   * Gets current settings for the settings dialog.
   */
  getCurrentSettings(): {
    name: string;
    description: string;
    rtWellKnownName?: string | null;
    columns: number;
    rowHeight: number;
    gap: number;
    variables: MeshBoardVariable[];
    timeFilter?: MeshBoardTimeFilterConfig;
    timeZoneMode?: MeshBoardTimeZoneMode;
    entitySelectors?: EntitySelectorConfig[];
    autoRefreshSeconds?: number;
  } {
    const config = this._meshBoardConfig();
    return {
      name: config.name,
      description: config.description ?? '',
      rtWellKnownName: config.rtWellKnownName,
      columns: config.columns,
      rowHeight: config.rowHeight,
      gap: config.gap,
      variables: config.variables ?? [],
      timeFilter: config.timeFilter,
      timeZoneMode: config.timeZoneMode,
      entitySelectors: config.entitySelectors,
      autoRefreshSeconds: config.autoRefreshSeconds
    };
  }

  /**
   * Triggers a refresh of all widgets by creating new config references.
   * This causes ngOnChanges to fire in each widget, triggering data reload.
   */
  triggerRefresh(): void {
    this.updateConfig(config => ({
      ...config,
      widgets: config.widgets.map(w => ({ ...w }))
    }));
  }

  /**
   * Refreshes the list of available MeshBoards from the backend.
   */
  async refreshMeshBoardList(): Promise<void> {
    const meshBoards = await this.persistenceService.getMeshBoards();
    this._availableMeshBoards.set(meshBoards);
  }

  /** @deprecated Use refreshMeshBoardList instead */
  async refreshDashboardList(): Promise<void> {
    return this.refreshMeshBoardList();
  }

  /**
   * Creates a new MeshBoard and switches to it.
   */
  async createNewMeshBoard(name: string, description: string): Promise<string> {
    const rtId = await this.persistenceService.createMeshBoard(newMeshBoardConfig(name, description));
    await this.refreshMeshBoardList();
    await this.switchToMeshBoard(rtId);

    return rtId;
  }

  /** @deprecated Use createNewMeshBoard instead */
  async createNewDashboard(name: string, description: string): Promise<string> {
    return this.createNewMeshBoard(name, description);
  }

  /**
   * Renames the specified MeshBoard.
   */
  async renameMeshBoard(rtId: string, name: string, description: string): Promise<void> {
    await this.persistenceService.renameMeshBoard(rtId, name, description);
    await this.refreshMeshBoardList();

    // Update current config if it's the active MeshBoard
    if (this._persistedMeshBoardId() === rtId) {
      this.updateConfig(c => ({ ...c, name, description }));
    }
  }

  /** @deprecated Use renameMeshBoard instead */
  async renameDashboard(rtId: string, name: string, description: string): Promise<void> {
    return this.renameMeshBoard(rtId, name, description);
  }

  /**
   * Pins or unpins the specified MeshBoard for the host app's end-user
   * navigation and refreshes the list. The active board's config follows, so
   * a later save does not revert the change.
   */
  async setMeshBoardPinned(rtId: string, pinned: boolean): Promise<void> {
    const meshBoard = this._availableMeshBoards().find(m => m.rtId === rtId);
    if (!meshBoard) {
      return;
    }
    await this.persistenceService.setMeshBoardPinned(meshBoard, pinned);
    await this.refreshMeshBoardList();

    if (this._persistedMeshBoardId() === rtId) {
      this.updateConfig(c => ({ ...c, navigation: pinned ? { pinned: true, order: c.navigation?.order } : undefined }));
    }
  }

  /**
   * Duplicates an existing MeshBoard including all its widgets, variables, and time filter settings.
   * Returns the rtId of the newly created MeshBoard.
   */
  async duplicateMeshBoard(sourceRtId: string): Promise<string> {
    const result = await this.persistenceService.getMeshBoardWithWidgets(sourceRtId);
    if (!result) {
      throw new Error(`MeshBoard not found: ${sourceRtId}`);
    }

    const config = this.persistenceService.toMeshBoardConfig(result.meshBoard, result.widgets);
    config.name = `${config.name} (Copy)`;
    config.rtWellKnownName = undefined;

    const newRtId = await this.persistenceService.createMeshBoard(config);
    await this.refreshMeshBoardList();

    return newRtId;
  }

  /**
   * Deletes a MeshBoard.
   * If the deleted MeshBoard was the current one, switches to the first available.
   */
  async deleteMeshBoard(rtId: string): Promise<void> {
    await this.persistenceService.deleteMeshBoard(rtId);
    await this.refreshMeshBoardList();

    // If deleted MeshBoard was current, switch to first available
    if (this._persistedMeshBoardId() === rtId) {
      const meshBoards = this._availableMeshBoards();
      if (meshBoards.length > 0) {
        await this.switchToMeshBoard(meshBoards[0].rtId);
      } else {
        // No MeshBoards left - reset to empty state
        this._persistedMeshBoardId.set(null);
        this._existingWidgetRtIds.set([]);
        this._meshBoardConfig.set(this.createDefaultConfig());
      }
    }
  }

  /** @deprecated Use deleteMeshBoard instead */
  async deleteDashboard(rtId: string): Promise<void> {
    return this.deleteMeshBoard(rtId);
  }

  // ============================================================================
  // Variable Management
  // ============================================================================

  /**
   * Gets all variables: the MeshBoard configuration's variables plus the runtime
   * variables published by widgets. A configuration variable wins on a name clash.
   * Reads signals, so `computed()`s calling it react to both.
   */
  getVariables(): MeshBoardVariable[] {
    const configVariables = this.configVariables();
    const widgetVariables = this._widgetVariables();
    if (widgetVariables.length === 0) {
      return configVariables;
    }
    const configNames = new Set(configVariables.map(v => v.name));
    return [...configVariables, ...widgetVariables.filter(v => !configNames.has(v.name))];
  }

  /**
   * Variables stored in the MeshBoard configuration (without widget variables).
   * Every write path builds on this, so widget variables never reach the config.
   */
  private configVariables(): MeshBoardVariable[] {
    return this._meshBoardConfig().variables ?? [];
  }

  /**
   * Publishes a widget's value as runtime variable (source `'widget'`).
   * Replaces a variable the same widget published under another name, and does
   * nothing when name and value are unchanged, so publishing effects cannot loop.
   */
  setWidgetVariable(widgetId: string, name: string, value: string): void {
    const current = this._widgetVariables();
    const existing = current.find(v => v.widgetId === widgetId);
    if (existing && existing.name === name && existing.value === value) {
      return;
    }
    const variable: MeshBoardVariable = {
      name,
      type: value !== '' && !isNaN(Number(value)) ? 'number' : 'string',
      source: 'widget',
      value,
      widgetId
    };
    this._widgetVariables.set([...current.filter(v => v.widgetId !== widgetId), variable]);
  }

  private async currentTenantId(): Promise<string | null> {
    try {
      return (await this.tenantIdProvider?.()) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * A content-sized widget reports the natural height of its content in px (`null` removes it).
   * Must be measured on content whose height does not depend on the tile height, or a growing
   * tile would grow again. Changes below 1 px are ignored.
   */
  setWidgetContentHeight(widgetId: string, height: number | null): void {
    const current = this._widgetContentHeights();
    const previous = current.get(widgetId);
    if (height === null || !(height > 0)) {
      if (previous === undefined) {
        return;
      }
      const next = new Map(current);
      next.delete(widgetId);
      this._widgetContentHeights.set(next);
      return;
    }
    const rounded = Math.ceil(height);
    if (previous !== undefined && Math.abs(previous - rounded) < 1) {
      return;
    }
    this._widgetContentHeights.set(new Map(current).set(widgetId, rounded));
  }

  /**
   * A widget reports that it has nothing for the current viewer (`hidden: true`) or has again.
   * The view collapses such widgets outside edit mode; the flag is cleared on board switch.
   */
  setWidgetHiddenForViewer(widgetId: string, hidden: boolean): void {
    const current = this._hiddenForViewer();
    if (current.has(widgetId) === hidden) {
      return;
    }
    const next = new Set(current);
    if (hidden) {
      next.add(widgetId);
    } else {
      next.delete(widgetId);
    }
    this._hiddenForViewer.set(next);
  }

  /**
   * Removes the runtime variable published by a widget (e.g. when it is destroyed).
   */
  clearWidgetVariable(widgetId: string): void {
    const current = this._widgetVariables();
    if (current.some(v => v.widgetId === widgetId)) {
      this._widgetVariables.set(current.filter(v => v.widgetId !== widgetId));
    }
  }

  /**
   * Gets a specific variable by name.
   */
  getVariable(name: string): MeshBoardVariable | undefined {
    return this.getVariables().find(v => v.name === name);
  }

  /**
   * Updates all variables in the MeshBoard configuration.
   */
  updateVariables(variables: MeshBoardVariable[]): void {
    this.updateConfig(config => ({
      ...config,
      variables
    }));
  }

  /**
   * Sets the value of a single variable.
   */
  setVariableValue(name: string, value: string): void {
    const variables = [...this.configVariables()];
    const index = variables.findIndex(v => v.name === name);

    if (index >= 0) {
      variables[index] = { ...variables[index], value };
      this.updateVariables(variables);
    }
  }

  /**
   * Adds a new variable to the MeshBoard.
   */
  addVariable(variable: MeshBoardVariable): void {
    const variables = [...this.configVariables(), variable];
    this.updateVariables(variables);
  }

  /**
   * Removes a variable by name.
   */
  removeVariable(name: string): void {
    const variables = this.configVariables().filter(v => v.name !== name);
    this.updateVariables(variables);
  }

  // ============================================================================
  // Time Filter Management
  // ============================================================================

  /**
   * Checks if the time filter is enabled.
   */
  isTimeFilterEnabled(): boolean {
    return this._meshBoardConfig().timeFilter?.enabled ?? false;
  }

  /**
   * Gets the time filter configuration.
   */
  getTimeFilterConfig(): MeshBoardTimeFilterConfig | undefined {
    return this._meshBoardConfig().timeFilter;
  }

  /**
   * Resolves the current time-filter selection to a concrete UTC `{from, to}`
   * range. Returns `null` when the filter is disabled, no selection exists,
   * or the selection is incomplete.
   *
   * Stream-data persistent queries consume this to bound their result set;
   * runtime queries ignore it.
   *
   * Boundaries are resolved on the board's {@link timeZoneMode} basis (local by
   * default, or UTC), the same basis widgets format their datetime display on —
   * so the selected range and the displayed timestamps stay consistent.
   *
   * While an embedding host has set a period ({@link setHostTimeRange}, AB#7582)
   * and the board's time filter is enabled, the host's instants are returned
   * unchanged (no day snapping, no zone conversion) and the stored selection is
   * ignored; an invalid host period resolves to `null`.
   */
  resolveCurrentTimeRange(): TimeRange | null {
    const config = this._meshBoardConfig().timeFilter;
    if (!config?.enabled) {
      return null;
    }
    const host = this._hostTimeRange();
    if (host) {
      return host.status === 'valid' ? { from: new Date(host.from), to: new Date(host.to) } : null;
    }
    if (!config.selection) {
      return null;
    }
    const showTime = config.pickerConfig?.showTime ?? false;
    // The model stores customFrom/customTo as ISO strings for JSON persistence,
    // shared-ui's TimeRangeUtils expects Date objects — convert before delegating.
    const selection = config.selection;
    const sharedSelection: SharedTimeRangeSelection = {
      ...selection,
      customFrom: selection.customFrom ? new Date(selection.customFrom) : undefined,
      customTo: selection.customTo ? new Date(selection.customTo) : undefined
    } as SharedTimeRangeSelection;
    return TimeRangeUtils.getTimeRangeFromSelection(sharedSelection, showTime, this.timeZoneMode());
  }

  /**
   * Resolves the active time filter into stream-data `{from, to}` arguments for
   * a persistent-query widget. Centralizes the per-widget binding so every
   * stream-data consumer shares one implementation.
   *
   * Returns `undefined` (so the query's intrinsic bounds apply) when either:
   * - the widget opted out via `ignoreTimeFilter`, or
   * - no time filter is active / the selection is incomplete.
   */
  resolveStreamDataTimeArgs(ignoreTimeFilter?: boolean): { from: Date; to: Date } | undefined {
    if (ignoreTimeFilter) {
      return undefined;
    }
    const range = this.resolveCurrentTimeRange();
    if (!range) {
      return undefined;
    }
    return { from: range.from, to: range.to };
  }

  /**
   * The IANA time zone to forward to the resolution-aware series query so calendar
   * rollups are selected in the board's zone (AB#4190). Maps the board mode:
   * `'utc'` → `'UTC'`, an IANA id → itself, and `'local'` → the browser's own IANA
   * zone. The result is therefore always the same basis `resolveCurrentTimeRange()`
   * used to compute the `{from, to}` window — in `'local'` mode that window is built
   * from browser-local wall clocks, so naming that zone is what makes the two agree.
   *
   * `'local'` used to send nothing, which left the resolver on UTC. Under the default
   * per-query comparison policy a calendar rung stored in another zone then has no
   * determinate grain and drops out of the ladder, so the board silently fell back to
   * a finer rung, reported signal `Ok`, and drew a window that was not the one asked
   * for (AB#5157 review). `undefined` now only means the browser named no zone at all.
   */
  resolveStreamDataTimeZone(): string | undefined {
    const mode = this.timeZoneMode();
    if (mode === 'utc') {
      return 'UTC';
    }
    if (mode === 'local') {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
    }
    return mode;
  }

  /**
   * Marks an entity selector's scope as being resolved (AB#7721). Bound
   * stream-data widgets show their loading state and send no query until the
   * scope is resolved, failed or cleared — so they never flash rows of the
   * query's persisted (unscoped) scope while a pick is resolving.
   */
  setEntitySelectorScopePending(selectorId: string): void {
    this.setEntitySelectorScope(selectorId, { status: 'pending' });
  }

  /**
   * Stores the source rtIds resolved from an entity selector's current
   * selection. Called by the view component after a selection resolves (the
   * childScope traversal (one hop or a path), or the picked entity's own rtId when the
   * selector has no childScope). An empty array is a resolved EMPTY scope:
   * bound widgets show no data and send no query (AB#7721). Transient — not
   * persisted.
   */
  setEntitySelectorRtIds(selectorId: string, rtIds: string[]): void {
    this.setEntitySelectorScope(selectorId, { status: 'resolved', rtIds: [...rtIds] });
  }

  /**
   * Marks an entity selector's scope resolution as failed (e.g. the association
   * fetch threw). Bound widgets treat it like an empty scope — no data, no
   * query — and the view tells the user the scope could not be resolved
   * (AB#7721).
   */
  setEntitySelectorScopeFailed(selectorId: string): void {
    this.setEntitySelectorScope(selectorId, { status: 'failed' });
  }

  /**
   * Clears the scope state for an entity selector (its selection was cleared).
   * Bound widgets then query with the persisted scope again.
   */
  clearEntitySelectorRtIds(selectorId: string): void {
    this._entitySelectorScopes.update(map => {
      if (!(selectorId in map)) {
        return map;
      }
      const next = { ...map };
      delete next[selectorId];
      return next;
    });
  }

  /** The raw scope state of a selector, or `undefined` when it has no active pick. */
  getEntitySelectorScopeState(selectorId: string): EntitySelectorScopeState | undefined {
    return this._entitySelectorScopes()[selectorId];
  }

  /**
   * Ids of the selectors whose scope resolution failed (for the view's
   * "could not resolve the scope" notice, AB#7721).
   */
  readonly failedEntitySelectorScopeIds = computed(() =>
    Object.entries(this._entitySelectorScopes())
      .filter(([, state]) => state.status === 'failed')
      .map(([id]) => id)
  );

  /**
   * Decides how a widget runs its persistent query — the entry point every
   * built-in widget calls with its binding, query family and time-filter opt-out:
   *
   * 1. Host gate (AB#7582): while the embedding host's period is invalid, every
   *    stream-data query bound to the time filter is `empty` (`invalidTimeRange`),
   *    whatever its selector binding; pass the widget's `ignoreTimeFilter` so an
   *    opted-out widget, whose data does not depend on the period, keeps querying.
   *    Runtime queries have no time window and are not gated. A legacy config
   *    without `queryFamily` is treated as stream data here.
   * 2. Entity-selector scope ({@link resolveEntitySelectorScope}, AB#7721) — since
   *    AB#7725 for runtime queries too: `unscoped` / `pending` / `scoped` / `empty`.
   */
  resolveStreamDataScope(entitySelectorId?: string, family?: QueryFamily, ignoreTimeFilter?: boolean): StreamDataScope {
    if (family !== 'runtime' && this.isStreamDataBlockedByHostTimeRange(ignoreTimeFilter)) {
      return { kind: 'empty', reason: 'invalidTimeRange' };
    }
    return this.resolveEntitySelectorScope(entitySelectorId);
  }

  /**
   * The entity-selector part of {@link resolveStreamDataScope}, without the host
   * gate — stream data (AB#7721) and runtime queries alike (AB#7725):
   *
   * - `unscoped` — no binding, or no active pick: keep the query as saved.
   * - `pending` — the pick is still resolving: show loading, send no query.
   * - `scoped` — query restricted to the resolved rtIds: stream data via
   *   `streamDataArgs.rtIds`, runtime queries via the `rtId IN` field filter
   *   (`QueryExecutionOptions.scopeRtIds`).
   * - `empty` — the pick has nothing in scope or the lookup failed: show the
   *   no-data state and send no query. Never fall back to the persisted scope.
   */
  resolveEntitySelectorScope(entitySelectorId?: string): StreamDataScope {
    if (!entitySelectorId) {
      return { kind: 'unscoped' };
    }
    const state = this._entitySelectorScopes()[entitySelectorId];
    if (!state) {
      return { kind: 'unscoped' };
    }
    switch (state.status) {
      case 'pending':
        return { kind: 'pending' };
      case 'failed':
        return { kind: 'empty', reason: 'failed' };
      case 'resolved':
        return state.rtIds.length > 0
          ? { kind: 'scoped', rtIds: state.rtIds }
          : { kind: 'empty', reason: 'noTargets' };
    }
  }

  /**
   * Resolves the stream-data `rtIds` for a persistent-query widget bound to an
   * entity selector: the resolved source rtIds when the scope is `scoped`,
   * otherwise `undefined`.
   *
   * `undefined` does NOT mean "query with the persisted scope" for a pending or
   * empty scope — callers must check {@link resolveStreamDataScope} first and
   * skip the query for `pending` / `empty` (AB#7721).
   */
  resolveStreamDataRtIds(entitySelectorId?: string): string[] | undefined {
    const scope = this.resolveEntitySelectorScope(entitySelectorId);
    return scope.kind === 'scoped' ? scope.rtIds : undefined;
  }

  /** Marks a dependent selector's picker scope as resolving (AB#7915): the picker lists nothing yet. */
  setPickerScopePending(selectorId: string): void {
    this.setPickerScope(selectorId, { status: 'pending' });
  }

  /** Stores the rtIds a dependent selector's picker may list (AB#7915); `[]` = nothing in the leader's pick. */
  setPickerScopeRtIds(selectorId: string, rtIds: string[]): void {
    this.setPickerScope(selectorId, { status: 'resolved', rtIds: [...rtIds] });
  }

  /** Marks a dependent selector's picker scope as failed (AB#7915): the picker lists nothing. */
  setPickerScopeFailed(selectorId: string): void {
    this.setPickerScope(selectorId, { status: 'failed' });
  }

  /** Clears a dependent selector's picker scope (its leader has no pick): the picker lists unscoped. */
  clearPickerScope(selectorId: string): void {
    this._pickerScopes.update(map => {
      if (!(selectorId in map)) {
        return map;
      }
      const next = { ...map };
      delete next[selectorId];
      return next;
    });
  }

  /** The picker scope of a dependent selector, or `undefined` when its leader has no pick. */
  getPickerScopeState(selectorId: string): EntitySelectorScopeState | undefined {
    return this._pickerScopes()[selectorId];
  }

  private setPickerScope(selectorId: string, state: EntitySelectorScopeState): void {
    this._pickerScopes.update(map => ({ ...map, [selectorId]: state }));
  }

  private setEntitySelectorScope(selectorId: string, state: EntitySelectorScopeState): void {
    this._entitySelectorScopes.update(map => ({ ...map, [selectorId]: state }));
  }

  /**
   * Sets (or with `null` clears) the period of the page embedding the board
   * (AB#7582). Called by `MeshBoardViewComponent` for its `timeRange` input; a
   * host normally sets the input instead of calling this. Transient: not
   * persisted, not written into the board config, so it never causes unsaved
   * changes. Only takes effect while the board's time filter is enabled.
   */
  setHostTimeRange(state: HostTimeRangeState | null, owner?: object): void {
    this._hostTimeRange.set(state);
    this.hostTimeRangeOwner = state ? owner ?? null : null;
  }

  /**
   * Clears the host period only if `owner` set it (AB#7582). The service is
   * root-provided, so a view that is destroyed (or drops its `timeRange`) must not
   * clear a period another view set in the meantime.
   */
  clearHostTimeRange(owner: object): void {
    if (this.hostTimeRangeOwner === owner) {
      this.setHostTimeRange(null);
    }
  }

  /** The view (or other caller) that set the current host period, if it said so. */
  private hostTimeRangeOwner: object | null = null;

  /** The period set by the embedding host, or `null` when the board's own selection applies. */
  readonly hostTimeRange = this._hostTimeRange.asReadonly();

  /**
   * True when an invalid host period blocks a stream-data query that is bound to
   * the time filter (AB#7582): the period is invalid, the board's time filter is
   * enabled and the caller did not opt out with `ignoreTimeFilter`. Such a query
   * must not be sent — without a window it would read the whole archive.
   */
  isStreamDataBlockedByHostTimeRange(ignoreTimeFilter?: boolean): boolean {
    return !ignoreTimeFilter && this._hostTimeRange()?.status === 'invalid' && this.isTimeFilterEnabled();
  }

  /**
   * Updates the time filter configuration.
   */
  updateTimeFilterConfig(config: MeshBoardTimeFilterConfig): void {
    this.updateConfig(c => ({ ...c, timeFilter: config }));
  }

  /**
   * Updates the time filter selection and sets the predefined variables.
   */
  updateTimeFilterSelection(selection: TimeRangeSelection, fromISO: string, toISO: string): void {
    // Update selection in config
    this.updateConfig(c => ({
      ...c,
      timeFilter: {
        ...c.timeFilter,
        enabled: true,
        selection
      }
    }));

    // Update predefined variables
    this.setTimeFilterVariables(fromISO, toISO);
  }

  /**
   * Sets the time filter variables ($timeRangeFrom, $timeRangeTo).
   * Removes any existing timeFilter variables and adds the new ones.
   */
  setTimeFilterVariables(fromISO: string, toISO: string): void {
    // Filter out existing timeFilter variables
    const currentVars = this.configVariables().filter(v => v.source !== 'timeFilter');

    // Create new time filter variables
    const timeFilterVars: MeshBoardVariable[] = [
      {
        name: 'timeRangeFrom',
        type: 'datetime',
        source: 'timeFilter',
        value: fromISO
      },
      {
        name: 'timeRangeTo',
        type: 'datetime',
        source: 'timeFilter',
        value: toISO
      }
    ];

    // Update with combined variables
    this.updateVariables([...currentVars, ...timeFilterVars]);
  }

  /**
   * Clears time filter variables (called when time filter is disabled).
   */
  clearTimeFilterVariables(): void {
    const currentVars = this.configVariables().filter(v => v.source !== 'timeFilter');
    this.updateVariables(currentVars);
  }

  // ============================================================================
  // Entity Selector Management
  // ============================================================================

  /**
   * Gets all entity selector configurations.
   */
  getEntitySelectors(): EntitySelectorConfig[] {
    return this._meshBoardConfig().entitySelectors ?? [];
  }

  /**
   * Gets a specific entity selector by ID.
   */
  getEntitySelector(selectorId: string): EntitySelectorConfig | undefined {
    return this.getEntitySelectors().find(es => es.id === selectorId);
  }

  /**
   * Updates all entity selector configurations.
   */
  updateEntitySelectors(selectors: EntitySelectorConfig[]): void {
    this.updateConfig(config => ({
      ...config,
      entitySelectors: selectors
    }));
  }

  /**
   * Updates the selection state for a specific entity selector.
   */
  updateEntitySelectorSelection(selectorId: string, rtId: string | undefined, displayName?: string): void {
    this.updateConfig(config => ({
      ...config,
      entitySelectors: (config.entitySelectors ?? []).map(es =>
        es.id === selectorId
          ? { ...es, selectedRtId: rtId, selectedDisplayName: displayName }
          : es
      )
    }));
  }

  /**
   * Sets entity selector variables for a given selector.
   * Removes existing variables for this selector and adds new ones.
   */
  setEntitySelectorVariables(selectorId: string, values: { name: string; value: string; type?: string }[]): void {
    // Remove existing variables for this selector
    const currentVars = this.configVariables().filter(v =>
      !(v.source === 'entitySelector' && v.entitySelectorId === selectorId)
    );

    // Create new variables
    const selectorVars: MeshBoardVariable[] = values.map(v => ({
      name: v.name,
      type: (v.type ?? 'string') as MeshBoardVariable['type'],
      source: 'entitySelector' as MeshBoardVariableSource,
      value: v.value,
      entitySelectorId: selectorId
    }));

    this.updateVariables([...currentVars, ...selectorVars]);
  }

  /**
   * Clears entity selector variables for a given selector.
   */
  clearEntitySelectorVariables(selectorId: string): void {
    const currentVars = this.configVariables().filter(v =>
      !(v.source === 'entitySelector' && v.entitySelectorId === selectorId)
    );
    this.updateVariables(currentVars);
  }
}

/**
 * Layout defaults of a new, empty MeshBoard (6 columns, 200 px rows, 16 px gap). Shared by
 * `createNewMeshBoard` and hosts that create boards themselves (e.g. a board list page).
 */
export function newMeshBoardConfig(name: string, description = ''): MeshBoardConfig {
  return { id: '', name, description, columns: 6, rowHeight: 200, gap: 16, widgets: [] };
}
