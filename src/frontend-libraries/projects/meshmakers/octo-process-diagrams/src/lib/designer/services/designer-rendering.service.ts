import { Injectable } from '@angular/core';
import { PrimitiveBase, GroupPrimitive } from '../../primitives';
import {
  ProcessDiagramConfig,
  ProcessElement,
  ProcessConnection,
  Position
} from '../../process-widget.models';
import { SymbolInstance } from '../../primitives/models/symbol.model';
import { BoundingBox } from './designer-grouping.service';

/**
 * Port type definition
 */
export type PortType = 'top' | 'bottom' | 'left' | 'right' | 'center';

/**
 * Connection path style
 */
export type ConnectionPathStyle = 'straight' | 'orthogonal' | 'curved';

/**
 * Symbol bounds resolver function type
 * (Named differently to avoid conflict with SymbolBoundsProvider from designer-grouping.service)
 */
export type SymbolBoundsResolver = (symbolRtId: string) => BoundingBox | null;

/**
 * Primitive bounds provider interface
 */
export interface PrimitiveBoundsProvider {
  getBoundingBox(primitive: PrimitiveBase): BoundingBox | null;
}

/**
 * Designer Rendering Service
 *
 * Handles rendering calculations for diagram elements:
 * - Connection path generation
 * - Port position calculation
 * - Bounding box calculation
 * - Transform string generation
 *
 * Follows Single Responsibility Principle - only handles rendering logic.
 *
 * Usage:
 * ```typescript
 * private readonly renderingService = inject(DesignerRenderingService);
 *
 * // Get connection path
 * const path = this.renderingService.getConnectionPath(connection, diagram);
 *
 * // Get port position
 * const portPos = this.renderingService.getPortPosition(element, 'right');
 *
 * // Get element bounds
 * const bounds = this.renderingService.getElementBounds(element);
 * ```
 */
@Injectable()
export class DesignerRenderingService {

  // ============================================================================
  // Connection Path Generation
  // ============================================================================

  /**
   * Generate SVG path for a connection between elements.
   *
   * @param connection Connection definition
   * @param diagram Diagram containing elements
   * @param style Path style (default: straight)
   * @returns SVG path string
   */
  getConnectionPath(
    connection: ProcessConnection,
    diagram: ProcessDiagramConfig,
    style: ConnectionPathStyle = 'straight'
  ): string {
    const fromElement = diagram.elements.find(e => e.id === connection.from.elementId);
    const toElement = diagram.elements.find(e => e.id === connection.to.elementId);

    if (!fromElement || !toElement) return '';

    const fromPoint = this.getPortPosition(fromElement, connection.from.port as PortType);
    const toPoint = this.getPortPosition(toElement, connection.to.port as PortType);

    switch (style) {
      case 'orthogonal':
        return this.generateOrthogonalPath(fromPoint, toPoint, connection.from.port, connection.to.port);
      case 'curved':
        return this.generateCurvedPath(fromPoint, toPoint);
      case 'straight':
      default:
        return `M ${fromPoint.x},${fromPoint.y} L ${toPoint.x},${toPoint.y}`;
    }
  }

  /**
   * Generate an orthogonal (right-angle) path between two points.
   *
   * @param from Start point
   * @param to End point
   * @param fromPort Source port direction
   * @param toPort Target port direction
   * @returns SVG path string
   */
  private generateOrthogonalPath(
    from: Position,
    to: Position,
    fromPort: string,
    toPort: string
  ): string {
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;

    // Determine path based on port directions
    if ((fromPort === 'right' && toPort === 'left') ||
        (fromPort === 'left' && toPort === 'right')) {
      // Horizontal routing
      return `M ${from.x},${from.y} L ${midX},${from.y} L ${midX},${to.y} L ${to.x},${to.y}`;
    } else if ((fromPort === 'bottom' && toPort === 'top') ||
               (fromPort === 'top' && toPort === 'bottom')) {
      // Vertical routing
      return `M ${from.x},${from.y} L ${from.x},${midY} L ${to.x},${midY} L ${to.x},${to.y}`;
    } else {
      // Mixed routing - go horizontal then vertical
      return `M ${from.x},${from.y} L ${to.x},${from.y} L ${to.x},${to.y}`;
    }
  }

  /**
   * Generate a curved (bezier) path between two points.
   *
   * @param from Start point
   * @param to End point
   * @returns SVG path string
   */
  private generateCurvedPath(from: Position, to: Position): string {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const controlOffset = Math.min(Math.abs(dx), Math.abs(dy)) / 2;

    // Use quadratic bezier for smooth curve
    const cx = from.x + dx / 2;
    const cy = from.y + dy / 2 - controlOffset;

    return `M ${from.x},${from.y} Q ${cx},${cy} ${to.x},${to.y}`;
  }

  // ============================================================================
  // Port Position Calculation
  // ============================================================================

