import { Component, Input, OnInit, inject, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
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
import { LoadingOverlayComponent } from '../../components/loading-overlay/loading-overlay.component';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { EntitySelectorConfig } from '../../models/meshboard.models';

/** How the entity card resolves which entity to display. */
export type EntityCardBindingMode = 'fixed' | 'selector' | 'variable';

/**
 * Configuration result from the dialog.
 *
 * - `fixed` mode  → `ckTypeId`/`rtId` hold a concrete type + entity.
 * - `selector` mode → `entitySelectorId` names a board-level entity selector;
 *   `ckTypeId`/`rtId` are empty (resolved live from the selection).
 * - `variable` mode → `ckTypeId`/`rtId` hold MeshBoard variables (e.g.
 *   `$mp_rtCkTypeId` / `$mp_rtId`) resolved at render time.
 */
export interface EntityCardConfigResult {
  ckTypeId: string;
  rtId: string;
  entitySelectorId?: string;
  hideEmptyAttributes: boolean;
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
    ButtonsModule,
    InputsModule,
    DropDownsModule,
    CkTypeSelectorInputComponent,
    EntitySelectInputComponent,
    LoadingOverlayComponent
  ],
  template: `
    <div class="config-container">

      <div class="config-form" [class.loading]="isLoadingInitial">
        <mm-loading-overlay [loading]="isLoadingInitial" />

        <div class="form-field">
          <label>Entity source</label>
          <ul class="k-radio-list">
            <li class="k-radio-item">
              <input type="radio" kendoRadioButton name="bindingMode" value="fixed"
                [(ngModel)]="bindingMode" />
              <span class="radio-label">Fixed entity</span>
            </li>
            <li class="k-radio-item">
              <input type="radio" kendoRadioButton name="bindingMode" value="selector"
                [(ngModel)]="bindingMode" [disabled]="availableSelectors.length === 0" />
              <span class="radio-label">Entity selector{{ availableSelectors.length === 0 ? ' (none configured)' : '' }}</span>
            </li>
            <li class="k-radio-item">
              <input type="radio" kendoRadioButton name="bindingMode" value="variable"
                [(ngModel)]="bindingMode" />
              <span class="radio-label">Variable</span>
            </li>
          </ul>
          <p class="field-hint">
            Choose a fixed entity, follow a board-level entity selector, or bind the
            type and rtId to MeshBoard variables (e.g. <code>$mp_rtCkTypeId</code> / <code>$mp_rtId</code>).
          </p>
        </div>

        @if (bindingMode === 'fixed') {
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
        }

        @if (bindingMode === 'selector') {
          <div class="form-field">
            <label>Bind to entity selector</label>
            <kendo-dropdownlist
              [data]="availableSelectors"
              textField="label"
              valueField="id"
              [valuePrimitive]="true"
              [defaultItem]="{ id: '', label: '— Select —' }"
              [(ngModel)]="entitySelectorId">
            </kendo-dropdownlist>
            <p class="field-hint">
              The card follows the asset picked in this selector at board level —
              its rtId and CK type are resolved from the current selection.
            </p>
          </div>
        }

        @if (bindingMode === 'variable') {
          <div class="form-field">
            <label>CK Type variable</label>
            <kendo-textbox [(ngModel)]="variableCkTypeId" placeholder="$mp_rtCkTypeId"></kendo-textbox>
            <p class="field-hint">CK type id, or a variable like <code>$mp_rtCkTypeId</code>.</p>
          </div>
          <div class="form-field">
            <label>rtId variable</label>
            <kendo-textbox [(ngModel)]="variableRtId" placeholder="$mp_rtId"></kendo-textbox>
            <p class="field-hint">Runtime id, or a variable like <code>$mp_rtId</code>.</p>
          </div>
        }

        <div class="form-field">
          <label class="checkbox-row">
            <input
              type="checkbox"
              kendoCheckBox
              [(ngModel)]="hideEmptyAttributes" />
            <span>Hide empty attributes</span>
          </label>
          <p class="field-hint">When enabled, attributes without a value (null, empty string, empty array/object) are not shown in the card.</p>
        </div>
      </div>

      <div class="action-bar mm-dialog-actions">
        <button kendoButton fillMode="flat" (click)="onCancel()">Cancel</button>
        <button
          kendoButton
          themeColor="primary"
          [disabled]="!isValid"
          (click)="onSave()">
          Save
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .config-container {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .config-form {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 16px;
      position: relative;
    }

    .config-form.loading {
      pointer-events: none;
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

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--kendo-color-on-app-surface, #212529);
    }

    .checkbox-row input {
      margin: 0;
    }

    .k-radio-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .radio-label {
      margin-left: 8px;
      font-size: 0.9rem;
    }

    .field-hint code {
      font-size: 0.78rem;
    }

    .action-bar {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 8px 16px;
      border-top: 1px solid var(--kendo-color-border, #dee2e6);
    }
  `]
})
export class EntityCardConfigDialogComponent implements OnInit {
  private readonly getEntitiesByCkTypeGQL = inject(GetEntitiesByCkTypeDtoGQL);
  private readonly ckTypeSelectorService = inject(CkTypeSelectorService);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly windowRef = inject(WindowRef);

