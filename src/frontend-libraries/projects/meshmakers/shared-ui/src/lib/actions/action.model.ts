import {SVGIcon} from '@progress/kendo-svg-icons';
import {
  arrowRotateCwIcon,
  copyIcon,
  downloadIcon,
  eraserIcon,
  exportIcon,
  eyeIcon,
  fileDataIcon,
  fileReportIcon,
  hyperlinkOpenIcon,
  importIcon,
  pencilIcon,
  playIcon,
  plusIcon,
  stopIcon,
  trashIcon,
  uploadIcon,
  xCircleIcon,
} from '@progress/kendo-svg-icons';

/**
 * One user action (AB#5570): a row action, a toolbar action or a page action. The same
 * definition drives the inline icon button, the overflow menu item and the text button, so
 * label, icon, danger styling and the disabled reason never diverge between them.
 *
 * See `octo-frontend-refinery-studio/docs/concepts/studio-action-guideline.md`.
 */
export interface MmAction<TId extends string = string> {
  /** Stable id, emitted with the event and rendered as `data-action` (tests, analytics). */
  id: TId;
  /**
   * Verb phrase in sentence case ("Edit", "Delete dump", "Set value"). Used as tooltip,
   * menu/button text (unless `menuLabel` is set) and — together with the row label — as the
   * accessible name. Never ends with "…"; put that into `menuLabel`.
   */
  label: string;
  /**
   * Visible text in menus and text buttons when it differs from `label` — typically the "…" of
   * actions that open a dialog ("Delete dump…"). Tooltips and accessible names keep `label`.
   * Falls back to `label`.
   */
  menuLabel?: string;
  /** Kendo SVG icon; take it from {@link MM_ACTION_ICONS} where a canonical icon exists. */
  icon?: SVGIcon;
  /** Destructive action: danger styling; the handler must confirm (danger dialog, named target). */
  danger?: boolean;
  /**
   * Why the action is not available right now. A non-empty reason disables the action
   * (`aria-disabled`, still focusable) and is announced via `aria-describedby` and shown in
   * the tooltip. `null`/`undefined`/`''` = enabled.
   */
  disabledReason?: string | null;
  /** `false` hides the action (no permission, not applicable to this row). Default: visible. */
  visible?: boolean;
  /** Always place the action in the overflow menu, even when there is room inline. */
  overflow?: boolean;
  /**
   * Navigation target. Inline the action renders as a real link (`routerLink`, open in new tab
   * works); in the overflow menu it navigates with the Router. `triggered` still fires.
   */
  link?: MmActionLink;
}

/** Router target of a navigating action (`Router.navigate(commands, {queryParams})`). */
export interface MmActionLink {
  commands: readonly unknown[] | string;
  queryParams?: Record<string, string>;
}

/** Emitted when an enabled action is triggered. */
export interface MmActionEvent<TId extends string = string> {
  id: TId;
  action: MmAction<TId>;
}

/** Default number of row action slots (inline buttons incl. the overflow button). */
export const MM_ROW_ACTIONS_MAX_INLINE = 3;

/**
 * Canonical action icons (AB#5570). One verb, one icon, everywhere: pick from this map
 * instead of importing a Kendo icon ad hoc, so "Edit" never shows a gear in one list and a
 * pencil in the next.
 */
export const MM_ACTION_ICONS = {
  /** Create a new item ("New adapter", "Add mapping"). */
  add: plusIcon,
  /** Edit / open the editable form of the item. */
  edit: pencilIcon,
  /** Read-only view / preview. */
  view: eyeIcon,
  /** Open the item (or a related page) in its own view / new tab. */
  open: hyperlinkOpenIcon,
  /** Delete / remove the item (always `danger`). */
  delete: trashIcon,
  /** Clear a stored value without deleting the item ("Not needed", "Clear secret"). */
  clear: eraserIcon,
  /** Copy an id or value to the clipboard. */
  copy: copyIcon,
  /** Duplicate the item as a new item. */
  duplicate: fileDataIcon,
  /** Reload data. */
  refresh: arrowRotateCwIcon,
  /** Deploy to a pool / cluster. */
  deploy: uploadIcon,
  /** Undeploy. */
  undeploy: xCircleIcon,
  /** Run / execute / start. */
  run: playIcon,
  /** Stop / cancel a running job. */
  stop: stopIcon,
  /** Export data (file the user saves). */
  export: exportIcon,
  /** Import data. */
  import: importIcon,
  /** Download a file. */
  download: downloadIcon,
  /** Show a report / log. */
  report: fileReportIcon,
} as const satisfies Record<string, SVGIcon>;

export type MmActionIconName = keyof typeof MM_ACTION_ICONS;

/** True when the action is disabled (non-empty {@link MmAction.disabledReason}). */
export function isActionDisabled(action: MmAction): boolean {
  return !!action.disabledReason && action.disabledReason.trim().length > 0;
}

/** True unless the action is explicitly hidden. */
export function isActionVisible(action: MmAction): boolean {
  return action.visible !== false;
}

/**
 * Accessible name of an action on a named target: "Delete dump Encrypt run 2026-10-06 17:09".
 * Without a target the label alone.
 */
export function actionAccessibleName(action: MmAction, targetLabel?: string | null): string {
  const target = (targetLabel ?? '').trim();
  return target ? `${action.label} ${target}` : action.label;
}

/** Tooltip: the label, plus the reason when disabled ("Delete dump — Requires SecretManagement"). */
export function actionTooltip(action: MmAction): string {
  return isActionDisabled(action) ? `${action.label} — ${action.disabledReason!.trim()}` : action.label;
}

/**
 * Splits visible actions into inline buttons and overflow-menu items. At most `maxInline`
 * slots are rendered: when the actions do not fit, the last slot becomes the overflow
 * button. Actions with `overflow: true` always go to the menu (and need the overflow slot).
 */
export function splitRowActions<TId extends string>(
  actions: readonly MmAction<TId>[],
  maxInline: number = MM_ROW_ACTIONS_MAX_INLINE,
): { inline: MmAction<TId>[]; menu: MmAction<TId>[] } {
  const visible = actions.filter(isActionVisible);
  const forced = visible.filter((a) => a.overflow);
  const candidates = visible.filter((a) => !a.overflow);
  const slots = Math.max(1, Math.floor(maxInline));
  const needsMenu = forced.length > 0 || candidates.length > slots;
  if (!needsMenu) {
    return {inline: candidates, menu: []};
  }
  const inlineCount = Math.max(0, slots - 1);
  return {
    inline: candidates.slice(0, inlineCount),
    menu: [...candidates.slice(inlineCount), ...forced],
  };
}
