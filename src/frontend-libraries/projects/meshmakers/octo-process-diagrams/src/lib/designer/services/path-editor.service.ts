/**
 * Path Editor Service
 *
 * Provides parsing, manipulation, and serialization of SVG path data.
 * Supports visual editing with draggable nodes and bezier control points.
 */

import { Injectable, signal, computed } from '@angular/core';
import { parsePathNumbers } from '../../primitives/models/path.model';

// ============================================================================
// Types
// ============================================================================

/**
 * Point in 2D space
 */
export interface PathPoint {
  x: number;
  y: number;
}

/**
 * Types of path commands
 */
export type PathCommandType =
  | 'M' | 'm'  // MoveTo
  | 'L' | 'l'  // LineTo
  | 'H' | 'h'  // Horizontal LineTo
  | 'V' | 'v'  // Vertical LineTo
  | 'C' | 'c'  // Cubic Bezier
  | 'S' | 's'  // Smooth Cubic Bezier
  | 'Q' | 'q'  // Quadratic Bezier
  | 'T' | 't'  // Smooth Quadratic Bezier
  | 'A' | 'a'  // Arc
  | 'Z' | 'z'; // ClosePath

/**
 * Base path segment
 */
export interface PathSegmentBase {
  /** Unique ID for this segment */
  id: string;
  /** Command type */
  command: PathCommandType;
  /** Whether this is a relative command */
  isRelative: boolean;
}

/**
 * MoveTo segment (M/m)
 */
export interface MoveToSegment extends PathSegmentBase {
  command: 'M' | 'm';
  /** End point */
  point: PathPoint;
}

/**
 * LineTo segment (L/l)
 */
export interface LineToSegment extends PathSegmentBase {
  command: 'L' | 'l';
  /** End point */
  point: PathPoint;
}

/**
 * Horizontal LineTo segment (H/h)
 */
export interface HorizontalLineSegment extends PathSegmentBase {
  command: 'H' | 'h';
  /** X coordinate */
  x: number;
}

/**
 * Vertical LineTo segment (V/v)
 */
export interface VerticalLineSegment extends PathSegmentBase {
  command: 'V' | 'v';
  /** Y coordinate */
  y: number;
}

/**
 * Cubic Bezier segment (C/c)
 */
export interface CubicBezierSegment extends PathSegmentBase {
  command: 'C' | 'c';
  /** First control point */
  controlPoint1: PathPoint;
  /** Second control point */
  controlPoint2: PathPoint;
  /** End point */
  point: PathPoint;
}

/**
 * Smooth Cubic Bezier segment (S/s)
 */
export interface SmoothCubicSegment extends PathSegmentBase {
  command: 'S' | 's';
  /** Second control point */
  controlPoint2: PathPoint;
  /** End point */
  point: PathPoint;
}

/**
 * Quadratic Bezier segment (Q/q)
 */
export interface QuadraticBezierSegment extends PathSegmentBase {
  command: 'Q' | 'q';
  /** Control point */
  controlPoint: PathPoint;
  /** End point */
  point: PathPoint;
}

/**
 * Smooth Quadratic Bezier segment (T/t)
 */
export interface SmoothQuadraticSegment extends PathSegmentBase {
  command: 'T' | 't';
  /** End point */
  point: PathPoint;
}

/**
 * Arc segment (A/a)
 */
export interface ArcSegment extends PathSegmentBase {
  command: 'A' | 'a';
  /** X radius */
  rx: number;
  /** Y radius */
  ry: number;
  /** X-axis rotation in degrees */
  xAxisRotation: number;
  /** Large arc flag */
  largeArcFlag: boolean;
  /** Sweep flag */
  sweepFlag: boolean;
  /** End point */
  point: PathPoint;
}

/**
 * ClosePath segment (Z/z)
 */
export interface ClosePathSegment extends PathSegmentBase {
  command: 'Z' | 'z';
}

/**
 * Union of all segment types
 */
export type PathSegment =
  | MoveToSegment
  | LineToSegment
  | HorizontalLineSegment
  | VerticalLineSegment
  | CubicBezierSegment
  | SmoothCubicSegment
  | QuadraticBezierSegment
  | SmoothQuadraticSegment
  | ArcSegment
  | ClosePathSegment;

