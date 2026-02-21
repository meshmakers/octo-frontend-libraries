import { Injectable } from '@angular/core';
import {
  PrimitiveBase,
  PrimitiveType,
  PrimitiveTypeValue,
  createRectangle,
  createEllipse,
  createLine,
  createPath,
  createPolygon,
  createPolyline,
  createImage,
  createText
} from '../../primitives';
import {
  ProcessDiagramConfig,
  ProcessElement,
  ProcessElementType,
  Position,
  Size
} from '../../process-widget.models';
import { SymbolInstance } from '../../primitives/models/symbol.model';

/**
 * Symbol instance creation options
 */
export interface SymbolInstanceOptions {
  scale?: number;
  rotation?: number;
  name?: string;
}

/**
 * Designer Creation Service
 *
 * Handles creation of diagram elements, primitives, symbols, and diagrams.
 * Provides ID generation and default configurations.
 *
 * Follows Single Responsibility Principle - only handles creation logic.
 *
 * Usage:
 * ```typescript
 * private readonly creationService = inject(DesignerCreationService);
 *
 * // Generate unique ID
 * const id = this.creationService.generateId();
 *
 * // Create element
 * const element = this.creationService.createDefaultElement('tank', position);
 *
 * // Create primitive
 * const primitive = this.creationService.createDefaultPrimitive('rectangle', position);
 *
 * // Create symbol instance
 * const symbol = this.creationService.createSymbolInstance(libraryRtId, symbolRtId, position);
 * ```
 */
@Injectable()
export class DesignerCreationService {

  // ============================================================================
  // ID Generation
  // ============================================================================

