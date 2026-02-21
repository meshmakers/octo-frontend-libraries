import { Injectable } from '@angular/core';
import { ProcessDiagramConfig, ProcessElement } from '../../process-widget.models';
import { PrimitiveBase, isGroupPrimitive, GroupPrimitive } from '../../primitives';
import { SymbolInstance } from '../../primitives/models/symbol.model';
import { PathPrimitive, estimatePathBounds } from '../../primitives/models/path.model';

/**
 * Bounding box interface
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Result of a grouping operation
 */
export interface GroupingResult {
  /** Updated primitives array */
  primitives: PrimitiveBase[];
  /** ID of the created group */
  groupId: string;
  /** IDs that became children of the group */
  childIds: string[];
}

/**
 * Result of an ungrouping operation
 */
export interface UngroupingResult {
  /** Updated primitives array */
  primitives: PrimitiveBase[];
  /** IDs of removed groups */
  removedGroupIds: string[];
  /** IDs of freed children */
  freedChildIds: string[];
}

/**
 * Symbol bounds provider interface
 * The component must provide this to get symbol bounds
 */
export interface SymbolBoundsProvider {
  getSymbolBounds(symbol: SymbolInstance): BoundingBox;
}

/**
 * Designer Grouping Service
 *
 * Handles grouping and ungrouping of diagram items.
 * Groups are special primitives that contain references to other items.
 *
 * Follows Single Responsibility Principle - only handles grouping logic.
 * Returns new arrays without mutating the original diagram.
 *
 * Usage:
 * ```typescript
 * private readonly groupingService = inject(DesignerGroupingService);
 *
 * // Group selected items
 * groupSelected(): void {
 *   const result = this.groupingService.groupItems(
 *     diagram,
 *     selectedIds,
 *     generateId,
 *     symbolBoundsProvider
 *   );
 *   this._diagram.update(d => ({
 *     ...d,
 *     primitives: result.primitives
 *   }));
 *   this.selectionService.selectElement(result.groupId);
 * }
 * ```
 */
@Injectable()
export class DesignerGroupingService {

  // ============================================================================
  // Validation Methods
  // ============================================================================

  /**
   * Check if items can be grouped (need at least 2 items).
   *
   * @param selectedIds Set of selected item IDs
   * @returns True if items can be grouped
   */
  canGroup(selectedIds: Set<string>): boolean {
    return selectedIds.size >= 2;
  }

  /**
   * Check if selection contains groups that can be ungrouped.
   *
   * @param diagram Current diagram
   * @param selectedIds Set of selected item IDs
   * @returns True if any selected items are groups
   */
  canUngroup(diagram: ProcessDiagramConfig, selectedIds: Set<string>): boolean {
    const primitives = diagram.primitives ?? [];
    return primitives.some(p =>
      selectedIds.has(p.id) && isGroupPrimitive(p)
    );
  }

  /**
   * Get selected groups from the diagram.
   *
   * @param diagram Current diagram
   * @param selectedIds Set of selected item IDs
   * @returns Array of selected group primitives
   */
  getSelectedGroups(diagram: ProcessDiagramConfig, selectedIds: Set<string>): GroupPrimitive[] {
    const primitives = diagram.primitives ?? [];
    return primitives
      .filter(p => selectedIds.has(p.id) && isGroupPrimitive(p))
      .map(p => p as GroupPrimitive);
  }

  // ============================================================================
  // Grouping Operations
  // ============================================================================

  /**
   * Group items into a new group.
   * Flattens any existing groups in the selection.
   *
   * @param diagram Current diagram
   * @param selectedIds Set of selected item IDs
   * @param generateId Function to generate unique IDs
   * @param symbolBoundsProvider Provider for symbol bounds (optional)
   * @returns Grouping result with new primitives array
   */
  groupItems(
    diagram: ProcessDiagramConfig,
    selectedIds: Set<string>,
    generateId: () => string,
    symbolBoundsProvider?: SymbolBoundsProvider
  ): GroupingResult | null {
    if (!this.canGroup(selectedIds)) {
      return null;
    }

    const primitives = diagram.primitives ?? [];

    // Filter out any existing groups from selected items and expand their children
    // This prevents nesting groups within groups directly - we flatten first
    const childIds: string[] = [];
    const groupsToRemove: string[] = [];

    for (const id of selectedIds) {
      const primitive = primitives.find(p => p.id === id);
      if (primitive && isGroupPrimitive(primitive)) {
        // This is a group - add its children instead and mark for removal
        const group = primitive as GroupPrimitive;
        childIds.push(...group.config.childIds);
        groupsToRemove.push(id);
      } else {
        // Regular item - add directly
        childIds.push(id);
      }
    }

    // Calculate combined bounding box of all children
    const bounds = this.calculateCombinedBounds(diagram, childIds, symbolBoundsProvider);
    if (!bounds) {
      return null;
    }

    // Create new group
    const groupId = generateId();
    const group: GroupPrimitive = {
      id: groupId,
      type: 'group',
      position: { x: bounds.x, y: bounds.y },
      config: {
        childIds: childIds,
        originalBounds: { ...bounds }
      },
      name: `Group-${groupId.slice(-4)}`,
      visible: true,
      locked: false
    };

    // Update primitives: remove old groups, add new group
    const newPrimitives = [
      ...primitives.filter(p => !groupsToRemove.includes(p.id)),
      group
    ];

    return {
      primitives: newPrimitives,
      groupId,
      childIds
    };
  }

