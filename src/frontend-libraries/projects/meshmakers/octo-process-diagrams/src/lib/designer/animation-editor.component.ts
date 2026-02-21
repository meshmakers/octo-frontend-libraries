/**
 * Animation Editor Component
 *
 * Provides UI for creating and editing SVG animations on primitives.
 * Supports presets for quick setup and custom configuration.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { IconsModule } from '@progress/kendo-angular-icons';
import {
  plusIcon,
  trashIcon,
  pencilIcon,
  arrowRotateCcwIcon
} from '@progress/kendo-svg-icons';

import {
  AnimationDefinition,
  SVGAnimation,
  AttributeAnimation,
  TransformAnimation,
  ANIMATION_PRESETS,
  getPresetsGrouped,
  createAnimationDefinition,
  AnimationAnchor
} from '../primitives/models/animation.models';
import { TransformProperty } from '../primitives/models/transform-property.models';

/**
 * Event emitted when animations change
 */
export interface AnimationChangeEvent {
  primitiveId: string;
  animations: AnimationDefinition[];
}

/**
 * Animation type options for dropdown
 */
interface AnimationTypeOption {
  value: 'animate' | 'animateTransform' | 'animateMotion' | 'flowParticles';
  label: string;
}

/**
 * Transform type options for dropdown
 */
interface TransformTypeOption {
  value: 'rotate' | 'scale' | 'translate' | 'skewX' | 'skewY';
  label: string;
}

/**
 * Preset group for UI
 */
interface PresetGroup {
  name: string;
  presets: { key: string; name: string; description: string }[];
}

