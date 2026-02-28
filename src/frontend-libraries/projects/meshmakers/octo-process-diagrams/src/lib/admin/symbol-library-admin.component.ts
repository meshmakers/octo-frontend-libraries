import {
  Component,
  OnInit,
  inject,
  signal,
  ViewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { InputsModule, NumericTextBoxModule } from '@progress/kendo-angular-inputs';
import { DialogsModule } from '@progress/kendo-angular-dialog';
import { SymbolLibraryService } from '../services/symbol-library.service';
import { SvgImportService } from '../services/svg-import.service';
import {
  SymbolLibrary,
  SymbolDefinition,
  checkCircularDependencies
} from '../primitives/models/symbol.model';
import {
  PrimitiveBase,
  createRectangle,
  createEllipse,
  createText,
  createPolygon
} from '../primitives';
import { estimatePathBounds, PathPrimitive, offsetPathData } from '../primitives/models/path.model';
import { RectanglePrimitive } from '../primitives/models/rectangle.model';
import { EllipsePrimitive } from '../primitives/models/ellipse.model';
import { LinePrimitive } from '../primitives/models/line.model';
import { TextPrimitive } from '../primitives/models/text.model';
import { PolygonPrimitive, PolylinePrimitive } from '../primitives/models/polygon.model';
import { SymbolEditorComponent } from './symbol-editor.component';

/**
 * Symbol Library Admin Component
 *
 * A simple admin interface for creating and managing symbol libraries and symbols.
 */
@Component({
  selector: 'mm-symbol-library-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonsModule,
    InputsModule,
    NumericTextBoxModule,
    DialogsModule,
    SymbolEditorComponent
  ],
  template: `
    <div class="symbol-admin">
      <div class="admin-header">
        <h2>Symbol Library Admin</h2>
        @if (isEditMode()) {
          <div class="header-actions">
            <span class="edit-label">Editing: {{ selectedSymbol()?.name }}</span>
            <button kendoButton (click)="cancelEdit()">Cancel</button>
            <button kendoButton themeColor="primary" (click)="saveSymbol()" [disabled]="isSaving()">
              {{ isSaving() ? 'Saving...' : 'Save' }}
            </button>
          </div>
        }
      </div>

      @if (isEditMode()) {
        <!-- Edit Mode: Full Symbol Editor using ProcessDesigner -->
        <!-- Settings panel is now integrated into dockview -->
        <div class="edit-mode-container">
          <!-- Symbol Editor with integrated dockview panels -->
          <div class="editor-container">
            <mm-symbol-editor
              #symbolEditor
              [symbol]="editingSymbol()"
              [canvasWidth]="editSettings.canvasWidth"
              [canvasHeight]="editSettings.canvasHeight"
              [gridSize]="editSettings.gridSize"
              [useDockview]="true"
              [symbolSettings]="symbolSettings"
              (symbolChange)="onSymbolChange($event)"
              (saveRequest)="onEditorSaveRequest($event)"
              (symbolSettingsChange)="onSymbolSettingsChange($event)">
            </mm-symbol-editor>
          </div>
        </div>
      } @else {
        <!-- Normal Mode: Library/Symbol List -->
        <div class="admin-content">
          <!-- Libraries Panel -->
          <div class="libraries-panel">
            <div class="panel-header">
              <h3>Libraries</h3>
              <button kendoButton (click)="showCreateLibraryDialog()">+ New</button>
            </div>

            <div class="panel-content">
              @if (isLoading()) {
                <div class="loading">Loading...</div>
              } @else {
                @for (library of libraries(); track library.id) {
                  <div class="library-item"
                       [class.selected]="selectedLibrary()?.id === library.id"
                       (click)="selectLibrary(library)">
                    <div class="library-name">{{ library.name }}</div>
                    <div class="library-info">
                      {{ library.symbols.length }} symbols | v{{ library.version }}
                    </div>
                  </div>
                }

                @if (libraries().length === 0) {
                  <div class="empty-state">
                    No libraries found. Create one to get started.
                  </div>
                }
              }
            </div>
          </div>

          <!-- Symbols Panel -->
          <div class="symbols-panel">
            <div class="panel-header">
              <h3>Symbols</h3>
              @if (selectedLibrary()) {
                <button kendoButton (click)="showCreateSymbolDialog()" [disabled]="!selectedLibrary()">
                  + New
                </button>
              }
            </div>

            <div class="panel-content">
              @if (selectedLibrary()) {
                @for (symbol of selectedLibrary()!.symbols; track symbol.rtId) {
                  <div class="symbol-item"
                       [class.selected]="selectedSymbol()?.rtId === symbol.rtId"
                       (click)="selectSymbol(symbol)">
                    <div class="symbol-preview">
                      @if (symbol.previewImage) {
                        <img [src]="symbol.previewImage" [alt]="symbol.name"/>
                      } @else {
                        <svg [attr.viewBox]="getSymbolViewBox(symbol)"
                             class="preview-svg"
                             preserveAspectRatio="xMidYMid meet">
                          @for (prim of getFlattenedPrimitives(symbol); track prim.id) {
                            @switch (prim.type) {
                              @case ('rectangle') {
                                <rect [attr.x]="prim.position.x"
                                      [attr.y]="prim.position.y"
                                      [attr.width]="getScaledValue(prim, $any(prim).config.width)"
                                      [attr.height]="getScaledValue(prim, $any(prim).config.height)"
                                      [attr.fill]="prim.style?.fill?.color ?? 'none'"
                                      [attr.fill-opacity]="prim.style?.fill?.opacity ?? 1"
                                      [attr.stroke]="prim.style?.stroke?.color ?? 'none'"
                                      [attr.stroke-opacity]="prim.style?.stroke?.opacity ?? 1"
                                      [attr.stroke-dasharray]="getStrokeDashArray(prim.style?.stroke?.dashArray)"
                                      [attr.stroke-width]="prim.style?.stroke?.width ?? 1"/>
                              }
                              @case ('ellipse') {
                                <ellipse [attr.cx]="prim.position.x"
                                         [attr.cy]="prim.position.y"
                                         [attr.rx]="getScaledValue(prim, $any(prim).config.radiusX)"
                                         [attr.ry]="getScaledValue(prim, $any(prim).config.radiusY)"
                                         [attr.fill]="prim.style?.fill?.color ?? 'none'"
                                         [attr.fill-opacity]="prim.style?.fill?.opacity ?? 1"
                                         [attr.stroke]="prim.style?.stroke?.color ?? 'none'"
                                         [attr.stroke-opacity]="prim.style?.stroke?.opacity ?? 1"
                                         [attr.stroke-dasharray]="getStrokeDashArray(prim.style?.stroke?.dashArray)"
                                         [attr.stroke-width]="prim.style?.stroke?.width ?? 1"/>
                              }
                              @case ('polygon') {
                                <polygon [attr.points]="getPolygonPoints($any(prim))"
                                         [attr.fill]="prim.style?.fill?.color ?? 'none'"
                                         [attr.fill-opacity]="prim.style?.fill?.opacity ?? 1"
                                         [attr.stroke]="prim.style?.stroke?.color ?? 'none'"
                                         [attr.stroke-opacity]="prim.style?.stroke?.opacity ?? 1"
                                         [attr.stroke-dasharray]="getStrokeDashArray(prim.style?.stroke?.dashArray)"
                                         [attr.stroke-width]="prim.style?.stroke?.width ?? 1"/>
                              }
                              @case ('text') {
                                <text [attr.x]="prim.position.x"
                                      [attr.y]="prim.position.y"
                                      font-size="10"
                                      [attr.fill]="$any(prim).config.textStyle?.color ?? '#333'">
                                  {{ $any(prim).config.content }}
                                </text>
                              }
                              @case ('path') {
                                <path [attr.d]="$any(prim).config.d"
                                      [attr.transform]="'translate(' + prim.position.x + ',' + prim.position.y + ')'"
                                      [attr.fill]="prim.style?.fill?.color ?? 'none'"
                                      [attr.fill-opacity]="prim.style?.fill?.opacity ?? 1"
                                      [attr.fill-rule]="$any(prim).config.fillRule"
                                      [attr.stroke]="prim.style?.stroke?.color ?? 'none'"
                                      [attr.stroke-opacity]="prim.style?.stroke?.opacity ?? 1"
                                      [attr.stroke-dasharray]="getStrokeDashArray(prim.style?.stroke?.dashArray)"
                                      [attr.stroke-width]="prim.style?.stroke?.width ?? 1"/>
                              }
                              @case ('polyline') {
                                <polyline [attr.points]="getPolylinePoints($any(prim))"
                                          [attr.fill]="prim.style?.fill?.color ?? 'none'"
                                          [attr.fill-opacity]="prim.style?.fill?.opacity ?? 1"
                                          [attr.stroke]="prim.style?.stroke?.color ?? 'none'"
                                          [attr.stroke-opacity]="prim.style?.stroke?.opacity ?? 1"
                                          [attr.stroke-dasharray]="getStrokeDashArray(prim.style?.stroke?.dashArray)"
                                          [attr.stroke-width]="prim.style?.stroke?.width ?? 1"/>
                              }
                              @case ('line') {
                                <line [attr.x1]="$any(prim).config.start.x + prim.position.x"
                                      [attr.y1]="$any(prim).config.start.y + prim.position.y"
                                      [attr.x2]="$any(prim).config.end.x + prim.position.x"
                                      [attr.y2]="$any(prim).config.end.y + prim.position.y"
                                      [attr.stroke]="prim.style?.stroke?.color ?? 'none'"
                                      [attr.stroke-opacity]="prim.style?.stroke?.opacity ?? 1"
                                      [attr.stroke-dasharray]="getStrokeDashArray(prim.style?.stroke?.dashArray)"
                                      [attr.stroke-width]="prim.style?.stroke?.width ?? 1"/>
                              }
                              @case ('group') {
                                @let groupBounds = getGroupBounds(prim);
                                <rect [attr.x]="groupBounds.x"
                                      [attr.y]="groupBounds.y"
                                      [attr.width]="groupBounds.width"
                                      [attr.height]="groupBounds.height"
                                      [attr.fill]="prim.style?.fill?.color ?? 'none'"
                                      [attr.fill-opacity]="prim.style?.fill?.opacity ?? 1"
                                      [attr.stroke]="prim.style?.stroke?.color ?? 'none'"
                                      [attr.stroke-opacity]="prim.style?.stroke?.opacity ?? 1"
                                      [attr.stroke-width]="prim.style?.stroke?.width ?? 0"
                                      [attr.stroke-dasharray]="getStrokeDashArray(prim.style?.stroke?.dashArray)"/>
                              }
                            }
                          }
                        </svg>
                      }
                    </div>
                    <div class="symbol-info">
                      <div class="symbol-name">{{ symbol.name }}</div>
                      <div class="symbol-size">{{ symbol.bounds.width }}x{{ symbol.bounds.height }}</div>
                    </div>
                  </div>
                }

                @if (selectedLibrary()!.symbols.length === 0) {
                  <div class="empty-state">
                    No symbols in this library. Create one using the button above.
                  </div>
                }
              } @else {
                <div class="empty-state">
                  Select a library to view its symbols.
                </div>
              }
            </div>
          </div>

          <!-- Symbol Details Panel -->
          <div class="editor-panel">
            <div class="panel-header">
              <h3>Symbol Details</h3>
              @if (selectedSymbol()) {
                <div class="header-actions">
                  <button kendoButton themeColor="primary" (click)="enterEditMode()">Edit</button>
                  <button kendoButton themeColor="error" (click)="confirmDeleteSymbol()">Delete</button>
                </div>
              }
            </div>

            <div class="panel-content">
              @if (selectedSymbol()) {
                <div class="symbol-details">
                  <div class="detail-row">
                    <label>Name:</label>
                    <span>{{ selectedSymbol()!.name }}</span>
                  </div>
                  <div class="detail-row">
                    <label>Description:</label>
                    <span>{{ selectedSymbol()!.description || '-' }}</span>
                  </div>
                  <div class="detail-row">
                    <label>Version:</label>
                    <span>{{ selectedSymbol()!.version }}</span>
                  </div>
                  <div class="detail-row">
                    <label>Bounds:</label>
                    <span>{{ selectedSymbol()!.bounds.width }} x {{ selectedSymbol()!.bounds.height }}</span>
                  </div>
                  <div class="detail-row">
                    <label>Category:</label>
                    <span>{{ selectedSymbol()!.category || '-' }}</span>
                  </div>
                  <div class="detail-row">
                    <label>Tags:</label>
                    <span>{{ selectedSymbol()!.tags?.join(', ') || '-' }}</span>
                  </div>
                  <div class="detail-row">
                    <label>Primitives:</label>
                    <span>{{ selectedSymbol()!.primitives.length }}</span>
                  </div>
                </div>

                <div class="symbol-preview-large">
                  <svg [attr.viewBox]="getSymbolViewBox(selectedSymbol()!)"
                       preserveAspectRatio="xMidYMid meet">
                    @for (prim of getFlattenedPrimitives(selectedSymbol()!); track prim.id) {
                      @switch (prim.type) {
                        @case ('rectangle') {
                          <rect [attr.x]="prim.position.x"
                                [attr.y]="prim.position.y"
                                [attr.width]="getScaledValue(prim, $any(prim).config.width)"
                                [attr.height]="getScaledValue(prim, $any(prim).config.height)"
                                [attr.fill]="prim.style?.fill?.color ?? 'none'"
                                [attr.fill-opacity]="prim.style?.fill?.opacity ?? 1"
                                [attr.stroke]="prim.style?.stroke?.color ?? 'none'"
                                [attr.stroke-opacity]="prim.style?.stroke?.opacity ?? 1"
                                [attr.stroke-width]="prim.style?.stroke?.width ?? 1"
                                [attr.stroke-dasharray]="getStrokeDashArray(prim.style?.stroke?.dashArray)"
                                [attr.rx]="getScaledValue(prim, $any(prim).config.cornerRadiusX ?? $any(prim).config.cornerRadius ?? 0)"
                                [attr.ry]="getScaledValue(prim, $any(prim).config.cornerRadiusY ?? $any(prim).config.cornerRadius ?? 0)"/>
                        }
                        @case ('ellipse') {
                          <ellipse [attr.cx]="prim.position.x"
                                   [attr.cy]="prim.position.y"
                                   [attr.rx]="getScaledValue(prim, $any(prim).config.radiusX)"
                                   [attr.ry]="getScaledValue(prim, $any(prim).config.radiusY)"
                                   [attr.fill]="prim.style?.fill?.color ?? 'none'"
                                   [attr.fill-opacity]="prim.style?.fill?.opacity ?? 1"
                                   [attr.stroke]="prim.style?.stroke?.color ?? 'none'"
                                   [attr.stroke-opacity]="prim.style?.stroke?.opacity ?? 1"
                                   [attr.stroke-width]="prim.style?.stroke?.width ?? 1"
                                   [attr.stroke-dasharray]="getStrokeDashArray(prim.style?.stroke?.dashArray)"/>
                        }
                        @case ('line') {
                          <line [attr.x1]="getScaledValue(prim, $any(prim).config.start.x) + prim.position.x"
                                [attr.y1]="getScaledValue(prim, $any(prim).config.start.y) + prim.position.y"
                                [attr.x2]="getScaledValue(prim, $any(prim).config.end.x) + prim.position.x"
                                [attr.y2]="getScaledValue(prim, $any(prim).config.end.y) + prim.position.y"
                                [attr.stroke]="prim.style?.stroke?.color ?? 'none'"
                                [attr.stroke-opacity]="prim.style?.stroke?.opacity ?? 1"
                                [attr.stroke-width]="prim.style?.stroke?.width ?? 2"
                                [attr.stroke-dasharray]="getStrokeDashArray(prim.style?.stroke?.dashArray)"/>
                        }
                        @case ('polygon') {
                          <polygon [attr.points]="getPolygonPoints($any(prim))"
                                   [attr.fill]="prim.style?.fill?.color ?? 'none'"
                                   [attr.fill-opacity]="prim.style?.fill?.opacity ?? 1"
                                   [attr.stroke]="prim.style?.stroke?.color ?? 'none'"
                                   [attr.stroke-opacity]="prim.style?.stroke?.opacity ?? 1"
                                   [attr.stroke-width]="prim.style?.stroke?.width ?? 1"
                                   [attr.stroke-dasharray]="getStrokeDashArray(prim.style?.stroke?.dashArray)"/>
                        }
                        @case ('text') {
                          <text [attr.x]="prim.position.x"
                                [attr.y]="prim.position.y"
                                [attr.fill]="$any(prim).config.textStyle?.color ?? '#333'"
                                [attr.font-size]="getScaledValue(prim, $any(prim).config.textStyle?.fontSize ?? 14)">
                            {{ $any(prim).config.content }}
                          </text>
                        }
                        @case ('path') {
                          <path [attr.d]="$any(prim).config.d"
                                [attr.transform]="'translate(' + prim.position.x + ',' + prim.position.y + ')'"
                                [attr.fill]="prim.style?.fill?.color ?? 'none'"
                                [attr.fill-opacity]="prim.style?.fill?.opacity ?? 1"
                                [attr.fill-rule]="$any(prim).config.fillRule"
                                [attr.stroke]="prim.style?.stroke?.color ?? 'none'"
                                [attr.stroke-opacity]="prim.style?.stroke?.opacity ?? 1"
                                [attr.stroke-width]="prim.style?.stroke?.width ?? 1"
                                [attr.stroke-dasharray]="getStrokeDashArray(prim.style?.stroke?.dashArray)"/>
                        }
                        @case ('polyline') {
                          <polyline [attr.points]="getPolylinePoints($any(prim))"
                                    [attr.fill]="prim.style?.fill?.color ?? 'none'"
                                    [attr.fill-opacity]="prim.style?.fill?.opacity ?? 1"
                                    [attr.stroke]="prim.style?.stroke?.color ?? 'none'"
                                    [attr.stroke-opacity]="prim.style?.stroke?.opacity ?? 1"
                                    [attr.stroke-width]="prim.style?.stroke?.width ?? 1"
                                    [attr.stroke-dasharray]="getStrokeDashArray(prim.style?.stroke?.dashArray)"/>
                        }
                        @case ('group') {
                          @let groupBounds = getGroupBounds(prim);
                          <rect [attr.x]="groupBounds.x"
                                [attr.y]="groupBounds.y"
                                [attr.width]="groupBounds.width"
                                [attr.height]="groupBounds.height"
                                [attr.fill]="prim.style?.fill?.color ?? 'none'"
                                [attr.fill-opacity]="prim.style?.fill?.opacity ?? 1"
                                [attr.stroke]="prim.style?.stroke?.color ?? 'none'"
                                [attr.stroke-opacity]="prim.style?.stroke?.opacity ?? 1"
                                [attr.stroke-width]="prim.style?.stroke?.width ?? 0"
                                [attr.stroke-dasharray]="getStrokeDashArray(prim.style?.stroke?.dashArray)"/>
                        }
                      }
                    }
                  </svg>
                </div>
              } @else {
                <div class="empty-state">
                  Select a symbol to view its details.
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- Create Library Dialog -->
      @if (showLibraryDialog()) {
        <kendo-dialog title="Create Symbol Library" (close)="closeLibraryDialog()">
          <div class="dialog-content">
            <div class="form-group">
              <label>Name *</label>
              <input kendoTextBox [(ngModel)]="newLibrary.name" placeholder="Library name"/>
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea kendoTextArea [(ngModel)]="newLibrary.description" placeholder="Optional description"></textarea>
            </div>
            <div class="form-group">
              <label>Version</label>
              <input kendoTextBox [(ngModel)]="newLibrary.version" placeholder="1.0"/>
            </div>
            <div class="form-group">
              <label>Author</label>
              <input kendoTextBox [(ngModel)]="newLibrary.author" placeholder="Author name"/>
            </div>
          </div>
          <kendo-dialog-actions>
            <button kendoButton (click)="closeLibraryDialog()">Cancel</button>
            <button kendoButton themeColor="primary" (click)="createLibrary()" [disabled]="!newLibrary.name">
              Create
            </button>
          </kendo-dialog-actions>
        </kendo-dialog>
      }

      <!-- Create Symbol Dialog -->
      @if (showSymbolDialog()) {
        <kendo-dialog title="Create Symbol" (close)="closeSymbolDialog()" [width]="500">
          <div class="dialog-content">
            <div class="form-group">
              <label>Name *</label>
              <input kendoTextBox [(ngModel)]="newSymbol.name" placeholder="Symbol name"/>
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea kendoTextArea [(ngModel)]="newSymbol.description" placeholder="Optional description"></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Width</label>
                <input kendoTextBox type="number" [(ngModel)]="newSymbol.width" placeholder="100"/>
              </div>
              <div class="form-group">
                <label>Height</label>
                <input kendoTextBox type="number" [(ngModel)]="newSymbol.height" placeholder="100"/>
              </div>
            </div>
            <div class="form-group">
              <label>Category</label>
              <input kendoTextBox [(ngModel)]="newSymbol.category" placeholder="e.g., Basic, Flow"/>
            </div>
            <div class="form-group">
              <label>Template</label>
              <select [(ngModel)]="newSymbol.template" class="template-select" (ngModelChange)="onTemplateChange($event)">
                <option value="empty">Empty (edit later)</option>
                <option value="fromSvg">From SVG file...</option>
                <option value="rectangle">Rectangle</option>
                <option value="roundedRect">Rounded Rectangle</option>
                <option value="ellipse">Ellipse</option>
                <option value="diamond">Diamond</option>
                <option value="process">Process Box</option>
                <option value="decision">Decision Diamond</option>
                <option value="terminal">Terminal (Start/End)</option>
              </select>
              <input #svgFileInput
                     type="file"
                     accept=".svg,image/svg+xml"
                     style="display: none"
                     (change)="onSymbolSvgFileSelected($event)"/>
            </div>
            @if (newSymbol.template === 'fromSvg') {
              <div class="form-group svg-import-group">
                <button kendoButton (click)="svgFileInputRef.nativeElement.click()">
                  {{ newSymbol.svgFileName ? 'Change SVG...' : 'Select SVG file...' }}
                </button>
                @if (newSymbol.svgFileName) {
                  <span class="svg-filename">{{ newSymbol.svgFileName }}</span>
                  <span class="svg-info">{{ newSymbol.svgPrimitives?.length || 0 }} elements, {{ newSymbol.width }}×{{ newSymbol.height }}px</span>
                }
              </div>
              @if (newSymbol.svgOriginalPrimitives) {
                <div class="form-group svg-scale-group">
                  <label>Scale:</label>
                  <kendo-numerictextbox
                    [(ngModel)]="newSymbol.svgScale"
                    [min]="0.1"
                    [max]="20"
                    [step]="0.5"
                    [decimals]="1"
                    [format]="'n1'"
                    (valueChange)="onSvgScaleChange($event)"
                    style="width: 80px">
                  </kendo-numerictextbox>
                  <span class="scale-info">
                    Original: {{ newSymbol.svgOriginalWidth }}×{{ newSymbol.svgOriginalHeight }}px
                  </span>
                  <button kendoButton look="flat" (click)="resetSvgScale()" title="Reset to 1x">
                    Reset
                  </button>
                </div>
              }
            }
          </div>
          <kendo-dialog-actions>
            <button kendoButton (click)="closeSymbolDialog()">Cancel</button>
            <button kendoButton themeColor="primary" (click)="createSymbol()" [disabled]="!newSymbol.name">
              Create
            </button>
          </kendo-dialog-actions>
        </kendo-dialog>
      }

      <!-- Delete Symbol Confirmation Dialog -->
      @if (showDeleteDialog()) {
        <kendo-dialog title="Delete Symbol" (close)="closeDeleteDialog()" [width]="400">
          <p>Are you sure you want to delete the symbol <strong>{{ selectedSymbol()?.name }}</strong>?</p>
          <p class="warning-text">This action cannot be undone.</p>
          <kendo-dialog-actions>
            <button kendoButton (click)="closeDeleteDialog()">Cancel</button>
            <button kendoButton themeColor="error" (click)="deleteSymbol()" [disabled]="isDeleting()">
              {{ isDeleting() ? 'Deleting...' : 'Delete' }}
            </button>
          </kendo-dialog-actions>
        </kendo-dialog>
      }
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .symbol-admin {
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      min-height: 0;
      overflow: hidden;
      background: #f5f5f5;
    }

    .admin-header {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem;
      background: #fff;
      border-bottom: 1px solid #e0e0e0;
    }

    .admin-header h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .edit-label {
      font-size: 14px;
      color: #666;
      margin-right: 0.5rem;
    }

    .admin-content {
      display: flex;
      flex: 1;
      overflow: hidden;
      gap: 1px;
      background: #e0e0e0;
    }

    .edit-mode-container {
      display: flex;
      flex: 1;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .edit-settings {
      width: 220px;
      background: #fff;
      border-right: 1px solid #e0e0e0;
      overflow-y: auto;
      flex-shrink: 0;
    }

    .settings-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0.75rem;
      background: #f5f5f5;
      border-bottom: 1px solid #e0e0e0;
      font-size: 12px;
      font-weight: 600;
      color: #333;
    }

    .settings-close {
      width: 20px;
      height: 20px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 16px;
      color: #666;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 2px;

      &:hover {
        background: #e0e0e0;
        color: #333;
      }
    }

    .settings-collapsed {
      width: 28px;
      background: #fff;
      border-right: 1px solid #e0e0e0;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.5rem 0;
      cursor: pointer;
      flex-shrink: 0;
      writing-mode: vertical-rl;
      text-orientation: mixed;

      &:hover {
        background: #f0f0f0;
      }

      .collapsed-icon {
        font-size: 14px;
        color: #666;
        margin-bottom: 0.5rem;
      }

      .collapsed-label {
        font-size: 11px;
        color: #666;
        font-weight: 500;
      }
    }

    .settings-section {
      margin-bottom: 1rem;
      padding: 0 0.75rem 0.75rem;
      border-bottom: 1px solid #f0f0f0;

      &:first-of-type {
        padding-top: 0.75rem;
      }
    }

    .settings-section:last-child {
      border-bottom: none;
      margin-bottom: 0;
    }

    .settings-section h4 {
      margin: 0 0 0.5rem 0;
      font-size: 12px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
    }

    .editor-container {
      flex: 1;
      display: flex;
      height: 100%;
      min-width: 0;
      min-height: 0;
    }

    .libraries-panel,
    .symbols-panel,
    .editor-panel {
      display: flex;
      flex-direction: column;
      background: #fff;
    }

    .libraries-panel {
      width: 250px;
    }

    .symbols-panel {
      width: 300px;
    }

    .editor-panel {
      flex: 1;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem;
      border-bottom: 1px solid #e0e0e0;
      background: #fafafa;
    }

    .panel-header h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
    }

    .panel-content {
      flex: 1;
      overflow-y: auto;
      padding: 0.5rem;
    }

    .loading,
    .empty-state {
      padding: 2rem 1rem;
      text-align: center;
      color: #999;
      font-size: 13px;
    }

    .library-item {
      padding: 0.75rem;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      margin-bottom: 0.5rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .library-item:hover {
      border-color: #1976d2;
      background: #f5f5f5;
    }

    .library-item.selected {
      border-color: #1976d2;
      background: #e3f2fd;
    }

    .library-name {
      font-weight: 500;
      margin-bottom: 0.25rem;
    }

    .library-info {
      font-size: 11px;
      color: #666;
    }

    .symbol-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      margin-bottom: 0.5rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .symbol-item:hover {
      border-color: #9c27b0;
      background: #f3e5f5;
    }

    .symbol-item.selected {
      border-color: #9c27b0;
      background: #f3e5f5;
    }

    .symbol-preview {
      width: 48px;
      height: 48px;
      background: #fafafa;
      border-radius: 4px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .symbol-preview img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .preview-svg {
      width: 100%;
      height: 100%;
    }

    .symbol-info {
      flex: 1;
    }

    .symbol-name {
      font-weight: 500;
      margin-bottom: 0.25rem;
    }

    .symbol-size {
      font-size: 11px;
      color: #666;
    }

    .symbol-details {
      margin-bottom: 1rem;
    }

    .detail-row {
      display: flex;
      padding: 0.5rem 0;
      border-bottom: 1px solid #f0f0f0;
    }

    .detail-row label {
      width: 100px;
      color: #666;
      font-size: 12px;
    }

    .detail-row span {
      flex: 1;
      font-size: 13px;
    }

    .symbol-preview-large {
      background: #fafafa;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
    }

    .symbol-preview-large svg {
      max-width: 100%;
      max-height: 300px;
    }

    .edit-form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .dialog-content {
      padding: 1rem;
    }

    .form-group {
      margin-bottom: 0.75rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.25rem;
      font-size: 12px;
      font-weight: 500;
      color: #666;
    }

    .form-group input,
    .form-group textarea,
    .form-group select {
      width: 100%;
      box-sizing: border-box;
    }

    .form-group textarea {
      min-height: 40px;
    }

    .form-row {
      display: flex;
      gap: 0.5rem;
    }

    .form-row .form-group {
      flex: 1;
    }

    .template-select {
      padding: 0.5rem;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 14px;
    }

    .svg-import-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem;
      background: #f5f5f5;
      border-radius: 4px;
      margin-top: 0.5rem;
    }

    .svg-filename {
      font-weight: 500;
      color: #1976d2;
    }

    .svg-info {
      font-size: 12px;
      color: #666;
    }

    .svg-scale-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      background: #e3f2fd;
      border-radius: 4px;
      margin-top: 0.25rem;
    }

    .svg-scale-group label {
      font-weight: 500;
      margin: 0;
    }

    .scale-info {
      font-size: 12px;
      color: #666;
      flex: 1;
    }

    .warning-text {
      color: #d32f2f;
      font-size: 14px;
      margin-top: 0.5rem;
    }
  `]
})
export class SymbolLibraryAdminComponent implements OnInit {
  @ViewChild('symbolEditor') symbolEditor?: SymbolEditorComponent;
  @ViewChild('svgFileInput') svgFileInputRef!: ElementRef<HTMLInputElement>;

