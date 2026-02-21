import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ProcessDiagramConfig,
  ProcessDiagramRuntimeState,
  ProcessElement,
  ProcessConnection,
  ElementRuntimeData,
  ConnectionRuntimeData,
  ProcessDataBinding,
  Threshold,
  GetProcessDiagramDtoGQL,
  GetProcessDiagramsDtoGQL,
  CreateProcessDiagramDtoGQL,
  UpdateProcessDiagramDtoGQL
} from '@meshmakers/octo-process-diagrams';
import { FieldFilterDto } from '@meshmakers/octo-services';
import { MeshBoardDataService } from '../../../services/meshboard-data.service';
import { MeshBoardVariableService } from '../../../services/meshboard-variable.service';
import { MeshBoardStateService } from '../../../services/meshboard-state.service';
import { ExecuteRuntimeQueryDtoGQL, ExecuteRuntimeQueryQueryDto } from '../../../graphQL/executeRuntimeQuery';
import { RuntimeEntityData, WidgetFilterConfig } from '../../../models/meshboard.models';
import { ProcessWidgetConfig } from '../process-widget-config.model';

/**
 * Process Data Service
 *
 * Handles data loading and transformation for the Process Widget.
 *
 * Responsibilities:
 * - Load process diagram configurations from backend
 * - Fetch runtime data for elements based on their data bindings
 * - Apply value transformations (thresholds, percentages, mappings)
 * - Manage refresh cycles
 *
 * Phase 1: Static data + one-time entity loading
 * Future: GraphQL subscriptions for real-time updates
 *
 * @example
 * ```typescript
 * const diagram = await dataService.loadDiagram('diagram-rtId');
 * const state = await dataService.loadRuntimeData(diagram);
 * ```
 */
/**
 * Summary item for process diagram list
 */
export interface ProcessDiagramSummary {
  rtId: string;
  name: string;
  description?: string | null;
  version: string;
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Query result row from a persistent query
 */
export interface QueryResultRow {
  rtId?: string;
  ckTypeId?: string;
  cells: Map<string, unknown>;
}

/**
 * Result of a persistent query execution
 */
export interface QueryResultData {
  columns: { attributePath: string; attributeValueType?: string }[];
  rows: QueryResultRow[];
  totalCount: number;
}

/**
 * Result of data binding for the Process Widget
 */
export interface BoundDataResult {
  /** Type of data binding that produced this result */
  type: 'entity' | 'query';

  /** Single entity data (when type is 'entity' and bindingRtId was specified) */
  entity?: RuntimeEntityData;

  /** Query result data (when type is 'query') */
  queryResult?: QueryResultData;

  /** Error message if data loading failed */
  error?: string;

  /** Timestamp of the data load */
  loadedAt: Date;
}

@Injectable()
export class ProcessDataService {

  private readonly dataService = inject(MeshBoardDataService);
  private readonly variableService = inject(MeshBoardVariableService);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly getProcessDiagramGQL = inject(GetProcessDiagramDtoGQL);
  private readonly getProcessDiagramsGQL = inject(GetProcessDiagramsDtoGQL);
  private readonly createProcessDiagramGQL = inject(CreateProcessDiagramDtoGQL);
  private readonly updateProcessDiagramGQL = inject(UpdateProcessDiagramDtoGQL);
  private readonly executeRuntimeQueryGQL = inject(ExecuteRuntimeQueryDtoGQL);

  /**
   * Loads a list of available process diagrams from the backend
   *
   * @param searchText - Optional search text to filter diagrams
   * @returns List of process diagram summaries
   */
  async loadDiagramList(searchText?: string): Promise<ProcessDiagramSummary[]> {
    try {
      const result = await firstValueFrom(this.getProcessDiagramsGQL.fetch({
        first: 100,
        searchFilter: searchText ? { searchTerm: searchText, language: 'de' } : undefined
      } as any));

      const items = result.data?.runtime?.systemUIProcessDiagram?.items || [];
      return items
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .map(item => ({
          rtId: item.rtId,
          name: item.name,
          description: item.description,
          version: item.version,
          canvasWidth: item.canvasWidth,
          canvasHeight: item.canvasHeight
        }));
    } catch (error) {
      console.error('Error loading process diagrams:', error);
      return [];
    }
  }

