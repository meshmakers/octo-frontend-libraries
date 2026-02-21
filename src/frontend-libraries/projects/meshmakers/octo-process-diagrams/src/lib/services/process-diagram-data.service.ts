import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ProcessDiagramConfig,
  ProcessElement,
  ProcessConnection
} from '../process-widget.models';
import { GetProcessDiagramDtoGQL } from '../graphQL/getProcessDiagram';
import { GetProcessDiagramsDtoGQL } from '../graphQL/getProcessDiagrams';
import { CreateProcessDiagramDtoGQL } from '../graphQL/createProcessDiagram';
import { UpdateProcessDiagramDtoGQL } from '../graphQL/updateProcessDiagram';
import { DeleteProcessDiagramDtoGQL } from '../graphQL/deleteProcessDiagram';

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
 * Process Diagram Data Service
 *
 * Handles CRUD operations for process diagrams.
 * This service is in octo-process-diagrams to enable proper lazy loading.
 *
 * For runtime data binding (connecting elements to live data),
 * use ProcessDataService from @meshmakers/octo-meshboard.
 *
 * @example
 * ```typescript
 * const diagrams = await dataService.loadDiagramList();
 * const diagram = await dataService.loadDiagram('rtId');
 * await dataService.saveDiagram(diagram);
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class ProcessDiagramDataService {
  private readonly getProcessDiagramGQL = inject(GetProcessDiagramDtoGQL);
  private readonly getProcessDiagramsGQL = inject(GetProcessDiagramsDtoGQL);
  private readonly createProcessDiagramGQL = inject(CreateProcessDiagramDtoGQL);
  private readonly updateProcessDiagramGQL = inject(UpdateProcessDiagramDtoGQL);
  private readonly deleteProcessDiagramGQL = inject(DeleteProcessDiagramDtoGQL);

  /**
   * Loads a list of available process diagrams from the backend
   *
   * @param searchText - Optional search text to filter diagrams
   * @returns List of process diagram summaries
   */
  async loadDiagramList(searchText?: string): Promise<ProcessDiagramSummary[]> {
    try {
      const result = await firstValueFrom(this.getProcessDiagramsGQL.fetch({
        variables: {
          first: 100,
          searchFilter: searchText ? { searchTerm: searchText } : undefined
        }
      }));

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
    const primitives = item.primitives
      ? this.parseJsonField(item.primitives, [])
      : undefined;
    const symbolInstances = item.symbolInstances
      ? this.parseJsonField(item.symbolInstances, [])
      : undefined;
    const connections = this.parseJsonField<ProcessConnection[]>(item.connections, []);
    const variables = item.variables ? this.parseJsonField(item.variables, []) : undefined;

    // Parse diagram-level property fields
    const transformProperties = item.transformProperties
      ? this.parseJsonField(item.transformProperties, [])
      : undefined;
    const propertyBindings = item.propertyBindings
      ? this.parseJsonField(item.propertyBindings, [])
      : undefined;
    const animations = item.animations
      ? this.parseJsonField(item.animations, [])
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
   * Deletes a process diagram from the backend
   *
   * @param rtId - The runtime ID of the process diagram to delete
   * @returns True if deletion was successful
   */
  async deleteDiagram(rtId: string): Promise<boolean> {
    try {
      const result = await firstValueFrom(this.deleteProcessDiagramGQL.mutate({
        variables: {
          rtEntityIds: [{
            ckTypeId: 'System.UI/ProcessDiagram',
            rtId
          }]
        }
      }));

      return result.data?.runtime?.runtimeEntities?.delete ?? false;
    } catch (error) {
      console.error('Error deleting process diagram:', error);
      throw error;
    }
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
    transformProperties?: string;
    propertyBindings?: string;
    animations?: string;
    refreshInterval?: number;
  } {
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
      transformProperties: diagram.transformProperties && diagram.transformProperties.length > 0
        ? JSON.stringify(diagram.transformProperties)
        : undefined,
      propertyBindings: diagram.propertyBindings && diagram.propertyBindings.length > 0
        ? JSON.stringify(diagram.propertyBindings)
        : undefined,
      animations: diagram.animations && diagram.animations.length > 0
        ? JSON.stringify(diagram.animations)
        : undefined,
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
}