  private readonly symbolLibraryService = inject(SymbolLibraryService);
  private readonly svgImportService = inject(SvgImportService);

  // State
  private readonly _libraries = signal<SymbolLibrary[]>([]);
  private readonly _selectedLibrary = signal<SymbolLibrary | null>(null);
  private readonly _selectedSymbol = signal<SymbolDefinition | null>(null);
  private readonly _editingSymbol = signal<SymbolDefinition | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _isSaving = signal(false);
  private readonly _isEditMode = signal(false);
  private readonly _showLibraryDialog = signal(false);
  private readonly _showSymbolDialog = signal(false);
  private readonly _showDeleteDialog = signal(false);
  private readonly _showSettingsPanel = signal(true);
  private readonly _isDeleting = signal(false);

  // Public signals
  readonly libraries = this._libraries.asReadonly();
  readonly selectedLibrary = this._selectedLibrary.asReadonly();
  readonly selectedSymbol = this._selectedSymbol.asReadonly();
  readonly editingSymbol = this._editingSymbol.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly isEditMode = this._isEditMode.asReadonly();
  readonly showLibraryDialog = this._showLibraryDialog.asReadonly();
  readonly showSymbolDialog = this._showSymbolDialog.asReadonly();
  readonly showDeleteDialog = this._showDeleteDialog.asReadonly();
  readonly showSettingsPanel = this._showSettingsPanel.asReadonly();
  readonly isDeleting = this._isDeleting.asReadonly();

