import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WindowRef } from '@progress/kendo-angular-dialog';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { GridModule } from '@progress/kendo-angular-grid';
import { IconsModule } from '@progress/kendo-angular-icons';
import { pencilIcon, trashIcon } from '@progress/kendo-svg-icons';
import {
  GetEntitiesByCkTypeDtoGQL,
  RuntimeEntitySelectDataSource,
  RuntimeEntityDialogDataSource,
  RuntimeEntityItem,
  AttributeItem
} from '@meshmakers/octo-services';
import { EntitySelectInputComponent } from '@meshmakers/shared-ui';
import { CkTypeSelectorInputComponent } from '../ck-type-selector-input';
import { AttributeSelectorDialogService } from '../attribute-selector-dialog';
import {
  RuntimeEntityVariableDialogData,
  RuntimeEntityVariableDialogResult,
  RuntimeEntityVariableMapping
} from './runtime-entity-variable-dialog.models';

interface CkTypeSelectorItem {
  fullName: string;
  rtCkTypeId: string;
  baseTypeFullName?: string;
  baseTypeRtCkTypeId?: string;
  isAbstract: boolean;
  isFinal: boolean;
  description?: string;
}

@Component({
  selector: 'mm-runtime-entity-variable-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonsModule,
    InputsModule,
    GridModule,
    IconsModule,
    CkTypeSelectorInputComponent,
    EntitySelectInputComponent
  ],
  template: `
    <div class="dialog-content">
      <div class="form-row">
        <label class="form-label">CK Type</label>
        <mm-ck-type-selector-input
          [placeholder]="'Select CK Type...'"
          [minSearchLength]="2"
          (ckTypeSelected)="onCkTypeSelected($event)"
          (ckTypeCleared)="onCkTypeCleared()">
        </mm-ck-type-selector-input>
      </div>

      <div class="form-row">
        <label class="form-label">Entity</label>
        <mm-entity-select-input
          [dataSource]="entityDataSource()!"
          [dialogDataSource]="entityDialogDataSource()!"
          [placeholder]="'Select Entity...'"
          [disabled]="!selectedCkType()"
          [minSearchLength]="1"
          dialogTitle="Select Entity"
          (entitySelected)="onEntitySelected($event)"
          (entityCleared)="onEntityCleared()">
        </mm-entity-select-input>
      </div>

      <div class="form-row">
        <label class="form-label">Attributes</label>
        <button
          kendoButton
          (click)="openAttributeSelector()"
          [disabled]="!selectedCkType()"
          themeColor="primary"
          fillMode="outline">
          Select Attributes...
        </button>
      </div>

      @if (variableMappings().length > 0) {
        <div class="mappings-grid">
          <div class="grid-header">
            <span class="col-name">Variable Name</span>
            <span class="col-path">Attribute Path</span>
            <span class="col-type">Type</span>
            <span class="col-actions"></span>
          </div>
          @for (mapping of variableMappings(); track mapping.attributePath; let i = $index) {
            <div class="grid-row">
              <div class="col-name">
                <kendo-textbox
                  [value]="mapping.name"
                  (valueChange)="onNameChange(i, $event)"
                  [style.width.%]="100">
                </kendo-textbox>
                @if (getNameError(mapping.name, i); as error) {
                  <span class="error-text">{{ error }}</span>
                }
              </div>
              <div class="col-path">{{ mapping.attributePath }}</div>
              <div class="col-type">{{ mapping.attributeValueType }}</div>
              <div class="col-actions">
                <button
                  kendoButton
                  (click)="removeMapping(i)"
                  [svgIcon]="trashIcon"
                  fillMode="flat"
                  themeColor="error"
                  title="Remove">
                </button>
              </div>
            </div>
          }
        </div>
      }

      <div class="dialog-actions">
        <button kendoButton (click)="onCancel()" fillMode="outline">Cancel</button>
        <button kendoButton (click)="onOk()" themeColor="primary" [disabled]="!isValid()">OK</button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px 20px;
    }

    .form-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .form-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--kendo-color-subtle, #666);
    }

    .mappings-grid {
      border: 1px solid var(--kendo-color-border, #e0e0e0);
      border-radius: 4px;
      background: var(--kendo-color-surface-alt, #fafafa);
    }

    .grid-header {
      display: grid;
      grid-template-columns: 1fr 1fr 100px 40px;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: var(--kendo-color-surface, #f5f5f5);
      border-bottom: 1px solid var(--kendo-color-border, #e0e0e0);
      font-size: 12px;
      font-weight: 600;
      color: var(--kendo-color-subtle, #666);
    }

    .grid-row {
      display: grid;
      grid-template-columns: 1fr 1fr 100px 40px;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      align-items: start;
      border-bottom: 1px solid var(--kendo-color-border, #e0e0e0);

      &:last-child {
        border-bottom: none;
      }
    }

    .col-name {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .col-path, .col-type {
      font-size: 13px;
      padding-top: 6px;
      color: var(--kendo-color-on-app-surface, #424242);
    }

    .col-actions {
      display: flex;
      justify-content: center;
      padding-top: 2px;
    }

    .error-text {
      font-size: 11px;
      color: var(--kendo-color-error, #f44336);
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--kendo-color-border, #e0e0e0);
    }
  `]
})
export class RuntimeEntityVariableDialogComponent {
  private readonly windowRef = inject(WindowRef);
  private readonly getEntitiesByCkTypeGQL = inject(GetEntitiesByCkTypeDtoGQL);
  private readonly attributeSelectorDialogService = inject(AttributeSelectorDialogService);

