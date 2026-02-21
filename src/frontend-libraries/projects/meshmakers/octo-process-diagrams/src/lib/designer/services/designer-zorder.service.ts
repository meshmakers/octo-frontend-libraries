import { Injectable } from '@angular/core';
import { ProcessDiagramConfig, ProcessElement, ProcessConnection } from '../../process-widget.models';
import { PrimitiveBase } from '../../primitives';
import { SymbolInstance } from '../../primitives/models/symbol.model';

/**
 * Result of a z-order operation
 */
export interface ZOrderResult {
  elements: ProcessElement[];
  primitives: PrimitiveBase[];
  symbolInstances: SymbolInstance[];
  connections: ProcessConnection[];
}

/**
 * Designer Z-Order Service
 *
 * Handles z-order operations (bring to front, send to back, etc.) for diagram elements.
 * Z-order in SVG is determined by element order in the array - later elements render on top.
 *
 * Follows Single Responsibility Principle - only handles z-order calculations.
 * Returns new arrays without mutating the original diagram.
 *
 * Usage:
 * ```typescript
 * private readonly zOrderService = inject(DesignerZOrderService);
 *
 * // Bring selected items to front
 * bringToFront(): void {
 *   const result = this.zOrderService.bringToFront(diagram, selectedIds);
 *   this._diagram.update(d => ({ ...d, ...result }));
 * }
 * ```
 */
@Injectable()
export class DesignerZOrderService {

  // ============================================================================
  // Z-Order Operations
  // ============================================================================

  /**
   * Bring items to front (highest z-index - rendered last).
   *
   * @param diagram Current diagram state
   * @param ids Set of IDs to bring to front
   * @returns New arrays with items moved to end
   */
  bringToFront(diagram: ProcessDiagramConfig, ids: Set<string>): ZOrderResult {
    if (ids.size === 0) {
      return this.extractArrays(diagram);
    }

    const elements = diagram.elements;
    const primitives = diagram.primitives ?? [];
    const symbolInstances = diagram.symbolInstances ?? [];
    const connections = diagram.connections;

    // Move selected items to end of arrays (rendered last = on top)
    return {
      elements: this.moveToEnd(elements, ids),
      primitives: this.moveToEnd(primitives, ids),
      symbolInstances: this.moveToEnd(symbolInstances, ids),
      connections: connections // Connections don't have z-order per se
    };
  }

  /**
   * Send items to back (lowest z-index - rendered first).
   *
   * @param diagram Current diagram state
   * @param ids Set of IDs to send to back
   * @returns New arrays with items moved to start
   */
  sendToBack(diagram: ProcessDiagramConfig, ids: Set<string>): ZOrderResult {
    if (ids.size === 0) {
      return this.extractArrays(diagram);
    }

    const elements = diagram.elements;
    const primitives = diagram.primitives ?? [];
    const symbolInstances = diagram.symbolInstances ?? [];
    const connections = diagram.connections;

    // Move selected items to start of arrays (rendered first = in back)
    return {
      elements: this.moveToStart(elements, ids),
      primitives: this.moveToStart(primitives, ids),
      symbolInstances: this.moveToStart(symbolInstances, ids),
      connections: connections
    };
  }

  /**
   * Bring items one level forward (swap with next item).
   *
   * @param diagram Current diagram state
   * @param ids Set of IDs to bring forward
   * @returns New arrays with items moved one position up
   */
  bringForward(diagram: ProcessDiagramConfig, ids: Set<string>): ZOrderResult {
    if (ids.size === 0) {
      return this.extractArrays(diagram);
    }

    return {
      elements: this.moveForward([...diagram.elements], ids),
      primitives: this.moveForward([...(diagram.primitives ?? [])], ids),
      symbolInstances: this.moveForward([...(diagram.symbolInstances ?? [])], ids),
      connections: diagram.connections
    };
  }

