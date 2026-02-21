import { AsyncPipe } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { SVGIconComponent } from '@progress/kendo-angular-icons';
import {
  DragAndDropDirective,
  DropPosition,
  ExpandDirective,
  NodeClickEvent,
  NodeTemplateDirective,
  TreeItem,
  TreeItemDropEvent,
  TreeViewComponent
} from '@progress/kendo-angular-treeview';
import { BehaviorSubject, from, Observable } from 'rxjs';
import { HierarchyDataSource } from '../data-sources/hierarchy-data-source';
import { NodeDroppedEvent } from '../models/node-dropped-event';

@Component({
  selector: 'mm-tree-view',
  imports: [
    ExpandDirective,
    TreeViewComponent,
    AsyncPipe,
    NodeTemplateDirective,
    SVGIconComponent,
    DragAndDropDirective
  ],
  templateUrl: './tree.component.html',
  styleUrl: './tree.component.scss'
})
export class TreeComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly cdRef = inject(ChangeDetectorRef);

  private _timeoutCache: ReturnType<typeof setTimeout> | undefined;

  private readonly _rootNodes: BehaviorSubject<any[]> = new BehaviorSubject<any[]>([]);
  private _isViewInitialized = false;
  protected expandedKeys: any[] = [];

  @ViewChild(TreeViewComponent, { static: false })
  protected treeView!: TreeViewComponent;

  public async ngOnInit(): Promise<void> {
    if (this.dataSource) {
      this._rootNodes.next( await this.dataSource.fetchRootNodes());
    }
  }

  public ngAfterViewInit(): void {
    this._isViewInitialized = true;
    console.debug('🌳 TreeComponent: View initialized, treeView available:', !!this.treeView);
  }

  /**
   * Check if the TreeComponent is fully initialized and ready for operations
   */
  public get isReady(): boolean {
    return this._isViewInitialized && !!this.treeView;
  }

  @Input()
  public dataSource: HierarchyDataSource | null = null;

  @Output()nodeSelected  =  new EventEmitter<any>()
  @Output()nodeClick  =  new EventEmitter<any>()
  @Output()nodeDoubleClick  =  new EventEmitter<any>()
  @Output()nodeDrop  =  new EventEmitter<NodeDroppedEvent<any>>()
  @Output()expand  =  new EventEmitter<any>()
  @Output()collapse  =  new EventEmitter<any>()

  protected get rootNodes(): Observable<any[]> {
    return this._rootNodes;
  }

  protected hasChildren = (item: any) => this.dataSource?.hasChildren(item) ?? false;
  protected isExpanded = (item: any, _index: string) => this.expandedKeys.includes(item.id);
  protected fetchChildren = (item: any) : Observable<any[]> => from(this.dataSource?.fetchChildren(item) ?? []);

  protected onNodeSelect(treeItem: TreeItem) {

    this.nodeSelected.emit(treeItem.dataItem);
  }

  protected onNodeClick(event: NodeClickEvent) {

    this.nodeClick.emit(event.item?.dataItem);
  }

  protected onNodeDoubleClick(event: NodeClickEvent) {

    this.nodeDoubleClick.emit(event.item?.dataItem);
  }

  protected onExpand(event: any) {
    console.debug('🌳 Node expanded:', event.dataItem?.text || event.dataItem);
    this.expand.emit(event.dataItem);
  }

  protected onCollapse(event: any) {
    console.debug('🌳 Node collapsed:', event.dataItem?.text || event.dataItem);
    this.collapse.emit(event.dataItem);
  }

  public async refreshTree(): Promise<void> {
    if (this.dataSource) {
      console.debug('🔄 Refreshing tree root nodes');
      const rootNodes = await this.dataSource.fetchRootNodes();
      this._rootNodes.next(rootNodes);
      console.debug('✅ Tree refreshed with', rootNodes.length, 'root nodes');
    }
  }

  public async onNodeDrop(event: TreeItemDropEvent): Promise<void> {
    console.debug('✅ Dropping item:', event);

    if (!event.isValid) {
      console.debug('Drop event is not valid in drag and drop end event', event);
      return;
    }

    const srcItem = event.sourceItem.item.dataItem.item
    const srcParent = event.sourceItem.parent?.item.dataItem.item

    const itemsToRefresh = [];

    // If you drop item directly onto existing item, make source item its child. Otherwise set parent as target assoc.
    let dstItem;
    if (event.dropPosition === DropPosition.Over) {
      dstItem = event.destinationItem.item.dataItem.item;

      const dstRefreshItem = event.destinationItem.parent?.item.dataItem.item;
      if (dstRefreshItem) {
        itemsToRefresh.push(dstRefreshItem);
      }
    } else {
      dstItem = event.destinationItem.parent?.item.dataItem.item;
    }

    itemsToRefresh.unshift(srcItem);
    if (srcParent) {
      itemsToRefresh.unshift(srcParent);
    }
    if (dstItem) {
      itemsToRefresh.unshift(dstItem);
    }

    const parent = event.sourceItem.parent;
    const siblings = parent?.children ?? [];
    const hasNoOtherChildren = siblings.every(child => child.dataItem?.item?.rtId === srcItem.rtId);
    if (hasNoOtherChildren) {
      const grandparentItem = parent?.parent?.item?.dataItem?.item;
      if (grandparentItem) {
        itemsToRefresh.push(grandparentItem);
      }
    }

    this.nodeDrop.emit({

      // source node
      sourceItem: {

        rtId: srcItem.rtId,

        ckTypeId: srcItem.ckTypeId,

        dataItem: event.sourceItem.item.dataItem,
      },

      // parent of source node, if exists
      sourceParent: srcParent ? {

        rtId: srcParent.rtId,

        ckTypeId: srcParent.ckTypeId
      } : undefined,

      // destination item, either on same hierarchy level or one level deeper
      destinationItem: dstItem ? {

        rtId: dstItem.rtId,

        ckTypeId: dstItem.ckTypeId,
      } : undefined,

      // items to be refreshed
      refreshItems: itemsToRefresh
    })
  }

  /**
   * Refreshes given runtime entity by reloading the data of the children.
   */
  public async refreshRuntimeEntities(nodes: { rtId: string, ckTypeId: string, isRoot: boolean }[]): Promise<void> {
    const keysToRestore: string[] = [];
    const keysToRemove = new Set<string>();

    nodes.forEach(({ ckTypeId, rtId, isRoot }) => {
      const keyId = isRoot ? `${ckTypeId}@${rtId}` : rtId;
      const hasKeyId = this.expandedKeys.includes(keyId);

      if (hasKeyId) {
        keysToRestore.push(keyId);
        keysToRemove.add(keyId);
      } else {
        console.debug(`Node ${keyId} not refreshed: not currently expanded.`);
      }
    });

    if (keysToRestore.length === 0) {
      return;
    }

    this.expandedKeys = this.expandedKeys.filter(key => !keysToRemove.has(key));

    return new Promise((res) => {
      this._clearTimeouts();

      this._timeoutCache = setTimeout(() => {
        this.expandedKeys = [...this.expandedKeys, ...keysToRestore];
        this.cdRef.markForCheck();
        res();
      }, 0);
    });
  }

  public getExpandedKeys(): any[] {
    return this.expandedKeys;
  }

  public collapseAll(): void {
    this.expandedKeys = [];
  }

  public setExpandedKeys(keys: any[]): void {
    this.expandedKeys = keys;
  }

  private _clearTimeouts() {
    if (this._timeoutCache) {
      clearTimeout(this._timeoutCache);
    }
  }

  public ngOnDestroy(): void {
    this._clearTimeouts();
  }
}
