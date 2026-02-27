import { AfterViewInit, Component, inject, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommandItem, TreeItemDataTyped } from '@meshmakers/shared-services';
import {
  BaseTreeDetailComponent,
  InputService,
  NodeDroppedEvent,
} from '@meshmakers/shared-ui';
import { NotificationService } from '@progress/kendo-angular-notification';
import {
  arrowRotateCwIcon,
  locationsIcon,
  plusIcon,
  xIcon,
} from '@progress/kendo-svg-icons';
import { firstValueFrom } from 'rxjs';
import { RuntimeBrowserDetailsComponent } from './components/runtime-browser-details.component';
import { RuntimeBrowserDataSource } from './data-sources/runtime-browser-data-source.service';
import { GetRuntimeEntityByIdDtoGQL } from './graphQL/getRuntimeEntityById';
import {
  CkModelDto,
  CkTypeDto,
  GetCkTypesDtoGQL,
  RtEntityDto,
} from './graphQL/globalTypes';
import { RtEntityIdHelper } from './models/rt-entity-id';
import { RuntimeBrowserStateService } from './services/runtime-browser-state.service';
import { TypeHelperService } from './services/type-helper.service';

// Extended type to handle both Runtime Entities and CK Models/Types
type BrowserItem =
  | RtEntityDto
  | CkModelDto
  | CkTypeDto
  | { isCkModelsRoot?: boolean; ckModelId?: string };

