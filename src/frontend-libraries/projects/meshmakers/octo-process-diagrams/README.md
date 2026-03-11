# @meshmakers/octo-process-diagrams

Angular library for process diagram design and symbol editing in OctoMesh Platform applications.

**Note:** This library requires a [Kendo UI for Angular](https://www.telerik.com/kendo-angular-ui) license.

Part of the [@meshmakers](https://www.npmjs.com/org/meshmakers) package ecosystem.

## Features

- **Process Designer** — Visual SVG-based editor for process diagrams (HMI)
- **Symbol Editor** — Create and manage reusable symbol definitions
- **Symbol Library** — Organize symbols in libraries with versioning
- **Primitive System** — Rectangle, Ellipse, Line, Polyline, Polygon, Path, Text, Image
- **SVG Import** — Import SVG files via toolbar button, drag & drop, or clipboard paste
- **Dockview Layout** — Flexible, rearrangeable panel system
- **Animations** — SVG animations with data binding support
- **Exposed Properties** — Bind symbol properties to runtime data (number, string, boolean)
- **Expression Evaluation** — `expr-eval` based expressions for data bindings
- **Grouping** — Figma/Illustrator-style temporary grouping of primitives and symbols
- **Undo/Redo** — Full history with keyboard shortcuts

## Installation

```bash
npm install @meshmakers/octo-process-diagrams
```

## Build

```bash
# From frontend-libraries root
npm run build:octo-process-diagrams
```

## Architecture

```
octo-process-diagrams/
├── src/
│   ├── public-api.ts                    # Public API exports
│   └── lib/
│       ├── process-widget.models.ts     # Core data models
│       ├── primitives/
│       │   ├── models/                  # Primitive data models
│       │   │   ├── primitive.models.ts  # Base interfaces (PrimitiveBase, PrimitiveStyle)
│       │   │   ├── rectangle.model.ts
│       │   │   ├── ellipse.model.ts
│       │   │   ├── line.model.ts
│       │   │   ├── polygon.model.ts
│       │   │   ├── path.model.ts
│       │   │   ├── text.model.ts
│       │   │   ├── image.model.ts
│       │   │   ├── group.model.ts
│       │   │   ├── symbol.model.ts
│       │   │   ├── animation.models.ts
│       │   │   ├── transform-property.models.ts
│       │   │   └── style-class.model.ts
│       │   ├── renderers/               # SVG rendering per type
│       │   │   ├── primitive-renderer.interface.ts
│       │   │   ├── rectangle.renderer.ts
│       │   │   ├── ellipse.renderer.ts
│       │   │   ├── line.renderer.ts
│       │   │   ├── polygon.renderer.ts
│       │   │   ├── path.renderer.ts
│       │   │   ├── text.renderer.ts
│       │   │   ├── image.renderer.ts
│       │   │   ├── symbol.renderer.ts
│       │   │   └── animation.renderer.ts
│       │   └── primitive-renderer.registry.ts
│       ├── designer/
│       │   ├── process-designer.component.ts   # Main editor component
│       │   ├── process-designer.component.html
│       │   ├── process-designer.component.scss
│       │   ├── element-palette.component.ts    # Draggable element palette
│       │   ├── property-inspector.component.ts # Properties panel
│       │   ├── symbol-library-panel.component.ts
│       │   ├── context-menu.component.ts
│       │   ├── path-editor.component.ts
│       │   ├── animation-editor.component.ts
│       │   ├── simulation-panel.component.ts
│       │   ├── transform-property-editor.component.ts
│       │   ├── binding-editor-dialog.component.ts
│       │   ├── dockview/                       # Flexible layout system
│       │   │   └── dockview.component.ts
│       │   ├── panels/                         # Dockview panel wrappers
│       │   │   ├── elements-panel.component.ts
│       │   │   ├── symbols-panel.component.ts
│       │   │   ├── properties-panel.component.ts
│       │   │   ├── transform-panel.component.ts
│       │   │   ├── animations-panel.component.ts
│       │   │   ├── simulation-panel.component.ts
│       │   │   └── settings-panel.component.ts
│       │   └── services/                       # Designer services
│       │       ├── designer-state.service.ts
│       │       ├── designer-selection.service.ts
│       │       ├── designer-clipboard.service.ts
│       │       ├── designer-history.service.ts
│       │       ├── designer-creation.service.ts
│       │       ├── designer-keyboard.service.ts
│       │       ├── designer-rendering.service.ts
│       │       ├── designer-primitive.service.ts
│       │       ├── designer-bounds.service.ts
│       │       ├── designer-alignment.service.ts
│       │       ├── designer-alignment-guide.service.ts
│       │       ├── designer-coordinate.service.ts
│       │       ├── designer-drag.service.ts
│       │       ├── designer-resize.service.ts
│       │       ├── designer-grouping.service.ts
│       │       ├── designer-deletion.service.ts
│       │       ├── designer-zorder.service.ts
│       │       ├── designer-diagram.service.ts
│       │       ├── designer-context-menu.service.ts
│       │       ├── designer-layout.service.ts
│       │       ├── geometry-util.service.ts
│       │       ├── path-editor.service.ts
│       │       └── primitive-handlers/         # Per-type move/resize/bounds
│       │           ├── primitive-handler.interface.ts
│       │           ├── rectangle.handler.ts
│       │           ├── ellipse.handler.ts
│       │           ├── line.handler.ts
│       │           ├── polyline.handler.ts
│       │           ├── path.handler.ts
│       │           ├── text.handler.ts
│       │           └── default.handler.ts
│       ├── admin/
│       │   ├── symbol-library-admin.component.ts  # Symbol library management
│       │   └── symbol-editor.component.ts         # Symbol editor
│       ├── pages/                                 # Routable page components
│       │   ├── symbol-library-list/
│       │   ├── symbol-library-detail/
│       │   ├── symbol-editor-page/
│       │   ├── process-diagram-list/
│       │   └── data-sources/                      # List view data source directives
│       ├── services/
│       │   ├── svg-import.service.ts              # SVG file import
│       │   ├── symbol-library.service.ts          # Symbol library CRUD
│       │   ├── process-diagram-data.service.ts    # Diagram persistence
│       │   └── expression-evaluator.service.ts    # Expression evaluation for bindings
│       ├── graphQL/                               # Auto-generated GraphQL services
│       ├── styles/
│       │   └── _dockview-lcars-theme.scss         # Optional LCARS theme mixin
│       └── docs/
│           └── SVG-IMPORT.md                      # SVG import documentation
```

## Key Exports

### Components

| Component | Description |
|-----------|-------------|
| `ProcessDesignerComponent` | Main visual editor for process diagrams |
| `ElementPaletteComponent` | Draggable palette of primitive shapes |
| `PropertyInspectorComponent` | Properties panel for selected items |
| `SymbolLibraryPanelComponent` | Symbol library browser panel |
| `SymbolLibraryAdminComponent` | Symbol library management UI |
| `SymbolEditorComponent` | Symbol definition editor |
| `DockviewComponent` | Flexible panel layout system |
| `PathEditorComponent` | SVG path editing |
| `TransformPropertyEditorComponent` | Transform property editing |
| `BindingEditorDialogComponent` | Data binding configuration dialog |
| `SimulationPanelComponent` | Simulation value testing |

### Page Components (for routing in consuming apps)

| Component | Description |
|-----------|-------------|
| `SymbolLibraryListComponent` | List of symbol libraries |
| `SymbolLibraryDetailComponent` | Symbols within a library |
| `SymbolEditorPageComponent` | Symbol editor with save/cancel |
| `ProcessDiagramListComponent` | List of process diagrams |

### Services

| Service | Description |
|---------|-------------|
| `SymbolLibraryService` | Symbol library CRUD operations |
| `SvgImportService` | SVG file import and conversion |
| `ProcessDiagramDataService` | Diagram persistence |
| `ExpressionEvaluatorService` | Expression evaluation for data bindings |
| `DesignerLayoutService` | Dockview layout persistence |
| `DesignerSelectionService` | Selection state management |
| `DesignerHistoryService` | Undo/Redo functionality |
| `DesignerClipboardService` | Copy/Paste operations |
| `PathEditorService` | Path command parsing and manipulation |

## Styling

This library uses **neutral default colors** via CSS custom properties. Host applications should override these variables to match their theme.

### Canvas CSS Variables

```scss
mm-process-designer,
mm-symbol-editor {
  --designer-canvas-color: #fafafa;   // Canvas background
  --designer-grid-color: #e0e0e0;     // Grid lines
}
```

### Dockview CSS Variables

```scss
mm-process-designer,
mm-symbol-editor {
  --dv-background-color: <your-bg>;
  --dv-pane-background-color: <your-pane>;
  --dv-activegroup-visiblepanel-tab-background-color: <your-active-tab>;
  --dv-activegroup-visiblepanel-tab-color: <your-accent>;
  // ... see PROCESS-DESIGNER.md for full list
}
```

An optional LCARS theme mixin is available:

```scss
@use '@meshmakers/octo-process-diagrams/styles/dockview-lcars-theme' as dockview;
@include dockview.lcars-theme();
```

## Dependencies

- **Angular 21** with standalone components and signals
- **Kendo UI Angular 21** (Buttons, Inputs, Dropdowns, Dialogs, ListView)
- **Apollo Angular** for GraphQL
- **dockview-angular** for flexible panel layout
- **expr-eval** for expression evaluation

## Detailed Documentation

- [Process Designer Developer Documentation](src/lib/PROCESS-DESIGNER.md) — Full architecture, services, primitives, dockview, checklists
- [SVG Import Documentation](src/lib/docs/SVG-IMPORT.md) — SVG import service, element mapping, transforms

## Documentation and Testing Standards

- **All developer documentation must be written in English**
- **Every code change must include updated documentation** — update README.md, CLAUDE.md, or inline docs when adding, modifying, or removing features
- **Unit tests and integration tests must be executed** after every code change
- **Existing tests must be updated** when the behavior of tested code changes
- **New tests must be added** when new features, components, or services are implemented
- Never commit code with failing tests
