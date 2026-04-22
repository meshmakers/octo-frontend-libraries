import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { DialogRef } from '@progress/kendo-angular-dialog';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { TreeItemData } from '@meshmakers/shared-services';
import { TreeComponent } from '@meshmakers/shared-ui';
import { RtEntityDto } from '../graphQL/globalTypes';
import { RuntimeBrowserDataSource } from '../runtime-browser/data-sources/runtime-browser-data-source.service';
import { EntitySelectorDialogData, EntitySelectorDialogResult } from './entity-selector-dialog.models';

@Component({
  selector: 'mm-entity-selector-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TreeComponent,
  ],
  providers: [RuntimeBrowserDataSource],
  template: `
    <div class="entity-selector">
      <div class="tree-section">
        <mm-tree-view
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
      }

      @if (!selectedEntity) {
        <div class="selection-hint">
          Select an entity from the tree above.
        </div>
      }

      <div class="dialog-actions">
        <button kendoButton themeColor="primary" [disabled]="!selectedEntity" (click)="onConfirm()">
          Select
        </button>
        <button kendoButton (click)="onCancel()">
          Cancel
        </button>
      </div>
    </div>
  `,
  styles: [`
    .entity-selector {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 12px;
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
    }

    .dialog-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
  `],
})
export class EntitySelectorDialogComponent {
  private readonly dialogRef = inject(DialogRef);
  readonly treeDataSource = inject(RuntimeBrowserDataSource);

  data: EntitySelectorDialogData = {};
  selectedEntity: { rtId: string; ckTypeId: string; name?: string } | null = null;

  onNodeSelected(node: TreeItemData): void {
    const item = node.item;
    if (item && typeof item === 'object' && 'rtId' in item && 'ckTypeId' in item) {
      const entity = item as RtEntityDto;
      const nameAttr = entity.attributes?.items?.filter(Boolean).find(
        (a) => a?.attributeName === 'name' || a?.attributeName === 'displayName',
      );
      this.selectedEntity = {
        rtId: entity.rtId,
        ckTypeId: entity.ckTypeId!,
        name: (nameAttr?.value as string) ?? entity.rtWellKnownName ?? undefined,
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
      this.dialogRef.close(result);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