/**
 * Editable node in the path editor
 */
export interface PathNode {
  /** Unique ID */
  id: string;
  /** Segment this node belongs to */
  segmentId: string;
  /** Type of node */
  type: 'point' | 'controlPoint1' | 'controlPoint2' | 'controlPoint';
  /** Absolute position */
  position: PathPoint;
  /** Index in segment (for segments with multiple points) */
  index?: number;
}

/**
 * Parsed path data
 */
export interface ParsedPath {
  /** Path segments */
  segments: PathSegment[];
  /** All editable nodes (for visual editor) */
  nodes: PathNode[];
  /** Original path string */
  original: string;
}

// ============================================================================
// Service
// ============================================================================

@Injectable({
  providedIn: 'root'
})
export class PathEditorService {

  private idCounter = 0;

  // ============================================================================
  // State
  // ============================================================================

  private readonly _currentPath = signal<ParsedPath | null>(null);
  private readonly _selectedNodeId = signal<string | null>(null);
  private readonly _isDirty = signal(false);

  /** Current parsed path */
  readonly currentPath = this._currentPath.asReadonly();

  /** Currently selected node ID */
  readonly selectedNodeId = this._selectedNodeId.asReadonly();

  /** Whether the path has unsaved changes */
  readonly isDirty = this._isDirty.asReadonly();

  /** Current segments */
  readonly segments = computed(() => this._currentPath()?.segments ?? []);

  /** Current nodes for visual editing */
  readonly nodes = computed(() => this._currentPath()?.nodes ?? []);

  /** Selected node */
  readonly selectedNode = computed(() => {
    const nodeId = this._selectedNodeId();
    if (!nodeId) return null;
    return this.nodes().find(n => n.id === nodeId) ?? null;
  });

  // ============================================================================
  // Parsing
  // ============================================================================

