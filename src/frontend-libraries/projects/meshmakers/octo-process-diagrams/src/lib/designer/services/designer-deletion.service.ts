import { Injectable } from '@angular/core';
import { ProcessDiagramConfig, ProcessElement, ProcessConnection } from '../../process-widget.models';
import { PrimitiveBase, isGroupPrimitive, GroupPrimitive } from '../../primitives';
import { SymbolInstance } from '../../primitives/models/symbol.model';

/**
 * Result of a deletion operation
 */
export interface DeletionResult {
  elements: ProcessElement[];
  primitives: PrimitiveBase[];
  symbolInstances: SymbolInstance[];
  connections: ProcessConnection[];
  /** IDs that were deleted */
  deletedIds: Set<string>;
}

/**
 * Designer Deletion Service
 *
 * Handles deletion of diagram elements, primitives, symbols, and connections.
 * Automatically handles group deletion by also deleting group children.
 *
 * Follows Single Responsibility Principle - only handles deletion logic.
 * Returns new arrays without mutating the original diagram.
 *
 * Usage:
 * ```typescript
 * private readonly deletionService = inject(DesignerDeletionService);
 *
 * // Delete selected items
 * deleteSelected(): void {
 *   const result = this.deletionService.deleteItems(diagram, elementIds, connectionIds);
 *   this._diagram.update(d => ({
 *     ...d,
 *     elements: result.elements,
 *     primitives: result.primitives,
 *     symbolInstances: result.symbolInstances,
 *     connections: result.connections
 *   }));
 * }
 * ```
 */
@Injectable()
export class DesignerDeletionService {

  // ============================================================================
  // Deletion Operations
  // ============================================================================

  /**
   * Delete items by ID.
   * Automatically expands selection to include group children.
   *
   * @param diagram Current diagram state
   * @param itemIds IDs of elements, primitives, or symbols to delete
   * @param connectionIds IDs of connections to delete
   * @returns New arrays with items removed
   */
  deleteItems(
    diagram: ProcessDiagramConfig,
    itemIds: Set<string>,
    connectionIds = new Set<string>()
  ): DeletionResult {
    if (itemIds.size === 0 && connectionIds.size === 0) {
      return {
        elements: diagram.elements,
        primitives: diagram.primitives ?? [],
        symbolInstances: diagram.symbolInstances ?? [],
        connections: diagram.connections,
        deletedIds: new Set()
      };
    }

    // Expand selection to include children of any groups
    const expandedIds = this.expandWithGroupChildren(diagram, itemIds);

    // Filter out deleted items
    const elements = diagram.elements.filter(e => !expandedIds.has(e.id));
    const primitives = (diagram.primitives ?? []).filter(p => !expandedIds.has(p.id));
    const symbolInstances = (diagram.symbolInstances ?? []).filter(s => !expandedIds.has(s.id));

    // Delete connections
    // Also remove connections that reference deleted elements
    const connections = diagram.connections.filter(c =>
      !connectionIds.has(c.id) &&
      !expandedIds.has(c.from.elementId) &&
      !expandedIds.has(c.to.elementId)
    );

    return {
      elements,
      primitives,
      symbolInstances,
      connections,
      deletedIds: expandedIds
    };
  }

  /**
   * Delete only elements.
   *
   * @param diagram Current diagram state
   * @param elementIds IDs of elements to delete
   * @returns New arrays with elements removed
   */
  deleteElements(diagram: ProcessDiagramConfig, elementIds: Set<string>): DeletionResult {
    if (elementIds.size === 0) {
      return {
        elements: diagram.elements,
        primitives: diagram.primitives ?? [],
        symbolInstances: diagram.symbolInstances ?? [],
        connections: diagram.connections,
        deletedIds: new Set()
      };
    }

    const elements = diagram.elements.filter(e => !elementIds.has(e.id));

    // Also remove connections that reference deleted elements
    const connections = diagram.connections.filter(c =>
      !elementIds.has(c.from.elementId) &&
      !elementIds.has(c.to.elementId)
    );

    return {
      elements,
      primitives: diagram.primitives ?? [],
      symbolInstances: diagram.symbolInstances ?? [],
      connections,
      deletedIds: elementIds
    };
  }

