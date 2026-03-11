import { Injectable } from '@angular/core';
import { TreeItemDataTyped } from '@meshmakers/shared-services';
import { CkModelDto, CkTypeDto, RtEntityDto } from '../graphQL/globalTypes';

// Extended type to handle both Runtime Entities and CK Models/Types
type BrowserItem =
  | RtEntityDto
  | CkModelDto
  | CkTypeDto
  | { isCkModelsRoot?: boolean; ckModelId?: string };

export interface BrowserState {
  selectedItemId: string;
  selectedItemText: string;
  selectedItemData: BrowserItem;
  parentPath: TreeItemDataTyped<BrowserItem>[]; // Full path from root to parent (deprecated)
  expandedKeys: string[]; // IDs of expanded nodes (parent path)
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class RuntimeBrowserStateService {
  private currentState: BrowserState | null = null;

  /**
   * Save the current browser state including selected item information and parent path
   * @deprecated Use saveStateWithKeys instead for better performance
   */
  public saveState(
    selectedItem: TreeItemDataTyped<BrowserItem> | null,
    parentPath?: TreeItemDataTyped<BrowserItem>[],
  ): void {
    if (!selectedItem) {
      this.currentState = null;
      return;
    }

    this.currentState = {
      selectedItemId: this.getItemId(selectedItem),
      selectedItemText: selectedItem.text,
      selectedItemData: selectedItem.item,
      parentPath: parentPath || [],
      expandedKeys: [],
      timestamp: Date.now(),
    };

    console.debug('Runtime Browser State saved:', this.currentState);
    console.debug(
      'Parent path saved:',
      (parentPath || []).map((p) => p.text),
    );
  }

  /**
   * Save the current browser state using expanded keys from the tree.
   * This is more efficient as it doesn't require recursive tree traversal.
   */
  public saveStateWithKeys(
    selectedItem: TreeItemDataTyped<BrowserItem> | null,
    expandedKeys: string[],
  ): void {
    if (!selectedItem) {
      this.currentState = null;
      return;
    }

    this.currentState = {
      selectedItemId: this.getItemId(selectedItem),
      selectedItemText: selectedItem.text,
      selectedItemData: selectedItem.item,
      parentPath: [], // Not used with this method
      expandedKeys: expandedKeys,
      timestamp: Date.now(),
    };

    console.debug(
      'Runtime Browser State saved with keys:',
      this.currentState.selectedItemId,
    );
    console.debug('Expanded keys saved:', expandedKeys);
  }

  /**
   * Get the saved browser state
   */
  public getState(): BrowserState | null {
    // Only return state if it's less than 5 minutes old
    if (
      this.currentState &&
      Date.now() - this.currentState.timestamp < 300000
    ) {
      return this.currentState;
    }

    // Clear expired state
    if (this.currentState) {
      this.currentState = null;
    }

    return null;
  }

  /**
   * Clear the saved state
   */
  public clearState(): void {
    this.currentState = null;
  }

  /**
   * Check if the given item matches the saved state
   */
  public isItemMatching(item: TreeItemDataTyped<BrowserItem>): boolean {
    const state = this.getState();
    if (!state) return false;

    return this.getItemId(item) === state.selectedItemId;
  }

  /**
   * Get unique identifier for a tree item
   */
  private getItemId(item: TreeItemDataTyped<BrowserItem>): string {
    const itemData = item.item;

    // Runtime entity
    if ('rtId' in itemData && 'ckTypeId' in itemData) {
      return `${String(itemData.ckTypeId)}@${String(itemData.rtId)}`;
    }

    // CK Model
    if (
      'id' in itemData &&
      !('rtId' in itemData) &&
      !('ckTypeId' in itemData)
    ) {
      return `ck-model:${String(itemData.id)}`;
    }

    // CK Type
    if (
      'ckTypeId' in itemData &&
      !('rtId' in itemData) &&
      !('id' in itemData)
    ) {
      return `ck-type:${String(itemData.ckTypeId)}`;
    }

    // CK Models root
    if ('isCkModelsRoot' in itemData && itemData.isCkModelsRoot) {
      return 'ck-models-root';
    }

    return item.text || 'unknown';
  }
}
