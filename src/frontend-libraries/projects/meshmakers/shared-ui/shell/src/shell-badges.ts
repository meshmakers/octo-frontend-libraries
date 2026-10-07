/**
 * A count next to a navigation entry (AB#5621): pending work such as open inbox items or ToDos.
 * Hosts pass either the plain count or this object. A count of 0 (or none) shows no badge.
 */
export interface ShellNavBadge {
  count: number;
  /** Needs attention: rendered in the warning colour. */
  attention?: boolean;
  /**
   * Accessible text of the badge (e.g. "3 open ToDos"); without one the shell reads
   * {@link ShellMessages.navBadge} (`'{count} open'`).
   */
  label?: string;
}

/** Badge input of the rail: keyed by node id (area id `area-<space>` or a tab id). */
export type ShellNavBadges = Readonly<Record<string, number | ShellNavBadge | null | undefined>>;

/** Highest count shown as a number; larger counts read `99+`. */
export const SHELL_BADGE_MAX = 99;

/**
 * The badge of one entry: the `badges` input wins over the node's own `badgeCount`;
 * `null` when there is nothing to show (missing, 0, negative or not a number).
 */
export function resolveShellBadge(
  badges: ShellNavBadges | null | undefined,
  id: string,
  ownCount?: number | null
): ShellNavBadge | null {
  const fromInput = badges?.[id];
  const badge: ShellNavBadge | null =
    typeof fromInput === 'number' ? { count: fromInput }
      : fromInput ? fromInput
        : typeof ownCount === 'number' ? { count: ownCount }
          : null;
  return badge && Number.isFinite(badge.count) && badge.count > 0 ? badge : null;
}

/** Visible text of a badge count: the number, or `99+` above {@link SHELL_BADGE_MAX}. */
export function shellBadgeText(count: number): string {
  return count > SHELL_BADGE_MAX ? `${SHELL_BADGE_MAX}+` : String(Math.floor(count));
}
