import {
  Component,
  Output,
  EventEmitter,
  OnInit,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SymbolLibraryService } from '../services/symbol-library.service';
import { SymbolLibrary, SymbolDefinition } from '../primitives/models/symbol.model';
import { PrimitiveBase, PrimitiveStyle, StyleClass } from '../primitives';

/**
 * Symbol item for drag/drop
 */
export interface SymbolPaletteItem {
  libraryRtId: string;
  symbolRtId: string;
  name: string;
  description?: string;
  previewImage?: string;
  bounds: { width: number; height: number };
}

/**
 * Symbol Library Panel Component
 *
 * Displays available symbol libraries and their symbols.
 * Symbols can be dragged onto the canvas to add them as instances.
 */
@Component({
  selector: 'mm-symbol-library-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="symbol-library-panel">
      <div class="panel-search">
        <input type="text"
               placeholder="Search symbols..."
               [(ngModel)]="searchTerm"
               (input)="onSearch()"/>
      </div>

      <div class="panel-content">
        @if (isLoading()) {
          <div class="loading">
            <span class="loading-spinner"></span>
            Loading libraries...
          </div>
        } @else if (error()) {
          <div class="error">
            <span class="error-icon">!</span>
            <span>{{ error() }}</span>
            <button class="retry-btn" (click)="refreshLibraries()">Retry</button>
          </div>
        } @else {
          @for (library of filteredLibraries(); track library.id) {
            <div class="library-section">
              <div class="library-header" (click)="toggleLibrary(library.id)">
                <span class="expand-icon">{{ isLibraryExpanded(library.id) ? '▼' : '▶' }}</span>
                <span class="library-name">{{ library.name }}</span>
                <span class="library-count">({{ library.symbols.length }})</span>
              </div>

              @if (isLibraryExpanded(library.id)) {
                <div class="library-symbols">
                  @for (symbol of library.symbols; track symbol.rtId) {
                    <div class="symbol-item"
                         draggable="true"
                         (dragstart)="onDragStart($event, library, symbol)"
                         (dragend)="onDragEnd($event)"
                         [title]="symbol.description || symbol.name">
                      <div class="symbol-preview">
                        @if (symbol.previewImage) {
                          <img [src]="symbol.previewImage" [alt]="symbol.name" class="preview-image"/>
                        } @else if (symbol.primitives && symbol.primitives.length > 0) {
                          <svg [attr.viewBox]="'0 0 ' + symbol.bounds.width + ' ' + symbol.bounds.height"
                               preserveAspectRatio="xMidYMid meet"
                               class="preview-svg">
                            @for (primitive of symbol.primitives; track primitive.id) {
                              @switch (primitive.type) {
                                @case ('rectangle') {
                                  <rect
                                    [attr.x]="primitive.position.x"
                                    [attr.y]="primitive.position.y"
                                    [attr.width]="$any(primitive).config?.width"
                                    [attr.height]="$any(primitive).config?.height"
                                    [attr.fill]="getFillColor(primitive, symbol.styleClasses)"
                                    [attr.stroke]="getStrokeColor(primitive, symbol.styleClasses)"
                                    [attr.stroke-width]="getStrokeWidth(primitive, symbol.styleClasses)"
                                    [attr.fill-opacity]="getFillOpacity(primitive, symbol.styleClasses)"
                                    [attr.stroke-opacity]="getStrokeOpacity(primitive, symbol.styleClasses)"
                                    [attr.rx]="$any(primitive).config?.cornerRadius || 0"
                                    [attr.ry]="$any(primitive).config?.cornerRadius || 0"
                                  />
                                }
                                @case ('ellipse') {
                                  <ellipse
                                    [attr.cx]="primitive.position.x + ($any(primitive).config?.radiusX || 0)"
                                    [attr.cy]="primitive.position.y + ($any(primitive).config?.radiusY || 0)"
                                    [attr.rx]="$any(primitive).config?.radiusX"
                                    [attr.ry]="$any(primitive).config?.radiusY"
                                    [attr.fill]="getFillColor(primitive, symbol.styleClasses)"
                                    [attr.stroke]="getStrokeColor(primitive, symbol.styleClasses)"
                                    [attr.stroke-width]="getStrokeWidth(primitive, symbol.styleClasses)"
                                    [attr.fill-opacity]="getFillOpacity(primitive, symbol.styleClasses)"
                                    [attr.stroke-opacity]="getStrokeOpacity(primitive, symbol.styleClasses)"
                                  />
                                }
                                @case ('line') {
                                  <line
                                    [attr.x1]="$any(primitive).config?.start?.x"
                                    [attr.y1]="$any(primitive).config?.start?.y"
                                    [attr.x2]="$any(primitive).config?.end?.x"
                                    [attr.y2]="$any(primitive).config?.end?.y"
                                    [attr.stroke]="getStrokeColor(primitive, symbol.styleClasses)"
                                    [attr.stroke-width]="getStrokeWidth(primitive, symbol.styleClasses)"
                                    [attr.stroke-opacity]="getStrokeOpacity(primitive, symbol.styleClasses)"
                                  />
                                }
                                @case ('path') {
                                  <path
                                    [attr.d]="$any(primitive).config?.d"
                                    [attr.transform]="'translate(' + primitive.position.x + ',' + primitive.position.y + ')'"
                                    [attr.fill]="getFillColor(primitive, symbol.styleClasses, 'none')"
                                    [attr.stroke]="getStrokeColor(primitive, symbol.styleClasses)"
                                    [attr.stroke-width]="getStrokeWidth(primitive, symbol.styleClasses)"
                                    [attr.fill-opacity]="getFillOpacity(primitive, symbol.styleClasses)"
                                    [attr.stroke-opacity]="getStrokeOpacity(primitive, symbol.styleClasses)"
                                  />
                                }
                                @case ('text') {
                                  <text
                                    [attr.x]="primitive.position.x"
                                    [attr.y]="primitive.position.y"
                                    [attr.fill]="getFillColor(primitive, symbol.styleClasses, '#333333')"
                                    [attr.fill-opacity]="getFillOpacity(primitive, symbol.styleClasses)"
                                    [attr.font-size]="$any(primitive).config?.fontSize || 12"
                                    [attr.font-family]="$any(primitive).config?.fontFamily || 'sans-serif'"
                                  >{{ $any(primitive).config?.text }}</text>
                                }
                                @case ('polyline') {
                                  <polyline
                                    [attr.points]="getPointsWithOffset(primitive)"
                                    [attr.fill]="getFillColor(primitive, symbol.styleClasses, 'none')"
                                    [attr.stroke]="getStrokeColor(primitive, symbol.styleClasses)"
                                    [attr.stroke-width]="getStrokeWidth(primitive, symbol.styleClasses)"
                                    [attr.fill-opacity]="getFillOpacity(primitive, symbol.styleClasses)"
                                    [attr.stroke-opacity]="getStrokeOpacity(primitive, symbol.styleClasses)"
                                  />
                                }
                                @case ('polygon') {
                                  <polygon
                                    [attr.points]="getPointsWithOffset(primitive)"
                                    [attr.fill]="getFillColor(primitive, symbol.styleClasses)"
                                    [attr.stroke]="getStrokeColor(primitive, symbol.styleClasses)"
                                    [attr.stroke-width]="getStrokeWidth(primitive, symbol.styleClasses)"
                                    [attr.fill-opacity]="getFillOpacity(primitive, symbol.styleClasses)"
                                    [attr.stroke-opacity]="getStrokeOpacity(primitive, symbol.styleClasses)"
                                  />
                                }
                                @case ('image') {
                                  <image
                                    [attr.x]="primitive.position.x"
                                    [attr.y]="primitive.position.y"
                                    [attr.width]="$any(primitive).config?.width"
                                    [attr.height]="$any(primitive).config?.height"
                                    [attr.href]="$any(primitive).config?.href"
                                    [attr.opacity]="primitive.style?.opacity ?? 1"
                                    preserveAspectRatio="xMidYMid meet"
                                  />
                                }
                              }
                            }
                          </svg>
                        } @else {
                          <svg viewBox="0 0 48 48" class="preview-svg">
                            <!-- Generic symbol placeholder for empty symbols -->
                            <rect x="4" y="4" width="40" height="40" rx="4"
                                  fill="#f3e5f5" stroke="#9c27b0" stroke-width="2"/>
                            <path d="M16 24 L24 16 L32 24 L24 32 Z"
                                  fill="#ce93d8" stroke="#7b1fa2" stroke-width="1"/>
                          </svg>
                        }
                      </div>
                      <div class="symbol-label">{{ symbol.name }}</div>
                    </div>
                  }

                  @if (library.symbols.length === 0) {
                    <div class="empty-library">No symbols in this library</div>
                  }
                </div>
              }
            </div>
          }

          @if (filteredLibraries().length === 0) {
            <div class="no-results">
              @if (searchTerm) {
                No symbols found for "{{ searchTerm }}"
              } @else {
                No symbol libraries available
              }
            </div>
          }
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

    .symbol-library-panel {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .panel-search {
      flex-shrink: 0;
      padding: 0.5rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .panel-search input {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 12px;
      box-sizing: border-box;
    }

    .panel-search input:focus {
      outline: none;
      border-color: #9c27b0;
    }

    .panel-content {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 0.5rem;
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 2rem 1rem;
      color: #666;
      font-size: 12px;
    }

    .loading-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid #e0e0e0;
      border-top-color: #9c27b0;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 1rem;
      color: #d32f2f;
      font-size: 12px;
      text-align: center;
    }

    .error-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: #ffebee;
      border-radius: 50%;
      font-weight: bold;
      font-size: 18px;
    }

    .retry-btn {
      padding: 0.25rem 0.75rem;
      background: #fff;
      border: 1px solid #d32f2f;
      border-radius: 4px;
      color: #d32f2f;
      font-size: 12px;
      cursor: pointer;
    }

    .retry-btn:hover {
      background: #ffebee;
    }

    .library-section {
      margin-bottom: 0.5rem;
    }

    .library-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      background: #f3e5f5;
      border-radius: 4px;
      cursor: pointer;
      user-select: none;
    }

    .library-header:hover {
      background: #e1bee7;
    }

    .expand-icon {
      font-size: 10px;
      color: #7b1fa2;
    }

    .library-name {
      font-size: 12px;
      font-weight: 500;
      color: #7b1fa2;
    }

    .library-count {
      font-size: 11px;
      color: #9c27b0;
    }

    .library-symbols {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
      padding: 0.5rem 0;
    }

    .symbol-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      padding: 0.5rem;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      cursor: grab;
      transition: all 0.15s ease;
    }

    .symbol-item:hover {
      border-color: #9c27b0;
      box-shadow: 0 2px 4px rgba(156,39,176,0.2);
    }

    .symbol-item:active {
      cursor: grabbing;
    }

    .symbol-preview {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fafafa;
      border-radius: 4px;
      overflow: hidden;
    }

    .preview-image {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .preview-svg {
      width: 100%;
      height: 100%;
    }

    .symbol-label {
      font-size: 10px;
      text-align: center;
      color: #666;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .empty-library {
      grid-column: 1 / -1;
      padding: 1rem;
      text-align: center;
      color: #999;
      font-size: 11px;
      font-style: italic;
    }

    .no-results {
      padding: 2rem 1rem;
      text-align: center;
      color: #999;
      font-size: 12px;
    }
  `]
})
export class SymbolLibraryPanelComponent implements OnInit {

  @Output() symbolDragStart = new EventEmitter<SymbolPaletteItem>();
  @Output() symbolDragEnd = new EventEmitter<void>();

  private readonly symbolLibraryService = inject(SymbolLibraryService);

  // State
  searchTerm = '';
  private expandedLibraries = new Set<string>();

  // Signals
  private readonly _libraries = signal<SymbolLibrary[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly filteredLibraries = computed(() => {
    const libraries = this._libraries();
    const term = this.searchTerm.toLowerCase().trim();

    if (!term) {
      return libraries;
    }

    return libraries
      .map(library => ({
        ...library,
        symbols: library.symbols.filter(symbol =>
          symbol.name.toLowerCase().includes(term) ||
          (symbol.description?.toLowerCase().includes(term) ?? false) ||
          (symbol.category?.toLowerCase().includes(term) ?? false) ||
          (symbol.tags?.some(tag => tag.toLowerCase().includes(term)) ?? false)
        )
      }))
      .filter(library =>
        library.symbols.length > 0 ||
        library.name.toLowerCase().includes(term)
      );
  });

  ngOnInit(): void {
    void this.loadLibraries();
  }

  async loadLibraries(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      // First get the list of libraries
      const summaries = await this.symbolLibraryService.loadLibraryList();

      // Then load each library with its symbols
      const libraries: SymbolLibrary[] = [];
      for (const summary of summaries) {
        try {
          const library = await this.symbolLibraryService.loadLibrary(summary.rtId);
          libraries.push(library);
          // Auto-expand first library
          if (libraries.length === 1) {
            this.expandedLibraries.add(library.id);
          }
        } catch (err) {
          console.error(`Failed to load library ${summary.rtId}:`, err);
        }
      }

      this._libraries.set(libraries);
    } catch (err) {
      console.error('Failed to load symbol libraries:', err);
      this._error.set('Failed to load symbol libraries');
    } finally {
      this._isLoading.set(false);
    }
  }

  refreshLibraries(): void {
    this.symbolLibraryService.clearCache();
    void this.loadLibraries();
  }

  toggleLibrary(libraryId: string): void {
    if (this.expandedLibraries.has(libraryId)) {
      this.expandedLibraries.delete(libraryId);
    } else {
      this.expandedLibraries.add(libraryId);
    }
  }

  isLibraryExpanded(libraryId: string): boolean {
    return this.expandedLibraries.has(libraryId);
  }

  onSearch(): void {
    // Search is handled by the computed signal
  }

  onDragStart(event: DragEvent, library: SymbolLibrary, symbol: SymbolDefinition): void {
    if (event.dataTransfer) {
      const data = {
        type: 'symbol',
        libraryRtId: library.id,
        symbolRtId: symbol.rtId
      };
      event.dataTransfer.setData('application/json', JSON.stringify(data));
      event.dataTransfer.effectAllowed = 'copy';
    }

    const item: SymbolPaletteItem = {
      libraryRtId: library.id,
      symbolRtId: symbol.rtId,
      name: symbol.name,
      description: symbol.description,
      previewImage: symbol.previewImage,
      bounds: symbol.bounds
    };
    this.symbolDragStart.emit(item);
  }

  onDragEnd(_event: DragEvent): void {
    this.symbolDragEnd.emit();
  }

  // ============ Style Helper Methods ============

  /**
   * Get polygon/polyline points with position offset applied.
   */
  protected getPointsWithOffset(primitive: PrimitiveBase): string {
    const config = (primitive as unknown as { config: { points?: { x: number; y: number }[] } }).config;
    const points = config?.points;
    if (!points || !Array.isArray(points)) {
      return '';
    }
    const pos = primitive.position;
    return points.map(p => `${(p.x ?? 0) + pos.x},${(p.y ?? 0) + pos.y}`).join(' ');
  }

  /**
   * Resolve the effective style for a primitive.
   * Priority: inline style > class style > default style
   */
  protected resolveStyle(primitive: PrimitiveBase, styleClasses?: StyleClass[]): PrimitiveStyle {
    let classStyle: PrimitiveStyle = {};

    // Look up style class if referenced
    if (primitive.styleClassId && styleClasses) {
      const styleClass = styleClasses.find(c => c.id === primitive.styleClassId);
      if (styleClass) {
        classStyle = styleClass.style;
      }
    }

    // Merge: inline style overrides class style
    return {
      ...classStyle,
      ...primitive.style,
      fill: {
        ...classStyle?.fill,
        ...primitive.style?.fill
      },
      stroke: {
        ...classStyle?.stroke,
        ...primitive.style?.stroke
      }
    };
  }

  /**
   * Get fill color for a primitive, resolving style class if needed
   */
  protected getFillColor(primitive: PrimitiveBase, styleClasses?: StyleClass[], defaultColor = '#cccccc'): string {
    const style = this.resolveStyle(primitive, styleClasses);
    return style.fill?.color || defaultColor;
  }

  /**
   * Get stroke color for a primitive, resolving style class if needed
   */
  protected getStrokeColor(primitive: PrimitiveBase, styleClasses?: StyleClass[], defaultColor = '#333333'): string {
    const style = this.resolveStyle(primitive, styleClasses);
    return style.stroke?.color || defaultColor;
  }

  /**
   * Get stroke width for a primitive, resolving style class if needed
   */
  protected getStrokeWidth(primitive: PrimitiveBase, styleClasses?: StyleClass[], defaultWidth = 1): number {
    const style = this.resolveStyle(primitive, styleClasses);
    return style.stroke?.width ?? defaultWidth;
  }

  /**
   * Get fill opacity for a primitive, resolving style class if needed
   */
  protected getFillOpacity(primitive: PrimitiveBase, styleClasses?: StyleClass[], defaultOpacity = 1): number {
    const style = this.resolveStyle(primitive, styleClasses);
    return style.fill?.opacity ?? defaultOpacity;
  }

  /**
   * Get stroke opacity for a primitive, resolving style class if needed
   */
  protected getStrokeOpacity(primitive: PrimitiveBase, styleClasses?: StyleClass[], defaultOpacity = 1): number {
    const style = this.resolveStyle(primitive, styleClasses);
    return style.stroke?.opacity ?? defaultOpacity;
  }
}
