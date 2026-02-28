import { Component, ChangeDetectionStrategy, ChangeDetectorRef, signal, effect, inject, Signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { DockviewApi } from 'dockview-core';
import { IDockviewPanelProps, DockviewPanelApi } from '../dockview/dockview.component';
import { StyleClass, createStyleClass } from '../../primitives';

/**
 * Styles panel for symbol editing within dockview.
 * Displays and manages style classes that can be applied to primitives.
 *
 * Features:
 * - List of style classes with color preview swatches
 * - Add/Edit/Delete style classes
 * - Drag to apply style to selected elements
 * - Click to select and edit style properties
 */
@Component({
  selector: 'mm-styles-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, InputsModule, ButtonsModule, DecimalPipe],
  template: `
    <div class="panel-container">
      <div class="panel-toolbar">
        <button class="add-button" (click)="addStyle()">+ Add Style</button>
      </div>

      <div class="style-list">
        @for (styleClass of styleClasses; track styleClass.id) {
          <div class="style-item"
               [class.selected]="selectedStyleId === styleClass.id"
               draggable="true"
               (dragstart)="onDragStart($event, styleClass)"
               (click)="selectStyle(styleClass)">
            <div class="style-preview">
              <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet">
                <rect x="2" y="2" width="20" height="20" rx="2"
                      [attr.fill]="styleClass.style.fill?.color || '#cccccc'"
                      [attr.stroke]="styleClass.style.stroke?.color || '#333333'"
                      [attr.stroke-width]="styleClass.style.stroke?.width || 1"
                      [attr.fill-opacity]="styleClass.style.fill?.opacity ?? 1"
                      [attr.stroke-opacity]="styleClass.style.stroke?.opacity ?? 1"
                      [attr.stroke-dasharray]="getDashArrayString(styleClass.style.stroke?.dashArray)"/>
              </svg>
            </div>
            <span class="style-name">{{ styleClass.name }}</span>
            <button class="delete-button" (click)="deleteStyle(styleClass); $event.stopPropagation()" title="Delete style">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        } @empty {
          <div class="empty-state">
            <p>No styles defined</p>
            <p class="hint">Add styles to reuse across elements</p>
          </div>
        }
      </div>

      <!-- Style Editor (shown when a style is selected) -->
      @if (selectedStyle) {
        <div class="style-editor">
          <div class="editor-section">
            <h4>Style Properties</h4>

            <div class="form-group">
              <label>Name</label>
              <input type="text"
                     [value]="selectedStyle!.name"
                     (change)="updateStyleProperty('name', $any($event.target).value)"/>
            </div>

            <div class="form-group">
              <label>Fill Color</label>
              <div class="color-row">
                <input type="color"
                       [value]="selectedStyle!.style.fill?.color || '#cccccc'"
                       (change)="updateStyleProperty('fill.color', $any($event.target).value)"/>
                <input type="range"
                       class="opacity-slider"
                       [value]="(selectedStyle!.style.fill?.opacity ?? 1) * 100"
                       min="0"
                       max="100"
                       (input)="updateStyleProperty('fill.opacity', +$any($event.target).value / 100)"/>
                <span class="opacity-value">{{ ((selectedStyle!.style.fill?.opacity ?? 1) * 100) | number:'1.0-0' }}%</span>
              </div>
            </div>

            <div class="form-group">
              <label>Stroke Color</label>
              <div class="color-row">
                <input type="color"
                       [value]="selectedStyle!.style.stroke?.color || '#333333'"
                       (change)="updateStyleProperty('stroke.color', $any($event.target).value)"/>
                <input type="range"
                       class="opacity-slider"
                       [value]="(selectedStyle!.style.stroke?.opacity ?? 1) * 100"
                       min="0"
                       max="100"
                       (input)="updateStyleProperty('stroke.opacity', +$any($event.target).value / 100)"/>
                <span class="opacity-value">{{ ((selectedStyle!.style.stroke?.opacity ?? 1) * 100) | number:'1.0-0' }}%</span>
              </div>
            </div>

            <div class="form-group">
              <label>Stroke Width</label>
              <input type="number"
                     [value]="selectedStyle!.style.stroke?.width ?? 1"
                     min="0"
                     max="20"
                     step="0.5"
                     (change)="updateStyleProperty('stroke.width', +$any($event.target).value)"/>
            </div>

            <div class="form-group">
              <label>Line Type</label>
              <div class="line-type-row">
                <select class="line-type-select"
                        [value]="getLineType(selectedStyle!.style.stroke?.dashArray)"
                        (change)="onLineTypeChange($any($event.target).value)">
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                  <option value="dash-dot">Dash-Dot</option>
                  <option value="long-dash">Long Dash</option>
                </select>
                <svg class="line-preview" viewBox="0 0 50 10" preserveAspectRatio="xMidYMid meet">
                  <line x1="0" y1="5" x2="50" y2="5"
                        [attr.stroke]="selectedStyle!.style.stroke?.color ?? '#333'"
                        stroke-width="2"
                        [attr.stroke-dasharray]="getDashArrayString(selectedStyle!.style.stroke?.dashArray)"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      }

      <div class="panel-footer">
        <p class="hint">Drag a style onto selected elements to apply</p>
      </div>
    </div>
  `,
  styles: [`
    :host {
      /* Panel CSS Variables - can be overridden by host application */
      --panel-bg: var(--designer-panel-bg, #fff);
      --panel-bg-elevated: var(--designer-panel-bg-elevated, #fafafa);
      --panel-border: var(--designer-panel-border, #e0e0e0);
      --panel-text: var(--designer-panel-text, #333);
      --panel-text-secondary: var(--designer-panel-text-secondary, #666);
      --panel-text-muted: var(--designer-panel-text-muted, #999);
      --panel-accent: var(--designer-panel-accent, #1976d2);
      --panel-accent-hover-bg: var(--designer-panel-accent-hover-bg, #e3f2fd);
      --panel-input-bg: var(--designer-panel-input-bg, #fff);
      --panel-delete-hover-bg: var(--designer-panel-delete-hover-bg, #ffebee);
      --panel-delete-color: var(--designer-panel-delete-color, #d32f2f);
    }

    .panel-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow-y: auto;
      background: var(--panel-bg);
    }

    .panel-toolbar {
      display: flex;
      padding: 0.5rem;
      border-bottom: 1px solid var(--panel-border);
      flex-shrink: 0;
    }

    .add-button {
      flex: 1;
      padding: 0.375rem 0.75rem;
      font-size: 12px;
      border: 1px dashed var(--panel-border);
      background: var(--panel-bg-elevated);
      border-radius: 4px;
      cursor: pointer;
      color: var(--panel-text-secondary);
      transition: all 0.15s ease;

      &:hover {
        border-color: var(--panel-accent);
        background: var(--panel-accent-hover-bg);
        color: var(--panel-accent);
      }
    }

    .style-list {
      flex: 0 0 auto;
      padding: 0.5rem;
    }

    .style-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.5rem;
      border: 1px solid var(--panel-border);
      border-radius: 4px;
      margin-bottom: 0.375rem;
      cursor: grab;
      background: var(--panel-bg);
      transition: all 0.15s ease;

      &:hover {
        border-color: var(--panel-accent);
        background: var(--panel-bg-elevated);
      }

      &.selected {
        border-color: var(--panel-accent);
        background: var(--panel-accent-hover-bg);
      }

      &:active {
        cursor: grabbing;
      }
    }

    .style-preview {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      border-radius: 3px;
      overflow: hidden;
      background: repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 50% / 8px 8px;

      svg {
        display: block;
        width: 100%;
        height: 100%;
      }
    }

    .style-name {
      flex: 1;
      font-size: 12px;
      color: var(--panel-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .delete-button {
      width: 20px;
      height: 20px;
      padding: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      color: var(--panel-text-muted);
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.5;
      transition: all 0.15s ease;

      &:hover {
        background: var(--panel-delete-hover-bg);
        color: var(--panel-delete-color);
        opacity: 1;
      }
    }

    .empty-state {
      padding: 1.5rem 1rem;
      text-align: center;
      color: var(--panel-text-muted);

      p {
        margin: 0;
        font-size: 12px;
      }

      .hint {
        margin-top: 0.25rem;
        font-size: 11px;
      }
    }

    .style-editor {
      border-top: 1px solid var(--panel-border);
      padding: 0.5rem;
      background: var(--panel-bg-elevated);
    }

    .editor-section {
      h4 {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--panel-text-secondary);
        margin: 0 0 0.5rem;
        letter-spacing: 0.5px;
      }
    }

    .form-group {
      margin-bottom: 0.5rem;

      label {
        display: block;
        font-size: 11px;
        color: var(--panel-text-secondary);
        margin-bottom: 0.25rem;
      }

      input[type="text"] {
        width: 150px;
        padding: 0.25rem 0.5rem;
        border: 1px solid var(--panel-border);
        border-radius: 4px;
        font-size: 12px;
        background: var(--panel-input-bg);
        color: var(--panel-text);

        &:focus {
          outline: none;
          border-color: var(--panel-accent);
        }
      }

      input[type="number"] {
        width: 80px;
        padding: 0.25rem 0.5rem;
        border: 1px solid var(--panel-border);
        border-radius: 4px;
        font-size: 12px;
        background: var(--panel-input-bg);
        color: var(--panel-text);

        &:focus {
          outline: none;
          border-color: var(--panel-accent);
        }
      }
    }

    .color-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      input[type="color"] {
        width: 32px;
        height: 24px;
        padding: 2px;
        border: 1px solid var(--panel-border);
        border-radius: 4px;
        cursor: pointer;
      }
    }

    .opacity-slider {
      flex: 1;
      height: 4px;
      -webkit-appearance: none;
      appearance: none;
      background: linear-gradient(to right, transparent, var(--panel-accent));
      border-radius: 2px;
      cursor: pointer;

      &::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--panel-accent);
        cursor: pointer;
        border: 2px solid var(--panel-bg);
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      }

      &::-moz-range-thumb {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--panel-accent);
        cursor: pointer;
        border: 2px solid var(--panel-bg);
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      }
    }

    .opacity-value {
      width: 36px;
      font-size: 11px;
      color: var(--panel-text-secondary);
      text-align: right;
    }

    .line-type-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .line-type-select {
      flex: 1;
      padding: 0.25rem 0.5rem;
      border: 1px solid var(--panel-border);
      border-radius: 4px;
      font-size: 12px;
      background: var(--panel-input-bg);
      color: var(--panel-text);

      &:focus {
        outline: none;
        border-color: var(--panel-accent);
      }
    }

    .line-preview {
      width: 50px;
      height: 16px;
      border: 1px solid var(--panel-border);
      border-radius: 3px;
      background: var(--panel-input-bg);
    }

    .panel-footer {
      padding: 0.5rem;
      border-top: 1px solid var(--panel-border);
      background: var(--panel-bg-elevated);

      .hint {
        margin: 0;
        font-size: 10px;
        color: var(--panel-text-muted);
        text-align: center;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StylesPanelComponent implements IDockviewPanelProps {
  private readonly cdr = inject(ChangeDetectorRef);

  api!: DockviewPanelApi;
  containerApi!: DockviewApi;
  private _params: Record<string, unknown> = {};

  // Setter to intercept params assignment and extract signal reference
  set params(value: Record<string, unknown>) {
    this._params = value;
    // Store signal reference for effect tracking
    const styleClassesParam = value['styleClasses'];
    if (typeof styleClassesParam === 'function') {
      this._styleClassesSignal = styleClassesParam as Signal<StyleClass[]>;
    }
  }

  get params(): Record<string, unknown> {
    return this._params;
  }

  // Local state for selected style
  private _selectedStyleId = signal<string | null>(null);

  // Store reference to the styleClasses signal for proper tracking
  private _styleClassesSignal: Signal<StyleClass[]> | null = null;

  // Effect to trigger change detection when styleClasses signal updates
  // This is needed because dockview creates components dynamically outside Angular's normal flow
  private readonly styleClassesEffect = effect(() => {
    // Read the signal directly to track it
    if (this._styleClassesSignal) {
      this._styleClassesSignal();
    }
    // Also read local selected ID to track selection changes
    this._selectedStyleId();
    // Trigger change detection
    this.cdr.markForCheck();
  });

  /**
   * Get style classes from params (can be a signal or plain array).
   */
  get styleClasses(): StyleClass[] {
    if (this._styleClassesSignal) {
      return this._styleClassesSignal() ?? [];
    }
    const param = this.params['styleClasses'];
    if (typeof param === 'function') {
      return param() ?? [];
    }
    return (param as StyleClass[]) ?? [];
  }

  /**
   * Get selected style ID
   */
  get selectedStyleId(): string | null {
    return this._selectedStyleId();
  }

  /**
   * Get the selected style object
   */
  get selectedStyle(): StyleClass | null {
    const id = this._selectedStyleId();
    if (!id) return null;
    return this.styleClasses.find(s => s.id === id) ?? null;
  }

  /**
   * Callback for style classes changes
   */
  private get onStyleClassesChange(): ((classes: StyleClass[]) => void) | undefined {
    return this.params['onStyleClassesChange'] as ((classes: StyleClass[]) => void) | undefined;
  }

  /**
   * Callback for applying style to selection
   */
  private get onApplyStyleToSelection(): ((styleClassId: string) => void) | undefined {
    return this.params['onApplyStyleToSelection'] as ((styleClassId: string) => void) | undefined;
  }

  /**
   * Add a new style class
   */
  addStyle(): void {
    const existingNames = this.styleClasses.map(s => s.name);
    let counter = 1;
    let name = 'style-1';
    while (existingNames.includes(name)) {
      counter++;
      name = `style-${counter}`;
    }

    const newStyle = createStyleClass(name);
    const updated = [...this.styleClasses, newStyle];

    this.onStyleClassesChange?.(updated);
    this._selectedStyleId.set(newStyle.id);
  }

  /**
   * Delete a style class
   */
  deleteStyle(styleClass: StyleClass): void {
    const updated = this.styleClasses.filter(s => s.id !== styleClass.id);
    this.onStyleClassesChange?.(updated);

    if (this._selectedStyleId() === styleClass.id) {
      this._selectedStyleId.set(null);
    }
  }

  /**
   * Select a style for editing
   */
  selectStyle(styleClass: StyleClass): void {
    if (this._selectedStyleId() === styleClass.id) {
      this._selectedStyleId.set(null);
    } else {
      this._selectedStyleId.set(styleClass.id);
    }
  }

  /**
   * Update a property of the selected style
   */
  updateStyleProperty(path: string, value: unknown): void {
    const selected = this.selectedStyle;
    if (!selected) return;

    let updated: StyleClass;

    if (path === 'name') {
      updated = { ...selected, name: value as string };
    } else if (path.startsWith('fill.')) {
      const fillProp = path.split('.')[1];
      updated = {
        ...selected,
        style: {
          ...selected.style,
          fill: {
            ...selected.style.fill,
            [fillProp]: value
          }
        }
      };
    } else if (path.startsWith('stroke.')) {
      const strokeProp = path.split('.')[1];
      updated = {
        ...selected,
        style: {
          ...selected.style,
          stroke: {
            ...selected.style.stroke,
            [strokeProp]: value
          }
        }
      };
    } else {
      return;
    }

    const allStyles = this.styleClasses.map(s =>
      s.id === selected.id ? updated : s
    );
    this.onStyleClassesChange?.(allStyles);
  }

  // ============================================================================
  // Line Type Helpers
  // ============================================================================

  /** Line type to dash array mapping */
  private readonly lineTypes: Record<string, number[] | undefined> = {
    'solid': undefined,
    'dashed': [8, 4],
    'dotted': [2, 2],
    'dash-dot': [8, 4, 2, 4],
    'long-dash': [12, 6]
  };

  /**
   * Get line type name from dashArray
   */
  getLineType(dashArray: number[] | undefined): string {
    if (!dashArray || dashArray.length === 0) {
      return 'solid';
    }
    // Try to match known patterns
    const dashStr = dashArray.join(',');
    for (const [type, pattern] of Object.entries(this.lineTypes)) {
      if (pattern && pattern.join(',') === dashStr) {
        return type;
      }
    }
    return 'dashed'; // Default for unknown patterns
  }

  /**
   * Convert dashArray to string for SVG attribute
   */
  getDashArrayString(dashArray: number[] | undefined): string {
    if (!dashArray || dashArray.length === 0) {
      return '';
    }
    return dashArray.join(' ');
  }

  /**
   * Handle line type change
   */
  onLineTypeChange(lineType: string): void {
    const dashArray = this.lineTypes[lineType];
    this.updateStyleProperty('stroke.dashArray', dashArray ?? []);
  }

  // ============================================================================
  // Drag & Drop
  // ============================================================================

  /**
   * Handle drag start - set data for drag & drop
   */
  onDragStart(event: DragEvent, styleClass: StyleClass): void {
    if (event.dataTransfer) {
      event.dataTransfer.setData('application/x-style-class', styleClass.id);
      event.dataTransfer.effectAllowed = 'copy';

      // Create a drag image with the style preview
      const preview = document.createElement('div');
      preview.style.cssText = `
        width: 32px;
        height: 32px;
        background: ${styleClass.style.fill?.color || '#ccc'};
        border: 2px solid ${styleClass.style.stroke?.color || '#333'};
        border-radius: 4px;
        opacity: 0.8;
      `;
      document.body.appendChild(preview);
      event.dataTransfer.setDragImage(preview, 16, 16);
      setTimeout(() => document.body.removeChild(preview), 0);
    }
  }
}
