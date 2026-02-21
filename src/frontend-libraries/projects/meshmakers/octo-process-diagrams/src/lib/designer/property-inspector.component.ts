import {
  Component,
  Input,
  Output,
  EventEmitter
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';

import {
  ProcessElement,
  ProcessConnection
} from '../process-widget.models';
import { PrimitiveBase, StyleClass } from '../primitives';
import { SymbolInstance, SymbolDefinition } from '../primitives/models/symbol.model';
import { TransformProperty } from '../primitives/models/transform-property.models';

/**
 * Property change event
 */
export interface PropertyChangeEvent {
  elementId?: string;
  connectionId?: string;
  primitiveId?: string;
  symbolInstanceId?: string;
  property: string;
  value: unknown;
}

/**
 * Property Inspector Component
 *
 * Displays and allows editing of properties for selected elements/connections.
 * Shows different property panels based on element type.
 */
@Component({
  selector: 'mm-property-inspector',
  standalone: true,
  imports: [CommonModule, FormsModule, InputsModule, DropDownsModule, DecimalPipe],
  template: `
    <div class="property-inspector">
      <div class="inspector-content">
        @if (selectedElements.length === 0 && selectedConnections.length === 0 && selectedPrimitives.length === 0 && selectedSymbolInstances.length === 0) {
          <div class="no-selection">
            <p>No element selected</p>
            <p class="hint">Click on an element or connection to edit its properties</p>
          </div>
        } @else if (selectedSymbolInstances.length === 1) {
          <!-- Single symbol instance selected -->
          @let symbolInstance = selectedSymbolInstances[0];
          @let symbolDef = getSymbolDefinition(symbolInstance);

          <div class="property-section">
            <div class="section-header">Symbol Instance</div>
            <div class="property-group">
              <div class="property-row">
                <label>Name</label>
                <input type="text"
                       [value]="symbolInstance.name ?? ''"
                       (change)="onSymbolInstancePropertyChange(symbolInstance.id, 'name', $any($event.target).value)"/>
              </div>
              <div class="property-row">
                <label>Symbol</label>
                <span class="type-badge">{{ symbolDef?.name ?? 'Unknown' }}</span>
              </div>
              <div class="property-row">
                <label>Visible</label>
                <input type="checkbox"
                       [checked]="symbolInstance.visible !== false"
                       (change)="onSymbolInstancePropertyChange(symbolInstance.id, 'visible', $any($event.target).checked)"/>
              </div>
            </div>
          </div>

          <div class="property-section">
            <div class="section-header">Position</div>
            <div class="property-group">
              <div class="property-row two-col">
                <div>
                  <label>X</label>
                  <input type="number"
                         #symPosXInput
                         [value]="symbolInstance.position.x"
                         (blur)="onSymbolInstanceNumericBlur(symbolInstance.id, 'position.x', symPosXInput.value)"
                         (keydown.enter)="onSymbolInstanceNumericBlur(symbolInstance.id, 'position.x', symPosXInput.value); symPosXInput.blur()"/>
                </div>
                <div>
                  <label>Y</label>
                  <input type="number"
                         #symPosYInput
                         [value]="symbolInstance.position.y"
                         (blur)="onSymbolInstanceNumericBlur(symbolInstance.id, 'position.y', symPosYInput.value)"
                         (keydown.enter)="onSymbolInstanceNumericBlur(symbolInstance.id, 'position.y', symPosYInput.value); symPosYInput.blur()"/>
                </div>
              </div>
            </div>
          </div>

          <div class="property-section">
            <div class="section-header">Transform</div>
            <div class="property-group">
              <div class="property-row">
                <label>Scale</label>
                <input type="number"
                       #symScaleInput
                       [value]="symbolInstance.scale ?? 1"
                       min="0.1"
                       step="0.1"
                       (blur)="onSymbolInstanceNumericBlur(symbolInstance.id, 'scale', symScaleInput.value)"
                       (keydown.enter)="onSymbolInstanceNumericBlur(symbolInstance.id, 'scale', symScaleInput.value); symScaleInput.blur()"/>
              </div>
              <div class="property-row">
                <label>Rotation</label>
                <input type="number"
                       #symRotInput
                       [value]="symbolInstance.rotation ?? 0"
                       min="0"
                       max="360"
                       (blur)="onSymbolInstanceNumericBlur(symbolInstance.id, 'rotation', symRotInput.value)"
                       (keydown.enter)="onSymbolInstanceNumericBlur(symbolInstance.id, 'rotation', symRotInput.value); symRotInput.blur()"/>
              </div>
            </div>
          </div>

          @if (symbolDef) {
            <div class="property-section">
              <div class="section-header">Symbol Info</div>
              <div class="property-group">
                <div class="property-row">
                  <label>Size</label>
                  <span class="info-value">{{ symbolDef.bounds.width | number:'1.0-0' }} × {{ symbolDef.bounds.height | number:'1.0-0' }}</span>
                </div>
                @if (symbolDef.description) {
                  <div class="property-row">
                    <label>Description</label>
                    <span class="info-value">{{ symbolDef.description }}</span>
                  </div>
                }
              </div>
            </div>

            <!-- Exposed Properties (Transform Properties) -->
            @if (symbolDef.transformProperties && symbolDef.transformProperties.length > 0) {
              <div class="property-section">
                <div class="section-header">Exposed Properties</div>
                <div class="property-group">
                  @for (prop of symbolDef.transformProperties; track prop.id) {
                    <div class="property-row exposed-property">
                      <label>{{ prop.name }}</label>
                      <div class="exposed-value">
                        <span class="type-badge small">{{ prop.type }}</span>
                        <span class="default-value">{{ formatDefaultValue(prop) }}</span>
                      </div>
                    </div>
                  }
                </div>
                <p class="hint exposed-hint">These properties can be bound to data sources</p>
              </div>
            }
          }
        } @else if (selectedSymbolInstances.length > 1) {
          <div class="multi-selection">
            <p>{{ selectedSymbolInstances.length }} symbols selected</p>
            <p class="hint">Select a single symbol to edit properties</p>
          </div>
        } @else if (selectedPrimitives.length === 1) {
          <!-- Single primitive selected -->
          @let primitive = selectedPrimitives[0];

          <div class="property-section">
            <div class="section-header">General</div>
            <div class="property-group">
              <div class="property-row">
                <label>Name</label>
                <input type="text"
                       [value]="primitive.name ?? ''"
                       (change)="onPrimitivePropertyChange(primitive.id, 'name', $any($event.target).value)"/>
              </div>
              <div class="property-row">
                <label>Type</label>
                <span class="type-badge">{{ primitive.type }}</span>
              </div>
              <div class="property-row">
                <label>Visible</label>
                <input type="checkbox"
                       [checked]="primitive.visible !== false"
                       (change)="onPrimitivePropertyChange(primitive.id, 'visible', $any($event.target).checked)"/>
              </div>
            </div>
          </div>

          <div class="property-section">
            <div class="section-header">Position</div>
            <div class="property-group">
              <div class="property-row two-col">
                <div>
                  <label>X</label>
                  <input type="number"
                         #posXInput
                         [value]="primitive.position.x"
                         (blur)="onNumericBlur(primitive.id, 'position.x', posXInput.value)"
                         (keydown.enter)="onNumericBlur(primitive.id, 'position.x', posXInput.value); posXInput.blur()"/>
                </div>
                <div>
                  <label>Y</label>
                  <input type="number"
                         #posYInput
                         [value]="primitive.position.y"
                         (blur)="onNumericBlur(primitive.id, 'position.y', posYInput.value)"
                         (keydown.enter)="onNumericBlur(primitive.id, 'position.y', posYInput.value); posYInput.blur()"/>
                </div>
              </div>
            </div>
          </div>

          <div class="property-section">
            <div class="section-header">Style</div>
            <div class="property-group">
              @if (availableStyleClasses.length > 0) {
                <div class="property-row">
                  <label>Style Class</label>
                  <select class="style-class-select"
                          (change)="onPrimitivePropertyChange(primitive.id, 'styleClassId', $any($event.target).value || null)">
                    <option value="" [selected]="!primitive.styleClassId">None (Inline)</option>
                    @for (styleClass of availableStyleClasses; track styleClass.id) {
                      <option [value]="styleClass.id" [selected]="primitive.styleClassId === styleClass.id">{{ styleClass.name }}</option>
                    }
                  </select>
                </div>
              }
              <div class="property-row">
                <label>Fill Color</label>
                <div class="color-with-opacity">
                  <input type="color"
                         [value]="primitive.style?.fill?.color ?? '#e3f2fd'"
                         (change)="onPrimitivePropertyChange(primitive.id, 'style.fill.color', $any($event.target).value)"/>
                  <input type="range"
                         class="opacity-slider"
                         [value]="(primitive.style?.fill?.opacity ?? 1) * 100"
                         min="0"
                         max="100"
                         (input)="onPrimitivePropertyChange(primitive.id, 'style.fill.opacity', +$any($event.target).value / 100)"/>
                  <span class="opacity-value">{{ ((primitive.style?.fill?.opacity ?? 1) * 100) | number:'1.0-0' }}%</span>
                </div>
              </div>
              <div class="property-row">
                <label>Stroke Color</label>
                <div class="color-with-opacity">
                  <input type="color"
                         [value]="primitive.style?.stroke?.color ?? '#666666'"
                         (change)="onPrimitivePropertyChange(primitive.id, 'style.stroke.color', $any($event.target).value)"/>
                  <input type="range"
                         class="opacity-slider"
                         [value]="(primitive.style?.stroke?.opacity ?? 1) * 100"
                         min="0"
                         max="100"
                         (input)="onPrimitivePropertyChange(primitive.id, 'style.stroke.opacity', +$any($event.target).value / 100)"/>
                  <span class="opacity-value">{{ ((primitive.style?.stroke?.opacity ?? 1) * 100) | number:'1.0-0' }}%</span>
                </div>
              </div>
              <div class="property-row">
                <label>Stroke Width</label>
                <input type="number"
                       [value]="primitive.style?.stroke?.width ?? 1"
                       min="0"
                       max="10"
                       (change)="onPrimitivePropertyChange(primitive.id, 'style.stroke.width', +$any($event.target).value)"/>
              </div>
              <div class="property-row">
                <label>Line Type</label>
                <select class="line-type-select"
                        [value]="getLineType(primitive.style?.stroke?.dashArray)"
                        (change)="onLineTypeChange(primitive.id, $any($event.target).value)">
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                  <option value="dash-dot">Dash-Dot</option>
                  <option value="long-dash">Long Dash</option>
                </select>
                <svg class="line-preview" viewBox="0 0 60 10" preserveAspectRatio="xMidYMid meet">
                  <line x1="0" y1="5" x2="60" y2="5"
                        [attr.stroke]="primitive.style?.stroke?.color ?? '#666'"
                        stroke-width="2"
                        [attr.stroke-dasharray]="getDashArrayString(primitive.style?.stroke?.dashArray)"/>
                </svg>
              </div>
            </div>
          </div>

          <!-- Type-specific properties for primitives -->
          @switch (primitive.type) {
            @case ('rectangle') {
              <div class="property-section">
                <div class="section-header">Rectangle Settings</div>
                <div class="property-group">
                  <div class="property-row two-col">
                    <div>
                      <label>Width</label>
                      <input type="number"
                             #rectWidthInput
                             [value]="$any(primitive).config.width"
                             min="1"
                             (blur)="onNumericBlur(primitive.id, 'config.width', rectWidthInput.value)"
                             (keydown.enter)="onNumericBlur(primitive.id, 'config.width', rectWidthInput.value); rectWidthInput.blur()"/>
                    </div>
                    <div>
                      <label>Height</label>
                      <input type="number"
                             #rectHeightInput
                             [value]="$any(primitive).config.height"
                             min="1"
                             (blur)="onNumericBlur(primitive.id, 'config.height', rectHeightInput.value)"
                             (keydown.enter)="onNumericBlur(primitive.id, 'config.height', rectHeightInput.value); rectHeightInput.blur()"/>
                    </div>
                  </div>
                  <div class="property-row">
                    <label>Corner Radius</label>
                    <input type="number"
                           #rectCornerInput
                           [value]="$any(primitive).config.cornerRadius ?? 0"
                           min="0"
                           (blur)="onNumericBlur(primitive.id, 'config.cornerRadius', rectCornerInput.value)"
                           (keydown.enter)="onNumericBlur(primitive.id, 'config.cornerRadius', rectCornerInput.value); rectCornerInput.blur()"/>
                  </div>
                </div>
              </div>
            }
            @case ('ellipse') {
              <div class="property-section">
                <div class="section-header">Ellipse Settings</div>
                <div class="property-group">
                  <div class="property-row two-col">
                    <div>
                      <label>Radius X</label>
                      <input type="number"
                             #ellipseRxInput
                             [value]="$any(primitive).config.radiusX"
                             min="1"
                             (blur)="onNumericBlur(primitive.id, 'config.radiusX', ellipseRxInput.value)"
                             (keydown.enter)="onNumericBlur(primitive.id, 'config.radiusX', ellipseRxInput.value); ellipseRxInput.blur()"/>
                    </div>
                    <div>
                      <label>Radius Y</label>
                      <input type="number"
                             #ellipseRyInput
                             [value]="$any(primitive).config.radiusY"
                             min="1"
                             (blur)="onNumericBlur(primitive.id, 'config.radiusY', ellipseRyInput.value)"
                             (keydown.enter)="onNumericBlur(primitive.id, 'config.radiusY', ellipseRyInput.value); ellipseRyInput.blur()"/>
                    </div>
                  </div>
                </div>
              </div>
            }
            @case ('text') {
              <div class="property-section">
                <div class="section-header">Text Settings</div>
                <div class="property-group">
                  <div class="property-row">
                    <label>Content</label>
                    <input type="text"
                           [value]="$any(primitive).config.content"
                           (change)="onPrimitivePropertyChange(primitive.id, 'config.content', $any($event.target).value)"/>
                  </div>
                  <div class="property-row">
                    <label>Font Size</label>
                    <input type="number"
                           [value]="$any(primitive).config.textStyle?.fontSize ?? 14"
                           min="8"
                           max="72"
                           (change)="onPrimitivePropertyChange(primitive.id, 'config.textStyle.fontSize', +$any($event.target).value)"/>
                  </div>
                </div>
              </div>
            }
            @case ('image') {
              <div class="property-section">
                <div class="section-header">Image Settings</div>
                <div class="property-group">
                  <!-- Image Preview -->
                  @if ($any(primitive).config.src) {
                    <div class="image-preview-container">
                      <img [src]="$any(primitive).config.src"
                           class="image-preview"
                           alt="Preview"/>
                    </div>
                  }

                  <!-- File Upload -->
                  <div class="property-row">
                    <label>Upload</label>
                    <div class="file-upload-row">
                      <input type="file"
                             #imageFileInput
                             accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
                             (change)="onImageFileSelected(primitive.id, $event)"
                             class="file-input-hidden"/>
                      <button type="button"
                              class="file-upload-button"
                              (click)="imageFileInput.click()">
                        Choose File
                      </button>
                      <span class="file-type-hint">PNG, JPG, GIF, SVG, WebP</span>
                    </div>
                  </div>

                  <!-- Source Type Info -->
                  <div class="property-row">
                    <label>Source Type</label>
                    <span class="type-badge">{{ $any(primitive).config.sourceType ?? 'url' }}</span>
                  </div>

                  <!-- URL Input (for external URLs) -->
                  <div class="property-row">
                    <label>URL</label>
                    <input type="text"
                           [value]="isDataUrl($any(primitive).config.src) ? '' : $any(primitive).config.src"
                           [placeholder]="isDataUrl($any(primitive).config.src) ? '(Eingebettetes Bild)' : 'https://...'"
                           (change)="onPrimitivePropertyChange(primitive.id, 'config.src', $any($event.target).value)"/>
                  </div>

                  <div class="property-row two-col">
                    <div>
                      <label>Width</label>
                      <input type="number"
                             [value]="$any(primitive).config.width"
                             min="1"
                             (change)="onPrimitivePropertyChange(primitive.id, 'config.width', +$any($event.target).value)"/>
                    </div>
                    <div>
                      <label>Height</label>
                      <input type="number"
                             [value]="$any(primitive).config.height"
                             min="1"
                             (change)="onPrimitivePropertyChange(primitive.id, 'config.height', +$any($event.target).value)"/>
                    </div>
                  </div>
                </div>
              </div>
            }
            @case ('line') {
              <div class="property-section">
                <div class="section-header">Line Settings</div>
                <div class="property-group">
                  <div class="property-row two-col">
                    <div>
                      <label>Start X</label>
                      <input type="number"
                             #lineStartXInput
                             [value]="$any(primitive).config.start.x"
                             (blur)="onNumericBlur(primitive.id, 'config.start.x', lineStartXInput.value)"
                             (keydown.enter)="onNumericBlur(primitive.id, 'config.start.x', lineStartXInput.value); lineStartXInput.blur()"/>
                    </div>
                    <div>
                      <label>Start Y</label>
                      <input type="number"
                             #lineStartYInput
                             [value]="$any(primitive).config.start.y"
                             (blur)="onNumericBlur(primitive.id, 'config.start.y', lineStartYInput.value)"
                             (keydown.enter)="onNumericBlur(primitive.id, 'config.start.y', lineStartYInput.value); lineStartYInput.blur()"/>
                    </div>
                  </div>
                  <div class="property-row two-col">
                    <div>
                      <label>End X</label>
                      <input type="number"
                             #lineEndXInput
                             [value]="$any(primitive).config.end.x"
                             (blur)="onNumericBlur(primitive.id, 'config.end.x', lineEndXInput.value)"
                             (keydown.enter)="onNumericBlur(primitive.id, 'config.end.x', lineEndXInput.value); lineEndXInput.blur()"/>
                    </div>
                    <div>
                      <label>End Y</label>
                      <input type="number"
                             #lineEndYInput
                             [value]="$any(primitive).config.end.y"
                             (blur)="onNumericBlur(primitive.id, 'config.end.y', lineEndYInput.value)"
                             (keydown.enter)="onNumericBlur(primitive.id, 'config.end.y', lineEndYInput.value); lineEndYInput.blur()"/>
                    </div>
                  </div>
                  <div class="property-row">
                    <label>Start Marker</label>
                    <select [value]="$any(primitive).config.markerStart?.type ?? 'none'"
                            (change)="onPrimitivePropertyChange(primitive.id, 'config.markerStart.type', $any($event.target).value)">
                      <option value="none">None</option>
                      <option value="arrow">Arrow</option>
                      <option value="circle">Circle</option>
                      <option value="square">Square</option>
                      <option value="diamond">Diamond</option>
                    </select>
                  </div>
                  <div class="property-row">
                    <label>End Marker</label>
                    <select [value]="$any(primitive).config.markerEnd?.type ?? 'none'"
                            (change)="onPrimitivePropertyChange(primitive.id, 'config.markerEnd.type', $any($event.target).value)">
                      <option value="none">None</option>
                      <option value="arrow">Arrow</option>
                      <option value="circle">Circle</option>
                      <option value="square">Square</option>
                      <option value="diamond">Diamond</option>
                    </select>
                  </div>
                </div>
              </div>
            }
            @case ('polygon') {
              <div class="property-section">
                <div class="section-header">Polygon Settings</div>
                <div class="property-group">
                  <div class="property-row">
                    <label>Vertices</label>
                    <span class="info-value">{{ $any(primitive).config.points?.length ?? 0 }} points</span>
                  </div>
                  <div class="property-row">
                    <label>Closed</label>
                    <span class="info-value">Yes (Polygon)</span>
                  </div>
                </div>
              </div>
            }
            @case ('polyline') {
              <div class="property-section">
                <div class="section-header">Polyline Settings</div>
                <div class="property-group">
                  <div class="property-row">
                    <label>Vertices</label>
                    <span class="info-value">{{ $any(primitive).config.points?.length ?? 0 }} points</span>
                  </div>
                  <div class="property-row">
                    <label>Closed</label>
                    <span class="info-value">No (Open path)</span>
                  </div>
                </div>
              </div>
            }
            @case ('path') {
              <div class="property-section">
                <div class="section-header">Path Settings</div>
                <div class="property-group">
                  <div class="property-row">
                    <label>Path Data</label>
                    <input type="text"
                           [value]="$any(primitive).config.d"
                           (change)="onPrimitivePropertyChange(primitive.id, 'config.d', $any($event.target).value)"/>
                  </div>
                  <div class="property-row">
                    <label>Fill Rule</label>
                    <select [value]="$any(primitive).config.fillRule ?? 'nonzero'"
                            (change)="onPrimitivePropertyChange(primitive.id, 'config.fillRule', $any($event.target).value)">
                      <option value="nonzero">Non-Zero</option>
                      <option value="evenodd">Even-Odd</option>
                    </select>
                  </div>
                </div>
              </div>
            }
          }
        } @else if (selectedElements.length > 1) {
          <div class="multi-selection">
            <p>{{ selectedElements.length }} elements selected</p>
            <p class="hint">Select a single element to edit properties</p>
          </div>
        } @else if (selectedElements.length === 1) {
          <!-- Single element selected -->
          @let element = selectedElements[0];

          <div class="property-section">
            <div class="section-header">General</div>
            <div class="property-group">
              <div class="property-row">
                <label>Name</label>
                <input type="text"
                       [value]="element.name"
                       (change)="onPropertyChange(element.id, 'name', $any($event.target).value)"/>
              </div>
              <div class="property-row">
                <label>Type</label>
                <span class="type-badge">{{ element.type }}</span>
              </div>
              <div class="property-row">
                <label>Visible</label>
                <input type="checkbox"
                       [checked]="element.visible !== false"
                       (change)="onPropertyChange(element.id, 'visible', $any($event.target).checked)"/>
              </div>
            </div>
          </div>

          <div class="property-section">
            <div class="section-header">Position & Size</div>
            <div class="property-group">
              <div class="property-row two-col">
                <div>
                  <label>X</label>
                  <input type="number"
                         [value]="element.position.x"
                         (change)="onPropertyChange(element.id, 'position.x', +$any($event.target).value)"/>
                </div>
                <div>
                  <label>Y</label>
                  <input type="number"
                         [value]="element.position.y"
                         (change)="onPropertyChange(element.id, 'position.y', +$any($event.target).value)"/>
                </div>
              </div>
              <div class="property-row two-col">
                <div>
                  <label>Width</label>
                  <input type="number"
                         [value]="element.size.width"
                         min="10"
                         (change)="onPropertyChange(element.id, 'size.width', +$any($event.target).value)"/>
                </div>
                <div>
                  <label>Height</label>
                  <input type="number"
                         [value]="element.size.height"
                         min="10"
                         (change)="onPropertyChange(element.id, 'size.height', +$any($event.target).value)"/>
                </div>
              </div>
              <div class="property-row">
                <label>Rotation</label>
                <input type="number"
                       [value]="element.rotation ?? 0"
                       min="0"
                       max="360"
                       (change)="onPropertyChange(element.id, 'rotation', +$any($event.target).value)"/>
              </div>
            </div>
          </div>

          <div class="property-section">
            <div class="section-header">Style</div>
            <div class="property-group">
              <div class="property-row">
                <label>Fill Color</label>
                <input type="color"
                       [value]="element.style?.fillColor ?? '#e0e0e0'"
                       (change)="onPropertyChange(element.id, 'style.fillColor', $any($event.target).value)"/>
              </div>
              <div class="property-row">
                <label>Stroke Color</label>
                <input type="color"
                       [value]="element.style?.strokeColor ?? '#666666'"
                       (change)="onPropertyChange(element.id, 'style.strokeColor', $any($event.target).value)"/>
              </div>
              <div class="property-row">
                <label>Stroke Width</label>
                <input type="number"
                       [value]="element.style?.strokeWidth ?? 1"
                       min="0"
                       max="10"
                       (change)="onPropertyChange(element.id, 'style.strokeWidth', +$any($event.target).value)"/>
              </div>
              <div class="property-row">
                <label>Opacity</label>
                <input type="number"
                       [value]="element.style?.opacity ?? 1"
                       min="0"
                       max="1"
                       step="0.1"
                       (change)="onPropertyChange(element.id, 'style.opacity', +$any($event.target).value)"/>
              </div>
            </div>
          </div>

          <!-- Type-specific properties -->
          @switch (element.type) {
            @case ('tank') {
              <div class="property-section">
                <div class="section-header">Tank Settings</div>
                <div class="property-group">
                  <div class="property-row">
                    <label>Shape</label>
                    <select [value]="$any(element).config.shape"
                            (change)="onPropertyChange(element.id, 'config.shape', $any($event.target).value)">
                      <option value="cylindrical">Cylindrical</option>
                      <option value="rectangular">Rectangular</option>
                      <option value="conical">Conical</option>
                    </select>
                  </div>
                  <div class="property-row">
                    <label>Show Level</label>
                    <input type="checkbox"
                           [checked]="$any(element).config.showLevel"
                           (change)="onPropertyChange(element.id, 'config.showLevel', $any($event.target).checked)"/>
                  </div>
                  <div class="property-row">
                    <label>Show Percentage</label>
                    <input type="checkbox"
                           [checked]="$any(element).config.showPercentage"
                           (change)="onPropertyChange(element.id, 'config.showPercentage', $any($event.target).checked)"/>
                  </div>
                  <div class="property-row">
                    <label>Fill Color</label>
                    <input type="color"
                           [value]="$any(element).config.fillColor ?? '#42a5f5'"
                           (change)="onPropertyChange(element.id, 'config.fillColor', $any($event.target).value)"/>
                  </div>
                </div>
              </div>
            }

            @case ('valve') {
              <div class="property-section">
                <div class="section-header">Valve Settings</div>
                <div class="property-group">
                  <div class="property-row">
                    <label>Valve Type</label>
                    <select [value]="$any(element).config.valveType"
                            (change)="onPropertyChange(element.id, 'config.valveType', $any($event.target).value)">
                      <option value="gate">Gate</option>
                      <option value="ball">Ball</option>
                      <option value="butterfly">Butterfly</option>
                      <option value="check">Check</option>
                      <option value="globe">Globe</option>
                    </select>
                  </div>
                  <div class="property-row">
                    <label>Open Color</label>
                    <input type="color"
                           [value]="$any(element).config.openColor ?? '#4caf50'"
                           (change)="onPropertyChange(element.id, 'config.openColor', $any($event.target).value)"/>
                  </div>
                  <div class="property-row">
                    <label>Closed Color</label>
                    <input type="color"
                           [value]="$any(element).config.closedColor ?? '#f44336'"
                           (change)="onPropertyChange(element.id, 'config.closedColor', $any($event.target).value)"/>
                  </div>
                  <div class="property-row">
                    <label>Show State</label>
                    <input type="checkbox"
                           [checked]="$any(element).config.showState"
                           (change)="onPropertyChange(element.id, 'config.showState', $any($event.target).checked)"/>
                  </div>
                </div>
              </div>
            }

            @case ('pump') {
              <div class="property-section">
                <div class="section-header">Pump Settings</div>
                <div class="property-group">
                  <div class="property-row">
                    <label>Pump Type</label>
                    <select [value]="$any(element).config.pumpType"
                            (change)="onPropertyChange(element.id, 'config.pumpType', $any($event.target).value)">
                      <option value="centrifugal">Centrifugal</option>
                      <option value="positive-displacement">Positive Displacement</option>
                      <option value="submersible">Submersible</option>
                    </select>
                  </div>
                  <div class="property-row">
                    <label>Running Color</label>
                    <input type="color"
                           [value]="$any(element).config.runningColor ?? '#4caf50'"
                           (change)="onPropertyChange(element.id, 'config.runningColor', $any($event.target).value)"/>
                  </div>
                  <div class="property-row">
                    <label>Stopped Color</label>
                    <input type="color"
                           [value]="$any(element).config.stoppedColor ?? '#9e9e9e'"
                           (change)="onPropertyChange(element.id, 'config.stoppedColor', $any($event.target).value)"/>
                  </div>
                  <div class="property-row">
                    <label>Show Animation</label>
                    <input type="checkbox"
                           [checked]="$any(element).config.showAnimation"
                           (change)="onPropertyChange(element.id, 'config.showAnimation', $any($event.target).checked)"/>
                  </div>
                </div>
              </div>
            }

            @case ('gauge') {
              <div class="property-section">
                <div class="section-header">Gauge Settings</div>
                <div class="property-group">
                  <div class="property-row">
                    <label>Gauge Type</label>
                    <select [value]="$any(element).config.gaugeType"
                            (change)="onPropertyChange(element.id, 'config.gaugeType', $any($event.target).value)">
                      <option value="arc">Arc</option>
                      <option value="semicircle">Semicircle</option>
                      <option value="linear">Linear</option>
                    </select>
                  </div>
                  <div class="property-row two-col">
                    <div>
                      <label>Min</label>
                      <input type="number"
                             [value]="$any(element).config.min"
                             (change)="onPropertyChange(element.id, 'config.min', +$any($event.target).value)"/>
                    </div>
                    <div>
                      <label>Max</label>
                      <input type="number"
                             [value]="$any(element).config.max"
                             (change)="onPropertyChange(element.id, 'config.max', +$any($event.target).value)"/>
                    </div>
                  </div>
                  <div class="property-row">
                    <label>Show Value</label>
                    <input type="checkbox"
                           [checked]="$any(element).config.showValue"
                           (change)="onPropertyChange(element.id, 'config.showValue', $any($event.target).checked)"/>
                  </div>
                </div>
              </div>
            }

            @case ('label') {
              <div class="property-section">
                <div class="section-header">Label Settings</div>
                <div class="property-group">
                  <div class="property-row">
                    <label>Text</label>
                    <input type="text"
                           [value]="$any(element).config.text"
                           (change)="onPropertyChange(element.id, 'config.text', $any($event.target).value)"/>
                  </div>
                  <div class="property-row">
                    <label>Background</label>
                    <input type="color"
                           [value]="$any(element).config.backgroundColor ?? '#ffffff'"
                           (change)="onPropertyChange(element.id, 'config.backgroundColor', $any($event.target).value)"/>
                  </div>
                  <div class="property-row">
                    <label>Show Border</label>
                    <input type="checkbox"
                           [checked]="$any(element).config.showBorder"
                           (change)="onPropertyChange(element.id, 'config.showBorder', $any($event.target).checked)"/>
                  </div>
                </div>
              </div>
            }

            @case ('statusLight') {
              <div class="property-section">
                <div class="section-header">Status Light Settings</div>
                <div class="property-group">
                  <div class="property-row">
                    <label>Shape</label>
                    <select [value]="$any(element).config.shape"
                            (change)="onPropertyChange(element.id, 'config.shape', $any($event.target).value)">
                      <option value="circle">Circle</option>
                      <option value="square">Square</option>
                      <option value="rectangle">Rectangle</option>
                    </select>
                  </div>
                  <div class="property-row">
                    <label>On Color</label>
                    <input type="color"
                           [value]="$any(element).config.onColor ?? '#4caf50'"
                           (change)="onPropertyChange(element.id, 'config.onColor', $any($event.target).value)"/>
                  </div>
                  <div class="property-row">
                    <label>Off Color</label>
                    <input type="color"
                           [value]="$any(element).config.offColor ?? '#9e9e9e'"
                           (change)="onPropertyChange(element.id, 'config.offColor', $any($event.target).value)"/>
                  </div>
                  <div class="property-row">
                    <label>Show Glow</label>
                    <input type="checkbox"
                           [checked]="$any(element).config.showGlow"
                           (change)="onPropertyChange(element.id, 'config.showGlow', $any($event.target).checked)"/>
                  </div>
                  <div class="property-row">
                    <label>Blink When On</label>
                    <input type="checkbox"
                           [checked]="$any(element).config.blinkWhenOn"
                           (change)="onPropertyChange(element.id, 'config.blinkWhenOn', $any($event.target).checked)"/>
                  </div>
                </div>
              </div>
            }
          }

          <!-- Data Binding section -->
          <div class="property-section">
            <div class="section-header">Data Binding</div>
            <div class="property-group">
              <div class="property-row">
                <label>Source Type</label>
                <select [value]="element.dataBinding?.sourceType ?? 'static'"
                        (change)="onPropertyChange(element.id, 'dataBinding.sourceType', $any($event.target).value)">
                  <option value="static">Static</option>
                  <option value="runtimeEntity">Runtime Entity</option>
                  <option value="persistentQuery">Persistent Query</option>
                </select>
              </div>
              @if (element.dataBinding?.sourceType === 'runtimeEntity') {
                <div class="property-row">
                  <label>CK Type ID</label>
                  <input type="text"
                         [value]="element.dataBinding?.sourceConfig?.ckTypeId ?? ''"
                         (change)="onPropertyChange(element.id, 'dataBinding.sourceConfig.ckTypeId', $any($event.target).value)"/>
                </div>
                <div class="property-row">
                  <label>RT ID</label>
                  <input type="text"
                         [value]="element.dataBinding?.sourceConfig?.rtId ?? ''"
                         (change)="onPropertyChange(element.id, 'dataBinding.sourceConfig.rtId', $any($event.target).value)"/>
                </div>
              }
              <div class="property-row">
                <label>Attribute Path</label>
                <input type="text"
                       [value]="element.dataBinding?.attributePath ?? ''"
                       (change)="onPropertyChange(element.id, 'dataBinding.attributePath', $any($event.target).value)"/>
              </div>
            </div>
          </div>
        } @else if (selectedConnections.length === 1) {
          <!-- Single connection selected -->
          @let connection = selectedConnections[0];

          <div class="property-section">
            <div class="section-header">Connection</div>
            <div class="property-group">
              <div class="property-row">
                <label>Name</label>
                <input type="text"
                       [value]="connection.name ?? ''"
                       (change)="onConnectionPropertyChange(connection.id, 'name', $any($event.target).value)"/>
              </div>
            </div>
          </div>

          <div class="property-section">
            <div class="section-header">Style</div>
            <div class="property-group">
              <div class="property-row">
                <label>Stroke Color</label>
                <input type="color"
                       [value]="connection.style.strokeColor"
                       (change)="onConnectionPropertyChange(connection.id, 'style.strokeColor', $any($event.target).value)"/>
              </div>
              <div class="property-row">
                <label>Stroke Width</label>
                <input type="number"
                       [value]="connection.style.strokeWidth"
                       min="1"
                       max="20"
                       (change)="onConnectionPropertyChange(connection.id, 'style.strokeWidth', +$any($event.target).value)"/>
              </div>
            </div>
          </div>

          <div class="property-section">
            <div class="section-header">Animation</div>
            <div class="property-group">
              <div class="property-row">
                <label>Enabled</label>
                <input type="checkbox"
                       [checked]="connection.animation?.enabled ?? false"
                       (change)="onConnectionPropertyChange(connection.id, 'animation.enabled', $any($event.target).checked)"/>
              </div>
              @if (connection.animation?.enabled) {
                <div class="property-row">
                  <label>Type</label>
                  <select [value]="connection.animation?.type ?? 'flow'"
                          (change)="onConnectionPropertyChange(connection.id, 'animation.type', $any($event.target).value)">
                    <option value="flow">Flow</option>
                    <option value="pulse">Pulse</option>
                    <option value="dash">Dash</option>
                  </select>
                </div>
                <div class="property-row">
                  <label>Speed</label>
                  <input type="number"
                         [value]="connection.animation?.speed ?? 1"
                         min="0.1"
                         max="5"
                         step="0.1"
                         (change)="onConnectionPropertyChange(connection.id, 'animation.speed', +$any($event.target).value)"/>
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

    .property-inspector {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .inspector-content {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 0.5rem;
    }

    .no-selection,
    .multi-selection {
      padding: 1rem;
      text-align: center;
      color: #666;
    }

    .hint {
      font-size: 12px;
      color: #999;
      margin-top: 0.5rem;
    }

    .property-section {
      margin-bottom: 1rem;
    }

    .section-header {
      font-size: 12px;
      font-weight: 500;
      color: #666;
      padding: 0.5rem 0;
      border-bottom: 1px solid #e0e0e0;
      margin-bottom: 0.5rem;
    }

    .property-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .property-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .property-row label {
      flex: 0 0 80px;
      font-size: 11px;
      color: #666;
    }

    .property-row input[type="text"],
    .property-row input[type="number"],
    .property-row select {
      flex: 1;
      padding: 0.25rem 0.5rem;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 12px;
    }

    .property-row input[type="text"]:focus,
    .property-row input[type="number"]:focus,
    .property-row select:focus {
      outline: none;
      border-color: #1976d2;
    }

    .property-row input[type="checkbox"] {
      margin: 0;
    }

    .property-row input[type="color"] {
      flex: 1;
      height: 28px;
      padding: 2px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }

    .color-with-opacity {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
    }

    .color-with-opacity input[type="color"] {
      flex: 0 0 40px;
      width: 40px;
    }

    .opacity-slider {
      flex: 1;
      height: 4px;
      -webkit-appearance: none;
      appearance: none;
      background: linear-gradient(to right, transparent, #333);
      border-radius: 2px;
      cursor: pointer;
    }

    .opacity-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #1976d2;
      cursor: pointer;
      border: 2px solid #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }

    .opacity-slider::-moz-range-thumb {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #1976d2;
      cursor: pointer;
      border: 2px solid #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }

    .opacity-value {
      flex: 0 0 36px;
      font-size: 11px;
      color: #666;
      text-align: right;
    }

    .line-type-select,
    .style-class-select {
      flex: 1;
      height: 28px;
      padding: 0 0.5rem;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 12px;
      background: #fff;
      cursor: pointer;
    }

    .style-class-select {
      width: 100%;
    }

    .line-preview {
      flex: 0 0 60px;
      height: 20px;
      background: #f5f5f5;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }

    .property-row.two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }

    .property-row.two-col > div {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .property-row.two-col label {
      flex: none;
    }

    .type-badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      background: #e3f2fd;
      border-radius: 4px;
      font-size: 11px;
      color: #1976d2;
    }

    .type-badge.small {
      padding: 0.0625rem 0.375rem;
      font-size: 10px;
    }

    .exposed-property {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }

    .exposed-property label {
      font-weight: 500;
      color: #333;
    }

    .exposed-value {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .default-value {
      font-size: 12px;
      color: #666;
    }

    .exposed-hint {
      font-size: 11px;
      color: #888;
      margin: 0.5rem 0.75rem 0;
      padding: 0;
      font-style: italic;
    }

    .info-value {
      font-size: 12px;
      color: #333;
    }

    /* Image Upload Styles */
    .image-preview-container {
      display: flex;
      justify-content: center;
      padding: 0.5rem;
      background: #f5f5f5;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }

    .image-preview {
      max-width: 100%;
      max-height: 100px;
      object-fit: contain;
    }

    .file-upload-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
    }

    .file-input-hidden {
      display: none;
    }

    .file-upload-button {
      padding: 0.25rem 0.75rem;
      font-size: 12px;
      border: 1px solid #1976d2;
      border-radius: 4px;
      background: #e3f2fd;
      color: #1976d2;
      cursor: pointer;
      white-space: nowrap;
    }

    .file-upload-button:hover {
      background: #bbdefb;
    }

    .file-type-hint {
      font-size: 10px;
      color: #999;
    }
  `]
})
export class PropertyInspectorComponent {