  // Form data
  newLibrary = {
    name: '',
    description: '',
    version: '1.0',
    author: ''
  };

  newSymbol: {
    name: string;
    description: string;
    width: number;
    height: number;
    category: string;
    template: string;
    svgPrimitives?: PrimitiveBase[];
    svgOriginalPrimitives?: PrimitiveBase[];
    svgFileName?: string;
    svgScale: number;
    svgOriginalWidth?: number;
    svgOriginalHeight?: number;
  } = {
    name: '',
    description: '',
    width: 100,
    height: 80,
    category: '',
    template: 'empty',
    svgScale: 1
  };

  // Edit mode settings
  editSettings = {
    name: '',
    description: '',
    version: '1.0',
    category: '',
    tags: '',
    canvasWidth: 400,
    canvasHeight: 300,
    gridSize: 10
  };

  /**
   * Get editSettings as SymbolSettings for the dockview settings panel
   */
  get symbolSettings() {
    return this.editSettings;
  }

  /**
   * Handle settings changes from the dockview settings panel
   */
  onSymbolSettingsChange(event: { key: string; value: string | number }): void {
    const key = event.key as keyof typeof this.editSettings;
    if (key in this.editSettings) {
      (this.editSettings[key] as string | number) = event.value;
    }
  }

  ngOnInit(): void {
    void this.loadLibraries();
  }

