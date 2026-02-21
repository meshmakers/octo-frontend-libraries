/**
 * Designer Alignment Service
 *
 * Provides alignment and distribution operations for multiple selected elements.
 * Supports aligning edges (left, right, top, bottom) and centers (horizontal, vertical),
 * as well as distributing elements evenly (horizontally, vertically).
 */

import { Injectable, inject } from '@angular/core';
import { Position } from '../../primitives';
import { ProcessDiagramConfig } from '../../process-widget.models';
import { SymbolInstance, SymbolDefinition } from '../../primitives/models/symbol.model';
import { DesignerBoundsService, SelectionBounds } from './designer-bounds.service';
import { DesignerPrimitiveService } from './designer-primitive.service';

export type SymbolDefinitionLookup = (symbol: SymbolInstance) => SymbolDefinition | null;

interface AlignableItem {
  id: string;
  type: 'primitive' | 'symbol' | 'element';
  bounds: SelectionBounds;
}

@Injectable()
export class DesignerAlignmentService {
  private readonly boundsService = inject(DesignerBoundsService);
  private readonly primitiveService = inject(DesignerPrimitiveService);

  /**
   * Collect all selected items with their bounds
   */
  private collectSelectedItems(
    selectedIds: Set<string>,
    diagram: ProcessDiagramConfig,
    getSymbolDefinition: SymbolDefinitionLookup
  ): AlignableItem[] {
    const items: AlignableItem[] = [];

    // Collect primitives
    for (const primitive of diagram.primitives ?? []) {
      if (selectedIds.has(primitive.id)) {
        items.push({
          id: primitive.id,
          type: 'primitive',
          bounds: this.boundsService.getPrimitiveBounds(primitive)
        });
      }
    }

    // Collect symbols
    for (const symbol of diagram.symbolInstances ?? []) {
      if (selectedIds.has(symbol.id)) {
        const def = getSymbolDefinition(symbol);
        if (def) {
          items.push({
            id: symbol.id,
            type: 'symbol',
            bounds: this.boundsService.getSymbolBounds(symbol, def)
          });
        }
      }
    }

    // Collect elements
    for (const element of diagram.elements ?? []) {
      if (selectedIds.has(element.id)) {
        items.push({
          id: element.id,
          type: 'element',
          bounds: this.boundsService.getElementBounds(element)
        });
      }
    }

    return items;
  }

  /**
   * Create position updates for alignment
   */
  private createAlignmentUpdates(
    items: AlignableItem[],
    calculateNewPosition: (item: AlignableItem) => Position
  ): Map<string, Position> {
    const updates = new Map<string, Position>();
    for (const item of items) {
      updates.set(item.id, calculateNewPosition(item));
    }
    return updates;
  }

  /**
   * Apply position updates to the diagram
   */
  applyPositionUpdates(
    diagram: ProcessDiagramConfig,
    updates: Map<string, Position>,
    selectedIds: Set<string>
  ): ProcessDiagramConfig {
    return {
      ...diagram,
      primitives: (diagram.primitives ?? []).map(p => {
        if (!selectedIds.has(p.id)) return p;
        const newPos = updates.get(p.id);
        if (!newPos) return p;
        const currentBounds = this.boundsService.getPrimitiveBounds(p);
        const delta = { x: newPos.x - currentBounds.x, y: newPos.y - currentBounds.y };
        return this.primitiveService.move(p, delta);
      }),
      symbolInstances: (diagram.symbolInstances ?? []).map(s => {
        if (!selectedIds.has(s.id)) return s;
        const newPos = updates.get(s.id);
        if (!newPos) return s;
        return { ...s, position: newPos };
      }),
      elements: (diagram.elements ?? []).map(e => {
        if (!selectedIds.has(e.id)) return e;
        const newPos = updates.get(e.id);
        if (!newPos) return e;
        return { ...e, position: newPos };
      })
    };
  }

  // ==========================================================================
  // Alignment Methods
  // ==========================================================================