@Component({
  selector: 'mm-animation-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonsModule,
    InputsModule,
    DropDownsModule,
    IconsModule
  ],
  template: `
    <div class="animation-editor">
      <!-- Toolbar -->
      <div class="editor-toolbar">
        <button class="add-button"
                kendoButton
                look="flat"
                size="small"
                [svgIcon]="plusIcon"
                title="Add Animation"
                data-testid="add-animation-button"
                (click)="onAddClick($event)">
          Add
        </button>
      </div>

      <div class="section-content">
          <!-- No animations message -->
          @if (animations.length === 0) {
            <div class="empty-state">
              <p>No animations defined.</p>
              <button kendoButton look="outline" size="small" (click)="showPresetPicker()">
                Add from Preset
              </button>
            </div>
          }

          <!-- Animation list -->
          @for (anim of animations; track anim.id; let i = $index) {
            <div class="animation-item"
                 [class.expanded]="editingAnimationId() === anim.id"
                 [attr.data-testid]="'animation-item-' + i">
              <div class="item-header" (click)="toggleAnimationExpand(anim.id)">
                <span class="item-icon">{{ getAnimationIcon(anim) }}</span>
                <span class="item-name">{{ anim.name || getAnimationTypeName(anim) }}</span>
                <span class="item-info">{{ getAnimationInfo(anim) }}</span>
                <div class="item-actions">
                  <button kendoButton look="flat" size="small"
                          [svgIcon]="pencilIcon"
                          title="Edit"
                          (click)="onEditClick($event, anim)">
                  </button>
                  <button kendoButton look="flat" size="small"
                          [svgIcon]="trashIcon"
                          title="Delete"
                          (click)="onDeleteClick($event, i)">
                  </button>
                </div>
              </div>

              <!-- Expanded edit form -->
              @if (editingAnimationId() === anim.id) {
                <div class="item-edit-form">
                  <!-- Name -->
                  <div class="form-row">
                    <label>Name</label>
                    <input kendoTextBox
                           [value]="anim.name ?? ''"
                           (input)="updateAnimationField(i, 'name', $any($event.target).value)"/>
                  </div>

                  <!-- Animation Type -->
                  <div class="form-row">
                    <label>Type</label>
                    <kendo-dropdownlist
                      [data]="animationTypes"
                      [value]="getAnimationType(anim)"
                      textField="label"
                      valueField="value"
                      (valueChange)="onAnimationTypeChange(i, $event)">
                    </kendo-dropdownlist>
                  </div>

                  <!-- Type-specific fields -->
                  @switch (anim.animation.type) {
                    @case ('animate') {
                      <div class="form-row">
                        <label>Attribute</label>
                        <kendo-dropdownlist
                          [data]="attributeOptions"
                          [value]="$any(anim.animation).attributeName"
                          (valueChange)="updateAnimationProp(i, 'attributeName', $event)">
                        </kendo-dropdownlist>
                      </div>
                    }
                    @case ('animateTransform') {
                      <div class="form-row">
                        <label>Transform</label>
                        <kendo-dropdownlist
                          [data]="transformTypes"
                          [value]="getTransformType(anim)"
                          textField="label"
                          valueField="value"
                          (valueChange)="onTransformTypeChange(i, $event)">
                        </kendo-dropdownlist>
                      </div>
                    }
                    @case ('animateMotion') {
                      <div class="form-row">
                        <label>Path</label>
                        <textarea class="path-textarea"
                               [value]="$any(anim.animation).path ?? ''"
                               rows="3"
                               placeholder="M 0,0 L 100,0"
                               (input)="updateAnimationProp(i, 'path', $any($event.target).value)"></textarea>
                      </div>

                      <!-- Path Preview -->
                      @if ($any(anim.animation).path) {
                        <div class="path-preview">
                          <svg viewBox="-10 -60 220 120" class="motion-path-preview">
                            <path
                              [attr.d]="$any(anim.animation).path"
                              fill="none"
                              stroke="#1976d2"
                              stroke-width="2"
                              stroke-dasharray="4 2"/>
                            <!-- Start marker (green dot at path start) -->
                            <circle cx="0" cy="0" r="4" fill="#4caf50">
                              <animateMotion dur="0.01s" fill="freeze" [attr.path]="$any(anim.animation).path" keyPoints="0;0" keyTimes="0;1"/>
                            </circle>
                            <!-- End marker (red dot at path end) -->
                            <circle cx="0" cy="0" r="4" fill="#f44336">
                              <animateMotion dur="0.01s" fill="freeze" [attr.path]="$any(anim.animation).path" keyPoints="1;1" keyTimes="0;1"/>
                            </circle>
                          </svg>
                        </div>
                      }

                      <!-- Use Existing Path -->
                      @if (availablePaths.length > 0) {
                        <div class="form-row">
                          <label>Use Path From</label>
                          <select class="path-select" (change)="onSelectPathPrimitive(i, $any($event.target).value)">
                            <option value="">Select primitive...</option>
                            @for (prim of availablePaths; track prim.id) {
                              <option [value]="prim.id">{{ prim.name }}</option>
                            }
                          </select>
                        </div>
                      }

                      <div class="form-row">
                        <label>Rotation</label>
                        <kendo-dropdownlist
                          [data]="rotateOptions"
                          [value]="$any(anim.animation).rotate ?? 'auto'"
                          (valueChange)="updateAnimationProp(i, 'rotate', $event)">
                        </kendo-dropdownlist>
                      </div>
                    }
                    @case ('flowParticles') {
                      <div class="flow-particles-hint">
                        <span class="hint-icon">💡</span>
                        <span>Diese Animation auf einem Pfad, Linie oder Polyline anwenden</span>
                      </div>

                      <div class="form-row-group">
                        <div class="form-row half">
                          <label>Anzahl Partikel</label>
                          <kendo-numerictextbox
                            [value]="$any(anim.animation).particleCount ?? 5"
                            [min]="1"
                            [max]="20"
                            [step]="1"
                            [format]="'n0'"
                            (valueChange)="updateAnimationProp(i, 'particleCount', $event)">
                          </kendo-numerictextbox>
                        </div>
                        <div class="form-row half">
                          <label>Partikel Radius</label>
                          <div class="input-with-unit">
                            <kendo-numerictextbox
                              [value]="$any(anim.animation).particleRadius ?? 4"
                              [min]="1"
                              [max]="20"
                              [step]="1"
                              [format]="'n0'"
                              (valueChange)="updateAnimationProp(i, 'particleRadius', $event)">
                            </kendo-numerictextbox>
                            <span class="unit">px</span>
                          </div>
                        </div>
                      </div>

                      <div class="form-row">
                        <label>Partikel Farbe</label>
                        <input type="color"
                               class="color-input"
                               [value]="$any(anim.animation).particleColor ?? '#ffffff'"
                               (input)="updateAnimationProp(i, 'particleColor', $any($event.target).value)"/>
                        <span class="color-hint">(Leer = Strichfarbe)</span>
                      </div>
                    }
                  }

                  <!-- Timing -->
                  <div class="form-row-group">
                    <div class="form-row half">
                      <label>Duration</label>
                      <div class="input-with-unit">
                        <kendo-numerictextbox
                          [value]="parseDurationValue(anim.animation.dur)"
                          [min]="0.1"
                          [step]="0.1"
                          [format]="'n1'"
                          (valueChange)="updateDuration(i, $event)">
                        </kendo-numerictextbox>
                        <span class="unit">s</span>
                      </div>
                    </div>
                    <div class="form-row half">
                      <label>Repeat</label>
                      <kendo-dropdownlist
                        [data]="repeatOptions"
                        [value]="anim.animation.repeatCount ?? 'indefinite'"
                        (valueChange)="updateAnimationProp(i, 'repeatCount', $event)">
                      </kendo-dropdownlist>
                    </div>
                  </div>

                  <!-- Values (from/to or values) - only for animate and animateTransform -->
                  @if (anim.animation.type === 'animate' || anim.animation.type === 'animateTransform') {
                    <div class="form-row-group">
                      <div class="form-row half">
                        <label>From</label>
                        <input kendoTextBox
                               [value]="$any(anim.animation).from ?? ''"
                               (input)="updateAnimationProp(i, 'from', $any($event.target).value)"/>
                      </div>
                      <div class="form-row half">
                        <label>To</label>
                        <input kendoTextBox
                               [value]="$any(anim.animation).to ?? ''"
                               (input)="updateAnimationProp(i, 'to', $any($event.target).value)"/>
                      </div>
                    </div>
                  }

                  <!-- Anchor (for rotation) -->
                  @if (anim.animation.type === 'animateTransform' && $any(anim.animation).transformType === 'rotate') {
                    <div class="form-row">
                      <label>Pivot Point</label>
                      <div class="anchor-grid">
                        @for (anchor of anchorOptions; track anchor) {
                          <button class="anchor-point"
                                  [class.selected]="(anim.anchor ?? 'center') === anchor"
                                  [title]="getAnchorLabel(anchor)"
                                  (click)="updateAnimationField(i, 'anchor', anchor)">
                            <span class="anchor-dot"></span>
                          </button>
                        }
                      </div>
                    </div>
                  }

                  <!-- Property Link Hint -->
                  @if (availableProperties.length > 0) {
                    <div class="form-row hint-row">
                      <span class="hint-text">
                        💡 Tipp: Verwenden Sie den Data Binding Dialog bei der Transform Property,
                        um diese Animation per Expression zu steuern.
                      </span>
                    </div>
                  }
                </div>
              }
            </div>
          }

          <!-- Preset picker -->
          @if (showingPresetPicker()) {
            <div class="preset-picker">
              <div class="preset-header">
                <span>Choose Preset</span>
                <button kendoButton look="flat" size="small" (click)="hidePresetPicker()">Cancel</button>
              </div>
              <div class="preset-groups">
                @for (group of presetGroups; track group.name) {
                  <div class="preset-group">
                    <div class="group-name">{{ group.name }}</div>
                    <div class="group-presets">
                      @for (preset of group.presets; track preset.key) {
                        <button class="preset-button"
                                [title]="preset.description"
                                (click)="addFromPreset(preset.key)">
                          {{ preset.name }}
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>
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

    .animation-editor {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      background: #fafafa;
    }

    .editor-toolbar {
      flex-shrink: 0;
      display: flex;
      justify-content: flex-end;
      padding: 0.5rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .section-content {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 0.5rem;
    }

    .empty-state {
      text-align: center;
      padding: 1rem;
      color: #666;
    }

    .empty-state p {
      margin: 0 0 0.5rem 0;
      font-size: 12px;
    }

    /* Animation Item */
    .animation-item {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }

    .animation-item:last-child {
      margin-bottom: 0;
    }

    .item-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      cursor: pointer;
    }

    .item-header:hover {
      background: #f5f5f5;
    }

    .item-icon {
      font-size: 14px;
    }

    .item-name {
      font-size: 12px;
      font-weight: 500;
      flex: 1;
    }

    .item-info {
      font-size: 11px;
      color: #666;
    }

    .item-actions {
      display: flex;
      gap: 0.25rem;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .item-header:hover .item-actions {
      opacity: 1;
    }

    /* Edit Form */
    .item-edit-form {
      padding: 0.75rem;
      border-top: 1px solid #e0e0e0;
      background: #fafafa;
    }

    .form-row {
      margin-bottom: 0.75rem;
    }

    .form-row:last-child {
      margin-bottom: 0;
    }

    .form-row label {
      display: block;
      font-size: 11px;
      color: #666;
      margin-bottom: 0.25rem;
    }

    .form-row input[type="checkbox"] {
      margin-right: 0.5rem;
    }

    .form-row-group {
      display: flex;
      gap: 0.5rem;
    }

    .form-row.half {
      flex: 1;
    }

    .form-row.hint-row {
      background: #e3f2fd;
      padding: 0.5rem;
      border-radius: 4px;
      margin-top: 0.5rem;
    }

    .hint-text {
      font-size: 11px;
      color: #1565c0;
      line-height: 1.4;
    }

    .input-with-unit {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .input-with-unit .unit {
      font-size: 11px;
      color: #666;
    }

    /* Anchor Grid */
    .anchor-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      width: 72px;
    }

    .anchor-point {
      width: 20px;
      height: 20px;
      border: 1px solid #ccc;
      border-radius: 2px;
      background: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }

    .anchor-point:hover {
      border-color: #1976d2;
    }

    .anchor-point.selected {
      border-color: #1976d2;
      background: #e3f2fd;
    }

    .anchor-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #666;
    }

    .anchor-point.selected .anchor-dot {
      background: #1976d2;
    }

    /* Preset Picker */
    .preset-picker {
      background: #fff;
      border: 1px solid #1976d2;
      border-radius: 4px;
      margin-top: 0.5rem;
    }

    .preset-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem;
      background: #e3f2fd;
      border-bottom: 1px solid #1976d2;
      font-size: 12px;
      font-weight: 500;
    }

    .preset-groups {
      padding: 0.5rem;
      max-height: 200px;
      overflow-y: auto;
    }

    .preset-group {
      margin-bottom: 0.75rem;
    }

    .preset-group:last-child {
      margin-bottom: 0;
    }

    .group-name {
      font-size: 10px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 0.25rem;
    }

    .group-presets {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }

    .preset-button {
      font-size: 11px;
      padding: 0.25rem 0.5rem;
      border: 1px solid #e0e0e0;
      border-radius: 3px;
      background: #fff;
      cursor: pointer;
    }

    .preset-button:hover {
      border-color: #1976d2;
      background: #e3f2fd;
    }

    /* Path Preview for Motion */
    .path-textarea {
      width: 100%;
      min-height: 60px;
      font-family: monospace;
      font-size: 11px;
      padding: 0.5rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      resize: vertical;
      line-height: 1.4;
      box-sizing: border-box;
    }

    .path-preview {
      margin: 0.5rem 0;
    }

    .motion-path-preview {
      width: 100%;
      height: 60px;
      background: #f5f5f5;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }

    .path-select {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 12px;
      background: #fff;
    }

    /* Flow Particles UI */
    .flow-particles-hint {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      background: #e8f5e9;
      border-radius: 4px;
      margin-bottom: 0.75rem;
      font-size: 11px;
      color: #2e7d32;
    }

    .hint-icon {
      font-size: 14px;
    }

    .color-input {
      width: 40px;
      height: 24px;
      border: 1px solid #ccc;
      border-radius: 4px;
      cursor: pointer;
      padding: 0;
    }

    .color-hint {
      font-size: 10px;
      color: #666;
      margin-left: 0.5rem;
    }

    /* Kendo overrides */
    :host ::ng-deep .k-dropdownlist,
    :host ::ng-deep .k-textbox,
    :host ::ng-deep .k-numerictextbox {
      width: 100%;
    }

    :host ::ng-deep .k-input-sm {
      font-size: 12px;
    }
  `]
})
export class AnimationEditorComponent {
  // Icons
  protected readonly plusIcon = plusIcon;
  protected readonly trashIcon = trashIcon;
  protected readonly pencilIcon = pencilIcon;
  protected readonly resetIcon = arrowRotateCcwIcon;