  /**
   * Get the position of a port on an element.
   *
   * @param element Element with ports
   * @param port Port identifier
   * @returns Port position in canvas coordinates
   */
  getPortPosition(element: ProcessElement, port: PortType | string): Position {
    const x = element.position.x;
    const y = element.position.y;
    const w = element.size.width;
    const h = element.size.height;

    switch (port) {
      case 'top':
        return { x: x + w / 2, y: y };
      case 'bottom':
        return { x: x + w / 2, y: y + h };
      case 'left':
        return { x: x, y: y + h / 2 };
      case 'right':
        return { x: x + w, y: y + h / 2 };
      case 'center':
      default:
        return { x: x + w / 2, y: y + h / 2 };
    }
  }

  /**
   * Get all port positions for an element.
   *
   * @param element Element
   * @returns Map of port name to position
   */
  getAllPortPositions(element: ProcessElement): Map<PortType, Position> {
    const ports: PortType[] = ['top', 'bottom', 'left', 'right', 'center'];
    const positions = new Map<PortType, Position>();

    for (const port of ports) {
      positions.set(port, this.getPortPosition(element, port));
    }

    return positions;
  }

  /**
   * Find the nearest port on an element to a given position.
   *
   * @param element Element with ports
   * @param position Target position
   * @returns Nearest port type
   */
  findNearestPort(element: ProcessElement, position: Position): PortType {
    const ports = this.getAllPortPositions(element);
    let nearestPort: PortType = 'center';
    let minDistance = Infinity;

    for (const [port, portPos] of ports) {
      const distance = this.calculateDistance(position, portPos);
      if (distance < minDistance) {
        minDistance = distance;
        nearestPort = port;
      }
    }

    return nearestPort;
  }

  // ============================================================================
  // Bounding Box Calculation
  // ============================================================================

  /**
   * Get bounding box for a process element.
   *
   * @param element Element
   * @returns Bounding box
   */
  getElementBounds(element: ProcessElement): BoundingBox {
    return {
      x: element.position.x,
      y: element.position.y,
      width: element.size.width,
      height: element.size.height
    };
  }

  /**
   * Get bounding box for a symbol instance.
   *
   * @param symbol Symbol instance
   * @param symbolBoundsResolver Function to get symbol definition bounds
   * @returns Bounding box
   */
  getSymbolBounds(
    symbol: SymbolInstance,
    symbolBoundsResolver?: SymbolBoundsResolver
  ): BoundingBox {
    const scale = symbol.scale ?? 1;

    // Try to get bounds from provider
    if (symbolBoundsResolver) {
      const defBounds = symbolBoundsResolver(symbol.symbolRtId);
      if (defBounds) {
        return {
          x: symbol.position.x,
          y: symbol.position.y,
          width: defBounds.width * scale,
          height: defBounds.height * scale
        };
      }
    }

    // Default bounds if no definition available
    return {
      x: symbol.position.x,
      y: symbol.position.y,
      width: 100 * scale,
      height: 100 * scale
    };
  }

  /**
   * Get bounding box for a primitive.
   *
   * @param primitive Primitive
   * @param boundsProvider Optional bounds provider for complex primitives
   * @returns Bounding box
   */
  getPrimitiveBounds(
    primitive: PrimitiveBase,
    boundsProvider?: PrimitiveBoundsProvider
  ): BoundingBox {
    // Handle groups specially
    if (primitive.type === 'group') {
      const config = (primitive as GroupPrimitive).config;
      return {
        x: primitive.position.x,
        y: primitive.position.y,
        width: config?.originalBounds?.width ?? 100,
        height: config?.originalBounds?.height ?? 100
      };
    }

    // Try bounds provider
    if (boundsProvider) {
      const bounds = boundsProvider.getBoundingBox(primitive);
      if (bounds) return bounds;
    }

    // Fallback based on primitive type
    return this.calculatePrimitiveBounds(primitive);
  }

  /**
   * Calculate bounds for a primitive based on its type.
   */
  private calculatePrimitiveBounds(primitive: PrimitiveBase): BoundingBox {
    switch (primitive.type) {
      case 'rectangle': {
        const rect = primitive as any;
        return {
          x: primitive.position.x,
          y: primitive.position.y,
          width: rect.width ?? 100,
          height: rect.height ?? 80
        };
      }

      case 'ellipse': {
        const ellipse = primitive as any;
        const rx = ellipse.rx ?? 50;
        const ry = ellipse.ry ?? 40;
        return {
          x: primitive.position.x - rx,
          y: primitive.position.y - ry,
          width: rx * 2,
          height: ry * 2
        };
      }

      case 'line': {
        const line = primitive as any;
        const x1 = line.x1 ?? primitive.position.x;
        const y1 = line.y1 ?? primitive.position.y;
        const x2 = line.x2 ?? x1 + 100;
        const y2 = line.y2 ?? y1;
        return {
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          width: Math.abs(x2 - x1),
          height: Math.abs(y2 - y1) || 1
        };
      }

      case 'polygon':
      case 'polyline': {
        const poly = primitive as any;
        if (poly.points && poly.points.length > 0) {
          return this.calculatePointsBounds(poly.points);
        }
        return {
          x: primitive.position.x,
          y: primitive.position.y,
          width: 100,
          height: 100
        };
      }

      case 'image': {
        const img = primitive as any;
        return {
          x: primitive.position.x,
          y: primitive.position.y,
          width: img.width ?? 100,
          height: img.height ?? 100
        };
      }

      case 'text': {
        const text = primitive as any;
        // Approximate text bounds
        const textLength = (text.text ?? '').length;
        const fontSize = text.fontSize ?? 16;
        return {
          x: primitive.position.x,
          y: primitive.position.y - fontSize,
          width: textLength * fontSize * 0.6,
          height: fontSize * 1.2
        };
      }

      default:
        return {
          x: primitive.position.x,
          y: primitive.position.y,
          width: 100,
          height: 100
        };
    }
  }