  /**
   * Align all selected items to the left edge
   * Returns the updated diagram or null if alignment not possible
   */
  alignLeft(
    selectedIds: Set<string>,
    diagram: ProcessDiagramConfig,
    getSymbolDefinition: SymbolDefinitionLookup
  ): ProcessDiagramConfig | null {
    if (selectedIds.size < 2) return null;

    const items = this.collectSelectedItems(selectedIds, diagram, getSymbolDefinition);
    if (items.length < 2) return null;

    const minX = Math.min(...items.map(item => item.bounds.x));

    const updates = this.createAlignmentUpdates(items, item => ({
      x: minX,
      y: item.bounds.y
    }));

    return this.applyPositionUpdates(diagram, updates, selectedIds);
  }

  /**
   * Align all selected items to the right edge
   */
  alignRight(
    selectedIds: Set<string>,
    diagram: ProcessDiagramConfig,
    getSymbolDefinition: SymbolDefinitionLookup
  ): ProcessDiagramConfig | null {
    if (selectedIds.size < 2) return null;

    const items = this.collectSelectedItems(selectedIds, diagram, getSymbolDefinition);
    if (items.length < 2) return null;

    const maxRight = Math.max(...items.map(item => item.bounds.x + item.bounds.width));

    const updates = this.createAlignmentUpdates(items, item => ({
      x: maxRight - item.bounds.width,
      y: item.bounds.y
    }));

    return this.applyPositionUpdates(diagram, updates, selectedIds);
  }

  /**
   * Align all selected items to the top edge
   */
  alignTop(
    selectedIds: Set<string>,
    diagram: ProcessDiagramConfig,
    getSymbolDefinition: SymbolDefinitionLookup
  ): ProcessDiagramConfig | null {
    if (selectedIds.size < 2) return null;

    const items = this.collectSelectedItems(selectedIds, diagram, getSymbolDefinition);
    if (items.length < 2) return null;

    const minY = Math.min(...items.map(item => item.bounds.y));

    const updates = this.createAlignmentUpdates(items, item => ({
      x: item.bounds.x,
      y: minY
    }));

    return this.applyPositionUpdates(diagram, updates, selectedIds);
  }

  /**
   * Align all selected items to the bottom edge
   */
  alignBottom(
    selectedIds: Set<string>,
    diagram: ProcessDiagramConfig,
    getSymbolDefinition: SymbolDefinitionLookup
  ): ProcessDiagramConfig | null {
    if (selectedIds.size < 2) return null;

    const items = this.collectSelectedItems(selectedIds, diagram, getSymbolDefinition);
    if (items.length < 2) return null;

    const maxBottom = Math.max(...items.map(item => item.bounds.y + item.bounds.height));

    const updates = this.createAlignmentUpdates(items, item => ({
      x: item.bounds.x,
      y: maxBottom - item.bounds.height
    }));

    return this.applyPositionUpdates(diagram, updates, selectedIds);
  }

  /**
   * Align all selected items to horizontal center
   */
  alignHorizontalCenter(
    selectedIds: Set<string>,
    diagram: ProcessDiagramConfig,
    getSymbolDefinition: SymbolDefinitionLookup
  ): ProcessDiagramConfig | null {
    if (selectedIds.size < 2) return null;

    const items = this.collectSelectedItems(selectedIds, diagram, getSymbolDefinition);
    if (items.length < 2) return null;

    // Calculate average horizontal center
    const avgCenterX = items.reduce(
      (sum, item) => sum + item.bounds.x + item.bounds.width / 2, 0
    ) / items.length;

    const updates = this.createAlignmentUpdates(items, item => ({
      x: avgCenterX - item.bounds.width / 2,
      y: item.bounds.y
    }));

    return this.applyPositionUpdates(diagram, updates, selectedIds);
  }

