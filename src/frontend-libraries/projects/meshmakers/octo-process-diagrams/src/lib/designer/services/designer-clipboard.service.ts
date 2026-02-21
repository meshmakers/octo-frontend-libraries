import { Injectable, signal, computed, Signal } from '@angular/core';
import { ProcessElement, ProcessConnection, Position } from '../../process-widget.models';
import { PrimitiveBase } from '../../primitives';
import { SymbolInstance } from '../../primitives/models/symbol.model';

/**
 * Clipboard data for copy/paste operations
 */
export interface ClipboardData {
  elements: ProcessElement[];
  primitives: PrimitiveBase[];
  symbolInstances: SymbolInstance[];
  connections: ProcessConnection[];
  /** Original bounding box center for paste offset calculation */
  centerPosition: Position;
}

/**
 * Result of a paste operation with new IDs and offset positions
 */
export interface PasteResult {
  elements: ProcessElement[];
  primitives: PrimitiveBase[];
  symbolInstances: SymbolInstance[];
  connections: ProcessConnection[];
  /** Mapping from original ID to new ID */
  idMapping: Map<string, string>;
}

/**
 * Designer Clipboard Service
 *
 * Manages clipboard state for copy/paste operations in the Process Designer.
 * Follows Single Responsibility Principle - only handles clipboard logic.
 *
 * Features:
 * - Store copied items (elements, primitives, symbols, connections)
 * - Generate new IDs and offset positions for paste
 * - Reactive hasContent signal
 * - Clear clipboard functionality
 *
 * Usage:
 * ```typescript
 * // Inject the service
 * private readonly clipboardService = inject(DesignerClipboardService);
 *
 * // Copy items
 * this.clipboardService.copy({
 *   elements: selectedElements,
 *   primitives: selectedPrimitives,
 *   symbolInstances: selectedSymbols,
 *   connections: selectedConnections,
 *   centerPosition: center
 * });
 *
 * // Paste items
 * const result = this.clipboardService.paste(targetPosition, () => generateId());
 * if (result) {
 *   // Add result.elements, result.primitives, etc. to diagram
 * }
 * ```
 */
@Injectable()
export class DesignerClipboardService {
  // Private clipboard state
  private readonly _clipboard = signal<ClipboardData | null>(null);

  // Public readonly signal
  readonly clipboard: Signal<ClipboardData | null> = this._clipboard.asReadonly();

  /**
   * Whether clipboard has content that can be pasted
   */
  readonly hasContent: Signal<boolean> = computed(() => {
    const data = this._clipboard();
    if (!data) return false;
    return data.elements.length > 0 ||
           data.primitives.length > 0 ||
           data.symbolInstances.length > 0;
  });

  /**
   * Count of items in clipboard
   */
  readonly itemCount: Signal<number> = computed(() => {
    const data = this._clipboard();
    if (!data) return 0;
    return data.elements.length +
           data.primitives.length +
           data.symbolInstances.length +
           data.connections.length;
  });

  // ============================================================================
  // Clipboard Operations
  // ============================================================================

  /**
   * Copy items to clipboard.
   * Items are deep-cloned to prevent mutations.
   */
  copy(data: ClipboardData): void {
    this._clipboard.set({
      elements: data.elements.map(e => this.deepClone(e)),
      primitives: data.primitives.map(p => this.deepClone(p)),
      symbolInstances: data.symbolInstances.map(s => this.deepClone(s)),
      connections: data.connections.map(c => this.deepClone(c)),
      centerPosition: { ...data.centerPosition }
    });
  }

  /**
   * Paste clipboard contents at optional position.
   * Returns cloned items with new IDs and offset positions.
   *
   * @param idGenerator - Function to generate unique IDs
   * @param position - Target position (defaults to offset from original)
   * @returns PasteResult with new items, or null if clipboard is empty
   */
  paste(idGenerator: () => string, position?: Position): PasteResult | null {
    const data = this._clipboard();
    if (!data) return null;
    if (!this.hasContent()) return null;

    // Calculate offset from original center to paste position
    const pastePosition = position ?? {
      x: data.centerPosition.x + 20,
      y: data.centerPosition.y + 20
    };
    const offsetX = pastePosition.x - data.centerPosition.x;
    const offsetY = pastePosition.y - data.centerPosition.y;

    // Create ID mapping for connections
    const idMapping = new Map<string, string>();

    // Clone elements with new IDs and offset positions
    const elements = data.elements.map(e => {
      const newId = idGenerator();
      idMapping.set(e.id, newId);
      return {
        ...this.deepClone(e),
        id: newId,
        name: `${e.name} (copy)`,
        position: {
          x: e.position.x + offsetX,
          y: e.position.y + offsetY
        }
      };
    });

    // Clone primitives with new IDs and offset positions
    // First pass: generate all new IDs
    const primitives = data.primitives.map(p => {
      const newId = idGenerator();
      idMapping.set(p.id, newId);
      return {
        ...this.deepClone(p),
        id: newId,
        name: p.name ? `${p.name} (copy)` : undefined,
        position: {
          x: p.position.x + offsetX,
          y: p.position.y + offsetY
        }
      } as PrimitiveBase;
    });

    // Second pass: remap group childIds to new IDs
    const remappedPrimitives = primitives.map(p => {
      if (p.type === 'group') {
        const groupConfig = (p as unknown as { config: { childIds: string[] } }).config;
        const newChildIds = groupConfig.childIds
          .map(childId => idMapping.get(childId))
          .filter((id): id is string => id !== undefined);
        return {
          ...p,
          config: {
            ...groupConfig,
            childIds: newChildIds
          }
        } as PrimitiveBase;
      }
      return p;
    });

    // Clone symbol instances with new IDs and offset positions
    const symbolInstances = data.symbolInstances.map(s => {
      const newId = idGenerator();
      idMapping.set(s.id, newId);
      return {
        ...this.deepClone(s),
        id: newId,
        name: s.name ? `${s.name} (copy)` : undefined,
        position: {
          x: s.position.x + offsetX,
          y: s.position.y + offsetY
        }
      } as SymbolInstance;
    });

    // Clone connections with new IDs and mapped source/target
    const connections = data.connections
      .filter(c => idMapping.has(c.from.elementId) && idMapping.has(c.to.elementId))
      .map(c => ({
        ...this.deepClone(c),
        id: idGenerator(),
        from: {
          ...c.from,
          elementId: idMapping.get(c.from.elementId)!
        },
        to: {
          ...c.to,
          elementId: idMapping.get(c.to.elementId)!
        }
      }));

    // Update center position for next paste offset
    this._clipboard.update(d => d ? {
      ...d,
      centerPosition: pastePosition
    } : null);

    return {
      elements,
      primitives: remappedPrimitives,
      symbolInstances,
      connections,
      idMapping
    };
  }

  /**
   * Clear the clipboard
   */
  clear(): void {
    this._clipboard.set(null);
  }

  /**
   * Get current clipboard data (read-only)
   */
  getClipboardData(): ClipboardData | null {
    const data = this._clipboard();
    return data ? this.deepClone(data) : null;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Deep clone an object using JSON serialization.
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}
