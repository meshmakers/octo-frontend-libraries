# OctoMesh MeshBoard Library

A flexible, widget-based dashboard library for Angular applications in the OctoMesh platform.

## Overview

MeshBoard provides a grid-based dashboard system with configurable widgets that can display data from various sources including runtime entities, persistent queries, and aggregations.

## Installation

```bash
npm install @meshmakers/octo-meshboard
```

## Quick Start

### Basic Integration

Add the MeshBoard route to your application:

```typescript
import { Routes } from '@angular/router';
import { UnsavedChangesGuard } from '@meshmakers/shared-ui';

export const routes: Routes = [
  {
    path: "dashboard",
    loadComponent: () =>
      import('@meshmakers/octo-meshboard').then(m => m.MeshBoardViewComponent),
    canDeactivate: [UnsavedChangesGuard]
  }
];
```

### Load Specific MeshBoard by rtId

```typescript
{
  path: "dashboard/:rtId",
  loadComponent: () =>
    import('@meshmakers/octo-meshboard').then(m => m.MeshBoardViewComponent),
  canDeactivate: [UnsavedChangesGuard]
}
```

### Load MeshBoard by Well-Known Name

Use `meshBoardWellKnownName` in route data to load a specific MeshBoard:

```typescript
{
  path: "cockpit",
  loadComponent: () =>
    import('@meshmakers/octo-meshboard').then(m => m.MeshBoardViewComponent),
  canDeactivate: [UnsavedChangesGuard],
  data: {
    meshBoardWellKnownName: 'cockpit',
    breadcrumb: [{ label: "Cockpit", url: "cockpit" }]
  }
}
```

**Note:** If the MeshBoard with the specified `rtWellKnownName` does not exist, an error message will be displayed with instructions on how to create it.

### Setting the Well-Known Name

To set a Well-Known Name for a MeshBoard:

1. Open the MeshBoard Settings dialog
2. Enter a unique identifier in the "Well-Known Name" field (e.g., `cockpit`, `sales-dashboard`)
3. Save the MeshBoard

The Well-Known Name should be lowercase with hyphens, similar to URL slugs.

### Open in edit mode (`?edit=1`)

A `?edit=1` query parameter opens the board in edit mode once it has loaded (e.g. the "Edit"
action of a host's board list: `/ui/meshboards/<rtId>?edit=1`, constant
`MESHBOARD_EDIT_QUERY_PARAM`). It is ignored on routes with `meshBoardReadonly: true`. After
entering edit mode the view removes the parameter from the URL (`replaceUrl`), so a reload or a
copied link does not re-enter edit mode. Hosts creating boards use `newMeshBoardConfig(name)`
for the layout defaults (the same `MeshBoardStateService.createNewMeshBoard` uses).

### Header mode (`headerMode` / `meshBoardHeaderMode`)

How much of its header the view shows is decided by the **host page**, not by the board: the
same board appears with its name in a board designer list and without it on a page that
already names it (e.g. a Home tab under a greeting).

| Mode | Shows |
|------|-------|
| `full` (default) | Board name, description and the controls |
| `compact` | Only the controls (time filter, entity selectors, refresh; on editable boards also manager, settings, edit, add widget, save) in a slim row aligned right, without its own bar background |
| `none` | No header row — for hosts that offer their own controls |

Hints (unselected entity selectors, variable resolution errors) and the "MeshBoard Not Found" /
"MeshBoard Not Available" help are shown in every mode.

Bind the input when embedding the view in a template, or set the route data key when a route
loads the view directly (the bound input wins; unknown values fall back to `full`):

```html
<mm-meshboard-view headerMode="compact"></mm-meshboard-view>
```

```typescript
{
  path: "boards/:rtId",
  loadComponent: () =>
    import('@meshmakers/octo-meshboard').then(m => m.MeshBoardViewComponent),
  data: { meshBoardReadonly: true, meshBoardHeaderMode: 'compact' }
}
```

There is deliberately no per-board setting: a board stored with "no header" would lose its
name in the designer, where the name is the only orientation. Exported helpers:
`MeshBoardHeaderMode`, `MESHBOARD_HEADER_MODE_ROUTE_DATA`, `resolveMeshBoardHeaderMode`.

### Chrome (`chrome` / `meshBoardChrome`)

Whether the view draws its own **outer frame** is also decided by the host page:

