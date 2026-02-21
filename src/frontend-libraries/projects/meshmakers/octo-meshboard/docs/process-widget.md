# Process Widget - Developer Documentation

The Process Widget provides HMI-style (Human-Machine Interface) process visualization capabilities for MeshBoard dashboards. It enables industrial process visualization with tanks, pipes, valves, pumps, and other process elements.

## Overview

The Process Widget renders SVG-based process diagrams with:
- Industrial process elements (tanks, pipes, valves, pumps, motors)
- Data binding to OctoMesh runtime entities
- Flow animations on connections
- Threshold-based color changes
- Custom SVG element support

## Architecture

```
process-widget/
├── process-widget.component.ts        # Main component with SVG rendering
├── process-widget.models.ts           # Configuration schema and interfaces
├── process-widget-config.model.ts     # Widget config for MeshBoard integration
├── process-config-dialog.component.ts # Widget configuration dialog
│
├── designer/                          # Visual Editor (Phase 4 - Implemented)
│   ├── process-designer.component.ts  # Main designer component
│   ├── process-designer.component.html
│   ├── process-designer.component.scss
│   ├── element-palette.component.ts   # Draggable element palette
│   ├── property-inspector.component.ts # Properties panel
│   ├── symbol-library-panel.component.ts # Symbol library browser
│   └── services/
│       ├── designer-selection.service.ts  # Selection management
│       ├── designer-history.service.ts    # Undo/Redo
│       └── designer-clipboard.service.ts  # Copy/Paste
│
├── primitives/                        # Basic shapes for diagrams
│   └── models/
│       └── symbol.model.ts            # Symbol definitions
│
├── admin/                             # Symbol Library Administration
│   ├── symbol-library-admin.component.ts
│   └── symbol-editor.component.ts
│
└── services/
    ├── process-data.service.ts        # Data fetching and transformation
    ├── symbol-library.service.ts      # Symbol library management
    └── svg-import.service.ts          # SVG file import
```

## Quick Start

### 1. Add a Process Widget to a MeshBoard

The Process Widget is automatically registered when using `provideMeshBoard()`. It appears in the "Add Widget" dialog with the label "Process Diagram".

### 2. Using Inline Configuration

For simple diagrams, use inline configuration:

```typescript
import { ProcessWidgetConfig, ProcessDiagramConfig } from '@meshmakers/octo-meshboard';

const diagram: ProcessDiagramConfig = {
  id: 'my-diagram',
  name: 'Water Treatment',
  version: '1.0.0',
  canvas: {
    width: 800,
    height: 600,
    backgroundColor: '#f5f5f5'
  },
  elements: [
    {
      id: 'tank-1',
      type: 'tank',
      name: 'Storage Tank',
      position: { x: 50, y: 100 },
      size: { width: 80, height: 150 },
      config: {
        shape: 'cylindrical',
        orientation: 'vertical',
        showLevel: true,
        showPercentage: true,
        fillColor: '#42a5f5'
      },
      dataBinding: {
        sourceType: 'static',
        sourceConfig: { staticValue: 75 },
        attributePath: 'level'
      }
    }
  ],
  connections: []
};

const widgetConfig: ProcessWidgetConfig = {
  id: 'process-1',
  type: 'process',
  title: 'Water Treatment Process',
  col: 1,
  row: 1,
  colSpan: 4,
  rowSpan: 3,
  dataSource: { type: 'static', data: null },
  inlineConfig: diagram,
  fitToBounds: true
};
```

## Element Types

### Container Elements

#### Tank (`tank`)
Displays liquid storage tanks with fill level visualization.

```typescript
{
  id: 'tank-1',
  type: 'tank',
  name: 'Storage Tank',
  position: { x: 50, y: 100 },
  size: { width: 80, height: 150 },
  config: {
    shape: 'cylindrical' | 'rectangular' | 'conical',
    orientation: 'vertical' | 'horizontal',
    showLevel: true,
    showPercentage: true,
    capacity: 1000,
    unit: 'L',
    emptyColor: '#e0e0e0',
    fillColor: '#42a5f5'
  }
}
```