  @Input() selectedElements: ProcessElement[] = [];
  @Input() selectedConnections: ProcessConnection[] = [];
  @Input() selectedPrimitives: PrimitiveBase[] = [];
  @Input() selectedSymbolInstances: SymbolInstance[] = [];
  @Input() symbolDefinitions = new Map<string, SymbolDefinition>();
  @Input() availableStyleClasses: StyleClass[] = [];

  @Output() propertyChange = new EventEmitter<PropertyChangeEvent>();

  onPropertyChange(elementId: string, property: string, value: unknown): void {
    this.propertyChange.emit({ elementId, property, value });
  }

  onConnectionPropertyChange(connectionId: string, property: string, value: unknown): void {
    this.propertyChange.emit({ connectionId, property, value });
  }

  onPrimitivePropertyChange(primitiveId: string, property: string, value: unknown): void {
    this.propertyChange.emit({ primitiveId, property, value });
  }

  onSymbolInstancePropertyChange(symbolInstanceId: string, property: string, value: unknown): void {
    this.propertyChange.emit({ symbolInstanceId, property, value });
  }

  /**
   * Get the symbol definition for a symbol instance
   */
  getSymbolDefinition(instance: SymbolInstance): SymbolDefinition | undefined {
    return this.symbolDefinitions.get(instance.symbolRtId);
  }

