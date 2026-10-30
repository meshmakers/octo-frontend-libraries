# Changelog

Notable changes of the `@meshmakers/*` libraries in this repository (shared-services, shared-ui,
octo-ui, octo-process-diagrams, ...). Newest first. Entries reference the Azure DevOps work item.
Visual or API changes that apps must react to are marked **BREAKING**.

Process: changes are added under "Unreleased" with the commit that makes them. When a release is
tagged (`r*` tag), the person who sets the tag renames "Unreleased" to that version (and date) and
starts a new empty "Unreleased" section.

## Unreleased

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
