/**
 * Designer Bounds Service
 *
 * Provides bounds calculations for diagram elements, primitives, symbols,
 * and selections. Consolidates all bounds-related logic from the component.
 */

import { Injectable, inject } from '@angular/core';
import { ProcessDiagramConfig, ProcessElement } from '../../process-widget.models';
import { Position, PrimitiveBase } from '../../primitives';
import { SymbolInstance, SymbolDefinition, getSymbolInstanceBounds } from '../../primitives/models/symbol.model';
import { DesignerPrimitiveService } from './designer-primitive.service';
import { PrimitiveBounds } from './primitive-handlers';

export interface DiagramBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SelectionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

type SymbolDefinitionLookup = (symbol: SymbolInstance) => SymbolDefinition | null;

@Injectable()
export class DesignerBoundsService {
  private readonly primitiveService = inject(DesignerPrimitiveService);

  /**
   * Get bounds for a single primitive
   */
  getPrimitiveBounds(primitive: PrimitiveBase): PrimitiveBounds {
    // Handle groups specially - use stored bounds
    if (primitive.type === 'group') {
      const config = (primitive as unknown as { config: { originalBounds?: { width: number; height: number } } }).config;
      return {
        x: primitive.position.x,
        y: primitive.position.y,
        width: config.originalBounds?.width ?? 100,
        height: config.originalBounds?.height ?? 100
      };
    }

    return this.primitiveService.getBounds(primitive);
  }

  /**
   * Get bounds for a symbol instance using its definition
   */
  getSymbolBounds(symbol: SymbolInstance, definition: SymbolDefinition): PrimitiveBounds {
    return getSymbolInstanceBounds(symbol, definition);
  }

  /**
   * Get bounds for a process element
   */
  getElementBounds(element: ProcessElement): PrimitiveBounds {
    return {
      x: element.position.x,
      y: element.position.y,
      width: element.size.width,
      height: element.size.height
    };
  }

  /**
   * Get combined bounds of all content in the diagram (primitives, elements, symbols)
   * Returns null if diagram is empty
   */
  getContentBounds(
    diagram: ProcessDiagramConfig,
    getSymbolDefinition: SymbolDefinitionLookup
  ): DiagramBounds | null {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasContent = false;

    // Check primitives
    for (const primitive of diagram.primitives ?? []) {
      const bbox = this.getPrimitiveBounds(primitive);
      minX = Math.min(minX, bbox.x);
      minY = Math.min(minY, bbox.y);
      maxX = Math.max(maxX, bbox.x + bbox.width);
      maxY = Math.max(maxY, bbox.y + bbox.height);
      hasContent = true;
    }

    // Check elements
    for (const element of diagram.elements ?? []) {
      const bbox = this.getElementBounds(element);
      minX = Math.min(minX, bbox.x);
      minY = Math.min(minY, bbox.y);
      maxX = Math.max(maxX, bbox.x + bbox.width);
      maxY = Math.max(maxY, bbox.y + bbox.height);
      hasContent = true;
    }

    // Check symbol instances
    for (const symbol of diagram.symbolInstances ?? []) {
      const def = getSymbolDefinition(symbol);
      if (def) {
        const bounds = this.getSymbolBounds(symbol, def);
        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
        maxX = Math.max(maxX, bounds.x + bounds.width);
        maxY = Math.max(maxY, bounds.y + bounds.height);
        hasContent = true;
      }
    }

    return hasContent ? { minX, minY, maxX, maxY } : null;
  }

