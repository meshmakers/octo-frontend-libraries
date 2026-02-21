/**
 * Transform Property Editor Component
 *
 * Allows editing transform properties on symbol definitions.
 * Provides CRUD operations for properties and bindings.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { plusIcon, linkIcon, pencilIcon, trashIcon } from '@progress/kendo-svg-icons';

import {
  TransformProperty,
  TransformPropertyType,
  PropertyBinding,
  createNumberProperty
} from '../primitives/models/transform-property.models';
import { PrimitiveBase } from '../primitives';
import { SymbolInstance } from '../primitives/models/symbol.model';

/**
 * Event for property changes
 */
export interface TransformPropertyChangeEvent {
  properties: TransformProperty[];
  bindings: PropertyBinding[];
}

/**
 * Transform Property Editor Component
 */
@Component({
  selector: 'mm-transform-property-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonsModule, InputsModule, DropDownsModule, DecimalPipe],
  template: `
    <div class="transform-property-editor">
      <div class="editor-toolbar">
        <button kendoButton [svgIcon]="plusIcon" look="flat" (click)="addProperty()">
          Add Property
        </button>
      </div>

      <div class="properties-list">
        <!-- New Property Form -->
        @if (isAddingNew()) {
          <div class="property-card editing">
            <div class="property-edit-form">
              <div class="form-row">
                <label>Name</label>
                <input type="text"
                       [value]="editFormData().name"
                       (input)="updateEditForm('name', $any($event.target).value)"/>
              </div>
              <div class="form-row">
                <label>Type</label>
                <select [value]="editFormData().type"
                        (change)="updateEditForm('type', $any($event.target).value)">
                  <option value="number">Number</option>
                  <option value="color">Color</option>
                  <option value="boolean">Boolean</option>
                  <option value="string">String</option>
                </select>
              </div>
              @if (editFormData().type === 'number') {
                <div class="form-row two-col">
                  <div>
                    <label>Min</label>
                    <input type="number"
                           [value]="editFormData().min ?? ''"
                           (input)="updateEditForm('min', +$any($event.target).value)"/>
                  </div>
                  <div>
                    <label>Max</label>
                    <input type="number"
                           [value]="editFormData().max ?? ''"
                           (input)="updateEditForm('max', +$any($event.target).value)"/>
                  </div>
                </div>
                <div class="form-row two-col">
                  <div>
                    <label>Step</label>
                    <input type="number"
                           [value]="editFormData().step ?? 1"
                           min="0.01"
                           step="0.1"
                           (input)="updateEditForm('step', +$any($event.target).value)"/>
                  </div>
                  <div>
                    <label>Unit</label>
                    <input type="text"
                           [value]="editFormData().unit ?? ''"
                           placeholder="°, %, px"
                           (input)="updateEditForm('unit', $any($event.target).value)"/>
                  </div>
                </div>
                <div class="form-row">
                  <label>Default</label>
                  <input type="number"
                         [value]="editFormData().defaultValue"
                         (input)="updateEditForm('defaultValue', +$any($event.target).value)"/>
                </div>
              } @else if (editFormData().type === 'color') {
                <div class="form-row">
                  <label>Default</label>
                  <input type="color"
                         [value]="editFormData().defaultValue"
                         (input)="updateEditForm('defaultValue', $any($event.target).value)"/>
                </div>
              } @else if (editFormData().type === 'boolean') {
                <div class="form-row">
                  <label>Default</label>
                  <input type="checkbox"
                         [checked]="editFormData().defaultValue"
                         (change)="updateEditForm('defaultValue', $any($event.target).checked)"/>
                </div>
              } @else {
                <div class="form-row">
                  <label>Default</label>
                  <input type="text"
                         [value]="editFormData().defaultValue"
                         (input)="updateEditForm('defaultValue', $any($event.target).value)"/>
                </div>
              }
              <div class="form-row">
                <label>Description</label>
                <input type="text"
                       [value]="editFormData().description ?? ''"
                       placeholder="Optional description"
                       (input)="updateEditForm('description', $any($event.target).value)"/>
              </div>
              <div class="form-actions">
                <button kendoButton look="flat" (click)="cancelEdit()">Cancel</button>
                <button kendoButton themeColor="primary" (click)="saveProperty()">Save</button>
              </div>
            </div>
          </div>
        }

        <!-- Empty State -->
        @if (properties().length === 0 && !isAddingNew()) {
          <div class="empty-state">
            <p>No transform properties defined.</p>
            <p class="hint">Add properties to enable dynamic transformations.</p>
          </div>
        }

        <!-- Existing Properties -->
        @for (property of properties(); track property.id) {
          <div class="property-card" [class.editing]="editingPropertyId() === property.id">
            @if (editingPropertyId() === property.id) {
              <!-- Edit Mode -->
              <div class="property-edit-form">
                <div class="form-row">
                  <label>Name</label>
                  <input type="text"
                         [value]="editFormData().name"
                         (input)="updateEditForm('name', $any($event.target).value)"/>
                </div>
                <div class="form-row">
                  <label>Type</label>
                  <select [value]="editFormData().type"
                          (change)="updateEditForm('type', $any($event.target).value)">
                    <option value="number">Number</option>
                    <option value="color">Color</option>
                    <option value="boolean">Boolean</option>
                    <option value="string">String</option>
                  </select>
                </div>
                @if (editFormData().type === 'number') {
                  <div class="form-row two-col">
                    <div>
                      <label>Min</label>
                      <input type="number"
                             [value]="editFormData().min ?? ''"
                             (input)="updateEditForm('min', +$any($event.target).value)"/>
                    </div>
                    <div>
                      <label>Max</label>
                      <input type="number"
                             [value]="editFormData().max ?? ''"
                             (input)="updateEditForm('max', +$any($event.target).value)"/>
                    </div>
                  </div>
                  <div class="form-row two-col">
                    <div>
                      <label>Step</label>
                      <input type="number"
                             [value]="editFormData().step ?? 1"
                             min="0.01"
                             step="0.1"
                             (input)="updateEditForm('step', +$any($event.target).value)"/>
                    </div>
                    <div>
                      <label>Unit</label>
                      <input type="text"
                             [value]="editFormData().unit ?? ''"
                             placeholder="°, %, px"
                             (input)="updateEditForm('unit', $any($event.target).value)"/>
                    </div>
                  </div>
                  <div class="form-row">
                    <label>Default</label>
                    <input type="number"
                           [value]="editFormData().defaultValue"
                           (input)="updateEditForm('defaultValue', +$any($event.target).value)"/>
                  </div>
                } @else if (editFormData().type === 'color') {
                  <div class="form-row">
                    <label>Default</label>
                    <input type="color"
                           [value]="editFormData().defaultValue"
                           (input)="updateEditForm('defaultValue', $any($event.target).value)"/>
                  </div>
                } @else if (editFormData().type === 'boolean') {
                  <div class="form-row">
                    <label>Default</label>
                    <input type="checkbox"
                           [checked]="editFormData().defaultValue"
                           (change)="updateEditForm('defaultValue', $any($event.target).checked)"/>
                  </div>
                } @else {
                  <div class="form-row">
                    <label>Default</label>
                    <input type="text"
                           [value]="editFormData().defaultValue"
                           (input)="updateEditForm('defaultValue', $any($event.target).value)"/>
                  </div>
                }
                <div class="form-row">
                  <label>Description</label>
                  <input type="text"
                         [value]="editFormData().description ?? ''"
                         placeholder="Optional description"
                         (input)="updateEditForm('description', $any($event.target).value)"/>
                </div>
                <div class="form-actions">
                  <button kendoButton look="flat" (click)="cancelEdit()">Cancel</button>
                  <button kendoButton themeColor="primary" (click)="saveProperty()">Save</button>
                </div>
              </div>
            } @else {
              <!-- View Mode -->
              <div class="property-header">
                <div class="property-info">
                  <span class="property-name">{{ property.name }}</span>
                  <span class="property-type-badge">{{ property.type }}</span>
                  @if (property.unit) {
                    <span class="property-unit">({{ property.unit }})</span>
                  }
                </div>
                <div class="property-actions">
                  <button kendoButton [svgIcon]="linkIcon" look="flat" title="Edit Bindings"
                          (click)="openBindingEditor(property)">
                  </button>
                  <button kendoButton [svgIcon]="pencilIcon" look="flat" title="Edit Property"
                          (click)="editProperty(property)">
                  </button>
                  <button kendoButton [svgIcon]="trashIcon" look="flat" title="Delete Property"
                          (click)="deleteProperty(property)">
                  </button>
                </div>
              </div>
              <div class="property-details">
                @if (property.type === 'number') {
                  <span class="detail">Default: {{ property.defaultValue }}</span>
                  @if (property.min !== undefined && property.max !== undefined) {
                    <span class="detail">Range: {{ property.min }} - {{ property.max }}</span>
                  }
                } @else if (property.type === 'color') {
                  <span class="detail color-preview">
                    <span class="color-swatch" [style.background]="String(property.defaultValue)"></span>
                    {{ property.defaultValue }}
                  </span>
                } @else {
                  <span class="detail">Default: {{ property.defaultValue }}</span>
                }
                @let bindingCount = getBindingCount(property.id);
                <span class="detail bindings-count">
                  {{ bindingCount }} binding{{ bindingCount !== 1 ? 's' : '' }}
                </span>
              </div>
              @if (property.description) {
                <div class="property-description">{{ property.description }}</div>
              }
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .transform-property-editor {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .editor-toolbar {
      flex-shrink: 0;
      display: flex;
      justify-content: flex-end;
      padding: 0.5rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .properties-list {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 0.5rem;
    }

    .empty-state {
      padding: 1rem;
      text-align: center;
      color: #666;
    }

    .hint {
      font-size: 12px;
      color: #999;
      margin-top: 0.5rem;
    }

    .property-card {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      margin-bottom: 0.5rem;
      padding: 0.75rem;
      transition: box-shadow 0.2s;
    }

    .property-card:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .property-card.editing {
      border-color: #1976d2;
      box-shadow: 0 2px 8px rgba(25, 118, 210, 0.2);
    }

    .property-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .property-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .property-name {
      font-weight: 500;
      font-size: 13px;
    }

    .property-type-badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      background: #e3f2fd;
      border-radius: 4px;
      font-size: 10px;
      color: #1976d2;
      text-transform: uppercase;
    }

    .property-unit {
      font-size: 11px;
      color: #666;
    }

    .property-actions {
      display: flex;
      gap: 0.25rem;
    }

    .property-details {
      display: flex;
      gap: 1rem;
      margin-top: 0.5rem;
      font-size: 11px;
      color: #666;
    }

    .detail {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .color-swatch {
      display: inline-block;
      width: 14px;
      height: 14px;
      border-radius: 3px;
      border: 1px solid #ccc;
    }

    .bindings-count {
      padding: 0.125rem 0.5rem;
      background: #f5f5f5;
      border-radius: 4px;
    }

    .property-description {
      margin-top: 0.5rem;
      font-size: 11px;
      color: #999;
      font-style: italic;
    }

    /* Edit Form Styles */
    .property-edit-form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .form-row label {
      flex: 0 0 80px;
      font-size: 11px;
      color: #666;
    }

    .form-row input[type="text"],
    .form-row input[type="number"],
    .form-row select {
      flex: 1;
      padding: 0.375rem 0.5rem;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 12px;
    }

    .form-row input:focus,
    .form-row select:focus {
      outline: none;
      border-color: #1976d2;
    }

    .form-row input[type="color"] {
      flex: 0 0 50px;
      height: 32px;
      padding: 2px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }

    .form-row input[type="checkbox"] {
      margin: 0;
    }

    .form-row.two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }

    .form-row.two-col > div {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .form-row.two-col label {
      flex: none;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid #e0e0e0;
    }
  `]
})
export class TransformPropertyEditorComponent {
  // SVG Icons
  protected readonly plusIcon = plusIcon;
  protected readonly linkIcon = linkIcon;
  protected readonly pencilIcon = pencilIcon;
  protected readonly trashIcon = trashIcon;