#### Silo (`silo`)
Similar to tanks, for solid materials storage.

#### Vessel (`vessel`)
Process vessels with different head shapes.

### Actuator Elements

#### Valve (`valve`)
Control valves with open/closed state visualization.

```typescript
{
  id: 'valve-1',
  type: 'valve',
  name: 'Control Valve',
  position: { x: 170, y: 160 },
  size: { width: 40, height: 40 },
  config: {
    valveType: 'gate' | 'ball' | 'butterfly' | 'check' | 'globe',
    openColor: '#4caf50',
    closedColor: '#f44336',
    errorColor: '#ff9800',
    showState: true
  }
}
```

#### Pump (`pump`)
Pumps with running animation support.

```typescript
{
  id: 'pump-1',
  type: 'pump',
  name: 'Transfer Pump',
  position: { x: 250, y: 150 },
  size: { width: 60, height: 60 },
  config: {
    pumpType: 'centrifugal' | 'positive-displacement' | 'submersible',
    showAnimation: true,
    animationSpeed: 1,
    runningColor: '#4caf50',
    stoppedColor: '#9e9e9e',
    errorColor: '#f44336',
    showState: true
  }
}
```

#### Motor (`motor`)
Electric motors with rotation animation.

### Display Elements

#### Digital Display (`digitalDisplay`)
Shows numeric values in a digital display style.

```typescript
{
  id: 'display-1',
  type: 'digitalDisplay',
  name: 'Flow Rate',
  position: { x: 350, y: 160 },
  size: { width: 80, height: 40 },
  config: {
    backgroundColor: '#1a1a1a',
    showUnit: true,
    unit: 'L/min',
    textStyle: {
      color: '#00ff00',
      fontSize: 14
    }
  }
}
```

#### Status Light (`statusLight`)
Boolean indicator lights.

```typescript
{
  id: 'status-1',
  type: 'statusLight',
  name: 'System Status',
  position: { x: 250, y: 50 },
  size: { width: 30, height: 30 },
  config: {
    shape: 'circle' | 'square' | 'rectangle',
    onColor: '#4caf50',
    offColor: '#f44336',
    showGlow: true,
    blinkWhenOn: false
  }
}
```

### Layout Elements

#### Label (`label`)
Static or dynamic text labels.

#### Image (`image`)
Static images.

#### Shape (`shape`)
Basic geometric shapes.

#### Custom SVG (`customSvg`)
Import custom SVG graphics.

```typescript
{
  id: 'custom-1',
  type: 'customSvg',
  name: 'Custom Equipment',
  position: { x: 100, y: 100 },
  size: { width: 100, height: 100 },
  config: {
    svgContent: '<svg>...</svg>',
    preserveColors: true,
    cssClass: 'my-custom-element',
    attributeBindings: [
      {
        selector: '#fill-area',
        svgAttribute: 'fill',
        dataBinding: {
          sourceType: 'runtimeEntity',
          sourceConfig: { ckTypeId: '...', rtId: '...' },
          attributePath: 'color'
        }
      }
    ]
  }
}
```

## Connections

Connections represent pipes, cables, or other connectors between elements.

```typescript
{
  id: 'conn-1',
  name: 'Tank to Valve',
  from: { elementId: 'tank-1', port: 'right' },
  to: { elementId: 'valve-1', port: 'left' },
  pathPoints: [], // Optional intermediate points
  style: {
    strokeWidth: 6,
    strokeColor: '#607d8b',
    strokeDash: [5, 3], // Optional dashed line
    lineCap: 'round',
    lineJoin: 'round'
  },
  animation: {
    enabled: true,
    type: 'flow' | 'pulse' | 'dash' | 'none',
    speed: 1,
    direction: 'forward' | 'backward' | 'bidirectional',
    particleColor: '#2196f3',
    particleSize: 4,
    activeWhen: 'always' | 'positive' | 'nonZero' | 'true'
  }
}
```

