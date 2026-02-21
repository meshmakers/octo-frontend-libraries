# SVG Import - Entwicklerdokumentation

## Übersicht

Das SVG-Import Feature ermöglicht das Importieren von SVG-Grafiken in den Process Designer. SVG-Elemente werden dabei in editierbare Primitives konvertiert, die anschließend wie alle anderen Diagram-Elemente bearbeitet werden können.

## Architektur

### Komponenten

```
┌─────────────────────────────────────────────────────────────────┐
│                    ProcessDesignerComponent                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Toolbar     │  │ Canvas      │  │ Keyboard Handler        │  │
│  │ Import Btn  │  │ Drop Zone   │  │ Ctrl+V Paste            │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                     │                 │
│         └────────────────┼─────────────────────┘                 │
│                          │                                       │
│                          ▼                                       │
│               ┌─────────────────────┐                            │
│               │  importSvgContent() │                            │
│               └──────────┬──────────┘                            │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │    SvgImportService    │
              │                        │
              │  • importSvg()         │
              │  • Element Converters  │
              │  • Style Extraction    │
              │  • Transform Handling  │
              └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   PrimitiveBase[]      │
              │   (editierbare         │
              │    Diagram-Elemente)   │
              └────────────────────────┘
```

### Dateien

| Datei | Beschreibung |
|-------|--------------|
| `services/svg-import.service.ts` | Kern-Service für SVG-Parsing und Konvertierung |
| `designer/process-designer.component.ts` | UI-Integration (Button, Drop, Paste) |
| `designer/process-designer.component.html` | Import-Button und File-Input |

## SvgImportService

### API

```typescript
@Injectable({ providedIn: 'root' })
export class SvgImportService {
  /**
   * Importiert SVG-Content und konvertiert zu Primitives
   */
  importSvg(svgContent: string, options?: SvgImportOptions): SvgImportResult;
}
```

### Interfaces

```typescript
interface SvgImportOptions {
  /** Zielposition für importierte Elemente (default: 0,0) */
  targetPosition?: Position;

  /** ID-Generator Funktion für neue Primitives */
  idGenerator?: () => string;

  /** Prefix für generierte Namen (default: 'svg') */
  namePrefix?: string;
}

interface SvgImportResult {
  /** Konvertierte Primitives */
  primitives: PrimitiveBase[];

  /** Bounding Box der importierten Grafik */
  bounds: { width: number; height: number };

  /** Warnungen für nicht unterstützte Elemente */
  warnings: string[];
}
```

### Element-Mapping

| SVG Element | Primitive Type | Bemerkungen |
|-------------|----------------|-------------|
| `<rect>` | `RectanglePrimitive` | `rx`/`ry` → `cornerRadius` |
| `<circle>` | `EllipsePrimitive` | `r` → `radiusX = radiusY` |
| `<ellipse>` | `EllipsePrimitive` | `rx`, `ry` |
| `<line>` | `LinePrimitive` | `x1`, `y1`, `x2`, `y2` |
| `<polyline>` | `PolylinePrimitive` | `points` Attribut |
| `<polygon>` | `PolygonPrimitive` | `points` Attribut, automatisch geschlossen |
| `<path>` | `PathPrimitive` | `d` Attribut mit Transform-Anwendung |
| `<text>` | `TextPrimitive` | `textContent`, Font-Attribute |
| `<image>` | `ImagePrimitive` | `href`/`xlink:href` |
| `<g>` | - | Rekursiv verarbeitet, Transform vererbt |

## Import-Methoden

### 1. Toolbar-Button

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
1. User klickt "Import SVG"
2. `onImportSvgClick()` triggert File-Input
3. `onSvgFileSelected()` liest Datei via FileReader
4. `importSvgContent()` ruft Service auf

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
  // ... andere Drop-Handler
}
```

**Flow:**
1. User zieht SVG-Datei auf Canvas
2. `onCanvasDrop()` erkennt SVG-Datei
3. FileReader liest Content
4. `importSvgContent()` importiert an Drop-Position

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
    // Fallback zu internem Clipboard
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
1. User drückt Ctrl+V
2. `handlePaste()` liest System-Clipboard
3. Bei SVG-Content → `importSvgContent()`
4. Sonst → reguläres Paste (interner Clipboard)

## Style-Extraktion

### Unterstützte Attribute

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

### Priorität

1. Inline `style` Attribut (höchste Priorität)
2. Presentation-Attribute (`fill="red"`)
3. Default-Werte

### Farb-Konvertierung

```typescript
private parseColor(colorStr: string): string {
  // Named Colors → Hex
  const namedColors: Record<string, string> = {
    'black': '#000000',
    'white': '#ffffff',
    'red': '#ff0000',
    // ... weitere
  };

  // rgb(r, g, b) → Hex
  const rgbMatch = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/i);
  if (rgbMatch) {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  return colorStr; // Bereits Hex oder transparent
}
```

## Transform-Handling

### Unterstützte Transforms

| Transform | Syntax | Beschreibung |
|-----------|--------|--------------|
| `translate` | `translate(tx, ty)` | Verschiebung |
| `scale` | `scale(sx, sy)` | Skalierung |
| `rotate` | `rotate(angle, cx, cy)` | Rotation (optional um Punkt) |
| `matrix` | `matrix(a,b,c,d,e,f)` | Vollständige Matrix |
| `skewX` | `skewX(angle)` | X-Scherung |
| `skewY` | `skewY(angle)` | Y-Scherung |

### Matrix-Komposition

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

### Transform-Vererbung

Bei verschachtelten `<g>`-Elementen werden Transforms akkumuliert:

```xml
<g transform="translate(100, 50)">
  <g transform="rotate(45)">
    <rect x="0" y="0" width="50" height="50"/>
    <!-- Rect erhält kombinierte Matrix: translate + rotate -->
  </g>
