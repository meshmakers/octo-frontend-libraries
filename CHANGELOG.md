# Changelog

Notable changes of the `@meshmakers/*` libraries in this repository (shared-services, shared-ui,
octo-ui, octo-process-diagrams, ...). Newest first. Entries reference the Azure DevOps work item.
Visual or API changes that apps must react to are marked **BREAKING**.

## Unreleased

### shared-ui / shared-services

- **BREAKING (visual)**: `mm-list-view` toolbar commands (`leftToolbarActions` /
  `rightToolbarActions`) are flat and neutral by default. Set `CommandItem.primary: true` on the
  page's single main action, or move it into the page header via `[mmPageActions]`
  (`<mm-action-button context="page" display="icon-text" primary>`). A page has exactly one solid
  primary action (Studio action guideline §9). `fillMode` defaults to `solid` only for primary
  items. (AB#6211)
- `CommandItem.disabledReason` now works in the list toolbar: with `isDisabled` the control (plain,
  split or dropdown button) stays focusable (`aria-disabled`), announces the reason
  (`aria-describedby`), shows it in the tooltip and as a hint on keyboard focus; clicks and the menu
  are blocked. A callback receives the current selection. (AB#6211)
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