  /**
   * Loads a process diagram configuration from the backend
   *
   * @param rtId - The runtime ID of the process diagram
   * @returns The process diagram configuration
   */
  async loadDiagram(rtId: string): Promise<ProcessDiagramConfig> {
    const result = await firstValueFrom(this.getProcessDiagramGQL.fetch({ variables: { rtId } }));

    const item = result.data?.runtime?.systemUIProcessDiagram?.items?.[0];
    if (!item) {
      throw new Error(`Process diagram not found: ${rtId}`);
    }

    // Parse JSON fields
    const elements = this.parseJsonField<ProcessElement[]>(item.elements, []);
    const itemWithExtensions = item as unknown as {
      primitives?: string;
      symbolInstances?: string;
      transformProperties?: string;
      propertyBindings?: string;
      animations?: string;
    };
    const primitives = itemWithExtensions.primitives
      ? this.parseJsonField(itemWithExtensions.primitives, [])
      : undefined;
    const symbolInstances = itemWithExtensions.symbolInstances
      ? this.parseJsonField(itemWithExtensions.symbolInstances, [])
      : undefined;
    const connections = this.parseJsonField<ProcessConnection[]>(item.connections, []);
    const variables = item.variables ? this.parseJsonField(item.variables, []) : undefined;

    // Parse diagram-level property fields
    const transformProperties = itemWithExtensions.transformProperties
      ? this.parseJsonField(itemWithExtensions.transformProperties, [])
      : undefined;
    const propertyBindings = itemWithExtensions.propertyBindings
      ? this.parseJsonField(itemWithExtensions.propertyBindings, [])
      : undefined;
    const animations = itemWithExtensions.animations
      ? this.parseJsonField(itemWithExtensions.animations, [])
      : undefined;

    return {
      id: item.rtId,
      name: item.name,
      description: item.description ?? undefined,
      version: item.version,
      canvas: {
        width: item.canvasWidth,
        height: item.canvasHeight,
        backgroundColor: item.canvasBackgroundColor ?? undefined
      },
      elements,
      primitives,
      symbolInstances,
      connections,
      variables,
      transformProperties,
      propertyBindings,
      animations,
      refreshInterval: item.refreshInterval ?? undefined
    };
  }

  /**
   * Creates a new process diagram in the backend
   *
   * @param diagram - The process diagram configuration to create
   * @returns The created diagram with its new rtId
   */
  async createDiagram(diagram: ProcessDiagramConfig): Promise<ProcessDiagramConfig> {
    const input = this.toInputDto(diagram);

    const result = await firstValueFrom(this.createProcessDiagramGQL.mutate({
      variables: { entities: [input] }
    }));

    const created = result.data?.runtime?.systemUIProcessDiagrams?.create?.[0];
    if (!created) {
      throw new Error('Failed to create process diagram');
    }

    return {
      ...diagram,
      id: created.rtId
    };
  }

  /**
   * Updates an existing process diagram in the backend
   *
   * @param diagram - The process diagram configuration to update
   * @returns The updated diagram
   */
  async updateDiagram(diagram: ProcessDiagramConfig): Promise<ProcessDiagramConfig> {
    if (!diagram.id) {
      throw new Error('Cannot update diagram without rtId');
    }

    const input = {
      rtId: diagram.id,
      item: this.toInputDto(diagram)
    };

    const result = await firstValueFrom(this.updateProcessDiagramGQL.mutate({
      variables: { entities: [input] }
    }));

    const updated = result.data?.runtime?.systemUIProcessDiagrams?.update?.[0];
    if (!updated) {
      throw new Error('Failed to update process diagram');
    }

    return diagram;
  }

  /**
   * Saves a process diagram (creates new or updates existing)
   *
   * @param diagram - The process diagram configuration to save
   * @param isNew - Whether this is a new diagram (default: false)
   * @returns The saved diagram
   */
  async saveDiagram(diagram: ProcessDiagramConfig, isNew = false): Promise<ProcessDiagramConfig> {
    if (isNew || !diagram.id) {
      return this.createDiagram(diagram);
    }
    return this.updateDiagram(diagram);
  }

