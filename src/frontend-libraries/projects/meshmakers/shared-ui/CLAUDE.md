# @meshmakers/shared-ui - CLAUDE.md

## Build Commands

```bash
# From frontend-libraries root
npm run build:shared-ui

# Lint
npm run lint:shared-ui

# Run tests
npm test -- --project=@meshmakers/shared-ui --watch=false
```

## Documentation and Testing Standards

- **All developer documentation must be written in English**
- **Every code change must include updated documentation** — update README.md, CLAUDE.md, or inline docs when adding, modifying, or removing features
- **Unit tests and integration tests must be executed** after every code change
- **Existing tests must be updated** when the behavior of tested code changes
- **New tests must be added** when new features, components, or services are implemented
- Never commit code with failing tests

## Architecture Overview

### Components

| Component | Selector | Key Pattern |
|-----------|----------|-------------|
| `ListViewComponent` | `mm-list-view` | Data-source directive binding, Kendo Grid |
| `BaseFormComponent` | `mm-base-form` | Form wrapper, auto unsaved changes detection |
| `BaseTreeDetailComponent` | — | Base class for tree + detail layouts |
| `TreeComponent` | `mm-tree` | Kendo TreeView with drag-drop |
| `CronBuilderComponent` | `mm-cron-builder` | ControlValueAccessor, reactive forms |
| `TimeRangePickerComponent` | `mm-time-range-picker` | Multiple modes, Date + ISO outputs |
| `CopyableTextComponent` | `mm-copyable-text` | Clipboard API |
| `EntitySelectInputComponent` | `mm-entity-select-input` | Autocomplete with dialog fallback |

### Dialog Services Pattern

All complex dialogs use the service pattern — inject the service, call `show*()` method, get back a `DialogRef` or `Promise`:

```typescript
// Confirmation
const confirmed = await this.confirmationService.showYesNoConfirmationDialog('Title', 'Message');

// Progress
const dialogRef = this.progressWindowService.showDeterminateProgress('Title', progress$, options);

// Input
const result = await this.inputService.showInputDialog('Title', 'Label');
```

Services registered via `provideMmSharedUi()`:
- `ConfirmationService`
- `FileUploadService`
- `InputService`
- `ProgressWindowService`
- `NotificationDisplayService`
- `MessageListenerService`
- `MessageDetailsDialogService`
- `EntitySelectDialogService`
- `SaveAsDialogService`
- `ImportStrategyDialogService`

### Data Source Pattern

For `mm-list-view` data binding, create directive extending `DataSourceBase`:

```typescript
@Directive({
  selector: "[appMyDataSource]",
  exportAs: 'appMyDataSource',
  providers: [{ provide: DataSourceBase, useExisting: forwardRef(() => MyDataSourceDirective) }]
})
export class MyDataSourceDirective extends OctoGraphQlDataSource<MyType> {
  constructor() {
    super(inject(ListViewComponent));
    this.searchFilterAttributePaths = ['fieldName'];
  }

  fetchData(options: FetchDataOptions): Observable<FetchResultTyped<MyType>> {
    // ... GraphQL query ...
  }
}
```

### Unsaved Changes System

Two-level protection:
1. **Browser level** — `UnsavedChangesDirective` hooks `beforeunload`
2. **Router level** — `UnsavedChangesGuard` as `canDeactivate` guard

Components implement `HasUnsavedChanges` interface:
```typescript
export class MyComponent implements HasUnsavedChanges {
  hasUnsavedChanges(): boolean { return this.form.dirty; }
  async saveChanges(): Promise<boolean> { /* optional save */ }
}
```

### ListViewComponent Column Types

```typescript
interface TableColumn {
  field: string;
  displayName: string;
  dataType: 'text' | 'numeric' | 'boolean' | 'date' | 'bytes' | 'statusIcons' | 'cronExpression';
  // ... width, sortable, filterable, hidden, etc.
  formatter?: (value: unknown, item: unknown) => string;
}
```