  /**
   * Parse an SVG path string into structured segments
   */
  parse(d: string): ParsedPath {
    const segments: PathSegment[] = [];
    const nodes: PathNode[] = [];

    if (!d || d.trim().length === 0) {
      return { segments, nodes, original: d };
    }

    // Track current position for absolute coordinates
    let currentX = 0;
    let currentY = 0;
    let startX = 0;
    let startY = 0;

    const commandRegex = /([MmZzLlHhVvCcSsQqTtAa])([^MmZzLlHhVvCcSsQqTtAa]*)/g;
    let match: RegExpExecArray | null;

    while ((match = commandRegex.exec(d)) !== null) {
      const command = match[1] as PathCommandType;
      const argsStr = match[2].trim();
      const args = argsStr.length > 0 ? parsePathNumbers(argsStr) : [];
      const isRelative = command === command.toLowerCase();

      const segmentId = this.generateId();

      switch (command.toUpperCase()) {
        case 'M': {
          for (let i = 0; i < args.length; i += 2) {
            if (i + 1 < args.length) {
              const x = isRelative ? currentX + args[i] : args[i];
              const y = isRelative ? currentY + args[i + 1] : args[i + 1];

              const segment: MoveToSegment = {
                id: i === 0 ? segmentId : this.generateId(),
                command: command as 'M' | 'm',
                isRelative,
                point: { x: args[i], y: args[i + 1] }
              };
              segments.push(segment);

              nodes.push({
                id: this.generateId(),
                segmentId: segment.id,
                type: 'point',
                position: { x, y }
              });

              currentX = x;
              currentY = y;
              if (i === 0) {
                startX = x;
                startY = y;
              }
            }
          }
          break;
        }

        case 'L': {
          for (let i = 0; i < args.length; i += 2) {
            if (i + 1 < args.length) {
              const x = isRelative ? currentX + args[i] : args[i];
              const y = isRelative ? currentY + args[i + 1] : args[i + 1];

              const segment: LineToSegment = {
                id: this.generateId(),
                command: command as 'L' | 'l',
                isRelative,
                point: { x: args[i], y: args[i + 1] }
              };
              segments.push(segment);

              nodes.push({
                id: this.generateId(),
                segmentId: segment.id,
                type: 'point',
                position: { x, y }
              });

              currentX = x;
              currentY = y;
            }
          }
          break;
        }

        case 'H': {
          for (const arg of args) {
            const x = isRelative ? currentX + arg : arg;

            const segment: HorizontalLineSegment = {
              id: this.generateId(),
              command: command as 'H' | 'h',
              isRelative,
              x: arg
            };
            segments.push(segment);

            nodes.push({
              id: this.generateId(),
              segmentId: segment.id,
              type: 'point',
              position: { x, y: currentY }
            });

            currentX = x;
          }
          break;
        }

        case 'V': {
          for (const arg of args) {
            const y = isRelative ? currentY + arg : arg;

            const segment: VerticalLineSegment = {
              id: this.generateId(),
              command: command as 'V' | 'v',
              isRelative,
              y: arg
            };
            segments.push(segment);

            nodes.push({
              id: this.generateId(),
              segmentId: segment.id,
              type: 'point',
              position: { x: currentX, y }
            });

            currentY = y;
          }
          break;
        }

        case 'C': {
          for (let i = 0; i < args.length; i += 6) {
            if (i + 5 < args.length) {
              const x1 = isRelative ? currentX + args[i] : args[i];
              const y1 = isRelative ? currentY + args[i + 1] : args[i + 1];
              const x2 = isRelative ? currentX + args[i + 2] : args[i + 2];
              const y2 = isRelative ? currentY + args[i + 3] : args[i + 3];
              const x = isRelative ? currentX + args[i + 4] : args[i + 4];
              const y = isRelative ? currentY + args[i + 5] : args[i + 5];

              const segment: CubicBezierSegment = {
                id: this.generateId(),
                command: command as 'C' | 'c',
                isRelative,
                controlPoint1: { x: args[i], y: args[i + 1] },
                controlPoint2: { x: args[i + 2], y: args[i + 3] },
                point: { x: args[i + 4], y: args[i + 5] }
              };
              segments.push(segment);

              // Add control point nodes
              nodes.push({
                id: this.generateId(),
                segmentId: segment.id,
                type: 'controlPoint1',
                position: { x: x1, y: y1 }
              });
              nodes.push({
                id: this.generateId(),
                segmentId: segment.id,
                type: 'controlPoint2',
                position: { x: x2, y: y2 }
              });
              nodes.push({
                id: this.generateId(),
                segmentId: segment.id,
                type: 'point',
                position: { x, y }
              });

              currentX = x;
              currentY = y;
            }
          }
          break;
        }

        case 'S': {
          for (let i = 0; i < args.length; i += 4) {
            if (i + 3 < args.length) {
              const x2 = isRelative ? currentX + args[i] : args[i];
              const y2 = isRelative ? currentY + args[i + 1] : args[i + 1];
              const x = isRelative ? currentX + args[i + 2] : args[i + 2];
              const y = isRelative ? currentY + args[i + 3] : args[i + 3];

              const segment: SmoothCubicSegment = {
                id: this.generateId(),
                command: command as 'S' | 's',
                isRelative,
                controlPoint2: { x: args[i], y: args[i + 1] },
                point: { x: args[i + 2], y: args[i + 3] }
              };
              segments.push(segment);

              nodes.push({
                id: this.generateId(),
                segmentId: segment.id,
                type: 'controlPoint2',
                position: { x: x2, y: y2 }
              });
              nodes.push({
                id: this.generateId(),
                segmentId: segment.id,
                type: 'point',
                position: { x, y }
              });

              currentX = x;
              currentY = y;
            }
          }
          break;
        }

        case 'Q': {
          for (let i = 0; i < args.length; i += 4) {
            if (i + 3 < args.length) {
              const x1 = isRelative ? currentX + args[i] : args[i];
              const y1 = isRelative ? currentY + args[i + 1] : args[i + 1];
              const x = isRelative ? currentX + args[i + 2] : args[i + 2];
              const y = isRelative ? currentY + args[i + 3] : args[i + 3];

              const segment: QuadraticBezierSegment = {
                id: this.generateId(),
                command: command as 'Q' | 'q',
                isRelative,
                controlPoint: { x: args[i], y: args[i + 1] },
                point: { x: args[i + 2], y: args[i + 3] }
              };
              segments.push(segment);

              nodes.push({
                id: this.generateId(),
                segmentId: segment.id,
                type: 'controlPoint',
                position: { x: x1, y: y1 }
              });
              nodes.push({
                id: this.generateId(),
                segmentId: segment.id,
                type: 'point',
                position: { x, y }
              });

              currentX = x;
              currentY = y;
            }
          }
          break;
        }

        case 'T': {
          for (let i = 0; i < args.length; i += 2) {
            if (i + 1 < args.length) {
              const x = isRelative ? currentX + args[i] : args[i];
              const y = isRelative ? currentY + args[i + 1] : args[i + 1];

              const segment: SmoothQuadraticSegment = {
                id: this.generateId(),
                command: command as 'T' | 't',
                isRelative,
                point: { x: args[i], y: args[i + 1] }
              };
              segments.push(segment);

              nodes.push({
                id: this.generateId(),
                segmentId: segment.id,
                type: 'point',
                position: { x, y }
              });

              currentX = x;
              currentY = y;
            }
          }
          break;
        }

        case 'A': {
          for (let i = 0; i < args.length; i += 7) {
            if (i + 6 < args.length) {
              const x = isRelative ? currentX + args[i + 5] : args[i + 5];
              const y = isRelative ? currentY + args[i + 6] : args[i + 6];

              const segment: ArcSegment = {
                id: this.generateId(),
                command: command as 'A' | 'a',
                isRelative,
                rx: args[i],
                ry: args[i + 1],
                xAxisRotation: args[i + 2],
                largeArcFlag: args[i + 3] !== 0,
                sweepFlag: args[i + 4] !== 0,
                point: { x: args[i + 5], y: args[i + 6] }
              };
              segments.push(segment);

              nodes.push({
                id: this.generateId(),
                segmentId: segment.id,
                type: 'point',
                position: { x, y }
              });

              currentX = x;
              currentY = y;
            }
          }
          break;
        }

        case 'Z': {
          const segment: ClosePathSegment = {
            id: this.generateId(),
            command: command as 'Z' | 'z',
            isRelative
          };
          segments.push(segment);

          currentX = startX;
          currentY = startY;
          break;
        }
      }
    }

    return { segments, nodes, original: d };
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  /**
   * Serialize segments back to SVG path string
   */
  serialize(segments: PathSegment[]): string {
    const parts: string[] = [];

    for (const segment of segments) {
      parts.push(this.serializeSegment(segment));
    }

    return parts.join(' ');
  }

  /**
   * Serialize a single segment
   */
  private serializeSegment(segment: PathSegment): string {
    switch (segment.command.toUpperCase()) {
      case 'M':
      case 'L':
      case 'T': {
        const s = segment as MoveToSegment | LineToSegment | SmoothQuadraticSegment;
        return `${segment.command}${s.point.x},${s.point.y}`;
      }
      case 'H': {
        const s = segment as HorizontalLineSegment;
        return `${segment.command}${s.x}`;
      }
      case 'V': {
        const s = segment as VerticalLineSegment;
        return `${segment.command}${s.y}`;
      }
      case 'C': {
        const s = segment as CubicBezierSegment;
        return `${segment.command}${s.controlPoint1.x},${s.controlPoint1.y} ${s.controlPoint2.x},${s.controlPoint2.y} ${s.point.x},${s.point.y}`;
      }
      case 'S': {
        const s = segment as SmoothCubicSegment;
        return `${segment.command}${s.controlPoint2.x},${s.controlPoint2.y} ${s.point.x},${s.point.y}`;
      }
      case 'Q': {
        const s = segment as QuadraticBezierSegment;
        return `${segment.command}${s.controlPoint.x},${s.controlPoint.y} ${s.point.x},${s.point.y}`;
      }
      case 'A': {
        const s = segment as ArcSegment;
        return `${segment.command}${s.rx},${s.ry} ${s.xAxisRotation} ${s.largeArcFlag ? 1 : 0} ${s.sweepFlag ? 1 : 0} ${s.point.x},${s.point.y}`;
      }
      case 'Z':
        return segment.command;
      default:
        return '';
    }
  }

  // ============================================================================
  // Editing Operations
  // ============================================================================

  /**
   * Load a path for editing
   */
  loadPath(d: string): void {
    const parsed = this.parse(d);
    this._currentPath.set(parsed);
    this._selectedNodeId.set(null);
    this._isDirty.set(false);
  }

  /**
   * Clear the current path
   */
  clearPath(): void {
    this._currentPath.set(null);
    this._selectedNodeId.set(null);
    this._isDirty.set(false);
  }

  /**
   * Select a node
   */
  selectNode(nodeId: string | null): void {
    this._selectedNodeId.set(nodeId);
  }

  /**
   * Move a node to a new position
   */
  moveNode(nodeId: string, newPosition: PathPoint): void {
    const path = this._currentPath();
    if (!path) return;

    const nodeIndex = path.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) return;

    const node = path.nodes[nodeIndex];
    const segmentIndex = path.segments.findIndex(s => s.id === node.segmentId);
    if (segmentIndex === -1) return;

    const segment = path.segments[segmentIndex];

    // Calculate delta for relative commands
    const deltaX = newPosition.x - node.position.x;
    const deltaY = newPosition.y - node.position.y;

    // Update segment based on node type
    const updatedSegment = this.updateSegmentPoint(segment, node.type, newPosition, deltaX, deltaY);

    // Update segments array (keeping IDs)
    const updatedSegments = [...path.segments];
    updatedSegments[segmentIndex] = updatedSegment;

    // Update nodes array (keeping IDs) - just update the position of this node
    const updatedNodes = [...path.nodes];
    updatedNodes[nodeIndex] = {
      ...node,
      position: { ...newPosition }
    };

    // Update path without re-parsing (preserves IDs)
    this._currentPath.set({
      ...path,
      segments: updatedSegments,
      nodes: updatedNodes
    });
    this._isDirty.set(true);
  }

