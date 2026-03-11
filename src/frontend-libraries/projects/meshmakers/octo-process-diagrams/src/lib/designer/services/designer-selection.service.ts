import { Injectable, signal, computed, Signal } from '@angular/core';
import { ProcessElement, ProcessConnection, ProcessDiagramConfig } from '../../process-widget.models';
import { PrimitiveBase } from '../../primitives';
import { SymbolInstance } from '../../primitives/models/symbol.model';
import { GroupPrimitive, isGroupPrimitive } from '../../primitives/models/group.model';

/**
 * Selection state for the designer
 */
export interface SelectionState {
  /** Selected element/primitive/symbol IDs */
  elements: Set<string>;
  /** Selected connection IDs */
  connections: Set<string>;
}

/**
 * Selection rectangle for marquee selection
 */
export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Designer Selection Service
 *
 * Manages selection state for the Process Designer.
 * Follows Single Responsibility Principle - only handles selection logic.
 *
 * Features:
 * - Element, primitive, symbol, and connection selection
 * - Multi-selection support (Ctrl/Shift+click)
 * - Marquee/rubber-band selection
 * - Selection queries (hasSelection, isSelected, etc.)
 *
 * Usage:
 * ```typescript
 * // Inject the service
 * private readonly selectionService = inject(DesignerSelectionService);
 *
 * // Select an element
 * this.selectionService.selectElement('element-id');
 *
 * // Check selection
 * if (this.selectionService.isElementSelected('element-id')) { ... }
 *
 * // Get selected items (pass diagram for filtering)
 * const selected = this.selectionService.getSelectedElements(diagram);
 * ```
 */
@Injectable()
export class DesignerSelectionService {
  // Private state signals
  private readonly _selection = signal<SelectionState>({
    elements: new Set(),
    connections: new Set()
  });

  private readonly _selectionRect = signal<SelectionRect | null>(null);

  // Public readonly signals
  readonly selection: Signal<SelectionState> = this._selection.asReadonly();
  readonly selectionRect: Signal<SelectionRect | null> = this._selectionRect.asReadonly();

  /**
   * Check if any items are selected
   */
  readonly hasSelection = computed(() => {
    const sel = this._selection();
    return sel.elements.size > 0 || sel.connections.size > 0;
  });

  /**
   * Get the count of selected items
   */
  readonly selectionCount = computed(() => {
    const sel = this._selection();
    return sel.elements.size + sel.connections.size;
  });

  // ============================================================================
  // Element Selection (also used for primitives and symbols)
  // ============================================================================

  /**
   * Check if an element, primitive, or symbol is selected
   */
  isElementSelected(elementId: string): boolean {
    return this._selection().elements.has(elementId);
  }

  /**
   * Alias for isElementSelected - checks if a primitive is selected
   */
  isPrimitiveSelected(primitiveId: string): boolean {
    return this.isElementSelected(primitiveId);
  }

  /**
   * Alias for isElementSelected - checks if a symbol is selected
   */
  isSymbolSelected(symbolId: string): boolean {
    return this.isElementSelected(symbolId);
  }

  /**
   * Select an element, primitive, or symbol
   * @param elementId - The ID of the item to select
   * @param addToSelection - If true, adds to existing selection; if false, replaces selection
   */
  selectElement(elementId: string, addToSelection = false): void {
    this._selection.update(sel => {
      const newElements = addToSelection ? new Set(sel.elements) : new Set<string>();
      newElements.add(elementId);
      return {
        elements: newElements,
        connections: addToSelection ? sel.connections : new Set()
      };
    });
  }

  /**
   * Alias for selectElement - select a primitive
   */
  selectPrimitive(primitiveId: string, addToSelection = false): void {
    this.selectElement(primitiveId, addToSelection);
  }

  /**
   * Alias for selectElement - select a symbol
   */
  selectSymbol(symbolId: string, addToSelection = false): void {
    this.selectElement(symbolId, addToSelection);
  }

  /**
   * Deselect a specific element, primitive, or symbol
   */
  deselectElement(elementId: string): void {
    this._selection.update(sel => ({
      elements: new Set([...sel.elements].filter(id => id !== elementId)),
      connections: sel.connections
    }));
  }

