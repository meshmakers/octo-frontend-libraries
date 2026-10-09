# Actions: `mm-row-actions` and `mm-action-button`

Shared action rendering for row, toolbar and page actions (AB#5570). The rules behind it
are in the Studio action guideline
(`octo-frontend-refinery-studio/docs/concepts/studio-action-guideline.md`); this page is the API.

## The action definition

```ts
import {MM_ACTION_ICONS, MmAction} from '@meshmakers/shared-ui';

const deleteDump: MmAction<'delete-dump'> = {
  id: 'delete-dump',                 // emitted, rendered as data-action
  label: 'Delete dump',              // tooltip, accessible name (+ row label); never ends with "…"
  menuLabel: 'Delete dump…',         // optional visible text in menus / text buttons (falls back to label)
  icon: MM_ACTION_ICONS.delete,      // canonical icon per verb
  danger: true,                      // danger styling; the handler confirms
  disabledReason: busy ? 'A sweep is running' : null, // non-empty = disabled, announced
  visible: canManage,                // false = not rendered
  overflow: false,                   // true = always in the "More actions" menu
  link: undefined,                   // {commands, queryParams}: navigating action (see below)
};
```

`MM_ACTION_ICONS` maps verbs to Kendo SVG icons: `add`, `edit`, `view`, `open`, `delete`,
`clear`, `copy`, `duplicate`, `refresh`, `deploy`, `undeploy`, `run`, `stop`, `export`,
`import`, `download`, `report`, `restore`, `pin`, `unpin`, `merge`, `resetPassword`, `backfill`,
`recompute`. Use it instead of importing icons ad hoc.

## `mm-row-actions`

```html
<td class="actions">
  <mm-row-actions [actions]="actionsFor(run)" [rowLabel]="runLabel(run)" (triggered)="onAction($event, run)" />
</td>
```

| Input | Type | Default | Notes |
|---|---|---|---|
| `actions` | `MmAction[]` | required | Hidden ones are dropped. |
| `rowLabel` | `string` | required | Row name; every accessible name is `label + ' ' + rowLabel`. |
| `maxInline` | `number` | `3` | Slots incl. the overflow button. |

| Output | Payload |
|---|---|
| `triggered` | `MmActionEvent` (`{id, action}`), enabled actions only |

Behaviour: icon buttons, size small (16 px icon), flat, neutral; danger actions use
`themeColor="error"`. More than `maxInline` visible actions: the first `maxInline - 1` stay
inline and the rest go into a "More actions for {row}" dropdown (vertical ellipsis). Disabled
actions keep focus (`aria-disabled="true"`), link their reason via `aria-describedby`, show it in
the tooltip on hover and as a hint bubble below the button while it has keyboard focus
(`:focus-visible`); in the menu the reason is shown under the item text and the item cannot be
chosen. Focused buttons use `--theme-focus-ring`. The host gets `role="group"` and
`aria-label="Actions for {row}"` — only while at least one action is rendered.

## `mm-action-button`

One action as a button, for toolbars, section headers and page headers.

```html
<!-- toolbar utility: icon only, 20 px icon, tooltip + aria-label -->
<mm-action-button [action]="refresh" context="toolbar" (triggered)="reload()" />

<!-- main page action: text (+ icon), solid primary -->
<mm-action-button [action]="newAdapter" context="page" display="icon-text" primary (triggered)="create()" />
```

| Input | Type | Default | Notes |
|---|---|---|---|
| `action` | `MmAction` | required | |
| `targetLabel` | `string` | — | Extends the accessible name; required when the label repeats per row. |
| `context` | `'row' \| 'toolbar' \| 'page'` | `'row'` | `row` = small/16 px, otherwise medium; icon-only toolbar icons are 20 px. |
| `display` | `'icon' \| 'text' \| 'icon-text'` | `'icon'` | `icon` falls back to text when the action has no icon. |
| `primary` | `boolean` | `false` | Solid primary — one per header/toolbar. Ignored for danger actions. |

## Navigating actions

An action with `link: {commands, queryParams?}` renders inline as a real router link
(`<a routerLink>` with the Kendo button classes — open in new tab and copy link keep working).
From the overflow menu it navigates with `Router.navigate(commands, {queryParams, relativeTo})`
relative to the hosting route — the same resolution as the inline `routerLink`. A disabled navigating action renders
as a disabled button (no `href`). `triggered` fires in every case.

## Confirming destructive actions

The components only emit. Destructive handlers confirm first, naming the target, with
`ConfirmationService.showDangerConfirm(options)` (AB#5578):

```ts
const ok = await confirmation.showDangerConfirm({
  title: 'Delete adapter Mesh Adapter?',   // names the target
  targetName: 'Mesh Adapter',              // shown emphasised; typed when requireTypingName
  consequence: 'The adapter and its configuration are deleted. This cannot be undone.',
  confirmText: 'Delete adapter',           // verb + object, never "Yes"
  requireTypingName: false,                // true: confirm enables only after typing targetName
  environmentLabel: null,                  // 'PRODUCTION' / 'STAGING' shows the environment notice
});
```

Cancel left, danger confirm right; the initial focus is on Cancel (or the type-to-confirm input),
never on the destructive button — `showDestructiveConfirmationDialog` and Yes/No dialogs with the
`mm-dialog-danger` class focus their dismissing button the same way. Texts: `options.messages` /
`ConfirmationService.defaultDangerMessages` (`DangerConfirmationMessages`). Rich dialogs (lists,
counts, warnings) may still use an own `kendo-dialog` with the same rules. Apps add environment
knowledge in a thin wrapper (the Studio: `DangerConfirmService`, production = typing required).

## List view (AB#5572)

`mm-list-view` row actions follow the same rules as `mm-row-actions`: neutral icon buttons
(`mm-action-button`, danger colour only for `danger`), tooltip = label, `aria-label` = label + row
label (`rowLabelField`), at most `maxInlineRowActions` slots (default 3) — with more actions, or with
`contextMenuCommandItems` / `overflow: true` actions, the last slot is the "…" button whose menu holds
the overflowing actions first, then the context menu items. Disabled actions stay focusable
(`aria-disabled`, reason via `aria-describedby`, in the tooltip and in the menu item text).

`rowLabelField` (default `name`, then `rtWellKnownName`, `rtId`; a dotted path such as
`contact.displayName` reads a nested value) names the row. Hosts that build their own dialog titles
or danger confirmations use the same rule via `resolveListRowLabel(row, field)` (AB#5623).

- **Preferred:** `[rowActions]="actions"` (`MmListRowAction<TRow>[]`: an `MmAction` whose
  `disabledReason` / `visible` / `link` may be row callbacks, plus optional `run(row)`) and
  `(rowAction)` (`MmListRowActionEvent {id, action, row}`).
- **Still supported (adapter):** `actionCommandItems` (inline candidates, rendered before
  `rowActions`; `isDisabled` + new `CommandItem.disabledReason`, generic reason otherwise) and
  `contextMenuCommandItems` (overflow menu, incl. children and separators).

Toolbar actions (`CommandItem`s in `leftToolbarActions` / `rightToolbarActions`, AB#6211) are flat
and neutral; only `primary: true` makes one the solid primary — for a list that has no page header.
Lists inside a page put their create action into `[mmPageActions]` as
`<mm-action-button context="page" display="icon-text" primary>`. A disabled toolbar action with a
`disabledReason` (plain, split or dropdown button) stays focusable, announces the reason, shows it in
the tooltip and as a hint bubble on keyboard focus, like `mm-action-button`; the menu does not open.

## Spec guard (AB#5581)

`@meshmakers/shared-ui/testing` exports `expectIconButtonsAccessible(fixtureOrElement, options?)`:
throws when an icon-only button (icon, no visible text) lacks an accessible name (`aria-label` /
`aria-labelledby`) or a tooltip (`title`; opt out with `requireTooltip: false`). Kendo widget
internals are skipped (`includeKendoInternals: true` checks them); `ignore` takes a selector.
`findInaccessibleIconButtons` returns the problems instead of throwing.

## No OctoBot in actions (AB#3444)

Buttons, row actions, toolbar actions and toasts never contain the animated OctoBot
(`mm-octobot`). The figure belongs to a few page-level places only — empty states (once per
page), page loading, the assistant panel, 404 / turned-off pages and onboarding. A list row,
table cell, cockpit tile or button that repeats must not animate; this is the host's
responsibility. See [OctoBot](octobot.md) for the placement rules.
