import { TreeItemDataTyped } from '@meshmakers/shared-services';

/**
 * Metadata for a tree drag-and-drop operation.
 */
export interface NodeInfo {

  /**
   * The unique Runtime Identity of the node.
   */
  rtId: string;

  /**
   * The Content Kind Type ID (schema definition) of the node.
   */
  ckTypeId: string;
}

/**
 * Event emitted when a tree node is successfully dropped.
 */
export interface NodeDroppedEvent<T> {

  /**
   * The specific node being moved.
   */
  sourceItem: NodeInfo & { dataItem: TreeItemDataTyped<T> };

  /**
   * The original parent from which the node was dragged.
   */
  sourceParent?: NodeInfo | undefined;

  /**
   * The new target node where the item was dropped.
   *
   * If dropping *into* a folder, this is the folder.
   * If dropping *between* items, this may be the new sibling or parent.
   */
  destinationItem?: NodeInfo | undefined;

  /**
   * List of items to refresh after drop.
   */
  refreshItems: NodeInfo[];
}