  // ============================================================================
  // Public API for external consumers (e.g., UnsavedChangesGuard)
  // ============================================================================

  /**
   * Check if there are unsaved changes (i.e., we are in edit mode)
   */
  hasUnsavedChanges(): boolean {
    return this._isEditMode();
  }

  /**
   * Save any pending changes
   * @returns Promise resolving to true if save was successful
   */
  async saveChangesAsync(): Promise<boolean> {
    if (!this._isEditMode()) {
      return true;
    }
    try {
      await this.saveSymbol();
      return true;
    } catch {
      return false;
    }
  }

  async loadLibraries(): Promise<void> {
    this._isLoading.set(true);
    try {
      const summaries = await this.symbolLibraryService.loadLibraryList();
      const libraries: SymbolLibrary[] = [];

      for (const summary of summaries) {
        try {
          const library = await this.symbolLibraryService.loadLibrary(summary.rtId);
          libraries.push(library);
        } catch (err) {
          console.error(`Failed to load library ${summary.rtId}:`, err);
        }
      }

      this._libraries.set(libraries);
    } catch (err) {
      console.error('Failed to load libraries:', err);
    } finally {
      this._isLoading.set(false);
    }
  }

  selectLibrary(library: SymbolLibrary): void {
    this._selectedLibrary.set(library);
    this._selectedSymbol.set(null);
    this._isEditMode.set(false);
  }