| Chrome | Draws |
|--------|-------|
| `framed` (default) | The view background, the header bar (background and bottom border) and the padding around the widget grid — for a page that is only the board |
| `plain` | None of these: the widgets sit directly on the host surface and line up with the host page's gutter. For hosts that already provide the surface and the gutter (e.g. a Home tab), so there is no frame inside the page and no double gutter |

The widget frames (tile border, background, shadow, header) and the gap between the widgets are
the same in both. Like the header mode, bind the input or set the route data key (the bound
input wins; unknown values fall back to `framed`). Plain usually goes together with a compact
header:

```html
<mm-meshboard-view headerMode="compact" chrome="plain"></mm-meshboard-view>
```

```typescript
data: { meshBoardReadonly: true, meshBoardHeaderMode: 'compact', meshBoardChrome: 'plain' }
```

With `plain` the host is responsible for the gutter: a route that loads the view directly into
an unpadded outlet should wrap it in a padded page instead. Exported helpers: `MeshBoardChrome`,
`MESHBOARD_CHROME_ROUTE_DATA`, `resolveMeshBoardChrome`.

### URL Sync (`meshBoardSyncUrl`)

After the initial load and after every post-init board switch (e.g. via the
manager dialog), the view syncs the loaded board's rtId into the URL:

- If the active route has an `:rtId` param, the last URL segment is replaced —
  always enabled, no configuration needed.
- If the route has **no** `:rtId` param, appending the rtId is **opt-in** via
  the `meshBoardSyncUrl: true` route data flag. Only set it when a matching
  `<path>/:rtId` sibling route exists:

```typescript
{
  path: "meshboards",
  loadComponent: () =>
    import('@meshmakers/octo-meshboard').then(m => m.MeshBoardViewComponent),
  data: { meshBoardSyncUrl: true }
},
{
  path: "meshboards/:rtId",
  loadComponent: () =>
    import('@meshmakers/octo-meshboard').then(m => m.MeshBoardViewComponent)
}
```

Without the flag, embedded boards (e.g. readonly `meshBoardWellKnownName`
routes) never rewrite the URL. Appending an rtId to a route without an
`:rtId` variant would fall through to the app's `'**'` wildcard route (bouncing
the user back to home) or fail with a `NavigationError` (AB#4457).

### Pinning MeshBoards to the host navigation

The MeshBoard manager dialog offers a pin toggle per board. A pinned board is
meant to appear in the host application's end-user navigation (the Refinery
Studio Home mode lists pinned boards next to its Cockpit).
Pinning does not change who may *open* a board — the host's routes decide that.

The flag is stored with the other encoded board settings in the description
blob (`navigation: { pinned: true, order?: number }`), so no CK change is
needed. Host apps read it from a board's raw description:

```typescript
import { readMeshBoardNavigation, compareMeshBoardNavigation } from '@meshmakers/octo-meshboard';

const pinned = boards
  .map(b => ({ ...b, navigation: readMeshBoardNavigation(b.description) }))
  .filter(b => b.navigation?.pinned)
  .sort(compareMeshBoardNavigation);
```

`MeshBoardStateService.setMeshBoardPinned(rtId, pinned)` toggles the flag and
keeps every other encoded setting (variables, time filter, auto-refresh, …).

## Architecture

```
octo-meshboard/
├── containers/
│   └── meshboard-view/          # Main view component
├── widgets/                      # Widget implementations
│   ├── bar-chart-widget/         # Bar/Column/Stacked charts
│   ├── entity-associations-widget/ # Entity with relationships
│   ├── entity-card-widget/       # Single entity display (UML-style)
│   ├── gauge-widget/             # Arc, Circular, Linear, Radial gauges
│   ├── kpi-widget/               # Single numeric value with trend
│   ├── markdown-widget/          # Static markdown content with themed prose
│   ├── pie-chart-widget/         # Pie/Donut charts
│   ├── process-widget/           # Process diagram / HMI editor
│   ├── service-health-widget/    # Backend service health monitoring
│   ├── stats-grid-widget/        # Multiple KPIs in grid layout
│   ├── status-indicator-widget/  # Traffic light status
│   └── table-widget/             # Data grid with pagination
├── services/
│   ├── meshboard-state.service.ts      # State management
│   ├── meshboard-data.service.ts       # Data fetching
│   ├── meshboard-persistence.service.ts # Backend persistence
│   ├── meshboard-variable.service.ts   # Variable resolution
│   ├── widget-factory.service.ts       # Widget creation
│   └── widget-registry.service.ts      # Widget registration
├── dialogs/                      # Configuration dialogs
├── models/                       # TypeScript interfaces
└── graphQL/                      # GraphQL queries/mutations
```

