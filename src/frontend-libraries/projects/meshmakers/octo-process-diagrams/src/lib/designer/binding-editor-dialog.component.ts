/**
 * Binding Editor Dialog Component
 *
 * Dialog for editing property bindings on transform properties.
 * Allows configuring target elements, effect types, and expressions.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  inject,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { DialogsModule } from '@progress/kendo-angular-dialog';
import { plusIcon, chevronUpIcon, chevronDownIcon, trashIcon } from '@progress/kendo-svg-icons';

import {
  TransformProperty,
  PropertyBinding,
  BindingEffectType,
  BindingTargetType,
  TransformAnchor
} from '../primitives/models/transform-property.models';
import { PrimitiveBase } from '../primitives';
import { SymbolInstance, SymbolDefinition } from '../primitives/models/symbol.model';
import { AnimationDefinition } from '../primitives/models/animation.models';
import { ExpressionEvaluatorService } from '../services/expression-evaluator.service';

/**
 * Target element option for the dropdown
 */
interface TargetOption {
  id: string;
  name: string;
  type: BindingTargetType;
}

/**
 * Binding Editor Dialog Component
 */
@Component({
  selector: 'mm-binding-editor-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonsModule, InputsModule, DropDownsModule, DialogsModule],
  template: `
    @if (visible()) {
      <kendo-dialog title="Bindings for: {{ currentProperty()?.name }}"
                    [width]="550"
                    [height]="500"
                    (close)="close()">
        <div class="binding-editor-content">
          <div class="bindings-list">
            <div class="list-header">
              <span>Bindings</span>
              <button kendoButton [svgIcon]="plusIcon" look="flat" size="small" (click)="addBinding()">
                Add Binding
              </button>
            </div>

            @if (bindings().length === 0) {
              <div class="empty-state">
                <p>No bindings defined for this property.</p>
                <p class="hint">Add bindings to connect this property to element transforms or styles.</p>
              </div>
            } @else {
              @for (binding of bindings(); track $index; let i = $index) {
                <div class="binding-card" [class.expanded]="expandedIndex() === i">
                  <div class="binding-header" (click)="toggleExpanded(i)">
                    <div class="binding-summary">
                      <span class="target-name">{{ getTargetName(binding) }}</span>
                      <span class="effect-badge">{{ getEffectLabel(binding.effectType) }}</span>
                    </div>
                    <div class="binding-actions">
                      <button kendoButton [svgIcon]="expandedIndex() === i ? chevronUpIcon : chevronDownIcon"
                              look="flat" size="small">
                      </button>
                      <button kendoButton [svgIcon]="trashIcon" look="flat" size="small"
                              (click)="deleteBinding(i, $event)">
                      </button>
                    </div>
                  </div>

                  @if (expandedIndex() === i) {
                    <div class="binding-form">
                      <div class="form-row">
                        <label>Target</label>
                        <select (change)="updateBinding(i, 'target', $any($event.target).value)">
                          <optgroup label="Primitives">
                            @for (target of primitiveTargets(); track target.id) {
                              <option [value]="'primitive:' + target.id"
                                      [selected]="binding.targetType === 'primitive' && binding.targetId === target.id">
                                {{ target.name }}
                              </option>
                            }
                          </optgroup>
                          @if (symbolInstanceTargets().length > 0) {
                            <optgroup label="Symbol Instances">
                              @for (target of symbolInstanceTargets(); track target.id) {
                                <option [value]="'symbolInstance:' + target.id"
                                        [selected]="binding.targetType === 'symbolInstance' && binding.targetId === target.id">
                                  {{ target.name }}
                                </option>
                              }
                            </optgroup>
                          }
                        </select>
                      </div>

                      <div class="form-row">
                        <label>Effect</label>
                        <select (change)="updateBinding(i, 'effectType', $any($event.target).value)">
                          @for (group of effectTypeGroups; track group.name) {
                            <optgroup [label]="group.name">
                              @for (effect of group.effects; track effect.value) {
                                <option [value]="effect.value"
                                        [selected]="binding.effectType === effect.value">
                                  {{ effect.label }}
                                </option>
                              }
                            </optgroup>
                          }
                        </select>
                      </div>

                      @if (binding.effectType === 'property' && binding.targetType === 'symbolInstance') {
                        <div class="form-row">
                          <label>Target Property</label>
                          <select (change)="updateBinding(i, 'targetPropertyId', $any($event.target).value)">
                            <option value="" [selected]="!binding.targetPropertyId">Select property...</option>
                            @for (prop of getSymbolInstanceProperties(binding.targetId); track prop.id) {
                              <option [value]="prop.id" [selected]="binding.targetPropertyId === prop.id">
                                {{ prop.name }}
                              </option>
                            }
                          </select>
                        </div>
                      }

                      @if (binding.effectType === 'animation.enabled') {
                        <div class="form-row">
                          <label>Animation</label>
                          <select (change)="updateBinding(i, 'animationId', $any($event.target).value)">
                            <option value="" [selected]="!binding.animationId">Animation wählen...</option>
                            @for (anim of getTargetAnimations(binding.targetId); track anim.id) {
                              <option [value]="anim.id" [selected]="binding.animationId === anim.id">
                                {{ anim.name ?? anim.id }}
                              </option>
                            }
                          </select>
                        </div>
                      }

                      @if (needsAnchor(binding.effectType)) {
                        <div class="form-row anchor-row">
                          <label>Anchor</label>
                          <div class="anchor-selector">
                            <div class="anchor-grid">
                              @for (anchor of anchorOptions; track anchor.value) {
                                <button type="button"
                                        class="anchor-point"
                                        [class.selected]="(binding.anchor ?? 'center') === anchor.value"
                                        [title]="anchor.label"
                                        (click)="updateBinding(i, 'anchor', anchor.value)">
                                  <span class="anchor-dot"></span>
                                </button>
                              }
                            </div>
                            <span class="anchor-label">{{ getAnchorLabel(binding.anchor) }}</span>
                          </div>
                        </div>
                      }

                      <div class="form-row expression-row">
                        <label>Expression</label>
                        <div class="expression-input">
                          <input type="text"
                                 [value]="binding.expression"
                                 (input)="updateBinding(i, 'expression', $any($event.target).value)"
                                 placeholder="value * 3.6"/>
                          <div class="expression-hint">
                            Use <code>value</code> as input. Math: +, -, *, /. Functions: lerp, lerpColor, clamp
                          </div>
                        </div>
                      </div>

                      <div class="expression-preview">
                        <label>Preview</label>
                        <div class="preview-content">
                          <div class="preview-input">
                            <span>Input:</span>
                            @if (currentProperty()?.type === 'boolean') {
                              <label class="boolean-toggle">
                                <input type="checkbox"
                                       [checked]="previewInputValue() !== 0"
                                       (change)="setPreviewInput($any($event.target).checked ? 1 : 0)"/>
                                <span class="boolean-label">{{ previewInputValue() !== 0 ? 'true' : 'false' }}</span>
                              </label>
                            } @else {
                              <input type="number"
                                     [value]="previewInputValue()"
                                     (input)="setPreviewInput(+$any($event.target).value)"/>
                            }
                          </div>
                          <div class="preview-arrow">→</div>
                          <div class="preview-output" [class.error]="previewError(i)">
                            <span>Output:</span>
                            <span class="output-value">{{ getPreviewOutput(binding.expression) }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }
            }
          </div>
        </div>

        <kendo-dialog-actions>
          <button kendoButton (click)="close()">Cancel</button>
          <button kendoButton themeColor="primary" (click)="save()">Save</button>
        </kendo-dialog-actions>
      </kendo-dialog>
    }
  `,
  styles: [`
    .binding-editor-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 300px;
    }

    .bindings-list {
      flex: 1;
      overflow-y: auto;
    }

    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0;
      border-bottom: 1px solid #e0e0e0;
      margin-bottom: 0.5rem;
      font-weight: 500;
      font-size: 13px;
    }

    .empty-state {
      padding: 1.5rem;
      text-align: center;
      color: #666;
      background: #f9f9f9;
      border-radius: 8px;
    }

    .hint {
      font-size: 12px;
      color: #999;
      margin-top: 0.5rem;
    }

    .binding-card {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      margin-bottom: 0.5rem;
      overflow: hidden;
    }

    .binding-card.expanded {
      border-color: #1976d2;
    }

    .binding-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      cursor: pointer;
      background: #fafafa;
    }

    .binding-header:hover {
      background: #f5f5f5;
    }

    .binding-summary {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .target-name {
      font-weight: 500;
      font-size: 13px;
    }

    .effect-badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      background: #e8f5e9;
      border-radius: 4px;
      font-size: 10px;
      color: #2e7d32;
    }

    .binding-actions {
      display: flex;
      gap: 0.25rem;
    }

    .binding-form {
      padding: 0.75rem;
      border-top: 1px solid #e0e0e0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .form-row {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .form-row label {
      flex: 0 0 90px;
      font-size: 11px;
      color: #666;
      padding-top: 0.5rem;
    }

    .form-row select,
    .form-row input[type="text"],
    .form-row input[type="number"] {
      flex: 1;
      padding: 0.375rem 0.5rem;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 12px;
    }

    .form-row select:focus,
    .form-row input:focus {
      outline: none;
      border-color: #1976d2;
    }

    .expression-row {
      flex-direction: column;
      align-items: stretch;
    }

    .expression-row label {
      flex: none;
      padding-top: 0;
      margin-bottom: 0.25rem;
    }

    .expression-input {
      width: 100%;
    }

    .expression-input input {
      width: 100%;
      font-family: 'Consolas', 'Monaco', monospace;
    }

    .expression-hint {
      font-size: 10px;
      color: #999;
      margin-top: 0.25rem;
    }

    .expression-hint code {
      background: #f5f5f5;
      padding: 0.125rem 0.25rem;
      border-radius: 3px;
      font-family: 'Consolas', 'Monaco', monospace;
    }

    .expression-preview {
      background: #f9f9f9;
      border-radius: 6px;
      padding: 0.75rem;
    }

    .expression-preview > label {
      display: block;
      font-size: 11px;
      color: #666;
      margin-bottom: 0.5rem;
    }

    .preview-content {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .preview-input,
    .preview-output {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 12px;
    }

    .preview-input input[type="number"] {
      width: 80px;
      padding: 0.25rem 0.5rem;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 12px;
    }

    .boolean-toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }

    .boolean-toggle input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }

    .boolean-label {
      font-family: monospace;
      font-size: 12px;
      color: #333;
    }

    .preview-arrow {
      color: #666;
      font-size: 16px;
    }

    .preview-output .output-value {
      font-weight: 500;
      color: #1976d2;
      font-family: 'Consolas', 'Monaco', monospace;
    }

    .preview-output.error .output-value {
      color: #d32f2f;
    }

    .anchor-row {
      align-items: flex-start;
    }

    .anchor-selector {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .anchor-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2px;
      width: 54px;
      height: 54px;
      background: #e0e0e0;
      border-radius: 4px;
      padding: 2px;
    }

    .anchor-point {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      border: none;
      cursor: pointer;
      padding: 0;
      border-radius: 2px;
    }

    .anchor-point:hover {
      background: #e3f2fd;
    }

    .anchor-point.selected {
      background: #1976d2;
    }

    .anchor-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #999;
    }

    .anchor-point.selected .anchor-dot {
      background: #fff;
    }

    .anchor-point:hover .anchor-dot {
      background: #1976d2;
    }

    .anchor-point.selected:hover .anchor-dot {
      background: #fff;
    }

    .anchor-label {
      font-size: 11px;
      color: #666;
    }
  `]
})
export class BindingEditorDialogComponent implements OnInit {
  // SVG Icons
  protected readonly plusIcon = plusIcon;
  protected readonly chevronUpIcon = chevronUpIcon;
  protected readonly chevronDownIcon = chevronDownIcon;
  protected readonly trashIcon = trashIcon;

