import { Injectable, signal, computed, WritableSignal } from '@angular/core';
import {
  ProcessDiagramConfig,
  ProcessElement,
  ProcessConnection,
  ProcessCanvasConfig
} from '../../process-widget.models';
import { PrimitiveBase } from '../../primitives';
import { SymbolInstance } from '../../primitives/models/symbol.model';

/**
 * Service that owns and manages the diagram state.
 * All diagram mutations should go through this service to ensure
 * consistent state management and easier testing.
 */
@Injectable()
export class DesignerDiagramService {
  private readonly _diagram: WritableSignal<ProcessDiagramConfig>;

  /** Read-only access to the current diagram */
  readonly diagram = computed(() => this._diagram());

  /** Convenience accessors */
  readonly primitives = computed(() => this._diagram().primitives ?? []);
  readonly symbols = computed(() => this._diagram().symbolInstances ?? []);
  readonly elements = computed(() => this._diagram().elements ?? []);
  readonly connections = computed(() => this._diagram().connections ?? []);
  readonly canvas = computed(() => this._diagram().canvas);

  constructor() {
    this._diagram = signal<ProcessDiagramConfig>(this.createEmptyDiagram());
  }

  // ============================================================================
  // Diagram-level operations
  // ============================================================================

  /**
   * Set the entire diagram (used when loading)
   */
  setDiagram(config: ProcessDiagramConfig): void {
    this._diagram.set(config);
  }

  /**
   * Get the current diagram (synchronous)
   */
  getDiagram(): ProcessDiagramConfig {
    return this._diagram();
  }

  /**
   * Update the diagram with a custom updater function
   */
  updateDiagram(updater: (d: ProcessDiagramConfig) => ProcessDiagramConfig): void {
    this._diagram.update(updater);
  }

  /**
   * Update canvas configuration
   */
  updateCanvas(updater: (c: ProcessCanvasConfig) => ProcessCanvasConfig): void {
    this._diagram.update(d => ({
      ...d,
      canvas: updater(d.canvas)
    }));
  }

  // ============================================================================
  // Primitive operations
  // ============================================================================

  /**
   * Update a single primitive by ID
   */
  updatePrimitive(id: string, updater: (p: PrimitiveBase) => PrimitiveBase): void {
    this._diagram.update(d => ({
      ...d,
      primitives: (d.primitives ?? []).map(p =>
        p.id === id ? updater(p) : p
      )
    }));
  }

  /**
   * Update multiple primitives that match a predicate
   */
  updatePrimitives(
    predicate: (p: PrimitiveBase) => boolean,
    updater: (p: PrimitiveBase) => PrimitiveBase
  ): void {
    this._diagram.update(d => ({
      ...d,
      primitives: (d.primitives ?? []).map(p =>
        predicate(p) ? updater(p) : p
      )
    }));
  }

  /**
   * Add a new primitive
   */
  addPrimitive(primitive: PrimitiveBase): void {
    this._diagram.update(d => ({
      ...d,
      primitives: [...(d.primitives ?? []), primitive]
    }));
  }

  /**
   * Add multiple primitives
   */
  addPrimitives(primitives: PrimitiveBase[]): void {
    this._diagram.update(d => ({
      ...d,
      primitives: [...(d.primitives ?? []), ...primitives]
    }));
  }

  /**
   * Remove a primitive by ID
   */
  removePrimitive(id: string): void {
    this._diagram.update(d => ({
      ...d,
      primitives: (d.primitives ?? []).filter(p => p.id !== id)
    }));
  }

  /**
   * Remove multiple primitives by IDs
   */
  removePrimitives(ids: Set<string> | string[]): void {
    const idSet = ids instanceof Set ? ids : new Set(ids);
    this._diagram.update(d => ({
      ...d,
      primitives: (d.primitives ?? []).filter(p => !idSet.has(p.id))
    }));
  }

  /**
   * Set all primitives (replace)
   */
  setPrimitives(primitives: PrimitiveBase[]): void {
    this._diagram.update(d => ({
      ...d,
      primitives
    }));
  }

  /**
   * Get a primitive by ID
   */
  getPrimitive(id: string): PrimitiveBase | undefined {
    return (this._diagram().primitives ?? []).find(p => p.id === id);
  }

  // ============================================================================
  // Symbol operations
  // ============================================================================

  /**
   * Update a single symbol by ID
   */
  updateSymbol(id: string, updater: (s: SymbolInstance) => SymbolInstance): void {
    this._diagram.update(d => ({
      ...d,
      symbolInstances: (d.symbolInstances ?? []).map(s =>
        s.id === id ? updater(s) : s
      )
    }));
  }

  /**
   * Update multiple symbols that match a predicate
   */
  updateSymbols(
    predicate: (s: SymbolInstance) => boolean,
    updater: (s: SymbolInstance) => SymbolInstance
  ): void {
    this._diagram.update(d => ({
      ...d,
      symbolInstances: (d.symbolInstances ?? []).map(s =>
        predicate(s) ? updater(s) : s
      )
    }));
  }

  /**
   * Add a new symbol
   */
  addSymbol(symbol: SymbolInstance): void {
    this._diagram.update(d => ({
      ...d,
      symbolInstances: [...(d.symbolInstances ?? []), symbol]
    }));
  }

  /**
   * Add multiple symbols
   */
  addSymbols(symbols: SymbolInstance[]): void {
    this._diagram.update(d => ({
      ...d,
      symbolInstances: [...(d.symbolInstances ?? []), ...symbols]
    }));
  }

  /**
   * Remove a symbol by ID
   */
  removeSymbol(id: string): void {
    this._diagram.update(d => ({
      ...d,
      symbolInstances: (d.symbolInstances ?? []).filter(s => s.id !== id)
    }));
  }