  /**
   * Ungroup selected groups.
   *
   * @param diagram Current diagram
   * @param selectedIds Set of selected item IDs
   * @returns Ungrouping result with new primitives array
   */
  ungroupItems(
    diagram: ProcessDiagramConfig,
    selectedIds: Set<string>
  ): UngroupingResult | null {
    if (!this.canUngroup(diagram, selectedIds)) {
      return null;
    }

    const primitives = diagram.primitives ?? [];
    const selectedGroups = this.getSelectedGroups(diagram, selectedIds);

    if (selectedGroups.length === 0) {
      return null;
    }

    // Collect all child IDs from groups being ungrouped
    const freedChildIds: string[] = [];
    const groupIds = new Set(selectedGroups.map(g => g.id));

    for (const group of selectedGroups) {
      freedChildIds.push(...group.config.childIds);
    }

    // Remove group primitives
    const newPrimitives = primitives.filter(p => !groupIds.has(p.id));

    return {
      primitives: newPrimitives,
      removedGroupIds: [...groupIds],
      freedChildIds
    };
  }

  // ============================================================================
  // Bounds Calculation
  // ============================================================================

  /**
   * Calculate the combined bounding box of items.
   *
   * @param diagram Current diagram
   * @param itemIds Array of item IDs
   * @param symbolBoundsProvider Optional provider for symbol bounds
   * @returns Combined bounding box or null if no items found
   */
  calculateCombinedBounds(
    diagram: ProcessDiagramConfig,
    itemIds: string[],
    symbolBoundsProvider?: SymbolBoundsProvider
  ): BoundingBox | null {
    if (itemIds.length === 0) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const id of itemIds) {
      // Check primitives
      const primitive = (diagram.primitives ?? []).find(p => p.id === id);
      if (primitive) {
        const bounds = this.getPrimitiveBounds(primitive);
        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
        maxX = Math.max(maxX, bounds.x + bounds.width);
        maxY = Math.max(maxY, bounds.y + bounds.height);
        continue;
      }

      // Check symbol instances
      const symbol = (diagram.symbolInstances ?? []).find(s => s.id === id);
      if (symbol) {
        const bounds = symbolBoundsProvider
          ? symbolBoundsProvider.getSymbolBounds(symbol)
          : this.getDefaultSymbolBounds(symbol);
        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
        maxX = Math.max(maxX, bounds.x + bounds.width);
        maxY = Math.max(maxY, bounds.y + bounds.height);
        continue;
      }

      // Check elements
      const element = diagram.elements.find(e => e.id === id);
      if (element) {
        const bounds = this.getElementBounds(element);
        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
        maxX = Math.max(maxX, bounds.x + bounds.width);
        maxY = Math.max(maxY, bounds.y + bounds.height);
      }
    }