  private expressionEvaluator = inject(ExpressionEvaluatorService);

  @Input() set show(value: boolean) {
    this._visible.set(value);
    // When dialog opens, filter bindings and initialize preview value
    if (value) {
      this.filterBindingsForCurrentProperty();
      this.initializePreviewValue();
    }
  }

  @Input() set property(value: TransformProperty | null) {
    this._property.set(value);
    // Re-filter bindings when property changes
    if (this._visible()) {
      this.filterBindingsForCurrentProperty();
      this.initializePreviewValue();
    }
  }

  /**
   * Initialize the preview input value based on the property type and default value
   */
  private initializePreviewValue(): void {
    const prop = this._property();
    if (!prop) {
      this._previewInputValue.set(50);
      return;
    }

    // Use the property's default value
    const defaultValue = prop.defaultValue;
    if (typeof defaultValue === 'number') {
      this._previewInputValue.set(defaultValue);
    } else if (typeof defaultValue === 'boolean') {
      // For boolean, use 1 for true, 0 for false
      this._previewInputValue.set(defaultValue ? 1 : 0);
    } else {
      // For string properties, use min value or 50
      this._previewInputValue.set(prop.min ?? 50);
    }
  }

  @Input() set existingBindings(value: PropertyBinding[]) {
    this._allBindings = value ?? [];
    // Re-filter bindings when new bindings are provided
    if (this._visible()) {
      this.filterBindingsForCurrentProperty();
    }
  }