  /** The primitive ID being edited */
  @Input() primitiveId = '';

  /** Current animations on the primitive */
  @Input() animations: AnimationDefinition[] = [];

  /** Available transform properties for linking */
  @Input() availableProperties: TransformProperty[] = [];

  /** Available path primitives for motion path animation */
  @Input() availablePaths: { id: string; name: string; pathData: string }[] = [];

  /** Emitted when animations change */
  @Output() animationsChange = new EventEmitter<AnimationChangeEvent>();

  // State
  private _editingAnimationId = signal<string | null>(null);
  private _showingPresetPicker = signal(false);

  // Computed
  editingAnimationId = computed(() => this._editingAnimationId());
  showingPresetPicker = computed(() => this._showingPresetPicker());

  // Options
  animationTypes: AnimationTypeOption[] = [
    { value: 'animate', label: 'Attribute Animation' },
    { value: 'animateTransform', label: 'Transform Animation' },
    { value: 'animateMotion', label: 'Motion Path' },
    { value: 'flowParticles', label: 'Flow Particles' }
  ];

  transformTypes: TransformTypeOption[] = [
    { value: 'rotate', label: 'Rotate' },
    { value: 'scale', label: 'Scale' },
    { value: 'translate', label: 'Translate' },
    { value: 'skewX', label: 'Skew X' },
    { value: 'skewY', label: 'Skew Y' }
  ];

