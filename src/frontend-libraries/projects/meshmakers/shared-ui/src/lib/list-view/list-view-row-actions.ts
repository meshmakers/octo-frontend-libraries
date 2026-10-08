import {CommandItem} from '@meshmakers/shared-services';
import {MmAction, MmActionLink} from '../actions/action.model';

/* eslint-disable @typescript-eslint/no-explicit-any -- row callbacks are declared by the host with its own row type */

/**
 * A row action of `mm-list-view` (AB#5572), declared once per list from the shared action model
 * ({@link MmAction}): the per-row parts (`disabledReason`, `visible`, `link`) may be callbacks that
 * receive the row. Rendered with the guideline rules — neutral icon buttons (danger colour only for
 * `danger` actions), tooltip = label, accessible name = label + row name, at most
 * `maxInlineRowActions` slots (default 3; the last one becomes "More actions for …"), disabled
 * actions stay focusable and announce their reason.
 *
 * ```ts
 * protected readonly rowActions: MmListRowAction<AdapterDto>[] = [
 *   { id: 'edit', label: 'Edit', icon: MM_ACTION_ICONS.edit, link: (row) => ({ commands: ['details', row.rtId] }) },
 *   { id: 'delete', label: 'Delete', menuLabel: 'Delete…', icon: MM_ACTION_ICONS.delete, danger: true,
 *     disabledReason: (row) => row.deployed ? 'Undeploy the adapter first' : null, run: (row) => this.delete(row) },
 * ];
 * ```
 * ```html
 * <mm-list-view [rowActions]="rowActions" (rowAction)="onRowAction($event)" … />
 * ```
 */
export interface MmListRowAction<TRow = any, TId extends string = string>
  extends Omit<MmAction<TId>, 'disabledReason' | 'visible' | 'link'> {
  /** Why the action is unavailable for this row; non-empty = disabled (focusable, announced). */
  disabledReason?: string | null | ((row: TRow) => string | null | undefined);
  /** `false` (or a callback returning false) hides the action for the row. */
  visible?: boolean | ((row: TRow) => boolean);
  /** Navigation target (inline: real router link; overflow menu: Router.navigate relative to the host route). */
  link?: MmActionLink | ((row: TRow) => MmActionLink | null | undefined);
  /** Optional handler; `(rowAction)` fires as well. Destructive handlers confirm first (danger dialog). */
  run?: (row: TRow) => void | Promise<void>;
}

/** Emitted by `(rowAction)` for an enabled row action. */
export interface MmListRowActionEvent<TRow = any, TId extends string = string> {
  id: TId;
  action: MmAction<TId>;
  row: TRow;
}

/**
 * One row action resolved for a concrete row: the rendered {@link MmAction} plus where it came from —
 * a legacy `CommandItem` (`actionCommandItems`, handled via the CommandItem's link / onClick) or a
 * {@link MmListRowAction} (`rowActions`).
 */
export interface ResolvedListRowAction {
  action: MmAction;
  commandItem?: CommandItem;
  rowAction?: MmListRowAction;
}

/**
 * Human label of a list row (AB#5623) — the row's name in row action names ("Actions for <label>"),
 * dialog titles and danger confirmations. Reads `field` (a dotted path such as `contact.displayName`
 * also works, a flat key with dots wins), then each of `fallbacks` (default `rtWellKnownName`,
 * `rtId`); the first non-blank value wins. `''` when none is set.
 */
export function resolveListRowLabel(
  row: unknown,
  field: string | null | undefined,
  fallbacks: readonly string[] = ['rtWellKnownName', 'rtId'],
): string {
  const record = (row ?? {}) as Record<string, unknown>;
  for (const key of field ? [field, ...fallbacks] : fallbacks) {
    const value = readRowPath(record, key);
    if (value !== null && value !== undefined && typeof value !== 'object' && typeof value !== 'function' && String(value).trim() !== '') {
      return String(value);
    }
  }
  return '';
}

function readRowPath(row: Record<string, unknown>, path: string): unknown {
  if (path in row || path.indexOf('.') === -1) {
    return row[path];
  }
  let value: unknown = row;
  for (const key of path.split('.')) {
    if (value === null || value === undefined || typeof value !== 'object') {
      return undefined;
    }
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

/** Resolves the per-row callbacks of a {@link MmListRowAction}. */
export function resolveListRowAction(definition: MmListRowAction, row: unknown): MmAction {
  const {disabledReason, visible, link, run: _run, ...rest} = definition;
  return {
    ...rest,
    disabledReason: typeof disabledReason === 'function' ? disabledReason(row) ?? null : disabledReason ?? null,
    visible: typeof visible === 'function' ? visible(row) : visible,
    link: typeof link === 'function' ? link(row) ?? undefined : link,
  };
}

/** Structural equality of two rendered actions (keeps object identity stable across change detection). */
export function sameAction(a: MmAction, b: MmAction): boolean {
  return a.id === b.id && a.label === b.label && a.menuLabel === b.menuLabel && a.icon === b.icon
    && !!a.danger === !!b.danger && (a.disabledReason ?? null) === (b.disabledReason ?? null)
    && a.visible === b.visible && !!a.overflow === !!b.overflow && sameLink(a.link, b.link);
}

function sameLink(a: MmActionLink | undefined, b: MmActionLink | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