  @Input() primitives: PrimitiveBase[] = [];
  @Input() symbolInstances: SymbolInstance[] = [];
  @Input() symbolDefinitions = new Map<string, SymbolDefinition>();

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<PropertyBinding[]>();

  // Store all bindings for filtering
  private _allBindings: PropertyBinding[] = [];

  // Internal state
  private _visible = signal(false);
  private _property = signal<TransformProperty | null>(null);
  private _bindings = signal<PropertyBinding[]>([]);
  private _expandedIndex = signal<number | null>(null);
  private _previewInputValue = signal(50);
  private _previewErrors = signal(new Map<number, boolean>());

  /**
   * Filter bindings for the current property
   */
  private filterBindingsForCurrentProperty(): void {
    const propertyId = this._property()?.id;
    if (propertyId) {
      const filtered = this._allBindings
        .filter(b => b.propertyId === propertyId)
        .map(b => ({ ...b }));
      this._bindings.set(filtered);
    } else {
      this._bindings.set([]);
    }
  }

  // Computed values
  visible = computed(() => this._visible());
  currentProperty = computed(() => this._property());
  bindings = computed(() => this._bindings());
  expandedIndex = computed(() => this._expandedIndex());
  previewInputValue = computed(() => this._previewInputValue());

  // Effect type groups for the dropdown
  readonly effectTypeGroups = [
    {
      name: 'Dimension',
      effects: [
        { value: 'dimension.width' as BindingEffectType, label: 'Width (px)' },
        { value: 'dimension.height' as BindingEffectType, label: 'Height (px)' }
      ]
    },
    {
      name: 'Transform',
      effects: [
        { value: 'transform.rotation' as BindingEffectType, label: 'Rotation' },
        { value: 'transform.offsetX' as BindingEffectType, label: 'Offset X' },
        { value: 'transform.offsetY' as BindingEffectType, label: 'Offset Y' },
        { value: 'transform.scale' as BindingEffectType, label: 'Scale (inkl. Border)' },
        { value: 'transform.scaleX' as BindingEffectType, label: 'Scale X (inkl. Border)' },
        { value: 'transform.scaleY' as BindingEffectType, label: 'Scale Y (inkl. Border)' }
      ]
    },
    {
      name: 'Style',
      effects: [
        { value: 'style.fill.color' as BindingEffectType, label: 'Fill Color' },
        { value: 'style.fill.opacity' as BindingEffectType, label: 'Fill Opacity' },
        { value: 'style.stroke.color' as BindingEffectType, label: 'Stroke Color' },
        { value: 'style.stroke.opacity' as BindingEffectType, label: 'Stroke Opacity' },
        { value: 'style.opacity' as BindingEffectType, label: 'Opacity' }
      ]
    },
    {
      name: 'Other',
      effects: [
        { value: 'visible' as BindingEffectType, label: 'Visibility' },
        { value: 'fillLevel' as BindingEffectType, label: 'Fill Level' },
        { value: 'property' as BindingEffectType, label: 'Pass to Child Property' }
      ]
    },
    {
      name: 'Animation',
      effects: [
        { value: 'animation.enabled' as BindingEffectType, label: 'Animation aktivieren/deaktivieren' }
      ]
    }
  ];

