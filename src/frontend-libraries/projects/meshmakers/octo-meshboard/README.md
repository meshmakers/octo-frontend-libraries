# OctoMesh MeshBoard Library

A flexible, widget-based dashboard library for Angular applications in the OctoMesh platform.

## Overview

MeshBoard provides a grid-based dashboard system with configurable widgets that can display data from various sources including runtime entities, persistent queries, and aggregations.

## Installation

```bash
npm install @meshmakers/octo-meshboard
```

The host installs the library's Kendo peer dependencies in exactly the version of its other Kendo packages, and
that version has to be 24.1.0 or later; a host on an older 24.x upgrades all its Kendo packages together first. One
of them is `@progress/kendo-angular-tooltip` (needed for the hover texts on a board: the widget info icon, the
time-shift caption and the table value markers). Take the version of `@progress/kendo-angular-common` from the
host's `package.json`, for example 24.2.2:

```bash
npm install @progress/kendo-angular-tooltip@24.2.2 --save-exact
```

npm installs a missing peer by itself, but the tooltip package requires the other Kendo packages in its own exact
version, so a tooltip of another patch version than the host's Kendo packages ends in a peer conflict (`ERESOLVE`).

The tooltip takes its look from the host's Kendo theme (`kendo-theme--styles()`, or the tooltip and popup
modules of a slim theme), so it follows the light and dark theme without extra styles.

