import { Injectable, inject, signal, computed } from '@angular/core';
import { CkModelService } from '@meshmakers/octo-services';
import { MeshBoardPersistenceService, PersistedMeshBoard } from './meshboard-persistence.service';
import { MeshBoardGridService } from './meshboard-grid.service';
import {
  MeshBoardConfig,
  AnyWidgetConfig,
  MeshBoardVariable,
  MeshBoardTimeFilterConfig,
  TimeRangeSelection
} from '../models/meshboard.models';

/** The CK model required for the MeshBoard feature */
const REQUIRED_CK_MODEL = 'System.UI';
const REQUIRED_CK_MODEL_MIN_VERSION = '1.0.1';

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

  // Reactive state signals
  private readonly _meshBoardConfig = signal<MeshBoardConfig>(this.createDefaultConfig());
  private readonly _persistedMeshBoardId = signal<string | null>(null);
  /** Stores the rtIds of widgets that exist in the backend */
  private readonly _existingWidgetRtIds = signal<string[]>([]);
  private readonly _availableMeshBoards = signal<PersistedMeshBoard[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _isModelAvailable = signal<boolean | null>(null);

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

        // Fix any overlapping widgets from backend data
        const movedWidgets = this.gridService.resolveOverlaps(config.widgets, config.columns);
        if (movedWidgets.length > 0) {
          console.warn(`Resolved ${movedWidgets.length} overlapping widget(s)`);
        }

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
  }): void {
    this.updateConfig(config => ({
      ...config,
      name: settings.name,
      description: settings.description,
      rtWellKnownName: settings.rtWellKnownName || null,
      columns: settings.columns,
      rowHeight: settings.rowHeight,
      gap: settings.gap,
      variables: settings.variables ?? config.variables,
      timeFilter: settings.timeFilter
        ? {
            ...config.timeFilter,
            ...settings.timeFilter,
            // When a new defaultSelection is set, reset the stored selection to match
            selection: settings.timeFilter.defaultSelection ?? config.timeFilter?.selection
          }
        : config.timeFilter
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
      timeFilter: config.timeFilter
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
    const config: MeshBoardConfig = {
      id: '',
      name,
      description,
      columns: 6,
      rowHeight: 200,
      gap: 16,
      widgets: []
    };

    const rtId = await this.persistenceService.createMeshBoard(config);
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
   * Gets all variables from the current MeshBoard configuration.
   */
  getVariables(): MeshBoardVariable[] {
    return this._meshBoardConfig().variables ?? [];
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
    const variables = [...this.getVariables()];
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
    const variables = [...this.getVariables(), variable];
    this.updateVariables(variables);
  }

  /**
   * Removes a variable by name.
   */
  removeVariable(name: string): void {
    const variables = this.getVariables().filter(v => v.name !== name);
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
    const currentVars = this.getVariables().filter(v => v.source !== 'timeFilter');

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
    const currentVars = this.getVariables().filter(v => v.source !== 'timeFilter');
    this.updateVariables(currentVars);
  }
}