### Connection Ports

Elements have the following connection ports:
- `top`
- `bottom`
- `left`
- `right`
- `center`

## Data Binding

Elements can be bound to OctoMesh data sources.

### Data Source Types

#### Static (`static`)
Fixed values, useful for demo/testing:

```typescript
dataBinding: {
  sourceType: 'static',
  sourceConfig: { staticValue: 75 },
  attributePath: 'level'
}
```

#### Runtime Entity (`runtimeEntity`)
Live data from OctoMesh runtime entities:

```typescript
dataBinding: {
  sourceType: 'runtimeEntity',
  sourceConfig: {
    ckTypeId: 'Industry/Tank',
    rtId: '${selectedTank}' // Supports MeshBoard variables
  },
  attributePath: 'fillLevel',
  refreshInterval: 5000 // Optional, in milliseconds
}
```

#### Persistent Query (`persistentQuery`)
Data from stored queries (future phase):

```typescript
dataBinding: {
  sourceType: 'persistentQuery',
  sourceConfig: { queryRtId: 'query-rtid-here' },
  attributePath: 'result.value'
}
```

### Value Transformations

Transform raw values for display:

```typescript
transform: {
  type: 'percentage' | 'linear' | 'threshold' | 'map' | 'none',
  min: 0,
  max: 100,
  decimals: 1,
  prefix: '',
  suffix: '%',
  thresholds: [
    { value: 0, color: '#4caf50', label: 'Normal' },
    { value: 70, color: '#ff9800', label: 'Warning' },
    { value: 90, color: '#f44336', label: 'Critical', animation: 'blink' }
  ],
  mappings: [
    { input: 'on', output: 'Running', color: '#4caf50' },
    { input: 'off', output: 'Stopped', color: '#9e9e9e' }
  ]
}
```

## Widget Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `processDiagramRtId` | string | - | Reference to stored diagram (future) |
| `inlineConfig` | ProcessDiagramConfig | - | Inline diagram configuration |
| `fitToBounds` | boolean | true | Fit diagram to widget bounds |
| `allowZoom` | boolean | false | Enable zoom controls |
| `allowPan` | boolean | false | Enable pan/drag |
| `initialZoom` | number | 1 | Initial zoom level (1 = 100%) |
| `showToolbar` | boolean | false | Show toolbar with zoom controls |

## Styling

### Element Styles

All elements support basic styling:

```typescript
style: {
  fillColor: '#42a5f5',
  strokeColor: '#1976d2',
  strokeWidth: 2,
  opacity: 1,
  filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.2))'
}
```

### Text Styles

Text elements support:

```typescript
textStyle: {
  fontFamily: 'Arial, sans-serif',
  fontSize: 14,
  fontWeight: 'bold',
  color: '#333',
  textAlign: 'center'
}
```

## Variables

Process diagrams support MeshBoard variables for dynamic data binding:

```typescript
variables: [
  {
    name: 'selectedTank',
    label: 'Selected Tank',
    type: 'string',
    defaultValue: 'tank-001'
  }
]
```

Use variables in data bindings with `${variableName}` syntax:

```typescript
dataBinding: {
  sourceType: 'runtimeEntity',
  sourceConfig: {
    ckTypeId: 'Industry/Tank',
    rtId: '${selectedTank}'
  },
  attributePath: 'fillLevel'
}
```

## Demo Diagram

A demo diagram is provided for testing:

```typescript
import { DEMO_PROCESS_DIAGRAM } from '@meshmakers/octo-meshboard';

// Use in widget config
const config: ProcessWidgetConfig = {
  // ...
  inlineConfig: DEMO_PROCESS_DIAGRAM
};
```

## Process Designer (Phase 4 - Implemented)

The Process Designer provides a visual drag-and-drop editor for creating and editing process diagrams.

### Features

