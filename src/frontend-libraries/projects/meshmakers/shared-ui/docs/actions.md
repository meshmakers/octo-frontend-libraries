# Actions: `mm-row-actions` and `mm-action-button`

Shared action rendering for row, toolbar and page actions (AB#5570). The rules behind it
are in the Studio action guideline
(`octo-frontend-refinery-studio/docs/concepts/studio-action-guideline.md`); this page is the API.

## The action definition

```ts
import {MM_ACTION_ICONS, MmAction} from '@meshmakers/shared-ui';

const deleteDump: MmAction<'delete-dump'> = {
  id: 'delete-dump',                 // emitted, rendered as data-action
  label: 'Delete dump',              // tooltip, menu text, accessible name (+ row label)
  icon: MM_ACTION_ICONS.delete,      // canonical icon per verb
  danger: true,                      // danger styling; the handler confirms
  disabledReason: busy ? 'A sweep is running' : null, // non-empty = disabled, announced
  visible: canManage,                // false = not rendered
  overflow: false,                   // true = always in the "More actions" menu
};
```

`MM_ACTION_ICONS` maps verbs to Kendo SVG icons: `add`, `edit`, `view`, `open`, `delete`,
`clear`, `copy`, `duplicate`, `refresh`, `deploy`, `undeploy`, `run`, `stop`, `export`,
`import`, `download`, `report`. Use it instead of importing icons ad hoc.

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
actions keep focus (`aria-disabled="true"`), link their reason via `aria-describedby` and show it
in the tooltip; in the menu the reason is shown under the item text and the item cannot be
chosen. The host gets `role="group"` and `aria-label="Actions for {row}"`.

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

## Confirming destructive actions

The components only emit. Destructive handlers confirm first, naming the target, e.g. with
`ConfirmationService.showDestructiveConfirmationDialog(title, message, confirmLabel)` or an own
`kendo-dialog` whose confirm button is `themeColor="error"` and whose title names the target.

## List view

`mm-list-view` renders its own row actions from `CommandItem`s (icon buttons with
`aria-label` = text + row label, context menu as overflow). `CommandItem.danger` gives a row
action danger styling there too. Converging the list view onto `mm-row-actions` (max-3 rule,
disabled reasons) is a follow-up.