  protected readonly pencilIcon = pencilIcon;
  protected readonly trashIcon = trashIcon;

  /** Data passed to the dialog (set by service) */
  data: RuntimeEntityVariableDialogData = {};

  // Signals
  readonly selectedCkType = signal<CkTypeSelectorItem | null>(null);
  readonly selectedEntity = signal<RuntimeEntityItem | null>(null);
  readonly variableMappings = signal<RuntimeEntityVariableMapping[]>([]);

  readonly entityDataSource = computed(() => {
    const ckType = this.selectedCkType();
    if (!ckType) return null;
    return new RuntimeEntitySelectDataSource(this.getEntitiesByCkTypeGQL, ckType.rtCkTypeId);
  });

  readonly entityDialogDataSource = computed(() => {
    const ckType = this.selectedCkType();
    if (!ckType) return null;
    return new RuntimeEntityDialogDataSource(this.getEntitiesByCkTypeGQL, ckType.rtCkTypeId);
  });

  private readonly VALID_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

  onCkTypeSelected(ckType: CkTypeSelectorItem): void {
    this.selectedCkType.set(ckType);
    this.selectedEntity.set(null);
    // Don't clear mappings — keep them if user is just switching type
  }

  onCkTypeCleared(): void {
    this.selectedCkType.set(null);
    this.selectedEntity.set(null);
  }

  onEntitySelected(entity: RuntimeEntityItem): void {
    this.selectedEntity.set(entity);
  }

  onEntityCleared(): void {
    this.selectedEntity.set(null);
  }

  async openAttributeSelector(): Promise<void> {
    const ckType = this.selectedCkType();
    if (!ckType) return;

    const existingPaths = this.variableMappings().map(m => m.attributePath);

    const result = await this.attributeSelectorDialogService.openAttributeSelector(
      ckType.rtCkTypeId,
      existingPaths,
      'Select Attributes'
    );

    if (result.confirmed && result.selectedAttributes.length > 0) {
      this.addAttributeMappings(result.selectedAttributes);
    }
  }

  onNameChange(index: number, name: string): void {
    const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '');
    const mappings = [...this.variableMappings()];
    mappings[index] = { ...mappings[index], name: sanitized };
    this.variableMappings.set(mappings);
  }

  removeMapping(index: number): void {
    const mappings = this.variableMappings().filter((_, i) => i !== index);
    this.variableMappings.set(mappings);
  }

  getNameError(name: string, index: number): string | null {
    if (!name) return 'Name required';
    if (!this.VALID_NAME_REGEX.test(name)) return 'Invalid name';
    if (this.isDuplicateName(name, index)) return 'Duplicate';
    return null;
  }

  isValid(): boolean {
    const entity = this.selectedEntity();
    const mappings = this.variableMappings();
    if (!entity || mappings.length === 0) return false;

    return mappings.every((m, i) =>
      m.name &&
      this.VALID_NAME_REGEX.test(m.name) &&
      !this.isDuplicateName(m.name, i)
    );
  }

  onOk(): void {
    const ckType = this.selectedCkType();
    const entity = this.selectedEntity();
    if (!ckType || !entity) return;

    const result: RuntimeEntityVariableDialogResult = {
      entityCkTypeId: ckType.rtCkTypeId,
      entityRtId: entity.rtId,
      entityDisplayName: entity.displayName,
      variables: this.variableMappings()
    };

    this.windowRef.close(result);
  }

  onCancel(): void {
    this.windowRef.close();
  }

  private addAttributeMappings(attributes: AttributeItem[]): void {
    const existingMappings = this.variableMappings();
    const existingPaths = new Set(existingMappings.map(m => m.attributePath));
    const allNames = new Set([
      ...existingMappings.map(m => m.name),
      ...(this.data.existingVariableNames ?? [])
    ]);

    const newMappings: RuntimeEntityVariableMapping[] = [];
    for (const attr of attributes) {
      if (existingPaths.has(attr.attributePath)) continue;

      let name = this.attributePathToVariableName(attr.attributePath);
      let counter = 1;
      while (allNames.has(name)) {
        name = `${this.attributePathToVariableName(attr.attributePath)}${counter}`;
        counter++;
      }
      allNames.add(name);

      newMappings.push({
        name,
        attributePath: attr.attributePath,
        attributeValueType: attr.attributeValueType
      });
    }

    this.variableMappings.set([...existingMappings, ...newMappings]);
  }

  private attributePathToVariableName(attributePath: string): string {
    const parts = attributePath.split('.');
    return parts
      .map((part, index) =>
        index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
      )
      .join('');
  }

  private isDuplicateName(name: string, currentIndex: number): boolean {
    const mappings = this.variableMappings();
    const existingNames = this.data.existingVariableNames ?? [];

    // Check within dialog mappings
    if (mappings.some((m, i) => i !== currentIndex && m.name === name)) return true;
    // Check against existing external variable names
    if (existingNames.includes(name)) return true;

    return false;
  }
}
