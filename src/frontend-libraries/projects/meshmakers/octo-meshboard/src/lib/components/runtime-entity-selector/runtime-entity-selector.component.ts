import { Component, Input, Output, EventEmitter, inject, ViewChild, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CkTypeSelectorInputComponent } from '@meshmakers/octo-ui';
import { CkTypeSelectorItem, CkTypeSelectorService } from '@meshmakers/octo-services';
import { EntitySelectInputComponent } from '@meshmakers/shared-ui';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import {
  RuntimeEntityItem,
  RuntimeEntitySelectDataSource,
  RuntimeEntityDialogDataSource
} from '../../utils/runtime-entity-data-sources';

/**
 * Value object for the runtime entity selector
 */
export interface RuntimeEntitySelectorValue {
  ckTypeId: string;
  rtCkTypeId: string;
  rtId?: string;
  displayName?: string;
}

/**
 * Reusable component for selecting a runtime entity.
 * Combines CK Type selector and Entity selector into a single component.
 *
 * Usage:
 * ```html
 * <mm-runtime-entity-selector
 *   [(ngModel)]="selectedEntity"
 *   (entitySelected)="onEntitySelected($event)"
 *   ckTypeLabel="Runtime Entities"
 *   entityLabel="Entity">
 * </mm-runtime-entity-selector>
 * ```
 */
@Component({
  selector: 'mm-runtime-entity-selector',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CkTypeSelectorInputComponent,
    EntitySelectInputComponent
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RuntimeEntitySelectorComponent),
      multi: true
    }
  ],
  template: `
    <div class="runtime-entity-selector">
      <!-- CK Type Selection -->
      <div class="form-field">
        <label>{{ ckTypeLabel }} @if (ckTypeRequired) { <span class="required">*</span> }</label>
        <mm-ck-type-selector-input
          #ckTypeSelector
          [placeholder]="ckTypePlaceholder"
          [minSearchLength]="2"
          [dialogTitle]="ckTypeDialogTitle"
          [ngModel]="selectedCkType"
          (ckTypeSelected)="onCkTypeSelected($event)"
          (ckTypeCleared)="onCkTypeCleared()">
        </mm-ck-type-selector-input>
        @if (ckTypeHint) {
          <p class="field-hint">{{ ckTypeHint }}</p>
        }
      </div>

      <!-- Entity Selection (only shown when CK Type is selected) -->
      @if (showEntitySelector) {
        <div class="form-field" [class.disabled]="!selectedCkType">
          <label>{{ entityLabel }} @if (entityRequired) { <span class="required">*</span> }</label>
          @if (selectedCkType && entityDataSource) {
            <mm-entity-select-input
              #entitySelector
              [dataSource]="entityDataSource"
              [dialogDataSource]="entityDialogDataSource"
              [placeholder]="entityPlaceholder"
              [dialogTitle]="entityDialogTitle"
              [minSearchLength]="1"
              [ngModel]="selectedEntity"
              (entitySelected)="onEntitySelected($event)"
              (entityCleared)="onEntityCleared()">
            </mm-entity-select-input>
          } @else {
            <input
              kendoTextBox
              [placeholder]="entityPlaceholder"
              disabled />
          }
          @if (entityHint) {
            <p class="field-hint">{{ entityHint }}</p>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .runtime-entity-selector {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .form-field label {
      font-weight: 500;
    }

    .form-field.disabled {
      opacity: 0.6;
    }

    .field-hint {
      font-size: 0.85em;
      margin: 0;
      opacity: 0.7;
    }

    .required {
      color: #dc3545;
    }
  `]
})
export class RuntimeEntitySelectorComponent implements ControlValueAccessor {
  private readonly getEntitiesByCkTypeGQL = inject(GetEntitiesByCkTypeDtoGQL);
  private readonly ckTypeSelectorService = inject(CkTypeSelectorService);

  @ViewChild('ckTypeSelector') ckTypeSelector!: CkTypeSelectorInputComponent;
  @ViewChild('entitySelector') entitySelector?: EntitySelectInputComponent;

  // CK Type configuration
  @Input() ckTypeLabel = 'Runtime Entities';
  @Input() ckTypePlaceholder = 'Select Runtime Entities...';
  @Input() ckTypeDialogTitle = 'Select Runtime Entities';
  @Input() ckTypeHint = 'Select the type of entities to choose from.';
  @Input() ckTypeRequired = false;

  // Entity configuration
  @Input() entityLabel = 'Entity';
  @Input() entityPlaceholder = 'Search for an entity...';
  @Input() entityDialogTitle = 'Select Entity';
  @Input() entityHint = 'Select the specific entity.';
  @Input() entityRequired = false;

  /** Whether to show the entity selector (set to false if only CK Type selection is needed) */
  @Input() showEntitySelector = true;

  /** Whether the component is disabled */
  @Input() disabled = false;

  /** Emitted when a CK Type is selected */
  @Output() ckTypeSelected = new EventEmitter<CkTypeSelectorItem>();