Status icon columns use `StatusIconMapping` for icon/color/tooltip per value.

**Responsive column behavior (`minWidth` / `hideBelow`)**

Column widths are px numbers; auto columns (no `width`) share the leftover space and — without
guards — collapse to zero once fixed-width siblings exceed the container. Two per-column knobs
prevent that:

- `minWidth` — floor for auto columns. When the leftover space per auto column drops below it,
  the column is pinned to `minWidth` and the grid overflows into a horizontal scrollbar. Also
  used as Kendo's `minResizableWidth`.
- `hideBelow` — hides the column while the list view itself (not the browser viewport) is
  narrower than the given px. Use it to declare column priority: detail columns get breakpoints,
  identity columns keep their room.

Component width is tracked via ResizeObserver. Related component inputs: `resizable`
(default `true` — drag column edges), `actionsColumnWidth` (default `220`; lists with only an
edit button + context-menu trigger should pass ~100) and `hideCheckboxesBelow` (default `600` —
the row-checkbox column disappears on phone-width hosts; pass `null` to always show it). Below
600px component width the host also gets the `mm-list-view-narrow` class: the toolbar wraps and
the search input stretches to a full row. The host element is a vertical flex
container: grant it height (e.g. `flex: 1` from the page layout) and the grid fills it, scrolling
its body internally with the pager pinned to the bottom edge.