  /**
   * Toggle selection of an element, primitive, or symbol
   */
  toggleElementSelection(elementId: string): void {
    if (this.isElementSelected(elementId)) {
      this.deselectElement(elementId);
    } else {
      this.selectElement(elementId, true);
    }
  }

  // ============================================================================
  // Connection Selection
  // ============================================================================

  /**
   * Check if a connection is selected
   */
  isConnectionSelected(connectionId: string): boolean {
    return this._selection().connections.has(connectionId);
  }

  /**
   * Select a connection
   * @param connectionId - The ID of the connection to select
   * @param addToSelection - If true, adds to existing selection; if false, replaces selection
   */
  selectConnection(connectionId: string, addToSelection = false): void {
    this._selection.update(sel => {
      const newConnections = addToSelection ? new Set(sel.connections) : new Set<string>();
      newConnections.add(connectionId);
      return {
        elements: addToSelection ? sel.elements : new Set(),
        connections: newConnections
      };
    });
  }

  /**
   * Deselect a specific connection
   */
  deselectConnection(connectionId: string): void {
    this._selection.update(sel => ({
      elements: sel.elements,
      connections: new Set([...sel.connections].filter(id => id !== connectionId))
    }));
  }

  // ============================================================================
  // Bulk Selection Operations
  // ============================================================================

  /**
   * Clear all selection
   */
  clearSelection(): void {
    this._selection.set({ elements: new Set(), connections: new Set() });
  }

  /**
   * Select multiple elements/primitives/symbols at once
   */
  selectElements(elementIds: string[], addToSelection = false): void {
    this._selection.update(sel => {
      const newElements = addToSelection ? new Set(sel.elements) : new Set<string>();
      elementIds.forEach(id => newElements.add(id));
      return {
        elements: newElements,
        connections: addToSelection ? sel.connections : new Set()
      };
    });
  }

  /**
   * Select multiple connections at once
   */
  selectConnections(connectionIds: string[], addToSelection = false): void {
    this._selection.update(sel => {
      const newConnections = addToSelection ? new Set(sel.connections) : new Set<string>();
      connectionIds.forEach(id => newConnections.add(id));
      return {
        elements: addToSelection ? sel.elements : new Set(),
        connections: newConnections
      };
    });
  }

  /**
   * Select all items from a diagram
   */
  selectAll(diagram: ProcessDiagramConfig): void {
    const elementIds = [
      ...diagram.elements.map(e => e.id),
      ...(diagram.primitives ?? []).map(p => p.id),
      ...(diagram.symbolInstances ?? []).map(s => s.id)
    ];
    const connectionIds = diagram.connections.map(c => c.id);

    this._selection.set({
      elements: new Set(elementIds),
      connections: new Set(connectionIds)
    });
  }

  /**
   * Remove specific IDs from selection (useful after deletion)
   */
  removeFromSelection(elementIds: string[], connectionIds: string[] = []): void {
    const elementSet = new Set(elementIds);
    const connectionSet = new Set(connectionIds);

    this._selection.update(sel => ({
      elements: new Set([...sel.elements].filter(id => !elementSet.has(id))),
      connections: new Set([...sel.connections].filter(id => !connectionSet.has(id)))
    }));
  }

  // ============================================================================
  // Selection Queries (require diagram data)
  // ============================================================================

  /**
   * Get selected elements from a diagram
   */
  getSelectedElements(diagram: ProcessDiagramConfig): ProcessElement[] {
    const sel = this._selection();
    return diagram.elements.filter(e => sel.elements.has(e.id));
  }

  /**
   * Get selected primitives from a diagram
   */
  getSelectedPrimitives(diagram: ProcessDiagramConfig): PrimitiveBase[] {
    const sel = this._selection();
    return (diagram.primitives ?? []).filter(p => sel.elements.has(p.id));
  }

  /**
   * Get selected symbol instances from a diagram
   */
  getSelectedSymbols(diagram: ProcessDiagramConfig): SymbolInstance[] {
    const sel = this._selection();
    return (diagram.symbolInstances ?? []).filter(s => sel.elements.has(s.id));
  }

  /**
   * Get selected connections from a diagram
   */
  getSelectedConnections(diagram: ProcessDiagramConfig): ProcessConnection[] {
    const sel = this._selection();
    return diagram.connections.filter(c => sel.connections.has(c.id));
  }

