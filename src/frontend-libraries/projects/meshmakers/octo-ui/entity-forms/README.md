# @meshmakers/octo-ui/entity-forms

Form-driven list, create and edit pages for OctoMesh runtime entities (AB#5522).

The layout of a page — sections, field order, labels, help texts, editors, visibility rules,
list columns, capabilities — comes from the tenant's `System.UI/EntityForm` entities
(System.UI ≥ 2.7.0, seeded by the `System.UI.EntityForms` blueprint). Types without a form, and
tenants without System.UI, fall back to a built-in copy of the seeded `form-default`, so every
CK type gets a usable page.

This is a **secondary entry point**: it imports only the public API of `@meshmakers/octo-ui`
and other packages, and hosts that do not use it keep the primary bundle unchanged.

## Building blocks

| Export | Purpose |
|--------|---------|
| `<mm-entity-page>` (`EntityPageComponent`) | Route component: list, create, edit and singleton flows, save, delete, unsaved-changes guard, breadcrumbs |
| `entityFormRoutes(opts?)` | The three child routes `''` / `new` / `:rtId` of a page |
| `<mm-entity-list>` (`EntityListComponent`) | `mm-list-view` of a resolved form (columns, Copy ID, delete, "New" incl. subtype picker) |
| `<mm-entity-form>` (`EntityFormComponent`) | The form itself (sections, editors, validation, change set) |
| `EntityFormService` | Loads forms + CK metadata (cached per tenant) and resolves the form for a type or form key |
| `EntityFormDataService` | Reads values / secret state / associations; create, update (incl. `clearSecretAttributes`), delete |
| `parseEntityForms`, `pickEntityForm`, `resolveEntityForm`, … | Pure functions behind the service, e.g. for a forms editor |
| `entityFormCatalog(forms)`, `entityFormKey(form)` | Settings overview: one entry per target type whose effective form has a `Category`, with the URL key |
| `EntityFormsMessages`, `DEFAULT_ENTITY_FORMS_MESSAGES` | All UI strings (English defaults; pass `Partial<…>` via `messages`) |
| `ENTITY_FORM_FALLBACK_FORMS`, `provideEntityFormFallbacks`, `selectFallbackForms` | Host-provided built-in forms that apply per type where the resolution would end at `form-default` (see below) |
| `ENTITY_FORM_ACTION_CONFIRMATION` | Optional host hook asked before a delete (e.g. a production-mode check) |

## Usage

### Routes (recommended)

```ts
import { entityFormRoutes } from '@meshmakers/octo-ui/entity-forms';

export const routes: Routes = [
  {
    path: 'sftp',
    children: entityFormRoutes({
      formKey: 'sftp-configuration',          // or ckTypeId: 'System.Communication/SftpConfiguration'
      breadcrumbUrl: 'communication/sftp',    // optional; adds {{entityFormTitle}} / {{entityName}} crumbs
      canWrite: true,                         // optional; default true
    }),
  },
];
```

The host must provide what the library services expect:

- `provideOctoUi()` — includes `provideMmSharedUi()` (`ConfirmationService`,
  `NotificationDisplayService`, `EntitySelectDialogService` for the reference picker) and
  `CkTypeSelectorDialogService` (subtype picker). Hosts that do not use `provideOctoUi()` must
  call `provideMmSharedUi()` themselves.
- A `<div kendoDialogContainer></div>` (record row dialog, confirmations) and
  `<div kendoWindowContainer></div>` (CK type selector) in the app shell.
- Apollo for the tenant; optionally `TENANT_ID_PROVIDER` (cache scope per tenant) and
  `BreadCrumbService` (breadcrumb labels; skipped when absent).

### Route-parameter contract (stable; used by the Refinery Studio, AB#5523)

| URL (relative to the mount point) | Page state |
|-----------------------------------|------------|
| `''` | List. A **singleton** form skips the list and opens its entity (see below). |
| `new` | Create form. Route data `rtId: 'new'`. |
| `new?type=<rtCkTypeId>` | Create form for a concrete subtype (required for abstract types; set by the list's subtype picker). |
| `:rtId` | Edit form; read-only view when `canWrite` is false or the form has `CanEdit: false`. |
| `:rtId?type=<rtCkTypeId>` | Edit form for an entity of a derived type (set when the list opens such a row). Without it the page detects the type after loading and re-resolves. |

Page inputs (bound by `withComponentInputBinding()` from route params / data, otherwise read from
`ActivatedRoute` — params, route data of the route and its ancestors, query params):

| Input | Source fallback | Meaning |
|-------|-----------------|---------|
| `formKey` | `data.formKey`, then `params.formKey` | `form-sftp-configuration` (rtWellKnownName) or the kebab type key `sftp-configuration`. Wins over `ckTypeId`. |
| `ckTypeId` | `data.ckTypeId`, then `params.ckTypeId` | Runtime CK type id of the target type. |
| `rtId` | `params.rtId`, `data.rtId` | Absent = list; `'new'` = create; otherwise edit. |
| `canWrite` | `data.canWrite`, then `true` | Write permission; the host maps roles to it (the library knows no role names). |
| `messages` | `data.messages` | `Partial<EntityFormsMessages>`. |
| `routerNavigation` | — | Default `true`. Set `false` and handle the `navigate` output to drive navigation yourself. |

The query parameter is deliberately named `type`, not `ckTypeId`, so input binding never
overwrites the page's `ckTypeId` (the form's target type).

Navigation is always **relative** (`..`, `new`, `:rtId`, with `replaceUrl` after a create), so
the routes work under any mount point. The `navigate` output (`{ kind: 'list'|'create'|'edit', rtId?, ckTypeId? }`)
is emitted for every transition.

Two more outputs let a host that embeds the page (e.g. the Studio's Data Explorer peek) keep its
own lists current:

| Output | Payload | When |
|--------|---------|------|
| `saved` | `{ kind: 'create' \| 'update', rtId, ckTypeId }` | After a successful create or update (not for an empty change set) |
| `deleted` | `{ rtId, ckTypeId }` | After the open entity was deleted from the form, before the navigation to the list |

Breadcrumb labels set via `BreadCrumbService.updateBreadcrumbLabels`: `entityFormTitle` (the
resolved form title) and `entityName` (entity `name`, else `rtWellKnownName`, else `rtId`; the
create title on `new`).

### Singleton forms

`Singleton: true` skips the list:

1. With `SingletonWellKnownName` the entity is loaded by that well-known name.
2. Without it, the first entity of the type is used.
3. If none exists, the create form opens (with write permission) and the well-known name is
   written on first save; afterwards the page stays on the same URL in edit mode.

### Saving

`saveChanges(): Promise<boolean>` (also called by `UnsavedChangesGuard` on "Yes"):

- invalid form → all fields touched, warning, `false`;
- create → `EntityFormDataService.create`, then navigation to `:rtId` (replacing `new`);
- edit → only the changed attributes are sent (empty change set = "no changes"), then the
  values are read again.

### Embedding without routes

```html
<mm-entity-list [model]="model" [canWrite]="canWrite" (openRequested)="open($event)" (createRequested)="create($event)" />
<mm-entity-form [model]="model" mode="edit" [state]="state" (dirtyChange)="dirty = $event" />
```

Resolve `model` with `EntityFormService.resolve(rtCkTypeId)` / `resolveByFormKey(key)` and the
state with `EntityFormDataService.load(model, { rtId })`.

## Settings overview (catalog)

`entityFormCatalog(await formService.getForms())` returns one entry per target type whose
**effective** form (tenant form before seeded, then higher `Priority`) has a `Category`:
`key`, `category` (lower case), `title` (form `Name`, else the humanized type name),
`description`, `icon`, `targetCkTypeId`, `includeDerivedTypes`, `singleton`.
`form-default` has no category and never appears. A tenant form replaces the delivered entry
(and can move it to another category, or hide it by leaving `Category` empty).

`entityFormKey(form)` is the URL key: the well-known name without `form-`
(`form-email-sender-configuration` → `email-sender-configuration`), otherwise the kebab type
name. The catalog prefers a delivered `form-*` name of the type, so URLs survive a tenant
override. `resolveByFormKey` accepts both forms.

`EntityFormDataService.count(ckTypeId, includeDerivedTypes?)` counts entities without reading
attributes (`attributeNames: []`); without `includeDerivedTypes` only the exact type is counted.

## Fallback forms (`ENTITY_FORM_FALLBACK_FORMS` / `provideEntityFormFallbacks`)

A host can ship built-in copies of delivered forms, for example while a new version of the
seeding blueprint has not been rolled out yet (AB#5524). Two ways to provide them:

```ts
// root (pulls the entry point into the initial bundle):
providers: [{ provide: ENTITY_FORM_FALLBACK_FORMS, useValue: MY_FALLBACK_FORMS }]
// or on every lazy route that renders entity forms (registers them in the root service, one cache):
{ path: 'settings', providers: [provideEntityFormFallbacks(MY_FALLBACK_FORMS)], loadChildren: … }
```

- `EntityFormService.getForms()` appends a fallback **only where the normal resolution would end
  at the chain end** — no form at all, or `form-default` (a form on `System/Entity`). A tenant or
  seeded form for the exact type, or for an ancestor with `IncludeDerivedTypes`, always wins
  (`selectFallbackForms`). Fallbacks for types the tenant does not have (no CK metadata) are
  dropped. The first fallback per type wins. The result feeds `resolve`, `resolveByFormKey` and
  `entityFormCatalog` unchanged.
- Fallbacks are also used when the forms cannot be loaded (no System.UI 2.7.0, query error).
- `registerFallbackForms(forms)` (behind `provideEntityFormFallbacks`) is idempotent per array and
  drops the cached forms and resolutions once.
- They count as delivered forms (`isTenantForm` is forced to `false`, `source: 'seeded'`). Use the
  delivered `rtWellKnownName` (`form-<kebab-type>`) so URL keys do not change when the seeded form
  arrives, and leave `rtId` empty.
- A tenant form for the type without `Category` hides the entry, exactly like it hides a seeded one.

This is the per-type counterpart of the built-in `form-default` safety net; the host is
responsible for keeping its copies in step with the seed.

## Action confirmation (`ENTITY_FORM_ACTION_CONFIRMATION`)

Optional `(request: { action: 'delete', ckTypeId, count, description }) => Promise<boolean>`,
asked by `mm-entity-list` and `mm-entity-page` **before** their own yes/no dialog; `false` (or a
throwing hook) cancels. The Refinery Studio maps it to its production-mode confirmation.

## `<mm-entity-list>`

- Inputs: `model` (required), `canWrite = true`, `messages`, `listStateKey`.
- Outputs: `createRequested { ckTypeId }`, `openRequested { rtId, ckTypeId }`, `deleted { rtId, ckTypeId }[]`.
- Rows are flattened (`rtId`, `ckTypeId`, `rtWellKnownName`, `rtDisplayName`,
  `rtCreationDateTime`, `rtChangedDateTime`, `<attributeName>: value`), so a column `field`
  equals the GraphQL attribute path and server-side sort / filter / search work.
- Derived types are listed when the form has `IncludeDerivedTypes` or the type is abstract;
  otherwise a `ckTypeId EQUALS` field filter restricts the list to the exact type
  (`runtimeEntities(ckId)` returns derived types by default).
- Column display: `chip` → badge, `date` → ISO date, `mono` → monospace cell, else text.
- Context menu: **Copy ID** (RtId / CkTypeId / RtCkTypeId / RtEntityId), then — only with
  `canWrite && CanDelete` — Delete with a confirmation. Toolbar "New" only with
  `canWrite && CanCreate`.
- **Abstract types** (`createRequiresSubtype`): "New" opens `CkTypeSelectorDialogService`
  restricted to concrete subtypes (`derivedFromRtCkTypeId`, `allowAbstract: false`);
  cancelling emits nothing.

## Secrets (write-only)

Secret values never reach the browser (AB#5522 D5, AB#5542, AB#5544 item 4, decisions 2026-10-06).

**Which fields are secret**

- The **SECRET value type** (AB#5528) is always secret and maps automatically to a write-only
  field — no form definition needed; `Secret: false` is ignored with a warning. Compatible
  editors: `password` (default) and `multiline` (PEM keys, `EntityFormField.Editor: multiline`);
  any other editor falls back to `password` with a warning.
- Fallback for attributes that are not SECRET yet (older models): the form says `Secret: true`,
  **or its editor is `password`** (always write-only), or the CK attribute carries the metadata
  `secret=true`, or a textual attribute has a credential-like name (shared rule
  `isSecretAttributeCandidate` of `@meshmakers/octo-services`).

**Reading**

- Value reads, the list and the reference picker use documents whose `$attributeNames` is
  declared `[String]!` and always pass explicit names. Never add a document that selects
  `attributes` without that argument — **omitting it makes the server return every attribute,
  secrets included.**
- SECRET fields (`ResolvedEntityForm.secretStateFields`) are part of that list: the server
  returns `value: null` plus `secretIsSet`, giving `EntityFormValueState.secretStates`
  (`isSet`, `keyMissing`, `setAt`). `keyMissing` / `setAt` are contract fields
  (`secretKeyMissing` / `secretSetAt`) not served by the backend yet — add them to
  `getEntityFormValues.graphql` and re-run codegen once it does (TODO in the document).
- Fallback secrets are never listed; whether they are set is read with an `IS_NOT_NULL` field
  filter — plus `NOT_EQUALS ""` for STRING secrets — and `totalCount`. (Never use that probe on a
  SECRET: the server refuses every filter but `IS_NULL` / `IS_NOT_NULL` there.)

**UI** (field shell badge + `mm-entity-form-secret-editor`)

- Badge next to the label, visible to read-only users too (Q15): **Set · set at …** (or **Set**
  for legacy values without a timestamp), **Not set**, **Key missing — re-enter** (a value is
  stored but its key is not in this environment's key ring; it reads as not set for consumers but
  counts as present for "required"), **Will be cleared** (staged clear). Create mode shows
  "Secret".
- The input is never prefilled; placeholder "Leave empty to keep" when a value is stored.
  Read-only users get no input, no "Show" and no "Clear".
- **Show** reveals only the value typed in this session, never a stored one; it is disabled while
  the input is empty (Q10).
- **Multiline** (PEM keys): the text area renders its text transparent until **Show** (caret,
  selection and placeholder stay visible) and a status line reports only the number of lines
  entered. This works in every browser — Firefox has no reliable `-webkit-text-security`, and a
  password input would drop the PEM line breaks.
- **Clear** (optional SECRET fields with a stored value, edit mode, write access) is staged and
  sent on Save as `clearSecretAttributes` (Q8). Clear and a new value are mutually exclusive:
  Clear is disabled while a value is typed; a staged clear replaces the input by a note with
  **Undo**. Required secrets cannot be cleared; fallback secrets cannot be cleared either (the
  server accepts `clearSecretAttributes` only for SECRET attributes).
- **No key ring** (Q17): when the host provides `ENTITY_FORM_SECRET_KEY_RING_CONFIGURED`
  (a `Signal<boolean | null | undefined>`) and it is `false`, secret inputs are disabled with a
  hint. Without a provider (or while the signal is `null` / `undefined`) secrets are writable.
  The signal may change after the form was built (status loaded asynchronously): the controls
  follow it. In **create** mode a visible, required secret that cannot be entered blocks the form:
  the field stays required (marker + hint), `isValid()` is `false` and the public signal
  `saveBlockedReason()` names the fields — `mm-entity-page` disables Save with that text as
  tooltip and the form shows it as a notice; other hosts should do the same. Edit mode is not
  blocked (the server enforces required secrets only on create). The Studio provides the token
  app-wide from the bot status endpoint `GET {tenantId}/v1/secrets/status`
  (`SecretEnvironmentStatusService`, fail-open).

**Writing**

- An empty secret is left out of the change set (unchanged). A required secret is required
  only on create or while it is not present (set or key missing).
- Secret list columns are dropped. The update mutation selects no attributes (no echo).
- Record members of value type SECRET: the generic read returns `value: null` + `secretIsSet` per
  member; the form keeps that state (never a value). The records grid and the row editor show the
  shared status badge (**Set** / **Not set** / **Key missing — re-enter**); the row editor offers
  an empty password input (read-only users: badge only). A typed value replaces the member
  (grid: "New value (unsaved)"); an empty input keeps it — on save the member is **omitted** and
  the server carries the stored value over from the element with the same record key (handover
  §2). Changing an element's record key therefore drops its stored secret. A state object is
  never sent back.
- The CK description of `EntityFormField.Secret` says "masked … revealed on demand"; the concept
  (§5.8, write-only) wins.

## Editors (MVP)

| Editor | Implementation |
|--------|----------------|
| text, multiline, email, url, password, number, toggle, enum, datetime | Kendo inputs; email / url validators by editor; `Min`/`Max` on numbers, `Pattern` on text |
| chips | Array editor for `STRING_ARRAY` / `INT_ARRAY` |
| cron | shared-ui `mm-cron-builder` |
| **json / yaml** | Monospace `kendo-textarea` (no Monaco / YAML library in the workspace). `json` validates with `JSON.parse`, `yaml` is not validated. Both are stored as STRING. The Studio can swap in Monaco later via `CustomComponent`. |
| **reference** | shared-ui `mm-entity-select-input` (typeahead plus its **grid dialog**, multi-select for `N` roles) on a secret-safe data source that selects no attributes. Deviates from concept §5.4, which names `mm-entity-selector-dialog` — that one is a perspective tree picker without type filter or multi-select, and configuration types are not in a tree. Host forms may set `referenceDisplayAttributes` (e.g. `['repositoryUrl', 'channel']`): the picker then reads exactly those non-secret target attributes with `entityFormGetReferenceOptionsWithAttributes` (explicit `[String]!` `attributeNames`) and shows `name · value · value` (AB#5547; host forms only, never list a secret attribute). |
| records | Table with add / remove / move / edit; rows are edited in a dialog generated from the record's CK attributes. Nested records are read-only. |
| unsupported (BINARY, GEOSPATIAL_POINT, TIME_SPAN, …) | Read-only display |

## Form resolution (summary)

1. Forms targeting the exact type win; otherwise the nearest ancestor with forms that set
   `IncludeDerivedTypes` supplies the candidates (`form-default` targets `System/Entity`).
2. Tenant forms beat seeded forms (empty `RtBlueprintSource`), then higher `Priority`, then
   `rtWellKnownName` / `rtId` ascending (deterministic tie-break).
3. No match → built-in default form with a warning. Forms are never merged.
4. Attribute paths match case-insensitively (forms write `Host`, CK names are `host`); unknown
   paths are skipped, dotted paths are skipped with a warning; unmentioned attributes go to a
   generated "Further attributes" section unless `GenerateRemainingFields: false`.

## Known backend limits

- **CK record attributes always report `isOptional: false`.** Record sub-fields are therefore
  treated as optional in the UI; the server still enforces mandatory sub-attributes and answers
  `ASSET1004`.
- **The `attributeNames` filter is applied inside records too.** Reading a record attribute
  returns its rows with empty `attributes` unless the record's sub-attribute names are listed as
  well, so `readAttributeNames` contains them. When a sub-attribute name equals a fallback
  (non-SECRET) secret top-level attribute name it is dropped and the record field becomes
  read-only (warning), so a save cannot erase that sub-value. A SECRET name does not block (it is
  read anyway, the server never returns its value).
- The edit flow relies on a partial `RtEntityUpdate` keeping the attributes that are not sent
  (unchanged values, secrets). That is what makes the write-only secret handling safe.

## Tests

Specs live next to the sources and run with the octo-ui test target
(`../**/*.spec.ts`). `@meshmakers/octo-ui` resolves to `dist`, so build first:

```bash
npm run build:octo-ui && npm run test:octo-ui
```

Demo: `demo-app` → `demos/entity-forms` (SFTP configuration form).
