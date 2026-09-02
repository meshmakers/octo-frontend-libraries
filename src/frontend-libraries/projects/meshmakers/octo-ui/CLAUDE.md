# octo-ui Library Guidelines

## Overview

The `@meshmakers/octo-ui` library provides reusable Angular UI components for OctoMesh applications. It includes data source abstractions for GraphQL-based list views, property grids, selector dialogs, and filter editors. All components are designed to be theme-independent and work with any Kendo UI theme.

## Build Commands

```bash
# From frontend-libraries directory
npm run build:octo-ui

# Run tests
npm test -- --project=@meshmakers/octo-ui --watch=false

# Run lint
npm run lint:octo-ui
```

## Project Structure

```
src/lib/
├── attribute-selector-dialog/    # Attribute selection dialog
├── attribute-sort-selector-dialog/  # Attribute selection with sort order
├── ck-type-selector-dialog/      # CK type selection dialog
├── ck-type-selector-input/       # CK type autocomplete input
├── data-sources/                 # GraphQL data source abstractions
├── entity-id-info/               # Entity ID display with copy dropdown
├── field-filter-editor/          # Filter editor component
├── octo-loader/                  # Animated loading indicator
├── property-grid/                # Property grid component
└── tenant-switcher/              # Tenant switching badge with popup
    ├── components/               # Grid and value display components
    ├── models/                   # TypeScript interfaces and enums
    └── services/                 # Property converter service
```

## Theme tokens (light + dark)

`lib/runtime-browser/styles/_theme.scss` defines the semantic `--theme-*`
tokens that `_variables.scss` consumes. Host apps get both themes from one
include; none of them keeps its own palette any more:

```scss
@use "styles/_index.scss" as octo;   // _with-kendo.scss when the host has no Kendo
@include octo.theme();               // :root tokens, dark default + light
@include octo.styles();              // component styling
@include octo.theme-overrides();     // light-theme button contrast — AFTER styles()
```

- `theme()` emits `:root` (brand variables + dark tokens), the
  `prefers-color-scheme: light` block guarded by `:root:not([data-theme="dark"])`
  and the explicit `:root[data-theme="light"]` override.
- `theme-overrides()` is deliberately **not** part of `styles()`: `styles()` is
  also included from component stylesheets, where `:root`-scoped rules do not
  belong and would inflate every component's style budget.
- The brand "neutrals" (`--iron-navy`, `--deep-sea`, `--ash-blue`,
  `--surface-elevated`) are redirected at `--theme-*`, so existing
  `var(--iron-navy)` usages follow the active theme automatically.

**Kendo colour bridge.** `theme()` also declares the `--kendo-color-*` tokens
(surface, surface-alt, subtle, border, base-on-subtle, and
secondary/tertiary/info/success/warning/error) against our theme tokens.

One rule when extending it: Kendo derives every `*-on-subtle` **ink** from the
matching `*-subtle` **surface**, assuming that surface is light. So overriding a
`*-subtle` surface without its ink leaves dark text on a dark pill — that is
what made the identity pages' role and group chips unreadable. We override only
`base-subtle`, hence only `base-on-subtle` is repointed; the other families keep
Kendo's light surfaces and their inks stay correct. The slim Kendo build in `_kendo-theme.scss`
already binds these for hosts using `_with-kendo.scss`; a host that imports the
FULL `@progress/kendo-theme-material` itself does not get them and falls back to
Material's light defaults — which is what made the Meshmakers App's grids,
toolbars and pagers render white on the dark theme. The `:root` declarations
cover both entry points and, unlike a compiled `$kendo-colors` merge, follow the
active theme at runtime. Values resolve to exactly what the slim theme produced,
so this is a no-op for hosts that were already on it.

**Ink overlays (`--theme-ink-02` … `--theme-ink-70`).** The dark-only idiom
`rgba(255,255,255,.03)` — "one step raised off the page" — has no surface-colour
equivalent that works in both themes: alpha-blending a light surface over a light
page yields no contrast. Tinting with the *text* colour does, because it flips
with the theme (white-ish over dark lightens, near-black over light darkens).
Use these ready-made steps rather than spelling out a `color-mix()` per call
site; the long form pushes component stylesheets against their style budget.

`ThemeModeService` + `<mm-theme-mode-toggle>` (primary entry point,
`lib/theme-mode/`) drive the `data-theme` attribute the blocks key off:
three states (`system` → `light` → `dark`), persisted in `localStorage` under
`octo-theme-preference`. It is distinct from `ThemeService` in
`@meshmakers/octo-ui/branding`, which applies a tenant's custom brand palette
on top of the active mode.

## Drawer Hierarchy

`@include octo.styles()` styles the Kendo Drawer with three levels of visual
hierarchy, keyed off the `mm-drawer-level-N` `cssClass` that
`@meshmakers/shared-services` `CommandService` adds to every `DrawerItem` based
on its nesting depth:

- **Level 0** (sections): full-size icons, normal casing.
- **Level 1** (children): indented 40 px, 20 px icons, dimmed text, vertical
  guide line at 24 px.
- **Level 2** (grandchildren): indented 60 px, 18 px icons, dimmer still, guide
  line at 44 px.
- **Level 3+**: intentionally unstyled — deeply nested sidebars are a UX smell.

Kendo's own `k-level-N` classes are **not** used for indentation: the drawer only
emits them while it is expanded, so they vanish in the mini rail.

Two optional hooks are styled for hosts that supply a
`kendoDrawerItemTemplate`:

- `.drawer-group-chevron` — the expand/collapse indicator on a section header.
- `.drawer-badge` — a count badge, which becomes a corner bubble in mini mode.

Mini (collapsed) mode is selected via
`.k-drawer-container.k-drawer-mini:not(.k-drawer-expanded)`. Kendo puts
`k-drawer-mini` on the **container**, not on `.k-drawer` — an earlier
`.k-drawer.k-drawer-mini` rule never matched and left the collapsed rail
unstyled.

