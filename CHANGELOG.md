# Changelog

Notable changes of the `@meshmakers/*` libraries in this repository (shared-services, shared-ui,
octo-ui, octo-process-diagrams, ...). Newest first. Entries reference the Azure DevOps work item.
Visual or API changes that apps must react to are marked **BREAKING**.

Process: changes are added under "Unreleased" with the commit that makes them. When a release is
tagged (`r*` tag), the person who sets the tag renames "Unreleased" to that version (and date) and
starts a new empty "Unreleased" section.

## Unreleased

### octo-ui entity-forms: number fields parse "." and "," safely (AB#8734)

- Fix: the `number` editor of `mm-entity-form` no longer uses the Kendo numeric text box, which parsed with the locale's
  symbols only — in a German locale "77.5" was stored as 775 without a warning. The new `mm-entity-form-number-editor`
  accepts both "." and "," as the decimal separator when the text holds one of them once; with both, the last one is the
  decimal separator and the other one must group digits in threes; a grouping in the wrong place ("1.23,4") is refused
  with a field error, never guessed. The locale's group symbol before exactly three digits ("1.234" in de-DE,
  "1,234" in en-US) is refused as ambiguous with both ways to type it, except in whole-number fields, where it groups
  the thousands. While the user edits, the parsed value is shown below the field in the locale's format
  ("Value: 77,5"), with a note when a single separator that is neither of the locale's symbols was read as decimal.
  Whole-number fields refuse a fraction.
- New messages (English defaults): `validationNumberGrouping`, `validationNumberAmbiguous`, `validationInteger`,
  `numberParsedValue`, `numberParsedValueAmbiguous`; validation error key `numberFormat` (`NUMBER_FORMAT_ERROR`, shown before `required`).
- New exports: `EntityFormNumberEditorComponent`, `parseLocaleNumber`, `formatLocaleNumber`, `formatLocaleNumberInput`.
- Visual change: number fields lose the spinner buttons; doubles are no longer cut to six decimals.

### octo-ui entity-forms: configurable data adapter (AB#8591)

- New (non-breaking, additive): `EntityFormDataAdapter` — `load(context)` returns the form values,
  `save(context, changeSet, values)` returns `EntityFormSaveResult` `{ applied, fieldErrors?, message?, failure?, rtId? }`.
  Configured with the new `dataAdapter` input of `mm-entity-form` / `mm-entity-page` or the `ENTITY_FORM_DATA_ADAPTER`
  token. Types `EntityFormDataContext`, `EntityFormSaveResult`, `EntityFormSaveFailure`.
- The runtime-entity GraphQL path is the default adapter `RtEntityFormDataAdapter` (`EntityFormDataService.load` /
  `create` / `update`). Without a configured adapter `mm-entity-page` behaves as before.
- New on `EntityFormComponent`: `save(context)` (validate, before-save hook, adapter, field errors; a second call while
  one runs resolves `failure: 'busy'`), `getValues()`
  (every field in form shape) and `showSaveFieldErrors(errors)`. Save field errors are shown also on fields the user
  changed, until the user edits the field again; the existing `fieldErrors` input is unchanged (pristine fields only).
- `mm-entity-page`: an adapter result with `applied: false` keeps the form open, shows the field errors and the
  message. README: "Data adapter" with the contract and an example.

### octo-ui entity-forms: archive correction forms (AB#8591)

- New (non-breaking, additive): the reserved form category `ArchiveCorrection` for a `System.UI/EntityForm` that
  describes the editable data columns of one stream-data archive (well-known name `archive-correction-{archiveKey}`).
  `ARCHIVE_CORRECTION_FORM_CATEGORY`, `isArchiveCorrectionForm`, `archiveCorrectionFormName`,
  `matchesArchiveCorrectionFormName`, `pickArchiveCorrectionForm(type, archiveKey, forms)` (tenant before seeded, then
  priority) and `resolveEntityFormDefinition(type, form, source, opts)` (resolves a given form without picking; same
  field rules as `resolveEntityForm`).
- Behaviour: `pickEntityForm` / `resolveEntityForm` / `EntityFormService.resolve`, `entityFormCatalog`,
  `entityFormTypeTitles` and `resolveByFormKey` ignore forms of that category, so a seeded correction form never
  becomes the page form, settings entry or display name of its target type. No form with that category existed before.
  README: "Archive correction forms" (how a blueprint ships one as seed data).

### shared-ui: list view PDF export prints dates in one line, umlauts, and has a measured row limit (AB#8630)

- Fix (non-breaking): the PDF export of `mm-list-view` printed `date` columns as the raw `Date.toString()`
  ("Wed Jan 01 2025 01:00:00 GMT+0100 (…)", wrapped over four lines, about 4 rows per page) and dropped umlauts and
  ß (the standard PDF fonts have no glyphs for them). Date and date-time columns (`date`, `iso8601`) now print in one
  line, locale-aware (`LOCALE_ID`, `31.12.2025 23:45:00` in `de-AT`; a column `format` is applied as an Angular date
  format; a `formatter` wins), and the PDF embeds DejaVu Sans (regular and bold, Latin subset). The font is a lazy
  chunk of about 91 KB (37 KB compressed) loaded on the first PDF export only. License text:
  `fonts/licenses/dejavu-LICENSE.txt`.
- Fix (visible change): the black-and-white PDF styles of the list view (10px text, 1px black borders, compact
  cells) never reached the PDF: Kendo draws from a clone of the table appended to `<body>`
  (`.k-grid-pdf-export-element`), which the encapsulated `:host-context(.k-pdf-export)` rules did not match. They
  are now global rules on `.k-grid-pdf-export-element`, so the PDF has about 15 instead of 4 to 8 rows per A4 page.
- Fix (visible change): grid cells of `dataType: 'date'` columns showed the raw `Date.toString()` as well; they now
  use the same one-line formatting (also in the cell tooltip and in card mode).
