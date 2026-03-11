import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GetDashboardsDtoGQL } from '../graphQL/getDashboards';
import { CreateDashboardDtoGQL } from '../graphQL/createDashboard';
import { UpdateDashboardDtoGQL } from '../graphQL/updateDashboard';
import { CreateDashboardWidgetDtoGQL } from '../graphQL/createDashboardWidget';
import { UpdateDashboardWidgetDtoGQL } from '../graphQL/updateDashboardWidget';
import { DeleteEntitiesDtoGQL } from '../graphQL/deleteEntities';
import { GetDashboardWithWidgetsDtoGQL } from '../graphQL/getDashboardWithWidgets';
import { MeshBoardConfig, AnyWidgetConfig, MeshBoardVariable, MeshBoardTimeFilterConfig } from '../models/meshboard.models';
import { AssociationModOptionsDto, DeleteStrategiesDto, RtAssociationInputDto, SystemUiDashboardWidgetInputDto } from '../graphQL/globalTypes';
import { WidgetRegistryService, PersistedWidgetData } from './widget-registry.service';

/**
 * Defines how parent associations should be handled when mapping widget input
 */
export type ParentAssociationMode =
  | { type: 'create'; dashboardRtId: string }                                    // New widget: create association
  | { type: 'keep' }                                                              // Existing widget, same parent: no change
  | { type: 'move'; oldDashboardRtId: string; newDashboardRtId: string };        // Widget moved: delete old, create new

export interface PersistedMeshBoard {
  rtId: string;
  ckTypeId: string;
  rtWellKnownName?: string | null;
  name: string;
  description: string;
  columns: number;
  rowHeight: number;
  gap: number;
}

/** @deprecated Use PersistedMeshBoard instead */
export type PersistedDashboard = PersistedMeshBoard;

export interface PersistedWidget {
  rtId: string;
  ckTypeId: string;
  name: string;
  type: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  dataSourceType: string;
  dataSourceCkTypeId?: string | null;
  dataSourceRtId?: string | null;
  config: string;
}

/**
 * Result of updating a dashboard, including created widget mappings
 */