  selectSymbol(symbol: SymbolDefinition): void {
    this._selectedSymbol.set(symbol);
    this._isEditMode.set(false);
  }

  // Edit Mode
  enterEditMode(isNewSymbol = false): void {
    const symbol = this._selectedSymbol();
    if (!symbol) return;

    // Show settings panel only for new symbols
    this._showSettingsPanel.set(isNewSymbol);

    // Initialize edit settings from symbol
    // Use saved canvasSize if available, otherwise fall back to bounds
    const savedCanvasWidth = symbol.canvasSize?.width ?? symbol.bounds.width;
    const savedCanvasHeight = symbol.canvasSize?.height ?? symbol.bounds.height;

    this.editSettings = {
      name: symbol.name,
      description: symbol.description || '',
      version: symbol.version,
      category: symbol.category || '',
      tags: symbol.tags?.join(', ') || '',
      canvasWidth: savedCanvasWidth,
      canvasHeight: savedCanvasHeight,
      // Use saved gridSize or default to 10
      gridSize: symbol.gridSize ?? 10
    };

    // Create a copy for editing
    this._editingSymbol.set({
      ...symbol,
      primitives: [...symbol.primitives],
      symbolInstances: symbol.symbolInstances ? [...symbol.symbolInstances] : undefined
    });
    this._isEditMode.set(true);
  }

  cancelEdit(): void {
    this._editingSymbol.set(null);
    this._isEditMode.set(false);
  }

  toggleSettingsPanel(): void {
    this._showSettingsPanel.update(v => !v);
  }

  /**
   * Handle symbol changes from the editor (real-time updates)
   * Note: We do NOT update _editingSymbol here to avoid circular updates.
   * The SymbolEditor/ProcessDesigner holds the current state internally.
   * We retrieve the final state via symbolEditor.getSymbol() when saving.
   */
  onSymbolChange(_updatedSymbol: SymbolDefinition): void {
    // Intentionally empty - state is managed by SymbolEditor/ProcessDesigner
    // This event can be used for dirty-tracking or other side effects if needed
  }

  /**
   * Handle save request from the editor (Ctrl+S)
   */
  onEditorSaveRequest(_symbol: SymbolDefinition): void {
    void this.saveSymbol();
  }

  async saveSymbol(): Promise<void> {
    const editingSymbol = this._editingSymbol();
    const library = this._selectedLibrary();
    if (!editingSymbol || !library) return;

    this._isSaving.set(true);
    try {
      // Get the latest symbol state from the editor if available
      const editorSymbol = this.symbolEditor?.getSymbol() ?? editingSymbol;

      // Merge editSettings metadata with the symbol
      // Note: editorSymbol.bounds contains the correctly calculated bounds
      // based on all primitives (after normalization)
      const symbolToSave: SymbolDefinition = {
        ...editorSymbol,
        name: this.editSettings.name,
        description: this.editSettings.description || undefined,
        version: this.editSettings.version,
        category: this.editSettings.category || undefined,
        tags: this.editSettings.tags
          ? this.editSettings.tags.split(',').map(t => t.trim()).filter(t => t)
          : undefined
        // bounds come from editorSymbol (spread above) - they are calculated
        // by SymbolEditorComponent based on all primitive positions
      };

      // Check for circular dependencies if symbol contains nested symbols
      if (symbolToSave.symbolInstances && symbolToSave.symbolInstances.length > 0 && symbolToSave.rtId) {
        const circularCheck = await checkCircularDependencies(
          symbolToSave.rtId,
          symbolToSave.symbolInstances,
          async (rtId) => {
            try {
              return await this.symbolLibraryService.loadSymbol(rtId);
            } catch {
              return null;
            }
          }
        );

        if (circularCheck.hasCircularDependency) {
          alert(circularCheck.errorMessage || 'Circular dependency detected. Cannot save symbol that references itself.');
          this._isSaving.set(false);
          return;
        }
      }

      await this.symbolLibraryService.updateSymbol(symbolToSave);

      // Clear library cache and reload to ensure all symbols (including nested) are fresh
      this.symbolLibraryService.clearCache(library.id);
      const reloadedLibrary = await this.symbolLibraryService.loadLibrary(library.id, false);

      // Update local state with reloaded library
      this._libraries.update(libs =>
        libs.map(lib => lib.id === library.id ? reloadedLibrary : lib)
      );

      // Update selected library and symbol
      this._selectedLibrary.set(reloadedLibrary);
      const updatedSym = reloadedLibrary.symbols.find(s => s.rtId === symbolToSave.rtId);
      if (updatedSym) {
        this._selectedSymbol.set(updatedSym);
      }

      this._editingSymbol.set(null);
      this._isEditMode.set(false);
    } catch (err) {
      console.error('Failed to save symbol:', err);
    } finally {
      this._isSaving.set(false);
    }
  }