All colours come from `--theme-*` / `--octo-*` tokens, so the drawer follows the
active light/dark theme; no per-drawer token namespace is exposed.

## Runtime Browser Localization

`RuntimeBrowserComponent` does not load translations internally. Host applications must supply
`RuntimeBrowserMessages` via the `messages` input. Use
`DEFAULT_RUNTIME_BROWSER_MESSAGES` for English defaults or build translated values using the
app's translation system.

## Runtime Browser association navigation

`RuntimeBrowserDataSource` (shared by the repository browser **and** the
`entity-selector-dialog` picker used by data-mappings) navigates **every**
association of an entity, not only `System/ParentChild`.

- **Auto-discovery from actual edges:** when an entity node is expanded, the data
  source discovers its navigable roles from the entity's **real inbound edges**
  (`associations.definitions`, via `getRuntimeEntityAssociationsById` with
  `direction: INBOUND`, no role filter), grouped by `(roleId, origin CK type)`
  with exact counts. This mirrors the entity detail "Associations" tab and also
  surfaces **orphan roles** — runtime edges whose role is no longer declared on
  the type in the installed CK model (model evolution). The CK type schema
  (`getCkTypeAssociationRoles`, cached) is used only to enrich the friendly
  inbound navigation-property label; unknown roles fall back to the role-id tail.
  No association is hard-coded — new models (e.g. EnergyIQ spaces) work with zero
  configuration. (Earlier iterations discovered from the type schema, which
  silently dropped orphan-edge roles — don't reintroduce that.)
- **Layout:** `System/ParentChild` children stay flattened directly under the
  node (familiar hierarchy). Every other role becomes an expandable **group
  node** (`AssociationGroupNode`, label `<navigationPropertyName> (<count>)`)
  whose targets load lazily on expand via `getTreeAssociationTargets`. The origin
  CK type from the edge is the `ckId` used to load the targets.
- A child entity is marked expandable when its CK type defines at least one
  inbound association role (schema-based, so an expand arrow may open to an empty
  set for an instance that has no related entities — acceptable; refined later).
- Group nodes are **not** runtime entities, so the toolbar create/edit/delete
  actions and the picker's "Select" button stay disabled for them.
- **Per-tenant overrides (AB#4262 Phase 2):** `TreeNavigationConfigService` loads the
  optional `System.UI/TreeNavigationConfiguration` singleton (rtWellKnownName
  `TreeNavigation`, System.UI ≥ 2.2.0) and merges per-role overrides onto the
  auto-discovered roles: `visible` (hide), `displayName` (relabel), `sortIndex`
  (order), `grouped` (flatten vs group node), `icon`. Rules match by
  `(SourceCkTypeId, RoleId)` with `*` as a type wildcard; exact beats wildcard.
  The service probes the CK schema first (`constructionKit.types`) and only queries
  the singleton when the type is installed, so tenants on older System.UI fall back
  to pure auto-discovery without errors. Uses inline `gql` (not codegen) to stay
  decoupled from a schema re-introspection that includes the new CK type.
- **Settings editor (AB#4262 Phase 3):** the admin UI to maintain the config is a
  separate secondary entry point `@meshmakers/octo-ui/tree-navigation-settings`
  (`TreeNavigationSettingsComponent`, `TREE_NAVIGATION_SETTINGS_ROUTES`,
  `TreeNavigationSettingsMessages`) — kept out of the primary entry so apps that
  only render the trees don't pull in the reactive-form / Kendo modules. It edits
  the rule list via `TreeNavigationConfigService.loadConfig()` / `saveConfig()`
  (create or update of the singleton). Refinery Studio mounts it at
  `/:tenantId/ui/tree-navigation` (UI section, `AdminPanelManagement` + System.UI
  installed).

## Runtime Browser tree perspectives (AB#4263)

On top of per-node association navigation, the trees support **multiple
switchable perspectives**, each with its own root. Requires `System.UI >= 2.3.0`
(the `TreeNavigationConfiguration.Perspectives` record array); purely additive
and backend-free (reuses the existing `targets` resolver).

- **Perspective model (`PerspectiveDefinition`):** `key`, `displayName`,
  `sortIndex?`, `icon?`, `rootMode` (`Spatial` | `Type`), `rootCkTypeId?`,
  `primaryRoleId?`, `primaryDirection?` (`Inbound` | `Outbound`),
  `secondaryRoleIds?`. Loaded via `TreeNavigationConfigService.perspectives()`
  (same optional singleton, probe-then-query, cached, cleared by `reset()`).
  The `perspectives` field is fetched by a **separate** query
  (`getTreeNavigationPerspectives`), kept out of the roles `CONFIG_QUERY` on
  purpose: on a tenant still on System.UI **2.2.0** the type exists but the
  `perspectives` field does not, so a combined query would fail validation and
  break the 4262 roles feature. `fetchPerspectivesRaw` swallows that error →
  roles keep working and perspectives come back empty until 2.3.0. For the same
  reason `saveConfig` omits `perspectives` from the mutation when the array is
  empty (trade-off: clearing the last perspective on 2.3.0 is not persisted).
- **Built-in Spatial default:** `RuntimeBrowserDataSource.getPerspectives()`
  synthesizes a `Spatial` perspective (all `Basic/Tree` roots, the pre-4263
  behaviour) and prepends it to the configured list, de-duped by key. With no
  configuration there is exactly one perspective, so the switcher hides itself
  and behaviour is unchanged.
- **Roots per `rootMode`:** `fetchRootNodes()` branches on the active perspective
  — `Spatial` keeps the `Basic/Tree` roots; `Type` loads all runtime instances of
  `rootCkTypeId` as roots (inline `getRuntimeEntitiesByCkType` query) and records
  their rtIds in `perspectiveRootRtIds`.
- **Whitelist-at-root-only:** for a `Type` perspective, the direct children of a
  root are restricted to `primaryRoleId` (flattened at the top, like ParentChild)
  + `secondaryRoleIds` (group nodes). Only TOP-LEVEL roots carry this behaviour:
  their TreeItem id is tagged with `PERSPECTIVE_ROOT_ID_PREFIX`, and
  `rootWhitelistFor(item)` checks that prefix. Deeper nodes have normal ids and
  fall back to full inbound auto-discovery — e.g. a DistributionSystem root shows
  its `SystemMembers`; the served spaces appear one hop deeper under each member.
  N:N members legitimately appear under more than one system (MVP: no explicit
  "shared" badge).
- **Cycle prevention (two layers):**
  1. *Direct-parent back-edge suppression:* the edge traversed downwards (e.g.
     system `--SystemMembers-->` member) is the very same edge the child's
     opposite-direction auto-discovery finds again, so without filtering the
     parent reappears as its own child's child (system → member → system). The
     data source remembers each entity item's tree-parent rtId in a WeakMap
     (`parentEntityRtIds`, registered by `buildEntityTreeItems`, propagated
     through group nodes via `AssociationGroupNode.excludeRtId`) and excludes
     that rtId from the child's edge discovery (counts) and target lists. A
     group whose only edge is the back-edge is dropped entirely; an N:N
     member still shows its *other* systems (only the direct parent is
     excluded, matching by rtId across all roles).
  2. *No perspective re-application on deep recurrences:* should a root entity
     still recur deeper in the tree (over a longer association path), it is NOT
     prefixed and is expanded with inbound auto-discovery (which finds no
     outbound members) instead of re-navigating outbound — so the tree
     terminates instead of looping infinitely. Keying the root marker on the
     TreeItem id (not the entity rtId) is what distinguishes the top-level root
     from its deep recurrence.
- **Navigation direction (`primaryDirection`):** the default auto-discovery is
  INBOUND (the containment side). When the association is authored on the root
  entity — e.g. `EnergyIQ/DistributionSystem --SystemMembers--> member` — the
  members are reached OUTBOUND, so the perspective must set
  `primaryDirection: Outbound`. At a perspective root, discovery
  (`discoverEntityRoleGroups`), the flattened primary fetch and the group-node
  direction all use `perspectiveNavDirection()`; outbound uses the edge
  `targetCkTypeId` and the CK type's `out` roles (`getOutboundRoles`). The
  direction applies to the whole root whitelist (primary + secondary).
- **Switcher:** `PerspectiveSwitcherComponent` (`mm-perspective-switcher`, theme-
  neutral Kendo dropdown) is wired into **both** trees — `RuntimeBrowserComponent`
  and the `entity-selector-dialog` picker. Selecting a perspective calls
  `dataSource.setActivePerspective(key)` then reloads the tree
  (`refreshTree()`), which re-runs `fetchRootNodes()`.
- **Settings editor:** `TreeNavigationSettingsComponent` gained a perspectives
  section (key, label, root mode, root CK type, primary role, comma-separated
  secondary roles, order, icon). `saveConfig(rtId, roles, perspectives)` persists
  both arrays — callers must round-trip perspectives to avoid wiping them.
- The per-tenant `Systems` perspective for EnergyIQ (`EnergyIQ/DistributionSystem`
  + `SystemMembers`) is seeded from the **demo-energy-iq** repo, not here; no CK
  model change is required.

## Mapping Coverage Tree (data mappings)

`MappingCoverageTreeComponent` (`mm-mapping-coverage-tree`,
`src/lib/runtime-browser/components/mapping-coverage-tree/`) is the master-detail
view behind Refinery Studio's Communication → Data Mappings page: hierarchy tree
with per-node DataPointMapping counts, validation overlay (report of the
`ValidateDataPointCoverage` pipeline node), mapping CRUD via
`MappingEditDialogComponent`, and the Orphan Sources tab listing source-catalogue
entities (e.g. `Loxone/Control`) split into mapped/unmapped. Everything is
configured through `MappingCoverageTreeConfig` (roles + CK type ids;
`DEFAULT_MAPPING_COVERAGE_TREE_CONFIG` covers Basic/Tree + System.Communication).

- **Association auto-discovery (AB#4262 port):** the coverage tree is no longer
  limited to the single spatial `childRoleId` hierarchy. On expand, every entity
  node additionally discovers its OTHER inbound association roles from its
  ACTUAL edges (`getRuntimeEntityAssociationsById`, INBOUND, grouped by roleId
  with exact counts) and renders one lazy group node per role (e.g.
  `containedSensors (5)` via `EnergyIQ/SpaceSensors`) — this is what makes
  sensors/actuators/terminals of a Space visible and mappable. The CK type
  schema (`getCkTypeAssociationRoles`, cached per type) supplies the friendly
  label and the origin BASE type used as the `ckId` to load the targets (one
  group across concrete subtypes); orphan roles fall back to the concrete edge
  origin. Excluded from discovery: the spatial `childRoleId` (already
  flattened), `mappingRoleId`/`mappingSourceRoleId` (their edges ARE the
  mapping counts / detail panel) and `validationExecutesRoleId`; origins in
  `NON_NAVIGABLE_TARGET_CK_TYPES` (`System/Entity`) are skipped. Group
  expansion reuses `getMappingCoverageNode` with the group's role as the child
  navigation, so targets carry mapping counts + the spatial look-ahead. A child
  is expandable when it has spatial grandchildren OR its type declares a
  navigable inbound role (schema-based — the arrow may open empty). The
  per-tenant `TreeNavigationConfiguration` overrides (visible / displayName /
  sortIndex / grouped / icon) apply exactly as in the runtime browser;
  `grouped: false` flattens a role's targets into the level. Direct-parent
  back-edges are suppressed (WeakMap parent tracking + `excludeRtId` on group
  nodes, relevant under outbound `Type` perspective roots). Group nodes are
  synthetic (`payload.associationGroup` set, empty `ckTypeId`) — selecting one
  clears the detail pane instead of loading mappings.
- **Orphan catalogue paging:** `loadOrphanCandidates` walks the
  `getOrphanCandidates` connection cursor (`pageInfo.hasNextPage`/`endCursor`,
  500 rows/page, hard stop at 200 pages) until exhausted — an earlier version
  fetched a single 1000-row page and silently truncated larger catalogues.
  NB: `GraphQL.offsetToCursor(0)` returns `null` by contract ("start at the
  beginning"), so the loop is guarded by `hasNextPage`, never by the cursor
  value being non-null.
- **Tree perspectives:** the coverage tree reuses the runtime browser's
  perspectives (AB#4263) — `TreeNavigationConfigService.perspectives()` plus a
  synthesized built-in `Spatial` entry, surfaced via `mm-perspective-switcher`
  in the toolbar (hidden when only one perspective exists). Selecting a `Type`
  perspective repopulates the root dropdown from its `rootCkTypeId` and applies
  a ROOT-LEVEL-ONLY navigation override (`primaryRoleId` +
  `primaryDirection`) via `MappingCoverageTreeDataSource.setRootPerspectiveNav`;
  deeper levels always continue with the spatial hierarchy
  (whitelist-at-root-only, so outbound member navigation cannot cycle). The
  child CK type filter stays `config.childCkTypeId` (polymorphic) — perspective
  members must derive from it. `getMappingCoverageNode` carries separate
  child/grandChild role+direction variables for this.
- **Auto-mapping from the UI (Generation row):** a third toolbar row (shown
  only with a `tenantId`) picks any `System.Communication/Pipeline` — intended
  for `GenerateDataPointMappings@1`-based auto-mapping pipelines — and runs it
  via `CommunicationService.executePipeline`. Polling is shared with the
  validation Run button (`executePipelineAndAwaitCompletion`: new-execution-id
  + not-Running, 60 s timeout). On completion the execution's `OutputData` is
  parsed as the node's `MappingStatistics` (`totalSuggestions`, matched/
  unmatched containers, `ruleHits`) and shown as badges — the pipeline must end
  with `SetPipelineExecutionResult` on its `statisticsTargetPath` (the
  demo-energy-iq rules pipeline does); foreign payloads degrade to a plain
  "completed" note. Tree, selected-node mappings and orphan catalogue reload
  afterwards.
- **Orphan full-text search:** the orphan toolbar filters the loaded
  catalogue client-side (case-insensitive contains over name, description,
  rtId AND the parent breadcrumb — searching a room name lists all its
  controls; combined with "Select all" that is a per-room bulk mapping).
  Cleared on source-type change; empty-result and "N shown" states are
  explicit.
- **Orphan grouping + group-name filter:** "Group by" picks any parent CK
  type seen in the loaded candidates; groups are merged by the parent's
  NAME, not its rtId — Loxone-style trees instantiate the same Category once
  per room, so keying on the instance produced dozens of duplicate sections
  ("Beleuchtung" × N rooms). Candidates without an ancestor of the chosen
  type land in a "(no parent of this type)" bucket that sorts last. A
  `kendo-multiselect` next to the Group-by select (visible only while
  grouping) filters to specific group names (e.g. Beleuchtung + Klima,
  multi-select); the catch-all bucket is selectable too. Select-all, the
  "N shown" badge and the empty state operate on `orphanVisibleList`
  (text/mapped filter ∩ group-name filter), so bulk actions match what is
  rendered. The name selection resets on grouping-type and source-type
  change (stale names of another type would silently hide everything).
- **Orphan bulk mapping:** every orphan row has a checkbox; Select all
  (visible under the current filter) / Clear / "Map N selected…" live in the
  orphan toolbar. The `BulkMappingDialogComponent` (via
  `BulkMappingDialogService`) collects ONE shared target entity + source data
  point + target attribute + expression (source data-point options come from
  the first selected entity), and the host creates one DataPointMapping per
  source in a single atomic `CreateEntities` mutation (per-source MapsFrom,
  shared MapsTo, generated names).
- **Expression live preview:** the mapping edit + bulk dialogs show
  "Preview: value = X → Y" — the selected source data point's last known
  value run through the mapping expression. The evaluator is HOST-provided
  (`MappingExpressionEvaluatorFn` via the `expressionEvaluator` input on
  `mm-mapping-coverage-tree`, wired through the dialog data) — Refinery Studio
  supplies expr-eval via `@meshmakers/octo-process-diagrams`'
  `ExpressionEvaluatorService`, a client-side approximation of the backend's
  mXparser. The pure pieces live in `mapping-expression-preview.ts`
  (`computeExpressionPreview`, `coerceDataPointValue` — numeric/boolean string
  coercion; empty expression = pass-through). The current value comes from
  `DataPointPickerComponent.currentValue()` (public computed), backed by
  `DataPointResolverService.loadInfos`/`extractInfosFromEntity` returning
  `DataPointInfo { name, currentValue }` (record-level `CurrentValue` in all
  three RecordArray shapes; the entity-level `CurrentValue` attribute for the
  default `currentValue` data point).
- **Small screens:** below 900px viewport width the master-detail split
  stacks vertically (tree pane 38vh on top, detail below) and the fixed-width
  toolbar selects become flexible; dialog sizes are kept on screen by the
  shared-ui `WindowStateService` viewport clamp.
- **Mapping backup (Export/Import row):** a fourth toolbar row (shown only with a
  `tenantId` AND when a backup pipeline is deployed) auto-detects the mapping
  backup pipelines by scanning the loaded `PipelineDefinition`s for
  `ExportDataPointMappings@` / `ImportDataPointMappings@`. **Export** runs the
  export pipeline via `CommunicationService.executePipeline` (same polling as
  Run/Generate) and downloads the execution's `OutputData` — the portable
  mapping document — as `datapoint-mappings.json`. **Import…** opens a file
  picker and executes the import pipeline with `{ body: <document> }` as
  pipeline input; that mirrors the `$.body` shape of the pipeline's HTTP POST
  trigger, so one pipeline definition serves both entry points (the
  ExecutePipelineCommand chain carries the JSON body end-to-end:
  controller `POST /pipeline/execute` body → `ExecutePipelineRequest.PipelineInput`
  → adapter `FromExecutePipelineCommandNode` parses it as the initial
  DataContext). Import statistics (`resolved`/`unresolved` + entry tooltip)
  come from the execution's `OutputData` (`ImportDataPointMappings`'
  `statisticsTargetPath`); tree, mapping list and orphan catalogue reload after
  an import. `saveJsonFile` is a protected seam so tests can intercept the
  browser download.
- **Per-tenant source-type persistence:** `MappingCoverageConfigService`
  (`runtime-browser/services/mapping-coverage-config.service.ts`) loads/saves
  the optional `System.UI/MappingCoverageConfiguration` singleton
  (rtWellKnownName `MappingCoverage`, System.UI ≥ 2.4.0, model owned by
  `octo-platform-services`) carrying `SourceCandidateCkTypeIds` — the CK types
  offered in the Orphan Sources tab. Same probe-then-query + inline-`gql`
  pattern as `TreeNavigationConfigService`; when the type is absent the host
  (Refinery Studio) falls back to its legacy per-browser localStorage
  persistence and migrates it to the singleton once the model is upgraded.
  Unlike `TreeNavigationConfigService` it holds no session cache — the page
  loads once per visit/tenant switch.

## Branding (theming + per-tenant identity)

`@meshmakers/octo-ui` exports a complete branding subsystem:

- **Provider:** `provideOctoBranding({ defaults?, fallbackAssets? })` — registers all services and an `APP_INITIALIZER` that loads the tenant's branding record on bootstrap.
- **Components:** `<mm-theme-switcher>` and `SettingsPageComponent` (mounted via `BRANDING_ROUTES`). Hosts compose their own header/footer/menu shells and bind to `--app-header-gradient-*` / `--app-footer-gradient-*` / `--app-*-text`. The logo is rendered inline by the host (`<img [src]="branding().headerLogoUrl ?? fallback">`) — no library component.
- **Services:** `BrandingDataSource` (signal-based GraphQL CRUD), `ThemeService` (light/dark toggle), `BrandingApplicationService` (palette generation + CSS variable application), `AppTitleService` (document title sync).
- **i18n:** components accept `[messages]` inputs with English defaults; `SettingsPageComponent` requires a `BrandingSettingsMessages` object.
- **Test utilities:** `createBrandingStub()` and `provideBrandingTesting()` for spec setup.

Source: `src/lib/branding/`. Detailed usage in `src/lib/branding/BRANDING_USAGE.md`.

The feature couples directly to the `SystemUIBranding` CK runtime type
(`rtWellKnownName = "Branding"`), which is service-managed and auto-distributed
to every tenant by `octo-admin-panel`.

## Documentation and Testing Standards

- **All developer documentation must be written in English**
- **Every code change must include updated documentation** — update README.md, CLAUDE.md, or inline docs when adding, modifying, or removing features
- **Unit tests and integration tests must be executed** after every code change
- **Existing tests must be updated** when the behavior of tested code changes
- **New tests must be added** when new features, components, or services are implemented
- Never commit code with failing tests

---

## Data Sources

### OctoGraphQlDataSource

Abstract base class for GraphQL-based data sources used with `mm-list-view` components.

```typescript
import { OctoGraphQlDataSource } from '@meshmakers/octo-ui';

@Directive({
  selector: "[appCustomerDataSource]",
  exportAs: 'appCustomerDataSource',
  providers: [{ provide: DataSourceBase, useExisting: forwardRef(() => CustomerDataSourceDirective) }]
})
export class CustomerDataSourceDirective extends OctoGraphQlDataSource<CustomerDto> {
  private readonly getCustomersGQL = inject(GetCustomersDtoGQL);

  constructor() {
    super(inject(ListViewComponent));
    this.searchFilterAttributePaths = ['name', 'email'];  // Fields for text search
  }

  fetchData(options: FetchDataOptions): Observable<FetchResultTyped<CustomerDto>> {
    return this.getCustomersGQL.fetch({
      variables: {
        first: options.state.take,
        after: GraphQL.offsetToCursor(options.state.skip ?? 0),
        sortOrder: this.getSortDefinitions(options.state),
        fieldFilter: this.getFieldFilterDefinitions(options.state),
        searchFilter: this.getSearchFilterDefinitions(options.textSearch)
      },
      fetchPolicy: "network-only"
    }).pipe(map(result => new FetchResultTyped<CustomerDto>(
      result.data?.runtime?.customers?.items ?? [],
      result.data?.runtime?.customers?.totalCount ?? 0
    )));
  }
}
```

**Protected Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `getFieldFilterDefinitions(state)` | `FieldFilterDto[] \| null` | Converts Kendo filter state to GraphQL field filters |
| `getSearchFilterDefinitions(textSearch)` | `SearchFilterDto \| null` | Creates search filter for text search |
| `getSortDefinitions(state)` | `SortDto[] \| null` | Converts Kendo sort state to GraphQL sort definitions |

**Page-out-of-range recovery:** `isPageOutOfRangeError(err)` (public override of the
`DataSourceBase` hook) detects the OctoMesh API's `INCOMPLETE_SLICE` GraphQL error — the
server's rejection of a page window beyond the result set (e.g. a persisted page offset
combined with filters that now match fewer rows). `MmListViewDataBindingDirective` uses it
to recover by resetting to page 1 and refetching once instead of silently keeping the
previous rows on screen. Data sources whose own bar/quick-view filters changed must refetch
with `fetchAgain({ resetSkip: true })` so the page resets up front (see the shared-ui
server-binding invariants).

**Supported Filter Operators:**

| Kendo Operator | GraphQL Operator |
|----------------|------------------|
| `eq` | `EqualsDto` |
| `neq` | `NotEqualsDto` |
| `lt` | `LessThanDto` |
| `lte` | `LessEqualThanDto` |
| `gt` | `GreaterThanDto` |
| `gte` | `GreaterEqualThanDto` |
| `contains` | `LikeDto` |
| `startswith` | `MatchRegExDto` |
| `endswith` | `MatchRegExDto` |
| `isnull` | `EqualsDto` (value: null) |
| `isnotnull` | `NotEqualsDto` (value: null) |

### OctoGraphQlHierarchyDataSource

Abstract base class for hierarchical/tree data sources.

```typescript
import { OctoGraphQlHierarchyDataSource } from '@meshmakers/octo-ui';

export class FolderDataSource extends OctoGraphQlHierarchyDataSource<FolderDto> {
  async fetchRootNodes(): Promise<TreeItemDataTyped<FolderDto>[]> {
    // Fetch root folders
  }

  async fetchChildren(item: TreeItemDataTyped<FolderDto>): Promise<TreeItemDataTyped<FolderDto>[]> {
    // Fetch child folders
  }
}
```

---

## Property Grid

### PropertyGridComponent

Displays and edits entity properties in a two-column grid format.

```typescript
import { PropertyGridComponent, PropertyGridItem, AttributeValueTypeDto } from '@meshmakers/octo-ui';

@Component({
  template: `
    <mm-property-grid
      [properties]="properties"
      [readOnlyMode]="false"
      [height]="400"
      (propertyChange)="onPropertyChange($event)"
      (binaryDownload)="onBinaryDownload($event)">
    </mm-property-grid>
  `
})
export class MyComponent {
  properties: PropertyGridItem[] = [
    {
      id: 'name',
      name: 'name',
      displayName: 'Customer Name',
      value: 'Acme Corp',
      type: AttributeValueTypeDto.StringDto,
      readOnly: false,
      category: 'General'
    }
  ];
}
```

**Inputs:**

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `properties` | `PropertyGridItem[]` | `[]` | Properties to display |
| `readOnlyMode` | `boolean` | `false` | Disable editing |
| `height` | `number` | `400` | Grid height in pixels |
| `showTypeIcons` | `boolean` | `true` | Show type icons |

**Outputs:**

| Output | Type | Description |
|--------|------|-------------|
| `propertyChange` | `PropertyChangeEvent` | Emitted when a property value changes |
| `binaryDownload` | `BinaryDownloadEvent` | Emitted when binary download is requested |

### PropertyConverterService

Converts OctoMesh entities to PropertyGridItem arrays.

```typescript
import { PropertyConverterService } from '@meshmakers/octo-ui';

@Component({...})
export class EntityDetailComponent {
  private readonly converter = inject(PropertyConverterService);

  loadEntity(entity: RtEntityDto) {
    // Convert entity attributes to property grid items
    const properties = this.converter.convertRtEntityAttributes(entity);

    // Or convert any object
    const objectProperties = this.converter.convertObjectToProperties(
      myObject,
      'Custom Category'
    );
  }
}
```

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `convertRtEntityAttributes(entity)` | `PropertyGridItem[]` | Convert RtEntity attributes |
| `convertObjectToProperties(obj, category?)` | `PropertyGridItem[]` | Convert plain object |
| `mapCkAttributeTypeToDto(ckType)` | `AttributeValueTypeDto` | Map CK type string to enum |

### AttributeValueTypeDto

Enum for property value types:

```typescript
enum AttributeValueTypeDto {
  BinaryDto = 'BINARY',
  BinaryLinkedDto = 'BINARY_LINKED',
  BooleanDto = 'BOOLEAN',
  DateTimeDto = 'DATE_TIME',
  DateTimeOffsetDto = 'DATE_TIME_OFFSET',
  DoubleDto = 'DOUBLE',
  EnumDto = 'ENUM',
  IntegerDto = 'INTEGER',
  Integer_64Dto = 'INTEGER_64',
  IntegerArrayDto = 'INTEGER_ARRAY',
  RecordDto = 'RECORD',
  RecordArrayDto = 'RECORD_ARRAY',
  StringDto = 'STRING',
  StringArrayDto = 'STRING_ARRAY',
  TimeSpanDto = 'TIME_SPAN',
  GeospatialPointDto = 'GEOSPATIAL_POINT'
}
```

---

## Selector Dialogs

### AttributeSelectorDialogService

Opens a dialog for selecting entity attributes (columns for queries).

```typescript
import { AttributeSelectorDialogService } from '@meshmakers/octo-ui';

@Component({...})
export class QueryBuilderComponent {
  private readonly dialogService = inject(AttributeSelectorDialogService);

  async selectColumns() {
    const result = await this.dialogService.openAttributeSelector({
      ckTypeId: 'OctoSdkDemo/Customer',
      selectedAttributes: this.currentColumns,
      dialogTitle: 'Select Columns'
    });

    if (result.confirmed) {
      this.columns = result.selectedAttributes;
    }
  }
}
```

**Options:**

| Property | Type | Description |
|----------|------|-------------|
| `ckTypeId` | `string` | CK type to get attributes for |
| `selectedAttributes` | `AttributeItem[]` | Pre-selected attributes |
| `dialogTitle` | `string` | Custom dialog title |

**Multi-association value columns + entity selector (AB#4323):** the dialog's navigation
options row carries an opt-in "Include Multi-Associations" checkbox (backed by the
`includeManyNavigations` argument of `availableQueryColumns`). When enabled, value columns
across inbound and N-multiplicity associations are offered (e.g.
`containedSensors.energyIQTemperatureSensor->currentValue`); such a column resolves per row
to the FIRST matching target entity (deterministic by rtId). Rows in the Selected grid whose
path contains `->` get a pencil action that opens the entity-selector editor: pin the exact
target via `[rtId=…]`, `[wellKnownName=…]` or `[attributeName=value]` on the first navigation
segment. Path helpers live in `attribute-selector-dialog/entity-selector-path.ts`
(`applyEntitySelector` / `parseEntitySelector` / `stripEntitySelector`, unit-tested). Stored
paths that carry a selector (or cross a multi-association while the toggle is off) are
preserved when the dialog reopens — they resolve via their selector-stripped base path
instead of being dropped.

### AttributeSortSelectorDialogService

Opens a dialog for selecting attributes with sort order configuration.

```typescript
import { AttributeSortSelectorDialogService, AttributeSortItem } from '@meshmakers/octo-ui';

@Component({...})
export class QueryBuilderComponent {
  private readonly dialogService = inject(AttributeSortSelectorDialogService);

  async configureSorting() {
    const result = await this.dialogService.openAttributeSortSelector({
      ckTypeId: 'OctoSdkDemo/Customer',
      selectedAttributes: this.sortConfig,
      dialogTitle: 'Configure Sort Order'
    });

    if (result.confirmed) {
      // result.selectedAttributes contains AttributeSortItem[]
      // Each item has: attributePath, attributeValueType, sortOrder
      this.sortConfig = result.selectedAttributes;
    }
  }
}
```

**AttributeSortItem:**

```typescript
interface AttributeSortItem {
  attributePath: string;
  attributeValueType: string;
  sortOrder: 'standard' | 'ascending' | 'descending';
}
```

### CkTypeSelectorDialogService

Opens a dialog for selecting a Construction Kit type.

```typescript
import { CkTypeSelectorDialogService } from '@meshmakers/octo-ui';

@Component({...})
export class TypeSelectorComponent {
  private readonly dialogService = inject(CkTypeSelectorDialogService);

  async selectType() {
    const result = await this.dialogService.openCkTypeSelector({
      selectedCkTypeId: this.currentTypeId,
      ckModelIds: ['OctoSdkDemo'],  // Optional: filter by models
      allowAbstract: false,         // Allow abstract types?
      dialogTitle: 'Select Entity Type'
    });

    if (result.confirmed && result.selectedCkType) {
      // Use result.selectedCkType.rtCkTypeId for runtime queries
      this.selectedType = result.selectedCkType;
    }
  }
}
```

### CkTypeSelectorInputComponent

Autocomplete input for CK type selection with dialog support.

```typescript
import { CkTypeSelectorInputComponent } from '@meshmakers/octo-ui';

@Component({
  template: `
    <mm-ck-type-selector-input
      [(ngModel)]="selectedCkType"
      [ckModelIds]="['OctoSdkDemo']"
      [allowAbstract]="false"
      [placeholder]="'Select type...'"
      [minSearchLength]="2"
      (ckTypeSelected)="onTypeSelected($event)"
      (ckTypeCleared)="onTypeCleared()">
    </mm-ck-type-selector-input>
  `
})
export class MyComponent {
  selectedCkType: CkTypeSelectorItem | null = null;
}
```

**Features:**
- Implements `ControlValueAccessor` for reactive forms
- Implements `Validator` with required validation
- Autocomplete with debounced search
- Advanced search dialog button
- Auto-select on blur when single result

**Inputs:**

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `placeholder` | `string` | `'Select a CK type...'` | Placeholder text |
| `minSearchLength` | `number` | `2` | Min chars before search |
| `maxResults` | `number` | `50` | Max autocomplete results |
| `debounceMs` | `number` | `300` | Search debounce delay |
| `ckModelIds` | `string[]` | `undefined` | Filter by models |
| `allowAbstract` | `boolean` | `true` | Allow abstract types |
| `dialogTitle` | `string` | `'Select Construction Kit Type'` | Dialog title |
| `disabled` | `boolean` | `false` | Disable input |
| `required` | `boolean` | `false` | Required validation |

---

## Field Filter Editor

### FieldFilterEditorComponent

Visual editor for query field filters.

```typescript
import { FieldFilterEditorComponent } from '@meshmakers/octo-ui';

@Component({
  template: `
    <mm-field-filter-editor
      [filters]="filters"
      [availableFields]="availableFields"
      (filtersChange)="onFiltersChange($event)">
    </mm-field-filter-editor>
  `
})
export class QueryEditorComponent {
  filters: FieldFilterDto[] = [];
  availableFields: AttributeItem[] = [];
}
```

---

## Tenant Switcher

### TenantSwitcherComponent

Reusable tenant switching badge with popup for multi-tenant applications. Theme-neutral, uses only Kendo CSS variables.

```typescript
import { TenantSwitcherComponent } from '@meshmakers/octo-ui';

@Component({
  imports: [TenantSwitcherComponent],
  template: `
    <mm-tenant-switcher
      [currentTenantId]="tenantId()"
      [allowedTenants]="authorizeService.allowedTenants()"
      [isDenied]="isTenantDenied()"
      (tenantSelected)="onTenantSelected($event)">
    </mm-tenant-switcher>
  `
})
export class AppComponent {
  onTenantSelected(tenantId: string): void {
    this.router.navigate(['/', tenantId]);
  }
}
```

**Inputs:**

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `currentTenantId` | `string \| null` | `null` | Currently active tenant (hides component when null) |
| `allowedTenants` | `string[]` | `[]` | Tenants available to switch to |
| `isDenied` | `boolean` | `false` | Shows error/denied color scheme |

**Outputs:**

| Output | Type | Description |
|--------|------|-------------|
| `tenantSelected` | `EventEmitter<string>` | Emits tenant ID when user selects a different tenant |
| `refreshRequested` | `EventEmitter<void>` | Emits when user clicks the refresh button in the popup header |

**Visual behavior:** Badge button showing tenant name + icon. Click opens a Kendo popup listing allowed tenants. Current tenant is highlighted. Clicking a different tenant emits event and closes popup. Escape/outside-click closes popup. The popup header includes a refresh button (spinning arrow icon) that emits `refreshRequested` — host applications use this to refresh the access token and update `allowed_tenants`.

**LCARS theming:** The component uses Kendo CSS variables for theme-neutral styling. Refinery Studio applies LCARS overrides via `::ng-deep mm-tenant-switcher { ... }` in `app.component.scss`.

---

## Component Styling Guidelines

### Theme-Independent Components

All components in this library MUST be theme-independent. This ensures they work correctly with any Kendo UI theme (light, dark, custom).

### Rules for Styling

1. **NO hardcoded colors** - Never use hardcoded color values like `#64ceb9`, `#9292a6`, `rgba(100, 206, 185, 0.2)`, etc.

2. **Use Kendo CSS Variables** - Always use Kendo theme variables for colors:
   ```css
   /* Good */
   color: var(--kendo-color-primary);
   background-color: var(--kendo-color-surface);
   border-color: var(--kendo-color-border);

   /* Bad */
   color: #64ceb9;
   background-color: #1f2e40;
   border-color: #d5d5d5;
   ```

3. **Common Kendo CSS Variables**:
   - `--kendo-color-primary` - Primary theme color
   - `--kendo-color-secondary` - Secondary theme color
   - `--kendo-color-success` - Success/green color
   - `--kendo-color-warning` - Warning/yellow color
   - `--kendo-color-error` - Error/red color
   - `--kendo-color-info` - Info/blue color
   - `--kendo-color-border` - Border color
   - `--kendo-color-surface` - Surface background
   - `--kendo-color-surface-alt` - Alternative surface
   - `--kendo-color-on-primary` - Text on primary background
   - `--kendo-color-on-success` - Text on success background
   - `--kendo-color-subtle` - Subtle/muted text color

4. **Fallback values** - When using CSS variables, provide a neutral fallback:
   ```css
   color: var(--kendo-color-primary, #ff6358);
   ```

5. **No theme-specific overrides** - Do not override Kendo component styles with `::ng-deep` for colors. Let the theme handle it.

6. **Layout-only styles are OK** - Styles for layout (flexbox, grid, padding, margins, sizing) are fine:
   ```css
   /* These are OK */
   display: flex;
   gap: 16px;
   padding: 12px 20px;
   min-width: 800px;
   border-radius: 4px;
   ```

7. **Use opacity for subtle effects** instead of hardcoded colors:
   ```css
   /* Good */
   opacity: 0.7;

   /* Bad */
   color: #666;
   ```

### Dialog Components

Dialog components should:
- Extend `DialogContentBase` from Kendo
- Not override `kendo-dialog-actions` styles
- Let the Kendo theme handle all color-related styling
- Only define layout and structural styles

### Example Component Style

```typescript
styles: [`
  :host {
    display: block;
  }

  .container {
    display: flex;
    flex-direction: column;
    padding: 16px 20px;
    gap: 16px;
  }

  .header {
    font-size: 0.85rem;
    font-weight: 600;
  }

  .highlight {
    color: var(--kendo-color-primary);
    font-weight: bold;
  }

  .separator {
    height: 1px;
    background-color: var(--kendo-color-border, #dee2e6);
  }

  .grid ::ng-deep .k-grid-table tbody tr {
    cursor: pointer;
  }
`]
```

### Kendo SVG Icons

Use Kendo SVG icons instead of custom icons:
```typescript
import { searchIcon, arrowRightIcon, chevronDoubleRightIcon } from '@progress/kendo-svg-icons';
```

Available icon patterns:
- Single arrows: `arrowLeftIcon`, `arrowRightIcon`, `arrowUpIcon`, `arrowDownIcon`
- Double arrows: `chevronDoubleLeftIcon`, `chevronDoubleRightIcon`
- Sort: `sortAscSmallIcon`, `sortDescSmallIcon`
- Actions: `searchIcon`, `filterClearIcon`, `plusIcon`, `minusIcon`, `downloadIcon`
- Files: `fileIcon`, `folderIcon`
- Date/Time: `calendarIcon`, `clockIcon`

---

## Testing

### Test Structure

Tests use Jasmine with Angular TestBed. For Kendo Grid components, include `@angular/localize/init`:

```typescript
import '@angular/localize/init';  // Required for Kendo Grid i18n
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

describe('MyComponent', () => {
  let component: MyComponent;
  let fixture: ComponentFixture<MyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent, ...KendoModules],
      providers: [
        { provide: MyService, useValue: jasmine.createSpyObj('MyService', ['method']) }
      ],
      animationsEnabled: false  // Use TestBed option instead of NoopAnimationsModule
    }).compileComponents();
  });
});
```

### Dialog Service Test Pattern

```typescript
describe('CkTypeSelectorDialogService', () => {
  let service: CkTypeSelectorDialogService;
  let dialogServiceMock: jasmine.SpyObj<DialogService>;
  let dialogClosedSubject: Subject<CkTypeSelectorDialogResult | undefined>;

  beforeEach(() => {
    dialogClosedSubject = new Subject();
    dialogServiceMock = jasmine.createSpyObj('DialogService', ['open']);
    dialogServiceMock.open.and.returnValue({
      content: { instance: { data: null } },
      result: dialogClosedSubject.asObservable()
    } as any);

    // ... setup TestBed
  });

  it('should return confirmed result', async () => {
    const promise = service.openCkTypeSelector({ ... });
    dialogClosedSubject.next({ selectedCkType: mockType });
    const result = await promise;
    expect(result.confirmed).toBeTrue();
  });
});
```

### Running Tests

```bash
# Run all octo-ui tests
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  npm test -- --project=@meshmakers/octo-ui --watch=false

# Run with coverage
npm test -- --project=@meshmakers/octo-ui --watch=false --code-coverage

# CI mode
ng test @meshmakers/octo-ui --no-watch --browsers=ChromeHeadless
```

---

## Dependencies

- `@angular/core` - Angular framework
- `@angular/forms` - Reactive forms, ControlValueAccessor
- `@progress/kendo-angular-grid` - Kendo Grid component
- `@progress/kendo-angular-dialog` - Kendo Dialog component
- `@progress/kendo-angular-dropdowns` - Kendo Dropdown/Autocomplete
- `@progress/kendo-angular-buttons` - Kendo Buttons
- `@progress/kendo-angular-inputs` - Kendo Input components
- `@progress/kendo-angular-icons` - Kendo Icons
- `@progress/kendo-svg-icons` - Kendo SVG icon library
- `@meshmakers/octo-services` - Backend services, DTOs
- `@meshmakers/shared-ui` - Shared UI components (ListViewComponent, DataSourceBase)
