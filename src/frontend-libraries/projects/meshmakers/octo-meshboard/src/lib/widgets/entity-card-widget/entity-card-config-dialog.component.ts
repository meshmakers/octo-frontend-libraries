import { Component, Input, Output, EventEmitter, OnInit, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogsModule } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { CkTypeSelectorInputComponent } from '@meshmakers/octo-ui';
import { CkTypeSelectorItem, CkTypeSelectorService } from '@meshmakers/octo-services';
import { EntitySelectInputComponent } from '@meshmakers/shared-ui';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { firstValueFrom } from 'rxjs';
import {
  RuntimeEntityItem,
  RuntimeEntitySelectDataSource,
  RuntimeEntityDialogDataSource
} from '../../utils/runtime-entity-data-sources';

/**
 * Configuration result from the dialog
 */
export interface EntityCardConfigResult {
  ckTypeId: string;
  rtId: string;
}

/**
 * Configuration dialog for EntityCard and EntityAssociations widgets.
 * Allows selecting a Runtime Entities type and a specific entity.
 */
@Component({
  selector: 'mm-entity-card-config-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogsModule,
    ButtonsModule,
    InputsModule,
    CkTypeSelectorInputComponent,
    EntitySelectInputComponent
  ],
  template: `
    <kendo-dialog
      title="Entity Configuration"
      [minWidth]="500"
      [width]="600"
      (close)="onCancel()">

      <div class="config-form" [class.loading]="isLoadingInitial">
        @if (isLoadingInitial) {
          <div class="loading-indicator">Loading...</div>
        }
        <div class="form-field">
          <label>Runtime Entities</label>
          <mm-ck-type-selector-input
            #ckTypeSelector
            placeholder="Select Runtime Entities..."
            [minSearchLength]="2"
            dialogTitle="Select Runtime Entities"
            [ngModel]="selectedCkType"
            (ckTypeSelected)="onCkTypeSelected($event)"
            (ckTypeCleared)="onCkTypeCleared()">
          </mm-ck-type-selector-input>
          <p class="field-hint">Select the type of entities to choose from.</p>
        </div>

        <div class="form-field" [class.disabled]="!selectedCkType">
          <label>Entity</label>
          @if (selectedCkType && entityDataSource) {
            <mm-entity-select-input
              #entitySelector
              [dataSource]="entityDataSource"
              [dialogDataSource]="entityDialogDataSource"
              placeholder="Search for an entity..."
              dialogTitle="Select Entity"
              [minSearchLength]="1"
              [ngModel]="selectedEntity"
              (entitySelected)="onEntitySelected($event)"
              (entityCleared)="onEntityCleared()">
            </mm-entity-select-input>
          } @else {
            <kendo-textbox
              [disabled]="true"
              placeholder="First select Runtime Entities...">
            </kendo-textbox>
          }
          <p class="field-hint">Select the specific entity to display in this widget.</p>
        </div>

        @if (selectedEntity) {
          <div class="selection-preview">
            <h4>Selected Entity</h4>
            <div class="preview-content">
              <p><strong>Type:</strong> {{ selectedCkType?.rtCkTypeId }}</p>
              <p><strong>RT-ID:</strong> {{ selectedEntity.rtId }}</p>
              @if (selectedEntity.rtWellKnownName) {
                <p><strong>Name:</strong> {{ selectedEntity.rtWellKnownName }}</p>
              }
            </div>
          </div>
        }
      </div>

      <kendo-dialog-actions>
        <button kendoButton fillMode="flat" (click)="onCancel()">Cancel</button>
        <button
          kendoButton
          themeColor="primary"
          [disabled]="!isValid"
          (click)="onSave()">
          Save
        </button>
      </kendo-dialog-actions>
    </kendo-dialog>
  `,
  styles: [`
    .config-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 16px 0;
      position: relative;
    }

    .config-form.loading {
      opacity: 0.7;
      pointer-events: none;
    }

    .loading-indicator {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      text-align: center;
      padding: 8px;
      color: var(--kendo-color-primary, #0d6efd);
      font-style: italic;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-field.disabled {
      opacity: 0.6;
    }

    .form-field label {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--kendo-color-on-app-surface, #212529);
    }

    .field-hint {
      margin: 0;
      font-size: 0.8rem;
      color: var(--kendo-color-subtle, #6c757d);
    }

    .selection-preview {
      padding: 12px;
      background: var(--kendo-color-surface-alt, #f8f9fa);
      border: 1px solid var(--kendo-color-border, #dee2e6);
      border-radius: 4px;
    }

    .selection-preview h4 {
      margin: 0 0 8px 0;
      font-size: 0.9rem;
      color: var(--kendo-color-primary, #0d6efd);
    }

    .preview-content p {
      margin: 4px 0;
      font-size: 0.85rem;
    }
  `]
})
export class EntityCardConfigDialogComponent implements OnInit {
  private readonly getEntitiesByCkTypeGQL = inject(GetEntitiesByCkTypeDtoGQL);
  private readonly ckTypeSelectorService = inject(CkTypeSelectorService);

