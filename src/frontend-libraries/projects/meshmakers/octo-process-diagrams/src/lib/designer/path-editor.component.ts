/**
 * Path Editor Component
 *
 * A visual+text hybrid editor for SVG path data.
 * Allows dragging path nodes and control points, with live text sync.
 */

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  effect,
  ElementRef,
  viewChild,
  OnDestroy,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  PathEditorService,
  PathNode
} from './services/path-editor.service';

@Component({
  selector: 'mm-path-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="path-editor">
      <!-- Visual Editor -->
      <div class="visual-editor">
        <svg
          #svgElement
          [attr.viewBox]="viewBox()"
          class="path-canvas"
          (mousedown)="onCanvasMouseDown($event)"
          (mousemove)="onCanvasMouseMove($event)"
          (mouseup)="onCanvasMouseUp($event)"
          (mouseleave)="onCanvasMouseUp($event)">

          <!-- Background grid -->
          <defs>
            <pattern id="pathEditorGrid" [attr.width]="gridSize()" [attr.height]="gridSize()" patternUnits="userSpaceOnUse">
              <path [attr.d]="'M ' + gridSize() + ' 0 L 0 0 0 ' + gridSize()" fill="none" stroke="#e0e0e0" stroke-width="0.5"/>
            </pattern>
          </defs>
          <rect [attr.x]="viewBoxBounds().x"
                [attr.y]="viewBoxBounds().y"
                [attr.width]="viewBoxBounds().width"
                [attr.height]="viewBoxBounds().height"
                fill="url(#pathEditorGrid)"/>

          <!-- The actual path -->
          <path
            [attr.d]="pathService.getCurrentPathString()"
            fill="none"
            stroke="#333"
            stroke-width="2"/>

          <!-- Control point lines (connecting handles to their anchor points) -->
          @for (line of controlPointLines(); track line.id) {
            <line
              [attr.x1]="line.x1"
              [attr.y1]="line.y1"
              [attr.x2]="line.x2"
              [attr.y2]="line.y2"
              stroke="#999"
              stroke-width="1"
              stroke-dasharray="3,3"/>
          }

          <!-- Path nodes -->
          @for (node of pathService.nodes(); track node.id) {
            <circle
              [attr.cx]="node.position.x"
              [attr.cy]="node.position.y"
              [attr.r]="node.type === 'point' ? 6 : 5"
              [class.point-node]="node.type === 'point'"
              [class.control-node]="node.type !== 'point'"
              [class.selected]="pathService.selectedNodeId() === node.id"
              (mousedown)="onNodeMouseDown($event, node)"/>
          }
        </svg>

        <!-- Toolbar -->
        <div class="toolbar">
          <button
            class="toolbar-btn"
            [disabled]="!pathService.selectedNode()"
            (click)="deleteSelectedNode()"
            title="Delete segment">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/>
            </svg>
          </button>
          <span class="separator"></span>
          <button
            class="toolbar-btn"
            [disabled]="!canConvertToLine()"
            (click)="convertToLine()"
            title="Convert to line">
            L
          </button>
          <button
            class="toolbar-btn"
            [disabled]="!canConvertToCubic()"
            (click)="convertToCubic()"
            title="Convert to cubic bezier">
            C
          </button>
          <button
            class="toolbar-btn"
            [disabled]="!canConvertToQuadratic()"
            (click)="convertToQuadratic()"
            title="Convert to quadratic bezier">
            Q
          </button>
        </div>
      </div>

      <!-- Text Editor -->
      <div class="text-editor">
        <label>Path Data (d):</label>
        <textarea
          [ngModel]="textEditorValue()"
          (ngModelChange)="onTextChange($event)"
          rows="6"
          spellcheck="false"
          class="path-textarea"></textarea>
        <div class="text-editor-footer">
          <span class="status" [class.dirty]="pathService.isDirty()">
            @if (pathService.isDirty()) {
              Modified
            } @else {
              Saved
            }
          </span>
          <span class="segment-count">
            {{ pathService.segments().length }} segments
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .path-editor {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 8px;
      background: #f5f5f5;
      border-radius: 4px;
      height: 100%;
    }

    .visual-editor {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 200px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      overflow: hidden;
    }

    .path-canvas {
      flex: 1;
      width: 100%;
      cursor: crosshair;
    }

    .point-node {
      fill: #4CAF50;
      stroke: white;
      stroke-width: 2;
      cursor: move;
    }

    .point-node:hover {
      fill: #2E7D32;
    }

    .control-node {
      fill: #2196F3;
      stroke: white;
      stroke-width: 1.5;
      cursor: move;
    }

    .control-node:hover {
      fill: #1565C0;
    }

    .selected {
      stroke: #FF9800;
      stroke-width: 3;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: #f9f9f9;
      border-top: 1px solid #ddd;
    }

    .toolbar-btn {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #ccc;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
      color: #333;
    }

    .toolbar-btn:hover:not(:disabled) {
      background: #e8e8e8;
    }

    .toolbar-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .separator {
      width: 1px;
      height: 20px;
      background: #ddd;
      margin: 0 4px;
    }

    .text-editor {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .text-editor label {
      font-size: 12px;
      font-weight: 500;
      color: #666;
    }

    .path-textarea {
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 12px;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      resize: vertical;
      min-height: 60px;
    }

    .path-textarea:focus {
      outline: none;
      border-color: #2196F3;
    }

    .text-editor-footer {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #888;
    }

    .status.dirty {
      color: #FF9800;
    }
  `]
})
export class PathEditorComponent implements OnDestroy {
  /** Input path data string */
  readonly pathData = input<string>('');

  /** Width of the editor viewport */
  readonly width = input<number>(300);

  /** Height of the editor viewport */
  readonly height = input<number>(200);

  /** Grid size for snapping (default 10) */
  readonly gridSize = input<number>(10);

  /** Whether to snap anchor points to grid */
  readonly snapToGrid = input<boolean>(true);

  /** Emits when path data changes */
  readonly pathChange = output<string>();

  /** Reference to SVG element */
  private readonly svgElement = viewChild<ElementRef<SVGSVGElement>>('svgElement');

  /** Currently dragging node */
  private readonly _draggingNode = signal<PathNode | null>(null);

  /** Text editor value (separate to avoid parsing loop) */
  readonly textEditorValue = signal<string>('');

  /** ViewBox bounds for SVG */
  readonly viewBoxBounds = computed(() => {
    const nodes = this.pathService.nodes();
    if (nodes.length === 0) {
      return { x: 0, y: 0, width: this.width(), height: this.height() };
    }

    // Calculate bounding box with padding
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x);
      maxY = Math.max(maxY, node.position.y);
    }

    const padding = 20;
    const width = Math.max(maxX - minX + padding * 2, 100);
    const height = Math.max(maxY - minY + padding * 2, 100);

    return { x: minX - padding, y: minY - padding, width, height };
  });

  /** ViewBox string for SVG */
  readonly viewBox = computed(() => {
    const b = this.viewBoxBounds();
    return `${b.x} ${b.y} ${b.width} ${b.height}`;
  });

  /** Lines connecting control points to their anchor points */
  readonly controlPointLines = computed(() => {
    const lines: { id: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    const segments = this.pathService.segments();
    const nodes = this.pathService.nodes();

    let currentPoint = { x: 0, y: 0 };

    for (const segment of segments) {
      const segmentNodes = nodes.filter(n => n.segmentId === segment.id);
      const pointNode = segmentNodes.find(n => n.type === 'point');

      switch (segment.command.toUpperCase()) {
        case 'M':
        case 'L':
        case 'T':
          if (pointNode) {
            currentPoint = pointNode.position;
          }
          break;

        case 'C': {
          const cp1Node = segmentNodes.find(n => n.type === 'controlPoint1');
          const cp2Node = segmentNodes.find(n => n.type === 'controlPoint2');

          if (cp1Node) {
            lines.push({
              id: `${segment.id}-cp1`,
              x1: currentPoint.x,
              y1: currentPoint.y,
              x2: cp1Node.position.x,
              y2: cp1Node.position.y
            });
          }
          if (cp2Node && pointNode) {
            lines.push({
              id: `${segment.id}-cp2`,
              x1: pointNode.position.x,
              y1: pointNode.position.y,
              x2: cp2Node.position.x,
              y2: cp2Node.position.y
            });
          }
          if (pointNode) {
            currentPoint = pointNode.position;
          }
          break;
        }

        case 'S': {
          const cp2Node = segmentNodes.find(n => n.type === 'controlPoint2');
          if (cp2Node && pointNode) {
            lines.push({
              id: `${segment.id}-cp2`,
              x1: pointNode.position.x,
              y1: pointNode.position.y,
              x2: cp2Node.position.x,
              y2: cp2Node.position.y
            });
          }
          if (pointNode) {
            currentPoint = pointNode.position;
          }
          break;
        }

        case 'Q': {
          const cpNode = segmentNodes.find(n => n.type === 'controlPoint');
          if (cpNode) {
            lines.push({
              id: `${segment.id}-cp-start`,
              x1: currentPoint.x,
              y1: currentPoint.y,
              x2: cpNode.position.x,
              y2: cpNode.position.y
            });
            if (pointNode) {
              lines.push({
                id: `${segment.id}-cp-end`,
                x1: cpNode.position.x,
                y1: cpNode.position.y,
                x2: pointNode.position.x,
                y2: pointNode.position.y
              });
            }
          }
          if (pointNode) {
            currentPoint = pointNode.position;
          }
          break;
        }

        default:
          if (pointNode) {
            currentPoint = pointNode.position;
          }
      }
    }

    return lines;
  });

  readonly pathService = inject(PathEditorService);

  /** Flag to prevent circular updates */
  private _isUpdating = false;

  constructor() {
    // Load path when input changes (from parent component)
    effect(() => {
      const data = this.pathData();
      // Only load if this is a new path from parent (not our own updates)
      if (!this._isUpdating) {
        this._isUpdating = true;
        try {
          this.pathService.loadPath(data);
          this.textEditorValue.set(data);
        } finally {
          this._isUpdating = false;
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.pathService.clearPath();
  }

  // ============================================================================
  // Mouse handlers for visual editing
  // ============================================================================

  onCanvasMouseDown(event: MouseEvent): void {
    // Deselect when clicking on canvas background
    if (event.target === this.svgElement()?.nativeElement) {
      this.pathService.selectNode(null);
    }
  }

  onNodeMouseDown(event: MouseEvent, node: PathNode): void {
    event.preventDefault();
    event.stopPropagation();

    this.pathService.selectNode(node.id);
    this._draggingNode.set(node);
  }

  onCanvasMouseMove(event: MouseEvent): void {
    const dragging = this._draggingNode();
    if (!dragging) return;

    const svg = this.svgElement()?.nativeElement;
    if (!svg) return;

    let point = this.getCanvasPoint(event, svg);

    // Snap anchor points (green) to grid, but not control points (blue)
    if (dragging.type === 'point' && this.snapToGrid()) {
      point = this.snapPointToGrid(point);
    }

    this.pathService.moveNode(dragging.id, point);
  }

  onCanvasMouseUp(_event: MouseEvent): void {
    const wasDragging = this._draggingNode();
    this._draggingNode.set(null);

    if (wasDragging && this.pathService.isDirty()) {
      this.syncTextEditor();
      this.emitChange();
    }
  }

  // ============================================================================
  // Text editor
  // ============================================================================

  onTextChange(value: string): void {
    this.textEditorValue.set(value);
    this.pathService.updateFromText(value);
    this.emitChange();
  }

  // ============================================================================
  // Toolbar actions
  // ============================================================================

  deleteSelectedNode(): void {
    const node = this.pathService.selectedNode();
    if (!node) return;

    this.pathService.deleteSegment(node.segmentId);
    this.syncTextEditor();
    this.emitChange();
  }

  canConvertToLine(): boolean {
    const node = this.pathService.selectedNode();
    if (!node) return false;

    const segment = this.pathService.segments().find(s => s.id === node.segmentId);
    if (!segment) return false;

    // Can convert if not already a line and not MoveTo/ClosePath
    return !['M', 'm', 'L', 'l', 'Z', 'z'].includes(segment.command);
  }

  canConvertToCubic(): boolean {
    const node = this.pathService.selectedNode();
    if (!node) return false;

    const segment = this.pathService.segments().find(s => s.id === node.segmentId);
    if (!segment) return false;

    // Can convert if not already cubic and not MoveTo/ClosePath
    return !['M', 'm', 'C', 'c', 'Z', 'z'].includes(segment.command);
  }

  canConvertToQuadratic(): boolean {
    const node = this.pathService.selectedNode();
    if (!node) return false;

    const segment = this.pathService.segments().find(s => s.id === node.segmentId);
    if (!segment) return false;

    // Can convert if not already quadratic and not MoveTo/ClosePath
    return !['M', 'm', 'Q', 'q', 'Z', 'z'].includes(segment.command);
  }

  convertToLine(): void {
    const node = this.pathService.selectedNode();
    if (!node) return;

    this.pathService.convertSegmentType(node.segmentId, 'L');
    this.syncTextEditor();
    this.emitChange();
  }

  convertToCubic(): void {
    const node = this.pathService.selectedNode();
    if (!node) return;

    this.pathService.convertSegmentType(node.segmentId, 'C');
    this.syncTextEditor();
    this.emitChange();
  }

  convertToQuadratic(): void {
    const node = this.pathService.selectedNode();
    if (!node) return;

    this.pathService.convertSegmentType(node.segmentId, 'Q');
    this.syncTextEditor();
    this.emitChange();
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private getCanvasPoint(event: MouseEvent, svg: SVGSVGElement): { x: number; y: number } {
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;

    const screenCTM = svg.getScreenCTM();
    if (screenCTM) {
      const transformed = pt.matrixTransform(screenCTM.inverse());
      return { x: transformed.x, y: transformed.y };
    }

    return { x: event.offsetX, y: event.offsetY };
  }

  /** Snap a point to the grid */
  private snapPointToGrid(point: { x: number; y: number }): { x: number; y: number } {
    const grid = this.gridSize();
    return {
      x: Math.round(point.x / grid) * grid,
      y: Math.round(point.y / grid) * grid
    };
  }

  /** Sync text editor with current path from service */
  private syncTextEditor(): void {
    this.textEditorValue.set(this.pathService.getCurrentPathString());
  }

  private emitChange(): void {
    this.pathChange.emit(this.pathService.getCurrentPathString());
  }
}