  /**
   * Align all selected items to vertical center
   */
  alignVerticalCenter(
    selectedIds: Set<string>,
    diagram: ProcessDiagramConfig,
    getSymbolDefinition: SymbolDefinitionLookup
  ): ProcessDiagramConfig | null {
    if (selectedIds.size < 2) return null;

    const items = this.collectSelectedItems(selectedIds, diagram, getSymbolDefinition);
    if (items.length < 2) return null;

    // Calculate average vertical center
    const avgCenterY = items.reduce(
      (sum, item) => sum + item.bounds.y + item.bounds.height / 2, 0
    ) / items.length;

    const updates = this.createAlignmentUpdates(items, item => ({
      x: item.bounds.x,
      y: avgCenterY - item.bounds.height / 2
    }));

    return this.applyPositionUpdates(diagram, updates, selectedIds);
  }

  // ==========================================================================
  // Distribution Methods
  // ==========================================================================

  /**
   * Distribute selected items evenly horizontally
   * Requires at least 3 items
   */
  distributeHorizontally(
    selectedIds: Set<string>,
    diagram: ProcessDiagramConfig,
    getSymbolDefinition: SymbolDefinitionLookup
  ): ProcessDiagramConfig | null {
    if (selectedIds.size < 3) return null;

    const items = this.collectSelectedItems(selectedIds, diagram, getSymbolDefinition);
    if (items.length < 3) return null;

    // Sort by X position
    items.sort((a, b) => a.bounds.x - b.bounds.x);

    const first = items[0];
    const last = items[items.length - 1];

    // Total span from left of first to right of last
    const totalSpan = (last.bounds.x + last.bounds.width) - first.bounds.x;
    const totalItemWidth = items.reduce((sum, item) => sum + item.bounds.width, 0);
    const totalGap = totalSpan - totalItemWidth;
    const gapBetween = totalGap / (items.length - 1);

    const updates = new Map<string, Position>();

    // First item stays in place
    updates.set(first.id, { x: first.bounds.x, y: first.bounds.y });

    // Distribute middle items evenly
    let currentX = first.bounds.x + first.bounds.width + gapBetween;
    for (let i = 1; i < items.length - 1; i++) {
      const item = items[i];
      updates.set(item.id, { x: currentX, y: item.bounds.y });
      currentX += item.bounds.width + gapBetween;
    }

    // Last item stays in place
    updates.set(last.id, { x: last.bounds.x, y: last.bounds.y });

    return this.applyPositionUpdates(diagram, updates, selectedIds);
  }

  /**
   * Distribute selected items evenly vertically
   * Requires at least 3 items
   */
  distributeVertically(
    selectedIds: Set<string>,
    diagram: ProcessDiagramConfig,
    getSymbolDefinition: SymbolDefinitionLookup
  ): ProcessDiagramConfig | null {
    if (selectedIds.size < 3) return null;

    const items = this.collectSelectedItems(selectedIds, diagram, getSymbolDefinition);
    if (items.length < 3) return null;

    // Sort by Y position
    items.sort((a, b) => a.bounds.y - b.bounds.y);

    const first = items[0];
    const last = items[items.length - 1];

    // Total span from top of first to bottom of last
    const totalSpan = (last.bounds.y + last.bounds.height) - first.bounds.y;
    const totalItemHeight = items.reduce((sum, item) => sum + item.bounds.height, 0);
    const totalGap = totalSpan - totalItemHeight;
    const gapBetween = totalGap / (items.length - 1);

    const updates = new Map<string, Position>();

    // First item stays in place
    updates.set(first.id, { x: first.bounds.x, y: first.bounds.y });

    // Distribute middle items evenly
    let currentY = first.bounds.y + first.bounds.height + gapBetween;
    for (let i = 1; i < items.length - 1; i++) {
      const item = items[i];
      updates.set(item.id, { x: item.bounds.x, y: currentY });
      currentY += item.bounds.height + gapBetween;
    }

    // Last item stays in place
    updates.set(last.id, { x: last.bounds.x, y: last.bounds.y });

    return this.applyPositionUpdates(diagram, updates, selectedIds);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Check if alignment is possible (at least 2 items selected)
   */
  canAlign(selectedIds: Set<string>): boolean {
    return selectedIds.size >= 2;
  }

  /**
   * Check if distribution is possible (at least 3 items selected)
   */
  canDistribute(selectedIds: Set<string>): boolean {
    return selectedIds.size >= 3;
  }
}
