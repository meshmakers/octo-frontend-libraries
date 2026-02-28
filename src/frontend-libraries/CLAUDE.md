# Frontend Libraries - Project Knowledge

## Project Structure

- **Angular 21** with standalone components and signals
- **Kendo UI Angular 21** for UI components (Charts, Gauges, Grid, etc.)
- **Apollo Client** for GraphQL
- **Monorepo** with multiple projects under `projects/`:
  - `demo-app` - Demo application
  - `meshmakers/octo-ui` - Shared UI components library
  - `meshmakers/octo-services` - GraphQL services library
  - `meshmakers/octo-meshboard` - MeshBoard dashboard widget system
  - `meshmakers/octo-process-diagrams` - Process diagram/symbol editor
  - `meshmakers/shared-auth` - Authentication library
  - `meshmakers/shared-services` - Shared services
  - `meshmakers/shared-ui` - Shared UI utilities
  - `meshmakers/shared-ui-legacy` - Legacy Material UI (backward compatibility)
  - `meshmakers/octo-ui-legacy` - Legacy Material UI components (backward compatibility)

## Build Commands

```bash
# Build demo-app (with lint)
npm run build:demo-app

# Build library projects
npm run build:octo-services
npm run build:octo-ui
npm run build:octo-meshboard
npm run build:octo-process-diagrams
npm run build:shared-ui

# Generate GraphQL types
npm run codegen
npm run codegen:demo-app

# Run tests for specific project
npm test -- --project=@meshmakers/octo-meshboard --watch=false
```

## Documentation Standards

- **All concept documents and technical documentation must be written in English**
- **Every code change must include updated developer documentation** — when adding, modifying, or removing features, update the relevant README.md, CLAUDE.md, or inline documentation accordingly
- New shared components should have:
  - Developer documentation in the component folder
  - Demo page in demo-app with usage examples
- **All library components must use neutral/theme-agnostic styling** — no LCARS-specific colors, fonts, or design language. Use CSS custom properties (variables) with neutral defaults so host applications can apply their own theme.
- Theme-specific styling (e.g., LCARS) is the responsibility of the consuming host application (via `styles.scss` or CSS variable overrides)

## Testing (REQUIRED)

**IMPORTANT: Always run tests after every code change!**

- **Unit tests and integration tests must be executed** after every code change to ensure nothing is broken
- **Existing tests must be updated** when the behavior of tested code changes
- **New tests must be added** when new features, components, or services are implemented
- If tests fail, fix them before committing — never commit code with failing tests

```bash
# Run all tests
npm test -- --watch=false --browsers=ChromeHeadless

# Run tests for specific library
npm test -- --project=@meshmakers/octo-meshboard --watch=false
npm test -- --project=@meshmakers/shared-auth --watch=false
```

## Linting (REQUIRED)

**IMPORTANT: Always run the linter after every code change!**

The CI/CD pipeline runs lint before building each library. If linting fails, the build fails.

```bash
# Lint all projects
npm run lint

# Lint specific library
npm run lint:octo-ui
npm run lint:octo-services
npm run lint:octo-meshboard
npm run lint:shared-ui
npm run lint:shared-auth
npm run lint:shared-services
npm run lint:octo-process-diagrams
```

Common lint issues:
- **Unused imports**: Auto-fix with `npm run lint:octo-ui -- --fix`
- **Unused variables**: Prefix with `_` if intentionally unused (e.g., `_unused`)
- **Missing type annotations**: Add explicit types

**Before committing**: Always verify the affected library builds successfully:
```bash
npm run build:octo-ui      # or whichever library was modified
```

## Pre-Commit Checklist (MANDATORY)

**CRITICAL: Before every commit and push, ALL of the following steps MUST be completed locally to prevent CI failures. NEVER push code without running lint and build locally first — this has caused multiple failed CI builds in the past.**

### 1. Regenerate package-lock.json (if dependencies changed)

If `package.json` was modified (directly or via `npm install`), the `package-lock.json` must be regenerated:

```bash
# In frontend-libraries directory
rm -f package-lock.json
npm install
```

This is required because CI uses `npm ci` which requires `package.json` and `package-lock.json` to be in sync.

### 2. Run Linter

```bash
npm run lint
```

### 3. Run Tests

```bash
npm test -- --watch=false --browsers=ChromeHeadless
```

### 4. Verify Build