  attributeOptions = [
    'opacity',
    'fill',
    'fill-opacity',
    'stroke',
    'stroke-opacity',
    'stroke-width',
    'stroke-dashoffset',
    'r', 'rx', 'ry',
    'width', 'height',
    'x', 'y'
  ];

  repeatOptions = ['indefinite', '1', '2', '3', '5', '10'];

  rotateOptions = ['auto', 'auto-reverse', '0'];

  conditionOptions = [
    { text: 'is true', value: true },
    { text: 'is false', value: false },
    { text: '> 0', value: '> 0' },
    { text: '>= 50', value: '>= 50' }
  ];

  anchorOptions: AnimationAnchor[] = [
    'top-left', 'top', 'top-right',
    'left', 'center', 'right',
    'bottom-left', 'bottom', 'bottom-right'
  ];

  presetGroups: PresetGroup[] = [];

  constructor() {
    // Build preset groups
    const grouped = getPresetsGrouped();
    this.presetGroups = Object.entries(grouped).map(([name, presets]) => ({
      name,
      presets
    }));
  }

  toggleAnimationExpand(animId: string): void {
    if (this._editingAnimationId() === animId) {
      this._editingAnimationId.set(null);
    } else {
      this._editingAnimationId.set(animId);
    }
  }

  onAddClick(event: Event): void {
    event.stopPropagation();
    this.showPresetPicker();
  }