  /**
   * Generate a unique ID for diagram elements.
   *
   * @param prefix Optional prefix (defaults to 'elem')
   * @returns Unique ID string
   */
  generateId(prefix = 'elem'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============================================================================
  // Default Sizes
  // ============================================================================

  /**
   * Get default size for a process element type.
   *
   * @param type Element type
   * @returns Default size
   */
  getDefaultElementSize(type: ProcessElementType): Size {
    const sizes: Record<ProcessElementType, Size> = {
      tank: { width: 80, height: 120 },
      silo: { width: 60, height: 100 },
      vessel: { width: 80, height: 100 },
      pipe: { width: 100, height: 20 },
      valve: { width: 40, height: 40 },
      pump: { width: 50, height: 50 },
      motor: { width: 60, height: 40 },
      gauge: { width: 80, height: 80 },
      digitalDisplay: { width: 100, height: 40 },
      statusLight: { width: 30, height: 30 },
      label: { width: 100, height: 30 },
      image: { width: 100, height: 100 },
      shape: { width: 80, height: 80 },
      customSvg: { width: 100, height: 100 }
    };
    return sizes[type] ?? { width: 80, height: 80 };
  }

  /**
   * Get default size for a primitive type.
   *
   * @param type Primitive type
   * @returns Default size
   */
  getDefaultPrimitiveSize(type: PrimitiveTypeValue): Size {
    const sizes: Record<string, Size> = {
      [PrimitiveType.Rectangle]: { width: 100, height: 80 },
      [PrimitiveType.Ellipse]: { width: 100, height: 80 },
      [PrimitiveType.Line]: { width: 100, height: 0 },
      [PrimitiveType.Path]: { width: 50, height: 50 },
      [PrimitiveType.Polygon]: { width: 100, height: 100 },
      [PrimitiveType.Polyline]: { width: 90, height: 70 },
      [PrimitiveType.Image]: { width: 100, height: 100 },
      [PrimitiveType.Text]: { width: 100, height: 24 }
    };
    return sizes[type] ?? { width: 100, height: 80 };
  }

  // ============================================================================
  // Element Creation
  // ============================================================================

  /**
   * Create a default process element.
   *
   * @param type Element type
   * @param position Position on canvas
   * @param id Optional ID (auto-generated if not provided)
   * @returns New process element
   */
  createDefaultElement(
    type: ProcessElementType,
    position: Position,
    id?: string
  ): ProcessElement {
    const elementId = id ?? this.generateId();
    const size = this.getDefaultElementSize(type);

    const base = {
      id: elementId,
      type,
      name: `${type}-${elementId.slice(-4)}`,
      position,
      size,
      visible: true,
      style: {
        fillColor: undefined as string | undefined,
        strokeColor: undefined as string | undefined,
        strokeWidth: undefined as number | undefined,
        opacity: undefined as number | undefined
      }
    };

    // Return type-specific defaults
    switch (type) {
      case 'tank':
        return {
          ...base,
          type: 'tank',
          config: { shape: 'cylindrical', orientation: 'vertical', showLevel: true, showPercentage: true }
        } as ProcessElement;
      case 'silo':
        return {
          ...base,
          type: 'silo',
          config: { showLevel: true, showPercentage: true }
        } as ProcessElement;
      case 'vessel':
        return {
          ...base,
          type: 'vessel',
          config: { shape: 'round', showLevel: true, showPercentage: true }
        } as ProcessElement;
      case 'valve':
        return {
          ...base,
          type: 'valve',
          config: { valveType: 'gate', showState: true }
        } as ProcessElement;
      case 'pump':
        return {
          ...base,
          type: 'pump',
          config: { pumpType: 'centrifugal', showAnimation: true, showState: true }
        } as ProcessElement;
      case 'motor':
        return {
          ...base,
          type: 'motor',
          config: { showAnimation: true, showState: true }
        } as ProcessElement;
      case 'gauge':
        return {
          ...base,
          type: 'gauge',
          config: { gaugeType: 'arc', min: 0, max: 100, showValue: true }
        } as ProcessElement;
      case 'digitalDisplay':
        return {
          ...base,
          type: 'digitalDisplay',
          config: { digits: 4 }
        } as ProcessElement;
      case 'statusLight':
        return {
          ...base,
          type: 'statusLight',
          config: { shape: 'circle' }
        } as ProcessElement;
      case 'label':
        return {
          ...base,
          type: 'label',
          config: { text: 'Label' }
        } as ProcessElement;
      case 'image':
        return {
          ...base,
          type: 'image',
          config: { src: '' }
        } as ProcessElement;
      case 'shape':
        return {
          ...base,
          type: 'shape',
          config: { shapeType: 'rectangle' }
        } as ProcessElement;
      case 'customSvg':
        return {
          ...base,
          type: 'customSvg',
          config: { svgContent: '<rect width="100%" height="100%" fill="#eee"/>' }
        } as ProcessElement;
      default:
        return base as ProcessElement;
    }
  }

  // ============================================================================
  // Primitive Creation
  // ============================================================================

  /**
   * Create a default primitive based on type.
   *
   * @param type Primitive type
   * @param position Position on canvas
   * @param id Optional ID (auto-generated if not provided)
   * @returns New primitive
   */
  createDefaultPrimitive(
    type: PrimitiveTypeValue,
    position: Position,
    id?: string
  ): PrimitiveBase {
    const primitiveId = id ?? this.generateId('prim');

    const defaultStyle = {
      fill: { color: '#e3f2fd' },
      stroke: { color: '#1976d2', width: 2 }
    };

    switch (type) {
      case PrimitiveType.Rectangle:
        return createRectangle(primitiveId, position.x, position.y, 100, 80, {
          name: `Rectangle-${primitiveId.slice(-4)}`,
          style: defaultStyle
        });

      case PrimitiveType.Ellipse:
        return createEllipse(primitiveId, position.x + 50, position.y + 40, 50, 40, {
          name: `Ellipse-${primitiveId.slice(-4)}`,
          style: defaultStyle
        });

      case PrimitiveType.Line:
        return createLine(primitiveId, position.x, position.y, position.x + 100, position.y, {
          name: `Line-${primitiveId.slice(-4)}`,
          style: { stroke: { color: '#333333', width: 2 } }
        });

      case PrimitiveType.Path:
        return createPath(primitiveId, 'M 0 0 L 50 0 L 50 50 L 0 50 Z', position.x, position.y, {
          name: `Path-${primitiveId.slice(-4)}`,
          style: defaultStyle
        });

      case PrimitiveType.Polygon:
        return createPolygon(primitiveId, [
          { x: position.x + 50, y: position.y },
          { x: position.x + 100, y: position.y + 38 },
          { x: position.x + 81, y: position.y + 100 },
          { x: position.x + 19, y: position.y + 100 },
          { x: position.x, y: position.y + 38 }
        ], {
          name: `Polygon-${primitiveId.slice(-4)}`,
          style: defaultStyle
        });

      case PrimitiveType.Polyline:
        return createPolyline(primitiveId, [
          { x: position.x, y: position.y },
          { x: position.x + 30, y: position.y + 50 },
          { x: position.x + 60, y: position.y + 20 },
          { x: position.x + 90, y: position.y + 70 }
        ], {
          name: `Polyline-${primitiveId.slice(-4)}`,
          style: { stroke: { color: '#333333', width: 2 } }
        });

      case PrimitiveType.Image:
        return createImage(primitiveId, '', position.x, position.y, 100, 100, {
          name: `Image-${primitiveId.slice(-4)}`
        });

      case PrimitiveType.Text:
        return createText(primitiveId, 'Text', position.x, position.y, {
          name: `Text-${primitiveId.slice(-4)}`
        });

      default:
        // Default to rectangle
        return createRectangle(primitiveId, position.x, position.y, 100, 80, {
          name: `Shape-${primitiveId.slice(-4)}`,
          style: defaultStyle
        });
    }
  }

  // ============================================================================
  // Symbol Instance Creation
  // ============================================================================

  /**
   * Create a symbol instance.
   *
   * @param libraryRtId Library runtime ID
   * @param symbolRtId Symbol runtime ID
   * @param position Position on canvas
   * @param options Optional configuration (scale, rotation, name)
   * @returns New symbol instance
   */
  createSymbolInstance(
    libraryRtId: string,
    symbolRtId: string,
    position: Position,
    options?: SymbolInstanceOptions
  ): SymbolInstance {
    const id = this.generateId('sym');

    return {
      id,
      type: 'symbol',
      libraryRtId,
      symbolRtId,
      position: { ...position },
      scale: options?.scale ?? 1,
      rotation: options?.rotation ?? 0,
      name: options?.name,
      visible: true,
      locked: false
    };
  }

  // ============================================================================
  // Diagram Creation
  // ============================================================================

  /**
   * Create an empty diagram with default configuration.
   *
   * @param name Optional diagram name
   * @returns New empty diagram
   */
  createEmptyDiagram(name?: string): ProcessDiagramConfig {
    return {
      id: this.generateId('diag'),
      name: name ?? 'New Process Diagram',
      version: '1.0',
      canvas: {
        width: 1200,
        height: 800,
        backgroundColor: '#fafafa',
        gridSize: 20,
        showGrid: true
      },
      elements: [],
      primitives: [],
      symbolInstances: [],
      connections: []
    };
  }

  /**
   * Create a copy of a diagram with a new ID.
   *
   * @param diagram Source diagram
   * @param newName Optional new name
   * @returns Copied diagram with new ID
   */
  copyDiagram(diagram: ProcessDiagramConfig, newName?: string): ProcessDiagramConfig {
    return {
      ...diagram,
      id: this.generateId('diag'),
      name: newName ?? `${diagram.name} (Copy)`
    };
  }

  // ============================================================================
  // Element Type Information
  // ============================================================================

  /**
   * Get display label for an element type.
   *
   * @param type Element type
   * @returns Human-readable label
   */
  getElementTypeLabel(type: ProcessElementType): string {
    const labels: Record<ProcessElementType, string> = {
      tank: 'Tank',
      silo: 'Silo',
      vessel: 'Vessel',
      pipe: 'Pipe',
      valve: 'Valve',
      pump: 'Pump',
      motor: 'Motor',
      gauge: 'Gauge',
      digitalDisplay: 'Digital Display',
      statusLight: 'Status Light',
      label: 'Label',
      image: 'Image',
      shape: 'Shape',
      customSvg: 'SVG'
    };
    return labels[type] ?? type;
  }

  /**
   * Get display label for a primitive type.
   *
   * @param type Primitive type
   * @returns Human-readable label
   */
  getPrimitiveTypeLabel(type: PrimitiveTypeValue): string {
    const labels: Record<string, string> = {
      [PrimitiveType.Rectangle]: 'Rectangle',
      [PrimitiveType.Ellipse]: 'Ellipse',
      [PrimitiveType.Line]: 'Line',
      [PrimitiveType.Path]: 'Path',
      [PrimitiveType.Polygon]: 'Polygon',
      [PrimitiveType.Polyline]: 'Polyline',
      [PrimitiveType.Image]: 'Image',
      [PrimitiveType.Text]: 'Text',
      group: 'Group'
    };
    return labels[type] ?? type;
  }

  /**
   * Get all available process element types.
   *
   * @returns Array of element type values
   */
  getAvailableElementTypes(): ProcessElementType[] {
    return [
      'tank', 'silo', 'vessel', 'pipe', 'valve',
      'pump', 'motor', 'gauge', 'digitalDisplay',
      'statusLight', 'label', 'image', 'shape', 'customSvg'
    ];
  }

  /**
   * Get all available primitive types.
   *
   * @returns Array of primitive type values
   */
  getAvailablePrimitiveTypes(): PrimitiveTypeValue[] {
    return [
      PrimitiveType.Rectangle,
      PrimitiveType.Ellipse,
      PrimitiveType.Line,
      PrimitiveType.Path,
      PrimitiveType.Polygon,
      PrimitiveType.Polyline,
      PrimitiveType.Image,
      PrimitiveType.Text
    ];
  }
}
