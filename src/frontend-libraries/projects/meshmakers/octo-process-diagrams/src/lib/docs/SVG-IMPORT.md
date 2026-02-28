# SVG Import - Developer Documentation

## Overview

The SVG Import feature allows importing SVG graphics into the Process Designer. SVG elements are converted to editable primitives that can then be manipulated like all other diagram elements.

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    ProcessDesignerComponent                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Toolbar     │  │ Canvas      │  │ Keyboard Handler        │  │
│  │ Import Btn  │  │ Drop Zone   │  │ Ctrl+V Paste            │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                     │                │
│         └────────────────┼─────────────────────┘                │
│                          │                                      │
│                          ▼                                      │
│               ┌─────────────────────┐                           │
│               │  importSvgContent() │                           │
│               └──────────┬──────────┘                           │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │    SvgImportService    │
              │                        │
              │  - importSvg()         │
              │  - Element Converters  │
              │  - Style Extraction    │
              │  - Transform Handling  │
              └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   PrimitiveBase[]      │
              │   (editable            │
              │    diagram elements)   │
              └────────────────────────┘
```

### Files

| File | Description |
|------|-------------|
| `services/svg-import.service.ts` | Core service for SVG parsing and conversion |
| `designer/process-designer.component.ts` | UI integration (button, drop, paste) |
| `designer/process-designer.component.html` | Import button and file input |

## SvgImportService

### API

```typescript
@Injectable({ providedIn: 'root' })
export class SvgImportService {
  /**
   * Imports SVG content and converts it to primitives
   */
  importSvg(svgContent: string, options?: SvgImportOptions): SvgImportResult;
}
```

### Interfaces

```typescript
interface SvgImportOptions {
  /** Target position for imported elements (default: 0,0) */
  targetPosition?: Position;

  /** ID generator function for new primitives */
  idGenerator?: () => string;

  /** Prefix for generated names (default: 'svg') */
  namePrefix?: string;
}

interface SvgImportResult {
  /** Converted primitives */
  primitives: PrimitiveBase[];

  /** Bounding box of the imported graphic */
  bounds: { width: number; height: number };

  /** Warnings for unsupported elements */
  warnings: string[];
}
```

### Element Mapping

| SVG Element | Primitive Type | Notes |
|-------------|----------------|-------|
| `<rect>` | `RectanglePrimitive` | `rx`/`ry` mapped to `cornerRadius` |
| `<circle>` | `EllipsePrimitive` | `r` mapped to `radiusX = radiusY` |
| `<ellipse>` | `EllipsePrimitive` | `rx`, `ry` |
| `<line>` | `LinePrimitive` | `x1`, `y1`, `x2`, `y2` |
| `<polyline>` | `PolylinePrimitive` | `points` attribute |
| `<polygon>` | `PolygonPrimitive` | `points` attribute, automatically closed |
| `<path>` | `PathPrimitive` | `d` attribute with transform application |
| `<text>` | `TextPrimitive` | `textContent`, font attributes |
| `<image>` | `ImagePrimitive` | `href`/`xlink:href` |
| `<g>` | - | Processed recursively, transforms inherited |

## Import Methods

### 1. Toolbar Button

```html
<button kendoButton (click)="onImportSvgClick()" title="Import SVG file">
  Import SVG
</button>
<input #svgFileInput
       type="file"
       accept=".svg,image/svg+xml"
       style="display: none"
       (change)="onSvgFileSelected($event)"/>
```

**Flow:**
1. User clicks "Import SVG"
2. `onImportSvgClick()` triggers file input
3. `onSvgFileSelected()` reads file via FileReader
4. `importSvgContent()` calls the service

### 2. Drag & Drop

```typescript
onCanvasDrop(event: DragEvent): void {
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    const file = files[0];
    if (file.type.includes('svg') || file.name.endsWith('.svg')) {
      const reader = new FileReader();
      reader.onload = () => {
        this.importSvgContent(reader.result as string, position);
      };
      reader.readAsText(file);
      return;
    }
  }
  // ... other drop handlers
}
```

**Flow:**
1. User drags SVG file onto canvas
2. `onCanvasDrop()` detects SVG file
3. FileReader reads content
4. `importSvgContent()` imports at drop position

### 3. Clipboard Paste

```typescript
private async handlePaste(): Promise<void> {
  try {
    const text = await navigator.clipboard.readText();
    if (text && this.isSvgContent(text)) {
      this.importSvgContent(text, this.getVisibleCanvasCenter());
      return;
    }
  } catch {
    // Fallback to internal clipboard
  }
  this.paste();
}