  /**
   * Format the default value of a transform property for display
   */
  formatDefaultValue(prop: TransformProperty): string {
    if (prop.type === 'boolean') {
      return prop.defaultValue ? 'true' : 'false';
    }
    if (prop.type === 'number') {
      const numVal = Number(prop.defaultValue);
      // Show range if min/max are defined
      if (prop.min !== undefined && prop.max !== undefined) {
        return `${numVal} (${prop.min}-${prop.max})`;
      }
      return String(numVal);
    }
    return String(prop.defaultValue ?? '');
  }

  /**
   * Handle blur on numeric input - only emits if value is valid
   * This prevents issues during editing when user is typing/deleting
   */
  onNumericBlur(primitiveId: string, property: string, inputValue: string): void {
    const parsed = parseFloat(inputValue);
    // Only emit if the value is a valid number
    if (!isNaN(parsed) && isFinite(parsed)) {
      this.propertyChange.emit({ primitiveId, property, value: parsed });
    }
    // If invalid, the input will keep its value but won't affect the model
  }

  /**
   * Handle blur on numeric input for symbol instances
   */
  onSymbolInstanceNumericBlur(symbolInstanceId: string, property: string, inputValue: string): void {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed) && isFinite(parsed)) {
      this.propertyChange.emit({ symbolInstanceId, property, value: parsed });
    }
  }

  // Line type definitions
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
  onLineTypeChange(primitiveId: string, lineType: string): void {
    const dashArray = this.lineTypes[lineType];
    this.propertyChange.emit({
      primitiveId,
      property: 'style.stroke.dashArray',
      value: dashArray ?? []
    });
  }

  /**
   * Check if a source string is a data URL
   */
  isDataUrl(src: string | undefined): boolean {
    return src?.startsWith('data:') ?? false;
  }

  /**
   * Handle image file selection - converts to base64 data URL
   */
  onImageFileSelected(primitiveId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      console.warn('Invalid file type:', file.type);
      return;
    }

    // Read file as data URL
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;

      // Update source and source type
      this.propertyChange.emit({
        primitiveId,
        property: 'config.src',
        value: dataUrl
      });
      this.propertyChange.emit({
        primitiveId,
        property: 'config.sourceType',
        value: 'dataUrl'
      });
    };
    reader.onerror = () => {
      console.error('Error reading file:', reader.error);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    input.value = '';
  }
}