  /**
   * Send items one level backward (swap with previous item).
   *
   * @param diagram Current diagram state
   * @param ids Set of IDs to send backward
   * @returns New arrays with items moved one position down
   */
  sendBackward(diagram: ProcessDiagramConfig, ids: Set<string>): ZOrderResult {
    if (ids.size === 0) {
      return this.extractArrays(diagram);
    }

    return {
      elements: this.moveBackward([...diagram.elements], ids),
      primitives: this.moveBackward([...(diagram.primitives ?? [])], ids),
      symbolInstances: this.moveBackward([...(diagram.symbolInstances ?? [])], ids),
      connections: diagram.connections
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Extract arrays from diagram (for no-op case).
   */
  private extractArrays(diagram: ProcessDiagramConfig): ZOrderResult {
    return {
      elements: diagram.elements,
      primitives: diagram.primitives ?? [],
      symbolInstances: diagram.symbolInstances ?? [],
      connections: diagram.connections
    };
  }

  /**
   * Move items with matching IDs to end of array.
   */
  private moveToEnd<T extends { id: string }>(items: T[], ids: Set<string>): T[] {
    const selected = items.filter(item => ids.has(item.id));
    const others = items.filter(item => !ids.has(item.id));
    return [...others, ...selected];
  }

  /**
   * Move items with matching IDs to start of array.
   */
  private moveToStart<T extends { id: string }>(items: T[], ids: Set<string>): T[] {
    const selected = items.filter(item => ids.has(item.id));
    const others = items.filter(item => !ids.has(item.id));
    return [...selected, ...others];
  }

  /**
   * Move items one position forward (toward end).
   * Processes from end to start to avoid double-moves.
   */
  private moveForward<T extends { id: string }>(items: T[], ids: Set<string>): T[] {
    // Process from second-to-last to first
    for (let i = items.length - 2; i >= 0; i--) {
      if (ids.has(items[i].id) && !ids.has(items[i + 1].id)) {
        // Swap with next item
        [items[i], items[i + 1]] = [items[i + 1], items[i]];
      }
    }
    return items;
  }

  /**
   * Move items one position backward (toward start).
   * Processes from second to last to avoid double-moves.
   */
  private moveBackward<T extends { id: string }>(items: T[], ids: Set<string>): T[] {
    // Process from second to last
    for (let i = 1; i < items.length; i++) {
      if (ids.has(items[i].id) && !ids.has(items[i - 1].id)) {
        // Swap with previous item
        [items[i - 1], items[i]] = [items[i], items[i - 1]];
      }
    }
    return items;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get the z-index (array position) of an item.
   *
   * @param diagram Current diagram
   * @param id Item ID
   * @returns Z-index or -1 if not found
   */
  getZIndex(diagram: ProcessDiagramConfig, id: string): number {
    // Check elements
    const elemIndex = diagram.elements.findIndex(e => e.id === id);
    if (elemIndex >= 0) return elemIndex;

    // Check primitives
    const primIndex = (diagram.primitives ?? []).findIndex(p => p.id === id);
    if (primIndex >= 0) return primIndex;

    // Check symbols
    const symIndex = (diagram.symbolInstances ?? []).findIndex(s => s.id === id);
    if (symIndex >= 0) return symIndex;

    return -1;
  }

  /**
   * Check if item is at front (last in array).
   */
  isAtFront(diagram: ProcessDiagramConfig, id: string): boolean {
    // Check elements
    const elements = diagram.elements;
    if (elements.length > 0 && elements[elements.length - 1].id === id) return true;

    // Check primitives
    const primitives = diagram.primitives ?? [];
    if (primitives.length > 0 && primitives[primitives.length - 1].id === id) return true;

    // Check symbols
    const symbols = diagram.symbolInstances ?? [];
    if (symbols.length > 0 && symbols[symbols.length - 1].id === id) return true;

    return false;
  }

  /**
   * Check if item is at back (first in array).
   */
  isAtBack(diagram: ProcessDiagramConfig, id: string): boolean {
    // Check elements
    const elements = diagram.elements;
    if (elements.length > 0 && elements[0].id === id) return true;

    // Check primitives
    const primitives = diagram.primitives ?? [];
    if (primitives.length > 0 && primitives[0].id === id) return true;

    // Check symbols
    const symbols = diagram.symbolInstances ?? [];
    if (symbols.length > 0 && symbols[0].id === id) return true;

    return false;
  }
}