  // Anchor options for the 3x3 grid (ordered: top-left, top, top-right, left, center, right, bottom-left, bottom, bottom-right)
  readonly anchorOptions: { value: TransformAnchor; label: string }[] = [
    { value: 'top-left', label: 'Oben Links' },
    { value: 'top', label: 'Oben Mitte' },
    { value: 'top-right', label: 'Oben Rechts' },
    { value: 'left', label: 'Mitte Links' },
    { value: 'center', label: 'Mitte' },
    { value: 'right', label: 'Mitte Rechts' },
    { value: 'bottom-left', label: 'Unten Links' },
    { value: 'bottom', label: 'Unten Mitte' },
    { value: 'bottom-right', label: 'Unten Rechts' }
  ];

  // Effect types that support anchor configuration
  private readonly anchorSupportedEffects: BindingEffectType[] = [
    'transform.rotation',
    'transform.scale',
    'transform.scaleX',
    'transform.scaleY',
    'dimension.width',
    'dimension.height'
  ];

  // Computed target options
  primitiveTargets = computed<TargetOption[]>(() => {
    return this.primitives.map(p => ({
      id: p.id,
      name: p.name ?? `${p.type}-${p.id.substring(0, 6)}`,
      type: 'primitive' as BindingTargetType
    }));
  });