@Component({
  selector: 'mm-runtime-browser',
  imports: [BaseTreeDetailComponent, RuntimeBrowserDetailsComponent],
  template: `
    <div class="runtime-browser-container">
      <!-- LCARS Header -->
      <div class="lcars-page-header">
        <div class="lcars-header-accent"></div>
        <div class="header-content">
          <h1 class="page-title">
            <span class="title-prefix">REPOSITORY</span>
            <span class="title-main">Runtime Browser</span>
          </h1>
          <div class="header-stats">
            <div class="stat-badge">
              <span class="badge-icon">&#9632;</span>
              <span class="badge-label">Entities & Data</span>
            </div>
          </div>
        </div>
        <div class="lcars-header-line"></div>
      </div>

      <!-- Main Content -->
      <div class="lcars-content-panel">
        <div class="panel-accent-top"></div>
        <mm-base-tree-detail
          #treeDetail
          [treeDataSource]="dataSource"
          [leftPaneSize]="'25%'"
          [leftToolbarActions]="leftToolbarActions"
          [rightToolbarActions]="rightToolbarActions"
          (nodeSelected)="onNodeSelected($event)"
          (nodeDropped)="onNodeDropped($event)"
        >
          <mm-runtime-browser-details
            #detailsPanel
            slot="detail-panel"
            [selectedItem]="selectedItem"
            (entitySaved)="refreshTreeAfterCreation($event || undefined)"
          >
          </mm-runtime-browser-details>
        </mm-base-tree-detail>
        <div class="panel-accent-bottom"></div>
      </div>

      <!-- LCARS Footer -->
      <div class="lcars-footer">
        <div class="footer-bar bar-1"></div>
        <div class="footer-bar bar-2"></div>
        <div class="footer-bar bar-3"></div>
        <div class="footer-spacer"></div>
        <div class="footer-indicator">
          <span class="indicator-dot"></span>
          <span class="indicator-text">READY</span>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./runtime-browser.component.scss'],
})
export class RuntimeBrowserComponent implements AfterViewInit {
  protected readonly ckTypesGQL = inject(GetCkTypesDtoGQL);
  protected readonly dataSource = inject(RuntimeBrowserDataSource);
  private readonly getRuntimeEntityByIdGQL = inject(GetRuntimeEntityByIdDtoGQL);
  private readonly inputService = inject(InputService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly stateService = inject(RuntimeBrowserStateService);
  private readonly typeHelperService = inject(TypeHelperService);
  private readonly notificationService = inject(NotificationService);

  private isSelectedItemAnRtEntity = false;
  private isLoading = false;
  private isCreating = false;

  @ViewChild('treeDetail', { static: false })
  treeDetail!: BaseTreeDetailComponent<BrowserItem>;
  @ViewChild('detailsPanel', { static: false })
  detailsPanel!: RuntimeBrowserDetailsComponent;
  // Define toolbar actions
  protected readonly leftToolbarActions: CommandItem[] = [
    {
      id: 'goto-entity',
      type: 'link',
      text: 'Goto Entity',
      svgIcon: locationsIcon,
      onClick: async () => await this.onGotoEntity(),
      isDisabled: () => !this.isGoToEntityButtonEnabled,
    },
  ];

  protected readonly rightToolbarActions: CommandItem[] = [
    {
      id: 'refresh',
      type: 'link',
      text: 'Refresh',
      svgIcon: arrowRotateCwIcon,
      onClick: async () => await this.onRefresh(),
      isDisabled: () => !this.isRefreshButtonEnabled,
    },
    {
      id: 'create',
      type: 'link',
      text: 'Create',
      svgIcon: plusIcon,
      onClick: async () => await this.onCreate(),
      isDisabled: () => !this.isCreateButtonEnabled,
    },
    {
      id: 'delete',
      type: 'link',
      text: 'Delete',
      svgIcon: xIcon,
      onClick: async () => await this.onDelete(),
      isDisabled: () => !this.isDeleteButtonEnabled,
    },
  ];

  private _selectedItem: TreeItemDataTyped<BrowserItem> | null = null;
  protected get selectedItem(): TreeItemDataTyped<BrowserItem> | null {
    return this._selectedItem;
  }
  protected set selectedItem(item: TreeItemDataTyped<BrowserItem> | null) {
    this._selectedItem = item;
    this.isSelectedItemAnRtEntity = item
      ? this.typeHelperService.isRuntimeEntity(item.item)
      : false;
  }

  private get isGoToEntityButtonEnabled() {
    return !this.isLoading;
  }
  private get isRefreshButtonEnabled() {
    return !this.isLoading;
  }
  private get isCreateButtonEnabled() {
    return !this.isLoading && !this.isCreating;
  }
  private get isDeleteButtonEnabled() {
    return !this.isLoading && this.isSelectedItemAnRtEntity;
  }

  ngAfterViewInit(): void {
    // Restore tree state after the tree has been initialized
    this.waitForTreeComponent().then((isReady) => {
      if (isReady) {
        this.restoreTreeState();
      } else {
        console.warn('⚠️ Tree component not ready, skipping state restoration');
      }
    });
  }

  /**
   * Wait for the tree component to be fully initialized and ready
   */
  private async waitForTreeComponent(): Promise<boolean> {
    const maxAttempts = 50; // 5 seconds max (50 * 100ms)
    let attempts = 0;

    while (attempts < maxAttempts) {
      if (this.treeDetail?.waitForTreeReady) {
        const isReady = await this.treeDetail.waitForTreeReady();
        if (isReady) {
          console.debug(
            '✅ Tree component chain is ready after',
            attempts * 100,
            'ms',
          );
          return true;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    console.warn('⚠️ Tree component chain not ready after 5 seconds');
    return false;
  }

  /**
   * Restore the previously selected tree item and expand path
   */
  private async restoreTreeState(): Promise<void> {
    const savedState = this.stateService.getState();
    if (!savedState) {
      console.debug('No saved state to restore');
      return;
    }

    console.debug('🔄 Starting tree state restoration:', savedState);

    try {
      // First refresh the tree to ensure it's in a clean state
      await this.treeDetail.refreshTree();
      console.debug('🔄 Tree refreshed, starting restoration process');

      // Use the saved expanded keys if available, otherwise fall back to parentPath
      let ids: string[] = [];
      if (savedState.expandedKeys && savedState.expandedKeys.length > 0) {
        ids = [...savedState.expandedKeys];
      } else if (savedState.parentPath) {
        // Fallback for old saved states
        for (const pathItem of savedState.parentPath) {
          const id = this.getItemKey(pathItem);
          if (id && id !== 'undefined') {
            ids.push(id);
          }
        }
      }

      // Add the selected item's key
      const selectedItemKey = this.getItemKey(savedState);
      if (
        selectedItemKey &&
        selectedItemKey !== 'undefined' &&
        !ids.includes(selectedItemKey)
      ) {
        ids.push(selectedItemKey);
      }

      this.treeDetail.setExpandedKeys(ids);
      console.debug('🔑 Expanded keys set for restoration:', ids);

      // Give the tree time to expand visually
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Create a TreeItemDataTyped from the saved state directly
      const restoredItem = this.createTreeItemFromSavedState(savedState);
      if (restoredItem) {
        console.debug('✅ Successfully restored tree selection:', restoredItem);
        // Set the selected item which will trigger the details display
        this.selectedItem = restoredItem;
        console.debug('🎯 Tree selection and details display restored');
      } else {
        console.debug(
          '❌ Could not create item from saved state, clearing state',
        );
        this.stateService.clearState();
      }
    } catch (error: unknown) {
      console.error('💥 Error restoring tree state:', error);
      this.stateService.clearState();
    }
  }

  protected onNodeSelected(treeItem: any): void {
    console.debug('Runtime Browser - Node selected:', treeItem);
    this.selectedItem = treeItem;

    // Save the state using the expanded keys from the tree (no recursive search needed)
    this.saveStateFromExpandedKeys(treeItem);
  }

  /**
   * Boilerplate for showing warning notification.
   *
   * @param message Message of the warning.
   */
  private _showWarningNotification(message: string) {
    this.notificationService.show({
      content: message,
      hideAfter: 3000,
      position: { horizontal: 'right', vertical: 'top' },
      animation: { type: 'fade', duration: 400 },
      type: { style: 'warning', icon: true },
    });
  }

  /**
   * Occurs when item has been dropped on the Runtime Browser tree.
   *
   * @param event Metadata of the drag and drop operation.
   */
  protected async onNodeDropped(event: NodeDroppedEvent<BrowserItem>) {
    console.debug('Runtime Browser - Node dropped:', event);

    if (!event.destinationItem) {
      const msg = 'Moving item to the root of the tree is not supported';
      this._showWarningNotification(msg);
      console.debug(msg, event);
      return;
    }

    if (!event.sourceParent) {
      const msg = 'Moving item on the root of the tree is not supported';
      this._showWarningNotification(msg);
      console.debug(msg, event);
      return;
    }

    if (!event.sourceItem.rtId || !event.destinationItem.rtId) {
      const msg = 'Moving Construction Kit objects is not supported';
      this._showWarningNotification(msg);
      console.debug(msg, event);
      return;
    }

    if (
      event.sourceItem.rtId === event.destinationItem.rtId ||
      event.sourceParent.rtId === event.destinationItem.rtId
    ) {
      const msg = 'Dropped entity to same hierarchy level';
      this._showWarningNotification(msg);
      console.debug(msg, event);
      return;
    }

    const allowedSrcItemCkTypeIds = ['Basic/TreeNode'];

    if (allowedSrcItemCkTypeIds.indexOf(event.sourceItem.ckTypeId) === -1) {
      const msg = 'Moving item other than Basic/TreeNode is not supported';
      this._showWarningNotification(msg);
      console.debug(msg, event);
      return;
    }

    const allowedDstParentItemCkTypeIds = ['Basic/TreeNode', 'Basic/Tree'];

    if (
      allowedDstParentItemCkTypeIds.indexOf(event.destinationItem.ckTypeId) ===
      -1
    ) {
      const msg = 'Moving item to given parent is not supported';
      this._showWarningNotification(msg);
      console.debug(msg, event);
      return;
    }

    try {
      this.isLoading = true;
      this.treeDetail.setEnabledState(false);

      const updateSucceeded =
        await this.dataSource.updateParentChildAssociation(
          event.sourceItem.rtId,
          event.sourceParent.ckTypeId,
          event.sourceParent.rtId,
          event.destinationItem.ckTypeId,
          event.destinationItem.rtId,
        );

      // Update failed due to query / db error.
      if (!updateSucceeded) {
        console.debug(
          'Cannot update association due to an error in the GraphQL request.',
        );
        return;
      }

      // If new destination item (upper level) is not expanded yet, expand it.
      const expandedKeys = this.treeDetail.getExpandedKeys();
      const expandKey =
        event.destinationItem.ckTypeId === 'Basic/Tree'
          ? `${event.destinationItem.ckTypeId}@${event.destinationItem.rtId}`
          : event.destinationItem.rtId;
      if (expandedKeys.indexOf(expandKey) === -1) {
        this.treeDetail.setExpandedKeys([...expandedKeys, expandKey]);
      }

      // Refresh tree if any entity is root node, otherwise do refresh on specified entities.
      if (
        event.refreshItems.some(
          (refItem: RtEntityDto) => refItem.ckTypeId === 'Basic/Tree',
        ) ||
        event.destinationItem.ckTypeId === 'Basic/Tree'
      ) {
        await this.treeDetail.refreshTree();
      } else {
        const entitiesToRefresh = [];
        for (const toRef of event.refreshItems) {
          entitiesToRefresh.push({
            ckTypeId: toRef.ckTypeId,
            rtId: toRef.rtId,
            isRoot: toRef.ckTypeId === 'Basic/Tree',
          });
        }

        await this.treeDetail.refreshRuntimeEntities(entitiesToRefresh);
      }

      // select item afterwards to better track drag / drop
      this.selectedItem = event.sourceItem.dataItem;
    } catch (error: unknown) {
      console.error(
        'Error updating tree node parent after drag-and-drop:',
        error,
      );
    } finally {
      this.treeDetail.setEnabledState(true);
      this.isLoading = false;
    }
  }

  /**
   * Save the state using the expanded keys from the tree component.
   * This is much more efficient than recursively searching for the path.
   */
  private saveStateFromExpandedKeys(
    selectedItem: TreeItemDataTyped<BrowserItem>,
  ): void {
    // Get the expanded keys directly from the tree component - these represent the path
    const expandedKeys = this.treeDetail?.getExpandedKeys() ?? [];
    console.debug('📍 Saving state with expanded keys:', expandedKeys);

    // Convert expanded keys to a simple path representation for the state service
    // The expanded keys already contain the IDs of all expanded parent nodes
    this.stateService.saveStateWithKeys(selectedItem, expandedKeys);
  }

  /**
   * Generate a unique key for a tree item (same logic as in TreeComponent)
   */
  private getItemKey(dataItem: TreeItemDataTyped<BrowserItem> | any): string {
    // Handle different input types
    let data: any;

    if (dataItem?.item) {
      // TreeItemDataTyped case
      data = dataItem.item as any;
    } else if (dataItem?.selectedItemData) {
      // Saved state case
      data = dataItem.selectedItemData as any;
    } else {
      // Direct data case
      data = dataItem as any;
    }

    // For runtime entities
    if (data?.rtId && data?.ckTypeId) {
      return `${data.ckTypeId}@${data.rtId}`;
    }

    // For CK Models
    if (data?.id) {
      return `model:${data.id}`;
    }

    // For CK Types
    if (data?.ckTypeId && !data?.rtId) {
      return `type:${data.ckTypeId}`;
    }

    // For special nodes
    if (data?.isCkModelsRoot) {
      return 'ck-models-root';
    }

    // Fallback to text
    return dataItem?.text || dataItem?.selectedItemText || JSON.stringify(data);
  }

  /**
   * Create a TreeItemDataTyped from saved state data
   */
  private createTreeItemFromSavedState(
    savedState: any,
  ): TreeItemDataTyped<BrowserItem> | null {
    try {
      const data = savedState.selectedItemData;
      const text = savedState.selectedItemText;
      const id = savedState.selectedItemId;

      if (!data || !text || !id) {
        console.warn('⚠️ Incomplete saved state data:', savedState);
        return null;
      }

      // Create a TreeItemDataTyped with the saved data
      return new TreeItemDataTyped<BrowserItem>(
        id,
        text,
        text, // Use text as tooltip
        data,
        null as any, // SVG icon - not critical for restoration
        false, // expandable - not critical for restoration
      );
    } catch (error: unknown) {
      console.error('💥 Error creating tree item from saved state:', error);
      return null;
    }
  }

  /**
   * Toolbar action: Open dialog to navigate to entity
   */
  protected async onGotoEntity(): Promise<void> {
    try {
      const entityIdentifier = await this.inputService.showInputDialog(
        'Go to Entity',
        'Enter entity identifier in format "ckTypeId@rtId":',
        'ckTypeId@rtId',
        'Go',
      );

      if (entityIdentifier) {
        await this.navigateToEntityDetails(entityIdentifier);
      }
    } catch (error: unknown) {
      console.error('Error in goto entity dialog:', error);
    }
  }

  /**
   * Toolbar action: Refresh tree data
   */
  protected async onRefresh(): Promise<void> {
    console.debug('Refresh action triggered');
    try {
      const nodes = await this.dataSource.fetchRootNodes();
      console.debug('Tree refreshed with', nodes.length, 'root nodes');
    } catch (error: unknown) {
      console.error('Error refreshing tree:', error);
    }
  }

  /**
   * Toolbar action: Delete selected tree node
   */
  protected async onDelete(): Promise<void> {
    console.debug('Delete tree node action triggered');

    if (!this.selectedItem) {
      console.warn(
        'No node selected; cannot perform delete operation on unknown node',
      );
      return;
    }

    try {
      this.isLoading = true;
      this.treeDetail.setEnabledState(false);

      if (!this.isSelectedItemAnRtEntity) {
        console.warn(
          'Selected item is not a runtime entity, cannot delete.',
          this.selectedItem,
        );
        return;
      }

      const runtimeEntity = this.selectedItem.item as RtEntityDto;

      const parentIdPair = await this.dataSource.getRuntimeEntityParentData(
        runtimeEntity.ckTypeId,
        runtimeEntity.rtId,
      );

      const deleteState = await this.dataSource.deleteRtEntityAndChildren(
        this.selectedItem,
      );
      if (!deleteState) {
        console.warn(
          'Runtime entity node deletion failed for selected object',
          this.selectedItem,
        );
        return;
      }

      if (parentIdPair) {
        await this.treeDetail.refreshRuntimeEntities([
          {
            ckTypeId: parentIdPair.ckTypeId,
            rtId: parentIdPair.rtId,
            isRoot: parentIdPair.ckTypeId === 'Basic/Tree',
          },
        ]);
      } else {
        // we do not have parent node, so selected node is top level item. So, we need to refresh root nodes
        await this.treeDetail.refreshTree();
      }

      this.selectedItem = null;
    } catch (error: unknown) {
      console.error('Error deleting tree node:', error);
    } finally {
      this.treeDetail.setEnabledState(true);
      this.isLoading = false;
    }
  }

  /**
   * Navigate to entity details route using the format "ckTypeId@rtId"
   * @param entityIdentifier - String in format "ckTypeId@rtId"
   * @example navigateToEntityDetails("Basic/TreeNode@507f1f77bcf86cd799439011")
   */
  private async navigateToEntityDetails(
    entityIdentifier: string,
  ): Promise<void> {
    // Parse the identifier
    const parts = entityIdentifier.split('@');
    if (parts.length !== 2) {
      console.error(
        'Invalid entity identifier format. Expected "ckTypeId@rtId"',
      );
      return;
    }

    const [ckTypeId, rtId] = parts;

    try {
      // Verify entity exists before navigating
      const result = await firstValueFrom(
        this.getRuntimeEntityByIdGQL.fetch({
          variables: {
            ckTypeId: ckTypeId,
            rtId: rtId,
          },
        }),
      );

      const entity = result.data?.runtime?.runtimeEntities?.items?.[0];
      if (!entity) {
        console.error(`Entity not found: ${entityIdentifier}`);
        return;
      }

      // Get tenant ID from parent route parameters
      let currentRoute: ActivatedRoute | null = this.route;
      let tenantId: string | null = null;

      // Walk up the route tree to find tenantId
      while (currentRoute) {
        tenantId = currentRoute.snapshot.paramMap.get('tenantId');
        if (tenantId) {
          break;
        }
        currentRoute = currentRoute.parent;
      }

      if (!tenantId) {
        console.error('Tenant ID not found in route hierarchy');
        return;
      }

      // Navigate to entity detail route using Base64 encoded identifier
      // Parse the identifier to validate format
      if (!RtEntityIdHelper.isValidFormat(entityIdentifier)) {
        console.error(
          'Invalid entity identifier format. Expected "ckTypeId@rtId"',
        );
        return;
      }

      // Encode the identifier for URL safety
      const encodedId = RtEntityIdHelper.encodeFromString(entityIdentifier);

      await this.router.navigate([
        '/',
        tenantId,
        'repository',
        'browser',
        'entity',
        encodedId,
      ]);

      console.debug(`Navigating to entity details: ${entityIdentifier}`);
    } catch (error: unknown) {
      console.error(`Error navigating to entity ${entityIdentifier}:`, error);
    }
  }

  /**
   * Main action to initiate the creation of a new node
   */
  protected async onCreate(): Promise<void> {
    // Anti-spam validation: prevent multiple clicks
    if (this.isCreating) {
      return;
    }

    try {
      this.isCreating = true;

      // Fetch available Construction Kit types from the API
      const result = await firstValueFrom(this.ckTypesGQL.fetch());
      const allTypes = result.data?.constructionKit?.types?.items || [];
      const isRootLevel = !this.selectedItem;
      const filteredTypes = this.getCompatibleTreeTypes(allTypes, isRootLevel);

      // Transition the details panel into Create Mode
      // Pass null as parent if no item is selected (creates root-level entity)
      this.detailsPanel?.enterCreateMode(
        this.selectedItem || null,
        filteredTypes as CkTypeDto[],
      );
    } catch (err) {
      console.error('Failed to load types for creation:', err);
    } finally {
      this.isCreating = false;
    }
  }

  /**
   * Filters the list of types to find compatible types for entity creation.
   * For root-level creation, only allows Basic/Tree types.
   * For child creation, allows non-abstract TreeNode types.
   *
   * @param types - All available CK types
   * @param isRootLevel - If true, only Basic/Tree types are allowed
   * @returns Filtered list of compatible types
   */
  private getCompatibleTreeTypes(types: any[], isRootLevel = false): any[] {
    // For root-level creation, only allow Basic/Tree types
    if (isRootLevel) {
      return types.filter((type) => {
        const isBasicTree = type?.rtCkTypeId === 'Basic/Tree';
        return isBasicTree;
      });
    }

    // For child creation, allow non-abstract TreeNode types
    const filtered = types.filter((type) => {
      const isNotAbstract = type?.isAbstract === false;
      const isTreeNodeFamily = this.isTreeNodeType(type);

      return isNotAbstract && isTreeNodeFamily;
    });

    // If no TreeNode types found, fallback to all non-abstract types
    if (filtered.length === 0) {
      return types.filter((type) => type?.isAbstract === false);
    }

    return filtered;
  }

  /**
   * Checks if a specific type or its base type belongs to the TreeNode hierarchy
   */
  private isTreeNodeType(type: any): boolean {
    const typeFullName = type?.ckTypeId?.fullName || '';
    const baseTypeFullName = type?.baseType?.ckTypeId?.fullName || '';

    const getShortName = (fullName: string): string => {
      if (!fullName) {
        return '';
      }
      // Handle both dot notation (System.Entity) and slash notation (System/Entity)
      const parts = fullName.includes('/')
        ? fullName.split('/')
        : fullName.split('.');
      return parts[parts.length - 1] || '';
    };

    const typeName = getShortName(typeFullName);
    const baseTypeName = getShortName(baseTypeFullName);

    // Check if type name ends with TreeNode or is TreeNode
    const isTreeNode = typeName === 'TreeNode' || baseTypeName === 'TreeNode';

    // Also check if full name contains TreeNode (for cases like Basic/TreeNode)
    const containsTreeNode =
      typeFullName.includes('TreeNode') ||
      baseTypeFullName.includes('TreeNode');

    return isTreeNode || containsTreeNode;
  }

  /**
   * Refresh tree data after entity creation.
   * IMPORTANT: We use refreshTree() instead of refreshRuntimeEntities() because
   * refreshRuntimeEntities() only manipulates expanded keys but doesn't force data
   * reload from the data source. This causes stale data to persist in Kendo TreeView
   */
  protected async refreshTreeAfterCreation(parentInfo?: {
    parentCkTypeId?: string;
    parentRtId?: string;
  }): Promise<void> {
    if (parentInfo?.parentCkTypeId && parentInfo?.parentRtId) {
      // Save expanded keys to restore after refresh
      const expandedKeys = this.treeDetail.getExpandedKeys();
      const keysToRestore = [...expandedKeys];

      // Refresh entire tree to clear cache and reload all data
      await this.treeDetail.refreshTree();

      // Wait for next microtask tick to allow Angular change detection and Kendo TreeView rendering.
      // This prevents race conditions without using arbitrary timeouts.
      await Promise.resolve();
      this.treeDetail.setExpandedKeys(keysToRestore);
    } else {
      // If parent info is not available (root-level creation or parent is not a runtime entity),
      // refresh entire tree to ensure new root-level entities are visible
      await this.treeDetail.refreshTree();
    }
  }
}
