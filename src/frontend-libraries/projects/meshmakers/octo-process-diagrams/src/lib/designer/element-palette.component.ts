import {
  Component,
  Output,
  EventEmitter
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimitiveType, PrimitiveTypeValue } from '../primitives';

/**
 * Palette item definition
 */
export interface PaletteItem {
  type: PrimitiveTypeValue;
  label: string;
  icon: string;
  description: string;
}

/**
 * Element category definition
 */
interface ElementCategory {
  name: string;
  expanded: boolean;
  elements: PaletteItem[];
}

/**
 * Element Palette Component
 *
 * Displays available primitive elements organized by category.
 * Elements can be dragged onto the canvas to add them to the diagram.
 *
 * Supports:
 * - Primitives: Basic shapes (rectangle, ellipse, line, etc.)
 * - Future: Symbols from symbol library
 */
@Component({
  selector: 'mm-element-palette',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="element-palette" data-testid="element-palette">
      <div class="palette-search">
        <input type="text"
               data-testid="palette-search-input"
               placeholder="Search elements..."
               [(ngModel)]="searchTerm"
               (input)="onSearch()"/>
      </div>

      <div class="palette-content">
        @for (category of filteredCategories; track category.name) {
          <div class="palette-category">
            <div class="category-header" (click)="toggleCategory(category.name)">
              <span class="category-icon">{{ isCategoryExpanded(category.name) ? '▼' : '▶' }}</span>
              <span class="category-name">{{ category.name }}</span>
              <span class="category-count">({{ category.elements.length }})</span>
            </div>

            @if (isCategoryExpanded(category.name)) {
              <div class="category-elements">
                @for (element of category.elements; track element.type) {
                  <div class="palette-element"
                       [attr.data-testid]="'palette-element-' + element.type"
                       draggable="true"
                       (dragstart)="onDragStart($event, element)"
                       (dragend)="onDragEnd($event, element)"
                       [title]="element.description">
                    <div class="element-preview">
                      <svg [attr.viewBox]="getPreviewViewBox(element.type)" class="preview-svg">
                        @switch (element.type) {
                          @case ('rectangle') {
                            <rect x="4" y="6" width="24" height="16" fill="#e3f2fd" stroke="#1976d2" stroke-width="1.5"/>
                          }
                          @case ('ellipse') {
                            <ellipse cx="16" cy="14" rx="12" ry="8" fill="#e8f5e9" stroke="#388e3c" stroke-width="1.5"/>
                          }
                          @case ('line') {
                            <line x1="4" y1="20" x2="28" y2="8" stroke="#f57c00" stroke-width="2" stroke-linecap="round"/>
                          }
                          @case ('path') {
                            <path d="M4 20 Q16 4 28 20" fill="none" stroke="#7b1fa2" stroke-width="2"/>
                          }
                          @case ('polygon') {
                            <polygon points="16,4 28,24 4,24" fill="#fff3e0" stroke="#e65100" stroke-width="1.5"/>
                          }
                          @case ('polyline') {
                            <polyline points="4,20 12,8 20,16 28,4" fill="none" stroke="#0097a7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          }
                          @case ('image') {
                            <rect x="4" y="6" width="24" height="16" fill="#f5f5f5" stroke="#9e9e9e" stroke-width="1"/>
                            <circle cx="10" cy="12" r="3" fill="#ffeb3b"/>
                            <polygon points="8,20 16,14 22,18 28,12 28,22 4,22" fill="#81c784"/>
                          }
                          @case ('text') {
                            <text x="16" y="18" font-size="14" font-weight="bold" text-anchor="middle" fill="#333">Aa</text>
                          }
                        }
                      </svg>
                    </div>
                    <div class="element-label">{{ element.label }}</div>
                  </div>
                }
              </div>
            }
          </div>
        }

        @if (filteredCategories.length === 0) {
          <div class="no-results">
            No elements found
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

    .element-palette {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .palette-search {
      flex-shrink: 0;
      padding: 0.5rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .palette-search input {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 12px;
      box-sizing: border-box;
    }

    .palette-search input:focus {
      outline: none;
      border-color: #1976d2;
    }

    .palette-content {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 0.5rem;
    }

    .palette-category {
      margin-bottom: 0.5rem;
    }

    .category-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      background: #f5f5f5;
      border-radius: 4px;
      cursor: pointer;
      user-select: none;
    }

    .category-header:hover {
      background: #eeeeee;
    }

    .category-icon {
      font-size: 10px;
      color: #666;
    }

    .category-name {
      font-size: 12px;
      font-weight: 500;
    }

    .category-count {
      font-size: 11px;
      color: #999;
    }

    .category-elements {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
      padding: 0.5rem 0;
    }

    .palette-element {
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

    .palette-element:hover {
      border-color: #1976d2;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .palette-element:active {
      cursor: grabbing;
    }

    .element-preview {
      width: 32px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .preview-svg {
      width: 100%;
      height: 100%;
    }

    .element-label {
      font-size: 10px;
      text-align: center;
      color: #666;
    }

    .no-results {
      padding: 1rem;
      text-align: center;
      color: #999;
      font-size: 12px;
    }
  `]
})
export class ElementPaletteComponent {

  @Output() elementDragStart = new EventEmitter<PaletteItem>();
  @Output() elementDragEnd = new EventEmitter<PaletteItem>();

  searchTerm = '';
  private expandedCategories = new Set<string>(['Shapes', 'Lines', 'Content']);

  readonly categories: ElementCategory[] = [
    {
      name: 'Shapes',
      expanded: true,
      elements: [
        {
          type: PrimitiveType.Rectangle,
          label: 'Rectangle',
          icon: '',
          description: 'Rectangle or rounded rectangle'
        },
        {
          type: PrimitiveType.Ellipse,
          label: 'Ellipse',
          icon: '',
          description: 'Ellipse or circle'
        },
        {
          type: PrimitiveType.Polygon,
          label: 'Polygon',
          icon: '',
          description: 'Closed polygon shape'
        }
      ]
    },
    {
      name: 'Lines',
      expanded: true,
      elements: [
        {
          type: PrimitiveType.Line,
          label: 'Line',
          icon: '',
          description: 'Straight line with optional markers'
        },
        {
          type: PrimitiveType.Polyline,
          label: 'Polyline',
          icon: '',
          description: 'Connected line segments'
        },
        {
          type: PrimitiveType.Path,
          label: 'Path',
          icon: '',
          description: 'SVG path with curves'
        }
      ]
    },
    {
      name: 'Content',
      expanded: true,
      elements: [
        {
          type: PrimitiveType.Text,
          label: 'Text',
          icon: '',
          description: 'Text label'
        },
        {
          type: PrimitiveType.Image,
          label: 'Image',
          icon: '',
          description: 'Image or SVG graphic'
        }
      ]
    }
  ];

  filteredCategories: ElementCategory[] = this.categories;

  getPreviewViewBox(_type: PrimitiveTypeValue): string {
    return '0 0 32 28';
  }

  toggleCategory(categoryName: string): void {
    if (this.expandedCategories.has(categoryName)) {
      this.expandedCategories.delete(categoryName);
    } else {
      this.expandedCategories.add(categoryName);
    }
  }

  isCategoryExpanded(categoryName: string): boolean {
    return this.expandedCategories.has(categoryName);
  }

  onSearch(): void {
    const term = this.searchTerm.toLowerCase().trim();

    if (!term) {
      this.filteredCategories = this.categories;
      return;
    }

    this.filteredCategories = this.categories
      .map(category => ({
        ...category,
        elements: category.elements.filter(el =>
          el.label.toLowerCase().includes(term) ||
          el.type.toLowerCase().includes(term) ||
          el.description.toLowerCase().includes(term)
        )
      }))
      .filter(category => category.elements.length > 0);
  }

  onDragStart(event: DragEvent, item: PaletteItem): void {
    if (event.dataTransfer) {
      event.dataTransfer.setData('application/json', JSON.stringify({
        type: 'primitive',
        primitiveType: item.type
      }));
      event.dataTransfer.effectAllowed = 'copy';
    }
    this.elementDragStart.emit(item);
  }

  onDragEnd(_event: DragEvent, item: PaletteItem): void {
    this.elementDragEnd.emit(item);
  }
}
