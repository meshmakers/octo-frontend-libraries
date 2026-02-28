# @meshmakers/octo-process-diagrams - CLAUDE.md

## Build Commands

```bash
# From frontend-libraries root
npm run build:octo-process-diagrams

# Lint
npm run lint:octo-process-diagrams

# Run tests
npm test -- --project=@meshmakers/octo-process-diagrams --watch=false
```

## Documentation and Testing Standards

- **All developer documentation must be written in English**
- **Every code change must include updated documentation** — update README.md, CLAUDE.md, or inline docs when adding, modifying, or removing features
- **Unit tests and integration tests must be executed** after every code change
- **Existing tests must be updated** when the behavior of tested code changes
- **New tests must be added** when new features, components, or services are implemented
- Never commit code with failing tests

## Architecture Overview

The library provides a visual SVG-based process diagram editor with these main subsystems:

### Primitives System (`primitives/`)
- **Models** — Data interfaces per type (Rectangle, Ellipse, Line, Polyline, Polygon, Path, Text, Image, Group)
- **Renderers** — SVG rendering per type, registered in `PrimitiveRendererRegistry`
- **Handlers** — Per-type move, resize, bounds calculation in `designer/services/primitive-handlers/`

### Designer (`designer/`)
- **ProcessDesignerComponent** — Main editor with SVG canvas, toolbar, drag/drop, resize, keyboard shortcuts
- **Panels** — Dockview panel wrappers (Elements, Symbols, Properties, Transform, Animations, Simulation, Settings)
- **Services** — Selection, History, Clipboard, Creation, Keyboard, Rendering, Drag, Resize, Bounds, Alignment, Z-Order, Grouping, Deletion, Layout, Coordinate, State, Diagram, Context Menu

### Admin (`admin/`)
- **SymbolLibraryAdminComponent** — Symbol library management with list and detail views
- **SymbolEditorComponent** — Symbol definition editor

### Pages (`pages/`)
- **SymbolLibraryListComponent** — Routable list of symbol libraries
- **SymbolLibraryDetailComponent** — Routable symbols within a library
- **SymbolEditorPageComponent** — Routable symbol editor with save/cancel and unsaved changes guard
- **ProcessDiagramListComponent** — Routable list of process diagrams
- **Data Sources** — `SymbolLibraryDataSourceDirective`, `ProcessDiagramDataSourceDirective`

### Services (`services/`)
- **SvgImportService** — SVG file import (toolbar, drag & drop, clipboard paste)
- **SymbolLibraryService** — Symbol library CRUD via GraphQL
- **ProcessDiagramDataService** — Diagram persistence via GraphQL
- **ExpressionEvaluatorService** — `expr-eval` based expression evaluation for data bindings

## Key Development Patterns

### Position Semantics per Primitive Type

| Primitive | Position Meaning |
|-----------|-----------------|
| Rectangle, Image | Top-left corner |
| Ellipse | Center point (cx, cy) |
| Line | Offset, actual points in `config.start/end` |
| Polyline, Polygon | Offset, actual points in `config.points[]` |
| Path | Transform origin, coordinates in `d` string |
| Text | Anchor point |

### Primitive Handlers

Each primitive type has a handler implementing `PrimitiveHandler` with `move()`, `getBounds()`, `resize()`, `scaleInGroup()`. All `getBounds()` implementations must include `primitive.position` in the returned bounds.

### Styling Requirements

**All components must use neutral, theme-agnostic default colors.** Use CSS custom properties so host applications can override.

Key CSS variables:
- `--designer-canvas-color` — Canvas background (default: `#fafafa`)
- `--designer-grid-color` — Grid lines (default: `#e0e0e0`)
- Dockview variables: `--dv-background-color`, `--dv-pane-background-color`, etc.

### Dockview Integration

Set `[useDockview]="true"` on `ProcessDesignerComponent` or `SymbolEditorComponent`. Layout is saved/restored via `DesignerLayoutService` in localStorage.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| V | Select mode |
| H | Pan mode |
| Delete/Backspace | Delete |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+A | Select all |
| Ctrl+S | Save |
| Ctrl+C/V | Copy/Paste |
| Ctrl+G | Group |
| Ctrl+Shift+G | Ungroup |
| Alt+1-6 | Toggle panels |

## Detailed Documentation

- [PROCESS-DESIGNER.md](src/lib/PROCESS-DESIGNER.md) — Full architecture, services, checklists
- [SVG-IMPORT.md](src/lib/docs/SVG-IMPORT.md) — SVG import details
