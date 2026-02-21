/**
 * SVG Import Service
 *
 * Parses SVG content and converts it to editable primitives.
 * Supports: rect, circle, ellipse, line, polyline, polygon, path, text, image
 */

import { Injectable } from '@angular/core';
import {
  PrimitiveBase,
  PrimitiveStyle,
  Position,
  Point,
  TextStyle,
  StyleClass,
  createRectangle,
  createEllipse,
  createLine,
  createPolyline,
  createPolygon,
  createPath,
  createText,
  createImage
} from '../primitives';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for SVG import
 */
export interface SvgImportOptions {
  /** Target position for imported elements (default: 0,0) */
  targetPosition?: Position;
  /** ID generator function */
  idGenerator?: () => string;
  /** Prefix for generated names */
  namePrefix?: string;
  /** Scale factor to apply (default: 1) */
  scale?: number;
}

/**
 * Result of SVG import operation
 */
export interface SvgImportResult {
  /** Converted primitives */
  primitives: PrimitiveBase[];
  /** Bounding box of imported content */
  bounds: { width: number; height: number };
  /** Warnings for unsupported elements */
  warnings: string[];
  /** Extracted style classes from CSS */
  styleClasses: StyleClass[];
}

/**
 * 2D transformation matrix
 */
interface Matrix {
  a: number; b: number;
  c: number; d: number;
  e: number; f: number;
}

// ============================================================================
// Service
// ============================================================================

@Injectable({
  providedIn: 'root'
})
export class SvgImportService {

  private idCounter = 0;

  /**
   * Import SVG content and convert to primitives
   */
  importSvg(svgContent: string, options?: SvgImportOptions): SvgImportResult {
    const warnings: string[] = [];
    const primitives: PrimitiveBase[] = [];

    // Parse SVG
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');

    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      return {
        primitives: [],
        bounds: { width: 0, height: 0 },
        warnings: ['Invalid SVG: ' + parseError.textContent?.substring(0, 100)],
        styleClasses: []
      };
    }

    const svg = doc.querySelector('svg');
    if (!svg) {
      return {
        primitives: [],
        bounds: { width: 0, height: 0 },
        warnings: ['No SVG element found'],
        styleClasses: []
      };
    }

    // Extract CSS style classes from <style> elements
    const { styleClasses, cssRules } = this.extractStyleClasses(svg, options?.idGenerator);

    // Get viewBox and dimensions
    const viewBox = this.parseViewBox(svg);
    const svgWidth = this.parseLength(svg.getAttribute('width')) || viewBox.width || 100;
    const svgHeight = this.parseLength(svg.getAttribute('height')) || viewBox.height || 100;

    // Calculate offset for viewBox
    const offsetX = (options?.targetPosition?.x ?? 0) - viewBox.minX;
    const offsetY = (options?.targetPosition?.y ?? 0) - viewBox.minY;

    // ID generator
    const generateId = options?.idGenerator ?? (() => `svg-import-${++this.idCounter}`);
    const namePrefix = options?.namePrefix ?? 'imported';

    // Process all child elements
    this.processElement(svg, primitives, warnings, {
      generateId,
      namePrefix,
      offsetX,
      offsetY,
      parentTransform: this.identityMatrix(),
      cssRules
    });