  /** Emitted when the CK Type is cleared */
  @Output() ckTypeCleared = new EventEmitter<void>();

  /** Emitted when an entity is selected */
  @Output() entitySelected = new EventEmitter<RuntimeEntityItem>();

  /** Emitted when the entity is cleared */
  @Output() entityCleared = new EventEmitter<void>();

  /** Emitted when the full value changes */
  @Output() valueChange = new EventEmitter<RuntimeEntitySelectorValue | null>();

  selectedCkType: CkTypeSelectorItem | null = null;
  selectedEntity: RuntimeEntityItem | null = null;
  entityDataSource?: RuntimeEntitySelectDataSource;
  entityDialogDataSource?: RuntimeEntityDialogDataSource;

  // ControlValueAccessor (initialized as noop, set by registerOnChange/registerOnTouched)
  private onChange: (value: RuntimeEntitySelectorValue | null) => void = () => { /* noop */ };
  private onTouched: () => void = () => { /* noop */ };

  /**
   * Called when a CK Type is selected
   */
  onCkTypeSelected(ckType: CkTypeSelectorItem): void {
    this.selectedCkType = ckType;
    this.selectedEntity = null;

    // Create new data sources for entity selection
    this.entityDataSource = new RuntimeEntitySelectDataSource(
      this.getEntitiesByCkTypeGQL,
      ckType.rtCkTypeId
    );
    this.entityDialogDataSource = new RuntimeEntityDialogDataSource(
      this.getEntitiesByCkTypeGQL,
      ckType.rtCkTypeId
    );

    this.ckTypeSelected.emit(ckType);
    this.emitValue();
  }

  /**
   * Called when the CK Type is cleared
   */
  onCkTypeCleared(): void {
    this.selectedCkType = null;
    this.selectedEntity = null;
    this.entityDataSource = undefined;
    this.entityDialogDataSource = undefined;

    this.ckTypeCleared.emit();
    this.emitValue();
  }

  /**
   * Called when an entity is selected
   */
  onEntitySelected(entity: RuntimeEntityItem): void {
    this.selectedEntity = entity;
    this.entitySelected.emit(entity);
    this.emitValue();
  }

  /**
   * Called when the entity is cleared
   */
  onEntityCleared(): void {
    this.selectedEntity = null;
    this.entityCleared.emit();
    this.emitValue();
  }

  /**
   * Sets the value by loading CK Type and Entity by their IDs
   */
  async setValueByIds(ckTypeId: string, rtId?: string): Promise<void> {
    // Load CK Type
    const ckType = await this.loadCkTypeByRtCkTypeId(ckTypeId);

    if (ckType) {
      this.selectedCkType = ckType;

      // Create data sources
      this.entityDataSource = new RuntimeEntitySelectDataSource(
        this.getEntitiesByCkTypeGQL,
        ckType.rtCkTypeId
      );
      this.entityDialogDataSource = new RuntimeEntityDialogDataSource(
        this.getEntitiesByCkTypeGQL,
        ckType.rtCkTypeId
      );

      // Set the CK Type in the selector
      if (this.ckTypeSelector) {
        this.ckTypeSelector.writeValue(ckType);
      }

      // Load entity if rtId is provided
      if (rtId && this.entityDataSource) {
        const entityResult = await this.entityDataSource.onFilter(rtId, 1);
        if (entityResult.items.length > 0) {
          this.selectedEntity = entityResult.items[0];
        }
      }
    }
  }

  /**
   * Loads a CK Type by its rtCkTypeId
   */
  private async loadCkTypeByRtCkTypeId(rtCkTypeId: string): Promise<CkTypeSelectorItem | null> {
    try {
      const result = await this.ckTypeSelectorService.getCkTypeByRtCkTypeId(rtCkTypeId).toPromise();
      return result ?? null;
    } catch {
      console.error(`Failed to load CK Type: ${rtCkTypeId}`);
      return null;
    }
  }

  /**
   * Emits the current value
   */
  private emitValue(): void {
    const value = this.getCurrentValue();
    this.onChange(value);
    this.onTouched();
    this.valueChange.emit(value);
  }

  /**
   * Gets the current value
   */
  private getCurrentValue(): RuntimeEntitySelectorValue | null {
    if (!this.selectedCkType) {
      return null;
    }

    return {
      ckTypeId: this.selectedCkType.fullName,
      rtCkTypeId: this.selectedCkType.rtCkTypeId,
      rtId: this.selectedEntity?.rtId,
      displayName: this.selectedEntity?.displayName
    };
  }

  // ControlValueAccessor implementation
  writeValue(value: RuntimeEntitySelectorValue | null): void {
    if (value) {
      // Defer loading to allow component to initialize
      setTimeout(() => this.setValueByIds(value.rtCkTypeId, value.rtId), 0);
    } else {
      this.selectedCkType = null;
      this.selectedEntity = null;
      this.entityDataSource = undefined;
      this.entityDialogDataSource = undefined;
    }
  }

  registerOnChange(fn: (value: RuntimeEntitySelectorValue | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