- Changed default: `pdfExportRowLimit` (and `DEFAULT_PDF_EXPORT_ROW_LIMIT`) is 1,000 instead of 5,000. Kendo lays out
  and draws the PDF in one synchronous run on the main thread; 5,000 rows froze the tab for minutes. The value is
  measured on the demo page (AB#8630, 35,040 rows, four columns, Chrome): longest main-thread block 1.4 s for 500 rows,
  4.6 s for 1,000, 14.7 s for 2,000, 73 s for 5,000 (before: 286 s for 5,000); a larger PDF is cut with the existing warning "PDF export limited to N of M
  rows. Use the Excel export for all rows." Apps that set `pdfExportRowLimit` themselves are unaffected.

### shared-ui: list view exports CSV (AB#8123)

- New (non-breaking): "Export to CSV" in the `mm-list-view` toolbar next to Excel and PDF, with the same all-rows
  fetch, row limit and messages as the Excel export (AB#8122). UTF-8 with BOM, header row with the column titles,
  RFC 4180 quoting, CRLF line ends. Formula-like text (`=`, `+`, `-`, `@`, tab, CR) gets a leading `'` (CSV
  injection) in every cell and header title, including text in date columns that is no date; numbers written as
  text stay unchanged.
- New inputs: `csvExportFileName` (`Export.csv`), `csvSeparator` (`;`) and `csvLocale` (default: the app's
  `LOCALE_ID`, so German Excel reads `1234,5` and `31.12.2025 23:45:00`; `null` = locale-neutral numbers and ISO dates).
- New optional `ListViewMessages.exportToCsv`; `ListViewCommand.id` gains `'csv'`. New exports: `buildCsv`,
  `downloadCsv`, `quoteCsvField`, `neutralizeCsvFormula`, `CsvValueFormatter`, `CsvColumn`, `CsvFormatOptions`.

### shared-ui: list view exports all rows, not only the page on screen (AB#8122)

- Fix (non-breaking): with server-side paging the Excel and PDF export of `mm-list-view` contained only the current
  page, without a message. They now contain all rows of the current filter, search and sort, fetched through the
  list's data source in sequential requests of `exportPageSize` rows (default 2,000). The list stays usable while
  the toolbar shows the progress; a failed request shows an error notification and writes no file. Lists whose grid
  already holds every row (client-side data, a single page) export as before. The grid's page, sort, filter and the
  persisted list state do not change.
- New inputs: `exportPageSize` (2,000), `exportRowLimit` (50,000) and `pdfExportRowLimit` (5,000). A result above
  the limit is cut to the first N rows with the warning "Export limited to N of M rows." (PDF: names the PDF limit).
- New optional `ListViewMessages`: `exportPreparing`, `exportProgress`, `exportLimited`, `pdfExportLimited`,
  `exportFailed`. New exports: `fetchAllRowsForExport`, `formatExportMessage`, `DEFAULT_EXPORT_PAGE_SIZE`,
  `DEFAULT_EXPORT_ROW_LIMIT`, `DEFAULT_PDF_EXPORT_ROW_LIMIT`.

### octo-services: allow-list edits detect concurrent changes (AB#8520)

- New (non-breaking, additive): `getCrossTenantGrantPermissions()` and `setCrossTenantGrantPermissions()` return
  `CrossTenantGrantPermissionsResult` — the list plus `etag` (the server's `ETag` header, `null` when none; identity
  AB#8432, contract §6.1). `setCrossTenantGrantPermissions(targetTenantIds, ifMatch?)` sends `ifMatch` unchanged as
  `If-Match`; without it the request is the same as before.
- `CrossTenantGrantPermissionsError`: `Conflict` (412) is now sent by the server and carries `currentEtag`; new `kind`
  `PreconditionRequired` (428, `Identity:CrossTenantGrantPermissions:RequireIfMatch` on and no `If-Match`). 428 is
  caller-handled like the other typed statuses. Apps should keep the `etag` of the loaded list and pass it back before a
  cluster switches `RequireIfMatch` on.

### shared-ui: list view forgets the checkbox selection when its data reloads (AB#8428)

- Fix (non-breaking): Kendo drops its row selection whenever the grid gets new data (refresh, delete, sort, filter,
  search) without emitting `selectionChange`, but `mm-list-view` kept its own copy. Selection-dependent toolbar actions
  (`isDisabled`/`onClick` receive the selection) then stayed enabled for rows that were no longer ticked or no longer
  existed. `MmListViewDataBindingDirective` now calls the new `ListViewComponent.clearSelection()` with every data load.

### octo-services: allow-list of the source tenant (AB#8430)

- New (non-breaking, additive): `IdentityService.getCrossTenantGrantPermissions()` and
  `setCrossTenantGrantPermissions(targetTenantIds)` call `{issuer}{currentTenant}/v1/crossTenantGrantPermissions`
  (AB#8345, contract `CONCEPT-SIBLING-TENANT-GRANTS.md` §6): the target tenants whose administrators may look up this
  tenant's users by exact user name or e-mail and grant them access. The PUT replaces the whole list; `[]` permits nobody.
- New DTO `CrossTenantGrantPermissionsDto` and typed error `CrossTenantGrantPermissionsError` with `kind` `Forbidden` (403),
  `Invalid` (400 validation problem, `validationErrors` with the server's reasons), `NotAvailable` (404, identity without
  AB#8345) and `Conflict` (412, prepared for If-Match of AB#8432; the server does not send it yet). These statuses are
  caller-handled (no global toast); other errors are rethrown unchanged.
- If-Match (AB#8432) will be an optional second parameter of `setCrossTenantGrantPermissions`; existing callers stay unchanged.

### octo-services: cross-tenant grants in the current tenant (AB#8427)

- New (non-breaking, additive): `IdentityService.lookupSourceUser`, `createExternalTenantUserMapping`,
  `getExternalTenantUserMappings` and `deleteExternalTenantUserMapping` call the tenant-scoped routes
  `{issuer}{currentTenant}/v1/externalTenantUserMappings` (contract `octo-identity-services/docs/CONCEPT-SIBLING-TENANT-GRANTS.md`),
  so the target tenant's Users page can look up a user of a parent or permitted sibling tenant, grant with groups, list
  and remove grants (Feature AB#8314).
- New DTOs `SourceUserLookupRequestDto`, `SourceUserLookupResultDto` (no e-mail) and optional `groupIds` on
  `CreateExternalTenantUserMappingDto` (left out of the body when `null`/`undefined`).
- New `CrossTenantGrantError` with `kind` mapped from the problem `code`: `SourceUserNotFound` makes the lookup return
  `null`; `NotAvailable` (404 without code, identity without AB#8341), `SourceUserLookupRateLimited` (+ `retryAfterSeconds`
  from the body), `SourceTenantNotPermitted`, `UnknownGroup` (+ `unknownGroupIds`), `ExternalTenantUserMappingAlreadyExists`
  (+ `existingMappingId`), `RoleChangeRefused` and `Forbidden` (title passed through). Other errors are rethrown unchanged.
- Every `403` of these routes is typed and marked caller-handled (`MM_CALLER_HANDLED_STATUSES`), so the global error
  interceptor shows no toast for it; the page shows its own message per `kind`. Untyped errors keep the interceptor's
  default reporting (`MmHttpErrorInterceptor.reportsToUser`).
- The `adminProvisioning` methods (system-tenant route, parent view) are unchanged.

### shared-ui fonts (web fonts shipped with the library, AB#7682)

- New (non-breaking, additive): `@meshmakers/shared-ui` ships the web fonts of the shared theme (Roboto, Montserrat,
  Roboto Mono; 20 `woff2` files, `fonts/fonts.css`, SIL OFL licence texts), so an app no longer needs a Google Fonts
  `<link>`: one entry `node_modules/@meshmakers/shared-ui/fonts/fonts.css` in the `styles` of the app build
  (`src/frontend-libraries/projects/meshmakers/shared-ui/docs/fonts.md`). Apps that load the fonts from Google today (Refinery Studio, meshmakers-app) switch to it and
  drop the link; Energy Community, which loads no fonts, adds the entry.

### shared-ui list view (actions in the empty state, AB#7628)

- New (non-breaking, additive): `ListViewEmptyActionsDirective` (`<ng-template mmListViewEmptyActions>` inside
  `mm-list-view`). With `[emptyState]` set, its content (e.g. the page's "New ..." button) is rendered inside
  `mm-empty-state`, below the text, in `.mm-list-view-empty-actions`. Only in the `empty` variant: not while the list
  loads and not in the "no results" variant (search, row filter or `hasExternalFilters`). A list without the template
  renders exactly as before.

### octo-meshboard: board authors give chart categories and series readable names in the widget config (AB#7235)

- New: the pie chart takes `categoryLabels`, the bar chart `categoryLabels` and `seriesLabels`, the line chart
  `seriesLabels` in its widget `Config` - a plain map from the raw value to the text to show, e.g.
  `"categoryLabels": { "1-1:2.9.0 G.03": "Feed-in" }`. Slices, axis labels, legend and tooltip show the name. Display
  only: queries, filters, series grouping, `excludedSeriesGroupValues` and `categoryColors` keep matching the raw value.
- A value without an entry, a missing key and an empty map show what the chart showed before. The pie chart's
  precedence is the widget entry, then the host `MESHBOARD_LABEL_RESOLVER`, then today's text; bar and line charts
  never asked the resolver and still do not. When two raw series values get the same name, the series whose
  raw value differs from the name is shown as `Name (raw value)`.
- The pie, bar and line config dialogs have a *Category Names* / *Series Names* section (`mm-value-labels-editor`,
  exported as `ValueLabelsEditorComponent`). Both keys are written to the board JSON only when set; boards without
  them load and save unchanged.

### octo-meshboard: bar chart main value axis scales to the data again (AB#8234)

- Fix (regression of AB#8046): every bar chart series was bound with `[axis]="... : ''"`. The main value axis is
  unnamed, so the empty axis name detached all main-axis series from it: the axis stayed at 0-1.2 and bars were drawn
  far outside the plot. The main axis is now named (`primary`) and its series bind to it; the secondary axis is
  unchanged. Specs assert the binding with and without a secondary-axis series.

### octo-meshboard: one malformed process-diagram element no longer crashes the MeshBoard or empties the widget dialog (AB#8151)

- Fix: a diagram element without `config` (e.g. a tank written through the API/MCP), with an unknown `type` or without
  `position`/`size` threw while the widget template rendered and took the whole board down; the config dialog then
  opened with empty tabs. The widget now validates the loaded diagram (`sanitizeProcessDiagram`): invalid elements and
  connections are skipped, each invalid element is drawn as a dashed red placeholder naming it, a hint at the bottom of
  the widget lists them, and one console warning per problem is written. The stored diagram is never modified.
- The widget config dialog loads such a diagram, keeps the Mappings/Connections tabs populated from the valid parts and
  shows the same validation hint under the diagram picker. A `null` entry in `primitives` no longer breaks the
  connection list.

### octo-meshboard / octo-ui: process widget dialog layout fixes — readable Field column, dark-theme delete confirmation, scrolling filter grid (AB#8025)

- Fix: at the dialog's ~600 px width the Mappings tab squeezed the Field input into the 55 px type column
  ("ca…"); the narrow layout now uses two equal columns and the Field input carries its value as tooltip.
- Fix: the delete confirmation of a binding card was light text on a light pink fill in the dark theme (~1.1:1); it
  now uses the theme surface and text colours with an error-coloured edge.
- Fix (octo-ui `mm-field-filter-editor`, shared by all widget dialogs): the filter grid is 680 px minimum and scrolls
  horizontally inside its frame in narrow hosts; the Value column and the row actions are no longer cut off.
- The empty "Connections" hint now says that only line / polyline / path shapes with a direction binding are listed
  (plain connections between elements have no direction to pick).

### octo-meshboard: board authors leave chosen series out of a grouped line chart (AB#8128)

- New (non-breaking) `LineChartWidgetConfig.excludedSeriesGroupValues: string[]`: raw `seriesGroupField` values
  whose series the chart leaves out — not queried, not drawn, not in the legend. Exact match on the stored value.
  Works on the raw archive and on rollups, in every mode of the primary query (entity groups, per-source
  fan-out, plain grouping). Example: `["1-1:2.9.0 G.03R"]` hides the series of that OBIS code.
- All values excluded, or none left: the chart's normal no-data state, never one merged series over the whole
  scope. A value that does not occur changes nothing. The entity-selector scope still applies to the remaining
  series.
- Line chart dialog: *Field Mapping → Excluded series* (pick a value or type one); choosing another series group
  field or query clears the list.
- The key is written only when not empty; existing boards encode byte-identically.

### octo-meshboard: a new stream-data line chart can be completed in the dialog — Field Mapping offers `timestamp` and `rtId` (AB#8069)

- Fix: stream-data rows carry their time stamp and source entity as row properties, not as columns, so the line
  chart's Field Mapping offered neither a category (time) field nor a grouping field for a new stream-data chart.
  The dialog now adds `timestamp` (DATE_TIME) and `rtId` (STRING) in front of the query's columns
  (`withStreamDataRowFields`, only when the query has no column of that name; runtime queries unchanged).
- The line chart reads `timestamp` / `rtId` from the row when no cell of that name exists
  (`streamDataRowFieldValue`; single-query raw and downsampled rows, multi-source primary), so
  `categoryField: timestamp`, `seriesGroupField: rtId` gives one line per source entity.

### octo-meshboard: per-series options in line and bar charts — missing values as 0 or last value, colour, line style, a fixed bucket size, bar series as line (AB#8046)

- New (non-breaking) series options on `LineChartSeriesDisplayOptions` (additional series of line and bar charts, and
  `primarySeries`): `missingValues` (`'gap'` default, `'zero'`, `'carryForward'`; query and primary series),
  `carryForwardLookbackMinutes` (line chart, default 1440), `color` (CSS colour, custom property or status name;
  not for the primary series), `dashType` (`'solid' | 'dash' | 'dot'`), bar chart only `asLine` and `secondaryAxis`.
  All are omitted when default, so existing charts encode byte-identically.
- Missing values: `zero` turns an empty selector scope (a site without battery) into a series of zeros and fills
  single empty buckets; `carryForward` takes the last value of the series (on-change signals), and the line chart
  fetches the value at the window start with one extra downsampling request over the look-back. Filled values are
  the formula operands too. Buckets after "now" are never filled; a failed source is never shown as zeros.
- `LineChartWidgetConfig.bucketMinutes` (1, 5, 10, 15, 30, 60; `LINE_CHART_BUCKET_MINUTES`): the window is snapped to
  whole buckets in the board's time zone, every source is downsampled with `(to - from) / bucket` buckets and the
  chart shows every bucket of the window (`alignOnFixedGrid`; 96 quarter hours per day, 100 on 2026-10-25). Without
  it the bucket count follows the chart width as before. Note: a raw archive with fewer distinct timestamps than
  buckets is still clamped by the backend; such a source fills only the buckets its points start in.
- Bar chart: a series can be drawn as a line over the columns (column types), optionally on a second value axis
  on the right, with colour and line style.
- Hidden series (also a hidden primary) never produce chart-level hints ("No data", error, grid); their failure shows
  only on the dependent formula series ("depends on <source>, which failed").
- Series editor: a "Display" line per row (Missing values + look-back, Colour, Line style, bar: Draw as line /
  Second axis) and Missing values / Line style on the primary row; line chart dialog: Bucket size. Wireframe
  section 6 of the AB#7951 series-editor wireframe.
- New exports: `SeriesMissingValues`, `SeriesDashType`, `LINE_CHART_BUCKET_MINUTES`,
  `DEFAULT_CARRY_FORWARD_LOOKBACK_MINUTES`. A library version before AB#8046 ignores the new keys; when it saves the
  board it drops `bucketMinutes` and the new primary options (series entries are stored as they are).

### octo-meshboard: process widget dialog edits several data bindings, the aggregate of each mapped value and the direction of each connection (AB#8025)

- New (non-breaking): the Data Binding tab of the process widget dialog is a list of binding cards — add, rename,
  duplicate and delete bindings; per card the name (required, unique, inline error), the source (runtime entity /
  persistent query), the entity selector it follows (all selectors of the board plus "None") and filters. Duplicate
  and delete are icon actions on the card header; deleting a binding that mappings use asks first, lists the affected
  properties and clears their mappings. A card that follows a selector not on the board shows a warning tag and blocks
  Save with a message naming binding and selector. Keyboard: every card header is a tab stop (Enter toggles, Delete
  starts the confirmation); the dialog wraps at 600 px.
- Mappings tab: Binding and Aggregate columns (First row, Sum, Average, Minimum, Maximum; fixed to First row for
  non-number properties and runtime-entity bindings). The source type of a mapping follows its binding (entity →
  attribute, query → column); the former Source column is gone. Renaming a binding moves its mappings along.
- Connections (wireframe approval condition on AB#7954): the Mappings tab lists the diagram's connection lines
  (line / polyline / path primitives with a direction effect: `animation.enabled`, `visible`, `style.stroke.*`,
  `style.opacity`) and lets the author pick per line which mapped value drives its direction. Stored as the new
  optional `ProcessWidgetConfig.connectionDirections` (`ProcessConnectionDirection`: `connectionId`, `propertyId`);
  the widget re-points the line's direction effects at that property at load time (`applyConnectionDirections`), the
  stored diagram stays unchanged. Unknown connections / properties are reported once and ignored.
- Compatibility: an existing widget opens with one card "Default" and saves byte-identically; exactly one card named
  `default` is still written in the legacy single-binding fields, anything else as `bindings`. `connectionDirections`
  is written only when set. A library version before AB#8025 ignores `connectionDirections` (the lines follow the
  diagram's own bindings).

### octo-process-diagrams / octo-meshboard: text element bound to a live value with unit, decimals and the board language (AB#8022)

- New (non-breaking): binding effect `text.value` (`BindingEffectType`) with the optional
  `PropertyBinding.textFormat` (`TextValueFormat`: `unit`, `decimals` 0–6, `noValueText`). It replaces the content of
  a text primitive with the formatted value: expression first (e.g. `abs(value)`), then the number in the board
  language with fixed decimals and the unit (`14,4 kW` de-AT, `14.4 kW` en-GB; grouping per locale, CLDR de-AT
  groups with a non-breaking space like the KPI widgets). A string result is shown as it is plus unit. No value
  (no data yet, null/empty cell, missing attribute, non-numeric input of a number property, failed expression) shows
  `noValueText` (default "–") — never 0 and never the static design-time text.
- New exports of `@meshmakers/octo-process-diagrams`: `evaluateTextValue`, `formatTextValue`,
  `applyTextValueToPrimitive`, `textValueInput`, `textValueDecimals`, `textValueNoValueText`,
  `TEXT_VALUE_DEFAULT_LOCALE` (de-AT), `TEXT_VALUE_DEFAULT_NO_VALUE`, `TEXT_VALUE_MAX_DECIMALS`;
  `SymbolRenderContext.locale`. The formatter has no MeshBoard dependency; the process widget hands in the host
  language (`MESHBOARD_LANGUAGE`, fallback `WIDGET_NUMBER_LOCALE`).
- Binding editor: group "Text" › "Text value", offered only for text primitives (text inside a symbol is bound in
  the symbol editor), with Unit (default = the property's unit), Decimals, "No value shows" and a preview in de-AT,
  en-GB and without value. Designer simulation, designer symbol preview and symbol editor simulation show the
  formatted text live.
- Text on a connection: bind it with `abs(value)`; the line's direction effects carry the sign.
- Behaviour change (simulation only): an emptied number field in the simulation panel now means "no value"
  (`null`) instead of 0; other effects then use the property default.
- Compatibility: diagrams without a `text.value` binding render exactly as before (same primitives, no format
  fields written); legacy Label/Display/Gauge elements keep `toFixed` and "--". A library version before AB#8022
  ignores `text.value` bindings (the static text stays).

### octo-meshboard: bar charts combine series from several queries and formula series, matched per category (AB#7953)

- New (non-breaking): `BarChartWidgetConfig.additionalSeries` (`BarChartSeriesDefinition` = the line chart series model)
  and `primarySeries` (`{ visible: false }` only). Query series carry their own `categoryField`
  (`LineChartQuerySeries.categoryField`, new, optional, ignored by the line chart), stream-data query, entity selector
  and time-filter opt-out. Bars of all sources are matched by category value (date-times by instant), the categories
  are the union of all sources (chronological when all are date-times, else first appearance, primary first), and a
  category a source lacks has no bar for its series — never a 0 bar. Daily date-time categories are labelled as dates.
- Formula series are evaluated per category with the line chart's util and composition (`composeChartSeries`):
  missing operand or non-finite result = no bar and "–" in the (shared) tooltip; cycles and unknown keys are rejected in
  the dialog; hidden operands work in formulas; "depends on <source>, which failed" hints and per-source error hints.
- `valueScale` is applied to every source value (primary static and dynamic, query series) before formulas see it — in
  the multi-source path only; a single-query static chart is unchanged (AB#7923 stays open for that).
- Config dialog: Series section (stream-data primary query) with `mm-line-chart-series-editor` in the new
  `alignment="category"` mode (category field per query row, preset from the primary category field or `timestamp`;
  no Resolution-aware, no Stacked). The line chart dialog is unchanged.
- Existing bar charts (static and dynamic) render and encode byte-identically: both keys are written only when set.
- **Note for downgrades:** a library version before this one ignores `additionalSeries` on bar charts and drops it when
  the board is saved there. Roll out this library to every app that edits the board before authors add series.


### octo-meshboard: process values summed, averaged or reduced to min/max over a binding's scope (AB#8024)

- New (non-breaking): `DiagramPropertyMapping.aggregate` — `'first' | 'sum' | 'avg' | 'min' | 'max'`
  (type `ProcessValueAggregate`), default `first`. A column mapping of a persistent-query binding reduces the
  numeric cells of all rows of the binding's selector scope (e.g. the sum of `activePower` over all appliances of
  the picked site); null, undefined and non-numeric cells are skipped. Zero rows or no numeric cell give the
  property no value (its effects are skipped), not 0. The mapping `expression` runs on the aggregate
  (`sum`, then `value / 1000`). When the query's `totalCount` exceeds the loaded rows, the aggregate is still
  computed and one console warning names the binding and the counts.
- Aggregation works on **query bindings only**: a runtime-entity binding loads one entity. An aggregate other than
  `first` on a runtime-entity binding, an attribute mapping or a non-number property is reported by
  `validateProcessWidgetBindings` (new optional `propertyTypes` argument) and falls back to the first row.
  To aggregate over all entities of a scope, bind a runtime persistent query with the entity selector.
- Compatibility: mappings without `aggregate` read the first row as before; `aggregate` is persisted verbatim with
  the mapping. The editor control follows in AB#8025.

### octo-services: admin password reset sends the password in the request body (AB#8008, Security)

- `IdentityService.resetPassword(userName, password)` now posts `{ userName, password }` as the JSON body of
  `POST {tenant}/v1/users/ResetPassword` instead of URL query parameters (URLs end up in request logs, traces and proxy
  access logs). New exported interface `ResetUserPasswordRequestDto`. The method signature is unchanged.
- **Compatibility:** identity services with AB#8008 refuse the query form with 400, older identity services do not
  accept the body form — ship this library (and the Refinery Studio build that uses it) in the same release train as
  the identity service.

### octo-meshboard: formula series in line / stacked area charts (AB#7952)

- New (non-breaking): `LineChartFormulaSeries` (`kind: 'formula'`, `key`, `label`, `formula`) in
  `additionalSeries` — a series computed per time bucket from other series of the chart, e.g.
  `consumption = ${pv} + ${gridImport} - ${gridExport} - ${batteryCharge} + ${batteryDischarge}` and
  `pvDirect = min(${pv} - ${gridExport} - ${batteryCharge}, ${consumption})`. Operands are the keys of the other
  additional series (query or formula); the primary query's series are not operands. Same syntax and evaluator as the
  KPI / gauge formulas (expr-eval via `ExpressionEvaluatorService`), no new expression engine. New pure util
  `utils/meshboard-series-formula.ts` (`evaluateSeriesFormulas`, `orderSeriesFormulas`, `validateSeriesFormulas`),
  exported for the bar chart (AB#7953).
- Gap rule: a bucket with a `null` operand or a non-finite result (division by zero) is a gap, never 0; the tooltip
  shows "–". A formula series whose operand source failed shows "<series>: depends on <source>, which failed"; a
  formula series without any valid bucket keeps its legend entry with " (no data)".
- New per-series display options `visible` / `stacked` (query and formula series) and `primarySeries` for the
  primary query's series: a hidden series stays usable as operand but is absent from chart and legend; in a stacked
  area chart a series with `stacked: false` is drawn as a line over the stack. All keys are written only when not
  default, so existing boards encode byte-identically.
- Config dialog: "Add formula series" rows with the shared formula field (series keys as insertable names, no
  preview), Visible / Stacked checkboxes per row and on the primary row; circular references are rejected with the
  names involved. `FormulaFieldComponent` got the optional inputs `showPreview`, `variablesLabel`, `namesNoun`,
  `syntaxHint` and `emptyVariablesText` (defaults unchanged).
- **Note for downgrades:** a library version before this one drops formula series when it loads a board, and ignores
  `visible` / `stacked` / `primarySeries` (hidden operands would be drawn). Saving the board with such an older
  library removes the formula series for good. Roll out this library to every app that edits the board before
  authors add formula series.

### octo-meshboard: "Browse Queries" lists stream-data queries in a stream-data-only picker (AB#7951)

- Fix: `PersistentQueryDialogDataSource` (the query picker's "Browse Queries" dialog) now keeps the query entity's
  `ckTypeId`, so its family filter can classify the queries. Before, every query counted as unknown, and a
  stream-data-only picker (a series row of the line chart) listed nothing although the pager counted the queries.
  Latent since AB#4187; the autocomplete was not affected.
- Note: empty value-field pickers for stream-data queries whose stored column paths are not camelCase (EnergyIQ seed:
  `ActivePower`) come from the backend typing those columns STRING. That is fixed in the asset repository (AB#8030);
  the dialogs offer the column types as the backend reports them.

### octo-meshboard: several data bindings per process widget, each with its own entity selector (AB#8023)

- New (non-breaking): `ProcessWidgetConfig.bindings` — named `ProcessWidgetBinding`s (`name`, `mode`
  `runtimeEntity` | `persistentQuery`, `ckTypeId`/`rtId` or `queryRtId`/`queryFamily`, `entitySelectorId`,
  `ignoreTimeFilter`, `filters`) and `DiagramPropertyMapping.bindingName`. One flow picture can show values of
  several CK types of the picked site; all bindings load in parallel and re-query in the refresh that follows a
  leader-selector change. A pending binding gets no value without blanking the others (the widget stays loading
  only while every binding is pending); an empty scope gives no value; a failing binding is named in a small error
  badge on the widget. A runtime-entity binding without `rtId` loads the current entity of its selector.
  Config problems (e.g. a runtime-entity binding with neither `rtId` nor selector, a mapping with an unknown
  `bindingName`) are reported once in the console (`validateProcessWidgetBindings`).
  Connection effects (flow direction via forward / reverse `animation.enabled`, `visible`, stroke colour) follow
  whichever binding their property is mapped to, so flow lines show the direction from the sign of their value;
  0 or no value gives no flow (pattern in octo-meshboard `CLAUDE.md`).
- Compatibility: a config without `bindings` is read as one binding named `default` from the legacy fields and
  loads, refreshes and saves byte-identically; mappings without `bindingName` use `default`; a widget with exactly
  one binding named `default` is saved in the legacy shape. The legacy config dialog keeps the bindings and
  mappings of a widget that has named bindings (it edits only diagram and display options there; the binding
  editor follows in AB#8025).

### octo-meshboard: line / stacked area chart with series from several stream-data queries (AB#7951)

- New (non-breaking): `LineChartWidgetConfig.additionalSeries` — query series (`kind: 'query'`, `key`, `label`,
  own `PersistentQueryDataSource` with entity selector, time-filter opt-out and resolution-aware routing,
  `valueField`) plotted after the primary query's series on one time grid. `LineChartSeriesDefinition` is a union
  discriminated by `kind`, ready for formula series (AB#7952). New `stacked` for area charts (series stack in their order).
  Config dialog: new "Series" section (`mm-line-chart-series-editor`: add, remove, reorder by keyboard) and a
  "Stacked" option for area charts.
- Alignment: all sources are downsampled over the same window with one bucket count (the smallest of the pixel
  target and every resolved rollup `points`), then aligned by `utils/time-grid-alignment.ts` (`alignOnTimeGrid`):
  a missing bucket is `null` (gap, never 0); a source whose buckets do not sit on the grid is left out with a hint.
- Widget states: per-source hints for a failed source (name + message), a source without data ("No data for …")
  and a misaligned source; loading until every source answered. A stacked or multi-source chart sets Kendo
  `missingValues: 'gap'` explicitly; single-query charts bind Kendo's defaults and render unchanged. Both new keys
  are persisted only when set, so existing boards encode byte-identically.

### octo-meshboard: gauges, tables and charts bind to Integral (kWh) columns (AB#7975)

- New (non-breaking): the config dialogs of gauge, table, bar chart, pie chart, line chart, heatmap and widget group
  list the `<attr>_integral` column of a stream-data Integral query, like the KPI since AB#7921. They load the
  columns through `QueryExecutorService.fetchStreamDataColumns` with `columnProbeWindow(boardWindow)` (new util:
  the board's time window, else the last 24 hours). `fetchStreamDataColumns` takes an optional
  `{ forceRefresh }` (table dialog). New `QueryExecutorService.executeWithProbeWindow(family, rtId, options, window)`
  runs a picker query with the same silent-first, windowed-retry rule; the gauge and KPI dialogs use it for the
  category values of a grouped Integral query.
- Changed: a `null` query cell (e.g. an Integral over an empty window) is "no data" in the widgets, not `0`:
  the gauge shows its empty state `-`, a bar chart draws no bar, a pie chart leaves the slice out, a line chart
  draws no point (not 0) and the heatmap skips the row (sum/avg; a count ignores the value). A real `0` stays `0`, and a
  missing cell or missing category/series combination keeps its old `0`.

### octo-meshboard: no error toast for the Integral column probe (AB#7985)

- Fixed: selecting a query with an `Integral` column in a widget config dialog no longer shows the error toast
  "TimeWeightedAverage, StateDuration and Integral over a raw archive require From and To" when the column list
  then loads. The window-less first attempt of `fetchStreamDataColumns` runs with the `OCTO_SILENT_ERRORS`
  context (logged to the console only); the error of the windowed retry is still shown.
- New (non-breaking): `QueryExecutionOptions.silentErrors` for stream-data calls whose caller handles the failure.

### shared-ui EntitySelectInput: the input follows the host pick (AB#7916)

- Fixed: `mm-entity-select-input` `initialDisplayValue` now follows every change of the host's pick. An empty
  value clears the text and the selection; a new name replaces the text. Before, both were ignored once a value
  had been shown or picked, so the MeshBoard toolbar kept showing a dependent pick (e.g. a room) that a leader
  change had cleared or replaced. Host changes emit no `entitySelected` / `entityCleared`.
- Fixed: the clear button also clears a pick that was only shown by name (restored from the URL), emitting
  `entityCleared`.

### octo-meshboard KPI: energy (kWh) from a stream-data Integral query (AB#7921)

- New (non-breaking): a KPI in aggregation mode bound to a persisted stream-data aggregation query with an
  `Integral` column shows the energy over the board's time window, correct for every sampling rate (5 s, 10 s,
  on change). `queryValueField` is the `_integral` column (e.g. `importpower_integral`); `valueMultiplier` is
  only the unit factor (1 for kW → kWh, 0.001 for W → kWh).
- New: `QueryExecutorService.fetchStreamDataColumns(rtId, window)` lists the columns of a stream-data query and
  retries with a window when the query cannot run without from/to (Integral). The KPI config dialog uses it with
  the board's time window (last 24 h without a time filter), so the `_integral` column appears as value field.
- Changed: `matchesAttributePath` treats `_integral` as an aggregation suffix, so an Integral column never
  cross-matches the plain attribute, the `_sum` column or another attribute whose name ends in "Integral".
- Changed: a KPI query cell that is `null` (e.g. an Integral over an empty window) shows the empty state `-`
  instead of `0`; `applyValueMultiplier` passes `null` through.
- Schema: `INTEGRAL` added to `AggregationType`, `AggregationTypes` and `SystemAggregationTypes`
  (`schema.graphql`, `globalTypes.ts` via codegen).

### shared-services: 403 problem+json refusals show their title, no generic "Access denied" (AB#7969)

- Changed: `MmHttpErrorInterceptor` shows the readable text of a 403 `application/problem+json` body (`title`
  when the body carries the `code` extension, else `detail`) instead of the generic
  "Access denied. You do not have permission to access this tenant or resource." — e.g. identity's role-change
  refusals `self-grant` / `role-not-held`. `reportsToUser(error)` stays `true` for these, so pages that skip their
  own toast on `true` show the server's sentence exactly once.
- Fixed: `reportsToUser(error)` answers `false` for an error whose status the request marked as caller-handled
  (`MM_CALLER_HANDLED_STATUSES`) — the interceptor stays silent there, so the caller must show the message.
- Unchanged: a 409 problem (identity's `last-administrator` / `built-in-role`, `CK_UPGRADE_BLOCKED`) stays the
  caller's job; a 403 without a body, with the tenant middleware's `{message}` body or with a default ASP.NET
  problem (title "Forbidden", no `code`/`detail`) keeps its current text.

### octo-meshboard heatmap: weighted mean, bucket-end timestamps, own time window (AB#7956)

- New (non-breaking): aggregation `weightedAvg` with `valueField` (sum column) and `weightField` (count column):
  cell = Σ sum / Σ count, the exact mean of the raw rows behind a rollup. A cell without rows stays empty (no
  colour, no label, tooltip "No data") instead of 0; a real mean of 0 is coloured. Rows without a usable value or
  weight are skipped.
- New: `timestampIsBucketEnd` + `bucketWidthMinutes` move each row back to its bucket start before hour/day
  bucketing (rollup rows carry the bucket end, so the bucket ending at 09:00 counts for 08:00). Ignored when
  `dateEndField` is set.
- Changed: hour and day follow the board time zone incl. DST for every aggregation; a fall-back day keeps its
  repeated hour as its own row `02:00 (2)` (2026-10-25 in Europe/Vienna shows 25 hours) instead of merging two
  real hours into one cell.
- New: `timeWindow` (`{ value, unit }`, e.g. last 30 days) — a rolling window for the widget's stream-data query
  that overrides the board time filter (`from` floored to the full hour); the widget shows it as a badge
  ("Last 30 days"). Heatmaps without it follow the board filter as before.
- Config dialog: "Weighted mean" aggregation with a Weight Field, "Date marks the end of a bucket" with the bucket
  width, "Own time window" (stream-data queries only); invalid combinations block saving with a message. All new
  keys are omitted from the persisted config when unset, so existing heatmaps encode byte-identically.

### octo-meshboard gauge formula and shared formula field (AB#7950)

- New (non-breaking): the gauge config dialog has the data source **Formula**, like the KPI. The gauge value is a
  formula over MeshBoard variables (same engine, operators and validation as the KPI formula), e.g.
  `max(0, min(100, (1 - ${import} / ${consumption}) * 100))`. Stored as `GaugeWidgetConfig.valueMode: 'formula'` +
  `formula` with a static data source; switching to another data source clears both. Gauges without a formula load
  and encode byte-identically (no migration).
- New shared component `mm-meshboard-formula-field` (`FormulaFieldComponent`, exported): formula input, syntax hint,
  validation message, live preview and insertable variables, used by the KPI and the gauge dialog. Validation is one
  function, `validateFormulaField` in `utils/meshboard-formula.ts`, which the dialogs also use to enable Save.
- Changed: a non-finite formula result (division by zero, `0 / 0`) is no longer an error. `evaluateFormula` returns
  the new status `nonFinite` with a reason; KPI and gauge show `-` with the reason as tooltip and the KPI publishes no
  output value. A gauge formula with a non-numeric result shows the error *Result is not a number*.
- Gauge pointer: the pointer is clamped to the scale (it stops at min/max) while the label shows the real value.

### octo-meshboard heatmap on stream-data queries (AB#7938)

- Fix: the heatmap reads the date of a stream-data row (`StreamDataQueryRow`) from its top-level `timestamp` when
  `dateField` is `timestamp` and no cell carries it. Stream-data cells hold only the value columns, so before the
  fix every row was dropped and the widget showed "No data available". Runtime-query rows still take the date
  only from their cells; a cell matching `dateField` still wins.

### octo-meshboard selector editor: dependent selectors (AB#7917)

- New (non-breaking): the selector editor has a section "List only entities inside" (after *Picker filter*, before
  *Attribute Mappings*; wireframe agreed by the Studio PO). "Inside the pick of" lists other selectors that are
  neither followers nor dependent; the path uses `mm-entity-selector-scope-path-editor` from the leader's CK type,
  1–5 hops, with the last hop's target fixed to the selector's CK type. Validation follows
  `utils/entity-selector-scope-source.ts` (unknown, self, follower or dependent leader; missing or incomplete hops;
  path ending elsewhere) and blocks saving. A selector with dependents can neither pick a leader nor follow one.
- Fix: saving in the editor keeps `scopeSource` (since AB#7915 the save rebuilt the selector without it and dropped
  the setting). "(none)" removes it; a follower's `scopeSource` is removed on save with a notice.
- The collapsed list shows `Inside: <leader> (<n> hops)`; removing a leader names its dependents. A debounced check
  warns when the selector's default entity is not inside the leader's default pick ("Could not check the default
  entity." on an error), never blocking save.
- `mm-entity-selector-scope-path-editor` gets the inputs `lockedTargetCkTypeId` (last hop's target fixed: shown
  read-only, new hops inserted before it, it never moves), `description`, `sourceDescription` and `emptyText`.
  Without them it behaves as before.
### octo-meshboard dependent pick stays inside the leader's pick (AB#7916)

- Behaviour change (no API break): a dependent selector (`scopeSource`, AB#7915) never keeps a pick outside its
  leader's pick. On a leader change the dependent (and its followers) is pending at once; once its picker scope is
  resolved the pick is kept if it is in scope, else its `defaultRtId` if that is in scope, else cleared. Widgets
  refresh once for the whole change; an overtaken change (two quick leader picks) applies nothing. Clearing the
  leader keeps the dependent's pick.
- **Narrowed AB#7721 rule (dependents only):** a dependent without pick while its leader has one shows no data and
  sends no query (`StreamDataScope` `empty` / `noPick`), with the board notice "Pick a <label> to see this data."
  (`MeshBoardMessages.scopePickRequired`). With the leader without pick the persisted scope applies as before. A
  failed picker scope clears the pick and shows the scope-failed notice instead.
- Board load: leaders resolve first; a dependent URL (`es_<id>`) or route-data pick outside the picker scope is
  dropped (default if in scope, else no pick), logged once with `console.info`, and the URL is rewritten with
  `replaceUrl`. Valid pairs restore both picks.
- Host API: `setEntitySelector(dependentId, rtId)` with an rtId outside the picker scope is rejected with a console
  warning and nothing re-queries; `setEntitySelector` / `clearEntitySelector` on a leader run the rules above.
- New API: `EntitySelectorScopeState` status `needsPick`, `MeshBoardStateService.setEntitySelectorScopeNeedsPick`
  and `needsPickEntitySelectorIds`, `StreamDataScope` reason `noPick`, `MeshBoardMessages.scopePickRequired`.
  Boards without `scopeSource` behave and encode exactly as before.

### octo-meshboard dependent entity selectors (AB#7915)

- New (non-breaking, additive): `EntitySelectorConfig.scopeSource = { selectorId, path }` makes a visible selector
  *dependent* on a leader selector (neither a follower nor itself dependent; one level). `path` has 1–5 hops of the
  AB#7723 hop shape from the leader's CK type to the selector's CK type and is always stored as a path. While the
  leader has a pick, the toolbar dropdown and its search dialog list only the distinct entities at the end of the
  path: the view resolves the *picker scope* with `resolveScopePath` + `fetchAssociationTargetRtIds` (one batched
  request per hop, late resolutions of an earlier leader pick discarded) and the picker sends it as field filter
  `rtId IN (…)`, AND-combined with the AB#7724 filter rows and the text search (server side, paging keeps working).
- Picker states: leader without pick → lists unscoped as before; pending → loading, no listing query; resolved
  empty → "No <label> in <leader>." (+ the filter sentence when a filter is set); a failed hop or an invalid
  configuration (unknown/self/chained leader, follower with `scopeSource`, 0 or more than 5 hops, hop without role
  or target type) → lists nothing, "Could not load the <label> of <leader>.", one console error/warning — never the
  unscoped list. Followers ignore `scopeSource`.
- New API: type `EntitySelectorScopeSource`, `MeshBoardStateService.pickerScopes` and `setPickerScopePending` /
  `setPickerScopeRtIds` / `setPickerScopeFailed` / `clearPickerScope` / `getPickerScopeState`, toolbar input
  `[pickerScopes]`. The helpers in `utils/entity-selector-scope-source.ts` stay internal.
- Persistence: `scopeSource` is in the selector whitelist, written only when set; save/reload and the "Manage
  MeshBoards" export/import round-trip it; boards without it re-encode byte-identically.
- Not yet: clearing an out-of-scope dependent pick on a leader change and URL validation (AB#7916); the editor
  setting (AB#7917). Until AB#7917 the selector editor's save drops `scopeSource` of the edited selector.

### octo-meshboard table column titles per language and value labels (AB#7655)

- New (non-breaking, additive): table columns take `titles` (header per culture code; lookup exact culture or
  language, then for a culture its language part, for a bare language such as `de` the first authored key of that
  language (`de-AT`), then `title` - `de-DE` never picks `de-AT`) and `valueLabels` (raw value as string →
  `{ label, color? }`, `label` one text or a text per culture code). A value-label cell is plain text with the optional
  text colour; an unlabelled value keeps the column's `dataType` / `format` rendering (`numeric`, `iso8601`), `null` an
  empty cell; when no label applies for the current language the column renders as without `valueLabels`. Labels win
  over `MESHBOARD_LABEL_RESOLVER`; `valueLabels` with `statusMapping` (status icons) is not supported (labels shown,
  console warning). Unknown culture keys and malformed `titles` / `valueLabels` entries are ignored with one console
  warning per widget, column and set of problems.
- New host language source: `provideMeshBoard({ language })`, `provideMeshBoardLanguage(language)` or the token
  `MESHBOARD_LANGUAGE` (culture code or `Signal<string | null>`; headers and labels follow a signal without a refetch).
  Not provided = `title` / raw values as before; no fallback to `LOCALE_ID`. Also exported: `pickLocalizedText`,
  type `MeshBoardLanguageSource`, `TableColumnValueLabel`.
- **Behaviour change for `MESHBOARD_LABEL_RESOLVER` implementers:** numeric cells of persistent-query columns whose
  value type is an enum now reach the resolver too, as `value: String(value)` (`2` → `'2'`) with `valueType`; string
  cells behave as before. A resolver written for enum names that returns a generic fallback text for unknown values
  now replaces such numbers with that text - return `null` / `undefined` / `''` for values it does not know to keep
  the number.
- Fix: a table widget picks up a new `config` on the same instance (headers, labels, columns); before, the column
  definitions changed only when the language or the time-zone mode changed.
- Fix: the table config dialog no longer erases hand-authored columns. Saving a persistent-query table on the same
  query keeps its explicit `columns` the query still returns (was `[]`), drops the ones it no longer returns and adds
  its other columns as derived columns; runtime-entity columns that stay selected on the same CK type keep
  their properties (`titles`, `valueLabels`, `width`, `format`, `statusMapping`). Existing boards render unchanged;
  Refinery Studio needs no change.

### octo-services base types for the method handler diagnostics (AB#7877)

- Additive: `schema.graphql` and `globalTypes.ts` now contain the system-admin query `methodHandlers` of the
  asset repository (AB#7837): `MethodHandlersQueryDto`, `MethodHandlersAnsweredByDto`, `MethodHandlerMethodDto`,
  `MethodHandlerInstanceDto` and the enums `MethodHandlerMethodStateDto`, `MethodHandlerTransportDto`,
  `MethodHandlerInstanceStateDto`, `MethodHandlerSourceDto`, so the Studio view (AB#7841) imports them from
  `@meshmakers/octo-services`. Nothing was removed or changed. The schema additions come from the SDL export of an
  asset-repo build at 4b393d50 (`SchemaExportTests`, `OCTO_SCHEMA_EXPORT_PATH`), merged additively (sorted like the
  introspected file) instead of a full re-introspection.

### octo-meshboard entity selectors (runtime and grouping queries follow the scope, AB#7725)

- Behaviour change: a widget whose **runtime** persistent query (SimpleRtQuery, AggregationRtQuery,
  GroupingAggregationRtQuery) is bound to an entity selector (`entitySelectorId`) is now restricted to the rtIds the
  selector resolved to. Until now the binding was ignored for runtime queries, so tables, bar and pie charts, KPIs,
  gauges, stats grids, summary cards, heatmaps, line charts and process bindings of a site board showed every entity.
  The restriction runs on the server: the executor adds the field filter `rtId IN (resolved rtIds)`, AND-combined with
  the widget's filters and the saved query's own filters, so a grouping or aggregation query aggregates over the
  scoped entities only (no client-side filtering after a full load). Stream-data queries — including grouping and
  aggregation queries — keep passing the rtIds as `streamDataArgs.rtIds`.
- The empty-scope contract of AB#7721 now applies to runtime queries too: pending → loading, no query; empty or
  failed → no data, no query; no binding or no pick → the query runs as saved. Stats grid and summary card cells no
  longer query the saved scope while their scope is pending (they show `-` until the refresh after the resolution).
- New (additive): `QueryExecutionOptions.scopeRtIds` (family-agnostic scope; runtime → `rtId IN`, stream data →
  `arg.rtIds` unless `streamDataArgs.rtIds` is set), the static helper `QueryExecutorService.withRtIdScope`, and
  `MeshBoardStateService.resolveEntitySelectorScope(entitySelectorId?)` (the selector part only).
  `resolveStreamDataScope(id, family?, ignoreTimeFilter?)` stays the widget entry point: the host-period gate of
  AB#7582 (stream data only) first, then `resolveEntitySelectorScope`; the `family` argument no longer changes the
  selector part.
- Config dialogs: the "Scope to entity selector" field (`mm-entity-selector-scope-picker`, also inside
  `mm-persistent-query-cell-editor`) is now offered for runtime queries as well, not only for stream-data queries.
- Persistence is unchanged: the binding was already saved for both families, so existing boards load, save and
  export/import byte-identically. Boards that had a runtime widget bound to a selector start to follow it.

### octo-meshboard entity selectors (picker filter, AB#7724)

- New (non-breaking, additive): optional `EntitySelectorConfig.filters` of the widget filter type
  `WidgetFilterConfig` (attribute, operator, value; rows AND-combined; every operator of the widget filter editor).
  The toolbar dropdown, its search dialog and the editor's default-entity picker list only matching entities. The
  rows are converted like widget filters (`MeshBoardVariableService.convertToFieldFilterDto`, board variables
  substituted) and sent as GraphQL `fieldFilter` (server side, new helper `utils/entity-selector-filter.ts`,
  `withPickerFilters`); the picker's text search stays on top as one more AND row. Without filter the picker sends
  exactly the query it sent before.
- A filtered picker explains an empty list ("No <label> found. This board only lists <label> that match its
  filter.", naming a filter variable without value) and titles its dialog "Select <label> (filtered)".
- `EntitySelectorToolbarComponent` has a new input `variables` (the view passes the board variables);
  `EntitySelectorEditorComponent` has a new input `variables` (the settings dialog passes the static variables).
- Followers have no picker and ignore filters; the editor hides the section for them and drops hand-edited rows.
  A `defaultRtId` or URL pick that does not match the filter is still applied (the filter affects the listing
  only); the editor warns about a non-matching default without blocking save (debounced server check).
- Selector editor: new "Picker filter" section under CK Type (shared `mm-field-filter-editor`, wireframe approved
  in AB#7724) and a "N filters" chip in the selector list.
- Persistence: `filters` is in the selector whitelist of the board description and omitted when empty, so boards
  without filters encode byte-identically and export / import round-trips the filter.

### octo-meshboard host-set period (`timeRange` / `timeFilterControl`, AB#7582)

- New (non-breaking, additive) inputs on `mm-meshboard-view`: `timeRange` (`{ from, to }` as `Date` or RFC 3339
  strings with an offset - `Z` or `±HH:MM`, seconds required, uppercase `T`/`Z`; compact offsets and dates or times
  that do not exist are rejected; half-open `[from, to)`) lets a host page set the board's period as exact instants;
  `timeFilterControl` (`'board'` default | `'host'`) hides the board's time-range picker and its reset button only.
  While `timeRange` is set, `$timeRangeFrom` / `$timeRangeTo` and every stream-data window use exactly those instants
  (no day snapping, independent of `showTime` and `timeZoneMode`), `tf_*` parameters and the stored/default selection
  are ignored (also after `timeRange` goes back to `undefined`), no `tf_*` parameters are written, there are no unsaved
  changes, and the picker is hidden. With `'host'` and no `timeRange` the board selection applies, but no `tf_*` is
  written. A change reloads the widgets once; `undefined` returns to the board's own selection. An invalid range sends
  no stream-data query bound to the time filter (widgets, process element bindings, widget-group repeater; widgets with
  `ignoreTimeFilter` keep querying) and logs one console error (runtime-query widgets with `$timeRangeFrom` filters are
  not gated - see README). Day buckets and labels still follow `timeZoneMode`: embedders set it to their business zone.
  Default behaviour (no `timeRange`, `'board'`) is unchanged; Refinery Studio needs no change.
- New on `MeshBoardStateService`: `setHostTimeRange(state, owner?)`, `clearHostTimeRange(owner)` (owner-aware, the
  service is shared by views), `hostTimeRange`, `isStreamDataBlockedByHostTimeRange(ignoreTimeFilter?)` (all transient,
  never persisted); `resolveCurrentTimeRange()` returns the host period while the time filter is enabled;
  `resolveStreamDataScope` takes the widget's `ignoreTimeFilter` as optional third argument; `StreamDataScope` `empty`
  has the new reason `invalidTimeRange`. Exports `MeshBoardHostTimeRange`, `MeshBoardTimeFilterControl`,
  `HostTimeRangeState`, `parseHostTimeRange`.
### octo-meshboard entity selectors (multi-hop child scope, AB#7723)

- New (non-breaking, additive): optional `EntitySelectorChildScope.path`, an ordered list of 2 to 5 association
  hops `{ roleId, direction?, targetCkTypeId }` (new type `EntitySelectorScopeHop`, constant `MAX_SCOPE_HOPS` = 5).
  A selector can now scope through several associations (e.g. site → system → device): the source type of hop n is
  the target type of hop n-1, and the scope is the distinct rtIds reached by the last hop. A non-empty `path` wins
  over the top-level `targetCkTypeId` / `roleId` / `direction`, which stay valid as the one-hop form and now are
  optional in the type. Followers (AB#7722) resolve their own path from the leader's pick.
- Query cost: each hop is resolved with one batched request over all entities the previous hop reached
  (`MeshBoardDataService.fetchAssociationTargetRtIds`, new document `getAssociationTargetRtIds`: rtIds only, 100
  sources per request, batches of one hop in parallel, up to 1000 targets per source with a console warning on
  truncation) — never one request per entity. One-hop scopes keep the original request.
- Scope contract (AB#7721) at every hop: an empty hop ends the resolution with an empty scope (no further request);
  a failed hop, or an invalid path (more than 5 hops, a hop without role or target type), is a failed scope with the
  board notice; a slower resolution of an older pick stops after its current hop and never overwrites a newer one.
- Selector editor (MeshBoard Settings → Entity Selectors → Child Scope): the single target/role/direction block is
  replaced by a hop list (new `EntitySelectorScopePathEditorComponent`, `mm-entity-selector-scope-path-editor`;
  wireframe agreed in AB#7723): add (at most 5), remove, move up/down; per hop an association from the source type's
  CK metadata (role, direction and base target in one entry, or "Other role…" for free text) and a target type
  restricted to types derived from the association's target; a warning when a hop's role is not defined on its
  source type, a hint when the metadata cannot be loaded, validation that blocks saving an incomplete hop, and the
  path line. One hop saves in the original top-level form (older library versions keep reading it), two or more
  hops save as `path` only.
- Persistence: `childScope` is carried verbatim in the board description, so `path` survives save, reload and
  export / import from "Manage MeshBoards". Boards with one-hop scopes encode byte-identically and resolve exactly
  as before. An older library version reading a `path`-only scope finds no top-level hop and scopes by the picked
  entity itself.

### octo-meshboard entity selectors (hidden selector follows a visible one, AB#7722)

- New (non-breaking, additive): optional `EntitySelectorConfig.followsSelectorId`. A follower selector has no picker
  of its own: it takes its leader's current pick as its picked entity (CK type = the leader's) and resolves its own
  `childScope` and `attributeMappings` from it, so one visible pick (e.g. a site) rescopes widgets of different
  target types bound to several hidden followers. Changing or clearing the leader's pick re-resolves all followers
  and refreshes their widgets. Followers follow the AB#7721 scope contract: pending while the leader is pending,
  resolved empty when the pick has nothing on the follower's path, and the follower's own `defaultRtId` (else no
  scope) only while the leader has no pick. One level only; an unknown or chained leader counts as "leader has no
  pick" plus a console warning.
- Followers never render a toolbar picker, are not written to the URL and ignore `es_<followerId>` params and route
  data; a URL with only the leader's `es_` param restores every follower. `MeshBoardViewComponent.setEntitySelector` /
  `clearEntitySelector` on a follower warn and do nothing.
- Selector editor (MeshBoard Settings → Entity Selectors): new "Follows" field (only non-follower selectors are
  offered; choosing a leader fixes the CK type and makes attribute mappings and the default entity optional; a
  followed selector cannot follow; validation messages say why), list badge `Follows: <leader>` / `Follows: missing`,
  and a confirmation naming the followers before their leader is removed.
- Persistence: `followsSelectorId` is saved in the board description (selector whitelist) and survives export /
  import from "Manage MeshBoards". Boards without followers encode byte-identically, so boards exported before this
  change import and behave unchanged.

### octo-meshboard entity-selector scope (empty scope shows no data, AB#7721)

- Fix (behaviour): a stream-data widget bound to an entity selector (`entitySelectorId`) whose pick resolves to
  zero rtIds, or whose scope resolution fails, now shows its no-data state and sends **no query**. Before, it fell
  back to the query's persisted scope (usually the whole archive) and showed rows of other entities. While the
  pick resolves the widget shows its loading state and sends no query; the view marks every initial pick (route
  data, `es_<id>` URL param, `defaultRtId`) pending right after a board loads and refreshes the widgets once the
  picks resolved. A failed resolution is logged once and shown as a board notice ("Could not resolve the scope of
  "<label>" ..."; host-translatable via `MeshBoardMessages.scopeResolutionFailed`), so "nothing in scope" and
  "lookup failed" are distinguishable. A pick whose entity no longer exists counts as failed. An unbound widget, a
  bound selector without pick and without `defaultRtId`, and runtime queries are unchanged.
- New (non-breaking, additive) on `MeshBoardStateService`: `resolveStreamDataScope(entitySelectorId?, family?)`
  returning `StreamDataScope` (`unscoped` | `pending` | `scoped` | `empty`), `setEntitySelectorScopePending`,
  `setEntitySelectorScopeFailed`, `getEntitySelectorScopeState`, `failedEntitySelectorScopeIds`; helper
  `emptyQueryExecutionResult` and the types `EntitySelectorScopeState` / `StreamDataScope`. Scope state is cleared on
  board switch. `setEntitySelectorRtIds(id, [])` now means a resolved EMPTY scope.
- Note for custom widgets: `resolveStreamDataRtIds` still returns `undefined` for a pending or empty scope; check
  `resolveStreamDataScope` first and skip the query for `pending` / `empty`. All built-in callers (line, bar, pie,
  KPI, gauge, heatmap, table, stats grid, summary card, process binding) do.
- Also fixed: a slower resolution of an earlier pick no longer overwrites the scope of a newer pick, and
  `MeshBoardViewComponent.clearEntitySelector` now clears the scope as the toolbar clear did.

### octo-meshboard KPI widget (decimal places, AB#7686)

- New (non-breaking, additive): optional `decimalPlaces` on `KpiWidgetConfig` (persisted in the widget `Config` JSON).
  When set, a numeric value is shown with exactly that many fraction digits, also for whole numbers
  (`decimalPlaces: 1`: 38.9 -> `38,9`, 46 -> `46,0`); unset keeps the previous behaviour (two digits for a
  fractional value, none for a whole number). Valid values are the integer numbers 0-3; anything else (strings
  included) falls back to automatic. A negative value that rounds to zero shows no sign. Widget-group
  KPI children receive the setting from `childTemplate.staticConfig`. The KPI configuration dialog has a *Decimal
  Places* field (0-3, empty = automatic).
- Fix: KPI children of a widget group showed `-` instead of their value: the KPI static branch read only
  `staticValue` and ignored the entity data the group passes in `dataSource.data`. It now uses that data with
  `valueAttribute` when present (as the gauge does); a plain static KPI is unchanged. The widget-group
  configuration dialog offers *Decimal Places* for KPI children and keeps the value on save.
- With `decimalPlaces` set, the KPI parses a text value strictly and shows a non-numeric text (`"12 kWh"`, an ISO
  date) unchanged; without it, parsing is unchanged. KPI and heatmap format through the shared, cached
  `formatWidgetNumber` (KPI: exact digit count; heatmap: maximum, unchanged output). The KPI display fields are
  copied through one helper per path (dialog result, persisted config, dialog save).

### octo-meshboard table widget (row action and value markers, AB#7728)

- New (non-breaking, additive): `TableWidgetConfig.rowAction: { label }` — a row action the host app handles. Offered only
  when the host provides `MESHBOARD_TABLE_ROW_ACTION_HANDLER` (`MeshBoardTableRowActionHandler`, receives
  `MeshBoardTableRowActionEvent { widgetId, widgetTitle, meshBoardRtId, actionLabel, row }`); without a handler nothing changes.
- New (non-breaking, additive): `TableWidgetConfig.valueMarkers: [{ field, tooltip, icon?, color?, showValue? }]` — the column's
  cell shows the icon with tooltip when its value is above zero (`isPositiveMarkerValue`), with `showValue: true` also the value,
  else stays empty; works for query-derived columns.
- Both are set in the table configuration dialog and stored in the widget `Config` JSON only when configured.
- New (non-breaking, additive): `TableWidgetConfig.labelFields: string[]` — offers the named columns to
  `MESHBOARD_LABEL_RESOLVER` whatever their type: string and number cells, `value` as text. Boards without the key are unchanged.

### shared-ui shell user menu (avatar, AB#7679)

- Fix (non-breaking): the large avatar in the user menu panel no longer shrinks into an ellipse beside a long account name
  (`.avatar { flex: none }` in `user-menu.component.scss`; before, the flex row `.user-identity` squeezed it horizontally).
  The small avatar in the top bar is unchanged.

### octo-ui entity-forms (field hints, AB#7423)

- New (non-breaking, additive): input `fieldHints` on `mm-entity-form` (`EntityFormFieldHintsProvider`, `EntityFormFieldHint
  { text, actionLabel?, actionId? }`): host hints with an optional action link under fields, re-evaluated on every value change;
  output `fieldHintAction`; `focusField(name)` (also used by `focusFirstInvalid`). Informational, never blocks saving.

### octo-ui entity-forms (generic cross-field validation, AB#7422)

- New (non-breaking, additive): host-registered form-level validators for `mm-entity-form`:
  `provideEntityFormCrossFieldValidators(...)` / `ENTITY_FORM_CROSS_FIELD_VALIDATORS` / input `crossFieldValidators`,
  `EntityFormCrossFieldValidator { ckTypeIds, validate({ values, form, mode }) }`. A validator names the fields that break a
  rule over several fields; they are marked invalid with the host's message (shown at once) and block saving. No
  domain names in the library. `ResolvedEntityForm.ckTypeAncestors` (new) lets a validator target a base type.
- New input `fieldErrors` on `mm-entity-form`: informational host marks on fields (never block saving, vanish on edit).
- Accessibility: error / help text linked by `aria-describedby`, `aria-invalid` on invalid inputs, and
  `markAllAsTouched()` focuses the first invalid field (`focusFirstInvalid()`).

### shared-auth (session identity for browser monitoring, AB#7327)

- New (non-breaking, additive, opt-in): `AuthorizeService` drives an optional `SESSION_IDENTITY_SINK`
  (`SessionIdentitySink { set(identity), clear() }`, `SessionIdentity { userId, name, email, tenantId }`) from one
  `effect()` over the user and token-tenant signals: `set` after sign-in and after every tenant switch (token exchange
  and redirect fallback; not repeated on an unchanged token refresh), `clear` on every session end. A throwing sink only
  produces one fixed-text `console.warn` (no name, no e-mail). No sink provided = no change.
- New secondary entry point `@meshmakers/shared-auth/dash0`: `provideDash0SessionIdentity()` maps the identity to
  `identify(sub, { name, email })` + signal attribute `octo.tenant.id` (same key as the backend services) and clears
  them on session end. `@dash0/sdk-web` ^0.24.0 is an **optional** peer dependency, needed only by apps that import
  this entry point. Name and e-mail are personal data sent to Dash0 (EU) — see the shared-auth README.

### shared-auth (tenant topology client, AB#7053)

- New (non-breaking, additive): `TenantTopologyService.load(scope, { refresh? })` asks identity
  (`GET {issuer}/api/tenant-topology?scope=`, AB#7044) which of the signed-in user's tenants lie below the app root.
  Never throws; returns `topologyKnown: false` with a reason (`identity-too-old`, `hierarchy-unreadable`,
  `unauthorized`, `rate-limited`, `network`, `invalid-response`, `not-configured`) instead. One request, no
  cross-tenant fallback, per-session cache keyed by scope + token tenant + `allowed_tenants`, single flight, cleared on
  sign-out. Helpers `topologyLeaves`, `topologyDirectChildren`, `topologyTenantIds`; test helpers `knownTopology`,
  `unknownTopology`. No new peer dependency.

### shared-auth (tenant topology: older identity answers 200 text/html, AB#7054)

- Fix: an identity older than AB#7044 does not answer 404 for `/api/tenant-topology` but 200 `text/html` (SPA fallback).
  `TenantTopologyService.load()` now maps a 2xx response with a non-JSON content type to `identity-too-old` (cached for
  the session like the 404, so a not-yet-upgraded cluster gets one request, not one per call). A 2xx JSON body of the
  wrong shape or unparsable JSON stays `invalid-response` (not cached).

### octo-ui styles / shared-ui (destructive dialog confirm really red, AB#6464)

- Fix: the error fill of a destructive confirm (`themeColor="error"`) never painted in apps. Kendo Angular adds
  theme colour and fill mode as separate classes, so a default-fill error button carries only `k-button-error`
  (never `k-button-solid-error`); the `octo-button` mixin now matches it (excluding flat / outline / link / clear),
  and outline / flat error buttons in dialog action rows keep the error border and text. Delete confirms, the
  danger confirmation window and Replace-style actions now differ from Cancel without reading the label.

### shared-auth (tenant mismatch blocking state, AB#6731)

- **BREAKING for hosts using `authorizeGuard` with a `:tenantId` route**: when the token still belongs to another
  tenant than the route after the switch attempt, the guard no longer continues (the old
  `Proceeding with current token` console.warn path). It redirects to `/:tenantId/tenant-mismatch`; register
  `TenantMismatchComponent` there (`TENANT_MISMATCH_PATH`). Hosts without that route fall to their wildcard route.
- The guard now tries `AuthorizeService.switchTenantByExchange` (in place) before the redirect flow.
- New: `TenantMismatchComponent`, `TENANT_MISMATCH_PATH`, `AuthorizeService.retryTenantSignIn` /
  `isTenantSignInRetried` (user-initiated sign-in once per tenant, then "not a member").

### octo-services (CK library upgrade guard)

- New: tenant upgrade guard members in the CK library REST DTOs, all optional so an older asset repository still
  works: `CkUpgradeBlockerDto`, `isBlocked` / `blockers` / `isRangeRetaining` on `CkModelLibraryStatusItemDto`,
  `isBlocked` / `blockers` on `UpgradeCheckResponseDto`, `DependencyResolutionResponseDto` and
  `BatchDependencyResolutionResponseDto`, and `CkUpgradeBlockedProblemDto` / `CK_UPGRADE_BLOCKED_CODE` for the
  `409` problem details of a refused import. Null-safe helpers `isCkBlocked`, `ckBlockersOf`,
  `ckFirstBlockerReason`, `parseCkUpgradeBlockedError`. No force member: forcing is an octo-cli / API operation
  (AB#6872).

### shared-ui (move icon)

- New: `MM_ACTION_ICONS.move` (`arrowRightIcon`) for "move to another folder / container"; replaces ad hoc
  `arrowsMoveIcon`, which reads as "add" (AB#6462).

### shared-ui / octo-ui / octo-meshboard / octo-process-diagrams (dialog actions)

- **Visual change, apps must react to nothing:** every dialog footer in the libraries now shows the
  one action layout - right-aligned, buttons at the 34 px control height (new token
  `--theme-control-height-md`), gap `--theme-space-2`, wrapping instead of clipping at 390 px - and a
  destructive confirm (`themeColor="error"`) is an error fill instead of looking like Cancel. Defined
  once: new `MmDialogActionsDirective` (`@meshmakers/shared-ui`, matches `kendo-dialog-actions`, fixes
  the layout to `end`, adds `mm-dialog-actions`) plus the `dialog-actions` styles mixin in octo-ui
  (`octo.styles()`) and an error branch in the `octo-button` mixin. Hosts that include
  `octo.styles()` / `octo.theme()` get it automatically; Studio dialogs follow in AB#6462 / AB#6465.
- Migrated: the shared-ui dialogs (confirmation, danger confirmation, input, save as, progress, import
  strategy, upload, entity select, message details), the MeshBoard dialogs and ~30 widget config
  dialogs (the copy-pasted `.action-bar` / `.dialog-actions` CSS with hard-coded `#dee2e6` / 8 px is
  gone), the process-diagram dialogs and the octo-ui selector / mapping / variable / entity-form
  dialogs. Button order is now Cancel first, confirming action last in input, upload, import strategy
  and message details dialogs; the process-diagram "Delete" is "Delete symbol". (AB#6464)
- Guard: `dialog-actions.guard.spec.ts` fails the shared-ui tests when a dialog footer uses another
  layout or re-declares footer CSS. (AB#6464)

### octo-services / shared-auth / octo-ui (platform files)

- New `FilesClientService` (`@meshmakers/octo-services`): the typed client of the asset-repo file API
  (`{tenant}/v1/files`) — capability detection (`available`, `reason`, limits; re-checked for tenants
  that are not available), upload with per-file progress and conflict mode (`fail|replace|keepBoth`),
  download and inline preview by rtId with the user's bearer and the real file name, linked counts per
  entry, folder statistics, streamed zip and error mapping by the stable server `code`. Metadata
  (roots, folders, files) stays on the tenant GraphQL endpoint (System.Files). (AB#6178, AB#6230)
- New `FileDownloadService` (`@meshmakers/octo-services`): downloads a binary with the user's bearer
  instead of opening the raw `downloadUri`. `mm-property-grid` and `mm-entity-detail-view` use it for
  binary values when the host does not listen on `binaryDownload`; the owner-specific
  `getBinaryInfo` query is gone. (AB#6179)
- New roles `Roles.FileViewer` (read) and `Roles.FileManagement` (write) in `@meshmakers/shared-auth`;
  holders of `ReportingViewer` / `ReportingManagement` receive them by an identity migration. (AB#6179)

### shared-ui / shared-services

- New i18n hook for host-translated library texts (no framework dependency): optional tokens
  `MM_TRANSLATE` (`(key, params?) => string | undefined`), `MM_LANGUAGE` (`Signal<string>`),
  `MM_TRANSLATE_DEFAULTS` (+ `provideMmTranslateDefaults`), the `mmT` pipe, `injectMmT()`,
  `injectMmLanguage()`, and the `liveMessages()` / `messagesFromTranslate()` bridges for the
  existing `*_MESSAGES` tokens (moved from the meshmakers-app). Apps that provide nothing keep the
  English defaults. `shared-ui` now ships `i18n/en.json` + `de.json` (skeletons, namespace
  `MM.SHARED_UI`) as a package asset; `npm run i18n:check` checks the library translations.
  (AB#6163)

- **BREAKING (visual)**: `mm-list-view` toolbar commands (`leftToolbarActions` /
  `rightToolbarActions`) are flat and neutral by default. The rule: a page has exactly one solid
  primary button — its main action (usually "New …"), placed in the page header; every other
  action (import, export, refresh, filters, per-row or per-card actions) is flat or outline. So
  either move the main action into the page header via `[mmPageActions]`
  (`<mm-action-button context="page" display="icon-text" primary>`), or, for a list that is the
  whole page without a header, set `CommandItem.primary: true` on that one toolbar command.
  `fillMode` defaults to `solid` only for primary items. Background: Studio action guideline §9
  (`octo-frontend-refinery-studio/docs/concepts/studio-action-guideline.md`). (AB#6211)
- `CommandItem.disabledReason` now works in the list toolbar: with `isDisabled` the control (plain,
  split or dropdown button) stays focusable (`aria-disabled`), announces the reason
  (`aria-describedby`), shows it in the tooltip and, on keyboard focus, in a hint popup (Kendo
  PopupService under the application root, so the grid cannot clip it; new peer dependency
  `@progress/kendo-angular-popup`, already required by the Kendo buttons); clicks and the menu are
  blocked. A callback receives the current selection. (AB#6211)
- Toast "Show details" icon button: accessible name and sentence-case label `Show details`. (AB#6222)

### octo-ui / entity-forms

- `mm-entity-page` shows the list's create action as the page's one primary in its header,
  labelled "New {form title}" (e.g. "New Discord configuration"); `mm-entity-list` no longer shows
  it in its toolbar there (`showCreateAction`, default `true` for a standalone list). New message
  key **`newEntity`** (`'New {title}'`): apps that translate `EntityFormsMessages` (e.g. via an
  app-side key list such as `ENTITY_FORMS_MESSAGE_KEYS`) must add it, otherwise the English default
  shows. The form title is expected in the singular. (AB#6211)
- `mm-entity-list` input `openAction: 'auto' | 'edit'` (route data `entityListOpenAction`,
  `entityFormRoutes({ openAction })`): `'edit'` labels the row action "Edit" for rows that open a
  host-written editor although the generic form is read-only. (AB#6222)
- Tree navigation settings: Reload is an icon-only button named "Reload tree navigation rules";
  heading "Tree navigation". (AB#6216, AB#6221)

### octo-process-diagrams

- Process diagram and symbol library lists flag their create action `primary` (the list is the
  page) and use sentence-case labels ("New diagram", "New library", "View symbols"). (AB#6211)