**Card mode (`cardModeBelow`, AB#4930)**

Below this component width (px) the rows render as **stacked cards** instead of
a horizontally scrolling table: the FIRST column becomes the card's bold title
line, every other column a labeled body line (label = `displayName`; empty
values are skipped so cards stay tight; `hideBelow` is ignored because cards
have vertical room), and the actions-column buttons plus the ⋮ context-menu
trigger move into the card header. All `dataType` renderings (statusIcons,
badge, iso8601, formatter, …) are shared with the table via one cell template,
so cards and cells always look identical. While cards are active the host
carries `mm-list-view-cards`, the column headers (sorting) and the row filter
are unavailable — toolbar search, quick-view bars, paging, selection and the
context menu keep working. The row checkbox stays visible in card mode even
below `hideCheckboxesBelow`, so selection-dependent toolbar actions remain
usable on phones. Default `null` = always render the table (fully backwards
compatible); pass e.g. `[cardModeBelow]="600"` to match the narrow-toolbar
breakpoint. Styling is theme-neutral (`--kendo-color-border` /
`-primary` / `-subtle`); hosts restyle via the `.mm-card*` classes.

**Paging (`pageSize` / `autoPageSize`)**

- `pageSize` defaults to **20** (raised from 10 — ten rows left large screens half empty with a
  detached pager).
- `autoPageSize` (default `false`) enables fit-to-height paging: the component measures the grid
  content viewport and the rendered row height (ResizeObserver on host + `.k-grid-content`,
  re-measure after every load) and applies `floor(contentHeight / rowHeight)` (min 5) as the page
  size via `MmListViewDataBindingDirective.applyPageSize()`, which realigns `skip` to the new page
  grid and refetches. `pageSize` acts as the initial page size until the first measurement, so the
  very first fetch may be adjusted once. The pager's page-size dropdown is hidden in this mode —
  a manual choice would be overridden on the next resize.

**Server-binding invariants (`MmListViewDataBindingDirective`)**

- **Filter/search changes reset to page 1.** `notifyFilterChange()` (the path used by the
  dropdown/range filter cells) and the debounced text search reset `skip` to 0 before
  refetching — a changed filter changes the result set, so the old page offset would point
  into stale data or past the end. Kendo's own filter-row path already does this via its
  `dataStateChange` event; the programmatic paths must mirror it.
- **Bar-filter changes reset to page 1 via `fetchAgain({ resetSkip: true })`.** App-side
  quick-view/bar filters live in the data source, outside the Kendo state, so their change
  path is `DataSourceBase.fetchAgain()`. Data sources MUST pass `{ resetSkip: true }` when
  their own filters changed — the directive then resets `skip` to 0 and persists the reset
  (same invariant as above). A plain `fetchAgain()` (data refresh) keeps the current page.
- **Out-of-range pages self-heal.** When a fetch fails and
  `DataSourceBase.isPageOutOfRangeError(err)` says the page offset lies beyond the result
  set (e.g. a persisted `skip` restored against filters that now match fewer rows — the
  OctoMesh API rejects that with an `INCOMPLETE_SLICE` GraphQL error, detected by
  `OctoGraphQlDataSource`'s override in octo-ui), the directive resets to page 1, persists
  it and refetches once (`skip === 0` cannot be out of range, so no loop). Without this the
  grid would silently keep showing the PREVIOUS rows under the NEW filters.
- **`rebind()` cancels the previous in-flight fetch** before starting a new one. Overlapping
  fetches (sort/page click while a load is in flight, autoPageSize measurement refetch)
  would otherwise race last-response-wins, letting a stale response overwrite newer data.
- Sort and filter state survive paging and `applyPageSize()` — covered by
  `mm-list-view-data-binding.directive.spec.ts` (real Kendo grid + directive harness).

**State persistence (`persistListState` / `listStateKey` / `ListStateService`)**

The user's sort, row filter, free-text "search all columns" value and current
page **survive navigation and browser restarts** so lists no longer reset on
every visit. **On by default** for every `mm-list-view` in every app.

The free-text search lives outside the Kendo `state` (it is passed to
`fetchData` as `textSearch`), so it is persisted separately: the directive
saves `_textSearchValue` alongside the state and, on restore, both carries it
into the initial fetch and mirrors it into the search box via
`ListViewComponent.restoreSearchValue()`.

- `MmListViewDataBindingDirective.restoreState()` runs in `ngOnInit` **before**
  the first `rebind()`, so the initial fetch already carries the remembered
  sort/filter/skip (via the inherited Kendo setters). It persists again from
  `onStateChange` (header sort, filter row, pager), `notifyFilterChange`
  (dropdown/range filter cells) and `applyPageSize`.
- `ListStateService` (`services/list-state.service.ts`, `providedIn: 'root'`)
  stores a single `localStorage` blob `mm-list-view-state` = `{ [key]: { sort,
  filter, skip } }`, mirroring `WindowStateService`. Every access is guarded —
  a corrupt/unavailable store falls back to no state, never breaking a list.
- **`take`/`pageSize` is deliberately not persisted** — in `autoPageSize` mode
  it is re-derived from the viewport each load; restoring it would fight the
  measurement.
- **Date filter values** are `Date` objects; `JSON` round-trips them to ISO
  strings, so `ListStateService.load()` re-hydrates ISO-8601 strings back to
  `Date` (the Kendo date filter cell needs a real `Date` or date filtering
  breaks after restore).
- **Key:** `listStateKey` if set, else the current route path (without query
  string), which is stable per list page. Set an explicit `listStateKey` when
  two lists share a route, or to keep state stable across a route rename.
- **Opt out** a transient/embedded list with `[persistListState]="false"`.
- Coarse app-side "quick view" bars (e.g. an Active/Done/All toggle, a category
  or date-range filter held in an app signal, not in the Kendo grid state) are
  the host app's own state. It can persist them under the **same list key** via
  `ListStateService.saveExtra(key, value)` / `loadExtra<T>(key)` — stored as an
  opaque `extra` blob merged into the same entry as the grid state (neither
  clobbers the other).

**Toolbar actions (`leftToolbarActions` / `rightToolbarActions`, AB#4897)**

Each `CommandItem` renders depending on its shape:

- `children` **and** `onClick` → **`kendo-splitbutton`**: the main segment fires
  `onClick`, the arrow opens the children (e.g. a "New ▾" with variants).
- `children` without `onClick` → `kendo-dropdownbutton` (a pure menu group).
- otherwise a plain button.

Toolbar-specific `CommandItem` fields: `fillMode` (default `'solid'`; use
`'flat'` for low-emphasis controls such as an icon-only overflow "…" menu — an
item with `svgIcon`, empty `text` and `children`) and `tooltip` (title
attribute, falls back to `text`; set it on icon-only items).

An `isDisabled` **callback on a toolbar item receives the current checkbox
selection** (always an array of row items, possibly empty) — use
`isDisabled: (sel) => !Array.isArray(sel) || sel.length === 0` to grey out
selection-dependent actions instead of answering an empty-selection click with
a hint message. In the actions column and context menu the callback receives
the single row item, as before.

**Reset filters button (`resetFilters` output)**

A toolbar "Reset Filters" button (`filterClearIcon`) sits next to the reload
button. It calls `MmListViewDataBindingDirective.resetState()` — clears row
filter, sort, free-text search and page, and **drops the persisted entry**
(incl. the app `extra`) so nothing is restored next visit — then emits the
`ListViewComponent.resetFilters` output. The host binds `(resetFilters)` to
reset its own quick-view/bar-filter signals back to their defaults. Tooltip
text: `ListViewMessages.resetFilters`.

**Total count (`DataSourceBase.totalCount`)**

`DataSourceBase` exposes a readonly signal `totalCount` (`null` before the first result), kept
current by `MmListViewDataBindingDirective` from each fetch's `totalCount`. Host pages can bind it
(e.g. a header badge showing "14 Data Flows") without issuing a second query:
`<span>{{ dir.totalCount() }}</span>` via the exported data-source directive reference.

**Custom cell formatting (`formatter`)**

Use the optional `formatter` callback when the standard `dataType` rendering is not enough — currency, units, conditional labels, etc. The callback receives the raw field value and the full row item, and returns the cell's display string. Filtering and sorting still operate on the underlying field, so a numeric column with a currency formatter still sorts numerically and filters via the numeric input cell.

```typescript
{
  field: 'grossTotal',
  dataType: 'numeric',
  formatter: (value) => new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' })
    .format(Number(value))
}
```

### Styling

All components use **neutral, theme-agnostic defaults**. Host applications override via CSS custom properties or `::ng-deep`. No hardcoded theme colors in the library.

### Window sizing (`WindowStateService`)

`resolveWindowSize(dialogKey, defaults, min?)` resolves a dialog's opening size
from the per-session persisted state (sessionStorage `mm-window-states`) with
two guards:

- **Sub-min stored sizes** fall back to the caller's defaults (presumed
  corrupt captures), never clamp-to-min — clamping would trap the dialog at
  min permanently.
- **Viewport clamp:** the resolved size (defaults OR stored) is clamped to the
  current viewport minus a 24px margin per side, so a large default or a size
  captured on a bigger monitor can never push the dialog's action bar below
  the fold on small resolutions. The clamp deliberately wins over the dialog's
  minWidth/minHeight; stored sizes stay untouched, so returning to a larger
  screen restores them. Tests pin the protected `viewportSize()` seam
  (`spyOn`) because `window.innerWidth` is not assignable in Karma — specs
  that assert verbatim dialog dimensions must pin it to a large screen.

## Key Development Patterns

1. **Service-based dialogs** — Dialogs opened via injected services, not direct component instantiation
2. **ControlValueAccessor** — CronBuilder integrates with reactive forms via CVA
3. **Data source abstraction** — `DataSourceBase` handles pagination/filtering/sorting for list views
4. **Environment providers** — `provideMmSharedUi()` registers all services at app level
5. **Command pattern** — ListViewComponent uses `CommandItem` for toolbar/context menu actions

## Detailed Documentation

- [Time Range Picker](docs/time-range-picker.md) — Full API, configuration, examples
- [Unsaved Changes Guard](docs/unsaved-changes-guard.md) — Implementation guide with checklists
- [Progress Window Usage](src/lib/progress-window/USAGE.md) — Examples, migration guide
