# octo-meshboard Library Guidelines

## Overview

The `@meshmakers/octo-meshboard` library provides a configurable dashboard (MeshBoard) system for OctoMesh applications. It includes widget components, state management, grid layout, variable system, and persistence services. The library requires the `System.UI` Construction Kit model (>= 1.0.1) to be installed in the tenant.

## Build Commands

```bash
# From frontend-libraries directory
npm run build:octo-meshboard

# Run tests
npm run test:octo-meshboard

# Run lint
npm run lint:octo-meshboard
```

## Documentation and Testing Standards

- **All developer documentation must be written in English**
- **Every code change must include updated documentation** — update README.md, CLAUDE.md, or inline docs when adding, modifying, or removing features
- **Unit tests and integration tests must be executed** after every code change
- **Existing tests must be updated** when the behavior of tested code changes
- **New tests must be added** when new features, components, or services are implemented
- Never commit code with failing tests

## Project Structure

```
src/lib/
├── components/               # Shared components (VariablesEditor, EntitySelectorEditor, EntitySelectorToolbar, FormulaField)
├── containers/               # Main container components
│   └── meshboard-view/       # MeshBoard view component
├── dialogs/                  # Dialog components
│   ├── add-widget-dialog/    # Add widget selection
│   ├── edit-widget-dialog/   # Edit widget properties
│   ├── meshboard-manager-dialog/   # MeshBoard selection/management
│   └── meshboard-settings-dialog/  # MeshBoard settings
├── graphQL/                  # GraphQL queries and mutations
├── models/                   # TypeScript interfaces
├── services/                 # Angular services
├── utils/                    # Pure utility functions
└── widgets/                  # Widget components
    ├── bar-chart-widget/
    ├── entity-associations-widget/
    ├── entity-card-widget/
    ├── gauge-widget/
    ├── kpi-widget/
    ├── markdown-widget/      # Static markdown content display
    ├── pie-chart-widget/
    ├── process-widget/       # Process designer (see parent CLAUDE.md)
    ├── service-health-widget/
    ├── status-indicator-widget/
    └── table-widget/
```

---

## Compact Layout (responsive tiers, AB#4353)

The Kendo TileLayout renders its configured column count at any container width — on a
390px phone a 6-column board yields ~42px columns. `MeshBoardViewComponent` therefore
applies a **presentation-side** remap driven by its own width (ResizeObserver):

| Container width | Tier | Rendering |
|---|---|---|
| ≥ 1100px | `none` | Configured columns, persisted col/row anchors, editing enabled |
| 700–1099px | `tablet` | `min(columns, 3)` columns, anchors dropped (CSS grid auto-flow `row` in reading order), colSpan scaled proportionally (`scaleColSpan`: span 2 of 6 → 1 of 3, min 1), so a KPI row stays side by side; widgets starting in one row that would no longer fit share the columns by largest remainder (3 + 3 of 6 → 2 + 1 of 3) |
| < 700px | `phone` | Single column, widgets stacked in reading order (sorted by row, then col); content-sized widgets grow their tile (below) |