  symbolInstanceTargets = computed<TargetOption[]>(() => {
    return this.symbolInstances.map(s => ({
      id: s.id,
      name: s.name ?? `symbol-${s.id.substring(0, 6)}`,
      type: 'symbolInstance' as BindingTargetType
    }));
  });

  ngOnInit(): void {
    // Initialize with first binding expanded if any exist
    if (this._bindings().length > 0) {
      this._expandedIndex.set(0);
    }
  }

  /**
   * Get target name for display
   */
  getTargetName(binding: PropertyBinding): string {
    if (binding.targetType === 'primitive') {
      const primitive = this.primitives.find(p => p.id === binding.targetId);
      return primitive?.name ?? `Primitive ${binding.targetId.substring(0, 6)}`;
    } else {
      const instance = this.symbolInstances.find(s => s.id === binding.targetId);
      return instance?.name ?? `Symbol ${binding.targetId.substring(0, 6)}`;
    }
  }

  /**
   * Get effect type label
   */
  getEffectLabel(effectType: BindingEffectType): string {
    for (const group of this.effectTypeGroups) {
      const effect = group.effects.find(e => e.value === effectType);
      if (effect) {
        return effect.label;
      }
    }
    return effectType;
  }

  /**
   * Check if effect type supports anchor configuration
   */
  needsAnchor(effectType: BindingEffectType): boolean {
    return this.anchorSupportedEffects.includes(effectType);
  }

  /**
   * Get anchor label for display
   */
  getAnchorLabel(anchor?: TransformAnchor): string {
    const option = this.anchorOptions.find(a => a.value === (anchor ?? 'center'));
    return option?.label ?? 'Mitte';
  }

  /**
   * Get properties from a nested symbol instance
   */
  getSymbolInstanceProperties(targetId: string): TransformProperty[] {
    const instance = this.symbolInstances.find(s => s.id === targetId);
    if (!instance) return [];

    const definition = this.symbolDefinitions.get(instance.symbolRtId);
    return definition?.transformProperties ?? [];
  }