  onEditClick(event: Event, anim: AnimationDefinition): void {
    event.stopPropagation();
    this._editingAnimationId.set(anim.id);
  }

  onDeleteClick(event: Event, index: number): void {
    event.stopPropagation();
    const newAnimations = [...this.animations];
    newAnimations.splice(index, 1);
    this.emitChange(newAnimations);
  }

  showPresetPicker(): void {
    this._showingPresetPicker.set(true);
  }

  hidePresetPicker(): void {
    this._showingPresetPicker.set(false);
  }

  addFromPreset(presetKey: string): void {
    const preset = ANIMATION_PRESETS[presetKey];
    if (!preset) return;

    const id = `anim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newAnim = createAnimationDefinition(id, { ...preset.animation }, {
      name: preset.name
    });

    const newAnimations = [...this.animations, newAnim];
    this.emitChange(newAnimations);
    this._showingPresetPicker.set(false);
    this._editingAnimationId.set(id);
  }

  getAnimationType(anim: AnimationDefinition): AnimationTypeOption {
    return this.animationTypes.find(t => t.value === anim.animation.type) ?? this.animationTypes[0];
  }

  getTransformType(anim: AnimationDefinition): TransformTypeOption {
    if (anim.animation.type === 'animateTransform') {
      const tt = (anim.animation as TransformAnimation).transformType;
      return this.transformTypes.find(t => t.value === tt) ?? this.transformTypes[0];
    }
    return this.transformTypes[0];
  }

  onAnimationTypeChange(index: number, option: AnimationTypeOption): void {
    const anim = this.animations[index];
    let newAnimation: SVGAnimation;

    switch (option.value) {
      case 'animate':
        newAnimation = {
          type: 'animate',
          attributeName: 'opacity',
          from: '1',
          to: '0',
          dur: anim.animation.dur,
          repeatCount: anim.animation.repeatCount
        };
        break;
      case 'animateTransform':
        newAnimation = {
          type: 'animateTransform',
          transformType: 'rotate',
          from: '0',
          to: '360',
          dur: anim.animation.dur,
          repeatCount: anim.animation.repeatCount
        };
        break;
      case 'animateMotion':
        newAnimation = {
          type: 'animateMotion',
          path: 'M 0 0 L 100 0',
          dur: anim.animation.dur,
          repeatCount: anim.animation.repeatCount
        };
        break;
      case 'flowParticles':
        newAnimation = {
          type: 'flowParticles',
          particleCount: 5,
          particleRadius: 4,
          dur: anim.animation.dur,
          repeatCount: anim.animation.repeatCount
        };
        break;
      default:
        return;
    }

    this.updateAnimation(index, { ...anim, animation: newAnimation });
  }

  onTransformTypeChange(index: number, option: TransformTypeOption): void {
    const anim = this.animations[index];
    if (anim.animation.type !== 'animateTransform') return;

    const updated: TransformAnimation = {
      ...anim.animation as TransformAnimation,
      transformType: option.value
    };

    // Reset from/to values based on transform type
    switch (option.value) {
      case 'rotate':
        updated.from = '0';
        updated.to = '360';
        break;
      case 'scale':
        updated.from = '1';
        updated.to = '1.2';
        break;
      case 'translate':
        updated.from = '0,0';
        updated.to = '10,0';
        break;
      case 'skewX':
      case 'skewY':
        updated.from = '0';
        updated.to = '10';
        break;
    }

    this.updateAnimation(index, { ...anim, animation: updated });
  }

  updateAnimationField(index: number, field: string, value: unknown): void {
    const anim = this.animations[index];
    this.updateAnimation(index, { ...anim, [field]: value });
  }

  updateAnimationProp(index: number, prop: string, value: unknown): void {
    const anim = this.animations[index];
    const updatedAnimation = { ...anim.animation, [prop]: value };
    this.updateAnimation(index, { ...anim, animation: updatedAnimation as SVGAnimation });
  }

  updateDuration(index: number, seconds: number): void {
    this.updateAnimationProp(index, 'dur', `${seconds}s`);
  }

  /**
   * Handle selection of a path primitive for motion animation
   */
  onSelectPathPrimitive(index: number, primitiveId: string): void {
    if (!primitiveId) return;

    const pathPrimitive = this.availablePaths.find(p => p.id === primitiveId);
    if (pathPrimitive?.pathData) {
      this.updateAnimationProp(index, 'path', pathPrimitive.pathData);
    }
  }

  togglePropertyLink(index: number, enabled: boolean): void {
    const anim = this.animations[index];
    if (enabled && this.availableProperties.length > 0) {
      this.updateAnimation(index, {
        ...anim,
        enabledByProperty: this.availableProperties[0].id,
        enableCondition: true
      });
    } else {
      const { enabledByProperty, enableCondition, ...rest } = anim;
      this.updateAnimation(index, rest as AnimationDefinition);
    }
  }

  private updateAnimation(index: number, anim: AnimationDefinition): void {
    const newAnimations = [...this.animations];
    newAnimations[index] = anim;
    this.emitChange(newAnimations);
  }

  private emitChange(animations: AnimationDefinition[]): void {
    this.animationsChange.emit({
      primitiveId: this.primitiveId,
      animations
    });
  }

  // Helper methods for display
  getAnimationIcon(anim: AnimationDefinition): string {
    switch (anim.animation.type) {
      case 'animate': return '◐';
      case 'animateTransform': return '↻';
      case 'animateMotion': return '→';
      case 'flowParticles': return '●';
      default: return '?';
    }
  }

  getAnimationTypeName(anim: AnimationDefinition): string {
    switch (anim.animation.type) {
      case 'animate':
        return `Animate ${(anim.animation as AttributeAnimation).attributeName}`;
      case 'animateTransform':
        return `${(anim.animation as TransformAnimation).transformType}`;
      case 'animateMotion':
        return 'Motion Path';
      case 'flowParticles':
        return 'Flow Particles';
      default:
        return 'Animation';
    }
  }

  getAnimationInfo(anim: AnimationDefinition): string {
    const dur = anim.animation.dur;
    const repeat = anim.animation.repeatCount === 'indefinite' ? '∞' : `×${anim.animation.repeatCount ?? 1}`;
    return `${dur} ${repeat}`;
  }

  getAnchorLabel(anchor: AnimationAnchor): string {
    const labels: Record<AnimationAnchor, string> = {
      'center': 'Center',
      'top-left': 'Top Left',
      'top': 'Top',
      'top-right': 'Top Right',
      'left': 'Left',
      'right': 'Right',
      'bottom-left': 'Bottom Left',
      'bottom': 'Bottom',
      'bottom-right': 'Bottom Right',
      'custom': 'Custom'
    };
    return labels[anchor] ?? anchor;
  }

  parseDurationValue(dur: string): number {
    const match = dur.match(/^([\d.]+)(ms|s)?$/);
    if (!match) return 1;
    const value = parseFloat(match[1]);
    const unit = match[2] || 's';
    return unit === 'ms' ? value / 1000 : value;
  }
}