**Hover texts.** The widget info icon, the time-shift caption and the table value markers show their text in a
Kendo tooltip, not in the browser's native `title` tooltip: it opens on hover and, for the focusable info icon and
time-shift caption, on keyboard focus, and closes on mouse leave, blur and Escape (Escape also closes a tooltip
opened by hover while the keyboard focus is elsewhere). Each element keeps the text as its
accessible name (`aria-label`) and has no `title` attribute, so exactly one tooltip shows. The time-shift caption
marks that it has a tooltip with a dotted underline in its own text colour and the help cursor (the "definition
tooltip" pattern) and opens its tooltip below itself, so the widget title above it stays visible; the info icon and
the value markers open theirs above.

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

### Period set by the host (`timeRange` / `timeFilterControl`, AB#7582)

A host page that has its own period control (one "from / to" for the whole page) passes the period
to the embedded board as **two exact instants** and switches the board's own time-range picker off,
so page and dashboard always show the same days, whatever time zone the browser is in.

| Input | Type | Effect |
|-------|------|--------|
| `timeRange` | `{ from: Date \| string; to: Date \| string } \| undefined` | Half-open period `[from, to)`. `Date` objects are taken as they are. Strings must be **RFC 3339 with an offset**: `YYYY-MM-DDTHH:MM:SS`, optional `.s`–`.sss`, then `Z` or `±HH:MM` (e.g. `2026-03-28T05:00:00Z`, `2026-03-28T06:00:00+01:00`). Rejected as invalid: no offset (the browser would read it in its own zone), no seconds, compact offsets (`+0100`), lowercase `t`/`z`, a space instead of `T`, more than 3 fraction digits (these forms parse differently across browsers, e.g. Safari), and dates or times that do not exist (`2026-02-30`, `24:00`, `23:60`, leap second `:60`). The instant is computed from the fields, not by `Date.parse`. |
| `timeFilterControl` | `'board' \| 'host'` (default `'board'`) | `'host'` hides the board's time-range picker and its reset button. Entity selectors and the toolbar actions stay, in `headerMode` `full` and `compact`. |

Rules while `timeRange` is set (and the board's time filter is enabled):

- `$timeRangeFrom` / `$timeRangeTo` and the stream-data window of every stream-data widget are
  exactly the two instants — no snapping to 00:00, independent of `pickerConfig.showTime` and of
  the board `timeZoneMode`.
- **Day buckets and labels still follow the board's `timeZoneMode`:** the date labels of the
  widgets and the calendar rollup a line chart picks (`resolveStreamDataTimeZone()`) use the board's
  zone, not the host's. A board in `'local'` mode opened in a New York browser cuts daily buckets
  at New York midnight even though the window is exactly the host's instants. An embedded board
  should therefore set `timeZoneMode` to the host's business zone (e.g. `Europe/Vienna`). Calendar
  rollups are cut at 00:00 of that zone; they cannot represent a day that starts at 06:00 (gas
  day) — a widget that must show gas days needs a query that does not use a daily calendar rollup.
- **The host wins:** `tf_*` query parameters and the stored/default selection are ignored, the view
  writes no `tf_*` parameters, the stored selection is not touched and the board shows no unsaved
  changes. The picker is hidden and its events are ignored, whatever the `timeFilterControl`
  value. `tf_*` parameters that were in the URL when the view opened stay in the URL but are never
  applied again once the host has owned the period (also not after `timeRange` goes back to
  `undefined`).
- A new period reloads the widgets once (an equal period — same instants — reloads nothing); the
  board definition is not reloaded. Setting `timeRange` back to `undefined` returns the board to
  its own selection (and, with `'board'`, shows the picker again).
- An invalid period (unparseable value, or `from >= to`) sends **no stream-data query that is
  bound to the time filter**: the widgets show their normal empty state (`resolveStreamDataScope`
  returns `{ kind: 'empty', reason: 'invalidTimeRange' }`; the process widget's element bindings
  get no value, a widget group over a stream-data query shows no items), `$timeRangeFrom` /
  `$timeRangeTo` are removed, and the view logs one console error naming the input. A widget with
  **`ignoreTimeFilter: true`** does not depend on the period and keeps querying (with its selector
  scope). Custom widgets pass their `ignoreTimeFilter` as the third argument of
  `resolveStreamDataScope`, or ask `isStreamDataBlockedByHostTimeRange(ignoreTimeFilter)`.
  **Limitation:** widgets backed by a *runtime* query or aggregation whose filter uses
  `$timeRangeFrom` / `$timeRangeTo` are not gated; they run with the placeholder unresolved. An
  invalid range is a host bug — fix it there.
- A board whose time filter is disabled ignores `timeRange` and logs nothing.
- With `timeRange` undefined and `timeFilterControl='board'` the view behaves exactly as before.
- With `timeFilterControl='host'` and `timeRange` undefined (e.g. while the host page is still
  computing its period) the board keeps working on its own selection, with the picker hidden; it
  writes no `tf_*` parameters, because the URL belongs to the host.

Day rules belong to the host: the library has no "day start" offset. A host whose day starts at
06:00 (e.g. a gas day) computes the instants itself, in its business time zone:

```typescript
import { MeshBoardHostTimeRange } from '@meshmakers/octo-meshboard';

/** Gas day `day` (yyyy-mm-dd) = 06:00 Vienna to 06:00 Vienna the next day (23/24/25 h on DST days). */
function gasDay(day: string): MeshBoardHostTimeRange {
  return { from: viennaInstant(day, 6), to: viennaInstant(addDays(day, 1), 6) };
}
// viennaInstant(day, hour) returns the UTC instant of that Vienna wall-clock time, e.g.
// viennaInstant('2026-03-28', 6) = '2026-03-28T05:00:00Z', viennaInstant('2026-03-29', 6) = '2026-03-29T04:00:00Z'.
```

```html
<mm-meshboard-view headerMode="compact" timeFilterControl="host" [timeRange]="period()"></mm-meshboard-view>
```

The period is held transiently by `MeshBoardStateService` (`hostTimeRange`, `setHostTimeRange(state,
owner)`, `clearHostTimeRange(owner)`) and never persisted. The service is root-provided, so the view
registers itself as the owner: it clears the period when it is destroyed or drops its `timeRange`,
but never a period another view set in the meantime, and a view destroyed while its board is still
loading publishes nothing. Exported helpers: `MeshBoardHostTimeRange`, `MeshBoardTimeFilterControl`,
`parseHostTimeRange`, `HostTimeRangeState`.

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
  decimalPlaces?: number;
  // For persistent query mode
  queryMode?: 'simpleCount' | 'aggregation' | 'groupedAggregation';
  queryValueField?: string;
  filters?: WidgetFilterConfig[];
  showChange?: true; // change to the current period under a time-shifted value (AB#9245)
  increaseIsGood?: false; // with showChange: an increase is coloured as bad (e.g. consumption)
}
```

Numbers are formatted with the `de-AT` locale. Without `decimalPlaces` a fractional value shows two
fraction digits and a whole number none (38.9 -> `38,90`, 46 -> `46`). With `decimalPlaces` every numeric
value shows exactly that many (`decimalPlaces: 1`: 38.9 -> `38,9`, 46 -> `46,0`). In a seed, set it in the
widget `Config` JSON, e.g. `{"valueMode":"formula","formula":"...","decimalPlaces":1}`; the configuration
dialog offers it as *Decimal Places* (AB#7686). Valid values are the JSON numbers 0-3 (integers); anything
else (a string such as `"1"`, a fraction, a negative value, 4 or more, other types) falls back to the automatic
format. Unlike the heatmap's `decimalPlaces` (a maximum, default 2), the KPI value is an exact digit count and
unset means automatic; both widgets format through the shared `formatWidgetNumber` (`utils/widget-data-utils.ts`,
cached `Intl.NumberFormat` instances). With `decimalPlaces` set, a text value is parsed strictly: only a string
that is a complete number (`"12"`, `" 12 "`, `"1e3"`) is formatted, anything else (`"12 kWh"`, an ISO date,
`"12,5"`) is shown unchanged. Without `decimalPlaces` the previous lenient parsing stays (`"12 kWh"` -> `12`).
A negative value that rounds to zero is shown without a sign (`-0.04` with 1 -> `0,0`). The setting also
applies to KPI children of a widget group (`childTemplate.staticConfig.decimalPlaces`, also offered in the
widget-group configuration dialog).

**Change to the current period (AB#9245).** A KPI on a stream-data query with a time shift (see *Time
shift* below) can show how the current period differs from the shifted one, like Grafana's Stat panel
"percent change". In the dialog, under *Compare with*, *Show change* ("Show the change to the current
period (value and %)") appears for *Previous period* and *Same period last year*; it is hidden with
*None* and disabled while "Ignore MeshBoard time filter" is checked, like the shift. It is saved as
`showChange: true` in the widget config and is absent when off, so existing boards are unchanged.
With the option on, the KPI sends a second query for the unshifted board window (same filters, scope
and multiplier) and shows one line under the value: the change = current - shifted in the KPI's
suffix and decimals, and change / |shifted| x 100 with one decimal, both with sign and never `-0`.
The change is computed from the unrounded totals and rounded afterwards, so it can differ in the last
digit from the difference of the rounded values shown here (42 990,484 - 40 674,316 = 2 316,168):

| Current | Shifted | Change line |
|---|---|---|
| 42 990,48 | 40 674,32 | `▲ +2 316,17 kWh (+5,7 %)` |
| 3 482,59 | 3 688,86 | `▼ −206,27 kWh (−5,6 %)` |
| 1 250 | 1 250 | `0 kWh (0,0 %)` (with 2 decimals: `0,00 kWh (0,0 %)`) |
| 3,004 | 3 | `0,00 kWh (0,0 %)` with 2 decimals: a change that rounds to zero counts as zero |
| any | 0 or no data | `–` |
| no data (no row, or an empty cell) | any | `–` (a current total of 0 is a real value: 0 vs 100 is `▼ −100 kWh (−100,0 %)`) |

The tile value stays the shifted value. The arrow follows the direction (▲ increase, ▼ decrease, none for
zero). The colour follows *An increase is (•) good ( ) bad*, shown under *Show change* (like Power BI's KPI
"High is good / Low is good" and Grafana's Stat "Inverted"): a good change uses `--kendo-color-success`, a bad
change `--kendo-color-error`, zero and `–` `--kendo-color-subtle`. Default is *good*; *bad* is saved as
`increaseIsGood: false` (absent otherwise), so a consumption increase shows `▲ +2 316,17 kWh (+5,7 %)` in the
error colour and a decrease `▼` in the success colour. So that the meaning does not rest on the colour alone,
a small word in the same colour stands under the numbers: *Favourable* for a good change, *Unfavourable* for a
bad one, none for zero or `–` (e.g. `▲ +2 316,17 kWh (+5,7 %)` with *Unfavourable* below it on a consumption
tile). The host translates the two words with
`MESHBOARD_MESSAGES` (`kpiChangeFavourable`, `kpiChangeUnfavourable`). The line follows the
rules of the time-shift caption: it is shown only while the shift applies (a time filter is active, the
time filter is not ignored, not a runtime query; a saved widget without a query family is looked up first and
sends the second query only for stream data). Both windows come from one reading of the clock, so with a
relative range ("last hour") the shifted window ends exactly where the current one starts. While the shifted
query runs the tile shows its loading state; its value shows as soon as it arrives, and the line follows when
the query of the current period answers. An empty entity-selector scope shows `-` and no line, without a
query. When only the query of the current period fails, the tile keeps the shifted value (and its output
variable) without a line and without an error message; when the shifted query fails, the tile shows its error.
A load that a newer one replaced (a refresh, another pick, a switch to another data source) changes nothing
when it ends late.

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
  labelFields?: string[];                                                         // AB#7728
  rowAction?: { label: string };                                                  // AB#7728
  valueMarkers?: { field: string; tooltip: string; icon?: string; color?: string; showValue?: boolean }[]; // AB#7728
}
```

**Row action (AB#7728).** A board author switches on *Row Action* in the table's configuration
dialog and gives it a label (e.g. "Details"); it is stored as `rowAction: { label }` in the widget's
`Config` JSON. The table offers it as a row action button **only when the host app provides
`MESHBOARD_TABLE_ROW_ACTION_HANDLER`** — without a handler (other apps, the Refinery Studio) the
table looks as before. The handler receives which widget the action came from and the row's values:

```typescript
import { MESHBOARD_TABLE_ROW_ACTION_HANDLER, MeshBoardTableRowActionEvent } from '@meshmakers/octo-meshboard';

providers: [
  // app-wide, or on the component that embeds <mm-meshboard-view>
  {
    provide: MESHBOARD_TABLE_ROW_ACTION_HANDLER,
    useFactory: () => {
      const details = inject(DailyDetailsDialogService);
      return (e: MeshBoardTableRowActionEvent) => {
        // e = { widgetId (rtId, else local id), widgetTitle, meshBoardRtId, actionLabel, row }
        if (e.widgetTitle === 'Energiedaten täglich') {
          details.open(e.row['rtWellKnownName'] as string, e.row['day'] as string);
        }
      };
    }
  }
]
```

`row` is keyed by column field (attribute path / query column), a copy of the list row. A handler that
throws (or rejects) is logged and does not break the table.

**Value markers (AB#7728).** `valueMarkers` turns a column into a marker column: the cell shows the
icon (status icon set: `exclamation-circle` (default), `warning-triangle`, `check-circle`, `x-circle`,
`minus-circle`, `question-circle`, `circle`) with `tooltip` as Kendo tooltip and accessible name when the value
is a number (or numeric string) above zero, and stays empty otherwise (`isPositiveMarkerValue`). It
works for configured columns and for columns derived from a persistent query; set it in the dialog's
*Value Markers* card. With `showValue: true` the cell shows the value next to the icon (default: icon
only); a value of zero or below still leaves the cell empty.

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

`tableNotConfigured` translates the placeholder of an unconfigured table; `kpiChangeFavourable` /
`kpiChangeUnfavourable` the words on a KPI's change line (AB#9245). Since AB#9743 also: `loading` (widget spinner),
`loadingMeshBoard`, `noDataAvailable` (widget group), `refreshAllWidgets` and `resetTimeFilter` (board toolbar
tooltips), the time-shift names `timeShiftPreviousPeriod`, `timeShiftSamePeriodLastYear`, `timeShiftPeriodsBack`,
`timeShiftYearsBack` (`{count}`), the line chart's data badge `dataBadge` (`{rows}`, `{points}`), `dataBadgeLegend`
(`{total}`), `dataBadgeClickForDetails`, and `noDataForSource` (`{source}`).

**Formats in the host language (AB#9743).** With `MESHBOARD_LANGUAGE` set (e.g. `de-AT`, `en`), the KPI, pie, bar,
line and table widgets format numbers and dates in that locale and the time-shift caption names its month in it;
without it they keep the `de-AT` formats.

**Enum labels (AB#5622).** `MESHBOARD_LABEL_RESOLVER` (same pattern as the entity forms'
`ENTITY_FORM_LABEL_RESOLVER`) translates enum values: `(request) => string | null | undefined`
with `request = { kind: 'tableCell' | 'chartCategory', ckTypeId?, attribute, value, valueType?,
defaultText }`; `null` / `undefined` / `''` keep `defaultText` (today's text), a throwing resolver
is logged once and ignored. Tables offer string cells of text columns (persistent-query columns
only when their value type is `ENUM`); pie / donut charts offer every category — the resolved text
is the slice name in data labels, legend and tooltips, the status colour still follows the raw
value. A resolver that reads a signal re-labels the charts when it changes.
**Numeric enum cells (AB#7655):** a cell that holds a number in a persistent-query column whose
value type is an enum (`valueType` matches `ENUM`) is offered too, with `value` = the number as
string (`2` → `'2'`) and `valueType`; numbers of other columns are not. A column's `valueLabels`
(below) wins over the resolver — such a column never calls it.

**Column titles per language and value labels (AB#7655).** Board authors configure both in the
board JSON/YAML (the table config dialog does not edit them):

```typescript
interface TableColumn {
  field: string;
  title: string;                                     // fallback header
  titles?: Record<string, string>;                   // header per culture code
  valueLabels?: Record<string, TableColumnValueLabel>; // raw value (as string) -> label
  width?: number; dataType?: string; format?: string; statusMapping?: ...;
}
interface TableColumnValueLabel {
  label: string | Record<string, string>;            // one text, or a text per culture code
  color?: string;                                    // optional CSS text colour
}
```

- **Host language.** The library does not know the host's UI language and never derives it from
  `LOCALE_ID` (static in many apps). A host that wants per-language texts hands it over once — a
  culture code or a `Signal<string | null>`; the widgets follow a signal without reloading the board
  or refetching data:

  ```typescript
  providers: [
    provideMeshBoard({ language: languageService.currentCulture }), // Signal<string>, e.g. 'de-AT'
    // or, when the widgets are registered lazily (no provideMeshBoard()):
    provideMeshBoardLanguage(languageService.currentCulture),
    // or directly: { provide: MESHBOARD_LANGUAGE, useValue: 'en-GB' }
  ]
  ```

  No language = every column shows `title` and per-language labels show the raw value, exactly as
  before. `pickLocalizedText(texts, language)` is exported for hosts that need the same lookup.
- **`titles`** — lookup order: the exact culture or language (`de-AT`, `de`; case-insensitive);
  for a culture (`de-AT`) without an exact key, a key equal to its language part (`de`); for a bare
  language (`de`, e.g. from a simple language switcher) without an exact key, the **first authored
  key of that language** (`de-AT` in `{ "en-GB": …, "de-AT": …, "de-DE": … }`, in the order the keys
  are written); then `title`. A culture never picks a sibling culture (`de-DE` does not take `de-AT`).
  Columns derived from a persistent query (no explicit `columns`) keep their generated titles.
- **`valueLabels`** — keys are the raw value as string; a number `2` and a string `"2"` both match
  `"2"`. The cell shows the label as **plain text** like every other cell (no badge); `color`, when
  set, is the text colour — use a theme token such as `var(--kendo-color-error)`; without it the
  theme text colour applies. A per-language `label` follows the host language like `titles`. A value
  without a label (unmapped, e.g. `4`, or a per-language label without a match) keeps the column's
  rendering: `numeric` with `format` like the `number` pipe, `iso8601` with `format` like the `date`
  pipe, plain text through the board's date-time formatter; `null` / missing is an empty cell. When
  no label applies for the current language at all (e.g. only `de-AT` labels and the host language is
  `en-GB`), the column renders exactly as without `valueLabels`, including `MESHBOARD_LABEL_RESOLVER`.
  Otherwise `valueLabels` win over `MESHBOARD_LABEL_RESOLVER`. **`valueLabels` together with
  `statusMapping` (status icons) is not supported:** the labels are shown, the status icons are not,
  and the widget logs a console warning.
- **Configuration errors** — a culture key that is not a culture code (`german`, `de_AT`), a
  malformed `titles` entry (no object, non-string or empty text) or a malformed `valueLabels` entry
  (no object, no usable `label`, non-string `color`) is ignored; the widget logs **one** console
  warning per widget, column and set of problems naming them (a different problem after a config
  edit is reported again), and the table still renders.
- **Refinery Studio** — the table config dialog keeps hand-authored columns: saving a
  persistent-query table without changing the query keeps its explicit `columns` that the query still
  returns (unchanged, in their order), drops those whose field the query no longer returns and adds the
  query's other columns with a generated title, like derived columns (when the query's columns cannot
  be loaded, the explicit columns stay unchanged; a new query starts without explicit columns); for
  runtime-entity tables, columns that stay selected on the same CK type keep all their properties
  (`titles`, `valueLabels`, `width`, `format`, `statusMapping`, ...), newly selected ones get a
  generated title. A new `config` on the same widget instance re-renders headers and labels.

Example — the daily quality 1/2/3 shown as L1/L2/L3 with German and English headers:

```json
{
  "columns": [
    { "field": "day", "title": "Day", "titles": { "de-AT": "Tag", "en-GB": "Day" } },
    {
      "field": "dataquality_max",
      "title": "Dataquality",
      "titles": { "de-AT": "Datenqualität", "en-GB": "Data quality" },
      "valueLabels": {
        "1": { "label": "L1", "color": "var(--kendo-color-success)" },
        "2": { "label": "L2", "color": "var(--kendo-color-warning)" },
        "3": { "label": "L3", "color": "var(--kendo-color-error)" }
      }
    }
  ]
}
```

**Board name, widget titles and widget explanations per language.** Like table column `titles`, a board
author gives the board name and description and every widget its title per UI language, in the board
configuration (board JSON/YAML, seed data; the config dialogs do not edit them). A widget can also carry an
optional explanation (`description`, `descriptions`): the widget header then shows a small info icon whose
tooltip is the explanation in the viewer's language; without an explanation there is no icon. Banner-zone and
chromeless widgets have no header in view mode, so they show no info icon even with an explanation.

```typescript
interface WidgetConfig {
  title: string;                          // fallback header
  titles?: Record<string, string>;        // header per culture code
  description?: string;                   // fallback explanation (info icon)
  descriptions?: Record<string, string>;  // explanation per culture code
  // ...
}
interface MeshBoardConfig {
  name: string; names?: Record<string, string>;
  description?: string; descriptions?: Record<string, string>;
  // ...
}
```

- Every text resolves with the lookup of column `titles` above (exact culture, then its language part, a culture
  never picks a sibling culture) from the host language of `MESHBOARD_LANGUAGE` / `provideMeshBoard({ language })`,
  and follows a language signal without reloading the board or refetching data. The board header, the breadcrumb
  and the widget headers use it; `resolveLocalizedText(fallback, texts, language)` is exported for hosts.
- No host language, or no entry for it: the single `title` / `name` / `description` is shown, exactly as before.
  An empty or non-string entry, or a key that is no culture code, is ignored; the view logs one console warning
  naming the board or widget and still shows the single text, never an empty header.
- Storage: widget `titles`, `description` and `descriptions` go into the widget's `Config` JSON, board `names` and
  `descriptions` into the encoded board description next to variables and time filter. Saving, reloading and the
  board export / import keep them; boards without them store and load as before.
- Refinery Studio keeps them when an author saves a widget config dialog, the widget edit dialog, the board
  settings or a rename without touching them. When the author changes the single title or name, the per-language
  entries stay and the changed single text is the new fallback. Duplicating a widget adds " (Copy)" to the single
  title only; the per-language titles are copied unchanged.
- Period labels: the time-range picker of the board takes its labels from route data `timeRangeLabels` when set
  (unchanged), else from `MeshBoardMessages.timeRangeLabels`; with a messages signal the picker relabels on a
  language change.

Example — a statistics board in German and English:

```json
{
  "name": "Energy quantity statistics",
  "names": { "de-AT": "Energiemengen-Statistik", "en-GB": "Energy quantity statistics" },
  "widgets": [
    {
      "type": "kpi",
      "title": "Energy quantities",
      "titles": { "de-AT": "Energiemengen", "en-GB": "Energy quantities" },
      "description": "Sum of all metering points in the selected period",
      "descriptions": {
        "de-AT": "Summe aller Zählpunkte im gewählten Zeitraum",
        "en-GB": "Sum of all metering points in the selected period"
      }
    }
  ]
}
```

**Every other widget text per language.** Besides the title, every text an author writes into a widget can be
given per UI language the same way: the single text stays the fallback and a map with the same name in plural
holds the translations. They resolve exactly like `titles` (exact culture, then its language part, then the
single text) and follow a language switch.

| Widget | Single text | Per-language map |
|--------|-------------|------------------|
| `kpi` | `prefix`, `suffix` (unit), `comparisonText` | `prefixes`, `suffixes`, `comparisonTexts` |
| `gauge` | `prefix`, `suffix` | `prefixes`, `suffixes` |
| `barChart` | `dataLabelSuffix`; `series[].name` | `dataLabelSuffixes`; `series[].names` |
| `lineChart` | `valueAxisTitle`; `referenceLines[].label` | `valueAxisTitles`; `referenceLines[].labels` |
| `barChart`, `lineChart` | `additionalSeries[].label` | `additionalSeries[].labels` |
| `pieChart`, `barChart`, `lineChart` | a name in `categoryLabels` / `seriesLabels` | the name itself as a map, see below |
| `statsGrid` | `stats[].label`, `prefix`, `suffix` | `stats[].labels`, `prefixes`, `suffixes` |
| `summaryCard` | `tiles[].label`, `prefix`, `suffix` | `tiles[].labels`, `prefixes`, `suffixes` |
| `statusIndicator` | `trueLabel`, `falseLabel` | `trueLabels`, `falseLabels` |
| `statusList` | `statusColors[status].label` | `statusColors[status].labels` |
| `widgetGroup` | `emptyMessage`; `childTemplate.titleTemplate`; `prefix` / `suffix` of a KPI or gauge `childTemplate.staticConfig` | `emptyMessages`; `childTemplate.titleTemplates` (each a template with the same variables); `prefixes` / `suffixes` |
| `markdown` | `content` | `contents` (a whole markdown text per language) |
| `table` | `rowAction.label`; `valueMarkers[].tooltip`; the `tooltip` of a column `statusMapping` entry | `rowAction.labels`; `valueMarkers[].tooltips`; `tooltips` |

Table column headers and value labels have their own per-language keys (above). Texts that come from the data
(attribute values, query results) and the library's own texts (loading, empty, error, paging) are not author texts
and are not covered here. Process diagram texts belong to the process diagram, not to the widget configuration.

A chart category or series name is given per language by writing the name as a map instead of a string; a value
without a match for the viewer's language shows the raw value, as a value without a name does:

```json
"categoryLabels": {
  "1-1:2.9.0 G.03": { "de-AT": "Einspeisung", "en-GB": "Feed-in" },
  "1-1:2.9.0 P.01T": "Surplus"
}
```

- No host language, no entry for it, or an empty or non-string entry: the single text is shown, exactly as before;
  an ignored entry logs one console warning naming the widget. Boards without these maps render and store unchanged.
- Storage: the widget-level maps (`prefixes`, `suffixes`, `comparisonTexts`, `dataLabelSuffixes`, `valueAxisTitles`,
  `trueLabels`, `falseLabels`, `emptyMessages`, `contents`) are written to the widget's `Config` JSON next to `titles`
  for every widget type; the maps on items (stats, tiles, series, reference lines, statuses, markers, the child
  template) are stored with their item.
- The config dialogs edit the single texts only. Saving a dialog keeps the maps on their item, also when other items
  are removed, reordered or the single text is changed; the chart name editors list only single names and keep the
  per-language names of the board.
- Language switch: every widget relabels without reloading its data, except the bar and line chart, which load their
  data again because their category and series names are part of the loaded series.

**Label fields (AB#7728).** `labelFields: ['dataquality_max', 'rtWellKnownName']` on a table offers
these columns to the resolver whatever their type, also numeric or typed text query columns that are
otherwise skipped. The resolver gets the same `tableCell` request for string and number cells, with
`value` as text (`3` arrives as `'3'`, zero included; empty cells are not offered), and `valueType`
when the query reports it. Returning `null` keeps the plain text, which also replaces a numeric
`format` of that column; a value marker on the same column wins. Without a resolver the key has no
effect. The key is set in the widget's `Config` JSON (no dialog field); a dialog save keeps it.

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
  categoryLabels?: Record<string, string>;            // AB#7235, see "Chart value labels"
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
  categoryLabels?: Record<string, string>;  // AB#7235, see "Chart value labels"
  seriesLabels?: Record<string, string>;    // AB#7235, dynamic series mode
}
```

### Line Chart Widget
Displays time series as line or area charts; every value of `seriesGroupField` becomes one line.
Series from further queries, formula series and per-series options are described in the library's
`CLAUDE.md` (section *Line-chart resolution-aware fan-out* and the sections starting with *Line chart:* and
*Line and bar chart:*).

```typescript
interface LineChartWidgetConfig {
  type: 'lineChart';
  chartType: 'line' | 'area';
  categoryField: string;          // date/time field of the X axis
  seriesGroupField: string;       // one line per value
  valueField: string;
  unitField?: string;
  excludedSeriesGroupValues?: string[];  // series group values left out (see below)
  seriesLabels?: Record<string, string>;  // AB#7235, see "Chart value labels"
  // ... legend, markers, filters, additionalSeries, primarySeries, stacked, bucketMinutes
}
```

**Leaving series out (`excludedSeriesGroupValues`).** A grouped chart can leave out chosen series of its
primary query, for example a register that duplicates another one. On the fan-out paths (resolution-aware charts, one line per source entity or per group) the values are not queried; in plain grouping the rows the query returns for them are dropped before the series are formed. Either way they are not drawn
and not in the legend, on the raw archive as on rollups (no query column is needed, so it works where a
row filter on the group column fails). Board JSON of a widget config:

```json
{
  "chartType": "line",
  "categoryField": "window_start",
  "seriesGroupField": "obisCode",
  "valueField": "amount.value",
  "resolutionAware": true,
  "requiredAggregation": "SUM",
  "aggregateSeriesByGroup": true,
  "excludedSeriesGroupValues": ["1-1:2.9.0 G.03R"]
}
```

- Matching is exact on the stored `seriesGroupField` value: case and blanks as stored, before any display
  label. A value that does not occur changes nothing.
- A resolution-aware chart without an entity scope and without `aggregateSeriesByGroup` draws one merged
  line. When an excluded value occurs among the source entities, that line covers only the source entities
  of the other values (at most 5000 entities are read; entities without a value of the group field drop out).
- When every value is excluded, or the exclusion leaves no value, the chart shows its normal no-data state.
- The entity-selector scope still applies to the remaining series. Additional series are not affected
  (hide them with `visible: false`).
- The key is written only when the list is not empty; charts without it load and save unchanged.
- In the dialog: *Field Mapping → Excluded series*, shown once a series group field is set. Choosing another
  series group field or another query clears the list.

**Load behaviour of resolution-aware charts (AB#8994).** A resolution-aware chart sends one transient
downsampling request per series group (`aggregateSeriesByGroup`) or per source entity:

- At most **3** of these requests of one widget run at the same time (`MAX_CONCURRENT_DOWNSAMPLING`); the
  others wait and start as earlier ones finish. A reload, a time-filter or selector change drops the waiting
  requests of the previous load, and nothing of a superseded load is drawn.
- The point count the chart asks the series resolver for is `min(500, max(50, width / 2))`
  (`MAX_DOWNSAMPLE_POINTS`). With a 15-min raw archive and an hourly rollup a 7-day window (672 raw points)
  therefore always uses the hourly rollup; the raw archive is still used up to about 5 days. A fixed bucket
  size (`bucketMinutes`) keeps its own count. Plain (not resolution-aware) downsampling is not capped at 500;
  it keeps `min(4000, max(50, width / 2))`.
- When the request of one series fails or times out, the other series are drawn and the failed one gets a
  hint in the chart (`Could not load <series>: timeout` or `… request failed`, the error message as tooltip).
  The chart shows its error state only when every series fails.

### Chart value labels (`categoryLabels` / `seriesLabels`, AB#7235)

A query often groups by a code - an OBIS code, a material number, a cost centre. A pie, bar or line
chart can show a readable name instead of the code. The names are part of the widget's `Config`, a plain
map from the raw value to the text to show, so a board reads the same in every host application:

```json
"categoryLabels": { "1-1:2.9.0 G.03": "Feed-in", "1-1:2.9.0 P.01T": "Surplus" }
```

| Widget | Key | Renames |
|--------|-----|---------|
| `pieChart` | `categoryLabels` | the slices: data labels, legend, tooltip |
| `barChart` | `categoryLabels` | the categories: axis labels, tooltip |
| `barChart` | `seriesLabels` | the dynamic series of `seriesGroupField`: legend, tooltip |
| `lineChart` | `seriesLabels` | the lines of `seriesGroupField`: legend, tooltip |

Which text a value gets:

1. the widget entry for the raw value (matched exactly, case included; the dialog removes blanks around a value when saving, and a row without a name is not saved);
2. the host's `MESHBOARD_LABEL_RESOLVER` result - only the pie chart asks the resolver, bar and line
   charts never did;
3. today's text: the raw value, for a pie slice the humanized category (`RESOLVE_FAILED` -> "Resolve failed"),
   for a date category the formatted date.

A value without an entry, no key at all and an empty map all show exactly what the chart showed before.

- **Display only.** Queries, filters, a KPI's `queryCategoryValue`, the grouping into series,
  `excludedSeriesGroupValues` and the pie's `categoryColors` keep matching the raw value. A name that equals a
  `categoryColors` key does not pull that colour onto the slice.
- **Series stay distinct.** Chart series are keyed by their name: when two raw series values get the same name,
  the series whose raw value differs from the name is shown as `Name (raw value)`. Two categories with the same name are shown as they are in a single-query chart; in the multi-source bar chart the repeated name gets a numbered suffix (`Name`, `Name (2)`), so every category keeps its own bar and tooltip.
- **Series of other queries keep their own labels.** `seriesLabels` renames only the series that come from the
  primary query's `seriesGroupField`; `additionalSeries` (label), a static value-field list (`name`) and formula
  series are not touched.
- **Persistence.** Both keys are written to the board JSON only when they have at least one entry with a value and a
  non-blank name; charts without them save and load unchanged.
- **Config dialogs.** The pie, bar and line dialogs have a *Category Names* / *Series Names* section
  (`mm-value-labels-editor`, see its README): one row per raw value, an empty list shows a hint, a value listed
  twice is flagged. Rows without a value or without a name are dropped on Save, so an unfinished row never
  replaces a complete one. The bar chart dialog offers *Series Names* in dynamic series mode.

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
  /** Calendar time shift of the board's time filter (AB#9094), see "Time shift" below. */
  timeShift?: { by: 'period' | 'year'; count: number };
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

### The viewer's time range carries over to other MeshBoards (AB#9737)

The time range a viewer chooses on one MeshBoard is preselected on every MeshBoard opened afterwards in the same
app, like Kibana's global time in a session: switching from one board to another (for example two tabs of an app,
each a route with its own `mm-meshboard-view`) keeps the range. Every change counts: a pick in the time picker, the
reset to the board's default and a link that opens a board with `tf_*` parameters. Hosts need no change.

Which range a board opens with:

1. the host period (`timeRange` input, AB#7582);
2. `tf_*` parameters in the URL;
3. the viewer's shared range, also over the board's own stored or default selection, as long as the board's picker
   offers its type (`pickerConfig.availableTypes`); otherwise the board keeps its own;
4. the board's stored selection, then its default selection.

The shared range is kept in memory (`MeshBoardStateService.viewerTimeSelection`) and lasts as long as the app is
open; a reload of the page starts without it. A board's picker emitting its built-in start value (a board with neither
a stored nor a default selection) is not a choice and is not shared, nor are the `tf_*` parameters the view writes
itself when the viewer switches boards inside the same view (only the link the view was opened with counts). Applied to a board, the shared range becomes that
board's active selection like a pick: saving the board in edit mode stores it as the board's last-used selection. A host whose route guard
fills missing `tf_*` parameters itself (the Energy Community statistics pages do) must take
`MeshBoardStateService.viewerTimeSelection()` first, serialized with `timeFilterQueryParams(selection)` (drop the
`null` entries), or its parameters win over the shared range.

### Stream-data widgets: automatic time-range binding

For widgets backed by a **stream-data** persistent query, the active time filter
is auto-bound to the query's `streamDataArgs.from/.to` — you do **not** need to add
a `fieldFilter` on `timestamp`. This pushes the range down to the backend
(CrateDB `DATE_BIN` / downsampling bucket sizing) instead of post-filtering rows.

The binding is resolved centrally by
`MeshBoardStateService.resolveStreamDataTimeArgs(ignoreTimeFilter, timeShift)`; every
stream-data widget calls it.

**Per-widget opt-out:** the config dialog of each stream-data widget shows an
**"Ignore MeshBoard time filter"** toggle (only when the selected query is a
stream-data query). Enabling it sets `ignoreTimeFilter: true` on the data source
so the saved query's intrinsic time range wins. Runtime queries ignore the time
filter binding entirely and never show the toggle.

### Time shift: previous period and same period last year (AB#9094)

A stream-data persistent-query source can query a calendar-shifted copy of the board's time
filter, so a KPI or chart can sit next to the same value for the previous period or the same period
last year (Grafana's per-panel "time shift", Power BI's `SAMEPERIODLASTYEAR` / `DATEADD`):

```json
{ "type": "persistentQuery", "queryRtId": "<rtId>", "queryFamily": "streamData",
  "timeShift": { "by": "year", "count": -1 } }
```

- `by: 'period'` moves by the board's selected period type: a year, quarter, month or day selection
  moves by whole calendar periods in the board's time-zone mode (October 2026 → September 2026, the
  whole 30 days; Q1 2026 → Q4 2025; 2026-03-30 → 2026-03-29). A custom range of whole days (no time
  of day) moves back by its number of calendar days in the board's time-zone mode, also across a DST
  change, so its bounds stay local midnights (30.03 – 06.04.2026 → 22.03 – 29.03.2026). A relative
  range, a custom range with a time of day and a host-set range (`timeRange`, AB#7582) move back by
  their exact length (2026-11-03 – 2026-11-10 → 2026-10-27 – 2026-11-03).
- `by: 'year'` moves by calendar years in the board's time-zone mode (Q1 2026 → Q1 2025, February
  2025 → the 29 days of February 2024); bounds of a relative, custom or host-set range keep their
  wall-clock time. A 29 February start lands on 28 February and a 29 February end (exclusive) on 1 March,
  so the window keeps its length: the day 28.02.2024 becomes 28.02.2023, 28.02.2024 23:00 – 29.02.2024 01:00
  becomes 28.02.2023 23:00 – 01.03.2023 01:00. A window that starts and ends on 29 February moves to 28 February.
- `count` is a negative integer (`-1` = one period back). Any other value, a missing `by` or an
  unknown unit means no shift; such a value is not written back on save.
- Window bounds are local midnights of the shifted period, also across a DST change (March 2026 =
  2026-03-01T00:00+01:00 to 2026-04-01T00:00+02:00), never the unshifted instants minus fixed hours.
- With `ignoreTimeFilter: true` the shift is ignored and the query's own bounds apply. Runtime
  queries ignore it. A resolution-aware line chart resolves its archive/rollup on the shifted
  window (same zone, aggregation and point count). An invalid host period blocks a shifted widget
  like an unshifted one.
- The same `timeShift` key exists on a stats-grid / summary-card `persistentQuerySource` and on a
  process widget binding. Without it every board queries exactly as before.

**In the widget editor (AB#9095).** The config dialogs of the KPI, line chart, bar chart, pie chart
and table show "Compare with" under "Ignore MeshBoard time filter", for stream-data queries only:
*None*, *Previous period* (`by: 'period'`) or *Same period last year* (`by: 'year'`), and for the
last two *Periods back* (1 to 10, saved as `count: -N`). *None* removes `timeShift` from the widget.
While "Ignore MeshBoard time filter" is checked the control is disabled and says the shift has no
effect; a saved shift is kept but not applied. Gauge, heatmap, stats grid, summary card and process
widgets have no control: they apply a `timeShift` written into the board configuration, and saving
their dialog drops it. A chart has one shift: the primary query's shift applies to every query series
of a line or bar chart that uses the MeshBoard time filter (like Grafana's panel time shift), and a
series' own `timeShift` is ignored (overlaying two periods is not supported yet). The KPI dialog adds
*Show change* under *Compare with* (AB#9245, see *KPI Widget*).

**On the widget.** A widget whose own data source applies a shift shows the shifted period under its
title (stats-grid / summary-card cells and process bindings with a `timeShift` show no caption), in the
board's time zone: `September 2026` for a month, `Q4 2025` for a quarter, `2025` for a year, the date
for a day and `03.11.2026 - 09.11.2026` for any other range. The tooltip names the shift and the exact
range with the zone, e.g. `Previous period: 01.09.2026 - 30.09.2026 (Europe/Vienna)`; a bound that is
not a local midnight (a relative range, a custom range with a time of day, a host period) shows its
time, e.g. `Previous period: 14.11.2026 09:17 - 15.11.2026 09:17 (Europe/Vienna)`. The caption shows dates only. The caption
follows the board time filter, stays visible while the widget loads or shows no data, and is cut with
an ellipsis in a narrow tile. A heatmap's own time window, like ignoreTimeFilter, takes precedence
over the board filter and the shift, so such a heatmap shows no caption. Widgets without a shift (or with the
time filter ignored) look as before; a chromeless tile shows its header only for the caption.

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