  /**
   * Converts a ProcessDiagramConfig to the GraphQL input DTO format
   */
  private toInputDto(diagram: ProcessDiagramConfig): {
    name: string;
    description?: string;
    version: string;
    canvasWidth: number;
    canvasHeight: number;
    canvasBackgroundColor?: string;
    elements: string;
    primitives?: string;
    symbolInstances?: string;
    connections: string;
    variables?: string;
    refreshInterval?: number;
  } {
    // Debug: Log primitives being saved
    if (diagram.primitives && diagram.primitives.length > 0) {
      console.log('[ProcessDataService] Saving primitives:', diagram.primitives.length, 'items');
      console.log('[ProcessDataService] Primitive types:', diagram.primitives.map(p => p.type));
    }

    const primitivesJson = diagram.primitives && diagram.primitives.length > 0
      ? JSON.stringify(diagram.primitives)
      : undefined;

    return {
      name: diagram.name,
      description: diagram.description,
      version: diagram.version,
      canvasWidth: diagram.canvas.width,
      canvasHeight: diagram.canvas.height,
      canvasBackgroundColor: diagram.canvas.backgroundColor,
      elements: JSON.stringify(diagram.elements),
      primitives: primitivesJson,
      symbolInstances: diagram.symbolInstances ? JSON.stringify(diagram.symbolInstances) : undefined,
      connections: JSON.stringify(diagram.connections),
      variables: diagram.variables ? JSON.stringify(diagram.variables) : undefined,
      refreshInterval: diagram.refreshInterval
    };
  }

  /**
   * Parses a JSON string field with error handling
   */
  private parseJsonField<T>(json: string, defaultValue: T): T {
    try {
      return JSON.parse(json) as T;
    } catch (error) {
      console.error('Error parsing JSON field:', error);
      return defaultValue;
    }
  }

  /**
   * Loads runtime data for all elements and connections in a diagram
   *
   * @param diagram - The process diagram configuration
   * @returns Runtime state with element and connection data
   */
  async loadRuntimeData(diagram: ProcessDiagramConfig): Promise<ProcessDiagramRuntimeState> {
    const state: ProcessDiagramRuntimeState = {
      elements: new Map(),
      connections: new Map(),
      isLoading: false,
      lastRefresh: new Date()
    };

    // Load data for all elements with data bindings
    for (const element of diagram.elements) {
      if (element.dataBinding) {
        const data = await this.loadElementData(element);
        state.elements.set(element.id, data);
      }
    }

    // Load data for connections with data-driven animations
    for (const connection of diagram.connections) {
      if (connection.animation?.dataBinding) {
        const data = await this.loadConnectionData(connection);
        state.connections.set(connection.id, data);
      }
    }

    return state;
  }

