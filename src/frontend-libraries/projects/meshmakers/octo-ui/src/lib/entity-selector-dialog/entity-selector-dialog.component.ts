import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  signal,
  ViewChild,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { TreeItemData } from '@meshmakers/shared-services';
import { TreeComponent } from '@meshmakers/shared-ui';
import { RtEntityDto } from '../graphQL/globalTypes';
import { RuntimeBrowserDataSource } from '../runtime-browser/data-sources/runtime-browser-data-source.service';
import { PerspectiveSwitcherComponent } from '../runtime-browser/components/perspective-switcher/perspective-switcher.component';
import { PerspectiveDefinition } from '../runtime-browser/services/tree-navigation-config.service';
import { EntitySelectorDialogData, EntitySelectorDialogResult } from './entity-selector-dialog.models';

@Component({
  selector: 'mm-entity-selector-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TreeComponent,
    PerspectiveSwitcherComponent,
  ],
  providers: [RuntimeBrowserDataSource],
  template: `
    <div class="entity-selector">
      <div class="entity-selector-body">
        <mm-perspective-switcher
          [perspectives]="perspectives()"
          [activeKey]="activePerspectiveKey()"
          (perspectiveChange)="onPerspectiveChange($event)"
        ></mm-perspective-switcher>
        <div class="tree-section">
          <mm-tree-view
            #tree
            [dataSource]="treeDataSource"
            (nodeSelected)="onNodeSelected($event)"
          ></mm-tree-view>
        </div>

        @if (selectedEntity) {
          <div class="selection-preview">
            <div class="preview-row">
              <span class="preview-label">Name:</span>
              <span class="preview-value">{{ selectedEntity.name || '\u2014' }}</span>
            </div>
            <div class="preview-row">
              <span class="preview-label">Type:</span>
              <span class="preview-value monospace">{{ selectedEntity.ckTypeId }}</span>
            </div>
            <div class="preview-row">
              <span class="preview-label">RtId:</span>
              <span class="preview-value monospace">{{ selectedEntity.rtId }}</span>
            </div>
          </div>
        } @else {
          <div class="selection-hint">
            Select an entity from the tree above.
          </div>
        }
      </div>

      <div class="dialog-actions">
        <button kendoButton (click)="onCancel()">Cancel</button>
        <button kendoButton themeColor="primary" [disabled]="!selectedEntity" (click)="onConfirm()">
          Select
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    .entity-selector {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
      box-sizing: border-box;
    }

    /* Scrollable body \u2014 tree + selection preview live here so the action row
       always stays pinned to the bottom of the dialog, even on small heights.
       This matches the mapping-edit-dialog's body/actions split (the previous
       Kendo Dialog layout sometimes cut the buttons off when the dialog body
       didn't get full height). */
    .entity-selector-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .tree-section {
      flex: 1;
      min-height: 0;
      overflow: auto;
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 4px;
      background: var(--kendo-color-surface, #ffffff);
    }

    .selection-preview {
      padding: 10px 12px;
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 4px;
      background: var(--kendo-color-surface-alt, #f8f9fa);
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex-shrink: 0;
    }

    .preview-row {
      display: flex;
      gap: 8px;

      .preview-label {
        font-weight: 600;
        min-width: 45px;
        color: var(--kendo-color-subtle, #6c757d);
        font-size: 0.85rem;
      }

      .preview-value {
        font-size: 0.85rem;
      }

      .monospace {
        font-family: monospace;
      }
    }

    .selection-hint {
      text-align: center;
      padding: 8px;
      color: var(--kendo-color-subtle, #6c757d);
      font-size: 0.85rem;
      flex-shrink: 0;
    }

    .dialog-actions {
      flex: 0 0 auto;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 10px 14px;
      border-top: 1px solid var(--kendo-color-border, #dee2e6);
      background: var(--kendo-color-surface, transparent);
    }
  `],
})
export class EntitySelectorDialogComponent implements OnInit {
  private readonly windowRef = inject(WindowRef);
  readonly treeDataSource = inject(RuntimeBrowserDataSource);

  @ViewChild('tree') private readonly tree?: TreeComponent;

  /** Selectable tree perspectives (AB#4263); switcher hides itself when <= 1. */
  protected readonly perspectives = signal<PerspectiveDefinition[]>([]);
  protected readonly activePerspectiveKey = signal<string>(
    this.treeDataSource.getActivePerspectiveKey(),
  );

  data: EntitySelectorDialogData = {};
  selectedEntity: { rtId: string; ckTypeId: string; name?: string } | null = null;

  async ngOnInit(): Promise<void> {
    try {
      this.perspectives.set(await this.treeDataSource.getPerspectives());
      this.activePerspectiveKey.set(
        this.treeDataSource.getActivePerspectiveKey(),
      );
    } catch (error) {
      console.error('Error loading perspectives', error);
    }
  }

  /** Switches the active perspective and reloads the picker tree. */
  async onPerspectiveChange(key: string): Promise<void> {
    this.treeDataSource.setActivePerspective(key);
    this.activePerspectiveKey.set(key);
    this.selectedEntity = null;
    await this.tree?.refreshTree();
  }

  onNodeSelected(node: TreeItemData): void {
    const item = node.item;
    if (item && typeof item === 'object' && 'rtId' in item && 'ckTypeId' in item) {
      const entity = item as RtEntityDto;
      this.selectedEntity = {
        rtId: entity.rtId,
        ckTypeId: entity.ckTypeId!,
        // Engine-computed display name (AB#4813); the backend guarantees a value
        name: entity.rtDisplayName,
      };
    } else {
      this.selectedEntity = null;
    }
  }

  onConfirm(): void {
    if (this.selectedEntity) {
      const result: EntitySelectorDialogResult = {
        rtId: this.selectedEntity.rtId,
        ckTypeId: this.selectedEntity.ckTypeId,
        name: this.selectedEntity.name,
      };
      this.windowRef.close(result);
    }
  }

  onCancel(): void {
    this.windowRef.close();
  }
}
