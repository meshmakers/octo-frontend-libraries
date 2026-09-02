# Frontend Libraries - Project Knowledge

## Project Structure

- **Angular 22** with standalone components and signals
- **Kendo UI Angular 24** for UI components (Charts, Gauges, Grid, etc.)
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

## Toolchain Requirements

- **Node.js ≥ 22.22.3** (or ≥ 24.15.0 / ≥ 26.0.0) — required by Angular 22 / Angular CLI 22. The CLI hard-refuses older Node (e.g. Node 20 and Node 24.14.x are rejected). CI (`azure-pipelines.yml`) uses Node 24.15.x.
- **TypeScript ~6.0** — required by Angular 22 (`@angular/compiler-cli` peer is `>=6.0 <6.1`).
- **Build system: `@angular/build` (esbuild/Vite) only** (AB#5050). Every `angular.json` target runs on `@angular/build:*` (`application`, `unit-test`, `ng-packagr`, `dev-server`, `extract-i18n`); the deprecated Webpack toolchain `@angular-devkit/build-angular` is removed. Both demo apps use the `application` builder with `outputPath: { "base": "dist/<app>", "browser": "" }` so the dist layout stays flat — the CI docker context (`Dockerfile.prebuilt` copies `dist/demo-app`) depends on that. The shared `karma.conf.js` is gone — the `karma` builder was replaced by `@angular/build:unit-test` with Vitest (AB#5071). Also removed as deprecated: `@angular/platform-browser-dynamic` (legacy-demo-app bootstraps via `platformBrowser().bootstrapModule`), `@types/expr-eval` (stub — `expr-eval` ships its own typings), `source-map-explorer` (unused). **Deliberately kept although deprecated:** `@angular/animations` — every Kendo 24 package peer-requires it (`"19 - 22"`), and `octo-ui` mirrors that peer; drop it only when Kendo does.
- **`@progress/kendo-theme-material` / `@progress/kendo-theme-default` use `^14.2.0`.** Version `14.2.0` removed the standalone `scss/adaptive/` module (its rendering was folded into the component modules). `octo-ui`'s slim theme `projects/meshmakers/octo-ui/src/lib/runtime-browser/styles/_kendo-theme.scss` used to `@use` `@progress/kendo-theme-material/scss/adaptive/_index.scss` without a matching `@include kendo-adaptive--styles()` — dead code that broke the SCSS build on 14.2.0 (`Can't find stylesheet to import`). That import was removed (AB#4253), so the theme now builds on both 14.1.x and 14.2.x. When adding a new Kendo module to the slim theme, `@use` its `_index.scss` **and** call its `@include kendo-<module>--styles()` — an import without the include emits nothing and silently couples to a removable module.

## Angular 22 Notes

- **Change detection default flipped to OnPush.** In Angular 22 a component with an undefined `changeDetection` defaults to `OnPush` (was `CheckAlways`). The `ng update` `change-detection-eager` migration explicitly set every existing component to `ChangeDetectionStrategy.Eager` (the new name for the old `CheckAlways`/`Default`) to preserve behavior. New components default to `OnPush` — set `ChangeDetectionStrategy.Eager` if you need the old always-check behavior. The opinionated `@angular-eslint/prefer-on-push-component-change-detection` rule (new in angular-eslint 22's recommended set) is turned **off** in `eslint.config.js` because it conflicts with the Eager strategy left by the migration.
- **`CanMatchFn` third argument is now mandatory.** Guards/specs calling a `CanMatch` function must pass `currentSnapshot` (an `ActivatedRouteSnapshot`).
- **`katex` + `marked-katex-extension` are devDependencies.** ngx-markdown 22 has a dynamic `import('marked-katex-extension')` that the Vitest test build resolves at bundle time (originally observed on the webpack builder; unchanged through the esbuild karma builder and the move to `@angular/build:unit-test`), so these optional peers must be installed for tests to build, even though the Markdown widget does not use KaTeX.

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
npm run test:octo-meshboard
```

The full command reference is in [Testing (Vitest)](#testing-vitest) below.

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
# Run all tests (chains the 10 per-project scripts)
npm test

# Run tests for a specific library
npm run test:octo-meshboard
npm run test:shared-auth

# Run a single spec (path relative to the workspace root)
ng test @meshmakers/shared-auth --watch=false --include=projects/meshmakers/shared-auth/src/lib/authorize.service.spec.ts

# Debug a run in the Node Inspector
ng test @meshmakers/shared-auth --debug

# Coverage for one project (@vitest/coverage-v8 is a devDependency)
ng test @meshmakers/shared-auth --watch=false --coverage
```

`npm test -- <flag>` appends the flag to the **last** chained script only, so never pass
per-project flags to `npm test`. Use `npm run test:<lib> -- <flag>` or `ng test <project>`.

## Testing (Vitest)

Karma and Jasmine were replaced by Vitest in AB#5071. Runner: **`@angular/build:unit-test`
with `runner: "vitest"` on jsdom** — no browser, no `CHROME_BIN`, no `karma.conf.js`.
10 `test` targets (the two legacy libraries have no specs), covering every spec file in the
workspace.

### How a test target is wired

- Every **library** has a `test-build` target (`@angular/build:application`, `aot: false`)
  that exists only to carry the `zone.js` / `zone.js/testing` polyfills — `setupFiles`,
  `providersFile` and `runnerConfig` all run after `@angular/core/testing` captured `Zone`,
  so zone.js has to come from the build. **Never build `test-build` yourself**; the `test`
  target references it via `buildTarget`. The two demo apps use a `testing` configuration on
  their `build` target instead (`demo-app:build:testing`).
- `@angular/localize/init` is a **polyfill** of the `test-build` / `build:testing` target
  (shared-services, shared-auth, shared-ui, octo-ui, demo-app). Never import it in a spec:
  each spec file is its own module graph, so a per-spec import only covers that one file.
- The shared setup file `testing/vitest-setup.ts` must be listed in each target's
  `setupFiles` **and** in that project's `tsconfig.spec.json` `include`.
- Specs in **secondary entry points** live outside `sourceRoot` and are invisible unless the
  target lists them in `include`: octo-ui uses `["**/*.spec.ts", "../**/*.spec.ts"]`
  (branding, branding-settings, tree-navigation-settings), shared-auth uses
  `["**/*.spec.ts", "../login-ui/**/*.spec.ts"]`.
- A project **without specs must not have a `test` target** at all.
- The builder schema is closed (`additionalProperties: false`). `polyfills`, `styles`,
  `assets`, `karmaConfig` and `codeCoverage` on a `test` target are hard errors.
- `--include` patterns resolve against the project's `sourceRoot`; a full
  workspace-root-relative path (`projects/…/x.spec.ts`) or a `**/x.spec.ts` glob both match.
  A project-root-relative path (`src/lib/…`) does **not**.

### `testing/vitest-setup.ts`

- Loads `zone.js/plugins/vitest-patch`, which wraps `describe`/`it`/`beforeEach`/`afterEach`
  in a ProxyZone — this is what keeps `fakeAsync` / `tick` / `flush` / `waitForAsync` working.
- Runs `vi.restoreAllMocks()` in a global `afterEach`. Jasmine restored every `spyOn` spy
  after each spec and Vitest does not, so this hook restores Jasmine parity. Note that
  `vi.spyOn` on an already-spied member returns the **same** mock, so re-spying inside a test
  does not stack.
- Shims the jsdom gaps: `navigator.clipboard`, a `window.fetch` / `Response` / `Request` /
  `Headers` bridge, `URL.createObjectURL` / `revokeObjectURL`, `ResizeObserver`, and
  `HTMLElement.innerText` (jsdom implements none; Kendo's SplitButton reads it in `ngDoCheck`).
- jsdom also has **no `DOMMatrix` / `DOMPoint` and no `matchMedia`** — stub those in the spec
  that needs them.

### Vite/esbuild class-field snapshot (production-code constraint)

Under the Vitest runner a class field initialised with a **bare imported identifier** stays
`undefined` when its module lands in a lazily initialised shared esbuild chunk, i.e. as soon
as two or more spec entry points import that module:

```ts
readonly PropertyDisplayMode = PropertyDisplayMode;   // breaks under Vitest
@Input() config = DEFAULT_CONFIG;                     // breaks under Vitest
```

Vite's module-runner transform hoists a `const` snapshot of the import to module top, taken
before esbuild's `__esm(...)` wrapper for the shared chunk has run. Use a getter, or assign in
the constructor where Angular has to be able to set the field:

```ts
get PropertyDisplayMode(): typeof PropertyDisplayMode { return PropertyDisplayMode; }
@Input() config: MappingCoverageTreeConfig;
constructor() { this.config = DEFAULT_MAPPING_COVERAGE_TREE_CONFIG; }
```

A namespace-qualified initialiser does **not** help (esbuild folds it back to the bare
identifier); only forms that put the identifier inside a function body survive bundling.
Production and `ng-packagr` builds do not use the module runner, so shipped libraries are
unaffected — this is a test-runner-only defect. Symptom: a spec passes alone and fails as soon
as a second spec importing the same module joins the run, and `--isolate` does not help.
Fields initialised from **node_modules** imports (Kendo SVG icons) are fine.

Known **latent** sites (green today only because their modules are not in a lazy shared chunk):

| file | field |
|---|---|
| `shared-ui/src/lib/cron-builder/cron-builder.component.ts` | 6 fields from `./cron-builder.models` |
| `shared-ui/src/lib/import-strategy-dialog/import-strategy-dialog.component.ts` | `ImportStrategyDto` |
| `shared-ui/src/lib/upload-file-dialog/upload-file-dialog.component.ts` | `upload`, `deleteIcon` from `../svg-icons` |
| `octo-meshboard/src/lib/dialogs/meshboard-settings-dialog/meshboard-settings-dialog.component.ts` | `timeZoneMode` |
| `octo-ui-legacy/src/lib/table/mm-octo-table.component.ts` | `getDisplayName`, `getDataKey` (project has no specs) |

### Matcher and mock semantics the schematic does not translate

- Jasmine's `toContain` is deep equality; Vitest's is identity. Use `toContainEqual` for
  object or array members.
- Jasmine's `toBe` is `===`; Vitest's is `Object.is`. `-0` vs `+0` now differ — use
  `toSatisfy((v) => v === 0)`. `toBe(NaN)` would silently start passing.
- `toBeRejectedWithError('msg')` became a **substring** match — use an anchored regex
  (`/^Network error$/`). Do not use `toThrowError(new Error('msg'))`; it is stricter than
  Jasmine and breaks on Error subclasses. `expect(p).resolves.not.toThrow()` is the intended
  rendering of Jasmine's `toBeResolved()`.
- Vitest has no `toBeTrue()` / `toBeFalse()` — use `toBe(true)` / `toBe(false)`.
- A bare `vi.spyOn` **calls through** where Jasmine's `spyOn` stubbed. Always configure a
  return value (`.mockReturnValue(...)`, `.mockResolvedValue(...)`).
- `jasmine.SpyObj<T>` becomes `MockedObject<T>`, which requires every member of `T` including
  private ones. Assign the object literal with a cast:
  `x = { m: vi.fn() } as unknown as MockedObject<T>;` — never try to add the missing members.
- `jasmine.objectContaining` becomes `expect.objectContaining`.
- `vi.mock` with relative paths is blocked by the builder. Inject a fake through TestBed instead.
- Done-callback tests are written as explicit Promises so Vitest waits for `done()`:
  `it('x', () => new Promise<void>((done) => { … }))`. The conversion is scripted in
  `scripts/codemod-done-to-promise.mjs` (plain `node`, no package.json entry).
- An `expect` that throws inside an RxJS `subscribe` callback does **not** reject the wrapped
  Promise: rxjs routes it to `reportUnhandledError`, so Vitest prints an `Unhandled Errors`
  banner and exits 1 while the JUnit file still looks clean. **The exit code is the primary
  gate**, not the XML.

### CI

The pipeline runs the eight library projects in three rounds of up to three, with
`VITEST_MAX_WORKERS=2` (the only worker cap the builder exposes — there is no `pool` or
`maxWorkers` option) and `NODE_OPTIONS=--max-old-space-size=6144`, and adds the JUnit
reporter per project:

```bash
npm run test:<lib> -- --reporters=default --reporters=junit --output-file="test-results/<lib>/TESTS-junit.xml"
```

Repeat the `--reporters` flag — the builder does **no** comma splitting, and `progress` is not
a Vitest reporter (valid: `default, verbose, dots, json, junit, tap, tap-flat, html`). The
file name `TESTS-junit.xml` under `test-results/<project>/` is what the `PublishTestResults@2`
glob `**/TESTS-*.xml` matches.

If jsdom ever proves insufficient for one project, the escape hatch is browser mode:
`"browsers": ["chromium"]` on that project's `test` target plus `@vitest/browser-playwright`
and `playwright`. Do not install `happy-dom` (it silently wins over jsdom) or `@vitest/browser`.

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

### 1. Keep package.json and package-lock.json in sync (if dependencies changed)

CI runs `npm ci`, which fails when `package.json` and `package-lock.json` disagree. Change
dependencies with **targeted** commands — both files stay in sync automatically:

```bash
# In frontend-libraries directory
npm install <pkg>
npm uninstall <pkg>
```

Do **not** `rm -f package-lock.json && npm install` while the `@angular/*` patch level is
aligned with Refinery Studio — a full regeneration floats every transitive dependency and
silently breaks that alignment. A full lockfile refresh is a separate, deliberately reviewed
dependency-refresh commit, never a side effect of a feature branch.

### 2. Run Linter

```bash
npm run lint
```

### 3. Run Tests

```bash
npm test
```

### 4. Verify Build

```bash
npm run build:prod
```

### Quick Pre-Commit Script

```bash
# Run all checks before committing
npm run lint && npm test && npm run build:prod
```

## Remaining deprecations

Known deprecation warnings that are **deliberately not fixed here** (AB#5071). Do not "clean
them up" without checking the reason first.

- **`@angular/animations`** — every Kendo package peer-requires it (Kendo 24: `"19 - 22"`,
  Kendo 25: `"20 - 22"`), and `octo-ui` mirrors that peer. Drop it only when Kendo does.
- **`node-domexception`** — a transitive devDependency, reachable only through
  `@graphql-codegen/cli` → `@graphql-tools/apollo-engine-loader` → `sync-fetch 0.6.0` →
  `node-fetch@3` → `fetch-blob`. Nothing to do locally; it clears when upstream updates.
- **`@angular/build:unit-test` is labelled `[EXPERIMENTAL]` in 22.0.x**
  (`node_modules/@angular/build/builders.json`). Its option schema is closed, so a new option
  name or a renamed one breaks `angular.json` outright — bump `@angular/build` deliberately
  and re-run the full suite afterwards.
- **npm `allowScripts` is advisory in npm 11.16** and undocumented in `npm help package-json`.
  The format is a flat object mapping a package spec to a boolean, with **name-only** keys
  (`"esbuild": true`), and `package.json` carries the six entries this workspace needs.
- **`npm approve-scripts` requires an installed `node_modules`.** Without one it is a silent
  no-op, so run it after `npm install`, never on a clean checkout.

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
