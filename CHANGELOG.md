# Changelog

Notable changes of the `@meshmakers/*` libraries in this repository (shared-services, shared-ui,
octo-ui, octo-process-diagrams, ...). Newest first. Entries reference the Azure DevOps work item.
Visual or API changes that apps must react to are marked **BREAKING**.

Process: changes are added under "Unreleased" with the commit that makes them. When a release is
tagged (`r*` tag), the person who sets the tag renames "Unreleased" to that version (and date) and
starts a new empty "Unreleased" section.

## Unreleased

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