  /**
   * Calculate bounding box from array of points.
   */
  private calculatePointsBounds(points: Position[]): BoundingBox {
    if (points.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Get combined bounding box for multiple items.
   *
   * @param boxes Array of bounding boxes
   * @returns Combined bounding box
   */
  getCombinedBounds(boxes: BoundingBox[]): BoundingBox | null {
    if (boxes.length === 0) return null;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const box of boxes) {
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  // ============================================================================
  // Transform Generation
  // ============================================================================

  /**
   * Generate SVG transform string for a symbol instance.
   *
   * @param symbol Symbol instance
   * @param symbolBoundsResolver Function to get symbol definition bounds
   * @returns SVG transform attribute value
   */
  getSymbolTransform(symbol: SymbolInstance, symbolBoundsResolver?: SymbolBoundsResolver): string {
    const transforms: string[] = [];
    const scale = symbol.scale ?? 1;
    const rotation = symbol.rotation ?? 0;

    // Translate to position
    transforms.push(`translate(${symbol.position.x}, ${symbol.position.y})`);

    // Apply rotation around center if needed
    if (rotation !== 0) {
      const bounds = this.getSymbolBounds(symbol, symbolBoundsResolver);
      const cx = bounds.width / 2;
      const cy = bounds.height / 2;
      transforms.push(`rotate(${rotation}, ${cx}, ${cy})`);
    }

    // Apply scale if needed
    if (scale !== 1) {
      transforms.push(`scale(${scale})`);
    }

    return transforms.join(' ');
  }

  /**
   * Generate SVG transform string for a primitive.
   *
   * @param primitive Primitive
   * @param rotation Optional rotation angle
   * @returns SVG transform attribute value
   */
  getPrimitiveTransform(primitive: PrimitiveBase, rotation?: number): string {
    const transforms: string[] = [];

    // Translate to position
    transforms.push(`translate(${primitive.position.x}, ${primitive.position.y})`);

    // Apply rotation if needed
    if (rotation && rotation !== 0) {
      const bounds = this.getPrimitiveBounds(primitive);
      const cx = bounds.width / 2;
      const cy = bounds.height / 2;
      transforms.push(`rotate(${rotation}, ${cx}, ${cy})`);
    }

    return transforms.join(' ');
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Calculate distance between two positions.
   */
  calculateDistance(p1: Position, p2: Position): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Check if a point is inside a bounding box.
   *
   * @param point Point to check
   * @param bounds Bounding box
   * @param padding Optional padding around bounds
   * @returns True if point is inside
   */
  isPointInBounds(point: Position, bounds: BoundingBox, padding = 0): boolean {
    return (
      point.x >= bounds.x - padding &&
      point.x <= bounds.x + bounds.width + padding &&
      point.y >= bounds.y - padding &&
      point.y <= bounds.y + bounds.height + padding
    );
  }

  /**
   * Check if two bounding boxes intersect.
   *
   * @param a First bounding box
   * @param b Second bounding box
   * @returns True if boxes intersect
   */
  doBoundsIntersect(a: BoundingBox, b: BoundingBox): boolean {
    return !(
      a.x + a.width < b.x ||
      b.x + b.width < a.x ||
      a.y + a.height < b.y ||
      b.y + b.height < a.y
    );
  }

  /**
   * Check if bounding box A contains bounding box B.
   *
   * @param container Container bounding box
   * @param contained Potentially contained bounding box
   * @returns True if A contains B
   */
  doesBoundsContain(container: BoundingBox, contained: BoundingBox): boolean {
    return (
      container.x <= contained.x &&
      container.y <= contained.y &&
      container.x + container.width >= contained.x + contained.width &&
      container.y + container.height >= contained.y + contained.height
    );
  }

  /**
   * Get the center point of a bounding box.
   *
   * @param bounds Bounding box
   * @returns Center position
   */
  getBoundsCenter(bounds: BoundingBox): Position {
    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    };
  }

  /**
   * Expand a bounding box by a padding amount.
   *
   * @param bounds Original bounds
   * @param padding Padding to add on all sides
   * @returns Expanded bounds
   */
  expandBounds(bounds: BoundingBox, padding: number): BoundingBox {
    return {
      x: bounds.x - padding,
      y: bounds.y - padding,
      width: bounds.width + padding * 2,
      height: bounds.height + padding * 2
    };
  }
}