  /**
   * Update a segment's point based on node type
   */
  private updateSegmentPoint(
    segment: PathSegment,
    nodeType: PathNode['type'],
    newPosition: PathPoint,
    deltaX: number,
    deltaY: number
  ): PathSegment {
    const useAbsolute = !segment.isRelative;

    switch (segment.command.toUpperCase()) {
      case 'M':
      case 'L':
      case 'T': {
        const s = segment as MoveToSegment | LineToSegment | SmoothQuadraticSegment;
        if (nodeType === 'point') {
          return {
            ...s,
            point: useAbsolute ? newPosition : { x: s.point.x + deltaX, y: s.point.y + deltaY }
          };
        }
        return segment;
      }

      case 'H': {
        const s = segment as HorizontalLineSegment;
        if (nodeType === 'point') {
          return { ...s, x: useAbsolute ? newPosition.x : s.x + deltaX };
        }
        return segment;
      }

      case 'V': {
        const s = segment as VerticalLineSegment;
        if (nodeType === 'point') {
          return { ...s, y: useAbsolute ? newPosition.y : s.y + deltaY };
        }
        return segment;
      }

      case 'C': {
        const s = segment as CubicBezierSegment;
        if (nodeType === 'point') {
          return {
            ...s,
            point: useAbsolute ? newPosition : { x: s.point.x + deltaX, y: s.point.y + deltaY }
          };
        } else if (nodeType === 'controlPoint1') {
          return {
            ...s,
            controlPoint1: useAbsolute ? newPosition : { x: s.controlPoint1.x + deltaX, y: s.controlPoint1.y + deltaY }
          };
        } else if (nodeType === 'controlPoint2') {
          return {
            ...s,
            controlPoint2: useAbsolute ? newPosition : { x: s.controlPoint2.x + deltaX, y: s.controlPoint2.y + deltaY }
          };
        }
        return segment;
      }

      case 'S': {
        const s = segment as SmoothCubicSegment;
        if (nodeType === 'point') {
          return {
            ...s,
            point: useAbsolute ? newPosition : { x: s.point.x + deltaX, y: s.point.y + deltaY }
          };
        } else if (nodeType === 'controlPoint2') {
          return {
            ...s,
            controlPoint2: useAbsolute ? newPosition : { x: s.controlPoint2.x + deltaX, y: s.controlPoint2.y + deltaY }
          };
        }
        return segment;
      }

      case 'Q': {
        const s = segment as QuadraticBezierSegment;
        if (nodeType === 'point') {
          return {
            ...s,
            point: useAbsolute ? newPosition : { x: s.point.x + deltaX, y: s.point.y + deltaY }
          };
        } else if (nodeType === 'controlPoint') {
          return {
            ...s,
            controlPoint: useAbsolute ? newPosition : { x: s.controlPoint.x + deltaX, y: s.controlPoint.y + deltaY }
          };
        }
        return segment;
      }

      case 'A': {
        const s = segment as ArcSegment;
        if (nodeType === 'point') {
          return {
            ...s,
            point: useAbsolute ? newPosition : { x: s.point.x + deltaX, y: s.point.y + deltaY }
          };
        }
        return segment;
      }

      default:
        return segment;
    }
  }

