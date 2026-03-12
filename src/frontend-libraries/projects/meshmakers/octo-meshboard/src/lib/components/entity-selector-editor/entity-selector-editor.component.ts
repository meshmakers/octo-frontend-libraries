import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { LabelModule } from '@progress/kendo-angular-label';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { plusIcon, trashIcon, pencilIcon } from '@progress/kendo-svg-icons';
import { EntitySelectInputComponent } from '@meshmakers/shared-ui';
import {
  CkTypeSelectorInputComponent,
  AttributeSelectorDialogService
} from '@meshmakers/octo-ui';
import { CkTypeSelectorItem, type AttributeItem } from '@meshmakers/octo-services';
import { EntitySelectorConfig, EntitySelectorAttributeMapping } from '../../models/meshboard.models';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { RuntimeEntitySelectDataSource, RuntimeEntityDialogDataSource, RuntimeEntityItem } from '../../utils/runtime-entity-data-sources';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';

/**
 * Component for editing entity selector configurations in MeshBoard settings.
 * Allows adding, editing, and removing entity selectors.
 * Selectors can optionally appear in the toolbar for user selection, or be hidden
 * with a pre-configured default entity (replacing the old runtime entity variables).
 */
@Component({
  selector: 'mm-entity-selector-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputsModule,
    LabelModule,
    SVGIconModule,
    CkTypeSelectorInputComponent,
    EntitySelectInputComponent
  ],
  templateUrl: './entity-selector-editor.component.html',
  styleUrl: './entity-selector-editor.component.scss'
})
export class EntitySelectorEditorComponent {
  private readonly attributeSelectorService = inject(AttributeSelectorDialogService);
  private readonly variableService = inject(MeshBoardVariableService);
  private readonly getEntitiesByCkTypeGQL = inject(GetEntitiesByCkTypeDtoGQL);

  @Input() entitySelectors: EntitySelectorConfig[] = [];
  /** Existing variable names from other sources (static variables, other selectors) for duplicate detection */
  @Input() existingVariableNames: string[] = [];
  @Output() entitySelectorsChange = new EventEmitter<EntitySelectorConfig[]>();

  protected readonly plusIcon = plusIcon;
  protected readonly trashIcon = trashIcon;
  protected readonly pencilIcon = pencilIcon;

  // Editing state
  protected isEditing = false;
  protected editingIndex: number | null = null;
  protected editId = '';
  protected editLabel = '';
  protected editCkTypeId = '';
  protected editCkTypeItem: CkTypeSelectorItem | null = null;
  protected editMappings: EntitySelectorAttributeMapping[] = [];
  protected editShowInToolbar = true;
  protected editDefaultRtId = '';

  // Data sources for the default entity picker (created when CK type is set)
  protected defaultEntityDataSource: RuntimeEntitySelectDataSource | null = null;
  protected defaultEntityDialogDataSource: RuntimeEntityDialogDataSource | null = null;

  /**
   * Starts adding a new entity selector.
   */
  addSelector(): void {
    this.editingIndex = null;
    this.editId = this.generateSelectorId();
    this.editLabel = '';
    this.editCkTypeId = '';
    this.editCkTypeItem = null;
    this.editMappings = [];
    this.editShowInToolbar = true;
    this.editDefaultRtId = '';
    this.defaultEntityDataSource = null;
    this.defaultEntityDialogDataSource = null;
    this.isEditing = true;
  }

  /**
   * Starts editing an existing entity selector.
   */
  editSelector(index: number): void {
    const selector = this.entitySelectors[index];
    this.editingIndex = index;
    this.editId = selector.id;
    this.editLabel = selector.label;
    this.editCkTypeId = selector.ckTypeId;
    // Create a minimal CkTypeSelectorItem so the input shows the selected type
    this.editCkTypeItem = {
      fullName: selector.ckTypeId,
      rtCkTypeId: selector.ckTypeId,
      isAbstract: false,
      isFinal: false
    };
    this.editMappings = [...selector.attributeMappings];
    this.editShowInToolbar = selector.showInToolbar !== false;
    this.editDefaultRtId = selector.defaultRtId ?? '';
    this.updateDefaultEntityDataSources();
    this.isEditing = true;
  }

  /**
   * Removes an entity selector at the given index.
   */
  removeSelector(index: number): void {
    this.entitySelectors = this.entitySelectors.filter((_, i) => i !== index);
    this.emitChange();
  }

  /**
   * Handles CK type selection in the editor form.
   */
  onCkTypeSelected(ckType: CkTypeSelectorItem): void {
    this.editCkTypeId = ckType.rtCkTypeId;
    this.editCkTypeItem = ckType;
    // Clear mappings and default entity when CK type changes
    this.editMappings = [];
    this.editDefaultRtId = '';
    this.updateDefaultEntityDataSources();
  }

  /**
   * Handles CK type cleared in the editor form.
   */
  onCkTypeCleared(): void {
    this.editCkTypeId = '';
    this.editCkTypeItem = null;
    this.editMappings = [];
    this.editDefaultRtId = '';
    this.defaultEntityDataSource = null;
    this.defaultEntityDialogDataSource = null;
  }

  /**
   * Opens the attribute selector dialog to pick attributes for variable mappings.
   */
  async selectAttributes(): Promise<void> {
    if (!this.editCkTypeId) return;

    const result = await this.attributeSelectorService.openAttributeSelector(
      this.editCkTypeId,
      this.editMappings.map(m => m.attributePath),
      'Select Attributes for Variables'
    );

    if (!result.confirmed) return;

    // Map selected attributes to mappings, preserving existing variable names
    this.editMappings = result.selectedAttributes.map((attr: AttributeItem) => {
      const existing = this.editMappings.find(m => m.attributePath === attr.attributePath);
      return {
        attributePath: attr.attributePath,
        variableName: existing?.variableName ?? this.variableService.attributePathToVariableName(attr.attributePath),
        attributeValueType: attr.attributeValueType
      };
    });
  }