  @ViewChild('ckTypeSelector') ckTypeSelectorInput?: CkTypeSelectorInputComponent;
  @ViewChild('entitySelector') entitySelectorInput?: EntitySelectInputComponent;

  @Input() initialCkTypeId?: string;
  @Input() initialRtId?: string;
  @Input() initialEntitySelectorId?: string;
  @Input() initialHideEmptyAttributes = false;

  bindingMode: EntityCardBindingMode = 'fixed';
  selectedCkType: CkTypeSelectorItem | null = null;
  selectedEntity: RuntimeEntityItem | null = null;
  entityDataSource?: RuntimeEntitySelectDataSource;
  entityDialogDataSource?: RuntimeEntityDialogDataSource;
  isLoadingInitial = false;
  hideEmptyAttributes = false;

  entitySelectorId = '';
  variableCkTypeId = '';
  variableRtId = '';

  get availableSelectors(): EntitySelectorConfig[] {
    return this.stateService.getEntitySelectors();
  }

  get isValid(): boolean {
    switch (this.bindingMode) {
      case 'selector':
        return !!this.entitySelectorId;
      case 'variable':
        return this.variableRtId.trim().length > 0 && this.variableCkTypeId.trim().length > 0;
      default:
        return this.selectedCkType !== null && this.selectedEntity !== null;
    }
  }

  async ngOnInit(): Promise<void> {
    this.hideEmptyAttributes = this.initialHideEmptyAttributes;

    // Restore the binding mode from the persisted config.
    if (this.initialEntitySelectorId) {
      this.bindingMode = 'selector';
      this.entitySelectorId = this.initialEntitySelectorId;
      return;
    }
    if (this.containsVariable(this.initialCkTypeId) || this.containsVariable(this.initialRtId)) {
      this.bindingMode = 'variable';
      this.variableCkTypeId = this.initialCkTypeId ?? '';
      this.variableRtId = this.initialRtId ?? '';
      return;
    }
    this.bindingMode = 'fixed';
    if (this.initialCkTypeId) {
      await this.loadInitialValues();
    }
  }

  private containsVariable(value?: string): boolean {
    return !!value && value.includes('$');
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
    if (!this.isValid) {
      return;
    }

    let result: EntityCardConfigResult;
    if (this.bindingMode === 'selector') {
      result = {
        ckTypeId: '',
        rtId: '',
        entitySelectorId: this.entitySelectorId,
        hideEmptyAttributes: this.hideEmptyAttributes
      };
    } else if (this.bindingMode === 'variable') {
      result = {
        ckTypeId: this.variableCkTypeId.trim(),
        rtId: this.variableRtId.trim(),
        hideEmptyAttributes: this.hideEmptyAttributes
      };
    } else {
      result = {
        ckTypeId: this.selectedCkType!.rtCkTypeId,
        rtId: this.selectedEntity!.rtId,
        hideEmptyAttributes: this.hideEmptyAttributes
      };
    }

    this.windowRef.close(result);
  }

  onCancel(): void {
    this.windowRef.close();
  }
}