  /**
   * Delete only primitives.
   * Automatically expands to include group children if a group is deleted.
   *
   * @param diagram Current diagram state
   * @param primitiveIds IDs of primitives to delete
   * @returns New arrays with primitives removed
   */
  deletePrimitives(diagram: ProcessDiagramConfig, primitiveIds: Set<string>): DeletionResult {
    if (primitiveIds.size === 0) {
      return {
        elements: diagram.elements,
        primitives: diagram.primitives ?? [],
        symbolInstances: diagram.symbolInstances ?? [],
        connections: diagram.connections,
        deletedIds: new Set()
      };
    }

    // Expand to include group children
    const expandedIds = this.expandWithGroupChildren(diagram, primitiveIds);

    const primitives = (diagram.primitives ?? []).filter(p => !expandedIds.has(p.id));
    const symbolInstances = (diagram.symbolInstances ?? []).filter(s => !expandedIds.has(s.id));

    return {
      elements: diagram.elements,
      primitives,
      symbolInstances,
      connections: diagram.connections,
      deletedIds: expandedIds
    };
  }

  /**
   * Delete only symbol instances.
   *
   * @param diagram Current diagram state
   * @param symbolIds IDs of symbol instances to delete
   * @returns New arrays with symbols removed
   */
  deleteSymbols(diagram: ProcessDiagramConfig, symbolIds: Set<string>): DeletionResult {
    if (symbolIds.size === 0) {
      return {
        elements: diagram.elements,
        primitives: diagram.primitives ?? [],
        symbolInstances: diagram.symbolInstances ?? [],
        connections: diagram.connections,
        deletedIds: new Set()
      };
    }

    const symbolInstances = (diagram.symbolInstances ?? []).filter(s => !symbolIds.has(s.id));

    return {
      elements: diagram.elements,
      primitives: diagram.primitives ?? [],
      symbolInstances,
      connections: diagram.connections,
      deletedIds: symbolIds
    };
  }

  /**
   * Delete only connections.
   *
   * @param diagram Current diagram state
   * @param connectionIds IDs of connections to delete
   * @returns New arrays with connections removed
   */
  deleteConnections(diagram: ProcessDiagramConfig, connectionIds: Set<string>): DeletionResult {
    if (connectionIds.size === 0) {
      return {
        elements: diagram.elements,
        primitives: diagram.primitives ?? [],
        symbolInstances: diagram.symbolInstances ?? [],
        connections: diagram.connections,
        deletedIds: new Set()
      };
    }

    const connections = diagram.connections.filter(c => !connectionIds.has(c.id));

    return {
      elements: diagram.elements,
      primitives: diagram.primitives ?? [],
      symbolInstances: diagram.symbolInstances ?? [],
      connections,
      deletedIds: connectionIds
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Expand a set of IDs to include children of any groups.
   *
   * @param diagram Current diagram
   * @param ids Original set of IDs
   * @returns Expanded set including group children
   */
  expandWithGroupChildren(diagram: ProcessDiagramConfig, ids: Set<string>): Set<string> {
    const expanded = new Set<string>(ids);
    const primitives = diagram.primitives ?? [];

    for (const id of ids) {
      const primitive = primitives.find(p => p.id === id);
      if (primitive && isGroupPrimitive(primitive)) {
        const group = primitive as GroupPrimitive;
        for (const childId of group.config.childIds) {
          expanded.add(childId);
        }
      }
    }

    return expanded;
  }

  /**
   * Get orphaned connections after deletion.
   * Returns connections that would have no source or target after deletion.
   *
   * @param diagram Current diagram
   * @param deletedItemIds IDs of items being deleted
   * @returns Set of connection IDs that would be orphaned
   */
  getOrphanedConnections(diagram: ProcessDiagramConfig, deletedItemIds: Set<string>): Set<string> {
    const orphaned = new Set<string>();

    for (const conn of diagram.connections) {
      if (deletedItemIds.has(conn.from.elementId) || deletedItemIds.has(conn.to.elementId)) {
        orphaned.add(conn.id);
      }
    }

    return orphaned;
  }

  /**
   * Check if deleting an item would orphan any connections.
   *
   * @param diagram Current diagram
   * @param itemId ID of item to check
   * @returns True if connections would be orphaned
   */
  wouldOrphanConnections(diagram: ProcessDiagramConfig, itemId: string): boolean {
    return diagram.connections.some(
      c => c.from.elementId === itemId || c.to.elementId === itemId
    );
  }

  /**
   * Get the count of items that would be deleted.
   *
   * @param diagram Current diagram
   * @param itemIds IDs of items to delete (before expansion)
   * @returns Count including expanded group children
   */
  getDeletionCount(diagram: ProcessDiagramConfig, itemIds: Set<string>): number {
    const expanded = this.expandWithGroupChildren(diagram, itemIds);
    return expanded.size;
  }
}