**Content-sized tiles on the phone tier (AB#5558).** Rows have a fixed height, so a list whose
items stack on a phone (the cockpit "Needs attention" cards) was clipped. Content-sized widgets
(`attentionList`, `recentItems`, via `cockpit/widgets/content-height.ts`
`reportCockpitContentHeight`) report the natural height of an unconstrained content wrapper
(`MeshBoardStateService.setWidgetContentHeight`, cleared on board switch); on the phone tier
`placeWidgetsForTier(…, contentSizing)` raises their `rowSpan` to
`rowSpanForContent(height, rowHeight, gap, rowSpan)` (content + `TILE_CHROME_HEIGHT` 64 px, at most
`MAX_CONTENT_ROWS` 8 — beyond that the widget scrolls). Other tiers keep the configured spans.
Measure only content whose height does not depend on the tile height, or the tile grows forever.

The persisted board config is **never modified** — the remap lives in
`utils/compact-layout.ts` (`compactTierForWidth` / `columnsForTier` / `placeWidgetsForTier`,
pure and unit-tested) and feeds the `displayColumns` / `displayGridWidgets` computed signals.
Edit mode (drag/resize/reorder) is only offered in the `none` tier (`canEditLayout`), because
dragging against remapped positions would corrupt the stored anchors.

---

## Core Services

### MeshBoardStateService

Central state management service using Angular signals.

```typescript
import { MeshBoardStateService } from '@meshmakers/octo-meshboard';

@Component({...})
export class MyComponent {
  private readonly stateService = inject(MeshBoardStateService);

  // Reactive signals
  readonly config = this.stateService.meshBoardConfig;
  readonly widgets = this.stateService.widgets;
  readonly isLoading = this.stateService.isLoading;
  readonly isModelAvailable = this.stateService.isModelAvailable;

  async ngOnInit() {
    // Load initial MeshBoard from backend
    await this.stateService.loadInitialMeshBoard();
  }
}
```

**Public Signals:**

| Signal | Type | Description |
|--------|------|-------------|
| `meshBoardConfig` | `Signal<MeshBoardConfig>` | Current MeshBoard configuration |
| `widgets` | `Signal<AnyWidgetConfig[]>` | Widget configurations |
| `persistedMeshBoardId` | `Signal<string \| null>` | ID of loaded MeshBoard |
| `availableMeshBoards` | `Signal<PersistedMeshBoard[]>` | Available MeshBoards |
| `isLoading` | `Signal<boolean>` | Loading state |
| `isModelAvailable` | `Signal<boolean \| null>` | System.UI model availability |

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `loadInitialMeshBoard()` | `Promise<AnyWidgetConfig[]>` | Load first available MeshBoard |
| `switchToMeshBoard(rtId)` | `Promise<AnyWidgetConfig[]>` | Switch to specific MeshBoard |
| `createNewMeshBoard(name, description?)` | `Promise<string>` | Create new MeshBoard |
| `deleteMeshBoard(rtId)` | `Promise<void>` | Delete MeshBoard |
| `addWidget(widget)` | `void` | Add widget to current MeshBoard |
| `updateWidget(id, changes)` | `void` | Update widget configuration |
| `removeWidget(id)` | `void` | Remove widget |
| `getVariables()` | `MeshBoardVariable[]` | Get all variables: config variables plus runtime widget variables (config wins on a name clash) |
| `setVariableValue(name, value)` | `void` | Set variable value (config variables only) |
| `setWidgetVariable(widgetId, name, value)` | `void` | Publish a widget's value as runtime variable (source `widget`, not persisted; no-op when unchanged) |
| `clearWidgetVariable(widgetId)` | `void` | Remove the runtime variable published by a widget |
| `getEntitySelectors()` | `EntitySelectorConfig[]` | Get configured entity selectors |
| `getEntitySelector(selectorId)` | `EntitySelectorConfig \| undefined` | Get specific selector |
| `updateEntitySelectorSelection(selectorId, rtId, displayName?)` | `void` | Update selector selection |
| `setEntitySelectorVariables(selectorId, values[])` | `void` | Set variables from entity selection |
| `clearEntitySelectorVariables(selectorId)` | `void` | Clear variables for a selector |
| `resolveCurrentTimeRange()` | `TimeRange \| null` | Resolve active time filter to `{from, to}` |
| `resolveStreamDataTimeArgs(ignoreTimeFilter?)` | `{from, to} \| undefined` | Bind time filter to SD `streamDataArgs`; `undefined` when no filter or opted out |
| `setHostTimeRange(state \| null, owner?)` / `clearHostTimeRange(owner)` / `hostTimeRange` | `void` / `void` / `Signal<HostTimeRangeState \| null>` | Period of the embedding host (`mm-meshboard-view [timeRange]`, AB#7582): transient, never persisted, owner-aware clearing (root service shared by views); while set and the filter is enabled `resolveCurrentTimeRange()` returns its exact instants |
| `isStreamDataBlockedByHostTimeRange(ignoreTimeFilter?)` | `boolean` | True while an invalid host period blocks a stream-data query bound to the time filter (AB#7582); `resolveStreamDataScope(id, family, ignoreTimeFilter)` then returns `empty`/`invalidTimeRange`; the process binding and the widget-group repeater check it directly |
| `setEntitySelectorScopePending(selectorId)` | `void` | Mark a selector's scope as resolving (AB#7721) |
| `setEntitySelectorRtIds(selectorId, rtIds)` | `void` | Store the resolved source rtIds (transient); `[]` = resolved EMPTY scope |
| `setEntitySelectorScopeFailed(selectorId)` | `void` | Mark a selector's scope resolution as failed (AB#7721) |
| `clearEntitySelectorRtIds(selectorId)` | `void` | Clear the scope state (no pick → persisted scope) |
| `resolveStreamDataScope(entitySelectorId?, family?, ignoreTimeFilter?)` | `StreamDataScope` | Widget entry point: AB#7582 host gate first (stream data only, `empty`/`invalidTimeRange`; pass the widget's `ignoreTimeFilter`), then `resolveEntitySelectorScope` — see *Scope resolution contract* |
| `resolveEntitySelectorScope(entitySelectorId?)` | `StreamDataScope` | Selector part only: `unscoped` / `pending` / `scoped` / `empty` for runtime and stream-data queries alike (AB#7721, AB#7725) |
| `resolveStreamDataRtIds(entitySelectorId?)` | `string[] \| undefined` | Source rtIds of a `scoped` scope, else `undefined` — check `resolveStreamDataScope` first |

### MeshBoardGridService

Grid layout and collision detection service.

```typescript
import { MeshBoardGridService } from '@meshmakers/octo-meshboard';

@Component({...})
export class MyComponent {
  private readonly gridService = inject(MeshBoardGridService);

  onWidgetDrop(widget: AnyWidgetConfig, targetCol: number, targetRow: number) {
    const wouldOverlap = this.gridService.wouldCauseOverlap(
      this.widgets,
      widget.id,
      targetCol,
      targetRow,
      widget.colSpan,
      widget.rowSpan
    );

    if (!wouldOverlap) {
      // Safe to move
    }
  }
}
```

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `wouldCauseOverlap(widgets, id, col, row, colSpan, rowSpan)` | `boolean` | Check if position causes overlap |
| `findAvailablePosition(widgets, columns, colSpan, rowSpan)` | `{col, row}` | Find next free position |
| `resolveOverlaps(widgets, columns)` | `AnyWidgetConfig[]` | Returns list of moved widgets |
| `getOccupiedCells(widget)` | `GridCell[]` | Get cells occupied by widget |

### MeshBoardVariableService

Variable parsing and resolution service.

```typescript
import { MeshBoardVariableService } from '@meshmakers/octo-meshboard';

const variables: MeshBoardVariable[] = [
  { name: 'customerId', type: 'string', source: 'static', value: 'C-001' }
];

// Resolve variable references in strings
const resolved = service.resolveVariables('Customer: $customerId', variables);
// Result: "Customer: C-001"

// Also supports ${name} syntax
const resolved2 = service.resolveVariables('ID: ${customerId}', variables);
// Result: "ID: C-001"
```

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `resolveVariables(text, variables)` | `string` | Replace variable references |
| `parseVariables(text)` | `string[]` | Extract variable names from text |
| `isValidVariableName(name)` | `boolean` | Check if name is valid (`[a-zA-Z_][a-zA-Z0-9_]*`) |
| `convertToFieldFilterDto(filters, variables)` | `FieldFilterDto[]` | Convert filters with variable resolution |
| `mapAttributeTypeToVariableType(attrType)` | `MeshBoardVariableType` | Map CK attribute type to variable type |
| `attributePathToVariableName(path)` | `string` | Convert attribute path to camelCase variable name |

### MeshBoardDataService

Data fetching service for widgets.

```typescript
import { MeshBoardDataService } from '@meshmakers/octo-meshboard';

@Component({...})
export class MyWidget {
  private readonly dataService = inject(MeshBoardDataService);

  async loadData() {
    // Fetch runtime entity
    const entity = await firstValueFrom(
      this.dataService.fetchRuntimeEntity({
        type: 'runtimeEntity',
        ckTypeId: 'OctoSdk/Customer',
        rtId: 'customer-123'
      })
    );

    // Fetch aggregations (e.g., for KPI widgets)
    const aggregations = await this.dataService.fetchAggregations([
      { id: 'totalCount', ckTypeId: 'OctoSdk/Customer', aggregation: 'count' }
    ]);
    const count = aggregations.get('totalCount');
  }
}
```

### WidgetRegistryService

Widget type registration and factory service.

```typescript
import { WidgetRegistryService, WidgetRegistration } from '@meshmakers/octo-meshboard';

// Register a custom widget type
const registration: WidgetRegistration<MyWidgetConfig, MyConfigResult> = {
  type: 'myWidget',
  label: 'My Custom Widget',
  component: MyWidgetComponent,
  configDialogComponent: MyWidgetConfigDialogComponent,
  defaultSize: { colSpan: 2, rowSpan: 2 },
  supportedDataSources: ['runtimeEntity', 'static'],
  createDefaultConfig: (base) => ({ ...base, type: 'myWidget', /* ... */ }),
  toPersistedConfig: (widget) => ({ /* ... */ }),
  fromPersistedConfig: (data, base) => ({ /* ... */ })
};

service.registerWidget(registration);

// Create widget instance
const widget = service.createWidget('myWidget', {
  id: 'w-1',
  title: 'My Widget',
  col: 1, row: 1, colSpan: 2, rowSpan: 2
});
```

---

## Data Source Types

Widgets support multiple data source types:

```typescript
type DataSourceType =
  | 'runtimeEntity'      // Single entity by rtId
  | 'persistentQuery'    // Execute saved query
  | 'aggregation'        // Count/sum/avg queries
  | 'serviceCall'        // Health checks
  | 'constructionKitQuery' // CK data (models, types)
  | 'static';            // Static data for testing
```

### RuntimeEntityDataSource

```typescript
interface RuntimeEntityDataSource {
  type: 'runtimeEntity';
  ckTypeId?: string;      // CK type of entity
  rtId?: string;          // Runtime ID of entity
  attributePaths?: string[];
  includeAssociations?: boolean;
}
```

### PersistentQueryDataSource

```typescript
interface PersistentQueryDataSource {
  type: 'persistentQuery';
  queryRtId: string;          // rtId of the persistent query
  queryName?: string;         // Display name
  queryFamily?: QueryFamily;  // 'runtime' | 'streamData' (derived when absent)
  ignoreTimeFilter?: boolean; // SD opt-out of the MeshBoard time-filter binding
  entitySelectorId?: string;  // Asset-scope binding (runtime + stream-data, AB#7725) — see below
}
```

#### Asset-scope binding (`entitySelectorId`)

A persistent-query widget — runtime or stream-data — can be scoped to a picked
asset by naming an entity selector. The restriction always runs on the server,
never by filtering a full result on the client:

| Query family | How the resolved rtIds restrict the query |
|---|---|
| Stream data (simple, aggregation, grouping, downsampling) | `streamDataArgs.rtIds` → backend `StreamDataArguments.rtIds` override (replaces the persisted RtIds) |
| Runtime (SimpleRtQuery, AggregationRtQuery, GroupingAggregationRtQuery, AB#7725) | field filter `rtId IN (rtIds)` (`FieldFilterOperatorsDto.InDto`), AND-combined with the widget's filters and the saved query's own filters; the backend applies all of them in the database query before aggregating, so grouping/aggregation results cover the scoped entities only |

Widgets pass the scope as `QueryExecutionOptions.scopeRtIds`; `QueryExecutorService`
picks the mechanism per family after it knows the family (also for a legacy config
without `queryFamily`, which it looks up once). `QueryExecutorService.withRtIdScope`
builds the runtime filter list. For stream data an explicit `streamDataArgs.rtIds`
wins over `scopeRtIds` (both carry the same scope in the built-in widgets).

Stream data in detail: Stream-data archives are keyed by their **source rtIds**, not by a
parent column — so a field-filter on `$mp_rtId` can't scope an archive query.
Instead the widget passes those source rtIds as the query's
`streamDataArgs.rtIds`, which the backend `StreamDataArguments.rtIds` override
applies in place of the persisted RtIds.

Resolution flow:
1. The selector resolves its picked entity to source rtIds when the selection
   changes — either the selector's `childScope` (one hop, e.g. a parent → its
   child device rtIds, or a multi-hop `path`, AB#7723) or, with no childScope,
   the picked entity's own rtId. The
   view marks the scope `pending` first and stores the result via
   `MeshBoardStateService.setEntitySelectorRtIds` (or `setEntitySelectorScopeFailed`).
2. Each widget first asks `resolveStreamDataScope(entitySelectorId, queryFamily, ignoreTimeFilter)`
   (AB#7582 host gate for stream data, then `resolveEntitySelectorScope`) and then,
   for a `scoped` scope, passes the rtIds as `scopeRtIds` (and, for stream data,
   merges `resolveStreamDataRtIds(entitySelectorId)` into `streamDataArgs`
   alongside the time range).

#### Scope resolution contract (AB#7721)

Per selector the state service keeps one transient `EntitySelectorScopeState`
(`utils/stream-data-scope.ts`), cleared on every board switch:

| State | Set by the view | `resolveStreamDataScope` | Bound widget |
|---|---|---|---|
| none | no pick (no route/URL pick, no `defaultRtId`), or pick cleared | `unscoped` | queries with the **persisted** scope (unchanged) |
| `pending` | a pick starts resolving; every initial pick is primed right after a board loads, before change detection renders the widgets | `pending` | shows its **loading** state, sends **no query** |
| `resolved`, ≥1 rtId | resolution done | `scoped` | queries with `streamDataArgs.rtIds` (unchanged) |
| `resolved`, 0 rtIds | the pick has nothing in scope | `empty` / `noTargets` | shows its **no-data** state, sends **no query** |
| `failed` | association fetch threw, or the picked entity was not found | `empty` / `failed` | as above; the view shows one notice per selector (*Could not resolve the scope of "<label>"*, `MeshBoardMessages.scopeResolutionFailed`) and logs the error once |
| `needsPick` (AB#7916) | a dependent selector (or a follower of one without own pick) has no pick while its leader has one | `empty` / `noPick` | no data, no query; the view shows *Pick a <label> to see this data.* (`MeshBoardMessages.scopePickRequired`) — see *Dependent selectors* |

Rules:
- **Never fall back to the persisted scope for `pending` or `empty`.** The persisted
  scope is usually the whole archive; a pick without e.g. a matching child would
  otherwise show rows of other entities.
- The contract is the same for runtime queries (AB#7725): a bound runtime widget is
  pending / empty / scoped exactly like a stream-data widget, independent of
  `queryFamily` (also when it is missing on a legacy config). Before AB#7725 runtime
  queries ignored the binding.
- Widgets reload only when their config reference changes, so the view calls
  `triggerRefresh()` after the initial picks resolved and after every pick change.
  A pending widget therefore never needs its own subscription. A widget that
  (re)loads while the scope is pending (initial load, auto-refresh, time-filter
  change) shows loading; on a pick change the previous content stays until the
  refresh that follows the resolution — no query is sent in between.
- Each pick resolution carries a per-selector sequence number; a slower resolution
  of an earlier pick never overwrites the scope of a newer pick.
- No-data rendering per widget: KPI / gauge show `-` (no output variable is published);
  line / bar / pie / heatmap render the empty chart (`emptyQueryExecutionResult`); the
  table lists no rows (pending: the fetch observable never emits, so the list stays
  loading until the refresh cancels it); stats grid / summary card show `-` per cell
  and send no query while the cell's scope is pending or empty (pending: the whole widget stays loading); the process binding gets no rows (pending: `BoundDataResult.pending`, the widget stays loading).
- A custom widget that reads `resolveStreamDataRtIds` must check
  `resolveStreamDataScope` first — `undefined` from `resolveStreamDataRtIds` is not
  "query unscoped" for a pending or empty scope.

Configured per widget via the "Scope to entity selector" dropdown
(`mm-entity-selector-scope-picker`) in the config dialogs of table, bar chart,
pie chart, KPI, gauge, line chart, heatmap, process and the per-cell editor of
stats grid / summary card. It is shown as soon as a query of either family is
selected (until AB#7725 only for stream-data queries); the time-filter toggle
stays stream-data only. The binding is persisted as `entitySelectorId` in the
widget config for both families and omitted when unset, so unbound widgets
encode byte-identically.

### AggregationDataSource

```typescript
interface AggregationDataSource {
  type: 'aggregation';
  queries: AggregationQuery[];
}

interface AggregationQuery {
  id: string;                     // Reference ID
  ckTypeId: string;               // Type to aggregate
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
  attribute?: string;             // For sum/avg/min/max
  filters?: WidgetFilterConfig[]; // Optional filters
}
```

---

## Widget Types

### Built-in Widgets

| Type | Description | Data Sources |
|------|-------------|--------------|
| `kpi` | Single numeric value with optional trend. A `static` data source with `data` (widget-group children) reads `valueAttribute` from that entity data; without `data` the KPI shows `staticValue`. Optional `decimalPlaces` (integer number 0-3, normalised on load by `utils/kpi-decimal-places.ts`, anything else = automatic; an exact digit count, unlike the heatmap's maximum; also passed to widget-group KPI children) fixes the fraction digits of a numeric value, a negative value rounding to zero shows no sign (unset or invalid: two for a fractional value, none for a whole number; AB#7686). Optional `valueMultiplier` scales numeric query values before display (e.g. Σ(kW samples every 10 s) × 10/3600 → kWh; window-independent because SUM is linear; negate for signed magnitudes like battery discharge). **Formula mode** (`valueMode: 'formula'`) computes the value from a formula over variables; any KPI can publish its raw value via `outputVariableName` — see *Widget Output Variables and KPI Formulas* | runtimeEntity, persistentQuery, aggregation, static |
| `gauge` | Arc, Circular, Linear, or Radial gauge. **Formula mode** (`valueMode: 'formula'` + `formula`, static data source; AB#7950) computes the value from a formula over variables exactly like the KPI — see *Widget Output Variables and KPI Formulas*. The pointer is clamped to `min`/`max` (it stops at the scale end), the label shows the real value | runtimeEntity, persistentQuery, aggregation, static |
| `barChart` | Bar/Column chart | persistentQuery, constructionKitQuery |
| `pieChart` | Pie/Donut chart | persistentQuery, constructionKitQuery |
| `table` | Data grid with pagination | persistentQuery |
| `entityCard` | UML-style entity display | runtimeEntity |
| `entityWithAssociations` | Entity with relationships | runtimeEntity |
| `statusIndicator` | Traffic light status | serviceCall, aggregation |
| `serviceHealth` | Backend service health | serviceCall |
| `statsGrid` | Multiple KPIs in a grid | aggregation, persistentQuery (per stat; runtime + stream-data) |
| `summaryCard` | Compact data tiles | runtimeEntity, aggregation, persistentQuery (per tile; runtime + stream-data) |
| `process` | Process diagram (HMI) | runtimeEntity, persistentQuery (runtime + stream-data) |
| `markdown` | Static markdown content with themed styling | static |
| `attentionList`, `adapterStatus`, `ckModelState`, `pipelineExecutions` | Cockpit widgets (AB#5558) — see *Cockpit Widgets* | none (static) |
| `recentItems` | The viewer's recently opened places from the host (`COCKPIT_RECENT_ITEMS`, AB#5558) — see *Cockpit Widgets* | none (static) |
| `heatmap` | Day × time-slot density grid (count/sum/avg per slot). Date: the cell matching `dateField`; for stream-data rows with `dateField` `timestamp` the row's top-level `timestamp` (stream-data cells hold only value columns, AB#7938) | persistentQuery (runtime + stream-data) |

> **Heatmap color modes.** `HeatmapWidgetConfig.colorMode` selects how cells are
> colored:
> - `gradient` (default): relative shading across the data's own min/max using the
>   chosen `colorScheme`; empty (0) cells are transparent.
> - `threshold`: absolute ok/warn/high bands around a target count — a cell equal to
>   the target is green, below it (including empty 0-cells) amber, above it red.
>   The target comes from `thresholdTarget` when set, otherwise it is auto-derived
>   from the number of asset-scoped source rtIds (the `entitySelectorId` binding) —
>   e.g. the EnergyMeasurements under a picked MeteringPoint, so a "healthy" 15-min
>   slot holds exactly one value per source. Falls back to gradient when no target
>   can be resolved.

> **Per-cell persistent queries (stats-grid / summary-card).** Each stat / tile can
> draw its value from a persistent query instead of a runtime aggregation. The
> query may be runtime or stream-data — switching is a configuration change
> (`StatItem.persistentQuerySource` / `SummaryCardTile.persistentQuerySource`,
> shape {@link PersistentQueryCellSource}). The shared
> `mm-persistent-query-cell-editor` surfaces the query picker plus the SD-only
> time-filter opt-out (hidden for runtime queries) and the entity-selector
> asset-scope (both families, AB#7725), exactly like the KPI/gauge widgets. Value extraction by `queryMode`
> (simpleCount / aggregation / groupedAggregation) is shared via
> `utils/persistent-query-cell.ts`.

### Widget Configuration Interface

```typescript
interface BaseWidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  col: number;        // Grid column (1-based)
  row: number;        // Grid row (1-based)
  colSpan: number;    // Width in columns
  rowSpan: number;    // Height in rows
  configurable?: boolean;
  dataSource: DataSource;
}
```

### Markdown Widget

The Markdown Widget displays static markdown content with customizable styling via CSS variables. It supports variable interpolation for dynamic content.

**Configuration Interface:**

```typescript
interface MarkdownWidgetConfig extends BaseWidgetConfig {
  type: 'markdown';
  content: string;           // Markdown content
  resolveVariables?: boolean; // Replace $var with MeshBoard variables
  padding?: string;          // CSS padding (default: '16px')
  textAlign?: 'left' | 'center' | 'right';
}
```

**Features:**
- Full GitHub Flavored Markdown (GFM) support via `ngx-markdown`
- Themed rendering via CSS custom properties (neutral defaults, customizable by host app)
- Variable interpolation using `$variableName` or `${variableName}` syntax
- Configurable padding and text alignment
- Edit/Preview toggle in configuration dialog

**Styling Note:** The markdown prose styles should use CSS custom properties with neutral defaults. Host applications can override these to match their theme. Avoid hardcoding theme-specific colors in the library.

**Lazy loading (AB#5621):**
The widget and its config dialog render through `LazyMarkdownComponent` (`mm-lazy-markdown`), which loads
`ngx-markdown` (and `marked`) with a bare-specifier `import('ngx-markdown')` on first render. Never import
`ngx-markdown` statically in this library: the widget registry is eager, so a static import would put
`ngx-markdown`/`marked` into the initial bundle of every host showing a MeshBoard. (A relative dynamic import
would not help — ng-packagr inlines it into the FESM.) No root `provideMarkdown()` is required; if the host
provides `MarkdownService` (e.g. `provideMarkdown({...})`), that configuration is used, otherwise the component
creates its own environment injector with `provideMarkdown()`.

**Example Usage:**

```typescript
const markdownWidget: MarkdownWidgetConfig = {
  id: 'markdown-1',
  type: 'markdown',
  title: 'Welcome',
  col: 1, row: 1, colSpan: 2, rowSpan: 2,
  dataSource: { type: 'static' },
  content: `# Welcome to $dashboardName

This dashboard shows data for **$customerName**.

## Features
- Real-time monitoring
- Historical analysis
- Alerts and notifications`,
  resolveVariables: true,
  textAlign: 'left'
};
```

---

## Variable System

MeshBoards support variables for dynamic content:

```typescript
interface MeshBoardVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'datetime';
  source: 'static' | 'timeFilter' | 'entitySelector' | 'widget';
  value: string;
  defaultValue?: string;
  entitySelectorId?: string;     // Which entity selector generated this variable
  widgetId?: string;             // Which widget published this variable (source 'widget')
}
```

**Variable Sources:**
- `static` - User-defined value
- `timeFilter` - Auto-generated from time range picker
- `entitySelector` - Auto-generated from entity selector selections (toolbar or fixed)
- `widget` - Published at runtime by a widget's output variable (see below); never persisted

**Usage in Widget Configs:**
- `${variableName}` - Bracket syntax (recommended)

**Example:**
```typescript
// Variable
{ name: 'customerId', type: 'string', source: 'static', value: 'C-001' }

// In filter config
{ attributePath: 'customerId', comparisonValue: '$customerId', operator: 'eq' }
```

### Widget Output Variables and KPI Formulas (AB#5364, gauges AB#7950)

**Output variables.** Any KPI widget (query, runtime entity, static or formula) can set
`outputVariableName`. The widget then publishes its displayed **raw** value — for query
KPIs the value after `valueMultiplier`, not the formatted display string — through
`MeshBoardStateService.setWidgetVariable`. Widget variables live in a transient signal
next to the config (`_widgetVariables`), so publishing causes no persistence and no dirty
state. `getVariables()` merges them in (a config variable wins on a name clash), and every
write path (`setVariableValue`, `addVariable`, …) builds on the config variables only, so a
widget variable never reaches the description blob. They are cleared on board switch, when
the widget is destroyed, when the output name is removed, while the value is pending and
while the widget is in error (failed load). During a refresh the last value stays
published, so dependent formulas do not flicker to `-`.

**Formula mode.** `KpiWidgetConfig.valueMode: 'formula'` with `formula`, e.g.
`(${a} - ${b}) / 1000`; the data source stays `{ type: 'static' }`. The value is computed
live in a `computed()` (no `loadData()`), using `utils/meshboard-formula.ts`:

| Function | Purpose |
|---|---|
| `rewriteFormula(formula)` | `${name}` / `$name` → safe identifier `__v_<name>` (no clash with built-ins like `max`, `E`) |
| `validateFormula(formula, names, evaluator)` | Syntax + unknown variables (bare identifiers count as unknown) |
| `evaluateFormula(formula, variables, evaluator)` | `ok` / `error` / `pending` (a referenced variable is missing or empty → the widget shows `-`) / `nonFinite` (see below) |
| `requireNumericFormulaResult(result)` | Turns a string/boolean `ok` into the error *Result is not a number* (gauge) |
| `validateFormulaField(formula, variables, declaredNames, evaluator)` | The ONE validation of the formula field: `validateFormula` against the variable names plus declared names |
| `declaredFormulaVariableNames(widgets, selectors, excludeWidgetId)` | Names that exist without a value yet: other KPIs' outputs, entity-selector variables |
| `formulaPreviewText(result)` | Preview text of the formula field |
| `findVariableCycles(widgets)` | IDs of formula KPIs that depend on their own output, directly or indirectly |

The evaluator is the `ExpressionEvaluatorService` of `@meshmakers/octo-process-diagrams`
(expr-eval-fork): `+ - * / % ^`, parentheses, `min`, `max`, `abs`, `round`, `? :` plus the
process-diagram helpers (`clamp`, `lerp`, …). Variable values are strings: numeric strings
(dot as decimal separator) become numbers, `true`/`false` become booleans.

**Non-finite rule (AB#7950).** A result of `Infinity` or `NaN` (division by zero, e.g. PV = 0 at
night) is status `nonFinite`, not an error: KPI and gauge show `-` with the reason
(`NON_FINITE_FORMULA_REASON`) as tooltip on the value, and the KPI publishes no output value.
Before AB#7950 it was the widget error state.

**Gauge formulas (AB#7950).** `GaugeWidgetConfig.valueMode: 'formula'` + `formula`, data source
`{ type: 'static' }`, evaluated live in a `computed()` like the KPI (no `loadData()`). The result must
be a number (`requireNumericFormulaResult`); a gauge publishes no output variable, so it is never
part of a cycle. What the gauge shows:

| Situation | Gauge |
|---|---|
| referenced variable empty or not yet published | label `-`, pointer at the scale start, no error (linear gauge: label only) |
| syntax / evaluation error | widget error state with the message |
| non-finite result | label `-` with the reason as tooltip |
| string / boolean result | error *Result is not a number* |
| value outside `min`/`max` | pointer stops at the scale end (`pointerValue`), label shows the real value |

Keep a percentage on its scale with the clamp pattern, e.g. Autarkie
`max(0, min(100, (1 - ${import} / ${consumption}) * 100))`. Persistence: a formula gauge is written
with `dataSourceType: 'static'` and `valueMode`/`formula` in the config; every other gauge keeps its
encoding byte-identically, and switching away from Formula clears `valueMode`/`formula`.

**Reactivity.** Formulas, the KPI comparison text and markdown content read
`getVariables()` inside `computed()`s and update immediately. Query filters of other widgets
resolve variables when they load, so they pick up a published value on the next refresh.

**Cycles.** The config dialog refuses to save a formula/output combination that closes a
cycle (`cycleError`). At runtime a widget in a cycle shows *Circular variable reference* and
publishes nothing, so a cycle can never ping-pong values between widgets. A reference whose
name is also a configured MeshBoard variable resolves to that variable (config wins) and
therefore creates no dependency on the widget publishing the same name.

**Shared formula field (AB#7950).** `mm-meshboard-formula-field` (`components/formula-field/`,
exported as `FormulaFieldComponent`) is the formula input of every config dialog: `[(formula)]`,
`[variables]` (operands with their current values, drive the preview and the insert buttons),
`[declaredNames]` (names known without a value), `[numericOnly]` (preview applies
`requireNumericFormulaResult`), `[clampHint]` (shows the clamp pattern). It renders the hint, the
validation message (`role="alert"`), the preview and the variable buttons; the label is linked to the
input (`focusableId`) and the input is described by hint and message. Dialogs never re-implement the
check: they call `validateFormulaField` with the same inputs for Save. The planned chart formula
series (AB#7952/AB#7953, not built yet) are meant to reuse it with series keys as variables.

**Config dialog.** A fourth data-source button **Formula** (the shared formula field above) and
an **Output Variable** field for all modes (`isValidVariableName`, no clash with a config
variable or another widget's output). Formula validation also accepts names that are declared
but carry no value yet — other KPIs' `outputVariableName` (still loading, pending or in error)
and the variables of entity selectors (`attributeMappings[].variableName`, `<id>_rtId`,
`<id>_rtCkTypeId`) before an entity is picked; the preview shows them as pending.

---

## Entity Selectors

Entity selectors populate MeshBoard variables from a selected entity's attributes. They come in two modes:

- **Toolbar mode** (`showInToolbar: true`, default): Users select an entity from a dropdown in the toolbar
- **Fixed mode** (`showInToolbar: false`): Variables are resolved from a pre-configured default entity (no UI)
- **Follower** (`followsSelectorId` set, AB#7722): no UI; takes the pick of another (leader) selector — see *Leader/follower selectors*
- **Dependent** (`scopeSource` set, AB#7915): keeps its own picker, which lists only the entities reached from the leader's pick — see *Dependent selectors*

This unified mechanism replaces both the old "runtime entity variables" and the toolbar entity selector concepts.

### Configuration

Entity selectors are configured in the MeshBoard Settings Dialog (4th tab "Entity Selectors"):

```typescript
interface EntitySelectorConfig {
  id: string;                  // Stable ID for URL params (e.g., "mp")
  label: string;               // Display label (e.g., "Metering Point")
  ckTypeId: string;            // CK type to select from
  attributeMappings: EntitySelectorAttributeMapping[];
  showInToolbar?: boolean;     // Show in toolbar (default: true). If false, uses defaultRtId
  defaultRtId?: string;       // Pre-selected entity (required when showInToolbar=false)
  childScope?: EntitySelectorChildScope; // One hop or a multi-hop path for stream-data widgets (see below)
  followsSelectorId?: string; // Leader selector id (AB#7722) — see *Leader/follower selectors*
  filters?: WidgetFilterConfig[]; // Picker filter (AB#7724) — see *Picker filter*
  scopeSource?: EntitySelectorScopeSource; // Leader + path (AB#7915) — see *Dependent selectors*
  selectedRtId?: string;      // Current selection (transient, not persisted)
  selectedDisplayName?: string; // Current display name (transient)
}

interface EntitySelectorAttributeMapping {
  attributePath: string;       // Attribute path on the entity
  variableName: string;        // Variable name to populate (e.g., "meteringPointName")
  attributeValueType?: string; // Attribute value type
}

// Association traversal turning the picked entity into the source rtIds a
// stream-data widget scopes by (e.g. MeteringPoint → EnergyMeasurement rtIds).
interface EntitySelectorChildScope {
  targetCkTypeId?: string;     // One-hop form: type that keys the archive (e.g. EnergyMeasurement)
  roleId?: string;             // One-hop form: association role (e.g. "System/ParentChild")
  direction?: 'in' | 'out';    // One-hop form: direction (default 'in' — System/ParentChild children are inbound)
  path?: EntitySelectorScopeHop[]; // Multi-hop form (AB#7723): 2..MAX_SCOPE_HOPS hops, wins when non-empty
}

interface EntitySelectorScopeHop {
  roleId: string;
  direction?: 'in' | 'out';    // default 'in'
  targetCkTypeId: string;      // source type of the next hop
}

// Dependent selector (AB#7915): the picker lists only what the leader's pick reaches.
interface EntitySelectorScopeSource {
  selectorId: string;          // leader: not a follower, not itself dependent
  path: EntitySelectorScopeHop[]; // 1..MAX_SCOPE_HOPS hops, leader type → this type; always a path
}
```

The `childScope` is configured in the "Child Scope (stream-data)" section of
the entity-selector editor (hop list, see *Multi-hop child scope*). When set, a
selection resolves to the rtIds of the last hop; when absent, the picked
entity's own rtId is the scope. These rtIds feed a widget's `entitySelectorId`
asset-scope binding — see *PersistentQueryDataSource* above.

### Multi-hop child scope (AB#7723)

A child scope is either the original **one-hop form** (top-level
`targetCkTypeId` / `roleId` / `direction`) or a **path** of 2 to
`MAX_SCOPE_HOPS` (5) hops, e.g. site → system → device. Helpers:
`utils/entity-selector-scope-path.ts` (pure, unit-tested): `scopePlan` (none /
single / path / invalid), `resolveScopePath`, `scopeHopsOf` /
`childScopeFromHops` (editor mapping), `scopeHopsValidationError`.

Resolution contract (view, `resolveEntitySelectorScopeRtIds`):

| Config | Resolution |
|---|---|
| no `childScope`, or incomplete top-level fields without `path` | the picked entity's own rtId (unchanged) |
| one-hop form | one `fetchAssociationTargets` request — exactly the pre-AB#7723 request and result |
| `path` (non-empty; wins over the top-level fields) | hop by hop; hop n's sources are the de-duplicated targets of hop n-1, its source type is hop n-1's target type; scope = distinct rtIds of the last hop |
| `path` with more than 5 hops, or a hop without role / target type | **failed** scope (notice, no data, no request) |

- **Query cost:** each hop is ONE batched step over all its sources —
  `MeshBoardDataService.fetchAssociationTargetRtIds` sends `runtimeEntities(rtIds:)`
  with the association targets nested (`getAssociationTargetRtIds`, rtIds only, no
  attributes), `ASSOCIATION_HOP_SOURCE_BATCH` (100) sources per request, the
  batches of a hop in parallel, `ASSOCIATION_HOP_TARGETS_PER_SOURCE` (1000)
  targets per source with a console warning when a source has more. Never one
  request per entity.
- **Empty hop** → no further hop is requested, resolved **empty** (`noTargets`).
- **Failed hop** → **failed** scope (AB#7721 notice, logged once).
- **Stale pick** → `resolveScopePath` checks the selector's sequence number after
  every hop and stops (returns `null`, nothing applied) once a newer pick started.
- Followers (AB#7722) resolve their own `path` from the leader's pick.
- **Editor** (`EntitySelectorScopePathEditorComponent`, wireframe agreed by Freya
  in AB#7723): hop list with add (max 5), remove, move up/down (icon buttons with
  `aria-label`/title, focus stays on the moved hop); per hop an "Association"
  dropdown from `getCkTypeAssociationRoles` of the hop's source type (role +
  direction + base target in one entry, plus "Other role…" for free text) and a
  target-type picker restricted via `derivedFromRtCkTypeId` to the association's
  target; a hop whose role is not defined on its (new) source type keeps its
  values and shows "Association <role> is not defined on <type>." (warning, does
  not block); metadata that cannot be loaded shows a hint and free-text fields;
  an incomplete hop blocks saving (Kendo `k-invalid` + message); empty state and
  path line. Followers use the same component.
- **Persistence:** the editor saves no hops as no `childScope`, one hop in the
  top-level form (older library versions keep reading it) and two or more hops as
  `{ path }` only. `MeshBoardPersistenceService` carries `childScope` verbatim, so
  `path` round-trips through save/reload and export/import, and one-hop boards
  encode byte-identically (`meshboard-persistence.entity-selector-multihop.spec.ts`,
  fixture `testing/entity-selector-scope-path.fixtures.ts`). An older library
  reading a `path`-only scope sees no top-level hop and scopes by the picked
  entity itself.

### Leader/follower selectors (AB#7722)

A widget binds exactly one selector and a selector has one child scope, so one
visible pick could scope only widgets of one target type. A **follower**
(`followsSelectorId: '<leader id>'`) closes that gap: one visible leader (e.g. a
site) drives any number of hidden followers, each with its own `childScope`
(e.g. site → devices, site → sensors, or a multi-hop path, AB#7723), so one pick
rescopes widgets of different target types. Helpers: `utils/entity-selector-follow.ts` (pure, unit-tested).

Resolution contract (view, `resolveEntitySelectorVariables`):

| Leader state | Follower |
|---|---|
| has a pick (route data, URL, its `defaultRtId`, or a toolbar pick) | takes that pick: same `selectedRtId` / display name; variables from its own `attributeMappings` + `<followerId>_rtId` / `_rtCkTypeId` of the leader's picked entity; scope from its own `childScope` |
| pick pending | **pending** too (marked in the same synchronous step as the leader, AB#7721) |
| pick has nothing on the follower's path | resolved **empty** (`noTargets`) — widgets show no data, no query |
| pick fails (entity not found, lookup threw) | `failed` like the leader |
| no pick | the follower's own `defaultRtId` (resolved standalone), else **no scope** (persisted scope, AB#7721) |
| pick cleared | as "no pick" |

Rules:
- One entity fetch serves the leader and all its followers; each gets its own
  scope sequence number, so a slower resolution of an older pick never
  overwrites a follower's newer state (variables and selection included).
- The follower's `ckTypeId` is the leader's: the editor fixes it, and the view
  resolves with the leader's type even if a stale type is stored (`effectiveSelector`).
- **One level only.** A follower cannot lead (`followersOf` ignores followers of a
  follower). An unknown, self or chained `followsSelectorId` is treated as "leader
  has no pick" plus one `console.warn` on board load; the editor prevents it.
- Followers never render a picker (`showsInToolbar`), are never written to the URL
  and ignore `es_<followerId>` params and route data: a URL with only the leader's
  `es_` param restores every follower. `setEntitySelector` / `clearEntitySelector`
  on a follower warn and do nothing.
- Editor ("Follows" field, wireframe agreed in AB#7722): lists other non-follower
  selectors; choosing a leader fixes the CK type (default entity and mappings of a
  different previous type are cleared with a notice), hides "Show in Toolbar" and
  makes mappings and the default entity optional; a followed selector cannot
  follow (dropdown disabled, message names its followers); back to none = CK type
  editable, "Show in Toolbar" unchecked. The list badge shows `Follows: <leader>`
  or a `Follows: missing` error badge; removing a leader asks for confirmation
  naming its followers (`ConfirmationService`, when the host provides it).
- Persistence: `followsSelectorId` is in the selector whitelist of
  `MeshBoardPersistenceService.encodeVariablesInDescription` and omitted when
  empty, so boards without followers encode byte-identically; export/import
  carries the description verbatim (`meshboard-persistence.entity-selector-follow.spec.ts`).

### Picker filter (AB#7724)

`filters` narrows what a selector's pickers list (e.g. only the electrical
systems of a type that also models heating circuits). Helpers:
`utils/entity-selector-filter.ts` (`hasPickerFilter`, `pickerFieldFilters`,
`withPickerFilters`, `unresolvedFilterVariables`, texts).

- **Shape:** the widget filter type `WidgetFilterConfig` (`attributePath`,
  `operator`, `comparisonValue`); rows combine with **AND**; every operator of
  the shared `mm-field-filter-editor` (octo-ui) is allowed — the same set as
  widget filters (GraphQL `FieldFilterOperators`).
- **Server side:** the rows are converted with
  `MeshBoardVariableService.convertToFieldFilterDto` (board variables
  substituted, exactly like widget filters) and sent as GraphQL `fieldFilter`
  of the `runtimeEntities` query. `withPickerFilters` wraps the query service so
  every fetch of the octo-services data sources (`RuntimeEntitySelectDataSource`
  dropdown, `RuntimeEntityDialogDataSource` search dialog) carries the rows in
  front of its own text-search row — the search keeps working on top of the
  filter, and nothing is filtered on the client. Without rows the original
  query service is used, so an unfiltered picker sends the query it always sent.
- **Variables:** the toolbar gets the board variables (`[variables]` from the
  view, `MeshBoardStateService.getVariables()`) and rebuilds its data sources
  when the resolved filter changes (cache key = CK type + resolved rows). A
  variable without a value behaves as in widget filters: an empty value is sent
  as `''`, an unknown/unset one keeps its `$name` placeholder (usually matches
  nothing); the picker's empty-list text then names the variable.
- **Toolbar texts** (wording agreed with the Studio PO): empty list
  "No <label> found. This board only lists <label> that match its filter."
  (+ "The filter uses $x, which has no value yet."); dialog title
  "Select <label> (filtered)". The search dialog's grid keeps Kendo's
  "No records available" (shared-ui has no message input for it).
- **Followers** have no picker: `pickerFieldFilters` ignores their rows, the
  editor hides the section ("A follower takes the leader's pick. Set the filter
  on <leader>."), says that hand-edited rows are ignored and drops them on save.
- **Defaults and URL picks:** the filter affects the listing only. A
  `defaultRtId`, an `es_<id>` URL pick or route data that does not match is
  applied exactly as before; the view never queries the filter to validate a
  pick (`meshboard-view.entity-selector-filter.spec.ts`).
- **Editor** (section "Picker filter" under CK Type, shown once a CK type is
  chosen; wireframe approved by Freya with changes in AB#7724): the shared
  `mm-field-filter-editor` with the board's static variables plus the other
  selectors' mapped variables; the default-entity picker applies the filter too
  (rows with a variable the editor cannot substitute are left out there). A
  debounced server check (`runtimeEntities` with `rtId` + rows, `first: 1`)
  warns "The default entity does not match the picker filter. It still loads,
  but users cannot pick it again." — never blocking save; a failed check says
  "Could not check the default entity.", a filter with a view-time variable
  says the check is skipped. The list shows a "N filters" chip.
- **Persistence:** `filters` is in the selector whitelist of
  `encodeVariablesInDescription`, reduced to the three filter fields and omitted
  when empty — boards without filters encode byte-identically; export/import
  carries the description verbatim (`meshboard-persistence.entity-selector-filter.spec.ts`,
  fixture `testing/entity-selector-filter.fixtures.ts`).

### Dependent selectors (AB#7915)

Three selector roles: a **leader** is any selector others refer to; a **follower**
(`followsSelectorId`, AB#7722) has no picker and takes the leader's pick; a
**dependent** (`scopeSource`) keeps its own picker, but while the leader has a
pick the picker lists only the entities reached from that pick through
`scopeSource.path` — the *picker scope* (e.g. only the rooms of the picked
site). Helpers: `utils/entity-selector-scope-source.ts` (pure, unit-tested):
`resolveScopeSource`, `dependentsOf`, `pickerScopeView`, `leaderDisplayName`,
the texts, and the query wrappers `withoutListing` / `deferredPickerQuery`.

- **Shape:** `{ selectorId, path }`, `path` = 1–`MAX_SCOPE_HOPS` hops of the
  AB#7723 hop shape from the leader's CK type to the dependent's CK type,
  always stored as a path (no one-hop shorthand). One level only: the leader is
  neither a follower nor itself dependent. A dependent may itself lead followers.
- **Resolution (view):** whenever the leader's pick resolves
  (`resolveEntitySelectorVariables` — toolbar pick, URL / route / default pick on
  load, `setEntitySelector`), `pickWithDependents` → `settleDependentsOf` marks
  every valid dependent's picker scope pending in the same synchronous step and
  `resolvePickerScope` walks its path with `resolveScopePath` +
  `MeshBoardDataService.fetchAssociationTargetRtIds` (one batched request per
  hop, distinct rtIds of the last hop, an empty hop ends the walk). The leader's
  pick waits for a dependent only when that dependent's pick has to be decided
  (it has a pick or a default, AB#7916); otherwise the picker scope resolves in
  the background. A per-dependent sequence number discards a late resolution
  of an earlier leader pick. The result is kept in
  `MeshBoardStateService.pickerScopes` (`setPickerScopePending` /
  `setPickerScopeRtIds` / `setPickerScopeFailed` / `clearPickerScope`), next to
  the AB#7721 widget scopes and cleared on board switch. Clearing the leader
  clears its dependents' picker scopes. The dependent's own widget scope
  (its pick, its `childScope`) is unaffected.
- **Picker (toolbar `[pickerScopes]`):**

  | Picker scope | Dropdown and search dialog |
  |---|---|
  | leader has no pick (no entry) | lists without the scope, exactly as before |
  | `pending` | the fetch waits until the scope settles (the input shows its loading state); **no** listing query is sent meanwhile |
  | resolved, ≥1 rtId | field filter `rtId IN (scope)` (`QueryExecutorService.withRtIdScope`, as AB#7725), AND-combined with the AB#7724 filter rows and the text search via `withPickerFilters`; server-side, paging keeps working |
  | resolved, 0 rtIds | lists nothing, no query; text `No <label> in <leader>.` (+ the filter sentence when a filter is set) |
  | `failed` (a hop failed) or an invalid configuration | lists nothing, no query; text `Could not load the <label> of <leader>.` — never the unscoped list |

  `<leader>` is the leader's picked display name (else its label, else its id).
  The texts are set as `noEntitiesFound` **and** `minCharactersHint`, so they show
  as soon as the dropdown opens. The search dialog shows an empty grid (shared-ui
  has no message input for it). The data-source cache key contains the picker
  scope (`pending:<id>`, `in:<rtIds>`, `none`), so a leader change gives the
  dependent fresh data sources; selectors without scope source keep the exact
  pre-AB#7915 key and query.
- **Invalid configuration** (unknown or self leader, leader is a follower or
  dependent, more than 5 hops, no hop, hop without role or target type): one
  `console.warn` per board load and a failed picker scope. A follower with a
  `scopeSource` warns too; followers have no picker and ignore it.
- **Backend:** `runtimeEntities` resolves `rtId` field filters with collection
  values to an `_id $in` match (`RtEntityFieldFilterResolver` in the MongoDB
  engine), combined with the other field filters by AND. Checked on test-2
  (2026-10-30, a room type of a solution tenant): `rtId IN` alone, with
  `rtDisplayName LIKE` and with an attribute `EQUALS` row each returned exactly
  the expected subset.
- **Pick lifecycle:** see *Dependent pick lifecycle (AB#7916)* below.
- **Editor (AB#7917, wireframe agreed by Freya):** section "List only entities
  inside" of `mm-entity-selector-editor`, shown for a non-follower with a CK type
  (after *Picker filter*). "Inside the pick of" offers other selectors that are
  neither followers nor dependent; the path is `mm-entity-selector-scope-path-editor`
  with `[sourceCkTypeId]` = the leader's type and `[lockedTargetCkTypeId]` = the
  selector's type (last hop read-only, new hops go in front of it, it never moves,
  removing it makes the previous hop the fixed one). Editor rules are pure functions
  in `components/entity-selector-editor/entity-selector-scope-source-editor.ts`
  (leader options, dependents, `scopeSourceValidationError` on top of
  `resolveScopeSource`, list summary `Inside: <leader> (<n> hops)`). Save writes
  `{ selectorId, path }` (one hop too), "(none)" and followers write nothing (a
  follower's stored one is removed with a notice). A selector with dependents can
  neither pick a leader nor follow one. The default check resolves the leader's
  `defaultRtId` through the path (`MeshBoardDataService` resolved lazily via the
  injector, so specs without a dependent default need not provide it) and warns,
  never blocks. Specs: `entity-selector-editor.scope-source.spec.ts`,
  `entity-selector-scope-source-editor.spec.ts`, the locked block of
  `entity-selector-scope-path-editor.component.spec.ts`.
- **Persistence:** `scopeSource` is in the selector whitelist of
  `encodeVariablesInDescription`, reduced to `selectorId` and the hop fields and
  omitted when unset — boards without dependents encode byte-identically;
  export/import carries the description verbatim
  (`meshboard-persistence.entity-selector-scope-source.spec.ts`, fixture
  `testing/entity-selector-scope-source.fixtures.ts`).

### Dependent pick lifecycle (AB#7916)

A dependent never keeps a pick outside its leader's pick. Pure helpers in
`utils/entity-selector-scope-source.ts`: `nextDependentPick(current, default,
pickerScope)` and `isInPickerScope(rtId, pickerScope)`. View methods:
`pickWithDependents`, `settleDependentsOf`, `releaseDependentsOf`,
`needsPickWithoutOwnPick`, `acceptsDependentPick`.

| Event | Dependent |
|---|---|
| leader picked (toolbar, host, load) — dependent has a pick or a default | in the same synchronous step the dependent **and its followers** are marked `pending` (bound widgets show loading, never the old pick's data); after the picker scope resolved: pick in scope → kept; else `defaultRtId` in scope → default; else no pick |
| leader picked — dependent has neither pick nor default | at once `needsPick`; its followers without own default too (no waiting for the hops) |
| picker scope resolved empty | no pick, `needsPick` ("Pick a <label>") |
| picker scope failed | no pick, `failed` scope ("Could not resolve the scope of <label>") |
| leader cleared | dependents keep their pick; a dependent without pick (and its followers that needed one) goes back to the persisted scope; a dependent whose decision was still running resolves its current pick again |
| dependent cleared while the leader has a pick | `needsPick` |
| dependent picked (toolbar or `setEntitySelector`) | accepted only inside the picker scope (`isInPickerScope`; a pending scope is awaited); otherwise a console warning and nothing changes or re-queries |

- **One refresh per change.** The leader's toolbar pick, `setEntitySelector`
  and the board load call `triggerRefresh()` once, after the leader, its
  followers, every dependent decision and the dependents' followers settled
  (widgets reload only on a config reference change, so they query exactly once).
- **Stale changes.** Each selector carries a change number
  (`leaderChangeSeq`); a change overtaken by a newer pick or clear of the same
  selector skips its URL write and refresh. The picker-scope sequence number
  (`pickerScopeSeq`) drops the decision of an overtaken leader pick, the scope
  sequence number (`scopeRequestSeq`) its variable and scope writes — with
  S1 → S2 → S3 only the S3 outcome is applied.
- **Narrowed AB#7721 rule.** "No pick ⇒ persisted scope" still holds for every
  selector except a dependent whose leader has a pick (and that dependent's
  followers without own pick): they are `needsPick`, because the persisted scope
  would show entities outside the leader's pick. `primeEntitySelectorScopes`
  sets it before the first widget renders.
- **URL and route data.** The dependent keeps its own `es_<id>` param next to
  the leader's. On load the selectors that are not dependent resolve first; each
  dependent of a picked leader is decided against its picker scope with its
  initial pick (route data > URL > default) as the current pick. A dropped URL
  or route-data pick is logged once (`console.info`) and the URL is rewritten
  with `replaceUrl` — in the same navigation as the initial rtId sync when that
  runs (`entitySelectorUrlParams`), never in a second one. A dependent whose
  leader has no pick keeps its URL pick unscoped, as before.
- Specs: `meshboard-view.entity-selector-dependent-pick.spec.ts` (a real line
  chart per selector, reloaded on every refresh, with a spy on
  `QueryExecutorService`), `utils/entity-selector-scope-source.spec.ts`,
  `services/meshboard-state.service.spec.ts`.

> **Hosts with `keyFields: ['rtId']` (AB#7649).** `getAssociationTargets` selects `rtId` on the
> source entity as well, although nothing reads it: a host whose Apollo cache keys `RtEntity` by
> `rtId` (voest-app) otherwise throws "Missing field 'rtId' while extracting keyFields" on the write,
> and the child scope resolves to nothing. Every RtEntity `items` selection of
> this query carries `rtId` (pinned in `services/association-targets-cache.spec.ts`); keep `rtId` in
> any new RtEntity selection for the same reason.

### Auto-exposed selected-entity rtId / rtCkTypeId

In addition to the mapped attribute variables, every selector automatically
exposes two variables for the selected entity (no `attributeMappings` entry
required):

- `<selectorId>_rtId` — the selected entity's **rtId** (e.g. `$mp_rtId`).
- `<selectorId>_rtCkTypeId` — the selected entity's **CK type** (e.g.
  `$mp_rtCkTypeId`). Sourced from the picked entity's actual `ckTypeId` (which
  may be a subtype of the selector's configured type), falling back to the
  selector's `ckTypeId`.

Use `$<id>_rtId` to scope a **runtime-entity** widget to the selected asset by
parent association, e.g. a filter
`{ attributePath: 'parent_basicEnergyMeteringPoint', operator: 'eq', comparisonValue: '$mp_rtId' }`.

#### Entity card binding to a selector

The **entity card** widget can display whichever entity is picked by a
board-level selector. Its config dialog offers three *Entity source* modes:

- **Fixed entity** — pick a concrete CK type + entity (default, unchanged).
- **Entity selector** — choose a selector from the dropdown; stored as
  `RuntimeEntityDataSource.entitySelectorId`. At render the widget reads the
  selector's `selectedRtId` and the `$<id>_rtCkTypeId` variable.
- **Variable** — type variables into the CK-type / rtId fields (e.g.
  `$mp_rtCkTypeId` / `$mp_rtId`); resolved via `MeshBoardVariableService` before
  the entity is fetched.

The widget skips the fetch (showing nothing) while the resolved rtId/ckTypeId is
empty or still contains an unresolved `$placeholder` — e.g. before a selection
is made. Selection changes re-fetch automatically via the standard
`triggerRefresh()` → `ngOnChanges` path.

> **Stream-data widgets are different.** A stream-data archive has no parent
> column, so a `$mp_rtId` field-filter can't scope an archive query. Use the
> selector's `childScope` + the widget's `entitySelectorId` asset-scope binding
> instead, which scopes by the source rtIds via `streamDataArgs.rtIds`
> (see *PersistentQueryDataSource*). The same binding scopes a **runtime
> persistent query** (`rtId IN` field filter, AB#7725) — prefer it over a
> hand-written `$mp_rtId` filter when the query's own entities are the scope.

An explicit `attributeMappings` entry that produces the same variable name wins
(the synthetic `<selectorId>_rtId` is skipped if already present). The variable is
derived at runtime (`source: 'entitySelector'`) and not persisted.

### URL Parameters

Entity selector selections are synced to URL query parameters for bookmarkability and sharing:

```
?es_<selectorId>=<rtId>
```

Example: `?es_mp=rt-123&es_anlage=rt-456`

Followers (AB#7722) are derived from their leader and never serialized; an
`es_<followerId>` param is ignored.

### URL Sync (`meshBoardSyncUrl`, AB#4457)

`MeshBoardViewComponent` syncs the loaded board's rtId into the URL
(`utils/url-sync.ts`, pure + unit-tested) after the initial load
(`buildInitialUrlWithRtId` at the end of `ngOnInit` — the constructor effect
must skip the initial load because `loadInitialMeshBoard` transiently puts up
a different board) and after every post-init board switch:

- Route has an `:rtId` param → last URL segment is replaced (always on).
- Route has no `:rtId` param → appending the rtId is **opt-in** via the
  `meshBoardSyncUrl: true` route data flag, which requires a matching
  `<path>/:rtId` sibling route (see Refinery Studio's `ui/meshboards`).
- Neither → the URL is never rewritten. Appending to a route without an
  `:rtId` variant falls through to the app's `'**'` wildcard (bounce to home,
  e.g. voest-app) or fails with a `NavigationError` (e.g. energy-community).

> **One navigation per URL write (AB#4819).** Concurrent Router navigations
> supersede each other: the later one wins and is computed from the
> pre-navigation state, silently dropping an in-flight rtId path change (the
> URL then keeps the OLD board's rtId — a copied link opens the wrong board).
> Rules encoded in the component: the board-switch effect runs
> `initializeTimeFilterVariables()` first and `updateUrlWithRtId` serializes
> the active tf_* params into the SAME navigation
> (`utils/time-filter-url.ts`); `writeTimeFilterToUrl` /
> `writeEntitySelectorsToUrl` merge onto `router.url` via
> `applyQueryParams` (never `router.navigate([], {relativeTo})`, which
> resurrects the stale path) and skip no-op writes (an identical-URL
> navigation still cancels an in-flight one before being skipped);
> `isSelectionEqual` compares only the fields the selection type uses, because
> the picker pre-fills unused fields with current-date defaults and a
> field-by-field comparison would report equal selections as changed.

### External Embedding via Route Data

When embedding a MeshBoard in another application, entity selectors can be pre-populated via route data:

```typescript
{
  path: 'dashboard/:id',
  component: MeshBoardViewComponent,
  data: {
    entitySelectors: {
      mp: 'rt-123',        // selectorId: rtId
      anlage: 'rt-456'
    }
  }
}
```

**Priority order:** route data > URL params > defaultRtId > selectedRtId

For a follower: the leader's pick (by the order above) > the follower's own
`defaultRtId`; route data and URL params naming the follower are ignored.

### State Service Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getEntitySelectors()` | `EntitySelectorConfig[]` | Get all configured entity selectors |
| `getEntitySelector(selectorId)` | `EntitySelectorConfig \| undefined` | Get specific selector by ID |
| `updateEntitySelectors(selectors)` | `void` | Bulk update selector configs |
| `updateEntitySelectorSelection(selectorId, rtId, displayName?)` | `void` | Update one selector's selection |
| `setEntitySelectorVariables(selectorId, values[])` | `void` | Create/replace variables for a selector |
| `clearEntitySelectorVariables(selectorId)` | `void` | Remove variables for a selector |
| `setEntitySelectorScopePending(selectorId)` | `void` | Mark the scope as resolving |
| `setEntitySelectorRtIds(selectorId, rtIds)` | `void` | Store the resolved source rtIds (transient); `[]` = resolved EMPTY scope |
| `setEntitySelectorScopeFailed(selectorId)` | `void` | Mark the scope resolution as failed |
| `clearEntitySelectorRtIds(selectorId)` | `void` | Clear the scope state of a selector |
| `getEntitySelectorScopeState(selectorId)` | `EntitySelectorScopeState \| undefined` | Raw scope state (`pending` / `resolved` / `failed`), `undefined` = no pick |
| `failedEntitySelectorScopeIds` | `Signal<string[]>` | Selectors whose scope resolution failed (board notice) |
| `resolveStreamDataScope(entitySelectorId?, family?, ignoreTimeFilter?)` | `StreamDataScope` | What a bound widget does — host gate (AB#7582, stream data), then the selector scope; see *Scope resolution contract* |
| `resolveEntitySelectorScope(entitySelectorId?)` | `StreamDataScope` | Selector scope only, runtime and stream data alike (AB#7725) |
| `resolveStreamDataRtIds(entitySelectorId?)` | `string[] \| undefined` | Source rtIds of a `scoped` scope, else `undefined` |
| `setEntitySelectorScopeNeedsPick(selectorId)` | `void` | Dependent without pick while its leader has one (AB#7916): `empty` / `noPick` |
| `needsPickEntitySelectorIds` | `Signal<string[]>` | Selectors in `needsPick` (board notice "Pick a <label> to see this data.", AB#7916) |
| `pickerScopes` | `Signal<Record<string, EntitySelectorScopeState>>` | Picker scopes of dependent selectors (AB#7915); no entry = leader has no pick |
| `setPickerScopePending` / `setPickerScopeRtIds` / `setPickerScopeFailed` / `clearPickerScope` / `getPickerScopeState` | — | Write / read one dependent's picker scope (AB#7915) |

### Components

| Component | Selector | Description |
|-----------|----------|-------------|
| `EntitySelectorEditorComponent` | `mm-entity-selector-editor` | Settings editor for managing selectors |
| `EntitySelectorScopePathEditorComponent` | `mm-entity-selector-scope-path-editor` | Hop list of the selector editor: child scope (AB#7723) and the scope source path with a fixed last target (AB#7917) |
| `EntitySelectorToolbarComponent` | `mm-entity-selector-toolbar` | Toolbar rendering entity select dropdowns |

> **Display names (AB#4813).** The entity pickers (`RuntimeEntitySelectDataSource` /
> `RuntimeEntityDialogDataSource` in `@meshmakers/octo-services`) display and search the
> engine-computed `rtDisplayName` (backend guarantees a value — `"<ckTypeId>@<rtId>"`
> fallback when the CK type declares no `displayNameRule`). The dialog's "Name" column and
> the text search bind to `rtDisplayName`; `rtWellKnownName` remains an identifier and is
> no longer shown as the display name.

### Persistence

Entity selector configs are persisted in the MeshBoard description field alongside variables and time filter config. Transient fields (`selectedRtId`, `selectedDisplayName`) are stripped before persisting. Variables with `source: 'entitySelector'` are derived at runtime and not persisted.

---

## Timezone Mode

`MeshBoardConfig.timeZoneMode` (`'local' | 'utc' | <IANA id>`, default `'local'`) is a **board-level** setting that governs BOTH halves of time handling, keeping them consistent:

1. **Filter boundaries** — `MeshBoardStateService.resolveCurrentTimeRange()` passes the mode to shared-ui's `TimeRangeUtils.getTimeRangeFromSelection(selection, showTime, zone)`. In `'local'` mode "Year 2026" spans the local calendar year; in `'utc'` mode it spans the UTC year; with an IANA id (e.g. `'Europe/Vienna'`) it spans that zone's civil year, DST-correctly and independent of the browser (AB#4190).
2. **Datetime display** — every widget formats timestamps through `utils/meshboard-datetime.ts` (`formatInstant` / `formatBoardDate` / `formatBoardDateTime` / `formatTableCellValue`). `timeZoneOption()` maps the mode to the `Intl` `timeZone` option: `'utc'` → `'UTC'`, `'local'` → `undefined` (browser), an IANA id → itself. The table widget attaches `formatTableCellValue` as a per-column `formatter` so raw ISO-8601 archive cells (e.g. `window_start`/`window_end`) render in the board's zone instead of as raw `…Z` strings.
3. **Resolution-aware series queries (AB#4190)** — the line-chart widget forwards the zone to `resolveSeriesQuery` via `MeshBoardStateService.resolveStreamDataTimeZone()` (`'local'` → `undefined`/UTC, `'utc'` → `'UTC'`, IANA → itself). The backend then selects the calendar rollup whose `ReferenceTimeZone` matches, so the civil-day buckets line up with the window computed on the same zone. `FixedSize` (sub-day) rollups are zone-independent.

Why this matters: a local-year filter selects rows whose UTC timestamps fall in the neighbouring calendar year (CET year 2026 starts at `2025-12-31T23:00:00Z`). Formatting display on the same basis as the filter removes that artifact.

> **Naive wire timestamps are UTC (AB#4818).** The wire serializes instants without a zone
> designator (e.g. downsampling bucket timestamps `2026-08-16T10:50:00`), but `new Date(...)`
> parses such strings as browser-LOCAL time — shifting every timestamp by the UTC offset before
> the board's timezone mode is even applied. `toInstant` therefore pins naive ISO date-time
> strings to UTC; every widget that parses a wire timestamp must route through it (never a bare
> `new Date(...)`).

Consumers read the mode reactively via `MeshBoardStateService.timeZoneMode()` (a computed signal). The setting is edited in the Settings dialog's *Time Filter* tab — Local / UTC / **Specific time zone** (a curated IANA dropdown; any IANA id is accepted) — and persisted in the description blob (any non-default value, i.e. `'utc'` or an IANA id, is written; on load any non-`'local'` string is accepted). Changing it recomputes the active range and refreshes widgets (`MeshBoardViewComponent.reapplyTimeFilterRange()`).

---

## Utility Functions

Pure functions for data transformation (in `utils/widget-data-utils.ts`):

```typescript
import {
  sanitizeFieldName,
  parseNumericValue,
  extractAggregationValue,
  extractGroupedAggregationValue,
  processStaticSeriesData,
  processDynamicSeriesData,
  processPieChartData
} from '@meshmakers/octo-meshboard';

// Sanitize GraphQL attribute paths (dots -> underscores)
sanitizeFieldName('entity.attribute'); // 'entity_attribute'

// Parse numeric values safely
parseNumericValue('42.5'); // 42.5
parseNumericValue(null);   // 0

// Extract values from query results
const value = extractAggregationValue(queryResult, 'sum_revenue');
const groupedValue = extractGroupedAggregationValue(queryResult, 'category', 'A', 'value');

// Process chart data
const barData = processStaticSeriesData(rows, 'month', [
  { field: 'revenue', name: 'Revenue' },
  { field: 'cost', name: 'Cost' }
]);

const pieData = processPieChartData(rows, 'category', 'value');
```

### Cell → field resolution (`matchesAttributePath` vs `findCellForField`)

`matchesAttributePath(cellPath, configField)` answers "could this cell belong to
this field?" — an exact `sanitizeFieldName` match, plus a **loose** canonical
fallback that strips the aggregation suffix off the *cell* (so a legacy config
saved as the bare CK path, e.g. `amount_value`, still matches the wire-form
aggregation cell `amountvalue_sum`).

That loose fallback is intentionally ambiguous: in a grouping-aggregation result
the group-by cell (`state`) coexists with an aggregation cell over the same
attribute (`state_count`), and a bare category config `state` loose-matches
**both**. An extraction loop that assigns on every match let the later
`state_count` cell overwrite the category with the raw count — the pie/bar legend
then showed the count instead of the enum label (**AB#4293**).

**Rule:** when reducing a row's cells to one value per config field, resolve each
field with `findCellForField(cells, configField)` — it prefers an exact
`sanitizeFieldName` match and only falls back to the loose match when no exact
cell exists. Do **not** hand-roll a `for cell … if matchesAttributePath(…)` loop
that writes the category/value on each hit; that reintroduces the AB#4293
overwrite. `processPieChartData` / `processStaticSeriesData` /
`processDynamicSeriesData` / `extractAggregationValue` /
`extractGroupedAggregationValue` and the pie-/bar-chart widget components all use
`findCellForField`. (The line-chart / heatmap widgets keep their own loops on
purpose: their category is a timestamp, and line-chart downsampling maps one
config value field onto *several* cells `<field>_min/_max/_avg`, which a
single-cell resolver would collapse.)

---

## Line-chart resolution-aware fan-out

A `resolutionAware` stream-data line chart resolves the best archive/rollup for the visible window
+ target point count (`QueryExecutorService.resolveSeriesQuery`), then downsamples the sources
against it. Two fan-out shapes (`line-chart-widget.component.ts`):

> **Source scope (AB#4818).** The transient downsampling path bypasses the persisted query
> execution, so the widget must re-apply the query's `System/StreamDataQuery.RtIds` pin itself:
> `fetchQueryArchive` reads the pin from the runtime entity (`runtime.systemSimpleSdQuery.rtIds`)
> alongside the archive metadata, and `loadResolutionAware` scopes with
> `selector rtIds (if any) ?? persisted pin ?? no scope`. Without this, a pinned single-series
> widget silently averages every entity captured by the archive. An active entity-selector
> binding still overrides the pin (the documented `streamDataArgs.rtIds` override semantics).

| `PersistentQueryDataSource` flag | Fan-out | One line per … |
|---|---|---|
| default | `loadPerRtIdRows` — one downsampling call per source rtId | source rtId (labeled from its `seriesGroupField` attribute) |
| `aggregateSeriesByGroup: true` | `loadGroupAggregatedRows` — one call per distinct `seriesGroupField` value, passing the whole group's rtIds | group value (server-side reduced over the group) |

**Why the group mode exists.** When several sources share one `seriesGroupField` value, the default
fan-out produces one line per source, and the widget's client-side grouping then collapses same-group
lines last-write-wins — each line reflects one arbitrary source, not the combined value. Group mode
buckets the source **entities** by their `seriesGroupField` attribute first (via
`QueryExecutorService.fetchEntityGroups`, a single bulk read, canonical field match, population
capped at 5000 with a warn on truncation) and runs one downsampling call per group. The transient
downsampling groups only by time bin, so it reduces (per `requiredAggregation`) over every member —
one aggregate line per group value. The grouping comes from the source entities' attributes because a
rollup archive does not carry the `seriesGroupField` column.

> **Coverage signal (AB#5157).** `SeriesResolutionResult.signal = CoverageLimited` means the
> resolver's coverage filter skipped a finer rung because it holds no measured data over the
> requested window, and `finerRungAvailableFrom` says from when that rung could serve. The widget
> renders it as its own `⚠ no history` badge, checked **before** `ResolutionLimited` in both the
> `resolutionHint` and `resolutionExplanation` switches, and deliberately **not** subject to the
> `RESOLUTION_LIMIT_WARN_PX` density suppression: a dense-looking coarse line is still the wrong
> answer to "where is my history?", so the badge always shows. The badge title names the available-
> from date (formatted in the board's timezone), falling back to the backend diagnostic.

The mechanism is domain-neutral: it groups by whatever `seriesGroupField` / `requiredAggregation`
the widget is configured with. Only meaningful with `resolutionAware`; stream-data only.

---

## Testing

### Test Structure

Tests run on Vitest with Angular TestBed. Mock services appropriately:

```typescript
import type { MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';

describe('MeshBoardStateService', () => {
  let service: MeshBoardStateService;
  let persistenceServiceMock: MockedObject<MeshBoardPersistenceService>;

  beforeEach(() => {
    // A bare object literal is a subset of the class, so cast it — never try to
    // satisfy MockedObject<T> member by member (classes have private fields).
    persistenceServiceMock = {
      getMeshBoards: vi.fn().mockName('getMeshBoards'),
      getMeshBoardWithWidgets: vi.fn().mockName('getMeshBoardWithWidgets'),
      createMeshBoard: vi.fn().mockName('createMeshBoard')
    } as unknown as MockedObject<MeshBoardPersistenceService>;

    TestBed.configureTestingModule({
      providers: [
        MeshBoardStateService,
        { provide: MeshBoardPersistenceService, useValue: persistenceServiceMock },
        { provide: CkModelService, useValue: { isModelAvailableWithMinVersion: vi.fn() } }
      ]
    });

    service = TestBed.inject(MeshBoardStateService);
  });
});
```

Always configure a return value on a mock: unlike Jasmine's `spyOn`, a bare `vi.spyOn`
calls the original implementation through.

### Running Tests

```bash
# Run all octo-meshboard tests (Vitest on jsdom, no browser needed)
npm run test:octo-meshboard

# Run a single spec (path relative to the workspace root)
ng test @meshmakers/octo-meshboard --watch=false --include=projects/meshmakers/octo-meshboard/src/lib/services/meshboard-grid.service.spec.ts

# Run with coverage
ng test @meshmakers/octo-meshboard --watch=false --coverage
```

### Test Coverage

Current test files:
- `meshboard-grid.service.spec.ts` - Grid collision detection (39 tests)
- `meshboard-variable.service.spec.ts` - Variable resolution (67 tests)
- `meshboard-state.service.spec.ts` - State management (includes entity selector management, stream-data time-arg binding and the scope states of AB#7721)
- `meshboard-view.host-time-range.spec.ts` / `host-time-range.spec.ts` - Host-set period and hidden picker (AB#7582): exact instants under process TZ UTC and America/New_York, host wins over tf_*/stored selection, one reload per change, invalid range, disabled filter, destroy during load, owner-aware clearing, `ignoreTimeFilter` not blanked, stale tf_*; parser: RFC 3339 only, calendar-invalid dates and times rejected
- `meshboard-view.entity-selector-scope.spec.ts` - View scope resolution: empty / failed / pending / unscoped picks, URL picks, stale resolutions, clear (AB#7721)
- `meshboard-view.entity-selector-follow.spec.ts` - Leader/follower selectors: follower scope and variables from the leader's pick, two target types, pending, empty, own default, clear, URL restore/write, no picker, unknown leader, stale picks (AB#7722)
- `utils/entity-selector-follow.spec.ts` - Leader resolution, followers, toolbar visibility, editor validation messages (AB#7722)
- `meshboard-persistence.entity-selector-follow.spec.ts` - `followsSelectorId` save/reload and export/import round trip; a pre-AB#7722 description imports and re-encodes byte-identically (AB#7722)
- `entity-selector-editor.component.spec.ts` - Editor "Follows" option: leader list, CK type fixing, validation, list badges, removal confirmation (AB#7722); child scope hop list save forms and validation (AB#7723)
- `utils/entity-selector-scope-path.spec.ts` - Child scope plan, editor mapping, validation, hop-by-hop resolution (AB#7723)
- `meshboard-view.entity-selector-multihop.spec.ts` - Two/three-hop resolution with duplicates, empty and failed hops, invalid path, pending, stale picks, followers, pre-AB#7723 one-hop board (AB#7723)
- `meshboard-persistence.entity-selector-multihop.spec.ts` - `path` save/reload and export/import; a pre-AB#7723 description imports and re-encodes byte-identically (AB#7723)
- `utils/entity-selector-scope-source.spec.ts` - Scope source resolution and every invalid case, dependents, picker states, texts, query wrappers (AB#7915)
- `entity-selector-toolbar.scope-source.spec.ts` - Dependent picker: `rtId IN` on dropdown and dialog, AND with filter rows and search, one hop, no leader pick, pending (no query until settled), empty / failed / invalid texts, leader change, unscoped selectors unchanged (AB#7915)
- `meshboard-view.entity-selector-scope-source.spec.ts` - Picker scope resolution: three batched hops with duplicates, one hop, pending, empty, failed hop, invalid configurations (one warning each), stale leader pick, clear, URL pick on load (AB#7915)
- `meshboard-view.entity-selector-dependent-pick.spec.ts` - Dependent pick lifecycle: keep / default / none on a leader change, pending and exactly one query per bound widget, no pick while the leader has one (no query, notice), persisted scope without leader pick, empty and failed picker scope, leader cleared, URL and route-data validation with `replaceUrl`, host API, two quick leader changes (AB#7916)
- `meshboard-persistence.entity-selector-scope-source.spec.ts` - `scopeSource` save/reload and export/import; a pre-AB#7915 description imports and re-encodes byte-identically (AB#7915)
- `entity-selector-scope-path-editor.component.spec.ts` - Hop list: add/remove/reorder, associations from metadata, "Other role…", warnings, metadata failure, validation, accessibility (AB#7723)
- `widgets/stream-data-scope.widgets.spec.ts` - Line chart, bar chart and table send no query for an empty or pending scope (AB#7721); KPI in `kpi-widget.component.spec.ts`, process binding in `process-data.service.spec.ts`
- `widgets/runtime-scope.widgets.spec.ts` - Runtime and grouping queries follow the selector (AB#7725): table (SimpleRtQuery), bar chart (runtime + stream-data grouping), pie chart, KPI, gauge and stats grid with bound / empty / failed / pending / unbound scopes, spying on the query executor; one table case through the real executor checks the `rtId IN` GraphQL variables
- `query-executor.service.spec.ts` - `scopeRtIds`: runtime `rtId IN` filter AND-combined with the widget filters (also after a legacy family lookup), stream-data `arg.rtIds`, unbound unchanged (AB#7725)
- `default-widget-registrations.spec.ts` - runtime-query binding round trip and byte-identical re-encoding (AB#7725)
- `meshboard-data.service.spec.ts` - Data fetching, incl. batched association hops (AB#7723)
- `widget-registry.service.spec.ts` - Widget registration (45 tests)
- `widget-data-utils.spec.ts` - Utility functions incl. `findCellForField` exact-match priority / AB#4293 regression (65 tests), `formatWidgetNumber` / `getNumberFormat` cache (AB#7686)
- `heatmap-widget.component.spec.ts` - threshold coloring; value formatting byte-identical to the pre-AB#7686 implementation; date source per row type: stream-data rows use the top-level `timestamp` when `dateField` is `timestamp`, runtime rows only their cells (AB#7938)
- `meshboard-formula.spec.ts` - Formula rewrite, validation, evaluation, cycle detection (AB#5364)
- `default-widget-registrations.spec.ts` - KPI dialog-apply + persistence round trip (`comparisonText` AB#5366, formula / output variable AB#5364, `decimalPlaces` AB#7686)
- `kpi-widget.component.spec.ts` - KPI formula value, publishing, chaining, cycles, multiplier before publish, `decimalPlaces` formatting (incl. negative zero)
- `kpi-decimal-places.spec.ts` - `decimalPlaces` normalisation (integer numbers 0-3 only, out-of-range and non-number values)
- `kpi-config-dialog.component.spec.ts` - KPI dialog formula validation, output-name and cycle checks, `decimalPlaces` save
- `components/formula-field/formula-field.component.spec.ts` - shared formula field: preview, syntax / unknown-variable messages, declared names, non-finite and non-numeric preview, clamp hint, insert, label/description wiring (AB#7950)
- `widgets/gauge-widget/gauge-widget.formula.spec.ts` - gauge formula: ok, same value as the KPI, live updates, pending, error, non-numeric, non-finite tooltip, clamping, config change, existing gauges unchanged (AB#7950)
- `widgets/gauge-widget/gauge-config-dialog.formula.spec.ts` / `gauge-config-dialog.formula-render.spec.ts` - gauge dialog Formula source: validation, Save state, result, rendered button/field/Save, keyboard reachability (AB#7950)
- `registrations/default-widget-registrations.gauge-formula.spec.ts` - gauge formula round trip, switching clears, legacy gauges encode/load unchanged (AB#7950)
- `widget-group-config-dialog.component.spec.ts` - widget-group dialog: KPI child `decimalPlaces` read, save, out-of-range (AB#7686)
- `association-targets-cache.spec.ts` - `getAssociationTargets` selects `rtId` on every entity row; round trip through a cache keyed by `rtId` (AB#7649)
- `url-sync.spec.ts` - URL sync on board switch: `:rtId` replace, `meshBoardSyncUrl` opt-in append, no-rewrite default (AB#4457)
- `utils/meshboard-language.spec.ts` - `MESHBOARD_LANGUAGE` source (fixed / signal / absent), culture keys, lookup order (AB#7655)
- `widgets/table-widget/table-column-labels.spec.ts` - column `titles` / `valueLabels` resolution, malformed entries, dialog column merge (AB#7655)
- `widgets/table-widget/table-widget.labels.spec.ts` - headers follow the host language without refetch, value-label cells, one warning per column, numeric enum cells for the resolver (AB#7655)
- `widgets/table-widget/table-config-dialog.preserve-columns.spec.ts` - the table config dialog and registration keep authored columns on save and reload (AB#7655)

## Table column titles per language and value labels (AB#7655)

- The host language comes only from `MESHBOARD_LANGUAGE` (`provideMeshBoard({ language })`, `provideMeshBoardLanguage`),
  `utils/meshboard-language.ts`; never from `LOCALE_ID` (decided by Odin 2026-10-27).
- Pure resolution in `widgets/table-widget/table-column-labels.ts`; `TableWidgetComponent.listViewColumns` reads the
  language signal, so a language switch only rebuilds the column definitions (no refetch).
- Value-label cells are `dataType: 'component'` columns rendering `TableValueLabelCellComponent` (plain text, optional
  colour) — deliberately not the list view's badge, so the cells look like every other cell and `null` stays empty.
- The table config dialog must never rebuild columns it did not change (`mergeRuntimeEntityColumns`,
  `mergePersistentQueryColumns`); `applyConfigResult` takes `result.columns` for persistent-query tables.
  On the same query the dialog loads the query's current fields once (`loadQueryFields`) and drops kept
  columns the query no longer returns, adding its other fields as derived columns; a failed lookup keeps
  the columns unchanged.
- `resolveValueLabels` returns `null` when no label applies for the current language, so the column keeps
  its `dataType` rendering and the label resolver. Unlabelled values of a label column go through
  `formatUnlabelledValue` (`number` / `date` pipe semantics with `LOCALE_ID`). `valueLabels` with
  `statusMapping` is unsupported (warning).
- `config` is a plain `@Input`; `listViewColumns` / `columnsReady` read `_configVersion`, bumped in
  `ngOnChanges`, so a new config on the same instance recomputes them.
- `warnOnce` keys are `<widget id or per-instance key>|<field>|<hash of the problem list>`.

---

## GraphQL Queries

Located in `src/lib/graphQL/`:

| File | Description |
|------|-------------|
| `getDashboards.ts` | List MeshBoards |
| `getDashboardWithWidgets.ts` | MeshBoard with widget details |
| `createDashboard.ts` | Create MeshBoard |
| `updateDashboard.ts` | Update MeshBoard |
| `createDashboardWidget.ts` | Create widget |
| `updateDashboardWidget.ts` | Update widget |
| `deleteEntities.ts` | Delete entities |
| `executeRuntimeQuery.ts` | Execute persistent query |
| `getSystemPersistentQueries.ts` | List available queries |
| `getDashboardEntity.ts` | Fetch single entity |
| `getEntitiesByCkType.ts` | Fetch entities by type |
| `getCkModelsWithState.ts` | CK models with state |
| `getAssociationTargets.ts` | Association targets of one entity (with attributes); one-hop child scope |
| `getAssociationTargetRtIds.ts` | Batched association hop: target rtIds of many entities (multi-hop child scope, AB#7723) |
| `getCkTypeAssociationRoles.ts` | Associations of a CK type (association widget dialog, child scope hop list) |

---

## Theming / CSS Hooks for Host Applications

The MeshBoard library uses **neutral, theme-agnostic defaults**. Host applications can style all buttons consistently using standardized CSS classes exposed by the library.

### Standard CSS Classes

| CSS Class | Applied To | Purpose |
|-----------|-----------|---------|
| `mm-dialog-actions` | All dialog footer button containers (Save/Cancel) | Style dialog action buttons |
| `mm-toolbar-actions` | MeshBoard toolbar button area | Style toolbar buttons |

These classes are present on **every** dialog and toolbar in the library, providing a single CSS hook for consistent theming.

`mm-dialog-actions` is also the **layout** hook (AB#6464): the dialog footer look - right-aligned, 34 px
buttons, `--theme-space-2` gap, divider and padding, danger fill for `themeColor="error"` - is defined once
in the octo-ui styles (`dialog-actions` mixin, included by `octo.styles()`). Dialog components write
`<div class="mm-dialog-actions">` (or `<kendo-dialog-actions>` with `MmDialogActionsDirective` from
`@meshmakers/shared-ui`) and **no footer CSS of their own**; a guard spec in shared-ui
(`dialog-actions.guard.spec.ts`) fails the build otherwise.

### Button Patterns

All MeshBoard buttons follow these Kendo conventions:

| Button Role | Kendo Attributes | Kendo CSS Class |
|-------------|------------------|-----------------|
| Primary action (Save, Add, Create) | `themeColor="primary"` | `.k-button-solid-primary` |
| Secondary action (Cancel, Close) | `fillMode="flat"` | `.k-button-flat` |
| Icon button (edit, delete, gear) | `fillMode="flat"` + `[svgIcon]` | `.k-button-flat` |
| Toggle button (mode selector) | `[fillMode]="condition ? 'solid' : 'outline'"` | `.k-button-solid` / `.k-button-outline` |

### Host App Styling Example

```scss
// Style all MeshBoard dialog buttons (inside Kendo Windows)
.k-window-content .mm-dialog-actions .k-button {
  // Your button base styles here
}

// Style primary action buttons specifically
.k-window-content .mm-dialog-actions .k-button-solid-primary {
  background: linear-gradient(180deg, rgba($accent, 0.3), rgba($accent, 0.15));
  border: 1px solid rgba($accent, 0.5);
  color: #ffffff;
}

// Style secondary/cancel buttons
.k-window-content .mm-dialog-actions .k-button-flat {
  background: transparent;
  border: 1px solid rgba($accent, 0.3);
  color: $accent;
}

// Style MeshBoard toolbar buttons
.mm-toolbar-actions .k-button {
  // Your toolbar button styles
}
```

### Legacy CSS Classes (backward compatible)

The original class names remain for backward compatibility:

| Legacy Class | Standard Class |
|-------------|----------------|
| `action-bar` | `mm-dialog-actions` |
| `dialog-actions` | `mm-dialog-actions` |
| `edit-actions` | `mm-dialog-actions` |
| `toolbar-right` | `mm-toolbar-actions` |

---

## Dependencies

- `@angular/core` - Angular framework
- `@progress/kendo-angular-grid` - Kendo Grid
- `@progress/kendo-angular-charts` - Kendo Charts
- `@progress/kendo-angular-gauges` - Kendo Gauges
- `@progress/kendo-angular-dialog` - Kendo Dialog
- `@progress/kendo-angular-buttons` - Kendo Buttons
- `@progress/kendo-angular-inputs` - Kendo Inputs
- `apollo-angular` - GraphQL client
- `@meshmakers/octo-services` - Backend services, DTOs
- `@meshmakers/octo-ui` - UI components, CK type selector
- `@meshmakers/shared-ui` - Shared UI utilities

---

## Chart redraw stability (AB#5568)

Kendo charts redraw — and re-run their series animation — whenever a bound input gets a new
reference. The pie / donut looped (tiny → full size) while hovered: tooltips mutate `<html>`,
which bumped the theme version, and the inline `[plotArea]="{ … margin: plotAreaMargin() }"`
literal was a new object on every change detection. Rules:

- `observeThemeChanges` fires only when `themeSignature()` changes (`data-theme`, OS scheme,
  resolved status colours) — never on bare `class` / `style` mutations of `<html>`.
- Data `computed`s bound to `[data]` use `{ equal: sameChartItems }` so equal values keep the array.
- Never bind object literals containing method calls that return new objects to chart inputs;
  return constant objects (`PieChartWidgetComponent.plotArea()`). A template literal over
  primitive signal values (`{ color: chartTheme().text }`) is fine: Angular memoizes it on the
  values, so it only changes when a colour changes.
- **Live theme switch:** Kendo reads its chart theme from the DOM once per page load, so legend,
  axis and data labels kept the load-time (e.g. dark) colours after Dark → Light until reload.
  Every chart widget takes `chartTheme = injectChartTheme()` (`utils/chart-theme.ts`: a signal of
  `chartThemeColors()` — `text` / `muted` / `grid` from `--theme-text-secondary`,
  `--theme-text-muted`, `--theme-border-subtle` with Kendo-token and neutral fallbacks) and binds
  the colours into legend labels, axis labels / titles, grid lines and series labels. The signal
  emits a new object only when `themeSignature()` (which includes these colours) changes.
- Pinned in `utils/chart-categories.spec.ts`, `utils/chart-theme.spec.ts` and the pie spec. The
  cockpit KPI sparkline is plain SVG with CSS variables and needs no theme observer.

---

## Cockpit Widgets (AB#5558)

`src/lib/cockpit/` — the Home cockpit elements of the Refinery Studio (AB#5545) as widget types
(`attentionList`, `adapterStatus`, `ckModelState`, `pipelineExecutions`) plus the per-user
`recentItems` list; catalogue and host setup in the README ("Cockpit Widgets").

```
cockpit/
├── cockpit-host.ts                  # COCKPIT_VIEWER_ACCESS / COCKPIT_LINK_RESOLVER / COCKPIT_EXPLAIN_HANDLER / COCKPIT_RECENT_ITEMS, provideCockpitWidgetHost
├── cockpit-context.service.ts       # tenant, allows(roles, models) (fails closed), resolveLink, explain
├── cockpit-widget-registrations.ts  # registerCockpitWidgets / provideCockpitWidgets (+ built-in providers)
├── attention/                       # AttentionProvider contract, CockpitAttentionService, providers/
├── data/                            # adapter states + CK model counts (10 s per-tenant share)
├── kpi/                             # pure KPI mapping (adapterKpi, executionKpi, ckModelKpi, sparklineGeometry) + CockpitKpiService
└── widgets/                         # AttentionListWidget, CockpitKpiWidget (one component for 3 types), RecentItemsWidget, config dialogs, shared styles
```

- **Shared rules live here now.** `utils/adapter-online.ts` (THE adapter online rule) and
  `utils/pipeline-executions.ts` (24 h histogram + execution counting) moved from the Studio, which
  re-exports them; change them here only. Since AB#5583 the backend's `hourlyBuckets` hold every
  counted execution and `last24Hours*` = the sum of the 24 clock-hour buckets ending with the hour
  of `lastUpdatedAt`: `buildHourlyHistogram` adds nothing to the current bar (the old numeric
  seed arguments are ignored) and ends the bars with the hour of `options.anchor`
  (`lastUpdatedAt`, newest over pipelines via `latestStatisticsUpdate`) when that is less than an
  hour from now; `countPipelineExecutions` adds a latest execution only when it started after
  both `lastUpdatedAt` and `lastExecutionAt` (only `lastExecutionAt` when the field is missing).
- **Gating.** Every provider / KPI checks the roles + CK models needed to open what it links to,
  before any request. Missing `COCKPIT_VIEWER_ACCESS` = no role = hidden.
- **Viewer-dependent collapse.** Non-builders get "Not available" (never role text) and the widget
  calls `MeshBoardStateService.setWidgetHiddenForViewer`; `MeshBoardViewComponent.visibleWidgets`
  drops such widgets outside edit mode and closes empty rows (`utils/compact-layout.ts`
  `collapseEmptyRows`, presentation only). The flag set is cleared on board switch.
- **Recent items** (`recentItems`) is per user: the board stores only `maxItems` (default 8,
  clamped 1–20); one compact line per entry (label, muted kind, relative time), so eight rows fit
  a 2-row tile (AB#5558); rows come from the host's `COCKPIT_RECENT_ITEMS` source (`items(limit)`, `open`,
  optional `revision` signal / `openPalette`). The library never imports host code; the host
  re-checks visibility and owns navigation (real `href` + `open` on a plain left click). No
  source = "Not available" + collapsed. It is **not** in `COCKPIT_WIDGET_TYPES` (those are the
  health widgets hosts use to decide on their fallbacks).
- **Persistence** is `dataSourceType: 'static'` + small JSON (`providerIds` omitted for "all",
  never an empty array; unknown provider ids are ignored at run time). The parser tolerates
  foreign values (wrong types → defaults).
- **Seed contract.** `cockpit-widget-registrations.spec.ts` holds the TenantCockpit seed rows as
  a fixture, checks they deserialize/serialize identically and do not overlap, and compares the
  fixture with the real seed when `../../../octo-platform-services` exists (worktree pair).
- Tests: `attention.spec.ts`, `providers/attention-providers.spec.ts`, `kpi/cockpit-kpi.spec.ts`,
  `data/cockpit-data.spec.ts`, `widgets/cockpit-widgets.spec.ts`, `widgets/recent-items-widget.spec.ts`, `cockpit-widget-registrations.spec.ts`,
  `utils/adapter-online.spec.ts`, `utils/pipeline-executions.spec.ts`.

---

## Process Designer

The Process Designer widget is documented in the parent `frontend-libraries/CLAUDE.md` file. See sections:
- Process Designer Overview
- Key Components and Services
- SVG Import
- Primitive Types
- Grouping