  /**
   * Update path from text editor (re-parse)
   */
  updateFromText(d: string): void {
    const parsed = this.parse(d);
    const currentPath = this._currentPath();
    parsed.original = currentPath?.original ?? d;
    this._currentPath.set(parsed);
    this._isDirty.set(true);
  }

  /**
   * Get current path as string
   */
  getCurrentPathString(): string {
    const path = this._currentPath();
    if (!path) return '';
    return this.serialize(path.segments);
  }

  /**
   * Delete a segment
   */
  deleteSegment(segmentId: string): void {
    const path = this._currentPath();
    if (!path) return;

    const updatedSegments = path.segments.filter(s => s.id !== segmentId);
    const newPath = this.parse(this.serialize(updatedSegments));
    newPath.original = path.original;

    this._currentPath.set(newPath);
    this._selectedNodeId.set(null);
    this._isDirty.set(true);
  }

  /**
   * Convert segment to a different type (e.g., line to curve)
   */
  convertSegmentType(segmentId: string, newType: 'L' | 'C' | 'Q'): void {
    const path = this._currentPath();
    if (!path) return;

    const segmentIndex = path.segments.findIndex(s => s.id === segmentId);
    if (segmentIndex === -1) return;

    const segment = path.segments[segmentIndex];
    let newSegment: PathSegment;

    // Get the end point of the current segment
    let endPoint: PathPoint = { x: 0, y: 0 };
    if ('point' in segment) {
      endPoint = (segment as { point: PathPoint }).point;
    }

    // Get the start point (from previous segment or 0,0)
    let startPoint: PathPoint = { x: 0, y: 0 };
    if (segmentIndex > 0) {
      const prevSeg = path.segments[segmentIndex - 1];
      if ('point' in prevSeg) {
        startPoint = (prevSeg as { point: PathPoint }).point;
      }
    }

    switch (newType) {
      case 'L':
        newSegment = {
          id: segment.id,
          command: segment.isRelative ? 'l' : 'L',
          isRelative: segment.isRelative,
          point: endPoint
        } as LineToSegment;
        break;
      case 'C': {
        // Create a cubic bezier with control points at 1/3 and 2/3 of the line
        const cp1: PathPoint = {
          x: startPoint.x + (endPoint.x - startPoint.x) / 3,
          y: startPoint.y + (endPoint.y - startPoint.y) / 3
        };
        const cp2: PathPoint = {
          x: startPoint.x + (endPoint.x - startPoint.x) * 2 / 3,
          y: startPoint.y + (endPoint.y - startPoint.y) * 2 / 3
        };
        newSegment = {
          id: segment.id,
          command: segment.isRelative ? 'c' : 'C',
          isRelative: segment.isRelative,
          controlPoint1: cp1,
          controlPoint2: cp2,
          point: endPoint
        } as CubicBezierSegment;
        break;
      }
      case 'Q': {
        // Create a quadratic bezier with control point at midpoint
        const cp: PathPoint = {
          x: (startPoint.x + endPoint.x) / 2,
          y: (startPoint.y + endPoint.y) / 2
        };
        newSegment = {
          id: segment.id,
          command: segment.isRelative ? 'q' : 'Q',
          isRelative: segment.isRelative,
          controlPoint: cp,
          point: endPoint
        } as QuadraticBezierSegment;
        break;
      }
      default:
        return;
    }

    const updatedSegments = [...path.segments];
    updatedSegments[segmentIndex] = newSegment;

    const newPath = this.parse(this.serialize(updatedSegments));
    newPath.original = path.original;

    this._currentPath.set(newPath);
    this._isDirty.set(true);
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private generateId(): string {
    return `path-${++this.idCounter}-${Date.now()}`;
  }

  /**
   * Get absolute position of a node considering relative commands
   */
  getAbsolutePosition(node: PathNode): PathPoint {
    return node.position; // Already calculated as absolute during parsing
  }

  /**
   * Check if a segment is a curve (has control points)
   */
  isCurveSegment(segment: PathSegment): boolean {
    return ['C', 'c', 'S', 's', 'Q', 'q'].includes(segment.command);
  }

  /**
   * Normalize path coordinates to start at (0,0) or positive values.
   * Returns the normalized path string and the offset to add to the primitive's position.
   */
  normalizePath(d: string): { normalizedPath: string; offset: { x: number; y: number } } {
    const parsed = this.parse(d);
    if (parsed.nodes.length === 0) {
      return { normalizedPath: d, offset: { x: 0, y: 0 } };
    }

    // Find min coordinates from all nodes
    let minX = Infinity, minY = Infinity;
    for (const node of parsed.nodes) {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
    }

    // If already normalized (all coordinates >= 0), return as-is
    if (minX >= 0 && minY >= 0) {
      return { normalizedPath: d, offset: { x: 0, y: 0 } };
    }

    // Shift coordinates so minimum is at 0
    // Only shift the axis that has negative values
    const shiftX = minX < 0 ? -minX : 0;
    const shiftY = minY < 0 ? -minY : 0;

    const shiftedSegments = parsed.segments.map(segment => this.shiftSegment(segment, shiftX, shiftY));
    const normalizedPath = this.serialize(shiftedSegments);

    return {
      normalizedPath,
      offset: {
        x: minX < 0 ? minX : 0,
        y: minY < 0 ? minY : 0
      }
    };
  }

  /**
   * Shift a segment's coordinates by the given offset.
   * Used to bake position into path coordinates.
   */
  shiftSegment(segment: PathSegment, shiftX: number, shiftY: number): PathSegment {
    // Only shift absolute commands (uppercase)
    if (segment.isRelative) {
      return segment;
    }

    switch (segment.command) {
      case 'M':
      case 'L':
      case 'T': {
        const s = segment as MoveToSegment | LineToSegment | SmoothQuadraticSegment;
        return {
          ...s,
          point: { x: s.point.x + shiftX, y: s.point.y + shiftY }
        };
      }
      case 'H': {
        const s = segment as HorizontalLineSegment;
        return { ...s, x: s.x + shiftX };
      }
      case 'V': {
        const s = segment as VerticalLineSegment;
        return { ...s, y: s.y + shiftY };
      }
      case 'C': {
        const s = segment as CubicBezierSegment;
        return {
          ...s,
          controlPoint1: { x: s.controlPoint1.x + shiftX, y: s.controlPoint1.y + shiftY },
          controlPoint2: { x: s.controlPoint2.x + shiftX, y: s.controlPoint2.y + shiftY },
          point: { x: s.point.x + shiftX, y: s.point.y + shiftY }
        };
      }
      case 'S': {
        const s = segment as SmoothCubicSegment;
        return {
          ...s,
          controlPoint2: { x: s.controlPoint2.x + shiftX, y: s.controlPoint2.y + shiftY },
          point: { x: s.point.x + shiftX, y: s.point.y + shiftY }
        };
      }
      case 'Q': {
        const s = segment as QuadraticBezierSegment;
        return {
          ...s,
          controlPoint: { x: s.controlPoint.x + shiftX, y: s.controlPoint.y + shiftY },
          point: { x: s.point.x + shiftX, y: s.point.y + shiftY }
        };
      }
      case 'A': {
        const s = segment as ArcSegment;
        return {
          ...s,
          point: { x: s.point.x + shiftX, y: s.point.y + shiftY }
        };
      }
      default:
        return segment;
    }
  }
}