  /**
   * Get animations from a primitive target
   */
  getTargetAnimations(targetId: string): AnimationDefinition[] {
    const primitive = this.primitives.find(p => p.id === targetId);
    return primitive?.animations ?? [];
  }

  /**
   * Toggle expanded state for a binding
   */
  toggleExpanded(index: number): void {
    this._expandedIndex.set(this._expandedIndex() === index ? null : index);
  }

  /**
   * Add a new binding
   */
  addBinding(): void {
    const propertyId = this._property()?.id;
    if (!propertyId) return;

    // Determine the first available target (prefer primitives, fallback to symbol instances)
    const firstPrimitive = this.primitives[0];
    const firstSymbolInstance = this.symbolInstances[0];

    let targetId: string;
    let targetType: BindingTargetType;

    if (firstPrimitive) {
      targetId = firstPrimitive.id;
      targetType = 'primitive';
    } else if (firstSymbolInstance) {
      targetId = firstSymbolInstance.id;
      targetType = 'symbolInstance';
    } else {
      targetId = '';
      targetType = 'primitive';
    }

    const newBinding: PropertyBinding = {
      propertyId,
      targetType,
      targetId,
      effectType: 'dimension.width',
      expression: 'value'
    };

    this._bindings.update(bindings => [...bindings, newBinding]);
    this._expandedIndex.set(this._bindings().length - 1);
  }

  /**
   * Update a binding property
   */
  updateBinding(index: number, field: string, value: string): void {
    this._bindings.update(bindings => {
      const updated = [...bindings];
      const binding = { ...updated[index] };

      if (field === 'target') {
        // Parse target type and id from combined value
        const [type, id] = value.split(':');
        binding.targetType = type as BindingTargetType;
        binding.targetId = id;
      } else if (field === 'effectType') {
        binding.effectType = value as BindingEffectType;
      } else if (field === 'expression') {
        binding.expression = value;
      } else if (field === 'targetPropertyId') {
        binding.targetPropertyId = value;
      } else if (field === 'animationId') {
        binding.animationId = value;
      } else if (field === 'anchor') {
        binding.anchor = value as TransformAnchor;
      }

      updated[index] = binding;
      return updated;
    });
  }

  /**
   * Delete a binding
   */
  deleteBinding(index: number, event: Event): void {
    event.stopPropagation();
    this._bindings.update(bindings => bindings.filter((_, i) => i !== index));
    if (this._expandedIndex() === index) {
      this._expandedIndex.set(null);
    } else if (this._expandedIndex() !== null && this._expandedIndex()! > index) {
      this._expandedIndex.update(i => (i !== null ? i - 1 : null));
    }
  }

  /**
   * Set preview input value
   */
  setPreviewInput(value: number): void {
    this._previewInputValue.set(value);
  }

  /**
   * Get preview output for an expression
   */
  getPreviewOutput(expression: string): string {
    const result = this.expressionEvaluator.evaluate(expression, {
      value: this._previewInputValue()
    });

    if (result.success) {
      const value = result.value;
      if (typeof value === 'number') {
        return value.toFixed(2);
      }
      return String(value);
    }

    return `Error: ${result.error}`;
  }

  /**
   * Check if preview has error
   */
  previewError(index: number): boolean {
    const binding = this._bindings()[index];
    if (!binding) return false;

    const result = this.expressionEvaluator.evaluate(binding.expression, {
      value: this._previewInputValue()
    });

    return !result.success;
  }

  /**
   * Close the dialog
   */
  close(): void {
    this._visible.set(false);
    this.closed.emit();
  }

  /**
   * Save bindings and close
   */
  save(): void {
    const propertyId = this._property()?.id;
    const currentBindings = this._bindings();

    // Merge: keep bindings for other properties, replace bindings for this property
    const otherBindings = this._allBindings.filter(b => b.propertyId !== propertyId);
    const mergedBindings = [...otherBindings, ...currentBindings];

    this.saved.emit(mergedBindings);
    this._visible.set(false);
  }
}