- **Element Palette**: Drag elements (tanks, valves, pumps, etc.) onto the canvas
- **Primitives**: Basic shapes (rectangles, ellipses, lines, paths, text, images)
- **Symbol Library**: Reusable custom symbols
- **Property Inspector**: Edit element properties
- **Selection**: Single and multi-select with Ctrl/Shift
- **Undo/Redo**: Full history support (Ctrl+Z / Ctrl+Y)
- **Copy/Paste**: Copy elements within and between diagrams
- **SVG Import**: Import external SVG graphics as editable primitives

### Designer Services

| Service | Description |
|---------|-------------|
| `DesignerSelectionService` | Manages selection state (elements, primitives, connections) |
| `DesignerHistoryService` | Undo/Redo stack management |
| `DesignerClipboardService` | Copy/Paste operations |
| `SvgImportService` | SVG file import and conversion |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+C` | Copy selected |
| `Ctrl+V` | Paste |
| `Ctrl+A` | Select all |
| `Ctrl+S` | Save diagram |
| `Delete` / `Backspace` | Delete selected |
| `Escape` | Clear selection |

### SVG Import

The `SvgImportService` converts SVG graphics to editable primitives:

```typescript
import { SvgImportService, SvgImportResult } from '@meshmakers/octo-meshboard';

const result: SvgImportResult = svgImportService.importSvg(svgContent, {
  targetPosition: { x: 100, y: 100 },
  idGenerator: () => generateId(),
  namePrefix: 'imported'
});

// result.primitives: PrimitiveBase[]
// result.bounds: { width, height }
// result.warnings: string[]
```

**Import Methods:**
1. **Toolbar Button**: Click "Import SVG" to open file picker
2. **Drag & Drop**: Drag SVG file onto canvas
3. **Paste**: Copy SVG code, press Ctrl+V

**SVG Element → Primitive Mapping:**

| SVG Element | Primitive Type |
|-------------|----------------|
| `<rect>` | RectanglePrimitive |
| `<circle>`, `<ellipse>` | EllipsePrimitive |
| `<line>` | LinePrimitive |
| `<polyline>` | PolylinePrimitive |
| `<polygon>` | PolygonPrimitive |
| `<path>` | PathPrimitive |
| `<text>` | TextPrimitive |
| `<image>` | ImagePrimitive |
| `<g>` | Recursively processed |

**Supported SVG Features:**
- Styles: fill, stroke, stroke-width, opacity
- Transforms: translate, rotate, scale, matrix, skewX, skewY
- ViewBox handling
- Nested groups with transform inheritance

**Not Supported (v1):**
- `<use>` / `<defs>` (symbol references)
- CSS stylesheets (`<style>`)
- Gradients, filters, masks, clip-paths

See `docs/SVG-IMPORT.md` for detailed technical documentation.

### Symbol Editor

The `SymbolEditorComponent` provides a visual editor for creating reusable symbols.

**Canvas Size vs Symbol Bounds:**

| Concept | Canvas Size | Symbol Bounds |
|---------|-------------|---------------|
| **What** | Working area in the editor | Actual bounding box of content |
| **Purpose** | Editing workspace ("paper") | Size of all primitives combined |
| **Calculation** | Manually set or inherited from bounds | Automatically calculated from primitives |
| **Persisted** | No (editor only) | Yes (`boundsWidth`, `boundsHeight`) |

- **Canvas**: The drawing area you work in. Can be larger than the actual symbol content.
- **Symbol Bounds**: Calculated from the bounding box of all primitives and symbol instances. This is what gets saved.

**Example:**
- Canvas is 500×500 (working area)
- You draw a small icon that is 100×80
- Symbol bounds will be 100×80 (not 500×500)

**Normalization:**
When saving a symbol, all primitives are normalized so they start at position (0,0). The bounds represent the actual content size, independent of where elements were placed on the canvas.

```typescript
// SymbolEditorComponent inputs
@Input() symbol: SymbolDefinition | null;  // Symbol to edit
@Input() canvasWidth?: number;              // Override canvas width
@Input() canvasHeight?: number;             // Override canvas height
@Input() gridSize = 10;                     // Grid snap size
```

## Roadmap

### Completed Phases

- **Phase 1**: Basic Process Widget with SVG rendering ✓
- **Phase 4**: Diagram Designer ✓
  - Visual drag-and-drop editor
  - Element palette
  - Property inspector
  - Symbol Library
  - SVG Import

### Future Phases

### Phase 2: Interactivity
- Click handlers on elements
- Drill-down navigation
- Context menus

### Phase 3: Real-time Updates
- GraphQL subscriptions for live data
- Optimistic UI updates
- Connection state indicators

### Phase 5: CK Type Integration
- Store diagrams as OctoMesh entities
- Version control for diagrams
- Template library

## API Reference

### ProcessWidgetComponent

The main component that renders the process diagram.

**Inputs:**
- `config: ProcessWidgetConfig` - Widget configuration

### ProcessDataService

Service for fetching and transforming data.

**Methods:**
- `loadDiagram(rtId: string): Promise<ProcessDiagramConfig>` - Load diagram from backend
- `loadRuntimeData(diagram: ProcessDiagramConfig): Promise<ProcessDiagramRuntimeState>` - Load runtime data for all elements

### ProcessDesignerComponent

Visual editor for creating and editing process diagrams.

**Inputs:**
- `diagram: ProcessDiagramConfig` - Initial diagram configuration
- `mode: DesignerMode` - Editor mode ('edit' | 'view')

**Outputs:**
- `diagramChange: EventEmitter<ProcessDiagramConfig>` - Emitted when diagram changes
- `save: EventEmitter<ProcessDiagramConfig>` - Emitted when user saves

### SvgImportService

Service for importing SVG files as primitives.

**Methods:**
- `importSvg(svgContent: string, options?: SvgImportOptions): SvgImportResult`

**Interfaces:**
```typescript
interface SvgImportOptions {
  targetPosition?: Position;
  idGenerator?: () => string;
  namePrefix?: string;
}