private isSvgContent(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('<svg') ||
         (trimmed.startsWith('<?xml') && trimmed.includes('<svg'));
}
```

**Flow:**
1. User presses Ctrl+V
2. `handlePaste()` reads system clipboard
3. If SVG content is detected, calls `importSvgContent()`
4. Otherwise falls through to regular paste (internal clipboard)

## Style Extraction

### Supported Attributes

```typescript
interface PrimitiveStyle {
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  opacity?: number;
}
```

### Priority

1. Inline `style` attribute (highest priority)
2. Presentation attributes (`fill="red"`)
3. Default values

### Color Conversion

```typescript
private parseColor(colorStr: string): string {
  // Named Colors -> Hex
  const namedColors: Record<string, string> = {
    'black': '#000000',
    'white': '#ffffff',
    'red': '#ff0000',
    // ... more
  };

  // rgb(r, g, b) -> Hex
  const rgbMatch = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/i);
  if (rgbMatch) {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  return colorStr; // Already hex or transparent
}
```

## Transform Handling

### Supported Transforms

| Transform | Syntax | Description |
|-----------|--------|-------------|
| `translate` | `translate(tx, ty)` | Translation |
| `scale` | `scale(sx, sy)` | Scaling |
| `rotate` | `rotate(angle, cx, cy)` | Rotation (optionally around a point) |
| `matrix` | `matrix(a,b,c,d,e,f)` | Full matrix |
| `skewX` | `skewX(angle)` | X-axis skew |
| `skewY` | `skewY(angle)` | Y-axis skew |

### Matrix Composition

```typescript
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
```

### Transform Inheritance

For nested `<g>` elements, transforms are accumulated:

```xml
<g transform="translate(100, 50)">
  <g transform="rotate(45)">
    <rect x="0" y="0" width="50" height="50"/>
    <!-- Rect receives combined matrix: translate + rotate -->
  </g>
</g>
```

### Path Transform

For `<path>` elements, transforms are applied directly to the `d` attribute:

```typescript
private applyTransformToPath(d: string, matrix: Matrix): string {
  // Parses path commands and transforms all coordinates
  // M, L, H, V, C, S, Q, T, A, Z are supported
}
```

## ViewBox Handling

```typescript
// Parse ViewBox
const viewBox = svg.getAttribute('viewBox');
if (viewBox) {
  const [minX, minY, vbWidth, vbHeight] = viewBox.split(/[\s,]+/).map(Number);
  // Calculate offset for imported elements
  offsetX = targetPosition.x - minX;
  offsetY = targetPosition.y - minY;
}
```

## Limitations (v1)

The following SVG features are **not** supported:

| Feature | Behavior |
|---------|----------|
| `<use>` / `<defs>` | Skipped + warning |
| `<style>` (CSS) | Skipped |
| `<linearGradient>` | Skipped |
| `<radialGradient>` | Skipped |
| `<filter>` | Skipped |
| `<clipPath>` | Skipped |
| `<mask>` | Skipped |
| `<marker>` | Skipped |
| `<pattern>` | Skipped |

## Usage Example

```typescript
// In component
private readonly svgImportService = inject(SvgImportService);

importSvgContent(svgContent: string, targetPosition?: Position): void {
  const position = targetPosition ?? { x: 100, y: 100 };

  const result = this.svgImportService.importSvg(svgContent, {
    targetPosition: position,
    idGenerator: () => this.generateId(),
    namePrefix: 'imported'
  });

  // Log warnings
  if (result.warnings.length > 0) {
    console.warn('SVG Import Warnings:', result.warnings);
  }

  // Add primitives to diagram
  this._diagram.update(d => ({
    ...d,
    primitives: [...(d.primitives ?? []), ...result.primitives]
  }));

  // Select imported elements
  this.selectionService.clearSelection();
  this.selectionService.selectElements(result.primitives.map(p => p.id));

  // Update history
  this.pushToHistory();
  this._hasChanges.set(true);
}
```

## Public API Export

```typescript
// public-api.ts
export { SvgImportService } from './lib/services/svg-import.service';
export type { SvgImportOptions, SvgImportResult } from './lib/services/svg-import.service';
```

## Extension Possibilities

### Future Features

1. **Gradient Support**: Convert LinearGradient and RadialGradient to primitive fills
2. **Symbol Detection**: Detect repeated elements as symbols
3. **CSS Style Support**: Parse embedded `<style>` tags
4. **Import Dialog**: Preview, scaling, position selection
5. **Batch Import**: Import multiple SVG files simultaneously

### Adding a New Element Converter

```typescript
// In svg-import.service.ts
private convertNewElement(element: SVGElement, transform: Matrix): NewPrimitive | null {
  const style = this.extractStyle(element);

  // Extract element-specific attributes
  const customAttr = this.getNumericAttr(element, 'custom-attr', 0);

  // Transform position
  const position = this.applyMatrix({ x, y }, transform);

  return {
    type: 'new-type',
    id: this.currentIdGenerator(),
    name: `${this.currentNamePrefix}_newtype_${this.elementCounter++}`,
    position,
    // ... additional properties
    style
  };
}

// Add to processElement() switch case
case 'newelement':
  return this.convertNewElement(element as SVGElement, transform);
```
