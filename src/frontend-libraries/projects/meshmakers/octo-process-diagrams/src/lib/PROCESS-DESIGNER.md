# Process Designer - Developer Documentation

## Overview

The Process Designer is a visual editor for process diagrams based on SVG. It enables creating, editing, and managing:

- **Elements**: Predefined process components (Tank, Valve, Pump, etc.)
- **Primitives**: Basic SVG shapes (Rectangle, Ellipse, Line, etc.)
- **Connections**: Connections between elements

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    ProcessDesignerComponent                      │
├─────────────┬─────────────────────────────────┬──────────────────┤
│  Toolbar    │        Canvas (SVG)             │ PropertyInspector│
│             │  ┌─────────────────────────┐    │                  │
│  - Mode     │  │ Elements & Primitives   │    │ - General        │
│  - Zoom     │  │ - Drag & Drop           │    │ - Position       │
│  - Grid     │  │ - Resize                │    │ - Style          │
│  - Actions  │  │ - Selection             │    │ - Type-specific  │
│             │  └─────────────────────────┘    │                  │
├─────────────┴─────────────────────────────────┴──────────────────┤
│                         Status Bar                               │
└──────────────────────────────────────────────────────────────────┘
```

## Components

### ProcessDesignerComponent

**Path:** `designer/process-designer.component.ts`

Main component of the designer. Manages:
- Diagram state (signal-based)
- Selection state
- Drag/Resize state
- Undo/Redo history
- Keyboard shortcuts

#### Important Signals

```typescript
// Diagram data
private readonly _diagram = signal<ProcessDiagramConfig>({...});

// Selection
private readonly _selection = signal<SelectionState>({
  elements: new Set<string>(),
  connections: new Set<string>()
});

// Drag state
private readonly _dragState = signal<DragState>({
  isDragging: boolean,
  elementId: string | null,
  startPosition: Position | null,
  startMousePosition: Position | null,
  isPrimitive?: boolean
});

// Resize state
private readonly _resizeState = signal<ResizeState>({...});
```

#### Coordinate Transformation

The method `getCanvasCoordinates()` converts mouse events to SVG coordinates:

```typescript
private getCanvasCoordinates(event: { clientX: number; clientY: number }): Position | null {
  const svg = container.querySelector('svg') as SVGSVGElement;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const ctm = svg.getScreenCTM();
  const svgPoint = point.matrixTransform(ctm.inverse());
  return { x: svgPoint.x, y: svgPoint.y };
}
```

**Important:** This method uses SVG's native transformation (`getScreenCTM`) to correctly account for ViewBox scaling.

### PropertyInspectorComponent

**Path:** `designer/property-inspector.component.ts`

Displays and edits properties of the selected object:

```typescript
@Input() selectedElements: ProcessElement[] = [];
@Input() selectedConnections: ProcessConnection[] = [];
@Input() selectedPrimitives: PrimitiveBase[] = [];