    return {
      primitives,
      bounds: { width: svgWidth, height: svgHeight },
      warnings,
      styleClasses
    };
  }

  // ============================================================================
  // CSS Style Class Extraction
  // ============================================================================

  /**
   * Extract CSS style classes from <style> elements in the SVG
   */
  private extractStyleClasses(
    svg: SVGSVGElement,
    idGenerator?: () => string
  ): {
    styleClasses: StyleClass[];
    cssRules: Map<string, { style: PrimitiveStyle; styleClassId: string }>;
  } {
    const styleClasses: StyleClass[] = [];
    const cssRules = new Map<string, { style: PrimitiveStyle; styleClassId: string }>();

    const styleElements = svg.querySelectorAll('style');
    let classCounter = 0;

    for (const styleEl of Array.from(styleElements)) {
      const cssText = styleEl.textContent || '';
      // Parse CSS rules: .cls-1 { fill: #abc; stroke: #def; }
      const ruleRegex = /\.([a-zA-Z_][a-zA-Z0-9_-]*)\s*\{([^}]+)\}/g;
      let match;

      while ((match = ruleRegex.exec(cssText)) !== null) {
        const className = match[1];
        const declarations = match[2];
        const style = this.parseCssDeclarations(declarations);

        // Generate ID for this style class
        const styleClassId = idGenerator
          ? idGenerator()
          : `style_${className}_${++classCounter}`;

        // Create StyleClass
        styleClasses.push({
          id: styleClassId,
          name: className,
          style
        });

        // Map CSS class name to style and ID
        cssRules.set(className, { style, styleClassId });
      }
    }

    return { styleClasses, cssRules };
  }

  /**
   * Parse CSS declarations into PrimitiveStyle
   */
  private parseCssDeclarations(css: string): PrimitiveStyle {
    const style: PrimitiveStyle = {};
    const props = css.split(';').map(p => p.trim()).filter(p => p);

    for (const prop of props) {
      const colonIndex = prop.indexOf(':');
      if (colonIndex === -1) continue;

      const key = prop.substring(0, colonIndex).trim();
      const value = prop.substring(colonIndex + 1).trim();

      switch (key) {
        case 'fill':
          if (value === 'none') {
            style.fill = { color: 'transparent', opacity: 0 };
          } else {
            style.fill = { ...style.fill, color: this.normalizeColor(value) };
          }
          break;
        case 'fill-opacity':
          style.fill = { ...style.fill, opacity: parseFloat(value) };
          break;
        case 'stroke':
          if (value === 'none') {
            // No stroke
          } else {
            style.stroke = { ...style.stroke, color: this.normalizeColor(value) };
          }
          break;
        case 'stroke-width':
          style.stroke = { ...style.stroke, width: this.parseLength(value) };
          break;
        case 'stroke-opacity':
          style.stroke = { ...style.stroke, opacity: parseFloat(value) };
          break;
        case 'stroke-dasharray':
          if (value && value !== 'none') {
            style.stroke = {
              ...style.stroke,
              dashArray: value.split(/[\s,]+/).map(Number).filter(n => !isNaN(n))
            };
          }
          break;
        case 'stroke-linecap':
          if (['butt', 'round', 'square'].includes(value)) {
            style.stroke = { ...style.stroke, lineCap: value as 'butt' | 'round' | 'square' };
          }
          break;
        case 'stroke-linejoin':
          if (['miter', 'round', 'bevel'].includes(value)) {
            style.stroke = { ...style.stroke, lineJoin: value as 'miter' | 'round' | 'bevel' };
          }
          break;
        case 'opacity':
          style.opacity = parseFloat(value);
          break;
      }
    }

    return style;
  }

  /**
   * Get style class ID from element's class attribute
   */
  private getStyleClassIdFromElement(
    element: Element,
    cssRules: Map<string, { style: PrimitiveStyle; styleClassId: string }>
  ): string | undefined {
    const classAttr = element.getAttribute('class');
    if (!classAttr) return undefined;

    // Get the first class that matches a CSS rule
    const classes = classAttr.trim().split(/\s+/);
    for (const className of classes) {
      const rule = cssRules.get(className);
      if (rule) {
        return rule.styleClassId;
      }
    }
    return undefined;
  }

  // ============================================================================
  // Element Processing
  // ============================================================================

  private processElement(
    element: Element,
    primitives: PrimitiveBase[],
    warnings: string[],
    context: {
      generateId: () => string;
      namePrefix: string;
      offsetX: number;
      offsetY: number;
      parentTransform: Matrix;
      cssRules: Map<string, { style: PrimitiveStyle; styleClassId: string }>;
    }
  ): void {
    // Get element's transform and compose with parent
    const localTransform = this.parseTransform(element.getAttribute('transform'));
    const combinedTransform = this.composeMatrices(context.parentTransform, localTransform);

    // Process based on element type
    const tagName = element.tagName.toLowerCase();

    switch (tagName) {
      case 'rect':
        this.convertRect(element as SVGRectElement, primitives, context, combinedTransform);
        break;
      case 'circle':
        this.convertCircle(element as SVGCircleElement, primitives, context, combinedTransform);
        break;
      case 'ellipse':
        this.convertEllipse(element as SVGEllipseElement, primitives, context, combinedTransform);
        break;
      case 'line':
        this.convertLine(element as SVGLineElement, primitives, context, combinedTransform);
        break;
      case 'polyline':
        this.convertPolyline(element as SVGPolylineElement, primitives, context, combinedTransform);
        break;
      case 'polygon':
        this.convertPolygon(element as SVGPolygonElement, primitives, context, combinedTransform);
        break;
      case 'path':
        this.convertPath(element as SVGPathElement, primitives, context, combinedTransform);
        break;
      case 'text':
        this.convertText(element as SVGTextElement, primitives, context, combinedTransform);
        break;
      case 'image':
        this.convertImage(element as SVGImageElement, primitives, context, combinedTransform);
        break;
      case 'g':
      case 'svg':
        // Group: process children with combined transform
        for (const child of Array.from(element.children)) {
          this.processElement(child, primitives, warnings, {
            ...context,
            parentTransform: combinedTransform
          });
        }
        break;
      case 'defs':
      case 'style':
      case 'title':
      case 'desc':
      case 'metadata':
        // Skip definition and metadata elements
        break;
      case 'use':
      case 'symbol':
      case 'clipPath':
      case 'mask':
      case 'filter':
      case 'linearGradient':
      case 'radialGradient':
      case 'pattern':
        warnings.push(`Unsupported element: <${tagName}>`);
        break;
      default:
        // Unknown element - try processing children
        for (const child of Array.from(element.children)) {
          this.processElement(child, primitives, warnings, {
            ...context,
            parentTransform: combinedTransform
          });
        }
    }
  }

  // ============================================================================
  // Element Converters
  // ============================================================================

  private convertRect(
    element: SVGRectElement,
    primitives: PrimitiveBase[],
    context: { generateId: () => string; namePrefix: string; offsetX: number; offsetY: number; cssRules: Map<string, { style: PrimitiveStyle; styleClassId: string }> },
    transform: Matrix
  ): void {
    const x = this.getNumericAttr(element, 'x', 0);
    const y = this.getNumericAttr(element, 'y', 0);
    const width = this.getNumericAttr(element, 'width', 0);
    const height = this.getNumericAttr(element, 'height', 0);
    const rx = this.getNumericAttr(element, 'rx', 0);
    const ry = this.getNumericAttr(element, 'ry', rx); // Default ry to rx

    if (width <= 0 || height <= 0) return;

    // Apply transform to position
    const pos = this.applyMatrix({ x, y }, transform);

    const style = this.extractStyle(element, context.cssRules);
    const styleClassId = this.getStyleClassIdFromElement(element, context.cssRules);
    const id = context.generateId();

    const rect = createRectangle(
      id,
      pos.x + context.offsetX,
      pos.y + context.offsetY,
      width * this.getScaleX(transform),
      height * this.getScaleY(transform),
      {
        name: `${context.namePrefix}-rect`,
        style: styleClassId ? undefined : style, // Use class if available, otherwise inline style
        styleClassId,
        config: {
          cornerRadiusX: rx > 0 ? rx : undefined,
          cornerRadiusY: ry > 0 ? ry : undefined
        }
      }
    );

    primitives.push(rect);
  }

  private convertCircle(
    element: SVGCircleElement,
    primitives: PrimitiveBase[],
    context: { generateId: () => string; namePrefix: string; offsetX: number; offsetY: number; cssRules: Map<string, { style: PrimitiveStyle; styleClassId: string }> },
    transform: Matrix
  ): void {
    const cx = this.getNumericAttr(element, 'cx', 0);
    const cy = this.getNumericAttr(element, 'cy', 0);
    const r = this.getNumericAttr(element, 'r', 0);

    if (r <= 0) return;

    const pos = this.applyMatrix({ x: cx, y: cy }, transform);
    const style = this.extractStyle(element, context.cssRules);
    const styleClassId = this.getStyleClassIdFromElement(element, context.cssRules);
    const id = context.generateId();

    const ellipse = createEllipse(
      id,
      pos.x + context.offsetX,
      pos.y + context.offsetY,
      r * this.getScaleX(transform),
      r * this.getScaleY(transform),
      {
        name: `${context.namePrefix}-circle`,
        style: styleClassId ? undefined : style,
        styleClassId
      }
    );

    primitives.push(ellipse);
  }

  private convertEllipse(
    element: SVGEllipseElement,
    primitives: PrimitiveBase[],
    context: { generateId: () => string; namePrefix: string; offsetX: number; offsetY: number; cssRules: Map<string, { style: PrimitiveStyle; styleClassId: string }> },
    transform: Matrix
  ): void {
    const cx = this.getNumericAttr(element, 'cx', 0);
    const cy = this.getNumericAttr(element, 'cy', 0);
    const rx = this.getNumericAttr(element, 'rx', 0);
    const ry = this.getNumericAttr(element, 'ry', 0);

    if (rx <= 0 || ry <= 0) return;

    const pos = this.applyMatrix({ x: cx, y: cy }, transform);
    const style = this.extractStyle(element, context.cssRules);
    const styleClassId = this.getStyleClassIdFromElement(element, context.cssRules);
    const id = context.generateId();

    const ellipse = createEllipse(
      id,
      pos.x + context.offsetX,
      pos.y + context.offsetY,
      rx * this.getScaleX(transform),
      ry * this.getScaleY(transform),
      {
        name: `${context.namePrefix}-ellipse`,
        style: styleClassId ? undefined : style,
        styleClassId
      }
    );

    primitives.push(ellipse);
  }

  private convertLine(
    element: SVGLineElement,
    primitives: PrimitiveBase[],
    context: { generateId: () => string; namePrefix: string; offsetX: number; offsetY: number; cssRules: Map<string, { style: PrimitiveStyle; styleClassId: string }> },
    transform: Matrix
  ): void {
    const x1 = this.getNumericAttr(element, 'x1', 0);
    const y1 = this.getNumericAttr(element, 'y1', 0);
    const x2 = this.getNumericAttr(element, 'x2', 0);
    const y2 = this.getNumericAttr(element, 'y2', 0);

    const p1 = this.applyMatrix({ x: x1, y: y1 }, transform);
    const p2 = this.applyMatrix({ x: x2, y: y2 }, transform);

    const style = this.extractStyle(element, context.cssRules);
    const styleClassId = this.getStyleClassIdFromElement(element, context.cssRules);
    const id = context.generateId();

    const line = createLine(
      id,
      p1.x + context.offsetX,
      p1.y + context.offsetY,
      p2.x + context.offsetX,
      p2.y + context.offsetY,
      {
        name: `${context.namePrefix}-line`,
        style: styleClassId ? undefined : style,
        styleClassId
      }
    );

    primitives.push(line);
  }

  private convertPolyline(
    element: SVGPolylineElement,
    primitives: PrimitiveBase[],
    context: { generateId: () => string; namePrefix: string; offsetX: number; offsetY: number; cssRules: Map<string, { style: PrimitiveStyle; styleClassId: string }> },
    transform: Matrix
  ): void {
    const pointsAttr = element.getAttribute('points') || '';
    const points = this.parsePoints(pointsAttr);

    if (points.length < 2) return;

    // Transform and offset points
    const transformedPoints = points.map(p => {
      const tp = this.applyMatrix(p, transform);
      return { x: tp.x + context.offsetX, y: tp.y + context.offsetY };
    });

    const style = this.extractStyle(element, context.cssRules);
    const styleClassId = this.getStyleClassIdFromElement(element, context.cssRules);
    const id = context.generateId();

    const polyline = createPolyline(id, transformedPoints, {
      name: `${context.namePrefix}-polyline`,
      style: styleClassId ? undefined : style,
      styleClassId
    });

    primitives.push(polyline);
  }

  private convertPolygon(
    element: SVGPolygonElement,
    primitives: PrimitiveBase[],
    context: { generateId: () => string; namePrefix: string; offsetX: number; offsetY: number; cssRules: Map<string, { style: PrimitiveStyle; styleClassId: string }> },
    transform: Matrix
  ): void {
    const pointsAttr = element.getAttribute('points') || '';
    const points = this.parsePoints(pointsAttr);

    if (points.length < 3) return;

    // Transform and offset points
    const transformedPoints = points.map(p => {
      const tp = this.applyMatrix(p, transform);
      return { x: tp.x + context.offsetX, y: tp.y + context.offsetY };
    });

    const style = this.extractStyle(element, context.cssRules);
    const styleClassId = this.getStyleClassIdFromElement(element, context.cssRules);
    const id = context.generateId();

    const polygon = createPolygon(id, transformedPoints, {
      name: `${context.namePrefix}-polygon`,
      style: styleClassId ? undefined : style,
      styleClassId
    });

    primitives.push(polygon);
  }

  private convertPath(
    element: SVGPathElement,
    primitives: PrimitiveBase[],
    context: { generateId: () => string; namePrefix: string; offsetX: number; offsetY: number; cssRules: Map<string, { style: PrimitiveStyle; styleClassId: string }> },
    transform: Matrix
  ): void {
    const d = element.getAttribute('d');
    if (!d) return;

    // For paths, we apply transform via the transform attribute
    // and offset via position
    const style = this.extractStyle(element, context.cssRules);
    const styleClassId = this.getStyleClassIdFromElement(element, context.cssRules);
    const fillRule = element.getAttribute('fill-rule') as 'nonzero' | 'evenodd' | null;
    const id = context.generateId();

    // Transform the path data if there's a non-identity transform
    const transformedD = this.transformPathData(d, transform);

    const path = createPath(
      id,
      transformedD,
      context.offsetX,
      context.offsetY,
      {
        name: `${context.namePrefix}-path`,
        style: styleClassId ? undefined : style,
        styleClassId,
        config: fillRule ? { fillRule } : undefined
      }
    );

    primitives.push(path);
  }

  private convertText(
    element: SVGTextElement,
    primitives: PrimitiveBase[],
    context: { generateId: () => string; namePrefix: string; offsetX: number; offsetY: number; cssRules: Map<string, { style: PrimitiveStyle; styleClassId: string }> },
    transform: Matrix
  ): void {
    const x = this.getNumericAttr(element, 'x', 0);
    const y = this.getNumericAttr(element, 'y', 0);
    const content = element.textContent || '';

    if (!content.trim()) return;

    const pos = this.applyMatrix({ x, y }, transform);
    const style = this.extractStyle(element, context.cssRules);
    const styleClassId = this.getStyleClassIdFromElement(element, context.cssRules);
    const textStyle = this.extractTextStyle(element);
    const id = context.generateId();

    const text = createText(
      id,
      content,
      pos.x + context.offsetX,
      pos.y + context.offsetY,
      {
        name: `${context.namePrefix}-text`,
        style: styleClassId ? undefined : style,
        styleClassId,
        config: { textStyle }
      }
    );

    primitives.push(text);
  }

  private convertImage(
    element: SVGImageElement,
    primitives: PrimitiveBase[],
    context: { generateId: () => string; namePrefix: string; offsetX: number; offsetY: number; cssRules: Map<string, { style: PrimitiveStyle; styleClassId: string }> },
    transform: Matrix
  ): void {
    const x = this.getNumericAttr(element, 'x', 0);
    const y = this.getNumericAttr(element, 'y', 0);
    const width = this.getNumericAttr(element, 'width', 0);
    const height = this.getNumericAttr(element, 'height', 0);

    // Get href (try both namespaced and non-namespaced)
    const href = element.getAttribute('href') ||
                 element.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ||
                 '';

    if (!href || width <= 0 || height <= 0) return;

    const pos = this.applyMatrix({ x, y }, transform);
    const id = context.generateId();

    const image = createImage(
      id,
      href,
      pos.x + context.offsetX,
      pos.y + context.offsetY,
      width * this.getScaleX(transform),
      height * this.getScaleY(transform),
      {
        name: `${context.namePrefix}-image`
      }
    );

    primitives.push(image);
  }

  // ============================================================================
  // Style Extraction
  // ============================================================================

  private extractStyle(
    element: Element,
    cssRules: Map<string, { style: PrimitiveStyle; styleClassId: string }>
  ): PrimitiveStyle {
    // Start with CSS class style if element has a class attribute
    let baseStyle: PrimitiveStyle = {};
    const classAttr = element.getAttribute('class');
    if (classAttr) {
      const classes = classAttr.trim().split(/\s+/);
      for (const className of classes) {
        const rule = cssRules.get(className);
        if (rule) {
          // Merge class styles (later classes override earlier ones)
          baseStyle = {
            ...baseStyle,
            ...rule.style,
            fill: { ...baseStyle.fill, ...rule.style.fill },
            stroke: { ...baseStyle.stroke, ...rule.style.stroke }
          };
        }
      }
    }

    const style: PrimitiveStyle = { ...baseStyle };

    // Fill (inline overrides CSS class)
    const fill = this.getStyleValue(element, 'fill');
    const fillOpacity = this.getStyleValue(element, 'fill-opacity');

    if (fill && fill !== 'none') {
      style.fill = {
        ...style.fill,
        color: this.normalizeColor(fill),
        opacity: fillOpacity ? parseFloat(fillOpacity) : (style.fill?.opacity ?? 1)
      };
    } else if (fill === 'none') {
      style.fill = { color: 'transparent', opacity: 0 };
    } else if (fillOpacity) {
      // Only opacity specified inline
      style.fill = { ...style.fill, opacity: parseFloat(fillOpacity) };
    }

    // Stroke (inline overrides CSS class)
    const stroke = this.getStyleValue(element, 'stroke');
    const strokeWidth = this.getStyleValue(element, 'stroke-width');
    const strokeOpacity = this.getStyleValue(element, 'stroke-opacity');
    const strokeDasharray = this.getStyleValue(element, 'stroke-dasharray');
    const strokeLinecap = this.getStyleValue(element, 'stroke-linecap');
    const strokeLinejoin = this.getStyleValue(element, 'stroke-linejoin');

    if (stroke && stroke !== 'none') {
      style.stroke = {
        ...style.stroke,
        color: this.normalizeColor(stroke),
        width: strokeWidth ? this.parseLength(strokeWidth) : (style.stroke?.width ?? 1),
        opacity: strokeOpacity ? parseFloat(strokeOpacity) : (style.stroke?.opacity ?? 1)
      };
    } else if (stroke !== 'none') {
      // Apply individual stroke properties if specified
      if (strokeWidth) {
        style.stroke = { ...style.stroke, width: this.parseLength(strokeWidth) };
      }
      if (strokeOpacity) {
        style.stroke = { ...style.stroke, opacity: parseFloat(strokeOpacity) };
      }
    }

    if (strokeDasharray && strokeDasharray !== 'none') {
      style.stroke = {
        ...style.stroke,
        dashArray: strokeDasharray.split(/[\s,]+/).map(Number).filter(n => !isNaN(n))
      };
    }

    if (strokeLinecap && ['butt', 'round', 'square'].includes(strokeLinecap)) {
      style.stroke = { ...style.stroke, lineCap: strokeLinecap as 'butt' | 'round' | 'square' };
    }

    if (strokeLinejoin && ['miter', 'round', 'bevel'].includes(strokeLinejoin)) {
      style.stroke = { ...style.stroke, lineJoin: strokeLinejoin as 'miter' | 'round' | 'bevel' };
    }

    // Overall opacity
    const opacity = this.getStyleValue(element, 'opacity');
    if (opacity) {
      style.opacity = parseFloat(opacity);
    }

    return style;
  }

  private extractTextStyle(element: SVGTextElement): TextStyle {
    const textStyle: TextStyle = {};

    const fontFamily = this.getStyleValue(element, 'font-family');
    const fontSize = this.getStyleValue(element, 'font-size');
    const fontWeight = this.getStyleValue(element, 'font-weight');
    const fontStyle = this.getStyleValue(element, 'font-style');
    const fill = this.getStyleValue(element, 'fill');
    const textAnchor = this.getStyleValue(element, 'text-anchor');

    if (fontFamily) textStyle.fontFamily = fontFamily.replace(/['"]/g, '');
    if (fontSize) textStyle.fontSize = this.parseLength(fontSize);
    if (fontWeight) {
      textStyle.fontWeight = fontWeight === 'bold' ? 'bold' :
                             fontWeight === 'normal' ? 'normal' :
                             parseInt(fontWeight) || 'normal';
    }
    if (fontStyle && ['normal', 'italic', 'oblique'].includes(fontStyle)) {
      textStyle.fontStyle = fontStyle as 'normal' | 'italic' | 'oblique';
    }
    if (fill && fill !== 'none') {
      textStyle.color = this.normalizeColor(fill);
    }
    if (textAnchor && ['start', 'middle', 'end'].includes(textAnchor)) {
      textStyle.textAnchor = textAnchor as 'start' | 'middle' | 'end';
    }

    return textStyle;
  }

  private getStyleValue(element: Element, property: string): string | null {
    // First check inline style
    const htmlElement = element as HTMLElement;
    if (htmlElement.style) {
      const camelCase = property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const styleValue = htmlElement.style.getPropertyValue(property) ||
                         (htmlElement.style as unknown as Record<string, string>)[camelCase];
      if (styleValue) return styleValue;
    }

    // Then check attribute
    return element.getAttribute(property);
  }

  // ============================================================================
  // Transform Handling
  // ============================================================================

  private parseTransform(transformStr: string | null): Matrix {
    if (!transformStr) return this.identityMatrix();

    let result = this.identityMatrix();

    // Match transform functions
    const regex = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]+)\)/gi;
    let match;

    while ((match = regex.exec(transformStr)) !== null) {
      const type = match[1].toLowerCase();
      const args = match[2].split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

      let matrix: Matrix;

      switch (type) {
        case 'matrix':
          if (args.length >= 6) {
            matrix = { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] };
          } else {
            continue;
          }
          break;
        case 'translate':
          matrix = { a: 1, b: 0, c: 0, d: 1, e: args[0] || 0, f: args[1] || 0 };
          break;
        case 'scale': {
          const sx = args[0] || 1;
          const sy = args[1] ?? sx;
          matrix = { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
          break;
        }
        case 'rotate': {
          const angle = (args[0] || 0) * Math.PI / 180;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          if (args.length >= 3) {
            // Rotate around point (cx, cy)
            const cx = args[1];
            const cy = args[2];
            matrix = {
              a: cos, b: sin, c: -sin, d: cos,
              e: cx - cx * cos + cy * sin,
              f: cy - cx * sin - cy * cos
            };
          } else {
            matrix = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
          }
          break;
        }
        case 'skewx': {
          const tanX = Math.tan((args[0] || 0) * Math.PI / 180);
          matrix = { a: 1, b: 0, c: tanX, d: 1, e: 0, f: 0 };
          break;
        }
        case 'skewy': {
          const tanY = Math.tan((args[0] || 0) * Math.PI / 180);
          matrix = { a: 1, b: tanY, c: 0, d: 1, e: 0, f: 0 };
          break;
        }
        default:
          continue;
      }

      result = this.composeMatrices(result, matrix);
    }

    return result;
  }

  private identityMatrix(): Matrix {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  }

  private composeMatrices(m1: Matrix, m2: Matrix): Matrix {
    return {
      a: m1.a * m2.a + m1.c * m2.b,
      b: m1.b * m2.a + m1.d * m2.b,
      c: m1.a * m2.c + m1.c * m2.d,
      d: m1.b * m2.c + m1.d * m2.d,
      e: m1.a * m2.e + m1.c * m2.f + m1.e,
      f: m1.b * m2.e + m1.d * m2.f + m1.f
    };
  }

  private applyMatrix(point: Point, matrix: Matrix): Point {
    return {
      x: matrix.a * point.x + matrix.c * point.y + matrix.e,
      y: matrix.b * point.x + matrix.d * point.y + matrix.f
    };
  }

  private getScaleX(matrix: Matrix): number {
    return Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b);
  }

  private getScaleY(matrix: Matrix): number {
    return Math.sqrt(matrix.c * matrix.c + matrix.d * matrix.d);
  }

  /**
   * Transform path data by applying matrix to coordinates
   * This is a simplified implementation that handles common path commands
   */
  private transformPathData(d: string, matrix: Matrix): string {
    // If identity matrix, return unchanged
    if (matrix.a === 1 && matrix.b === 0 && matrix.c === 0 &&
        matrix.d === 1 && matrix.e === 0 && matrix.f === 0) {
      return d;
    }

    // Parse path commands and transform coordinates
    const commands = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];
    let currentX = 0;
    let currentY = 0;
    const result: string[] = [];

    for (const cmd of commands) {
      const type = cmd[0];
      const args = cmd.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
      const isRelative = type === type.toLowerCase();

      switch (type.toUpperCase()) {
        case 'M':
        case 'L':
        case 'T': {
          const transformed: number[] = [];
          for (let i = 0; i < args.length; i += 2) {
            let x = args[i];
            let y = args[i + 1];
            if (isRelative) {
              x += currentX;
              y += currentY;
            }
            const tp = this.applyMatrix({ x, y }, matrix);
            transformed.push(tp.x, tp.y);
            currentX = x;
            currentY = y;
          }
          result.push(type.toUpperCase() + ' ' + transformed.join(' '));
          break;
        }
        case 'H': {
          const transformed: number[] = [];
          for (const arg of args) {
            const x = isRelative ? currentX + arg : arg;
            const tp = this.applyMatrix({ x, y: currentY }, matrix);
            transformed.push(tp.x, tp.y);
            currentX = x;
          }
          result.push('L ' + transformed.join(' '));
          break;
        }
        case 'V': {
          const transformed: number[] = [];
          for (const arg of args) {
            const y = isRelative ? currentY + arg : arg;
            const tp = this.applyMatrix({ x: currentX, y }, matrix);
            transformed.push(tp.x, tp.y);
            currentY = y;
          }
          result.push('L ' + transformed.join(' '));
          break;
        }
        case 'C': {
          const transformed: number[] = [];
          for (let i = 0; i < args.length; i += 6) {
            let x1 = args[i], y1 = args[i + 1];
            let x2 = args[i + 2], y2 = args[i + 3];
            let x = args[i + 4], y = args[i + 5];
            if (isRelative) {
              x1 += currentX; y1 += currentY;
              x2 += currentX; y2 += currentY;
              x += currentX; y += currentY;
            }
            const tp1 = this.applyMatrix({ x: x1, y: y1 }, matrix);
            const tp2 = this.applyMatrix({ x: x2, y: y2 }, matrix);
            const tp = this.applyMatrix({ x, y }, matrix);
            transformed.push(tp1.x, tp1.y, tp2.x, tp2.y, tp.x, tp.y);
            currentX = x;
            currentY = y;
          }
          result.push('C ' + transformed.join(' '));
          break;
        }
        case 'S': {
          const transformed: number[] = [];
          for (let i = 0; i < args.length; i += 4) {
            let x2 = args[i], y2 = args[i + 1];
            let x = args[i + 2], y = args[i + 3];
            if (isRelative) {
              x2 += currentX; y2 += currentY;
              x += currentX; y += currentY;
            }
            const tp2 = this.applyMatrix({ x: x2, y: y2 }, matrix);
            const tp = this.applyMatrix({ x, y }, matrix);
            transformed.push(tp2.x, tp2.y, tp.x, tp.y);
            currentX = x;
            currentY = y;
          }
          result.push('S ' + transformed.join(' '));
          break;
        }
        case 'Q': {
          const transformed: number[] = [];
          for (let i = 0; i < args.length; i += 4) {
            let x1 = args[i], y1 = args[i + 1];
            let x = args[i + 2], y = args[i + 3];
            if (isRelative) {
              x1 += currentX; y1 += currentY;
              x += currentX; y += currentY;
            }
            const tp1 = this.applyMatrix({ x: x1, y: y1 }, matrix);
            const tp = this.applyMatrix({ x, y }, matrix);
            transformed.push(tp1.x, tp1.y, tp.x, tp.y);
            currentX = x;
            currentY = y;
          }
          result.push('Q ' + transformed.join(' '));
          break;
        }
        case 'A': {
          // Arc commands are complex - we simplify by not transforming properly
          // This is a known limitation
          const transformed: number[] = [];
          for (let i = 0; i < args.length; i += 7) {
            const rx = args[i] * this.getScaleX(matrix);
            const ry = args[i + 1] * this.getScaleY(matrix);
            const rotation = args[i + 2];
            const largeArc = args[i + 3];
            const sweep = args[i + 4];
            let x = args[i + 5], y = args[i + 6];
            if (isRelative) {
              x += currentX;
              y += currentY;
            }
            const tp = this.applyMatrix({ x, y }, matrix);
            transformed.push(rx, ry, rotation, largeArc, sweep, tp.x, tp.y);
            currentX = x;
            currentY = y;
          }
          result.push('A ' + transformed.join(' '));
          break;
        }
        case 'Z':
          result.push('Z');
          break;
      }
    }

    return result.join(' ');
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private parseViewBox(svg: SVGSVGElement): { minX: number; minY: number; width: number; height: number } {
    const viewBox = svg.getAttribute('viewBox');
    if (!viewBox) {
      return { minX: 0, minY: 0, width: 0, height: 0 };
    }

    const parts = viewBox.split(/[\s,]+/).map(Number);
    return {
      minX: parts[0] || 0,
      minY: parts[1] || 0,
      width: parts[2] || 0,
      height: parts[3] || 0
    };
  }

  private parseLength(value: string | null): number {
    if (!value) return 0;

    const match = value.match(/^(-?\d*\.?\d+)(px|em|rem|pt|%)?$/);
    if (!match) return 0;

    const num = parseFloat(match[1]);

    // Simple unit conversion (approximate)
    switch (match[2]) {
      case 'pt': return num * 1.333;
      case 'em':
      case 'rem': return num * 16;
      case '%': return num; // Percentage needs context
      default: return num;
    }
  }

  private parsePoints(pointsStr: string): Point[] {
    const numbers = pointsStr.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
    const points: Point[] = [];

    for (let i = 0; i < numbers.length - 1; i += 2) {
      points.push({ x: numbers[i], y: numbers[i + 1] });
    }

    return points;
  }

  private getNumericAttr(element: Element, attr: string, defaultValue: number): number {
    const value = element.getAttribute(attr);
    if (!value) return defaultValue;
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
  }

  private normalizeColor(color: string): string {
    if (!color || color === 'none' || color === 'transparent') {
      return 'transparent';
    }

    // Already hex
    if (color.startsWith('#')) {
      return color;
    }

    // RGB/RGBA
    const rgbMatch = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
      const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
      const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }

    // Named colors - return as is, browser will handle
    return color;
  }

  // ============================================================================
  // Scaling
  // ============================================================================

  /**
   * Scale primitives by a factor (proportionally)
   * Assumes primitives are already normalized to start at (0,0)
   */
  scalePrimitives(primitives: PrimitiveBase[], scale: number): {
    primitives: PrimitiveBase[];
    width: number;
    height: number;
  } {
    if (scale === 1) {
      // Calculate bounds for unscaled primitives
      const bounds = this.calculateBounds(primitives);
      return { primitives, width: bounds.width, height: bounds.height };
    }

    const scaledPrimitives = primitives.map(prim => this.scalePrimitive(prim, scale));
    const bounds = this.calculateBounds(scaledPrimitives);

    return {
      primitives: scaledPrimitives,
      width: bounds.width,
      height: bounds.height
    };
  }

  /**
   * Scale a single primitive
   */
  private scalePrimitive(prim: PrimitiveBase, scale: number): PrimitiveBase {
    const scaledPosition = {
      x: prim.position.x * scale,
      y: prim.position.y * scale
    };

    switch (prim.type) {
      case 'rectangle': {
        const config = (prim as unknown as { config: { width: number; height: number; cornerRadiusX?: number; cornerRadiusY?: number } }).config;
        return {
          ...prim,
          position: scaledPosition,
          config: {
            ...config,
            width: config.width * scale,
            height: config.height * scale,
            cornerRadiusX: config.cornerRadiusX ? config.cornerRadiusX * scale : undefined,
            cornerRadiusY: config.cornerRadiusY ? config.cornerRadiusY * scale : undefined
          }
        } as PrimitiveBase;
      }

      case 'ellipse': {
        const config = (prim as unknown as { config: { radiusX: number; radiusY: number } }).config;
        return {
          ...prim,
          position: scaledPosition,
          config: {
            ...config,
            radiusX: config.radiusX * scale,
            radiusY: config.radiusY * scale
          }
        } as PrimitiveBase;
      }

      case 'line': {
        const config = (prim as unknown as { config: { endX: number; endY: number } }).config;
        return {
          ...prim,
          position: scaledPosition,
          config: {
            ...config,
            endX: config.endX * scale,
            endY: config.endY * scale
          }
        } as PrimitiveBase;
      }

      case 'polygon':
      case 'polyline': {
        const config = (prim as unknown as { config: { points: Point[] } }).config;
        return {
          ...prim,
          position: scaledPosition,
          config: {
            ...config,
            points: config.points.map(p => ({ x: p.x * scale, y: p.y * scale }))
          }
        } as PrimitiveBase;
      }

      case 'path': {
        const config = (prim as unknown as { config: { d: string } }).config;
        const scaledD = this.scalePathData(config.d, scale);
        return {
          ...prim,
          position: scaledPosition,
          config: {
            ...config,
            d: scaledD
          }
        } as PrimitiveBase;
      }

      case 'text': {
        const config = (prim as unknown as { config: { textStyle?: { fontSize?: number } } }).config;
        const scaledConfig = { ...config };
        if (config.textStyle?.fontSize) {
          scaledConfig.textStyle = {
            ...config.textStyle,
            fontSize: config.textStyle.fontSize * scale
          };
        }
        return {
          ...prim,
          position: scaledPosition,
          config: scaledConfig
        } as PrimitiveBase;
      }

      case 'image': {
        const config = (prim as unknown as { config: { width: number; height: number } }).config;
        return {
          ...prim,
          position: scaledPosition,
          config: {
            ...config,
            width: config.width * scale,
            height: config.height * scale
          }
        } as PrimitiveBase;
      }

      default:
        return {
          ...prim,
          position: scaledPosition
        };
    }
  }

  /**
   * Scale path data by a factor
   */
  private scalePathData(d: string, scale: number): string {
    if (scale === 1) return d;

    const commands = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];
    const result: string[] = [];

    for (const cmd of commands) {
      const type = cmd[0];
      const args = cmd.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

      switch (type.toUpperCase()) {
        case 'M':
        case 'L':
        case 'T': {
          const scaled = args.map(n => n * scale);
          result.push(type + ' ' + scaled.join(' '));
          break;
        }
        case 'H':
        case 'V': {
          const scaled = args.map(n => n * scale);
          result.push(type + ' ' + scaled.join(' '));
          break;
        }
        case 'C':
        case 'S':
        case 'Q': {
          const scaled = args.map(n => n * scale);
          result.push(type + ' ' + scaled.join(' '));
          break;
        }
        case 'A': {
          // Arc: rx ry x-axis-rotation large-arc-flag sweep-flag x y
          const scaled: number[] = [];
          for (let i = 0; i < args.length; i += 7) {
            scaled.push(
              args[i] * scale,      // rx
              args[i + 1] * scale,  // ry
              args[i + 2],          // x-axis-rotation (unchanged)
              args[i + 3],          // large-arc-flag (unchanged)
              args[i + 4],          // sweep-flag (unchanged)
              args[i + 5] * scale,  // x
              args[i + 6] * scale   // y
            );
          }
          result.push(type + ' ' + scaled.join(' '));
          break;
        }
        case 'Z':
          result.push('Z');
          break;
        default:
          result.push(cmd);
      }
    }

    return result.join(' ');
  }

  /**
   * Calculate bounds for a set of primitives
   */
  private calculateBounds(primitives: PrimitiveBase[]): { width: number; height: number } {
    let maxX = 0, maxY = 0;

    for (const prim of primitives) {
      const bounds = this.getPrimitiveBounds(prim);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    }

    return { width: maxX, height: maxY };
  }

  /**
   * Get bounds of a single primitive
   */
  private getPrimitiveBounds(prim: PrimitiveBase): { x: number; y: number; width: number; height: number } {
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
      case 'line': {
        const config = (prim as unknown as { config: { endX: number; endY: number } }).config;
        const x1 = pos.x, y1 = pos.y;
        const x2 = config.endX, y2 = config.endY;
        return {
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          width: Math.abs(x2 - x1),
          height: Math.abs(y2 - y1)
        };
      }
      case 'polygon':
      case 'polyline': {
        const config = (prim as unknown as { config: { points: Point[] } }).config;
        if (!config.points || config.points.length === 0) {
          return { x: pos.x, y: pos.y, width: 0, height: 0 };
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const pt of config.points) {
          minX = Math.min(minX, pos.x + pt.x);
          minY = Math.min(minY, pos.y + pt.y);
          maxX = Math.max(maxX, pos.x + pt.x);
          maxY = Math.max(maxY, pos.y + pt.y);
        }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      }
      default:
        return { x: pos.x, y: pos.y, width: 50, height: 50 };
    }
  }
}