    if (minX === Infinity) {
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
   * Get bounding box for a primitive.
   *
   * @param primitive The primitive to get bounds for
   * @returns Bounding box
   */
  getPrimitiveBounds(primitive: PrimitiveBase): BoundingBox {
    const pos = primitive.position;
    const config = (primitive as any).config ?? {};

    switch (primitive.type) {
      case 'rectangle':
        return {
          x: pos.x,
          y: pos.y,
          width: config.width ?? 100,
          height: config.height ?? 100
        };

      case 'ellipse':
        return {
          x: pos.x - (config.radiusX ?? 50),
          y: pos.y - (config.radiusY ?? 50),
          width: (config.radiusX ?? 50) * 2,
          height: (config.radiusY ?? 50) * 2
        };

      case 'line': {
        // Lines use config.start and config.end, which are absolute positions
        // (position.x/y is typically an offset that's already applied to start/end)
        const start = config.start ?? { x: pos.x, y: pos.y };
        const end = config.end ?? { x: pos.x + 100, y: pos.y };
        // Apply position offset if present (line coords can be relative to position)
        const x1 = pos.x + start.x;
        const y1 = pos.y + start.y;
        const x2 = pos.x + end.x;
        const y2 = pos.y + end.y;
        return {
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          width: Math.abs(x2 - x1) || 1,
          height: Math.abs(y2 - y1) || 1
        };
      }

      case 'polyline':
      case 'polygon':
        if (config.points && Array.isArray(config.points) && config.points.length > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const pt of config.points) {
            minX = Math.min(minX, pt.x);
            minY = Math.min(minY, pt.y);
            maxX = Math.max(maxX, pt.x);
            maxY = Math.max(maxY, pt.y);
          }
          return {
            x: pos.x + minX,
            y: pos.y + minY,
            width: maxX - minX || 1,
            height: maxY - minY || 1
          };
        }
        return { x: pos.x, y: pos.y, width: 100, height: 100 };

      case 'text': {
        // Text bounds are approximated
        const fontSize = config.style?.fontSize ?? 14;
        const textLength = (config.text ?? '').length;
        return {
          x: pos.x,
          y: pos.y,
          width: Math.max(textLength * fontSize * 0.6, 20),
          height: fontSize * 1.2
        };
      }

      case 'path': {
        // Use proper path bounds estimation that parses the d attribute
        return estimatePathBounds(primitive as PathPrimitive);
      }

      case 'group': {
        const groupConfig = config as { originalBounds?: { width: number; height: number } };
        return {
          x: pos.x,
          y: pos.y,
          width: groupConfig.originalBounds?.width ?? 100,
          height: groupConfig.originalBounds?.height ?? 100
        };
      }

      default:
        return { x: pos.x, y: pos.y, width: 100, height: 100 };
    }
  }

  /**
   * Get bounding box for an element.
   *
   * @param element The element to get bounds for
   * @returns Bounding box
   */
  getElementBounds(element: ProcessElement): BoundingBox {
    return {
      x: element.position.x,
      y: element.position.y,
      width: element.size?.width ?? 100,
      height: element.size?.height ?? 100
    };
  }

  /**
   * Get default bounds for a symbol instance (without definition).
   *
   * @param symbol The symbol instance
   * @returns Default bounding box
   */
  private getDefaultSymbolBounds(symbol: SymbolInstance): BoundingBox {
    const scale = symbol.scale ?? 1;
    return {
      x: symbol.position.x,
      y: symbol.position.y,
      width: 100 * scale,
      height: 100 * scale
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get all child IDs of a group, recursively.
   *
   * @param diagram Current diagram
   * @param groupId Group ID
   * @returns Set of all descendant IDs
   */
  getAllGroupDescendants(diagram: ProcessDiagramConfig, groupId: string): Set<string> {
    const descendants = new Set<string>();
    const primitives = diagram.primitives ?? [];

    const group = primitives.find(p => p.id === groupId);
    if (!group || !isGroupPrimitive(group)) {
      return descendants;
    }

    const groupPrimitive = group as GroupPrimitive;
    for (const childId of groupPrimitive.config.childIds) {
      descendants.add(childId);

      // Check if child is also a group
      const childPrimitive = primitives.find(p => p.id === childId);
      if (childPrimitive && isGroupPrimitive(childPrimitive)) {
        const childDescendants = this.getAllGroupDescendants(diagram, childId);
        childDescendants.forEach(id => descendants.add(id));
      }
    }

    return descendants;
  }

  /**
   * Find the parent group of an item.
   *
   * @param diagram Current diagram
   * @param itemId Item ID to find parent for
   * @returns Parent group or null
   */
  findParentGroup(diagram: ProcessDiagramConfig, itemId: string): GroupPrimitive | null {
    const primitives = diagram.primitives ?? [];

    for (const primitive of primitives) {
      if (isGroupPrimitive(primitive)) {
        const group = primitive as GroupPrimitive;
        if (group.config.childIds.includes(itemId)) {
          return group;
        }
      }
    }

    return null;
  }

  /**
   * Check if an item is inside a group.
   *
   * @param diagram Current diagram
   * @param itemId Item ID to check
   * @returns True if item is a child of any group
   */
  isItemInGroup(diagram: ProcessDiagramConfig, itemId: string): boolean {
    return this.findParentGroup(diagram, itemId) !== null;
  }

  /**
   * Get the top-level item for selection purposes.
   * If item is in a group, returns the group ID.
   *
   * @param diagram Current diagram
   * @param itemId Item ID
   * @returns Top-level item ID (group or self)
   */
  getTopLevelItem(diagram: ProcessDiagramConfig, itemId: string): string {
    const parent = this.findParentGroup(diagram, itemId);
    if (parent) {
      // Recursively check if the parent is also in a group
      return this.getTopLevelItem(diagram, parent.id);
    }
    return itemId;
  }
}