@Output() propertyChange = new EventEmitter<PropertyChangeEvent>();
```

#### Property Changes

```typescript
interface PropertyChangeEvent {
  elementId?: string;
  connectionId?: string;
  primitiveId?: string;
  property: string;      // e.g. "config.radiusX" or "style.fill.color"
  value: unknown;
}
```

Properties are written to the nested structure using `setNestedProperty()`.

### PrimitivePaletteComponent

**Path:** `designer/primitive-palette.component.ts`

Palette for drag & drop of new primitives:

```typescript
readonly primitiveTypes = [
  { type: 'rectangle', icon: '▭', label: 'Rectangle' },
  { type: 'ellipse', icon: '○', label: 'Ellipse' },
  // ...
];
```

## Primitives System

### Architecture

```
primitives/
├── models/                    # Data models
│   ├── primitive.models.ts    # Base interfaces
│   ├── rectangle.model.ts
│   ├── ellipse.model.ts
│   ├── line.model.ts
│   ├── polygon.model.ts
│   ├── path.model.ts
│   ├── text.model.ts
│   └── image.model.ts
├── renderers/                 # SVG rendering
│   ├── primitive-renderer.interface.ts
│   ├── rectangle.renderer.ts
│   ├── ellipse.renderer.ts
│   └── ...
└── primitive-renderer.registry.ts
```

### PrimitiveBase Interface

```typescript
interface PrimitiveBase {
  id: string;
  type: PrimitiveTypeValue;
  position: Position;           // Meaning varies by type
  style?: PrimitiveStyle;
  transform?: PrimitiveTransform;
  name?: string;
  visible?: boolean;
  zIndex?: number;
}
```

### Position Semantics

| Primitive | Position means                         |
|-----------|----------------------------------------|
| Rectangle | Top-left corner                        |
| Ellipse   | Center point (cx, cy)                  |
| Line      | Offset (usually 0,0), points in config |
| Polygon   | Offset (usually 0,0), points in config |
| Path      | Transform origin                       |
| Text      | Anchor point                           |
| Image     | Top-left corner                        |

### Renderer System

Each primitive type has a renderer that implements `PrimitiveRenderer<T>`:

```typescript
interface PrimitiveRenderer<T extends PrimitiveBase = PrimitiveBase> {
  readonly type: PrimitiveTypeValue;

  render(primitive: T, context: RenderContext): RenderResult;
  getBoundingBox(primitive: T): BoundingBox;
  containsPoint(primitive: T, x: number, y: number): boolean;
}
```

The `PrimitiveRendererRegistry` manages all renderers:

```typescript
@Injectable({ providedIn: 'root' })
export class PrimitiveRendererRegistry {
  render(primitive: PrimitiveBase, context?: Partial<RenderContext>): RenderResult | null;
  getBoundingBox(primitive: PrimitiveBase): BoundingBox | null;
  containsPoint(primitive: PrimitiveBase, x: number, y: number): boolean;
}
```

## Drag & Drop

### Flow

1. **MouseDown** on Primitive/Element
   - Stores `startPosition` (original position of the object)
   - Stores `startMousePosition` (mouse position at start)
   - Sets `isDragging = true`

2. **MouseMove** (Document level)
   - Calculates delta: `delta = currentMouse - startMouse`
   - New position: `newPosition = startPosition + delta`
   - Optional: Apply grid snapping

3. **MouseUp**
   - Sets `isDragging = false`
   - Saves to history (for undo)

### Code

```typescript
// MouseDown
this._dragState.set({
  isDragging: true,
  elementId: primitive.id,
  startPosition: { ...primitive.position },
  startMousePosition: { ...coords },
  isPrimitive: true
});

