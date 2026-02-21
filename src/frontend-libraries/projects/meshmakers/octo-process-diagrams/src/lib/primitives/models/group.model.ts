/**
 * Group Primitive Model
 *
 * A temporary container for grouping primitives and symbol instances.
 * Unlike Symbols (reusable, library-based), Groups are:
 * - Temporary (not stored in libraries)
 * - Non-editable (must ungroup to modify children)
 * - Treated as a single unit for move/resize
 */

import { PrimitiveBase, BoundingBox } from './primitive.models';

// ============================================================================
// Group Primitive Interface
// ============================================================================

/**
 * Configuration specific to group primitives
 */
export interface GroupConfig {
  /** IDs of children (primitives and/or symbol instances) */
  childIds: string[];

  /**
   * Original bounding box when group was created.
   * Used for proportional resize calculations.
   */
  originalBounds: BoundingBox;

  /** Whether to lock aspect ratio during resize */
  lockAspectRatio?: boolean;
}

/**
 * Group Primitive - A container for other primitives and symbols.
 *
 * Groups allow multiple elements to be moved and resized together
 * as a single unit. Children remain in their original arrays and
 * are referenced by ID.
 */
export interface GroupPrimitive extends PrimitiveBase {
  type: 'group';
  config: GroupConfig;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an object is a GroupPrimitive
 */
export function isGroupPrimitive(obj: unknown): obj is GroupPrimitive {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    (obj as GroupPrimitive).type === 'group' &&
    'config' in obj &&
    typeof (obj as GroupPrimitive).config === 'object' &&
    Array.isArray((obj as GroupPrimitive).config?.childIds)
  );
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a new GroupPrimitive
 *
 * @param id - Unique identifier for the group
 * @param childIds - IDs of primitives and symbols to include in the group
 * @param bounds - Bounding box containing all children
 * @param options - Optional additional properties
 * @returns A new GroupPrimitive
 */
export function createGroup(
  id: string,
  childIds: string[],
  bounds: BoundingBox,
  options?: Partial<Omit<GroupPrimitive, 'id' | 'type' | 'config' | 'position'>>
): GroupPrimitive {
  return {
    id,
    type: 'group',
    position: { x: bounds.x, y: bounds.y },
    config: {
      childIds: [...childIds],
      originalBounds: { ...bounds },
      lockAspectRatio: false
    },
    name: options?.name ?? `Group-${id.slice(-4)}`,
    zIndex: options?.zIndex,
    visible: options?.visible ?? true,
    locked: options?.locked ?? false,
    style: options?.style,
    transform: options?.transform
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Gets the current bounding box of a group based on its children.
 * This is a placeholder - actual implementation needs diagram context.
 *
 * @param group - The group primitive
 * @returns The group's bounding box from config
 */
export function getGroupBounds(group: GroupPrimitive): BoundingBox {
  // Returns the stored bounds - actual dynamic calculation
  // requires access to the diagram to look up children
  return {
    x: group.position.x,
    y: group.position.y,
    width: group.config.originalBounds.width,
    height: group.config.originalBounds.height
  };
}

/**
 * Updates a group's bounds after children have been modified.
 *
 * @param group - The group to update
 * @param newBounds - The new bounding box
 * @returns Updated group with new bounds
 */
export function updateGroupBounds(
  group: GroupPrimitive,
  newBounds: BoundingBox
): GroupPrimitive {
  return {
    ...group,
    position: { x: newBounds.x, y: newBounds.y },
    config: {
      ...group.config,
      originalBounds: { ...newBounds }
    }
  };
}

/**
 * Adds children to a group.
 *
 * @param group - The group to modify
 * @param childIds - IDs to add
 * @returns Updated group with additional children
 */
export function addChildrenToGroup(
  group: GroupPrimitive,
  childIds: string[]
): GroupPrimitive {
  const existingIds = new Set(group.config.childIds);
  const newIds = childIds.filter(id => !existingIds.has(id));

  return {
    ...group,
    config: {
      ...group.config,
      childIds: [...group.config.childIds, ...newIds]
    }
  };
}

/**
 * Removes children from a group.
 *
 * @param group - The group to modify
 * @param childIds - IDs to remove
 * @returns Updated group without specified children
 */
export function removeChildrenFromGroup(
  group: GroupPrimitive,
  childIds: string[]
): GroupPrimitive {
  const idsToRemove = new Set(childIds);

  return {
    ...group,
    config: {
      ...group.config,
      childIds: group.config.childIds.filter(id => !idsToRemove.has(id))
    }
  };
}

/**
 * Checks if a group is empty (has no children).
 *
 * @param group - The group to check
 * @returns True if group has no children
 */
export function isGroupEmpty(group: GroupPrimitive): boolean {
  return group.config.childIds.length === 0;
}

/**
 * Checks if an item is a child of a group.
 *
 * @param group - The group to check
 * @param itemId - The item ID to look for
 * @returns True if item is a child of the group
 */
export function isChildOfGroup(group: GroupPrimitive, itemId: string): boolean {
  return group.config.childIds.includes(itemId);
}