  @Input() set transformProperties(value: TransformProperty[]) {
    this._properties.set(value ?? []);
  }

  @Input() set propertyBindings(value: PropertyBinding[]) {
    this._bindings.set(value ?? []);
  }

  @Input() primitives: PrimitiveBase[] = [];
  @Input() symbolInstances: SymbolInstance[] = [];

  @Output() propertiesChange = new EventEmitter<TransformPropertyChangeEvent>();
  @Output() openBindings = new EventEmitter<TransformProperty>();

  // Internal state
  private _properties = signal<TransformProperty[]>([]);
  private _bindings = signal<PropertyBinding[]>([]);
  private _editingPropertyId = signal<string | null>(null);
  private _editFormData = signal<Partial<TransformProperty>>({});

  // Computed values
  properties = computed(() => this._properties());
  bindings = computed(() => this._bindings());
  editingPropertyId = computed(() => this._editingPropertyId());
  editFormData = computed(() => this._editFormData());

  // Check if we're adding a new property (editing an ID that's not in the list)
  isAddingNew = computed(() => {
    const editingId = this._editingPropertyId();
    if (!editingId) return false;
    return !this._properties().some(p => p.id === editingId);
  });

  /**
   * Get binding count for a property
   */
  getBindingCount(propertyId: string): number {
    return this._bindings().filter(b => b.propertyId === propertyId).length;
  }