  @ViewChild('ckTypeSelector') ckTypeSelectorInput?: CkTypeSelectorInputComponent;
  @ViewChild('entitySelector') entitySelectorInput?: EntitySelectInputComponent;

  @Input() initialCkTypeId?: string;
  @Input() initialRtId?: string;

  @Output() save = new EventEmitter<EntityCardConfigResult>();
  @Output() cancelled = new EventEmitter<void>();

  selectedCkType: CkTypeSelectorItem | null = null;
  selectedEntity: RuntimeEntityItem | null = null;
  entityDataSource?: RuntimeEntitySelectDataSource;
  entityDialogDataSource?: RuntimeEntityDialogDataSource;
  isLoadingInitial = false;

  get isValid(): boolean {
    return this.selectedCkType !== null && this.selectedEntity !== null;
  }

  async ngOnInit(): Promise<void> {
    if (this.initialCkTypeId) {
      await this.loadInitialValues();
    }
  }

  private async loadInitialValues(): Promise<void> {
    if (!this.initialCkTypeId) {
      return;
    }

    this.isLoadingInitial = true;

    try {
      // Use the direct lookup by rtCkTypeId
      const ckType = await firstValueFrom(
        this.ckTypeSelectorService.getCkTypeByRtCkTypeId(this.initialCkTypeId)
      );

      if (ckType) {
        // Set the CK type (this also creates the data sources)
        this.onCkTypeSelected(ckType);

        // If we also have an initial rtId, load the entity
        if (this.initialRtId && this.entityDataSource) {
          await this.loadInitialEntity();
        }
      } else {
        console.warn('Runtime Entities type not found:', this.initialCkTypeId);
      }
    } catch (error) {
      console.error('Error loading initial values:', error);
    } finally {
      this.isLoadingInitial = false;
    }
  }

  private async loadInitialEntity(): Promise<void> {
    if (!this.initialRtId || !this.initialCkTypeId){
      return;
    }

    try {
      // Fetch the entity by rtId
      const result = await firstValueFrom(
        this.getEntitiesByCkTypeGQL.fetch({
          variables: {
            ckTypeId: this.initialCkTypeId,
            rtId : this.initialRtId
          }
        })
      );

      const items = result.data?.runtime?.runtimeEntities?.items ?? [];
      const entity = items
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .find(item => item.rtId === this.initialRtId);

      if (entity) {
        this.selectedEntity = {
          rtId: entity.rtId,
          ckTypeId: entity.ckTypeId,
          rtWellKnownName: entity.rtWellKnownName ?? undefined,
          displayName: entity.rtWellKnownName || entity.rtId
        };
      }
    } catch (error) {
      console.error('Error loading initial entity:', error);
    }
  }

  onCkTypeSelected(ckType: CkTypeSelectorItem): void {
    this.selectedCkType = ckType;
    this.selectedEntity = null; // Reset entity when type changes

    // Create new data sources for the selected type
    this.entityDataSource = new RuntimeEntitySelectDataSource(
      this.getEntitiesByCkTypeGQL,
      ckType.rtCkTypeId
    );
    this.entityDialogDataSource = new RuntimeEntityDialogDataSource(
      this.getEntitiesByCkTypeGQL,
      ckType.rtCkTypeId
    );
  }

  onCkTypeCleared(): void {
    this.selectedCkType = null;
    this.selectedEntity = null;
    this.entityDataSource = undefined;
    this.entityDialogDataSource = undefined;
  }

  onEntitySelected(entity: RuntimeEntityItem): void {
    this.selectedEntity = entity;
  }

  onEntityCleared(): void {
    this.selectedEntity = null;
  }

  onSave(): void {
    if (this.selectedCkType && this.selectedEntity) {
      this.save.emit({
        ckTypeId: this.selectedCkType.rtCkTypeId,
        rtId: this.selectedEntity.rtId
      });
    }
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