```bash
npm run build:prod
```

### Quick Pre-Commit Script

```bash
# Run all checks before committing
npm run lint && npm test -- --watch=false --browsers=ChromeHeadless && npm run build:prod
```

## MeshBoard Widget System (octo-meshboard)

> **Note:** Detailed documentation for the MeshBoard system is available in `projects/meshmakers/octo-meshboard/CLAUDE.md`

### Architecture

Located in `projects/meshmakers/octo-meshboard/src/lib/`:

- **models/meshboard.models.ts** - Widget configuration interfaces
- **services/meshboard-state.service.ts** - Central state management
- **services/meshboard-grid.service.ts** - Grid layout and collision detection
- **services/meshboard-variable.service.ts** - Variable resolution
- **services/meshboard-data.service.ts** - Data fetching
- **services/widget-registry.service.ts** - Widget type registry
- **services/meshboard-persistence.service.ts** - Save/load MeshBoards
- **widgets/** - Individual widget components

### Supported Widget Types

1. **KPI** - Single numeric value with optional trend indicator
2. **Gauge** - Arc, Circular, Linear, Radial gauges
3. **BarChart** - Bar/Column charts
4. **PieChart** - Pie/Donut charts
5. **Table** - Data grid with pagination
6. **EntityCard** - Single entity display (UML-style)
7. **EntityWithAssociations** - Entity with relationships
8. **StatusIndicator** - Traffic light status indicators
9. **ServiceHealth** - Backend service health monitoring
10. **Process** - Process diagram/HMI editor

### Data Sources

Widgets support multiple data source types:

```typescript
type DataSourceType =
  | 'runtimeEntity'      // Single entity by rtId
  | 'persistentQuery'    // Execute saved query
  | 'aggregation'        // Count/sum/avg queries
  | 'serviceCall'        // Health checks
  | 'constructionKitQuery' // CK data (models, types)
  | 'static';            // Static data for testing

// Runtime Entity - fetch single entity by ID
interface RuntimeEntityDataSource {
  type: 'runtimeEntity';
  ckTypeId?: string;
  rtId?: string;
}

// Persistent Query - execute saved query
interface PersistentQueryDataSource {
  type: 'persistentQuery';
  queryRtId: string;
  queryName?: string;
}

// Aggregation - count/sum/avg queries
interface AggregationDataSource {
  type: 'aggregation';
  queries: AggregationQuery[];
}
```

### Query Modes for KPI/Gauge Widgets

When using `PersistentQueryDataSource`:

- **simpleCount**: Display `totalCount` from query results
- **aggregation**: Single value from aggregation query (1 row, 1 column)
- **groupedAggregation**: Select category field + value, display corresponding value

### Persistence Mapping

Backend uses `systemQuery` for data source type, frontend uses `persistentQuery`:

```typescript
// Frontend -> Backend
const dataSourceType = widget.dataSource.type === 'persistentQuery' ? 'systemQuery' : widget.dataSource.type;

// Backend -> Frontend
if (widget.dataSourceType === 'systemQuery' || widget.dataSourceType === 'persistentQuery') {
  return { type: 'persistentQuery', ... };
}
```

## Kendo Angular Gauges - Important Notes

### Provider Issue with Standalone Components

Kendo Gauges require `CollectionChangesService` to be provided. For standalone components:

```typescript
// In app.config.ts - provide at app level
import { importProvidersFrom } from '@angular/core';
import { GaugesModule } from '@progress/kendo-angular-gauges';

export const appConfig: ApplicationConfig = {
  providers: [
    importProvidersFrom(GaugesModule),
    // ...
  ]
};

// In component - also provide locally
import { CollectionChangesService, KENDO_GAUGES } from '@progress/kendo-angular-gauges';

@Component({
  imports: [KENDO_GAUGES],
  providers: [CollectionChangesService],
})
```

### Linear Gauge Value Display Issue

Linear gauge pointer doesn't update reactively with signals. Solution: wrap in `@if` to defer rendering until data is loaded:

```html
@if (data()) {
  <kendo-lineargauge>
    <kendo-lineargauge-pointers>
      <kendo-lineargauge-pointer [value]="numericValue()">
      </kendo-lineargauge-pointer>
    </kendo-lineargauge-pointers>
  </kendo-lineargauge>
}
```

### Linear Gauge Pointer Syntax

Use `<kendo-lineargauge-pointers>` wrapper:

```html
<kendo-lineargauge>
  <kendo-lineargauge-scale [min]="0" [max]="100">
    <kendo-lineargauge-scale-labels [visible]="true"></kendo-lineargauge-scale-labels>
  </kendo-lineargauge-scale>
  <kendo-lineargauge-pointers>
    <kendo-lineargauge-pointer [value]="value"></kendo-lineargauge-pointer>
  </kendo-lineargauge-pointers>
</kendo-lineargauge>
```

## GraphQL Development

### Code Generation

**IMPORTANT:** GraphQL TypeScript files (`.ts`) are **auto-generated** by codegen. Never modify them directly!

```bash
# Regenerate all GraphQL types after schema changes
npm run codegen
npm run codegen:demo-app
```

**Workflow for GraphQL changes:**
1. Modify only the `.graphql` files (queries, mutations, subscriptions)
2. Update the backend CK types if adding new fields
3. Run `npm run codegen` to regenerate TypeScript types
4. Update the service files that use the generated types

**File Structure:**
```
projects/meshmakers/<library>/src/lib/graphQL/
├── *.graphql          # ← EDIT THESE (source files)
├── *.ts               # ← GENERATED (do not edit!)
└── globalTypes.ts     # ← GENERATED from schema
```

### GraphQL Queries

Located in `projects/meshmakers/octo-meshboard/src/lib/graphQL/`:

- **getSystemPersistentQueries.ts** - List available persistent queries
- **executeRuntimeQuery.ts** - Execute a query by rtId
- **getDashboards.ts** / **getDashboardWithWidgets.ts** - MeshBoard CRUD
- **createDashboardWidget.ts** / **updateDashboardWidget.ts** - Widget CRUD
- **getEntitiesByCkType.ts** - Fetch entities by CK type
- **getCkModelsWithState.ts** - CK models with state (for charts)

Query result structure for aggregations:

```typescript
{
  columns: [{ attributePath: string, attributeValueType: string }],
  rows: {
    totalCount: number,
    items: [{
      __typename: 'RtAggregationQueryRow' | 'RtGroupingAggregationQueryRow',
      cells: {
        items: [{ attributePath: string, value: unknown }]
      }
    }]
  }
}
```

## Common Patterns

### Sanitize Field Names

GraphQL attribute paths contain dots, sanitize for comparison:

```typescript
private sanitizeFieldName(fieldName: string): string {
  return fieldName.replace(/\./g, '_');
}
```

### Extract Values from Query Results

```typescript
// For aggregation queries
const firstRow = rows.find(row => supportedRowTypes.includes(row.__typename));
const cells = firstRow?.cells?.items ?? [];
const cell = cells.find(c => sanitizeFieldName(c.attributePath) === valueField);
const value = parseFloat(String(cell?.value));

// For grouped aggregation - find matching category
for (const row of rows) {
  const cells = row.cells?.items ?? [];
  let categoryMatch = false;
  let value = 0;

  for (const cell of cells) {
    if (sanitizeFieldName(cell.attributePath) === categoryField &&
        String(cell.value) === categoryValue) {
      categoryMatch = true;
    }
    if (sanitizeFieldName(cell.attributePath) === valueField) {
      value = parseNumericValue(cell.value);
    }
  }

  if (categoryMatch) return value;
}
```

## Process Designer (octo-meshboard / octo-process-diagrams)

### Overview

Located in `projects/meshmakers/octo-meshboard/src/lib/widgets/process-widget/` and `projects/meshmakers/octo-process-diagrams/src/lib/`:

The Process Designer is a visual editor for creating HMI-style process diagrams. It supports:
- **Elements**: High-level process components (tanks, pumps, valves, etc.)
- **Primitives**: Basic shapes (rectangles, ellipses, lines, paths, text, images)
- **Symbol Instances**: Reusable symbols from the Symbol Library
- **Connections**: Lines connecting elements

### Key Components

| Component | File | Description |
|-----------|------|-------------|
| ProcessDesignerComponent | `designer/process-designer.component.ts` | Main editor component |
| ElementPaletteComponent | `designer/element-palette.component.ts` | Draggable element palette |
| PropertyInspectorComponent | `designer/property-inspector.component.ts` | Properties panel |
| SymbolLibraryPanelComponent | `designer/symbol-library-panel.component.ts` | Symbol library browser |

### Services

| Service | File | Description |
|---------|------|-------------|
| DesignerSelectionService | `designer/services/designer-selection.service.ts` | Selection state management |
| DesignerHistoryService | `designer/services/designer-history.service.ts` | Undo/Redo functionality |
| DesignerClipboardService | `designer/services/designer-clipboard.service.ts` | Copy/Paste operations |
| DesignerPrimitiveService | `designer/services/designer-primitive.service.ts` | Primitive type handlers (move, resize, bounds) |
| DesignerBoundsService | `designer/services/designer-bounds.service.ts` | Bounds calculations for selection/content |
| DesignerAlignmentGuideService | `designer/services/designer-alignment-guide.service.ts` | Alignment guides during drag |
| DesignerDragService | `designer/services/designer-drag.service.ts` | Drag state management |
| DesignerCoordinateService | `designer/services/designer-coordinate.service.ts` | Canvas coordinate conversion |
| SvgImportService | `services/svg-import.service.ts` | SVG file import |
| SymbolLibraryService | `services/symbol-library.service.ts` | Symbol library management |
| ProcessDataService | `services/process-data.service.ts` | Diagram persistence |

### SVG Import

The `SvgImportService` converts SVG graphics to editable primitives:

```typescript
// Usage
const result = svgImportService.importSvg(svgContent, {
  targetPosition: { x: 100, y: 100 },
  idGenerator: () => generateId(),
  namePrefix: 'imported'
});

// Result
interface SvgImportResult {
  primitives: PrimitiveBase[];  // Converted elements
  bounds: { width: number; height: number };
  warnings: string[];  // Unsupported elements
}
```

**Element Mapping:**
| SVG | → Primitive |
|-----|-------------|
| `<rect>` | RectanglePrimitive |
| `<circle>`, `<ellipse>` | EllipsePrimitive |
| `<line>` | LinePrimitive |
| `<polyline>` | PolylinePrimitive |
| `<polygon>` | PolygonPrimitive |
| `<path>` | PathPrimitive |
| `<text>` | TextPrimitive |
| `<image>` | ImagePrimitive |

**Import Methods:**
1. Toolbar "Import SVG" button
2. Drag & Drop SVG files onto canvas
3. Paste SVG content (Ctrl+V)

**Supported Features:**
- Styles: fill, stroke, stroke-width, opacity
- Transforms: translate, rotate, scale, matrix, skewX, skewY
- ViewBox handling
- Nested groups (`<g>`) with transform inheritance

**Not Supported (v1):**
- `<use>` / `<defs>` (symbol references)
- CSS stylesheets (`<style>`)
- Gradients, filters, masks, clip-paths

See `docs/SVG-IMPORT.md` for detailed documentation.

### Primitive Types

```typescript
type PrimitiveType =
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'polyline'
  | 'polygon'
  | 'path'
  | 'text'
  | 'image'
  | 'group';  // Temporary grouping container

interface PrimitiveBase {
  type: PrimitiveType;
  id: string;
  name: string;
  position: Position;
  style?: PrimitiveStyle;
}

interface PrimitiveStyle {
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  opacity?: number;
}
```

### Grouping (Primitives & Symbols)

The Process Designer supports Figma/Illustrator-style temporary grouping of primitives and symbol instances.

**Key Files:**
| File | Description |
|------|-------------|
| `primitives/models/group.model.ts` | GroupPrimitive interface and utilities |
| `designer/services/designer-selection.service.ts` | Group-aware selection logic |
| `designer/process-designer.component.ts` | Group commands and movement/resize |

**Group Data Model:**
```typescript
interface GroupPrimitive extends PrimitiveBase {
  type: 'group';
  config: {
    childIds: string[];           // IDs of children (primitives + symbols)
    originalBounds: BoundingBox;  // For resize calculations
    lockAspectRatio?: boolean;
  };
}
```

**Behavior:**
- Groups are **temporary** (not stored in symbol libraries)
- Children remain in their original arrays (`primitives`, `symbolInstances`)
- Group references children by ID
- Clicking a child selects the parent group
- Must **ungroup** to edit individual children

**Keyboard Shortcuts:**
| Shortcut | Action |
|----------|--------|
| `Ctrl+G` | Group selected items |
| `Ctrl+Shift+G` | Ungroup selected groups |

**Key Methods in ProcessDesignerComponent:**
```typescript
canGroup(): boolean          // >= 2 items selected
canUngroup(): boolean        // Group(s) selected
groupSelected(): void        // Create group from selection
ungroupSelected(): void      // Dissolve groups, select children
```

**Selection Service Group Methods:**
```typescript
findGroupForItem(itemId, diagram): GroupPrimitive | null
getEffectiveSelectionId(itemId, diagram): string  // Returns group ID if item is grouped
expandSelectionWithGroupChildren(diagram): Set<string>  // Expands to include children
hasSelectedGroups(diagram): boolean
getSelectedGroups(diagram): GroupPrimitive[]
```

**Important Implementation Details:**

1. **Mouse Down on Primitive/Symbol:**
   - Check if item is in a group via `findGroupForItem()`
   - If in group, select the group instead
   - Set `isGroup: true` in DragState if the item IS a group OR is in a group

2. **Moving Groups:**
   - `moveGroup()` moves the group AND all children by the same delta
   - Delta is calculated from `newGroupPosition - currentGroupPosition`

3. **Resizing Groups:**
   - Captures all child bounds at resize start
   - Scales children proportionally within new group bounds
   - Different handling per primitive type (rectangle, ellipse, path, text)

4. **Copy/Paste:**
   - `copySelected()` expands selection to include group children
   - Clipboard service remaps `childIds` to new IDs when pasting

5. **Delete:**
   - `deleteSelected()` expands selection to delete group AND all children

6. **Z-Order:**
   - `bringToFront()`/`sendToBack()` move group AND children together

### Symbol Library Page Components

The library provides reusable page components for symbol library management. Apps can import and route to these components.

**Exported Components:**
```typescript
import {
  SymbolLibraryListComponent,    // List of symbol libraries
  SymbolLibraryDetailComponent,  // Symbols in a library
  SymbolEditorPageComponent      // Symbol editor with save/cancel
} from '@meshmakers/octo-process-diagrams';
```

**Route Configuration Example:**
```typescript
export const routes: Routes = [
  {
    path: '',
    component: SymbolLibraryListComponent,
    data: { breadcrumb: [{ label: 'Symbol Libraries', url: 'symbol-library' }] }
  },
  {
    path: ':libraryId',
    component: SymbolLibraryDetailComponent,
    data: { breadcrumb: [..., { label: '{{libraryName}}', url: 'symbol-library/:libraryId' }] }
  },
  {
    path: ':libraryId/:symbolId/edit',
    component: SymbolEditorPageComponent,
    canDeactivate: [UnsavedChangesGuard],
    data: { breadcrumb: [..., { label: '{{symbolName}}' }] }
  }
];
```

**Key Features:**
- Uses relative navigation (`relativeTo: this.route`) for app-agnostic routing
- Updates breadcrumb labels via `BreadCrumbService.updateBreadcrumbLabels()`
- `SymbolEditorPageComponent` implements `HasUnsavedChanges` interface
- Symbol settings panel in dockview (name, canvas size, grid size)

### Primitive Handlers

Each primitive type has a handler in `designer/services/primitive-handlers/` that implements:

```typescript
interface PrimitiveHandler {
  move(primitive: PrimitiveBase, delta: Position): PrimitiveBase;
  getBounds(primitive: PrimitiveBase): PrimitiveBounds;
  resize(primitive: PrimitiveBase, newBounds: PrimitiveBounds): PrimitiveBase;
  scaleInGroup(primitive: PrimitiveBase, params: GroupScaleParams): PrimitiveBase;
}
```

**Important: Position vs Config Coordinates**

Not all primitives use the `position` property for their location:

| Primitive | Location Storage | getBounds() |
|-----------|------------------|-------------|
| Rectangle, Ellipse, Text, Image | `position.x/y` | Uses position |
| Line | `config.start/end` | Min/max of start/end |
| Path | `d` string coordinates | Uses `estimatePathBounds()` to parse d + position |
| Polyline, Polygon | `config.points[]` | Calculates from points + position |

**Critical: Bounds Must Include Position Offset**

All `getBounds()` implementations must include `primitive.position` in the returned bounds. This ensures consistency between:
- Group bounds calculation (used when creating groups)
- Primitive rendering (which applies position)
- Group child rendering (which calculates offsets from group center)

```typescript
// PolylineHandler.getBounds() - CORRECT implementation
getBounds(primitive: PrimitiveBase): PrimitiveBounds {
  // ... calculate minX, minY from points ...
  return {
    x: primitive.position.x + minX,  // Include position offset!
    y: primitive.position.y + minY,
    width: maxX - minX,
    height: maxY - minY
  };
}
```

**Path Bounds Calculation:**
```typescript
// PathHandler.getBounds() uses estimatePathBounds() to parse the d string
// estimatePathBounds() includes primitive.position in the returned bounds
const bounds = estimatePathBounds(primitive as PathPrimitive);
```

**Moving Primitives:**
```typescript
// Use DesignerPrimitiveService.move() which delegates to the correct handler
// For lines: updates config.start and config.end
// For paths: updates position (coordinates are in d string)
// For polylines/polygons: updates config.points directly
// For rectangles: updates position
this.primitiveService.move(primitive, delta);
```

**Rendering Primitives in Preview/Templates**

When rendering primitives outside the main designer (e.g., symbol preview):

| Primitive | Rendering Requirement |
|-----------|----------------------|
| Rectangle, Ellipse | Use `position.x/y` for x/y attributes |
| Path | Apply `transform="translate(position.x, position.y)"` |
| Polyline, Polygon | Add position offset to each point |
| Text | Use `position.x/y` for x/y attributes |

```typescript
// Correct polygon/polyline rendering with position offset
protected getPointsWithOffset(primitive: PrimitiveBase): string {
  const points = config.points;
  const pos = primitive.position;
  return points.map(p => `${p.x + pos.x},${p.y + pos.y}`).join(' ');
}
```

### Alignment Guides

The `DesignerAlignmentGuideService` provides visual alignment guides during drag operations.

**How it works:**
1. Calculates alignment matches between dragged item and other items
2. Detects edge alignment (left, right, top, bottom)
3. Detects center alignment (horizontal and vertical)
4. Returns snap positions and guide lines to render

**Spatial Distance Priority:**
When multiple items align at the same position, the service prefers the **spatially closest** item:
```typescript
// For vertical alignment (X positions), measures Y distance between items
// For horizontal alignment (Y positions), measures X distance between items
const spatialDistance = calculateDistanceBetweenItems(dragged, other);
```

This ensures guide lines connect to the nearest neighbor, not distant elements.

**Usage in Drag:**
```typescript
const guideState = alignmentGuideService.calculateGuides(
  draggedBounds,
  otherBounds,
  canvasBounds
);

// Apply snap
if (guideState.snapX !== null) newPosition.x = guideState.snapX;
if (guideState.snapY !== null) newPosition.y = guideState.snapY;

// Guides are rendered via alignmentGuides() signal
```

### Exposed Properties (Transform Properties)

Symbols can expose properties that can be bound to runtime data. These are defined in the **Exposures** panel.

**Property Types:**
| Type | Description | Example Values |
|------|-------------|----------------|
| `number` | Numeric value | 0-100, temperature, pressure |
| `string` | Text value | Labels, status text |
| `boolean` | True/false | On/off states |

**Property Configuration:**
```typescript
interface TransformProperty {
  id: string;           // Unique identifier
  name: string;         // Display name
  type: 'number' | 'string' | 'boolean';
  defaultValue: number | string | boolean;
  min?: number;         // For number type
  max?: number;         // For number type
}
```

### Data Bindings

Data bindings connect exposed properties to primitive attributes. Configure in the **Exposures** panel by clicking the chain icon on a property.

**Binding Effect Types:**

| Effect Type | Target | Description | Value Range |
|-------------|--------|-------------|-------------|
| `transform.rotation` | Primitive | Rotate element | Degrees (0-360) |
| `transform.offsetX` | Primitive | Horizontal offset | Pixels |
| `transform.offsetY` | Primitive | Vertical offset | Pixels |
| `transform.scale` | Primitive | Uniform scale | Factor (1 = 100%) |
| `transform.scaleX` | Primitive | Horizontal scale | Factor |
| `transform.scaleY` | Primitive | Vertical scale | Factor |
| `style.fill.color` | Primitive | Fill color | Hex color (#RRGGBB) |
| `style.fill.opacity` | Primitive | Fill opacity | 0-1 |
| `style.stroke.color` | Primitive | Stroke color | Hex color |
| `style.stroke.opacity` | Primitive | Stroke opacity | 0-1 |
| `style.opacity` | Primitive | Overall opacity | 0-1 |
| `visible` | Primitive | Show/hide | Boolean |
| `fillLevel` | Rectangle | Tank/battery fill | **0-1 (not 0-100!)** |
| `dimension.width` | Primitive | Element width | Pixels |
| `dimension.height` | Primitive | Element height | Pixels |
| `animation.enabled` | Animation | Enable/disable animation | Boolean |
| `property` | Symbol Instance | Pass value to child symbol | Any |

**Expression Syntax:**

Bindings use the `expr-eval` library for expressions. The `value` variable contains the property value.

```typescript
// Simple pass-through
value

// Math operations
value * 3.6
value + 10

// Comparisons (return boolean)
value > 50
value >= threshold

// Conditional (ternary)
value > 50 ? 1 : 0

// Built-in functions
lerp(value, 0, 100, 0, 360)        // Map 0-100 to 0-360
clamp(value, 0, 100)               // Limit to range
lerpColor(value, 0, 100, "#00ff00", "#ff0000")  // Color gradient
```

**fillLevel Effect (Tank/Battery Visualization):**

The `fillLevel` effect creates a tank-style fill visualization using clip-path.

⚠️ **Important:** `fillLevel` expects values between **0 and 1**, not 0-100!

| fillLevel | Result |
|-----------|--------|
| 0 | Empty (nothing visible) |
| 0.5 | Half full |
| 1 | Full |

**For 0-100 range properties, use this expression:**
```
value / 100
```

Example: Property "Level" (0-100) → fillLevel binding with expression `value / 100`

**animation.enabled Effect:**

Controls whether an animation is active based on a condition.

```typescript
// Enable animation when value exceeds threshold
value > 50

// Enable when boolean property is true
value

// Disable when value is zero
value !== 0
```

**Pass to Child Property (property Effect):**

Passes a value to a nested symbol instance's exposed property.

Use case: A "Dashboard" symbol contains a "Gauge" symbol. The dashboard's "temperature" property can be bound to the gauge's "displayValue" property.

```typescript
// Binding configuration
{
  effectType: 'property',
  targetType: 'symbolInstance',
  targetId: 'gauge-instance-id',
  targetPropertyId: 'displayValue',
  expression: 'value'
}
```

### Simulation Panel

The Simulation panel (in symbol editor) allows testing exposed properties:
- Sliders for numeric properties (respects min/max)
- Checkboxes for boolean properties
- Text inputs for string properties

Changes are applied in real-time to preview bindings and animations.

### Canvas Theming (CSS Variables)

The Process Designer canvas uses CSS custom properties for theming, allowing host applications to customize colors.

**Default CSS Variables (in process-designer.component.scss):**
```scss
:host {
  /* Canvas-specific colors - for SVG canvas fill and grid */
  --designer-canvas-color: #fafafa;  /* Light gray background */
  --designer-grid-color: #e0e0e0;    /* Light gray grid lines */
}
```

**Canvas Elements:**
| Element | CSS Class | CSS Variable |
|---------|-----------|--------------|
| Canvas background | `.canvas-background` | `--designer-canvas-color` |
| Grid lines | `.designer-grid-line` | `--designer-grid-color` |

**How to Override (in host application):**
```scss
// In host app's styles.scss
mm-process-designer,
mm-symbol-editor {
  --designer-canvas-color: #394555;  // Custom background
  --designer-grid-color: rgba(100, 206, 185, 0.15);  // Custom grid
}

// Or with ::ng-deep for component-scoped overrides
::ng-deep {
  mm-process-designer {
    .canvas-background {
      fill: #394555 !important;
    }
    .designer-grid-line {
      stroke: rgba(100, 206, 185, 0.15) !important;
    }
  }
}
```

**Important:** The library uses neutral default colors. Host applications should override these variables to match their theme. Do NOT hardcode theme-specific colors in the library.

### Build Command

```bash
npm run build:octo-process-diagrams
npm run build:octo-meshboard
```

## Locale

German locale (de-DE) is configured:

```typescript
// app.config.ts
import '@progress/kendo-angular-intl/locales/de/all';
registerLocaleData(localeDe, 'de-DE');
{ provide: LOCALE_ID, useValue: "de-DE" }
```

Number formatting:

```typescript
value.toLocaleString('de-AT', {
  minimumFractionDigits: value % 1 !== 0 ? 1 : 0,
  maximumFractionDigits: 2
});
```