  /**
   * Handles default entity selection from the entity picker.
   */
  onDefaultEntitySelected(entity: RuntimeEntityItem): void {
    this.editDefaultRtId = entity.rtId;
  }

  /**
   * Handles default entity cleared.
   */
  onDefaultEntityCleared(): void {
    this.editDefaultRtId = '';
  }

  /**
   * Saves the current entity selector being edited.
   */
  saveEdit(): void {
    if (!this.isEditValid()) return;

    const selector: EntitySelectorConfig = {
      id: this.editId,
      label: this.editLabel.trim(),
      ckTypeId: this.editCkTypeId,
      attributeMappings: this.editMappings,
      showInToolbar: this.editShowInToolbar,
      defaultRtId: this.editDefaultRtId.trim() || undefined
    };

    if (this.editingIndex !== null) {
      this.entitySelectors = this.entitySelectors.map((es, i) =>
        i === this.editingIndex ? selector : es
      );
    } else {
      this.entitySelectors = [...this.entitySelectors, selector];
    }

    this.isEditing = false;
    this.editingIndex = null;
    this.emitChange();
  }

  /**
   * Cancels the current edit.
   */
  cancelEdit(): void {
    this.isEditing = false;
    this.editingIndex = null;
  }

  /**
   * Validates the current edit form.
   */
  isEditValid(): boolean {
    const hasRequiredFields =
      this.editId.trim().length > 0 &&
      this.editLabel.trim().length > 0 &&
      this.editCkTypeId.length > 0 &&
      this.editMappings.length > 0 &&
      this.editMappings.every(m =>
        m.variableName.trim().length > 0 &&
        this.isValidVariableName(m.variableName) &&
        !this.isDuplicateVariableName(m.variableName, m.attributePath)
      ) &&
      !this.isDuplicateId(this.editId, this.editingIndex);

    // If not shown in toolbar, a default entity must be selected
    if (!this.editShowInToolbar && !this.editDefaultRtId.trim()) {
      return false;
    }

    return hasRequiredFields;
  }

  /**
   * Checks if a selector ID is duplicate.
   */
  isDuplicateId(id: string, excludeIndex: number | null): boolean {
    return this.entitySelectors.some((es, i) => i !== excludeIndex && es.id === id);
  }

  /**
   * Gets a display summary for an entity selector's attribute mappings.
   */
  getMappingSummary(selector: EntitySelectorConfig): string {
    return selector.attributeMappings
      .map(m => `$${m.variableName}`)
      .join(', ');
  }

  /**
   * Gets a display label indicating the selector mode.
   */
  getModeLabel(selector: EntitySelectorConfig): string {
    return selector.showInToolbar !== false ? 'Toolbar' : 'Fixed';
  }

  /**
   * Validates a variable name format (alphanumeric + underscore).
   */
  isValidVariableName(name: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name.trim());
  }

  /**
   * Checks if a variable name is already used — either by another mapping in the current
   * edit form, by another entity selector's mappings, or by an existing static variable.
   */
  isDuplicateVariableName(name: string, currentAttributePath: string): boolean {
    const trimmed = name.trim();
    if (!trimmed) return false;

    // Check within current edit mappings (duplicate within same selector)
    const duplicateInCurrentMappings = this.editMappings.some(
      m => m.attributePath !== currentAttributePath && m.variableName.trim() === trimmed
    );
    if (duplicateInCurrentMappings) return true;

    // Check against other entity selectors' mappings (not the one being edited)
    const otherSelectors = this.entitySelectors.filter((_, i) => i !== this.editingIndex);
    const duplicateInOtherSelectors = otherSelectors.some(
      es => es.attributeMappings.some(m => m.variableName === trimmed)
    );
    if (duplicateInOtherSelectors) return true;

    // Check against existing variable names from other sources (static, timeFilter)
    return this.existingVariableNames.includes(trimmed);
  }

  /**
   * Returns the duplicate error message for a variable name, or empty string if valid.
   */
  getVariableNameError(mapping: EntitySelectorAttributeMapping): string {
    const name = mapping.variableName.trim();
    if (!name) return 'Variable name is required';
    if (!this.isValidVariableName(name)) return 'Invalid name (use letters, numbers, underscore)';
    if (this.isDuplicateVariableName(name, mapping.attributePath)) return 'Name already in use';
    return '';
  }

  private generateSelectorId(): string {
    const prefix = 'es';
    let counter = this.entitySelectors.length + 1;
    while (this.entitySelectors.some(es => es.id === `${prefix}${counter}`)) {
      counter++;
    }
    return `${prefix}${counter}`;
  }

  private updateDefaultEntityDataSources(): void {
    if (this.editCkTypeId) {
      this.defaultEntityDataSource = new RuntimeEntitySelectDataSource(
        this.getEntitiesByCkTypeGQL,
        this.editCkTypeId
      );
      this.defaultEntityDialogDataSource = new RuntimeEntityDialogDataSource(
        this.getEntitiesByCkTypeGQL,
        this.editCkTypeId
      );
    } else {
      this.defaultEntityDataSource = null;
      this.defaultEntityDialogDataSource = null;
    }
  }

  private emitChange(): void {
    this.entitySelectorsChange.emit([...this.entitySelectors]);
  }
}