  /**
   * Get bounds of selected items (primitives and symbols)
   */
  getSelectionBounds(
    selectedIds: Set<string>,
    diagram: ProcessDiagramConfig,
    getSymbolDefinition: SymbolDefinitionLookup
  ): SelectionBounds | null {
    if (selectedIds.size === 0) {
      return null;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasContent = false;

    // Check selected primitives
    for (const primitive of diagram.primitives ?? []) {
      if (selectedIds.has(primitive.id)) {
        const bbox = this.getPrimitiveBounds(primitive);
        minX = Math.min(minX, bbox.x);
        minY = Math.min(minY, bbox.y);
        maxX = Math.max(maxX, bbox.x + bbox.width);
        maxY = Math.max(maxY, bbox.y + bbox.height);
        hasContent = true;
      }
    }

    // Check selected elements
    for (const element of diagram.elements ?? []) {
      if (selectedIds.has(element.id)) {
        const bbox = this.getElementBounds(element);
        minX = Math.min(minX, bbox.x);
        minY = Math.min(minY, bbox.y);
        maxX = Math.max(maxX, bbox.x + bbox.width);
        maxY = Math.max(maxY, bbox.y + bbox.height);
        hasContent = true;
      }
    }

    // Check selected symbols
    for (const symbol of diagram.symbolInstances ?? []) {
      if (selectedIds.has(symbol.id)) {
        const def = getSymbolDefinition(symbol);
        if (def) {
          const bounds = this.getSymbolBounds(symbol, def);
          minX = Math.min(minX, bounds.x);
          minY = Math.min(minY, bounds.y);
          maxX = Math.max(maxX, bounds.x + bounds.width);
          maxY = Math.max(maxY, bounds.y + bounds.height);
          hasContent = true;
        }
      }
    }

    if (!hasContent) {
      return null;
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Get center point of selected items
   */
  getSelectionCenter(
    selectedIds: Set<string>,
    diagram: ProcessDiagramConfig,
    getSymbolDefinition: SymbolDefinitionLookup
  ): Position {
    const positions: Position[] = [];

    // Collect centers of selected elements
    for (const element of diagram.elements ?? []) {
      if (selectedIds.has(element.id)) {
        positions.push({
          x: element.position.x + element.size.width / 2,
          y: element.position.y + element.size.height / 2
        });
      }
    }

    // Collect centers of selected symbols
    for (const symbol of diagram.symbolInstances ?? []) {
      if (selectedIds.has(symbol.id)) {
        const def = getSymbolDefinition(symbol);
        if (def) {
          const bounds = this.getSymbolBounds(symbol, def);
          positions.push({
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2
          });
        }
      }
    }

    // Collect centers of selected primitives
    for (const primitive of diagram.primitives ?? []) {
      if (selectedIds.has(primitive.id)) {
        const bbox = this.getPrimitiveBounds(primitive);
        positions.push({
          x: bbox.x + bbox.width / 2,
          y: bbox.y + bbox.height / 2
        });
      }
    }

    if (positions.length === 0) {
      return { x: 0, y: 0 };
    }

    const sumX = positions.reduce((sum, p) => sum + p.x, 0);
    const sumY = positions.reduce((sum, p) => sum + p.y, 0);

    return {
      x: sumX / positions.length,
      y: sumY / positions.length
    };
  }

  /**
   * Convert DiagramBounds to SelectionBounds format
   */
  diagramBoundsToSelectionBounds(bounds: DiagramBounds): SelectionBounds {
    return {
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY
    };
  }

  /**
   * Get bounds of all items that are NOT in the selected set.
   * Used for alignment guide detection - we want to align against non-selected items.
   *
   * @param selectedIds - Set of IDs that are currently selected (to exclude)
   * @param diagram - The diagram containing all items
   * @param getSymbolDefinition - Lookup function for symbol definitions
   * @returns Array of bounds for all non-selected items
   */
  getNonSelectedBounds(
    selectedIds: Set<string>,
    diagram: ProcessDiagramConfig,
    getSymbolDefinition: SymbolDefinitionLookup
  ): PrimitiveBounds[] {
    const bounds: PrimitiveBounds[] = [];

    // Collect bounds of non-selected primitives (excluding children of selected groups)
    const selectedGroupChildIds = this.getSelectedGroupChildIds(selectedIds, diagram);

    for (const primitive of diagram.primitives ?? []) {
      if (!selectedIds.has(primitive.id) && !selectedGroupChildIds.has(primitive.id)) {
        bounds.push(this.getPrimitiveBounds(primitive));
      }
    }

    // Collect bounds of non-selected elements
    for (const element of diagram.elements ?? []) {
      if (!selectedIds.has(element.id)) {
        bounds.push(this.getElementBounds(element));
      }
    }

    // Collect bounds of non-selected symbols
    for (const symbol of diagram.symbolInstances ?? []) {
      if (!selectedIds.has(symbol.id) && !selectedGroupChildIds.has(symbol.id)) {
        const def = getSymbolDefinition(symbol);
        if (def) {
          bounds.push(this.getSymbolBounds(symbol, def));
        }
      }
    }

    return bounds;
  }

  /**
   * Get IDs of all children of selected groups.
   * Used to exclude group children from alignment targets.
   */
  private getSelectedGroupChildIds(
    selectedIds: Set<string>,
    diagram: ProcessDiagramConfig
  ): Set<string> {
    const childIds = new Set<string>();

    for (const primitive of diagram.primitives ?? []) {
      if (selectedIds.has(primitive.id) && primitive.type === 'group') {
        const config = (primitive as unknown as { config: { childIds: string[] } }).config;
        config.childIds?.forEach(id => childIds.add(id));
      }
    }

    return childIds;
  }
}