  /**
   * Add a new property
   */
  addProperty(): void {
    const newId = `prop_${Date.now()}`;
    const newProperty = createNumberProperty(newId, 'New Property', {
      defaultValue: 0,
      min: 0,
      max: 100,
      step: 1
    });

    this._editingPropertyId.set(newId);
    this._editFormData.set({ ...newProperty, name: 'New Property' });
  }

  /**
   * Edit an existing property
   */
  editProperty(property: TransformProperty): void {
    this._editingPropertyId.set(property.id);
    this._editFormData.set({ ...property });
  }

  /**
   * Update edit form field
   */
  updateEditForm(field: string, value: unknown): void {
    this._editFormData.update(data => ({
      ...data,
      [field]: value
    }));
  }

  /**
   * Cancel editing
   */
  cancelEdit(): void {
    const editingId = this._editingPropertyId();
    // If we were adding a new property (not in list), just cancel
    const existingProperty = this._properties().find(p => p.id === editingId);
    if (!existingProperty) {
      // New property was being added, just cancel
    }
    this._editingPropertyId.set(null);
    this._editFormData.set({});
  }

  /**
   * Save the edited property
   */
  saveProperty(): void {
    const formData = this._editFormData();
    if (!formData.id || !formData.name || !formData.type) {
      return;
    }

    const property: TransformProperty = {
      id: formData.id,
      name: formData.name,
      type: formData.type as TransformPropertyType,
      defaultValue: formData.defaultValue ?? this.getDefaultValueForType(formData.type as TransformPropertyType),
      description: formData.description,
      min: formData.min,
      max: formData.max,
      step: formData.step,
      unit: formData.unit,
      group: formData.group
    };

    const existingIndex = this._properties().findIndex(p => p.id === property.id);
    let newProperties: TransformProperty[];

    if (existingIndex >= 0) {
      // Update existing
      newProperties = [...this._properties()];
      newProperties[existingIndex] = property;
    } else {
      // Add new
      newProperties = [...this._properties(), property];
    }

    this._properties.set(newProperties);
    this._editingPropertyId.set(null);
    this._editFormData.set({});

    this.emitChanges(newProperties, this._bindings());
  }

  /**
   * Delete a property
   */
  deleteProperty(property: TransformProperty): void {
    const newProperties = this._properties().filter(p => p.id !== property.id);
    const newBindings = this._bindings().filter(b => b.propertyId !== property.id);

    this._properties.set(newProperties);
    this._bindings.set(newBindings);

    this.emitChanges(newProperties, newBindings);
  }

  /**
   * Open binding editor for a property
   */
  openBindingEditor(property: TransformProperty): void {
    this.openBindings.emit(property);
  }

  /**
   * Get default value for property type
   */
  private getDefaultValueForType(type: TransformPropertyType): number | string | boolean {
    switch (type) {
      case 'number':
        return 0;
      case 'color':
        return '#000000';
      case 'boolean':
        return false;
      case 'string':
        return '';
    }
  }

  /**
   * Emit property changes
   */
  private emitChanges(properties: TransformProperty[], bindings: PropertyBinding[]): void {
    this.propertiesChange.emit({ properties, bindings });
  }

  /**
   * Helper for template
   */
  protected String = String;
}