</g>
```

### Path-Transform

Für `<path>`-Elemente werden Transforms direkt auf das `d`-Attribut angewendet:

```typescript
private applyTransformToPath(d: string, matrix: Matrix): string {
  // Parst Path-Commands und transformiert alle Koordinaten
  // M, L, H, V, C, S, Q, T, A, Z werden unterstützt
}
```

## ViewBox-Handling

```typescript
// ViewBox parsen
const viewBox = svg.getAttribute('viewBox');
if (viewBox) {
  const [minX, minY, vbWidth, vbHeight] = viewBox.split(/[\s,]+/).map(Number);
  // Offset für importierte Elemente berechnen
  offsetX = targetPosition.x - minX;
  offsetY = targetPosition.y - minY;
}
```

## Einschränkungen (v1)

Folgende SVG-Features werden **nicht** unterstützt:

| Feature | Verhalten |
|---------|-----------|
| `<use>` / `<defs>` | Übersprungen + Warning |
| `<style>` (CSS) | Übersprungen |
| `<linearGradient>` | Übersprungen |
| `<radialGradient>` | Übersprungen |
| `<filter>` | Übersprungen |
| `<clipPath>` | Übersprungen |
| `<mask>` | Übersprungen |
| `<marker>` | Übersprungen |
| `<pattern>` | Übersprungen |

## Verwendungsbeispiel

```typescript
// Im Component
private readonly svgImportService = inject(SvgImportService);

importSvgContent(svgContent: string, targetPosition?: Position): void {
  const position = targetPosition ?? { x: 100, y: 100 };

  const result = this.svgImportService.importSvg(svgContent, {
    targetPosition: position,
    idGenerator: () => this.generateId(),
    namePrefix: 'imported'
  });

  // Warnungen loggen
  if (result.warnings.length > 0) {
    console.warn('SVG Import Warnings:', result.warnings);
  }

  // Primitives zum Diagram hinzufügen
  this._diagram.update(d => ({
    ...d,
    primitives: [...(d.primitives ?? []), ...result.primitives]
  }));

  // Importierte Elemente selektieren
  this.selectionService.clearSelection();
  this.selectionService.selectElements(result.primitives.map(p => p.id));

  // History aktualisieren
  this.pushToHistory();
  this._hasChanges.set(true);
}
```

## Public API Export

```typescript
// public-api.ts
export { SvgImportService } from './lib/widgets/process-widget/services/svg-import.service';
export type { SvgImportOptions, SvgImportResult } from './lib/widgets/process-widget/services/svg-import.service';
```

## Erweiterungsmöglichkeiten

### Zukünftige Features

1. **Gradient-Support**: LinearGradient und RadialGradient zu Primitive-Fills konvertieren
2. **Symbol-Erkennung**: Wiederholte Elemente als Symbols erkennen
3. **CSS-Style-Support**: Embedded `<style>` Tags parsen
4. **Import-Dialog**: Vorschau, Skalierung, Position wählen
5. **Batch-Import**: Mehrere SVG-Dateien gleichzeitig importieren

### Neuen Element-Converter hinzufügen

```typescript
// In svg-import.service.ts
private convertNewElement(element: SVGElement, transform: Matrix): NewPrimitive | null {
  const style = this.extractStyle(element);

  // Element-spezifische Attribute extrahieren
  const customAttr = this.getNumericAttr(element, 'custom-attr', 0);

  // Position transformieren
  const position = this.applyMatrix({ x, y }, transform);

  return {
    type: 'new-type',
    id: this.currentIdGenerator(),
    name: `${this.currentNamePrefix}_newtype_${this.elementCounter++}`,
    position,
    // ... weitere Properties
    style
  };
}

// In processElement() Switch-Case hinzufügen
case 'newelement':
  return this.convertNewElement(element as SVGElement, transform);
```