  // Library Dialog
  showCreateLibraryDialog(): void {
    this.newLibrary = { name: '', description: '', version: '1.0', author: '' };
    this._showLibraryDialog.set(true);
  }

  closeLibraryDialog(): void {
    this._showLibraryDialog.set(false);
  }

  async createLibrary(): Promise<void> {
    if (!this.newLibrary.name) return;

    try {
      const library = await this.symbolLibraryService.createLibrary({
        name: this.newLibrary.name,
        description: this.newLibrary.description || undefined,
        version: this.newLibrary.version || '1.0',
        author: this.newLibrary.author || undefined,
        isBuiltIn: false,
        isReadOnly: false
      });

      this._libraries.update(libs => [...libs, library]);
      this._selectedLibrary.set(library);
      this.closeLibraryDialog();
    } catch (err) {
      console.error('Failed to create library:', err);
    }
  }

  // Symbol Dialog
  showCreateSymbolDialog(): void {
    this.newSymbol = {
      name: '',
      description: '',
      width: 100,
      height: 80,
      category: '',
      template: 'empty',
      svgScale: 1,
      svgPrimitives: undefined,
      svgOriginalPrimitives: undefined,
      svgFileName: undefined,
      svgOriginalWidth: undefined,
      svgOriginalHeight: undefined
    };
    this._showSymbolDialog.set(true);
  }

  closeSymbolDialog(): void {
    this._showSymbolDialog.set(false);
  }

  // Delete Symbol Dialog
  confirmDeleteSymbol(): void {
    if (this.selectedSymbol()) {
      this._showDeleteDialog.set(true);
    }
  }

  closeDeleteDialog(): void {
    this._showDeleteDialog.set(false);
  }

  async deleteSymbol(): Promise<void> {
    const symbol = this.selectedSymbol();
    if (!symbol) return;

    this._isDeleting.set(true);
    try {
      const success = await this.symbolLibraryService.deleteSymbol(symbol);
      if (success) {
        // Clear selection
        this._selectedSymbol.set(null);
        // Close dialog
        this._showDeleteDialog.set(false);
        // Reload library to refresh the symbols list
        if (symbol.libraryRtId) {
          const library = await this.symbolLibraryService.loadLibrary(symbol.libraryRtId, false);
          this._selectedLibrary.set(library);
        }
      } else {
        console.error('Failed to delete symbol');
      }
    } catch (error) {
      console.error('Error deleting symbol:', error);
    } finally {
      this._isDeleting.set(false);
    }
  }

  /**
   * Handle template change - open file picker when "From SVG" is selected
   */
  onTemplateChange(template: string): void {
    if (template === 'fromSvg' && !this.newSymbol.svgPrimitives) {
      // Open file picker when "From SVG" is selected
      setTimeout(() => this.svgFileInputRef?.nativeElement?.click(), 100);
    }
  }

  /**
   * Handle SVG file selection for new symbol
   */
  onSymbolSvgFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Reset input for re-selection
    input.value = '';

    if (!file.type.includes('svg') && !file.name.endsWith('.svg')) {
      console.warn('Invalid file type. Please select an SVG file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const svgContent = reader.result as string;
      this.importSvgForSymbol(svgContent, file.name);
    };
    reader.onerror = () => {
      console.error('Error reading SVG file');
    };
    reader.readAsText(file);
  }

  /**
   * Import SVG content for a new symbol
   */
  private importSvgForSymbol(svgContent: string, fileName: string): void {
    const result = this.svgImportService.importSvg(svgContent, {
      namePrefix: 'svg'
    });

    if (result.primitives.length === 0) {
      console.warn('No importable elements found in SVG', result.warnings);
      return;
    }

    if (result.warnings.length > 0) {
      console.warn('SVG import warnings:', result.warnings);
    }

    // Calculate bounds and normalize primitives to start at (0,0)
    const { primitives: normalizedPrimitives, width, height } = this.normalizePrimitives(result.primitives);

    // Store original (normalized but unscaled) data
    this.newSymbol.svgOriginalPrimitives = normalizedPrimitives;
    this.newSymbol.svgOriginalWidth = Math.ceil(width);
    this.newSymbol.svgOriginalHeight = Math.ceil(height);
    this.newSymbol.svgScale = 1;

    // Update newSymbol with SVG data (initially unscaled)
    this.newSymbol.svgPrimitives = normalizedPrimitives;
    this.newSymbol.svgFileName = fileName;
    this.newSymbol.width = Math.ceil(width);
    this.newSymbol.height = Math.ceil(height);

    // Use filename without extension as default name if empty
    if (!this.newSymbol.name) {
      this.newSymbol.name = fileName.replace(/\.svg$/i, '');
    }
  }

  /**
   * Handle scale change for SVG import
   */
  onSvgScaleChange(scale: number | null): void {
    if (scale === null || scale <= 0 || !this.newSymbol.svgOriginalPrimitives) {
      return;
    }

    // Apply scaling to original primitives
    const scaled = this.svgImportService.scalePrimitives(
      this.newSymbol.svgOriginalPrimitives,
      scale
    );

    this.newSymbol.svgPrimitives = scaled.primitives;
    this.newSymbol.width = Math.ceil(scaled.width);
    this.newSymbol.height = Math.ceil(scaled.height);
  }

  /**
   * Reset SVG scale to 1x
   */
  resetSvgScale(): void {
    this.newSymbol.svgScale = 1;
    this.onSvgScaleChange(1);
  }

  /**
   * Calculate bounding box and normalize primitives to start at (0,0)
   * For paths, this transforms the path data itself
   */
  private normalizePrimitives(primitives: PrimitiveBase[]): {
    primitives: PrimitiveBase[];
    width: number;
    height: number;
  } {
    // First pass: calculate bounds
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const prim of primitives) {
      const bounds = this.getPrimitiveBoundsForImport(prim);
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    }

    // Handle edge case of no valid bounds
    if (minX === Infinity) {
      return { primitives, width: 100, height: 80 };
    }

    // Second pass: normalize primitives to start at (0,0)
    const offsetX = minX;
    const offsetY = minY;
    const normalizedPrimitives = primitives.map(prim => this.offsetPrimitive(prim, -offsetX, -offsetY));