// MouseMove
const deltaX = coords.x - dragState.startMousePosition.x;
const deltaY = coords.y - dragState.startMousePosition.y;
const newPosition = this.snapPosition({
  x: dragState.startPosition.x + deltaX,
  y: dragState.startPosition.y + deltaY
});
```

## Resize

### Handle Positions

```
nw ─────── ne
│           │
│           │
sw ─────── se
```

### Resize Logic

```typescript
switch (resizeState.handle) {
  case 'se':  // South-East
    newWidth = Math.max(minSize, coords.x - startBounds.x);
    newHeight = Math.max(minSize, coords.y - startBounds.y);
    break;
  case 'nw':  // North-West - change position AND size
    newWidth = Math.max(minSize, startBounds.x + startBounds.width - coords.x);
    newHeight = Math.max(minSize, startBounds.y + startBounds.height - coords.y);
    newX = startBounds.x + startBounds.width - newWidth;
    newY = startBounds.y + startBounds.height - newHeight;
    break;
  // ...
}
```

## Selection

### Multi-Selection

- **Click**: Single selection
- **Ctrl/Cmd + Click**: Add/remove from selection
- **Shift + Click**: Add to selection

### Selection State

```typescript
interface SelectionState {
  elements: Set<string>;      // IDs of Elements AND Primitives
  connections: Set<string>;   // IDs of Connections
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| V | Select mode |
| H | Pan mode |
| C | Connect mode |
| Delete/Backspace | Delete |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+A | Select all |
| Ctrl+S | Save |
| Ctrl+C | Copy |
| Ctrl+V | Paste |
| Ctrl+G | Group |
| Ctrl+Shift+G | Ungroup |
| Alt+1 | Toggle left panel |
| Alt+2 | Toggle right panel |
| Escape | Clear selection / Close menu |
| Arrow keys | Nudge (move 1px) |
| Shift+Arrow keys | Large nudge (move 10px) |
| Ctrl+] | Bring forward |
| Ctrl+Shift+] | Bring to front |
| Ctrl+[ | Send backward |
| Ctrl+Shift+[ | Send to back |

## Styling

### Primitive Style

```typescript
interface PrimitiveStyle {
  fill?: FillStyle;
  stroke?: StrokeStyle;
  opacity?: number;
}

interface FillStyle {
  color?: string;
  opacity?: number;
}

interface StrokeStyle {
  color?: string;
  width?: number;
  dashArray?: string;
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
}
```

## Adding a New Primitive Type

1. **Create model** in `primitives/models/`:
   ```typescript
   export interface MyPrimitiveConfig {
     // Type-specific properties
   }

   export interface MyPrimitive extends PrimitiveBase {
     type: typeof PrimitiveType.MyType;
     config: MyPrimitiveConfig;
   }
   ```

2. **Create renderer** in `primitives/renderers/`:
   ```typescript
   export class MyRenderer implements PrimitiveRenderer<MyPrimitive> {
     readonly type = PrimitiveType.MyType;

     render(primitive: MyPrimitive, context: RenderContext): RenderResult { ... }
     getBoundingBox(primitive: MyPrimitive): BoundingBox { ... }
     containsPoint(primitive: MyPrimitive, x: number, y: number): boolean { ... }
   }
   ```

3. **Register renderer** in `primitive-renderer.registry.ts`:
   ```typescript
   private registerBuiltInRenderers(): void {
     // ...
     this.register(new MyRenderer());
   }
   ```

4. **Add to palette** in `primitive-palette.component.ts`

5. **Extend PropertyInspector** with type-specific fields

6. **Extend template** in `process-designer.component.ts` for rendering

## Services

### Overview

The designer uses multiple services for better separation of concerns:

```
designer/services/
├── designer-state.service.ts       # Diagram state, modes, zoom/pan
├── designer-selection.service.ts   # Selection logic
├── designer-clipboard.service.ts   # Copy/paste
├── designer-history.service.ts     # Undo/redo
├── designer-creation.service.ts    # Element/primitive creation, ID generation
├── designer-keyboard.service.ts    # Keyboard shortcuts
├── designer-rendering.service.ts   # Connection path, element transforms
└── index.ts                        # Barrel export
```

### DesignerCreationService

Responsible for:
- `generateId()` - Unique ID generation
- `createDefaultPrimitive(type, position)` - Create new primitives
- `addSymbolInstance(symbolDef, position)` - Create symbol instances

### DesignerKeyboardService

Manages keyboard shortcuts:

```typescript
// Register shortcut
keyboardService.registerShortcut({
  id: 'myAction',
  key: 'k',
  modifiers: { ctrl: true },
  description: 'My custom action'
});

// Process event
const result = keyboardService.processKeyEvent(event);
if (result.handled) {
  executeAction(result.actionId);
}
```

### DesignerRenderingService

- `getConnectionPath(connection)` - SVG path for connections
- `getPortPosition(element, port)` - Calculate port positions

## Symbol System

### Symbol Definitions

```typescript
interface SymbolDefinition {
  rtId: string;              // Backend ID
  name: string;
  description?: string;
  version: string;
  primitives: PrimitiveBase[];
  symbolInstances?: SymbolInstance[];  // Nested symbols
  bounds: { width: number; height: number };
  category?: string;
  tags?: string[];
}
```

### Symbol Instances

Placed symbols in the diagram:

```typescript
interface SymbolInstance {
  id: string;
  symbolRtId: string;        // Reference to SymbolDefinition
  position: Position;
  scale?: number;
  rotation?: number;
  name?: string;
  zIndex?: number;
}
```

### Symbol Rendering Locations

Symbols are rendered in multiple places:

| Location | File | Description |
|----------|------|-------------|
| Canvas | `process-designer.component.html` | Main editor |
| Symbol list (small) | `symbol-library-admin.component.ts` | Preview in list |
| Symbol details (large) | `symbol-library-admin.component.ts` | Large preview |

## Styling & Opacity

### Style Structure

```typescript
interface PrimitiveStyle {
  fill?: FillStyle;
  stroke?: StrokeStyle;
  opacity?: number;        // Overall opacity
}

interface FillStyle {
  color?: string;          // CSS color (e.g. "#ff0000")
  opacity?: number;        // Fill opacity (0-1)
}

interface StrokeStyle {
  color?: string;
  width?: number;
  opacity?: number;        // Stroke opacity (0-1)
  dashArray?: number[];    // Line pattern (e.g. [8,4] for dashed)
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
}
```

### SVG Attributes for Opacity

In templates, `fill-opacity` and `stroke-opacity` must be set:

```html
<rect [attr.fill]="primitive.style?.fill?.color ?? '#e3f2fd'"
      [attr.fill-opacity]="primitive.style?.fill?.opacity ?? 1"
      [attr.stroke]="primitive.style?.stroke?.color ?? '#666'"
      [attr.stroke-opacity]="primitive.style?.stroke?.opacity ?? 1"
      .../>
```

### Property Inspector for Opacity

The Property Inspector shows opacity sliders next to color pickers:

```html
<div class="color-with-opacity">
  <input type="color" [value]="..." (change)="..."/>
  <input type="range" class="opacity-slider"
         [value]="(opacity ?? 1) * 100"
         min="0" max="100"
         (input)="onOpacityChange(+$event.target.value / 100)"/>
  <span class="opacity-value">{{ (opacity * 100) | number:'1.0-0' }}%</span>
</div>
```

## Line Types

### Available Line Types

| Type | dashArray | Description |
|------|-----------|-------------|
| Solid | `undefined` | Continuous line |
| Dashed | `[8, 4]` | Long dashes with gaps |
| Dotted | `[2, 2]` | Small dots |
| Dash-Dot | `[8, 4, 2, 4]` | Alternating dash and dot |
| Long Dash | `[12, 6]` | Longer dashes |

### SVG Attribute for Line Types

```html
<rect [attr.stroke-dasharray]="getStrokeDashArray(primitive.style?.stroke?.dashArray)"
      .../>
```

### Helper Method

Both `process-designer.component.ts` and `symbol-library-admin.component.ts` need this helper:

```typescript
getStrokeDashArray(dashArray: number[] | undefined): string {
  if (!dashArray || dashArray.length === 0) {
    return '';
  }
  return dashArray.join(' ');
}
```

### Property Inspector for Line Types

Line type selector with preview in `property-inspector.component.ts`:

```typescript
private readonly lineTypes: Record<string, number[] | undefined> = {
  'solid': undefined,
  'dashed': [8, 4],
  'dotted': [2, 2],
  'dash-dot': [8, 4, 2, 4],
  'long-dash': [12, 6]
};

getLineType(dashArray: number[] | undefined): string {
  if (!dashArray || dashArray.length === 0) return 'solid';
  const dashStr = dashArray.join(',');
  for (const [type, pattern] of Object.entries(this.lineTypes)) {
    if (pattern && pattern.join(',') === dashStr) return type;
  }
  return 'solid';
}
```

## Best Practices

### Performance

- Use `computed()` for derived values
- Avoid unnecessary diagram updates
- Use `trackBy` in `@for` loops

### Coordinates

- Always use `getCanvasCoordinates()` for mouse events
- Never directly convert `clientX/clientY` to SVG coordinates
- Consider ViewBox scaling

### State Management

- Diagram state is immutable (create new objects on updates)
- Selection state uses Sets for fast lookups
- Push to history after every relevant change for undo/redo

---

## Checklist: Adding a New Style Property

When adding new style properties (like opacity), **all** these locations must be updated:

### 1. Extend Model
- [ ] `primitives/models/primitive.models.ts` - Extend interface (e.g. `FillStyle`, `StrokeStyle`)
- [ ] Update default values in `DEFAULT_STYLE`

### 2. Update Renderer
- [ ] `primitives/renderers/primitive-renderer.interface.ts` - Extend `buildStyleAttributes()`

### 3. Property Inspector UI
- [ ] `designer/property-inspector.component.ts` - Add template with new inputs/sliders
- [ ] Add CSS styles for new UI elements
- [ ] Import new pipes if needed (e.g. `DecimalPipe`)

### 4. Process Designer Canvas
- [ ] `designer/process-designer.component.html`:
  - [ ] Primitives rendering (~line 280-340)
  - [ ] Symbol primitives rendering (~line 435-490)

### 5. Symbol Library Admin (Previews)
- [ ] `admin/symbol-library-admin.component.ts`:
  - [ ] Small symbol preview in list (~line 217-275)
  - [ ] Large symbol preview in detail panel (~line 344-412)

### 6. Tests
- [ ] Update renderer tests
- [ ] Update service tests

---

## Checklist: Adding a New Primitive Type

### 1. Model
- [ ] New model in `primitives/models/mytype.model.ts`
- [ ] Interface with `config` for type-specific properties
- [ ] Factory function `createMyType(...)`
- [ ] Export in `primitives/models/index.ts`
- [ ] Extend `PrimitiveType` enum in `primitive.models.ts`

### 2. Renderer
- [ ] New renderer in `primitives/renderers/mytype.renderer.ts`
- [ ] Implement `render()`, `getBoundingBox()`, `containsPoint()`
- [ ] Register in `PrimitiveRendererRegistry`
- [ ] Export in `primitives/renderers/index.ts`

### 3. Designer
- [ ] `process-designer.component.html` - Add `@case` for new type in primitives rendering
- [ ] `process-designer.component.html` - Add `@case` for new type in symbol primitives rendering
- [ ] Adjust `getPrimitiveBoundingBox()` in component if needed

### 4. UI
- [ ] `primitive-palette.component.ts` - Add new type to palette
- [ ] `property-inspector.component.ts` - Add type-specific properties

### 5. Symbol Admin Previews
- [ ] `symbol-library-admin.component.ts` - Extend both preview areas:
  - [ ] Small preview (~line 217)
  - [ ] Large preview (~line 344)

### 6. Creation Service
- [ ] `designer-creation.service.ts` - Extend `createDefaultPrimitive()`

### 7. SVG Import (if relevant)
- [ ] `services/svg-import.service.ts` - Parser for new SVG element type

---

## Checklist: Adding a New Keyboard Shortcut

### 1. Service
- [ ] `designer/services/designer-keyboard.service.ts`:
  - [ ] Add new shortcut in `registerDefaultShortcuts()`:
    ```typescript
    { id: 'my-action', key: 'k', modifiers: { ctrl: true }, description: 'My Action', preventDefault: true }
    ```

### 2. Component
- [ ] `process-designer.component.ts`:
  - [ ] Add handler for new `actionId` in `onKeyDown()`:
    ```typescript
    case 'my-action':
      this.myAction();
      break;
    ```

### 3. Documentation
- [ ] Update keyboard shortcuts table in this file

---

## File Reference for Common Changes

| Change | Files |
|--------|-------|
| New style property | `primitive.models.ts`, `primitive-renderer.interface.ts`, `property-inspector.component.ts`, `process-designer.component.html`, `symbol-library-admin.component.ts` |
| New primitive type | `primitives/models/*.ts`, `primitives/renderers/*.ts`, `process-designer.component.html`, `primitive-palette.component.ts`, `property-inspector.component.ts`, `symbol-library-admin.component.ts` |
| Keyboard shortcut | `designer-keyboard.service.ts`, `process-designer.component.ts` |
| Symbol feature | `symbol.model.ts`, `process-designer.component.html`, `symbol-library-admin.component.ts`, `symbol-library-panel.component.ts` |
| History/Undo | `designer-history.service.ts`, `process-designer.component.ts` |
| Line types | `property-inspector.component.ts` (selector), `process-designer.component.html` (stroke-dasharray), `symbol-library-admin.component.ts` (previews) |
| Opacity | `property-inspector.component.ts` (sliders), `process-designer.component.html` (fill-opacity, stroke-opacity), `symbol-library-admin.component.ts` (previews) |

---

## Dockview Integration

### Overview

The Process Designer supports an optional flexible panel system using [dockview-angular](https://dockview.dev). When enabled, users can:

- Drag and drop panels to rearrange layout
- Resize panels by dragging separators
- Float panels as separate windows
- Tab panels together
- Hide/show panels via View menu or keyboard shortcuts
- Save and restore custom layouts

### Enabling Dockview Mode

Enable dockview by setting the `useDockview` input:

```html
<mm-process-designer
  [diagramConfig]="diagram"
  [useDockview]="true"
  (saveRequest)="onSave($event)">
</mm-process-designer>
```

For Symbol Editor:

```html
<mm-symbol-editor
  [symbol]="symbol"
  [useDockview]="true"
  (symbolChange)="onSymbolChange($event)">
</mm-symbol-editor>
```

### Architecture with Dockview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         ProcessDesignerComponent                      │
├──────────────────────────────────────────────────────────────────────┤
│                              Toolbar                                  │
│  [Mode] [Zoom] [Grid] ... [View ▼]                                   │
├────────────────────────────┬─────────────────────────────────────────┤
│   Dockview Panels (400px)  │           Canvas (SVG)                  │
│  ┌─────────────────────┐   │  ┌─────────────────────────────────┐    │
│  │ Elements │ Symbols  │   │  │                                 │    │
│  ├─────────────────────┤   │  │      Process Diagram            │    │
│  │                     │   │  │                                 │    │
│  │  Draggable palette  │   │  │                                 │    │
│  │                     │   │  └─────────────────────────────────┘    │
│  ├─────────────────────┤   │                                         │
│  │ Properties          │   │                                         │
│  ├─────────────────────┤   │                                         │
│  │ Transform           │   │                                         │
│  ├─────────────────────┤   │                                         │
│  │ Animations          │   │                                         │
│  └─────────────────────┘   │                                         │
├────────────────────────────┴─────────────────────────────────────────┤
│                           Status Bar                                  │
└──────────────────────────────────────────────────────────────────────┘
```

### Available Panels

| Panel ID | Title | Description | Keyboard |
|----------|-------|-------------|----------|
| `elements` | Elements | Shape palette for drag & drop | Alt+1 |
| `symbols` | Symbols | Symbol library browser | Alt+2 |
| `properties` | Properties | Property inspector for selection | Alt+3 |
| `transform` | Transform | Transform properties (symbol mode) | Alt+4 |
| `animations` | Animations | SVG animation editor | Alt+5 |
| `simulation` | Simulation | Simulation value testing | Alt+6 |

### Panel Components

Located in `designer/panels/`:

```
panels/
├── elements-panel.component.ts     # Wraps ElementPaletteComponent
├── symbols-panel.component.ts      # Wraps SymbolLibraryPanelComponent
├── properties-panel.component.ts   # Wraps PropertyInspectorComponent
├── transform-panel.component.ts    # Transform property grid
├── animations-panel.component.ts   # Animation editor
└── simulation-panel.component.ts   # Simulation value controls
```

Each panel implements the dockview panel interface:

```typescript
@Component({
  selector: 'mm-elements-panel',
  template: `
    <div class="panel-container">
      <mm-element-palette
        (elementDragStart)="onDragStart($event)"
        (elementDragEnd)="onDragEnd($event)">
      </mm-element-palette>
    </div>
  `
})
export class ElementsPanelComponent implements IDockviewPanelProps {
  @Input() params!: Record<string, unknown>;
}
```

### View Menu

When dockview is enabled, a View menu appears in the toolbar:

```
┌────────────────────┐
│ ✓ Elements   Alt+1 │
│ ✓ Symbols    Alt+2 │
│ ✓ Properties Alt+3 │
│ ✓ Transform  Alt+4 │
│   Animations Alt+5 │
│   Simulation Alt+6 │
│ ─────────────────── │
│   Reset Layout Alt+0│
└────────────────────┘
```

### Keyboard Shortcuts (Dockview Mode)

| Key | Action |
|-----|--------|
| Alt+1 | Toggle Elements panel |
| Alt+2 | Toggle Symbols panel |
| Alt+3 | Toggle Properties panel |
| Alt+4 | Toggle Transform panel |
| Alt+5 | Toggle Animations panel |
| Alt+6 | Toggle Simulation panel |
| Alt+0 | Reset layout to default |

### Layout Persistence

Layouts are automatically saved to localStorage per user:

```typescript
// Storage keys
'process-designer-layout-v1-{userId}'   // Diagram mode
'symbol-editor-layout-v1-{userId}'      // Symbol mode
```

**DesignerLayoutService API:**

```typescript
@Injectable({ providedIn: 'root' })
export class DesignerLayoutService {
  // Save current layout
  saveLayout(layout: SerializedDockview, userId: string, isSymbolEditor = false): void;

  // Load saved layout (returns null if none)
  loadLayout(userId: string, isSymbolEditor = false): SerializedDockview | null;

  // Clear saved layout
  clearLayout(userId: string, isSymbolEditor = false): void;

  // Check if layout exists
  hasLayout(userId: string, isSymbolEditor = false): boolean;

  // Get default panel configuration
  readonly defaultPanels: DesignerPanelConfig[];
  readonly symbolEditorDefaultPanels: DesignerPanelConfig[];
}
```

**Usage in Component:**

```typescript
onDockviewReady(event: DockviewReadyEvent): void {
  this.dockviewApi = event.api;

  // Try to restore saved layout
  const savedLayout = this.layoutService.loadLayout('default', this.editorMode === 'symbol');
  if (savedLayout) {
    try {
      event.api.fromJSON(savedLayout);
    } catch {
      this.createDefaultDockviewLayout(event.api);
    }
  } else {
    this.createDefaultDockviewLayout(event.api);
  }

  // Auto-save on layout changes
  event.api.onDidLayoutChange(() => {
    const layout = this.dockviewApi.toJSON();
    this.layoutService.saveLayout(layout, 'default', this.editorMode === 'symbol');
  });
}
```

### Default Layout Configuration

**Diagram Mode:**
```
┌───────────────┬───────────────────────────────┐
│ Elements      │                               │
│ Symbols (tab) │         Canvas                │
├───────────────┤                               │
│ Properties    │                               │
└───────────────┴───────────────────────────────┘
```

**Symbol Mode (adds):**
```
┌───────────────┬───────────────────────────────┐
│ Elements      │                               │
│ Symbols (tab) │         Canvas                │
├───────────────┤                               │
│ Properties    │                               │
├───────────────┤                               │
│ Transform     │                               │
│ Animations    │                               │
├───────────────┤                               │
│ Simulation    │                               │
└───────────────┴───────────────────────────────┘
```

### LCARS Theming (Refinery Studio)

The library exports SCSS styles for LCARS-themed dockview panels:

**Usage in consuming app (styles.scss):**

```scss
@use '@meshmakers/octo-process-diagrams/styles/dockview-lcars-theme' as dockview;
@include dockview.lcars-theme();
```

**Theme CSS Variables:**

```scss
mm-process-designer,
mm-symbol-editor {
  // Panel backgrounds
  --dv-background-color: #07172b;           // Deep Sea
  --dv-pane-background-color: #1f2e40;      // Surface Elevated
  --dv-tabs-and-actions-container-background-color: #394555;  // Iron Navy

  // Active tab
  --dv-activegroup-visiblepanel-tab-background-color: #1f2e40;
  --dv-activegroup-visiblepanel-tab-color: #64ceb9;  // Octo Mint
  --dv-tab-active-border-bottom: 2px solid #64ceb9;

  // Inactive tab
  --dv-inactivegroup-visiblepanel-tab-color: #9292a6;  // Ash Blue

  // Drag overlay
  --dv-drag-over-background-color: rgba(100, 206, 185, 0.15);
  --dv-drag-over-border-color: #64ceb9;

  // Resize sash
  --dv-sash-color: rgba(100, 206, 185, 0.2);
  --dv-sash-hover-color: #64ceb9;
}
```

### CSS-Only Theme (Alternative)

For apps not using SCSS, apply CSS variables directly:

```css
mm-process-designer {
  --dv-background-color: #07172b;
  --dv-pane-background-color: #1f2e40;
  --dv-activegroup-visiblepanel-tab-color: #64ceb9;
  /* ... see _dockview-lcars-theme.scss for full list */
}
```

### Programmatic Panel Control

```typescript
// Toggle panel visibility
togglePanelVisibility(panelId: string): void {
  const panel = this.dockviewApi?.getPanel(panelId);
  if (panel) {
    panel.api.close();
    this._panelVisibility.update(v => ({ ...v, [panelId]: false }));
  } else {
    this.addPanel(panelId);
  }
}

// Check if panel is visible
isPanelVisible(panelId: string): boolean {
  return this._panelVisibility()[panelId] ?? false;
}

// Reset to default layout
resetDockviewLayout(): void {
  this.layoutService.clearLayout('default', this.editorMode === 'symbol');
  this.dockviewApi?.panels.forEach(panel => panel.api.close());
  this.createDefaultDockviewLayout(this.dockviewApi);
}
```

### Panel Components Map

```typescript
readonly panelComponents: Record<string, unknown> = {
  elements: ElementsPanelComponent,
  symbols: SymbolsPanelComponent,
  properties: PropertiesPanelComponent,
  transform: TransformPanelComponent,
  animations: AnimationsPanelComponent,
  simulation: SimulationPanelWrapperComponent
};
```

### Checklist: Adding a New Dockview Panel

1. **Create Panel Component:**
   - [ ] New component in `designer/panels/`
   - [ ] Implement `IDockviewPanelProps` interface
   - [ ] Add `@Input() params` for dockview communication
   - [ ] Export in `designer/panels/index.ts`

2. **Register Panel:**
   - [ ] Add to `panelComponents` map in `ProcessDesignerComponent`
   - [ ] Add to `panelConfig` array with id, label, shortcut

3. **Update Layout:**
   - [ ] Add to `defaultPanels` in `DesignerLayoutService`
   - [ ] Update `createDefaultDockviewLayout()` to position new panel

4. **Add Keyboard Shortcut:**
   - [ ] Register in `setupPanelKeyboardShortcuts()`
   - [ ] Use Alt+N pattern (next available number)

5. **Update LCARS Theme:**
   - [ ] Add selector to `_dockview-lcars-theme.scss` if needed

6. **Documentation:**
   - [ ] Update panel table in this file
   - [ ] Update keyboard shortcuts table