export interface UpdateDashboardResult {
  createdWidgets: { localId: string; rtId: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class MeshBoardPersistenceService {
  private readonly getDashboardsGQL = inject(GetDashboardsDtoGQL);
  private readonly getDashboardWithWidgetsGQL = inject(GetDashboardWithWidgetsDtoGQL);
  private readonly createDashboardGQL = inject(CreateDashboardDtoGQL);
  private readonly updateDashboardGQL = inject(UpdateDashboardDtoGQL);
  private readonly createWidgetGQL = inject(CreateDashboardWidgetDtoGQL);
  private readonly updateWidgetGQL = inject(UpdateDashboardWidgetDtoGQL);
  private readonly deleteEntitiesGQL = inject(DeleteEntitiesDtoGQL);
  private readonly widgetRegistry = inject(WidgetRegistryService);

  private readonly DASHBOARD_CK_TYPE_ID = 'System.UI/Dashboard';
  private readonly WIDGET_CK_TYPE_ID = 'System.UI/DashboardWidget';

  /**
   * Marker used to encode variables in the description field.
   * Format: <description>\n---MESHBOARD_VARIABLES---\n<json>
   *
   * Note: This is a temporary solution until the backend schema is updated
   * to include a dedicated 'config' field for MeshBoard configuration.
   *
   * The marker is detected without relying on surrounding newlines because
   * the backend may trim leading/trailing whitespace from the description field.
   */
  private readonly VARIABLES_MARKER = '---MESHBOARD_VARIABLES---';

  /**
   * Fetches all available MeshBoards
   */
  async getMeshBoards(first = 100): Promise<PersistedMeshBoard[]> {
    const result = await firstValueFrom(
      this.getDashboardsGQL.fetch({ variables: { first }, fetchPolicy: 'network-only' })
    );
    const items = result.data?.runtime?.systemUIDashboard?.items ?? [];

    return items
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map(item => ({
        rtId: item.rtId,
        ckTypeId: item.ckTypeId,
        rtWellKnownName: item.rtWellKnownName,
        name: item.name,
        description: item.description,
        columns: item.columns,
        rowHeight: item.rowHeight,
        gap: item.gap
      }));
  }

  /**
   * Fetches a MeshBoard with all its widgets
   */
  async getMeshBoardWithWidgets(rtId: string): Promise<{ meshBoard: PersistedMeshBoard; widgets: PersistedWidget[] } | null> {
    const result = await firstValueFrom(
      this.getDashboardWithWidgetsGQL.fetch({ variables: { rtId }, fetchPolicy: 'network-only' })
    );
    const dashboard = result.data?.runtime?.systemUIDashboard?.items?.[0];

    if (!dashboard) {
      return null;
    }

    const widgets = dashboard.children?.items ?? [];

    return {
      meshBoard: {
        rtId: dashboard.rtId,
        ckTypeId: dashboard.ckTypeId,
        rtWellKnownName: dashboard.rtWellKnownName,
        name: dashboard.name,
        description: dashboard.description,
        columns: dashboard.columns,
        rowHeight: dashboard.rowHeight,
        gap: dashboard.gap
      },
      widgets: widgets
        .filter((w): w is NonNullable<typeof w> => w !== null)
        .map(w => ({
          rtId: w.rtId,
          ckTypeId: w.ckTypeId,
          name: w.name,
          type: w.type,
          col: w.col,
          row: w.row,
          colSpan: w.colSpan,
          rowSpan: w.rowSpan,
          dataSourceType: w.dataSourceType,
          dataSourceCkTypeId: w.dataSourceCkTypeId,
          dataSourceRtId: w.dataSourceRtId,
          config: w.config
        }))
    };
  }

  /**
   * Creates a new MeshBoard with its widgets
   */
  async createMeshBoard(config: MeshBoardConfig): Promise<string> {
    // Encode variables and timeFilter in description field (temporary until backend adds config field)
    const encodedDescription = this.encodeVariablesInDescription(
      config.description ?? '',
      config.variables,
      config.timeFilter
    );

    const dashboardInput: Record<string, unknown> = {
      name: config.name,
      description: encodedDescription,
      columns: config.columns,
      rowHeight: config.rowHeight,
      gap: config.gap
    };

    // Only set rtWellKnownName if provided
    if (config.rtWellKnownName) {
      dashboardInput['rtWellKnownName'] = config.rtWellKnownName;
    }

    const result = await firstValueFrom(
      this.createDashboardGQL.mutate({ variables: { entities: [dashboardInput] } })
    );

    const createdDashboard = result.data?.runtime?.systemUIDashboards?.create?.[0];
    if (!createdDashboard) {
      throw new Error('Failed to create dashboard');
    }

    const dashboardRtId = createdDashboard.rtId;

    // Create widgets with parent association to dashboard
    if (config.widgets.length > 0) {
      const widgetInputs = config.widgets.map(widget =>
        this.mapWidgetToInput(widget, { type: 'create', dashboardRtId })
      );
      await firstValueFrom(
        this.createWidgetGQL.mutate({ variables: { entities: widgetInputs } })
      );
    }

    return dashboardRtId;
  }

  /**
   * Updates an existing MeshBoard and its widgets.
   * Returns mapping of created widgets (localId -> rtId) for state synchronization.
   */
  async updateMeshBoard(rtId: string, config: MeshBoardConfig, existingWidgetRtIds: string[] = []): Promise<UpdateDashboardResult> {
    const result: UpdateDashboardResult = { createdWidgets: [] };

    // Encode variables and timeFilter in description field (temporary until backend adds config field)
    const encodedDescription = this.encodeVariablesInDescription(
      config.description ?? '',
      config.variables,
      config.timeFilter
    );

    const dashboardItem: Record<string, unknown> = {
      name: config.name,
      description: encodedDescription,
      columns: config.columns,
      rowHeight: config.rowHeight,
      gap: config.gap
    };

    // Include rtWellKnownName in update (can be set or cleared)
    dashboardItem['rtWellKnownName'] = config.rtWellKnownName || null;

    const dashboardUpdate = {
      rtId,
      item: dashboardItem
    };

    // Update dashboard
    await firstValueFrom(
      this.updateDashboardGQL.mutate({ variables: { entities: [dashboardUpdate] } })
    );

    // Find widgets to delete (exist in backend but not in current config)
    // Use rtId for comparison since that's the backend identifier
    const currentWidgetRtIds = config.widgets
      .map(w => w.rtId)
      .filter((id): id is string => id !== undefined);
    const widgetsToDelete = existingWidgetRtIds.filter(id => !currentWidgetRtIds.includes(id));

    // Delete removed widgets
    if (widgetsToDelete.length > 0) {
      const deleteInput = widgetsToDelete.map(widgetRtId => ({
        rtId: widgetRtId,
        ckTypeId: this.WIDGET_CK_TYPE_ID
      }));
      await firstValueFrom(
        this.deleteEntitiesGQL.mutate({ variables: { rtEntityIds: deleteInput, deleteStrategy: DeleteStrategiesDto.EraseDto } })
      );
    }

    // Update existing widgets and create new ones
    const updatePromises: Promise<unknown>[] = [];

    for (const widget of config.widgets) {
      if (widget.rtId && existingWidgetRtIds.includes(widget.rtId)) {
        // Update existing widget - use rtId for the update
        const widgetUpdate = {
          rtId: widget.rtId,
          item: this.mapWidgetToInput(widget, { type: 'keep' })
        };
        updatePromises.push(
          firstValueFrom(this.updateWidgetGQL.mutate({ variables: { entities: [widgetUpdate] } }))
        );
      } else {
        // Create new widget - create association to this dashboard
        const widgetInput = this.mapWidgetToInput(widget, { type: 'create', dashboardRtId: rtId });
        const createPromise = firstValueFrom(
          this.createWidgetGQL.mutate({ variables: { entities: [widgetInput] } })
        ).then(createResult => {
          const createdWidget = createResult.data?.runtime?.systemUIDashboardWidgets?.create?.[0];
          if (createdWidget?.rtId) {
            result.createdWidgets.push({ localId: widget.id, rtId: createdWidget.rtId });
          }
        });
        updatePromises.push(createPromise);
      }
    }

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    return result;
  }

  /**
   * Converts a persisted MeshBoard to MeshBoardConfig
   */
  toMeshBoardConfig(meshBoard: PersistedMeshBoard, widgets: PersistedWidget[]): MeshBoardConfig {
    // Decode variables and timeFilter from description field (temporary until backend adds config field)
    const { description, variables, timeFilter } = this.decodeVariablesFromDescription(meshBoard.description);

    return {
      id: meshBoard.rtId,
      name: meshBoard.name,
      description,
      rtWellKnownName: meshBoard.rtWellKnownName,
      columns: meshBoard.columns,
      rowHeight: meshBoard.rowHeight,
      gap: meshBoard.gap,
      variables,
      timeFilter,
      widgets: widgets.map(w => this.toWidgetConfig(w))
    };
  }

  /**
   * Converts a persisted widget to AnyWidgetConfig.
   * Delegates to WidgetRegistryService for widget-specific deserialization (SOLID: Open/Closed Principle).
   */
  private toWidgetConfig(widget: PersistedWidget): AnyWidgetConfig {
    // Convert PersistedWidget to PersistedWidgetData format expected by registry
    const persistedData: PersistedWidgetData = {
      rtId: widget.rtId,
      ckTypeId: widget.ckTypeId,
      name: widget.name,
      type: widget.type,
      col: widget.col,
      row: widget.row,
      colSpan: widget.colSpan,
      rowSpan: widget.rowSpan,
      dataSourceType: widget.dataSourceType,
      dataSourceCkTypeId: widget.dataSourceCkTypeId,
      dataSourceRtId: widget.dataSourceRtId,
      config: widget.config
    };

    // Delegate to registry - no switch statement needed!
    return this.widgetRegistry.deserializeWidget(persistedData);
  }

  /**
   * Maps widget config to GraphQL input.
   * Delegates to WidgetRegistryService for widget-specific serialization (SOLID: Open/Closed Principle).
   */
  private mapWidgetToInput(widget: AnyWidgetConfig, associationMode: ParentAssociationMode): SystemUiDashboardWidgetInputDto {
    // Delegate to registry for widget-specific serialization - no switch statement needed!
    const persistenceData = this.widgetRegistry.serializeWidget(widget);

    // Build parent association based on mode
    const parentAssociations = this.buildParentAssociations(associationMode);

    // Map persistentQuery to systemQuery for backend storage
    const dataSourceType = persistenceData.dataSourceType === 'persistentQuery' ? 'systemQuery' : persistenceData.dataSourceType;

    const result: SystemUiDashboardWidgetInputDto = {
      name: widget.title,
      type: widget.type,
      col: Math.round(widget.col),
      row: Math.round(widget.row),
      colSpan: Math.round(widget.colSpan),
      rowSpan: Math.round(widget.rowSpan),
      dataSourceType,
      dataSourceCkTypeId: persistenceData.dataSourceCkTypeId ?? '',
      dataSourceRtId: persistenceData.dataSourceRtId ?? '',
      config: JSON.stringify(persistenceData.config)
    };

    // Only include parent if there are association changes
    if (parentAssociations.length > 0) {
      result.parent = parentAssociations;
    }

    return result;
  }

  /**
   * Builds parent association array based on the association mode
   */
  private buildParentAssociations(mode: ParentAssociationMode): RtAssociationInputDto[] {
    switch (mode.type) {
      case 'create':
        // New widget: create association to dashboard
        return [{
          modOption: AssociationModOptionsDto.CreateDto,
          target: { rtId: mode.dashboardRtId, ckTypeId: this.DASHBOARD_CK_TYPE_ID }
        }];

      case 'keep':
        // Existing widget, same parent: no association changes
        return [];

      case 'move':
        // Widget moved to different dashboard: delete old, create new
        return [
          {
            modOption: AssociationModOptionsDto.DeleteDto,
            target: { rtId: mode.oldDashboardRtId, ckTypeId: this.DASHBOARD_CK_TYPE_ID }
          },
          {
            modOption: AssociationModOptionsDto.CreateDto,
            target: { rtId: mode.newDashboardRtId, ckTypeId: this.DASHBOARD_CK_TYPE_ID }
          }
        ];
    }
  }

  /**
   * Deletes a MeshBoard and all its widgets (via cascade delete)
   */
  async deleteMeshBoard(rtId: string): Promise<void> {
    await firstValueFrom(
      this.deleteEntitiesGQL.mutate({
        variables: {
          rtEntityIds: [{ rtId, ckTypeId: this.DASHBOARD_CK_TYPE_ID }],
          deleteStrategy: DeleteStrategiesDto.EraseDto
        }
      })
    );
  }

  /**
   * Renames a MeshBoard (updates name and description)
   */
  async renameMeshBoard(rtId: string, name: string, description: string): Promise<void> {
    await firstValueFrom(
      this.updateDashboardGQL.mutate({
        variables: {
          entities: [{
            rtId,
            item: { name, description }
          }]
        }
      })
    );
  }

  // ============================================================================
  // Variable Persistence Helpers
  // ============================================================================

  /**
   * Encodes variables and timeFilter into the description field.
   * Format: <description>\n---MESHBOARD_VARIABLES---\n<json>
   *
   * Note: Only static variables are persisted. TimeFilter variables are derived
   * from the timeFilter selection when the MeshBoard is loaded.
   */
  private encodeVariablesInDescription(
    description: string,
    variables?: MeshBoardVariable[],
    timeFilter?: MeshBoardTimeFilterConfig
  ): string {
    // Filter out timeFilter variables (they are derived, not persisted directly)
    const staticVariables = variables?.filter(v => v.source !== 'timeFilter');

    // Check if there's anything to encode
    if ((!staticVariables || staticVariables.length === 0) && !timeFilter?.enabled) {
      return description;
    }

    try {
      const data: { variables?: MeshBoardVariable[]; timeFilter?: MeshBoardTimeFilterConfig } = {};

      if (staticVariables && staticVariables.length > 0) {
        data.variables = staticVariables;
      }

      if (timeFilter?.enabled) {
        data.timeFilter = timeFilter;
      }

      const dataJson = JSON.stringify(data);
      // Use newline before marker to separate from description text.
      // Note: backend may trim leading newline if description is empty, so the
      // decoder must handle the marker appearing at the start of the string.
      return `${description}\n${this.VARIABLES_MARKER}\n${dataJson}`;
    } catch (error) {
      console.error('Failed to encode MeshBoard config data:', error);
      return description;
    }
  }

  /**
   * Decodes variables and timeFilter from the description field.
   * Returns the original description, parsed variables, and timeFilter config.
   *
   * Handles both legacy format (just variables array) and new format (object with variables and timeFilter).
   * Robust against leading/trailing whitespace trimming by the backend.
   */
  private decodeVariablesFromDescription(rawDescription: string): {
    description: string;
    variables: MeshBoardVariable[];
    timeFilter?: MeshBoardTimeFilterConfig;
  } {
    // Use the marker without newlines for detection, since the backend may trim
    // leading whitespace (removing the \n before the marker when description is empty).
    const markerIndex = rawDescription.indexOf(this.VARIABLES_MARKER);
    if (markerIndex === -1) {
      return { description: rawDescription, variables: [] };
    }

    // Extract description (everything before the marker, trimmed of trailing newlines)
    const description = rawDescription.substring(0, markerIndex).replace(/\n+$/, '');

    // Extract JSON (everything after the marker, trimmed of leading newlines)
    const jsonPart = rawDescription.substring(markerIndex + this.VARIABLES_MARKER.length).replace(/^\n+/, '');

    try {
      const parsed = JSON.parse(jsonPart);

      // Handle legacy format: direct array of variables
      if (Array.isArray(parsed)) {
        return { description, variables: parsed as MeshBoardVariable[] };
      }

      // New format: object with variables and timeFilter
      return {
        description,
        variables: parsed.variables ?? [],
        timeFilter: parsed.timeFilter
      };
    } catch (error) {
      console.error('Failed to decode MeshBoard config data:', error);
      return { description, variables: [] };
    }
  }
}