interface SvgImportResult {
  primitives: PrimitiveBase[];
  bounds: { width: number; height: number };
  warnings: string[];
}
```

### DesignerSelectionService

Manages selection state in the designer.

**Methods:**
- `selectElement(id: string, addToSelection?: boolean): void`
- `selectElements(ids: string[]): void`
- `selectPrimitive(id: string, addToSelection?: boolean): void`
- `selectConnection(id: string, addToSelection?: boolean): void`
- `clearSelection(): void`
- `selectAll(diagram: ProcessDiagramConfig): void`
- `isElementSelected(id: string): boolean`
- `isPrimitiveSelected(id: string): boolean`
- `getSelectedCount(): number`

### DesignerHistoryService

Manages undo/redo history.

**Methods:**
- `push(state: ProcessDiagramConfig): void`
- `undo(): ProcessDiagramConfig | null`
- `redo(): ProcessDiagramConfig | null`
- `canUndo(): boolean`
- `canRedo(): boolean`
- `clear(): void`

### DesignerClipboardService

Handles copy/paste operations.

**Methods:**
- `copy(data: ClipboardData): void`
- `paste(idGenerator: () => string, position?: Position): PasteResult | null`
- `hasContent(): boolean`

### Types

See `process-widget.models.ts` for complete type definitions:

- `ProcessDiagramConfig` - Complete diagram configuration
- `ProcessElement` - Union type of all element configurations
- `ProcessConnection` - Connection between elements
- `ProcessDataBinding` - Data binding configuration
- `ValueTransform` - Value transformation options
- `Threshold` - Threshold definition for color changes

See `primitives/models/` for primitive types:

- `PrimitiveBase` - Base interface for all primitives
- `RectanglePrimitive` - Rectangle shape
- `EllipsePrimitive` - Circle/Ellipse shape
- `LinePrimitive` - Line segment
- `PolylinePrimitive` - Multi-point line
- `PolygonPrimitive` - Closed polygon
- `PathPrimitive` - SVG path
- `TextPrimitive` - Text label
- `ImagePrimitive` - Image reference