  /**
   * Remove multiple symbols by IDs
   */
  removeSymbols(ids: Set<string> | string[]): void {
    const idSet = ids instanceof Set ? ids : new Set(ids);
    this._diagram.update(d => ({
      ...d,
      symbolInstances: (d.symbolInstances ?? []).filter(s => !idSet.has(s.id))
    }));
  }

  /**
   * Set all symbols (replace)
   */
  setSymbols(symbols: SymbolInstance[]): void {
    this._diagram.update(d => ({
      ...d,
      symbolInstances: symbols
    }));
  }

  /**
   * Get a symbol by ID
   */
  getSymbol(id: string): SymbolInstance | undefined {
    return (this._diagram().symbolInstances ?? []).find(s => s.id === id);
  }

  // ============================================================================
  // Element operations
  // ============================================================================

  /**
   * Update a single element by ID
   */
  updateElement(id: string, updater: (e: ProcessElement) => ProcessElement): void {
    this._diagram.update(d => ({
      ...d,
      elements: (d.elements ?? []).map(e =>
        e.id === id ? updater(e) : e
      )
    }));
  }

  /**
   * Add a new element
   */
  addElement(element: ProcessElement): void {
    this._diagram.update(d => ({
      ...d,
      elements: [...(d.elements ?? []), element]
    }));
  }

  /**
   * Remove an element by ID
   */
  removeElement(id: string): void {
    this._diagram.update(d => ({
      ...d,
      elements: (d.elements ?? []).filter(e => e.id !== id)
    }));
  }

  /**
   * Remove multiple elements by IDs
   */
  removeElements(ids: Set<string> | string[]): void {
    const idSet = ids instanceof Set ? ids : new Set(ids);
    this._diagram.update(d => ({
      ...d,
      elements: (d.elements ?? []).filter(e => !idSet.has(e.id))
    }));
  }

  /**
   * Get an element by ID
   */
  getElement(id: string): ProcessElement | undefined {
    return (this._diagram().elements ?? []).find(e => e.id === id);
  }

  // ============================================================================
  // Connection operations
  // ============================================================================

  /**
   * Update a single connection by ID
   */
  updateConnection(id: string, updater: (c: ProcessConnection) => ProcessConnection): void {
    this._diagram.update(d => ({
      ...d,
      connections: (d.connections ?? []).map(c =>
        c.id === id ? updater(c) : c
      )
    }));
  }

  /**
   * Add a new connection
   */
  addConnection(connection: ProcessConnection): void {
    this._diagram.update(d => ({
      ...d,
      connections: [...(d.connections ?? []), connection]
    }));
  }

  /**
   * Remove a connection by ID
   */
  removeConnection(id: string): void {
    this._diagram.update(d => ({
      ...d,
      connections: (d.connections ?? []).filter(c => c.id !== id)
    }));
  }

  /**
   * Remove multiple connections by IDs
   */
  removeConnections(ids: Set<string> | string[]): void {
    const idSet = ids instanceof Set ? ids : new Set(ids);
    this._diagram.update(d => ({
      ...d,
      connections: (d.connections ?? []).filter(c => !idSet.has(c.id))
    }));
  }

  /**
   * Remove connections that reference any of the given element IDs
   */
  removeConnectionsToElements(elementIds: Set<string>): void {
    this._diagram.update(d => ({
      ...d,
      connections: (d.connections ?? []).filter(c =>
        !elementIds.has(c.from.elementId) && !elementIds.has(c.to.elementId)
      )
    }));
  }

  // ============================================================================
  // Batch operations
  // ============================================================================

  /**
   * Apply multiple changes in a single update (more efficient)
   */
  batchUpdate(changes: {
    primitives?: PrimitiveBase[];
    symbolInstances?: SymbolInstance[];
    elements?: ProcessElement[];
    connections?: ProcessConnection[];
  }): void {
    this._diagram.update(d => ({
      ...d,
      ...(changes.primitives !== undefined && { primitives: changes.primitives }),
      ...(changes.symbolInstances !== undefined && { symbolInstances: changes.symbolInstances }),
      ...(changes.elements !== undefined && { elements: changes.elements }),
      ...(changes.connections !== undefined && { connections: changes.connections })
    }));
  }

  /**
   * Merge partial diagram changes
   */
  merge(partial: Partial<ProcessDiagramConfig>): void {
    this._diagram.update(d => ({ ...d, ...partial }));
  }

  // ============================================================================
  // Utility methods
  // ============================================================================

  /**
   * Find any item (primitive, symbol, or element) by ID
   */
  findItemById(id: string): PrimitiveBase | SymbolInstance | ProcessElement | undefined {
    const diagram = this._diagram();
    return (diagram.primitives ?? []).find(p => p.id === id)
      ?? (diagram.symbolInstances ?? []).find(s => s.id === id)
      ?? (diagram.elements ?? []).find(e => e.id === id);
  }

  /**
   * Check if an ID exists in the diagram
   */
  hasId(id: string): boolean {
    return this.findItemById(id) !== undefined;
  }

  /**
   * Create an empty diagram configuration
   */
  createEmptyDiagram(): ProcessDiagramConfig {
    return {
      id: this.generateId(),
      name: 'New Diagram',
      version: '1.0.0',
      canvas: {
        width: 1200,
        height: 800,
        gridSize: 10,
        showGrid: true,
        backgroundColor: '#ffffff'
      },
      elements: [],
      connections: [],
      primitives: [],
      symbolInstances: []
    };
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `diagram-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Reset to empty diagram
   */
  reset(): void {
    this._diagram.set(this.createEmptyDiagram());
  }
}