    return {
      primitives: normalizedPrimitives,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Get bounds for a single primitive (for import calculation)
   */
  private getPrimitiveBoundsForImport(prim: PrimitiveBase): { x: number; y: number; width: number; height: number } {
    const pos = prim.position;

    switch (prim.type) {
      case 'rectangle': {
        const config = (prim as unknown as { config: { width: number; height: number } }).config;
        return { x: pos.x, y: pos.y, width: config.width, height: config.height };
      }
      case 'ellipse': {
        const config = (prim as unknown as { config: { radiusX: number; radiusY: number } }).config;
        return {
          x: pos.x - config.radiusX,
          y: pos.y - config.radiusY,
          width: config.radiusX * 2,
          height: config.radiusY * 2
        };
      }
      case 'path': {
        return estimatePathBounds(prim as PathPrimitive);
      }
      case 'polygon':
      case 'polyline': {
        const points = (prim as unknown as { config: { points: { x: number; y: number }[] } }).config.points;
        if (!points || points.length === 0) {
          return { x: pos.x, y: pos.y, width: 0, height: 0 };
        }
        let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
        for (const pt of points) {
          pMinX = Math.min(pMinX, pos.x + pt.x);
          pMinY = Math.min(pMinY, pos.y + pt.y);
          pMaxX = Math.max(pMaxX, pos.x + pt.x);
          pMaxY = Math.max(pMaxY, pos.y + pt.y);
        }
        return { x: pMinX, y: pMinY, width: pMaxX - pMinX, height: pMaxY - pMinY };
      }
      default:
        return { x: pos.x, y: pos.y, width: 50, height: 50 };
    }
  }

  /**
   * Offset a primitive by (dx, dy)
   * For paths, this transforms the path data using the shared offsetPathData function
   */
  private offsetPrimitive(prim: PrimitiveBase, dx: number, dy: number): PrimitiveBase {
    if (prim.type === 'path') {
      // For paths, transform the d attribute using the shared function
      const pathPrim = prim as PathPrimitive;
      const transformedD = offsetPathData(pathPrim.config.d, dx, dy);
      const result: PathPrimitive = {
        ...pathPrim,
        position: { x: 0, y: 0 }, // Path coords are now in the d string
        config: {
          ...pathPrim.config,
          d: transformedD
        }
      };
      return result;
    }

    // For other primitives, just offset the position
    return {
      ...prim,
      position: {
        x: prim.position.x + dx,
        y: prim.position.y + dy
      }
    };
  }

  async createSymbol(): Promise<void> {
    const library = this._selectedLibrary();
    if (!library || !this.newSymbol.name) return;

    // Validate SVG template has primitives
    if (this.newSymbol.template === 'fromSvg' && !this.newSymbol.svgPrimitives?.length) {
      console.warn('No SVG file selected');
      return;
    }

    try {
      // Use SVG primitives if template is "fromSvg", otherwise create from template
      const primitives = this.newSymbol.template === 'fromSvg' && this.newSymbol.svgPrimitives
        ? this.newSymbol.svgPrimitives
        : this.createPrimitivesFromTemplate(
            this.newSymbol.template,
            this.newSymbol.width,
            this.newSymbol.height
          );

      const symbol = await this.symbolLibraryService.createSymbol(library.id, {
        name: this.newSymbol.name,
        description: this.newSymbol.description || undefined,
        version: '1.0',
        primitives,
        bounds: {
          width: this.newSymbol.width,
          height: this.newSymbol.height
        },
        category: this.newSymbol.category || undefined
      });

      // Update library in list
      this._libraries.update(libs =>
        libs.map(lib => {
          if (lib.id === library.id) {
            return { ...lib, symbols: [...lib.symbols, symbol] };
          }
          return lib;
        })
      );

      // Update selected library
      const updatedLib = this._libraries().find(l => l.id === library.id);
      if (updatedLib) {
        this._selectedLibrary.set(updatedLib);
      }

      this._selectedSymbol.set(symbol);
      this.closeSymbolDialog();

      // Automatically enter edit mode for new symbols (with settings panel open)
      setTimeout(() => this.enterEditMode(true), 100);
    } catch (err) {
      console.error('Failed to create symbol:', err);
    }
  }

  private createPrimitivesFromTemplate(template: string, width: number, height: number): PrimitiveBase[] {
    const id = () => `prim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    switch (template) {
      case 'rectangle':
        return [
          createRectangle(id(), 0, 0, width, height, {
            style: {
              fill: { color: '#e3f2fd' },
              stroke: { color: '#1976d2', width: 2 }
            }
          })
        ];

      case 'roundedRect':
        return [
          createRectangle(id(), 0, 0, width, height, {
            config: { cornerRadius: 8 },
            style: {
              fill: { color: '#e8f5e9' },
              stroke: { color: '#388e3c', width: 2 }
            }
          })
        ];

      case 'ellipse':
        return [
          createEllipse(id(), width / 2, height / 2, width / 2, height / 2, {
            style: {
              fill: { color: '#fff3e0' },
              stroke: { color: '#f57c00', width: 2 }
            }
          })
        ];

      case 'diamond':
        return [
          createPolygon(id(), [
            { x: width / 2, y: 0 },
            { x: width, y: height / 2 },
            { x: width / 2, y: height },
            { x: 0, y: height / 2 }
          ], {
            style: {
              fill: { color: '#fce4ec' },
              stroke: { color: '#c2185b', width: 2 }
            }
          })
        ];

      case 'process':
        return [
          createRectangle(id(), 0, 0, width, height, {
            style: {
              fill: { color: '#e3f2fd' },
              stroke: { color: '#1976d2', width: 2 }
            }
          }),
          createText(id(), 'Process', width / 2, height / 2, {
            config: { textStyle: { fontSize: 12, color: '#333', textAnchor: 'middle', dominantBaseline: 'middle' } }
          })
        ];

      case 'decision':
        return [
          createPolygon(id(), [
            { x: width / 2, y: 0 },
            { x: width, y: height / 2 },
            { x: width / 2, y: height },
            { x: 0, y: height / 2 }
          ], {
            style: {
              fill: { color: '#fff8e1' },
              stroke: { color: '#ffa000', width: 2 }
            }
          }),
          createText(id(), '?', width / 2, height / 2, {
            config: { textStyle: { fontSize: 16, color: '#333', textAnchor: 'middle', dominantBaseline: 'middle' } }
          })
        ];

      case 'terminal':
        return [
          createRectangle(id(), 0, 0, width, height, {
            config: { cornerRadius: height / 2 },
            style: {
              fill: { color: '#f3e5f5' },
              stroke: { color: '#7b1fa2', width: 2 }
            }
          })
        ];

      default:
        return [];
    }
  }

  getPolygonPoints(primitive: { position: { x: number; y: number }; config: { points: { x: number; y: number }[] } }): string {
    return primitive.config.points
      .map(p => `${p.x + primitive.position.x},${p.y + primitive.position.y}`)
      .join(' ');
  }

  getPolylinePoints(primitive: { position: { x: number; y: number }; config: { points: { x: number; y: number }[] } }): string {
    return primitive.config.points
      .map(p => `${p.x + primitive.position.x},${p.y + primitive.position.y}`)
      .join(' ');
  }

  getStrokeDashArray(dashArray: number[] | undefined): string {
    if (!dashArray || dashArray.length === 0) {
      return '';
    }
    return dashArray.join(' ');
  }

  /**
   * Calculate bounding box for a group primitive based on its children
   */
  getGroupBounds(prim: PrimitiveBase): { x: number; y: number; width: number; height: number } {
    const children = (prim as unknown as { config?: { children?: PrimitiveBase[] } }).config?.children;
    if (!children || children.length === 0) {
      return { x: prim.position.x, y: prim.position.y, width: 100, height: 100 };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const child of children) {
      const childBounds = this.getPrimitiveBounds(child);
      minX = Math.min(minX, childBounds.x);
      minY = Math.min(minY, childBounds.y);
      maxX = Math.max(maxX, childBounds.x + childBounds.width);
      maxY = Math.max(maxY, childBounds.y + childBounds.height);
    }

    if (minX === Infinity) {
      return { x: prim.position.x, y: prim.position.y, width: 100, height: 100 };
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Calculate the actual bounding box that contains all primitives and symbol instances.
   * Returns a viewBox string for SVG rendering.
   */
  getSymbolViewBox(symbol: SymbolDefinition): string {
    const hasPrimitives = symbol.primitives && symbol.primitives.length > 0;
    const hasSymbolInstances = symbol.symbolInstances && symbol.symbolInstances.length > 0;

    if (!hasPrimitives && !hasSymbolInstances) {
      return `0 0 ${symbol.bounds.width} ${symbol.bounds.height}`;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let maxStrokeWidth = 0;

    // Include primitives
    if (symbol.primitives) {
      for (const prim of symbol.primitives) {
        const bounds = this.getPrimitiveBounds(prim);
        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
        maxX = Math.max(maxX, bounds.x + bounds.width);
        maxY = Math.max(maxY, bounds.y + bounds.height);
        // Track max stroke width for padding
        const strokeWidth = prim.style?.stroke?.width ?? 1;
        maxStrokeWidth = Math.max(maxStrokeWidth, strokeWidth);
      }
    }

    // Include symbol instances
    if (symbol.symbolInstances) {
      for (const inst of symbol.symbolInstances) {
        const bounds = this.getSymbolInstanceBounds(inst);
        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
        maxX = Math.max(maxX, bounds.x + bounds.width);
        maxY = Math.max(maxY, bounds.y + bounds.height);
      }
    }

    // Handle empty case
    if (minX === Infinity) {
      return `0 0 ${symbol.bounds.width} ${symbol.bounds.height}`;
    }

    // Add padding for stroke width (half on each side) plus a small margin
    const padding = Math.max(2, Math.ceil(maxStrokeWidth / 2) + 1);
    // Allow negative viewBox coordinates to show strokes at (0,0)
    const viewMinX = minX - padding;
    const viewMinY = minY - padding;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    return `${viewMinX} ${viewMinY} ${width} ${height}`;
  }

  /**
   * Get the bounding box of a symbol instance
   */
  private getSymbolInstanceBounds(instance: { symbolRtId: string; position: { x: number; y: number }; scale?: number }): { x: number; y: number; width: number; height: number } {
    const symbolDef = this.symbolLibraryService.getCachedSymbol(instance.symbolRtId);
    const scale = instance.scale ?? 1;

    if (symbolDef) {
      return {
        x: instance.position.x,
        y: instance.position.y,
        width: symbolDef.bounds.width * scale,
        height: symbolDef.bounds.height * scale
      };
    }

    // Fallback if symbol not cached
    return {
      x: instance.position.x,
      y: instance.position.y,
      width: 100 * scale,
      height: 100 * scale
    };
  }

  /**
   * Get flattened primitives for preview rendering (includes primitives from nested symbol instances)
   */
  getFlattenedPrimitives(symbol: SymbolDefinition): PrimitiveBase[] {
    const result: PrimitiveBase[] = [];

    // Add direct primitives
    if (symbol.primitives) {
      result.push(...symbol.primitives);
    }

    // Add primitives from symbol instances (transformed)
    if (symbol.symbolInstances) {
      for (const inst of symbol.symbolInstances) {
        const symbolDef = this.symbolLibraryService.getCachedSymbol(inst.symbolRtId);
        if (symbolDef && symbolDef.primitives) {
          const scale = inst.scale ?? 1;
          for (const prim of symbolDef.primitives) {
            // Create a transformed copy
            const transformedPrim: PrimitiveBase & { _instanceScale?: number } = {
              ...prim,
              id: `${inst.id}_${prim.id}`,
              position: {
                x: inst.position.x + prim.position.x * scale,
                y: inst.position.y + prim.position.y * scale
              },
              // Store scale for rendering adjustments
              _instanceScale: scale
            };

            // Transform polygon points if needed
            if (prim.type === 'polygon' && (prim as PolygonPrimitive).config?.points) {
              (transformedPrim as PolygonPrimitive).config = {
                ...(prim as PolygonPrimitive).config,
                points: (prim as PolygonPrimitive).config.points.map(p => ({
                  x: p.x * scale,
                  y: p.y * scale
                }))
              };
            }

            result.push(transformedPrim);
          }
        }
      }
    }

    return result;
  }

  /**
   * Get scaled config value for a primitive (accounts for symbol instance scale)
   */
  getScaledValue(prim: PrimitiveBase & { _instanceScale?: number }, value: number): number {
    return value * (prim._instanceScale ?? 1);
  }

  /**
   * Get the bounding box of a primitive
   */
  private getPrimitiveBounds(prim: PrimitiveBase): { x: number; y: number; width: number; height: number } {
    const pos = prim.position;

    switch (prim.type) {
      case 'rectangle': {
        const config = (prim as RectanglePrimitive).config;
        return { x: pos.x, y: pos.y, width: config.width, height: config.height };
      }
      case 'ellipse': {
        const config = (prim as EllipsePrimitive).config;
        return {
          x: pos.x - config.radiusX,
          y: pos.y - config.radiusY,
          width: config.radiusX * 2,
          height: config.radiusY * 2
        };
      }
      case 'polygon': {
        const config = (prim as PolygonPrimitive).config;
        const points = config.points;
        let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
        for (const p of points) {
          pMinX = Math.min(pMinX, p.x + pos.x);
          pMinY = Math.min(pMinY, p.y + pos.y);
          pMaxX = Math.max(pMaxX, p.x + pos.x);
          pMaxY = Math.max(pMaxY, p.y + pos.y);
        }
        return { x: pMinX, y: pMinY, width: pMaxX - pMinX, height: pMaxY - pMinY };
      }
      case 'line': {
        const config = (prim as LinePrimitive).config;
        const x1 = config.start.x + pos.x;
        const y1 = config.start.y + pos.y;
        const x2 = config.end.x + pos.x;
        const y2 = config.end.y + pos.y;
        return {
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          width: Math.abs(x2 - x1) || 1,
          height: Math.abs(y2 - y1) || 1
        };
      }
      case 'text': {
        // Approximate text bounds
        const config = (prim as TextPrimitive).config;
        const fontSize = config.textStyle?.fontSize ?? 14;
        const text = config.content ?? '';
        return {
          x: pos.x,
          y: pos.y - fontSize,
          width: text.length * fontSize * 0.6,
          height: fontSize * 1.2
        };
      }
      case 'path': {
        const pathBounds = estimatePathBounds(prim as PathPrimitive);
        return {
          x: pos.x + pathBounds.x,
          y: pos.y + pathBounds.y,
          width: pathBounds.width,
          height: pathBounds.height
        };
      }
      case 'polyline': {
        const config = (prim as PolylinePrimitive).config;
        const points = config.points;
        if (!points || points.length === 0) {
          return { x: pos.x, y: pos.y, width: 1, height: 1 };
        }
        let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
        for (const p of points) {
          pMinX = Math.min(pMinX, p.x + pos.x);
          pMinY = Math.min(pMinY, p.y + pos.y);
          pMaxX = Math.max(pMaxX, p.x + pos.x);
          pMaxY = Math.max(pMaxY, p.y + pos.y);
        }
        return { x: pMinX, y: pMinY, width: pMaxX - pMinX || 1, height: pMaxY - pMinY || 1 };
      }
      case 'group': {
        return this.getGroupBounds(prim);
      }
      default:
        return { x: pos.x, y: pos.y, width: 50, height: 50 };
    }
  }
}