  // ============================================================================
  // Group-Aware Selection
  // ============================================================================

  /**
   * Find the group that contains a specific item (primitive or symbol).
   * Returns null if the item is not in any group.
   *
   * @param itemId - ID of the item to find
   * @param diagram - The diagram containing primitives
   * @returns The group containing the item, or null
   */
  findGroupForItem(itemId: string, diagram: ProcessDiagramConfig): GroupPrimitive | null {
    const primitives = diagram.primitives ?? [];
    for (const primitive of primitives) {
      if (isGroupPrimitive(primitive)) {
        if (primitive.config.childIds.includes(itemId)) {
          return primitive;
        }
      }
    }
    return null;
  }

  /**
   * Find all groups in the diagram
   */
  getGroups(diagram: ProcessDiagramConfig): GroupPrimitive[] {
    return (diagram.primitives ?? []).filter(isGroupPrimitive);
  }

  /**
   * Get the effective selection ID for an item, considering groups.
   * If the item is in a group, returns the group ID instead.
   *
   * @param itemId - ID of the clicked item
   * @param diagram - The diagram
   * @returns The ID to actually select (group ID or original ID)
   */
  getEffectiveSelectionId(itemId: string, diagram: ProcessDiagramConfig): string {
    const group = this.findGroupForItem(itemId, diagram);
    return group ? group.id : itemId;
  }

  /**
   * Check if any selected items are groups
   */
  hasSelectedGroups(diagram: ProcessDiagramConfig): boolean {
    const sel = this._selection();
    const primitives = diagram.primitives ?? [];
    return primitives.some(p => isGroupPrimitive(p) && sel.elements.has(p.id));
  }

  /**
   * Get all selected groups from a diagram
   */
  getSelectedGroups(diagram: ProcessDiagramConfig): GroupPrimitive[] {
    const sel = this._selection();
    return (diagram.primitives ?? [])
      .filter(p => isGroupPrimitive(p) && sel.elements.has(p.id)) as GroupPrimitive[];
  }

  /**
   * Expand selection to include all children of selected groups.
   * Useful for operations like delete, copy, z-order.
   *
   * @param diagram - The diagram
   * @returns Set of all IDs including group children
   */
  expandSelectionWithGroupChildren(diagram: ProcessDiagramConfig): Set<string> {
    const sel = this._selection();
    const expandedIds = new Set(sel.elements);

    for (const id of sel.elements) {
      const primitive = (diagram.primitives ?? []).find(p => p.id === id);
      if (primitive && isGroupPrimitive(primitive)) {
        primitive.config.childIds.forEach(childId => expandedIds.add(childId));
      }
    }

    return expandedIds;
  }

  // ============================================================================
  // Selection Rectangle (Marquee Selection)
  // ============================================================================

  /**
   * Start a marquee selection
   */
  startSelectionRect(x: number, y: number): void {
    this._selectionRect.set({ x, y, width: 0, height: 0 });
  }

  /**
   * Update the marquee selection rectangle
   */
  updateSelectionRect(currentX: number, currentY: number): void {
    const rect = this._selectionRect();
    if (!rect) return;

    // Calculate new rectangle maintaining start point
    const x = Math.min(rect.x, currentX);
    const y = Math.min(rect.y, currentY);
    const width = Math.abs(currentX - rect.x);
    const height = Math.abs(currentY - rect.y);

    this._selectionRect.set({ x, y, width, height });
  }

  /**
   * End the marquee selection and select items within the rectangle
   * @returns The final selection rectangle, or null if none was active
   */
  endSelectionRect(): SelectionRect | null {
    const rect = this._selectionRect();
    this._selectionRect.set(null);
    return rect;
  }

  /**
   * Check if marquee selection is active
   */
  isSelectionRectActive(): boolean {
    return this._selectionRect() !== null;
  }

  /**
   * Get the current selection rectangle
   */
  getSelectionRect(): SelectionRect | null {
    return this._selectionRect();
  }

  /**
   * Set the selection rectangle directly with proper bounds.
   * Used when the caller has already computed the correct x, y, width, height.
   */
  setSelectionRect(rect: SelectionRect): void {
    this._selectionRect.set(rect);
  }
}
