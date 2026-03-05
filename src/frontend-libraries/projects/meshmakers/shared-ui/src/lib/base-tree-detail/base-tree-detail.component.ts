import { NgClass } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CommandBaseService, CommandItem, CommandSettingsService, TreeItemData, TreeItemDataTyped } from '@meshmakers/shared-services';
import { ButtonComponent } from '@progress/kendo-angular-buttons';
import { SeparatorComponent } from '@progress/kendo-angular-inputs';
import { SplitterComponent, SplitterPaneComponent } from '@progress/kendo-angular-layout';
import { HierarchyDataSource } from '../data-sources/hierarchy-data-source';
import { TreeComponent } from '../tree/tree.component';
import { NodeDroppedEvent } from '../models/node-dropped-event';

@Component({
  selector: 'mm-base-tree-detail',
  imports: [
    SplitterComponent,
    SplitterPaneComponent,
    TreeComponent,
    ButtonComponent,
    SeparatorComponent,
    NgClass
  ],
  template: `
    <div class="base-tree-detail-container">
      <!-- Toolbar -->
      @if (hasToolbarActions) {
      <div class="toolbar">
        <div class="toolbar-left">
          @for (commandItem of leftToolbarActions; track commandItem.id) {
            @if (commandItem) {
              @switch (commandItem.type) {
                @case ('link') {
                  @if (commandItem.svgIcon) {
                    <button kendoButton [svgIcon]="commandItem.svgIcon" [title]="commandItem.text"
                            [disabled]="getIsDisabled(commandItem)"
                            (click)="onToolbarCommand(commandItem)">{{ commandItem.text }}
                    </button>
                  } @else {
                    <button kendoButton [title]="commandItem.text"
                            [disabled]="getIsDisabled(commandItem)"
                            (click)="onToolbarCommand(commandItem)">{{ commandItem.text }}
                    </button>
                  }
                }
                @case ('separator'){
                  <kendo-separator></kendo-separator>
                }
              }
            }
          }
        </div>

        <div class="toolbar-spacer"></div>

        <div class="toolbar-right">
          @for (commandItem of rightToolbarActions; track commandItem.id) {
            @if (commandItem) {
              @switch (commandItem.type) {
                @case ('link') {
                  @if (commandItem.svgIcon) {
                    <button kendoButton [svgIcon]="commandItem.svgIcon" [title]="commandItem.text"
                            [disabled]="getIsDisabled(commandItem)"
                            (click)="onToolbarCommand(commandItem)">{{ commandItem.text }}
                    </button>
                  } @else {
                    <button kendoButton [title]="commandItem.text"
                            [disabled]="getIsDisabled(commandItem)"
                            (click)="onToolbarCommand(commandItem)">{{ commandItem.text }}
                    </button>
                  }
                }
                @case ('separator'){
                  <kendo-separator></kendo-separator>
                }
              }
            }
          }
        </div>
      </div>
      }

      <!-- Splitter with tree and detail -->
      <kendo-splitter class="octo-full" orientation="horizontal" [ngClass]="{ disabled: isContentDisabled }">
        <kendo-splitter-pane [size]="leftPaneSize" class="tree-pane">
          <mm-tree-view
            #treeComponent
            [dataSource]="treeDataSource"
            (nodeClick)="onNodeClick($event)"
            (nodeDrop)="onNodeDrop($event)">
          </mm-tree-view>
        </kendo-splitter-pane>
        <kendo-splitter-pane class="detail-pane">
          <ng-content select="[slot=detail-panel]"></ng-content>
        </kendo-splitter-pane>
      </kendo-splitter>
    </div>
  `,
  styleUrls: ['./base-tree-detail.component.scss']
})
export class BaseTreeDetailComponent<T = unknown> extends CommandBaseService {
  @Input() treeDataSource!: HierarchyDataSource;
  @Input() leftPaneSize = '25%';
  @Input() leftToolbarActions: CommandItem[] = [];
  @Input() rightToolbarActions: CommandItem[] = [];
  @Output() nodeSelected = new EventEmitter<TreeItemDataTyped<T>>();
  @Output() nodeDropped = new EventEmitter<NodeDroppedEvent<T>>();

  @ViewChild('treeComponent', { static: false })
  treeComponent!: TreeComponent;

  protected isContentDisabled = false;
  protected selectedNode: TreeItemDataTyped<T> | null = null;

  constructor() {
    const commandSettingsService = inject(CommandSettingsService);
    const router = inject(Router);
    super(commandSettingsService, router);
  }

  protected get hasToolbarActions(): boolean {
    return this.leftToolbarActions.length > 0 || this.rightToolbarActions.length > 0;
  }

  protected onNodeClick(treeItem: TreeItemData): void {
    this.selectedNode = treeItem as TreeItemDataTyped<T>;
    this.nodeSelected.emit(treeItem as TreeItemDataTyped<T>);
  }

  protected onNodeDrop(event: NodeDroppedEvent<unknown>): void {
    this.nodeDropped.emit(event as NodeDroppedEvent<T>);
  }

  protected async onToolbarCommand(commandItem: CommandItem): Promise<void> {
    // Pass the selected tree node as context data
    await this.navigateAsync(commandItem, this.selectedNode?.item || null);
  }

  protected getIsDisabled(commandItem: CommandItem): boolean {
    // Check if disabled property exists and is true
    if (typeof commandItem.isDisabled === 'function') {
      return commandItem.isDisabled();
    }
    return commandItem.isDisabled ?? false;
  }

  /**
   * Wait for the tree component to be ready
   */
  public async waitForTreeReady(): Promise<boolean> {
    const maxAttempts = 50; // 5 seconds max
    let attempts = 0;

    while (attempts < maxAttempts) {
      if (this.treeComponent && this.treeComponent.isReady) {
        console.debug('✅ BaseTreeDetailComponent: TreeComponent is ready after', attempts * 100, 'ms');
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    console.warn('⚠️ BaseTreeDetailComponent: TreeComponent not ready after 5 seconds');
    return false;
  }

  /**
   * Refresh the tree by reloading root nodes
   */
  public async refreshTree(): Promise<void> {
    if (this.treeComponent) {
      await this.treeComponent.refreshTree();
    }
  }

  /**
   * Sets the state of Tree and Details panes.
   *
   * @description Panes are frozen (unclickable, unselectable) when disabled.
   */
  public setEnabledState(enabled: boolean): void {
    this.isContentDisabled = !enabled;
  }

  /**
   * Refreshes given runtime entity on a tree.
   */
  public async refreshRuntimeEntities(nodes: {
    ckTypeId: string,
    rtId: string,
    isRoot: boolean
  }[]): Promise<void> {
    await this.treeComponent.refreshRuntimeEntities(nodes);
  }

  public getExpandedKeys(): string[] {
    return this.treeComponent.getExpandedKeys();
  }

  public collapseAll(): void {
    this.treeComponent.collapseAll();
  }

  public setExpandedKeys(keys: string[]): void {
    this.treeComponent.setExpandedKeys(keys);
  }
}