## Widget Types

### KPI Widget
Displays a single value with optional label, prefix, suffix, and trend indicator.

```typescript
interface KpiWidgetConfig {
  type: 'kpi';
  valueAttribute: string;
  labelAttribute?: string;
  prefix?: string;
  suffix?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  // For persistent query mode
  queryMode?: 'simpleCount' | 'aggregation' | 'groupedAggregation';
  queryValueField?: string;
  filters?: WidgetFilterConfig[];
}
```

### Gauge Widget
Displays a numeric value as arc, circular, linear, or radial gauge.

```typescript
interface GaugeWidgetConfig {
  type: 'gauge';
  gaugeType: 'arc' | 'circular' | 'linear' | 'radial';
  valueAttribute: string;
  min?: number;
  max?: number;
  ranges?: GaugeRange[];
  showLabel?: boolean;
  prefix?: string;
  suffix?: string;
}
```

### Table Widget
Displays data in a configurable table with sorting and filtering.

```typescript
interface TableWidgetConfig {
  type: 'table';
  columns: TableColumn[];
  sorting?: TableSortConfig[];
  filters?: WidgetFilterConfig[];
  pageSize?: number;
  sortable?: boolean;
}
```

**Texts (AB#5622).** The list inside the table (`mm-list-view`) takes its texts from
`MESHBOARD_MESSAGES` — "No records available.", pager texts, toolbar labels — merged over the
English defaults; the host sets them once (fixed object or a signal for a runtime language switch):

```typescript
providers: [
  provideMeshBoard({ messages: { tableList: { noRecords: 'Keine Einträge vorhanden.', pagerItemsPerPage: 'Einträge pro Seite' } } }),
  // or, when the widgets are registered lazily (no provideMeshBoard()):
  provideMeshBoardMessages(appMeshBoardMessages),
]
```

`tableNotConfigured` translates the placeholder of an unconfigured table.

**Enum labels (AB#5622).** `MESHBOARD_LABEL_RESOLVER` (same pattern as the entity forms'
`ENTITY_FORM_LABEL_RESOLVER`) translates enum values: `(request) => string | null | undefined`
with `request = { kind: 'tableCell' | 'chartCategory', ckTypeId?, attribute, value, valueType?,
defaultText }`; `null` / `undefined` / `''` keep `defaultText` (today's text), a throwing resolver
is logged once and ignored. Tables offer string cells of text columns (persistent-query columns
only when their value type is `ENUM`); pie / donut charts offer every category — the resolved text
is the slice name in data labels, legend and tooltips, the status colour still follows the raw
value. A resolver that reads a signal re-labels the charts when it changes.

### Pie Chart Widget
Displays data as pie or donut chart.

```typescript
interface PieChartWidgetConfig {
  type: 'pieChart';
  chartType: 'pie' | 'donut';
  categoryField: string;
  valueField: string;
  showLabels?: boolean;
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  filters?: WidgetFilterConfig[];
  categoryColors?: Record<string, string>;            // AB#5622
  labelPosition?: 'inside' | 'outside' | 'none';      // AB#5622
  hideLabelsBelowPercent?: number;                    // AB#5622
}
```

Colours and labels (AB#5622): every slice gets an explicit colour — a `categoryColors` entry
(key = raw category value, case-insensitive, or the displayed label; value = hex / CSS colour,
custom property `--brand-paid` / `var(--brand-paid, #2fb37a)`, or a status name `success` /
`warning` / `error` / `info`), else the status colour of a well-known state, else the theme
palette colour of its position (`chartSeriesColors()`: `--theme-chart-1…12`, then
`--kendo-chart-series-1…12`, then `--kendo-color-series-a…f`, then a fixed palette; unresolved or
invalid tokens are skipped, so no slice falls back to black in dark mode). The palette is part of
the theme signature, so a live theme switch re-colours the chart without a redraw loop.
`labelPosition` (labels mode only) maps to Kendo `outsideEnd` (theme-coloured connector lines) /
`insideEnd` / hidden; `hideLabelsBelowPercent` drops the labels of small slices so neighbours do
not overlap. All three are optional, written to the board JSON only when set, and edited in the
config dialog (Label Position, Hide labels below, Category Colours).

Display rules (`utils/chart-categories.ts`): enum-style categories read as words (`RESOLVE_FAILED` →
"Resolve failed"); well-known state categories get the theme status colours (`--theme-status-*`,
then `--kendo-color-*`; e.g. Resolve failed / Error → error, Available / Online → success,
Pending → warning); a `left` / `right` legend moves below the chart while the widget is narrower
than 420 px; the 30 px plot margin is only reserved while labels are shown; legend text is 12 px.
The status table (`STATE_STATUS_BY_KEY`, `categoryStatus`, `humanizeCategory`, `statusColor`) is
exported for hosts so enum chips elsewhere read the same; the colours are resolved again on every
theme switch (`observeThemeChanges`: `<html data-theme|class|style>`, OS colour scheme).

### Bar Chart Widget
Displays data as column, bar, or stacked charts.

```typescript
interface BarChartWidgetConfig {
  type: 'barChart';
  chartType: 'column' | 'bar' | 'stackedColumn' | 'stackedBar' | 'stackedColumn100' | 'stackedBar100';
  categoryField: string;
  series: BarChartSeries[];
  // Dynamic series mode
  seriesGroupField?: string;
  valueField?: string;
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  filters?: WidgetFilterConfig[];
}
```

### Stats Grid Widget
Displays multiple KPIs in a grid layout.

```typescript
interface StatsGridWidgetConfig {
  type: 'statsGrid';
  stats: StatItem[];
  columns?: number;
}
```

### Service Health Widget
Displays service health status with pulse animation.

```typescript
interface ServiceHealthWidgetConfig {
  type: 'serviceHealth';
  navigateOnClick?: boolean;
  detailRoute?: string;
  showPulse?: boolean;
}
```

### Status Indicator Widget
Displays boolean status (e.g., ENABLED/DISABLED).

```typescript
interface StatusIndicatorWidgetConfig {
  type: 'statusIndicator';
  trueLabel?: string;
  falseLabel?: string;
  trueColor?: string;
  falseColor?: string;
}
```

### Markdown Widget
Displays static markdown content with themed prose styling. Supports variable interpolation.

```typescript
interface MarkdownWidgetConfig {
  type: 'markdown';
  content: string;
  resolveVariables?: boolean;
  padding?: string;
  textAlign?: 'left' | 'center' | 'right';
}
```

`ngx-markdown`/`marked` are loaded lazily on first render (`LazyMarkdownComponent`), so they stay out of the
initial bundle. No root `provideMarkdown()` is needed; if the application provides one, its configuration is used.

### Entity Card Widget
Displays a single runtime entity in a UML-style card.

```typescript
interface EntityCardWidgetConfig {
  type: 'entityCard';
  attributePaths?: string[];
  showCkType?: boolean;
}
```

### Entity With Associations Widget
Displays a runtime entity together with its associated entities.

```typescript
interface EntityWithAssociationsWidgetConfig {
  type: 'entityWithAssociations';
  attributePaths?: string[];
  includeAssociations?: boolean;
}
```

### Cockpit Widgets (AB#5558)

Platform health widgets that used to be hard-wired on the Refinery Studio's Home cockpit. They
have **no configurable data source** (persisted as `dataSourceType: 'static'`); they read fixed
platform data and run every check only for viewers with the roles / CK models it needs.
Registered separately — not by `provideMeshBoard()` — because they need host services:

```typescript
providers: [
  provideMeshBoard(),
  provideCockpitWidgets(),                       // registers the 5 types + built-in checks
  provideCockpitWidgetHost({
    access: () => { const auth = inject(AuthorizeService); return { isInRole: r => auth.isInRole(r) }; },
    links: () => myLinkResolver,                 // CockpitLinkTarget -> app URL (or null)
    explain: () => myAssistantBridge,            // optional "✦ Explain"
    recents: () => myRecentItemsSource,          // optional, feeds "Recent items"
    messages: () => myCockpitTexts               // optional translations (object or signal), AB#5622
  }),
  // optional host checks
  { provide: COCKPIT_ATTENTION_PROVIDERS, useClass: MyCheck, multi: true }
]
```

| Type | Label | Shows | Gate (per check / KPI) | Persisted `config` |
|------|-------|-------|------------------------|--------------------|
| `attentionList` | Attention List | Findings, errors first: CK models in ResolveFailed, adapters in error / offline > 10 min, failed pipeline executions in 24 h above a threshold, deployment sites not registered (provider id `pools-unregistered`, kept stable for persisted `providerIds`), features enabled but not installed, plus host checks (Refinery Studio: secrets needing re-entry) | each provider: AdminPanelManagement / CommunicationManagement + `System.Communication` / TenantManagement | `{ "providerIds"?: string[], "maxItems"?: number, "showExplain"?: boolean }` — no `providerIds` = all checks, including ones added later |
| `adapterStatus` | Adapter Status | Adapters online / expected to run (shared rule `utils/adapter-online.ts`) | CommunicationManagement + `System.Communication` | `{ "showDetail"?: boolean }` |
| `ckModelState` | CK Model State | CK models available / all; ResolveFailed = error, importing = warning | AdminPanelManagement | `{ "showDetail"?: boolean }` |
| `recentItems` | Recent Items | The viewer's recently opened pages, entities and boards (most recent first, glyph, kind, relative time as `<time>`), real links; optional "⌘K shows the same list" | none — per user, from the host's `COCKPIT_RECENT_ITEMS`; without it "Not available" + collapsed | `{ "maxItems"?: number }` (default 8, 1–20) |
| `pipelineExecutions` | Pipeline Executions 24 h | Executions of all data flows, failed count, hourly sparkline (same counting as the Studio's Data Flows list) | CommunicationManagement + `System.Communication` | `{ "showDetail"?: boolean, "showSparkline"?: boolean }` |
| `tenantCount` | Tenants | Child tenants of the tenant (on the system tenant: all tenants), first ids; links `tenants` | TenantManagement | `{ "showDetail"?: boolean }` |
| `blueprintUpdates` | Blueprint Updates | Installed blueprints with a newer catalog version (warning); service-managed `System.*` ones only in the detail; links `blueprints` | AdminPanelManagement | `{ "showDetail"?: boolean }` |
| `servicesHealth` | Services Healthy | Identity, Asset Repository, Bot, Communication Controller (when installed) healthy / all; unhealthy or silent = error, degraded = warning; links `serviceHealth` of the first problem | none | `{ "showDetail"?: boolean }` |
| `versionInfo` | Version | The host's versions (`COCKPIT_VERSION_SOURCE` / `provideCockpitWidgetHost({ versions })`), first = value; no link | none — without the source "Not available" + collapsed | `{ "showDetail"?: boolean }` |

- **Role abstraction.** The library never imports the host's auth: `COCKPIT_VIEWER_ACCESS`
  (`isInRole(role)`) answers role checks, `CkModelService.isModelAvailable` the CK models.
  Without the token every gated check fails closed (hidden). A KPI the viewer may not see sends no
  request. **Builders** (`CockpitViewerAccess.isBuilder()`, host-defined) see *why* ("Needs the
  CommunicationManagement role…" / "No health checks are available for your role"); **other
  viewers** see a neutral "Not available" without role details, and the widget reports
  `setWidgetHiddenForViewer(id, true)` so the board collapses it outside edit mode (empty rows
  close up, `collapseEmptyRows`). An attention list never claims "All clear" without visible checks.
- **Errors** never show raw messages: tiles say "The figure could not be loaded." (details in the console).
- **Links.** Findings and KPI tiles carry semantic `CockpitLinkTarget`s (`adapter`, `adapters`,
  `deployment-site`, `deployment-sites`, `dataFlows`, `ckModels`, `tenantSettings`, `secretsReEntry`;
  `pool` / `pools` are the deprecated pre-System.Communication-4.x aliases); the host's
  `COCKPIT_LINK_RESOLVER` maps them to URLs, `null` drops the chip. When the resolver answers `null`
  for a deployment-site kind, the context asks once more with the legacy alias
  (`legacyCockpitLinkTarget`), so hosts that only map `pool` / `pools` keep their links (AB#5842). Host providers may also link
  straight to their own pages (AB#5622): `{ kind: 'route', path, queryParams? }` — `path` is a URL
  path or router commands (`['/', tenantId, 'documents']`), navigated with `routerLink` +
  `queryParams`; relative paths resolve against the route that renders the board. The resolver
  sees route targets too and may return a rewritten path (e.g. with the tenant/language prefix);
  `null` keeps `path`. Route targets stay in the app: a `path` with a URL scheme or a
  protocol-relative start (`//host`) is dropped. `CockpitContextService.resolveLinkTarget()` returns `{ path, queryParams }`
  for custom renderings; `resolveLink()` a URL string with the query appended.
- **Counts.** `AttentionFinding.count?: number` (AB#5622) renders a badge next to the title
  (formatted in `numberLocale`); without it nothing changes. Of the built-in checks only "Failed
  pipeline executions" sets it — the others name the count in their titles.
- **Texts (i18n, AB#5622).** Every widget text (severity chips, empty / loading / unavailable
  states, KPI labels, statuses and details, recent-items wording and relative times) comes from
  `CockpitWidgetMessages` with English defaults (`DEFAULT_COCKPIT_WIDGET_MESSAGES`). Provide a
  `Partial<CockpitWidgetMessages>` — or a `Signal` of one to follow a runtime language switch —
  on `COCKPIT_WIDGET_MESSAGES` (or `provideCockpitWidgetHost({ messages })`); a widget used on its
  own also takes a `messages` input. `{count}`-style placeholders; missing members keep English;
  `numberLocale` (default `en-US`) formats the figures. `CockpitKpiService.kpi(kind, messages?)`
  builds KPI texts the same way. Not covered: the config dialogs and the findings of the built-in
  OctoMesh checks except "Failed pipeline executions" (`attentionFailedExecutions*`, optional
  members); a host's own providers bring their own translated titles and texts. Nothing of
  this is persisted — the board JSON is unchanged.
- **Adding a check.** Implement `AttentionProvider` (`id` — persisted, never rename — `label`,
  `description`, `isVisible` via `CockpitContextService.allows(roles, models)`, `load` = exactly one
  query emitting findings once) and register it on `COCKPIT_ATTENTION_PROVIDERS`.
- **Failed pipeline executions** (`pipeline-executions-failed`, AB#5622). Same request and
  counting as the "Pipeline executions 24 h" KPI. Warning from `minFailed` failures (default 10),
  error from `errorFailed` failures (default 1,000) or a failure share of `errorRatio` (default
  0.2); `null` disables an error rule. Override with `{ provide: COCKPIT_FAILED_EXECUTIONS_OPTIONS,
  useValue: { minFailed: 50 } }`. Links to `dataFlows` (the list has no "failed only" filter).
- **System cockpit checks** (AB#5558). `services-unhealthy` (one finding per platform service
  that is not Healthy, links `serviceHealth`) and `blueprint-updates` (info, count badge, links
  `blueprints`; AdminPanelManagement) are visible on the system tenant only
  (`CockpitContextService.isSystemTenant`, from `systemTenantId` of the platform configuration,
  `octosystem` without it) — tenant cockpits are unchanged. Texts: `attentionService*`,
  `attentionBlueprintUpdates*`, `kpiTenants*`, `kpiBlueprints*`, `kpiServices*`, `kpiVersion*`
  (optional members). Seeded by `System.UI.SystemCockpit` ≥ 1.1.0.
- **Data.** Lean documents with explicit fields in `graphQL/cockpit*.graphql`; the adapter states
  and the data flow executions are shared per tenant for 10 s between the KPI and the attention
  list (`CockpitAdapterStatesService`, `CockpitDataFlowExecutionsService`).
- **Recent items source.** `CockpitRecentItemsSource` = `items(limit)` (most recent first, only
  entries the viewer may still open, each with a real `href`), `open(item)` for plain left clicks
  (modified clicks stay with the browser), optional `revision` signal (re-read on change),
  `openPalette()` + `paletteShortcut`. The Refinery Studio feeds it from the same history as the
  empty Cmd+K palette. `recentItems` is not one of `COCKPIT_WIDGET_TYPES` (the health widgets).
- **Seeded board.** octo-platform-services' `System.UI.TenantCockpit` blueprint (≥ 1.1.0) seeds the
  four health widgets on every tenant's `cockpit` board, since 1.3.0 also "Recently opened"
  (`recentItems`, 3 columns) next to the CK-model pie (3 columns); `cockpit-widget-registrations.spec.ts` pins the
  seed's encoding against `toPersistedConfig`.
- **Theming.** Neutral defaults via `--mm-cockpit-*` custom properties (text, text-muted, surface,
  border, border-strong, success, warning, error, info, neutral, accent, ai) falling back to Kendo colours.

### Process Widget
Provides HMI-style (Human-Machine Interface) process visualization with tanks, pipes, valves, pumps, and other process elements. Includes a visual drag-and-drop designer.

See [Process Widget Documentation](docs/process-widget.md) for detailed documentation.

## Data Sources

### Runtime Entity Data Source
Fetches a single entity by CK type or rtId.

```typescript
interface RuntimeEntityDataSource {
  type: 'runtimeEntity';
  ckTypeId?: string;
  rtId?: string;
  attributePaths?: string[];
  includeAssociations?: boolean;
}
```

### Persistent Query Data Source
Executes a saved query by its rtId.

```typescript
interface PersistentQueryDataSource {
  type: 'persistentQuery';
  queryRtId: string;
  queryName?: string;
  queryFamily?: 'runtime' | 'streamData';
  /**
   * Stream-data opt-out. When `true`, the active MeshBoard time filter is NOT
   * bound to this widget's `streamDataArgs.from/.to`, so the saved query's own
   * time range wins. Default auto-binds the time filter. SD-only (ignored for
   * runtime queries). Exposed in the config dialog as the
   * "Ignore MeshBoard time filter" toggle, shown only for stream-data queries.
   */
  ignoreTimeFilter?: boolean;
}
```

### Aggregation Data Source
Performs aggregation queries (count, sum, avg, min, max).

```typescript
interface AggregationDataSource {
  type: 'aggregation';
  queries: AggregationQuery[];
}

interface AggregationQuery {
  id: string;
  ckTypeId: string;
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
  attribute?: string;
  filters?: WidgetFilterConfig[];
}
```

### Construction Kit Query Data Source
Queries Construction Kit metadata (models, types, attributes).

```typescript
interface ConstructionKitQueryDataSource {
  type: 'constructionKitQuery';
  queryTarget: 'models' | 'types' | 'attributes' | 'associationRoles' | 'enums' | 'records';
  groupBy?: string;
  valueField?: string;
  categoryField?: string;
}
```

### Service Call Data Source
Calls services for status/health information.

```typescript
interface ServiceCallDataSource {
  type: 'serviceCall';
  callType: 'modelAvailable' | 'healthCheck';
  modelName?: string;
  serviceType?: 'identity' | 'asset-repository' | 'bot' | 'communication-controller' | 'mesh-adapter' | 'custom';
  customEndpoint?: string;
}
```

## Variables

MeshBoard supports variables that can be used in filter values. Variables use the syntax `${variableName}` or `$variableName`.

### Defining Variables

Variables are defined at the MeshBoard level:

```typescript
interface MeshBoardVariable {
  name: string;           // Variable name (without $)
  label?: string;         // Display label
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'datetime';
  source: 'static' | 'timeFilter';
  value: string;
  defaultValue?: string;
}
```

### Using Variables in Filters

```typescript
const filter: WidgetFilterConfig = {
  attributePath: 'createdDate',
  operator: 'gte',
  comparisonValue: '${timeRangeFrom}'
};
```

### Time Filter Variables

When the time filter is enabled, two variables are automatically available:
- `${timeRangeFrom}` - Start of selected time range (ISO string)
- `${timeRangeTo}` - End of selected time range (ISO string)

## Time Filter

Enable a global time filter for the MeshBoard:

```typescript
interface MeshBoardTimeFilterConfig {
  enabled: boolean;
  pickerConfig?: {
    availableTypes?: ('year' | 'quarter' | 'month' | 'relative' | 'custom')[];
    minYear?: number;
    maxYear?: number;
    defaultRelativeValue?: number;
    defaultRelativeUnit?: 'hours' | 'days' | 'weeks' | 'months';
    showTime?: boolean;
  };
  selection?: TimeRangeSelection;
}
```

### Stream-data widgets: automatic time-range binding

For widgets backed by a **stream-data** persistent query, the active time filter
is auto-bound to the query's `streamDataArgs.from/.to` — you do **not** need to add
a `fieldFilter` on `timestamp`. This pushes the range down to the backend
(CrateDB `DATE_BIN` / downsampling bucket sizing) instead of post-filtering rows.

The binding is resolved centrally by
`MeshBoardStateService.resolveStreamDataTimeArgs(ignoreTimeFilter)`; every
stream-data widget calls it.

**Per-widget opt-out:** the config dialog of each stream-data widget shows an
**"Ignore MeshBoard time filter"** toggle (only when the selected query is a
stream-data query). Enabling it sets `ignoreTimeFilter: true` on the data source
so the saved query's intrinsic time range wins. Runtime queries ignore the time
filter binding entirely and never show the toggle.

## Services

### MeshBoardStateService

Central state management for MeshBoard.

```typescript
// Load initial MeshBoard
await stateService.loadInitialMeshBoard();

// Switch to specific MeshBoard
await stateService.switchToMeshBoard(rtId);

// Switch by well-known name
await stateService.switchToMeshBoardByWellKnownName('cockpit');

// Save current MeshBoard
await stateService.saveMeshBoard();

// Access state
const config = stateService.meshBoardConfig();
const isLoading = stateService.isLoading();
const availableBoards = stateService.availableMeshBoards();
```

### MeshBoardVariableService

Resolves variables in filter values.

```typescript
// Resolve variables in a string
const resolved = variableService.resolveVariables('${timeRangeFrom}', variables);

// Convert filters to DTO with resolved variables
const dtoFilters = variableService.convertToFieldFilterDto(filters, variables);
```

### WidgetRegistryService

Registry for widget types and their configurations.

```typescript
// Get widget component
const component = registry.getWidgetComponent('kpi');

// Get default size
const size = registry.getDefaultSize('table');

// Get registration
const registration = registry.getRegistration('barChart');
```

## Creating Custom Widgets

### 1. Create Widget Component

```typescript
@Component({
  selector: 'my-custom-widget',
  standalone: true,
  template: `...`
})
export class MyCustomWidgetComponent implements OnInit {
  @Input() config!: MyCustomWidgetConfig;

  private readonly dataService = inject(MeshBoardDataService);
  private readonly stateService = inject(MeshBoardStateService);
}
```

### 2. Create Config Dialog Component

```typescript
@Component({
  selector: 'my-custom-config-dialog',
  standalone: true,
  template: `...`
})
export class MyCustomConfigDialogComponent {
  @Input() initialTitle = '';
  @Input() initialDataSource?: DataSource;

  @Output() save = new EventEmitter<MyCustomConfigResult>();
  @Output() cancelled = new EventEmitter<void>();
}
```

### 3. Register Widget

In your app initialization:

```typescript
const registry = inject(WidgetRegistryService);

registry.registerWidget({
  type: 'myCustom',
  component: MyCustomWidgetComponent,
  configDialogComponent: MyCustomConfigDialogComponent,
  defaultSize: { colSpan: 2, rowSpan: 2 },
  getInitialConfig: (widget) => ({
    initialTitle: widget.title,
    initialDataSource: widget.dataSource
  }),
  applyConfigResult: (widget, result) => ({
    ...widget,
    title: result.title,
    dataSource: result.dataSource,
    customOption: result.customOption
  })
});
```

## Persistence

MeshBoards are persisted using the `System.UI/Dashboard` and `System.UI/DashboardWidget` Construction Kit types.

### Required CK Model

The MeshBoard feature requires the `System.UI` CK model version >= 1.0.1.

### Backend Structure

- **Dashboard**: Contains grid configuration (columns, rowHeight, gap) and metadata
- **DashboardWidget**: Contains widget type, position, and serialized config

## Styling

All widget components use **CSS custom properties with neutral defaults**. Host applications override these to apply their theme.

| Widget | CSS Variable Prefix | Example |
|--------|-------------------|---------|
| Markdown Widget | `--mm-prose-*` | `--mm-prose-text`, `--mm-prose-heading` |
| Stats Grid Widget | `--mm-stat-{variant}-*` | `--mm-stat-mint-bg`, `--mm-stat-cyan-text` |
| Process Designer | `--designer-*` | `--designer-canvas-color`, `--designer-grid-color` |

See the main [README Styling Guidelines](../../README.md#styling-guidelines) for details on the CSS variable pattern.

## Build

```bash
npm run build:octo-meshboard
```

## Dependencies

- `@angular/core` ^21
- `@progress/kendo-angular-charts` (Charts)
- `@progress/kendo-angular-gauges` (Gauges)
- `@progress/kendo-angular-grid` (Table)
- `@progress/kendo-angular-dialog` (Dialogs)
- `@progress/kendo-angular-buttons` (Buttons)
- `@progress/kendo-angular-inputs` (Inputs)
- `ngx-markdown` (Markdown rendering)
- `@meshmakers/octo-services` (GraphQL services)
- `@meshmakers/octo-ui` (UI components)
- `@meshmakers/octo-process-diagrams` (Process diagram library)
- `@meshmakers/shared-ui` (Shared components)