  /**
   * Loads data for a single element
   */
  private async loadElementData(element: ProcessElement): Promise<ElementRuntimeData> {
    const binding = element.dataBinding!;
    const now = new Date();

    try {
      const value = await this.fetchValue(binding);
      const displayValue = this.formatDisplayValue(value, binding);
      const computedColor = this.computeColorFromThresholds(value, binding);

      return {
        elementId: element.id,
        value,
        displayValue,
        computedColor,
        animationActive: this.shouldAnimationBeActive(value, binding),
        lastUpdated: now
      };
    } catch (error) {
      console.error(`Error loading data for element ${element.id}:`, error);
      return {
        elementId: element.id,
        value: undefined,
        displayValue: '--',
        lastUpdated: now,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Loads data for a connection
   */
  private async loadConnectionData(connection: ProcessConnection): Promise<ConnectionRuntimeData> {
    const binding = connection.animation?.dataBinding;
    const now = new Date();

    if (!binding) {
      return {
        connectionId: connection.id,
        flowActive: connection.animation?.activeWhen === 'always',
        lastUpdated: now
      };
    }

    try {
      const value = await this.fetchValue(binding);
      const flowActive = this.shouldAnimationBeActive(value, binding);
      const flowRate = typeof value === 'number' ? value : undefined;

      return {
        connectionId: connection.id,
        flowActive,
        flowRate,
        lastUpdated: now
      };
    } catch (error) {
      console.error(`Error loading data for connection ${connection.id}:`, error);
      return {
        connectionId: connection.id,
        flowActive: false,
        lastUpdated: now,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fetches a value based on the data binding configuration
   */
  private async fetchValue(binding: ProcessDataBinding): Promise<unknown> {
    switch (binding.sourceType) {
      case 'static':
        return binding.sourceConfig.staticValue;

      case 'runtimeEntity':
        return this.fetchRuntimeEntityValue(binding);

      case 'persistentQuery':
        return this.fetchPersistentQueryValue(binding);

      default:
        throw new Error(`Unsupported data source type: ${binding.sourceType}`);
    }
  }

  /**
   * Fetches a value from a runtime entity
   */
  private async fetchRuntimeEntityValue(binding: ProcessDataBinding): Promise<unknown> {
    const { ckTypeId, rtId } = binding.sourceConfig;

    if (!ckTypeId || !rtId) {
      throw new Error('Runtime entity binding requires ckTypeId and rtId');
    }

    // Resolve variables in rtId (e.g., ${selectedTank})
    const resolvedRtId = this.resolveVariables(rtId);

    // Use MeshBoardDataService to fetch entity
    const entity = await firstValueFrom(
      this.dataService.fetchEntityWithAssociations(resolvedRtId, ckTypeId)
    );

    if (!entity) {
      throw new Error(`Entity not found: ${resolvedRtId}`);
    }

    // Extract attribute value
    return this.extractAttributeValue(entity, binding.attributePath);
  }

  /**
   * Fetches a value from a persistent query
   */
  private async fetchPersistentQueryValue(binding: ProcessDataBinding): Promise<unknown> {
    const { queryRtId } = binding.sourceConfig;

    if (!queryRtId) {
      throw new Error('Persistent query binding requires queryRtId');
    }

    // TODO: Implement persistent query execution
    // For now, return undefined
    console.warn('Persistent query data source not yet implemented');
    return undefined;
  }

  /**
   * Resolves variable references in a string
   * Supports ${variableName} syntax
   */
  private resolveVariables(input: string): string {
    const variables = this.stateService.getVariables();
    return this.variableService.resolveVariables(input, variables);
  }

  /**
   * Extracts an attribute value from an entity by path
   * Supports nested paths like "properties.temperature"
   */
  private extractAttributeValue(entity: { attributes?: { attributeName: string; value: unknown }[] }, path: string): unknown {
    if (!entity.attributes) return undefined;

    // Handle nested paths
    const parts = path.split('.');

    // First, try to find a direct attribute match
    const attr = entity.attributes.find(a => a.attributeName === path);
    if (attr) return attr.value;

    // Try to find by first part and navigate
    if (parts.length > 1) {
      const rootAttr = entity.attributes.find(a => a.attributeName === parts[0]);
      if (rootAttr && typeof rootAttr.value === 'object' && rootAttr.value !== null) {
        let value: unknown = rootAttr.value;
        for (let i = 1; i < parts.length; i++) {
          if (typeof value === 'object' && value !== null && parts[i] in (value as Record<string, unknown>)) {
            value = (value as Record<string, unknown>)[parts[i]];
          } else {
            return undefined;
          }
        }
        return value;
      }
    }

    return undefined;
  }

  /**
   * Formats a value for display based on transform configuration
   */
  private formatDisplayValue(value: unknown, binding: ProcessDataBinding): string {
    if (value === undefined || value === null) {
      return '--';
    }

    const transform = binding.transform;
    if (!transform) {
      return String(value);
    }

    const prefix = transform.prefix ?? '';
    const suffix = transform.suffix ?? '';
    const decimals = transform.decimals ?? 0;

    if (typeof value === 'number') {
      let displayValue = value;

      // Apply percentage transformation
      if (transform.type === 'percentage' && transform.min !== undefined && transform.max !== undefined) {
        const range = transform.max - transform.min;
        displayValue = ((value - transform.min) / range) * 100;
      }

      return `${prefix}${displayValue.toFixed(decimals)}${suffix}`;
    }

    // Check for value mappings
    if (transform.mappings) {
      const mapping = transform.mappings.find(m => m.input === value);
      if (mapping) {
        return `${prefix}${mapping.output}${suffix}`;
      }
    }

    return `${prefix}${value}${suffix}`;
  }

  /**
   * Computes color based on threshold configuration
   */
  private computeColorFromThresholds(value: unknown, binding: ProcessDataBinding): string | undefined {
    const thresholds = binding.transform?.thresholds;
    if (!thresholds || thresholds.length === 0) {
      return undefined;
    }

    if (typeof value !== 'number') {
      return undefined;
    }

    // Sort thresholds by value
    const sortedThresholds = [...thresholds].sort((a, b) => a.value - b.value);

    // Find the applicable threshold
    let applicableThreshold: Threshold | undefined;
    for (const threshold of sortedThresholds) {
      if (value >= threshold.value) {
        applicableThreshold = threshold;
      } else {
        break;
      }
    }

    return applicableThreshold?.color;
  }

  /**
   * Determines if animation should be active based on value
   */
  private shouldAnimationBeActive(value: unknown, _binding: ProcessDataBinding): boolean {
    // No activeWhen condition means always active
    // This is handled at a higher level for connections

    if (value === undefined || value === null) {
      return false;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value > 0;
    }

    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      return lowerValue === 'true' || lowerValue === 'on' || lowerValue === 'active' || lowerValue === 'running';
    }

    return false;
  }

  // ============================================================================
  // Widget Data Binding Methods
  // ============================================================================

  /**
   * Loads bound data based on widget configuration.
   * Supports both runtimeEntity and persistentQuery data binding modes.
   *
   * @param config - The process widget configuration with data binding settings
   * @returns BoundDataResult containing the loaded data, or null if no binding configured
   */
  async loadBoundData(config: ProcessWidgetConfig): Promise<BoundDataResult | null> {
    if (!config.dataBindingMode || config.dataBindingMode === 'none') {
      return null;
    }

    try {
      if (config.dataBindingMode === 'runtimeEntity') {
        return await this.loadBoundRuntimeEntityData(config);
      }

      if (config.dataBindingMode === 'persistentQuery') {
        return await this.loadBoundQueryData(config);
      }

      return null;
    } catch (error) {
      console.error('[ProcessDataService] Error loading bound data:', error);
      return {
        type: config.dataBindingMode === 'runtimeEntity' ? 'entity' : 'query',
        error: error instanceof Error ? error.message : 'Unknown error',
        loadedAt: new Date()
      };
    }
  }

  /**
   * Loads data from a runtime entity binding
   */
  private async loadBoundRuntimeEntityData(config: ProcessWidgetConfig): Promise<BoundDataResult> {
    const { bindingCkTypeId, bindingRtId } = config;

    if (!bindingCkTypeId) {
      throw new Error('Runtime entity binding requires a CK Type ID');
    }

    if (!bindingRtId) {
      throw new Error('Runtime entity binding requires a Runtime ID');
    }

    // Resolve variables in rtId (e.g., ${selectedEntity})
    const resolvedRtId = this.resolveVariables(bindingRtId);

    // Fetch the entity
    const entity = await firstValueFrom(
      this.dataService.fetchEntityWithAssociations(resolvedRtId, bindingCkTypeId)
    );

    if (!entity) {
      throw new Error(`Entity not found: ${resolvedRtId}`);
    }

    return {
      type: 'entity',
      entity,
      loadedAt: new Date()
    };
  }

  /**
   * Loads data from a persistent query binding
   */
  private async loadBoundQueryData(config: ProcessWidgetConfig): Promise<BoundDataResult> {
    const { bindingQueryRtId, bindingFilters } = config;

    if (!bindingQueryRtId) {
      throw new Error('Persistent query binding requires a Query rtId');
    }

    // Convert widget filters to GraphQL format with variable resolution
    const fieldFilters = this.convertFiltersToDto(bindingFilters);

    // Execute the query
    const result = await firstValueFrom(
      this.executeRuntimeQueryGQL.fetch({
        variables: {
          rtId: bindingQueryRtId,
          first: 1000, // Reasonable limit for process diagram data
          fieldFilter: fieldFilters
        }
      })
    );

    // Parse the query result
    const queryData = result.data?.runtime?.runtimeQuery?.items?.[0];
    if (!queryData) {
      throw new Error(`Query not found or returned no data: ${bindingQueryRtId}`);
    }

    // Map the result to our format
    const queryResult = this.mapQueryResult(queryData);

    return {
      type: 'query',
      queryResult,
      loadedAt: new Date()
    };
  }

  /**
   * Maps GraphQL query result to QueryResultData format
   */
  private mapQueryResult(queryData: NonNullable<NonNullable<NonNullable<ExecuteRuntimeQueryQueryDto['runtime']>['runtimeQuery']>['items']>[0]): QueryResultData {
    const columns = queryData.columns.map(col => ({
      attributePath: col.attributePath ?? '',
      attributeValueType: col.attributeValueType ?? undefined
    }));

    const rows: QueryResultRow[] = (queryData.rows?.items ?? []).map(row => {
      const cells = new Map<string, unknown>();

      for (const cell of row?.cells?.items ?? []) {
        if (cell?.attributePath) {
          cells.set(cell.attributePath, cell.value);
        }
      }

      // Handle different row types
      const typedRow = row as { rtId?: string; ckTypeId?: string };

      return {
        rtId: typedRow.rtId ?? undefined,
        ckTypeId: typedRow.ckTypeId ?? undefined,
        cells
      };
    });

    return {
      columns,
      rows,
      totalCount: queryData.rows?.totalCount ?? 0
    };
  }

  /**
   * Converts widget filter configuration to GraphQL FieldFilterDto format.
   * Resolves MeshBoard variables in filter values before conversion.
   */
  private convertFiltersToDto(filters?: WidgetFilterConfig[]): FieldFilterDto[] | undefined {
    const variables = this.stateService.getVariables();
    return this.variableService.convertToFieldFilterDto(filters, variables);
  }
}
